'use server'

import { prisma } from '../db'
import { auth, isAllowedEmail, signOut } from '../auth'
import { isCorrectAnswer, calculatePoints } from '../scoring'
import { calculateSM2, evaluateQuality } from '../sm2'
import type { Quality } from '../types'
import { redirect } from 'next/navigation'
import {
  LESSON_SCHEDULE,
  getCurrentLesson,
  getCumulativeCategories,
  getDaysUntilNextMilestone,
} from '../lesson-schedule'
import {
  calculateStreak,
  getWeekStartJst,
  getPreviousWeekStartJst,
  toJstDateString,
} from '../streak'

// ============================================
// 型定義 (Server Action用、Date→string変換済み)
// ============================================

export interface QuestionDTO {
  readonly id: number
  readonly categoryCode: string
  readonly categoryName: string
  readonly questionText: string
  readonly choiceA: string
  readonly choiceB: string
  readonly choiceC: string
  readonly choiceD: string
  readonly correctAnswers: string
  readonly correctFeedback: string | null
  readonly incorrectFeedback: string | null
  readonly similarityGroup: number | null
}

export interface SubmitAnswerResult {
  readonly isCorrect: boolean
  readonly correctAnswers: string
  readonly feedback: string
  readonly pointsEarned: number
  readonly newStatus: string
}

export interface LessonProgress {
  readonly lesson: number
  readonly date: string
  readonly title: string
  readonly type: string
  readonly isCurrent: boolean
  readonly totalQuestions: number
  readonly attempted: number
  readonly mastered: number
}

export interface HomeProgress {
  readonly totalUnlocked: number
  readonly attempted: number
  readonly mastered: number
  readonly coverageRate: number
  readonly totalPoints: number
  readonly streakDays: number       // 連続学習日数（JST基準、猶予: 昨日まで可）
  readonly thisWeekCount: number    // 今週(月曜00:00 JST〜)の回答数
  readonly growthDiff: number       // 今週 − 先週 の回答数差
  readonly recommendedCount: number
  readonly reviewDueCount: number
  readonly unattemptedCount: number
  readonly recentMissCount: number
  readonly categoryBreakdown: readonly CategoryProgress[]
  readonly lessonProgress: readonly LessonProgress[]
  readonly currentLesson: number
  readonly currentLessonTitle: string
  readonly daysUntilNextMilestone: number
  readonly nextMilestoneLabel: string
}

export interface CategoryProgress {
  readonly categoryCode: string
  readonly categoryName: string
  readonly total: number
  readonly attempted: number
  readonly mastered: number
}

// ============================================
// 認証ヘルパー
// ============================================

async function requireAuth(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }
  if (!isAllowedEmail(session.user.email)) {
    await signOut()
    redirect('/login?error=AccessDenied')
  }
  return session.user.id
}

// ============================================
// 出題: 解放済み問題をSM-2優先で取得
// ============================================

const RECENT_MISS_WINDOW_DAYS = 3

export async function getQuizQuestions(
  maxQuestions: number = 12,
  categoryCodes?: readonly string[]
): Promise<readonly QuestionDTO[]> {
  const userId = await requireAuth()
  const today = new Date()

  // 1. 問題を取得（カテゴリ指定がある場合はフィルタ）
  const allQuestions = await prisma.question.findMany({
    where: categoryCodes && categoryCodes.length > 0
      ? { categoryCode: { in: [...categoryCodes] } }
      : undefined,
    orderBy: { id: 'asc' },
  })

  // 2. ユーザーの学習記録を取得
  const records = await prisma.learningRecord.findMany({
    where: { userId },
  })

  const recordMap = new Map(records.map((r) => [r.questionId, r]))

  // 3. mastered を除外
  const candidates = allQuestions.filter((q) => {
    const record = recordMap.get(q.id)
    return !record || record.status !== 'mastered'
  })

  // 4. 直近ミス (過去3日以内、lastQuality<3)
  const windowMs = RECENT_MISS_WINDOW_DAYS * 24 * 60 * 60 * 1000
  const recentMisses = candidates.filter((q) => {
    const r = recordMap.get(q.id)
    if (!r || r.lastQuality === null || r.lastQuality >= 3) return false
    if (!r.lastAttemptedAt) return false
    return today.getTime() - r.lastAttemptedAt.getTime() <= windowMs
  })

  // 5. 未挑戦（授業連動ブースト: 今週の単元を先頭）
  const currentLessonNum = getCurrentLesson(today)
  const currentLessonMeta = LESSON_SCHEDULE.find(
    (l) => l.lesson === currentLessonNum
  )
  const boostSet = new Set(currentLessonMeta?.categoryCodes ?? [])

  const recentMissIds = new Set(recentMisses.map((q) => q.id))
  const unattemptedRaw = candidates.filter(
    (q) => !recordMap.has(q.id) && !recentMissIds.has(q.id)
  )
  const unattempted = [
    ...unattemptedRaw.filter((q) => boostSet.has(q.categoryCode)),
    ...unattemptedRaw.filter((q) => !boostSet.has(q.categoryCode)),
  ]

  // 6. 復習対象 (nextReviewDate <= today)
  const usedIds = new Set<number>([
    ...recentMissIds,
    ...unattempted.map((q) => q.id),
  ])
  const reviewDue = candidates.filter((q) => {
    if (usedIds.has(q.id)) return false
    const record = recordMap.get(q.id)
    if (!record || !record.nextReviewDate) return false
    return record.nextReviewDate.getTime() <= today.getTime()
  })

  // 7. 類似グループ制約を適用しながら選択
  const selected: typeof allQuestions = []
  const usedGroups = new Set<number>()

  const tryAdd = (q: (typeof allQuestions)[number]): boolean => {
    if (selected.length >= maxQuestions) return false
    if (q.similarityGroup !== null) {
      if (usedGroups.has(q.similarityGroup)) return false
      usedGroups.add(q.similarityGroup)
    }
    selected.push(q)
    return true
  }

  for (const q of recentMisses) tryAdd(q)
  for (const q of unattempted) tryAdd(q)
  for (const q of reviewDue) {
    if (!selected.some((s) => s.id === q.id)) tryAdd(q)
  }

  // 8. DTO変換 (Date除去)
  return selected.map((q) => ({
    id: q.id,
    categoryCode: q.categoryCode,
    categoryName: q.categoryName,
    questionText: q.questionText,
    choiceA: q.choiceA,
    choiceB: q.choiceB,
    choiceC: q.choiceC,
    choiceD: q.choiceD,
    correctAnswers: q.correctAnswers,
    correctFeedback: q.correctFeedback,
    incorrectFeedback: q.incorrectFeedback,
    similarityGroup: q.similarityGroup,
  }))
}

// ============================================
// 単元別: もう一度解くモード用
// 指定した授業回の全問題を返す (SM-2スケジュール無視)
// ============================================

export async function getLessonAllQuestions(
  lessonNum: number,
  maxQuestions: number = 12
): Promise<readonly QuestionDTO[]> {
  await requireAuth()

  const lesson = LESSON_SCHEDULE.find((l) => l.lesson === lessonNum)
  if (!lesson || lesson.categoryCodes.length === 0) return []

  const allQuestions = await prisma.question.findMany({
    where: { categoryCode: { in: [...lesson.categoryCodes] } },
    orderBy: { id: 'asc' },
  })

  // 類似グループ制約を適用しつつ、ランダムに選ぶ
  const shuffled = [...allQuestions].sort(() => Math.random() - 0.5)
  const selected: typeof allQuestions = []
  const usedGroups = new Set<number>()

  for (const q of shuffled) {
    if (selected.length >= maxQuestions) break
    if (q.similarityGroup !== null) {
      if (usedGroups.has(q.similarityGroup)) continue
      usedGroups.add(q.similarityGroup)
    }
    selected.push(q)
  }

  return selected.map((q) => ({
    id: q.id,
    categoryCode: q.categoryCode,
    categoryName: q.categoryName,
    questionText: q.questionText,
    choiceA: q.choiceA,
    choiceB: q.choiceB,
    choiceC: q.choiceC,
    choiceD: q.choiceD,
    correctAnswers: q.correctAnswers,
    correctFeedback: q.correctFeedback,
    incorrectFeedback: q.incorrectFeedback,
    similarityGroup: q.similarityGroup,
  }))
}

// ============================================
// 回答送信: 採点 + SM-2更新 + 履歴記録
// ============================================

export type AnswerMode = 'normal' | 'retry'

export async function submitAnswer(
  questionId: number,
  selectedAnswer: string,
  responseTimeMs: number,
  mode: AnswerMode = 'normal'
): Promise<SubmitAnswerResult> {
  // 入力バリデーション
  if (!Number.isInteger(questionId) || questionId <= 0) {
    throw new Error('不正なリクエストです')
  }
  if (!/^[A-D](,[A-D])*$/.test(selectedAnswer)) {
    throw new Error('不正なリクエストです')
  }
  if (!Number.isFinite(responseTimeMs) || responseTimeMs < 0 || responseTimeMs > 600_000) {
    throw new Error('不正なリクエストです')
  }

  const userId = await requireAuth()

  // 1. 問題を取得
  const question = await prisma.question.findUniqueOrThrow({
    where: { id: questionId },
  })

  // 2. 採点
  const correct = isCorrectAnswer(selectedAnswer, question.correctAnswers)
  const points = calculatePoints(correct)
  const quality: Quality = evaluateQuality(correct)

  // 3. 既存の学習記録を取得
  const existing = await prisma.learningRecord.findUnique({
    where: { userId_questionId: { userId, questionId } },
  })

  // retry モードは既存レコードが前提。未存在時はnormal扱いにフォールバック
  // (UIは完走後のみretryボタンを出すので通常は発生しないが、直URLアクセスを考慮)
  const effectiveMode: AnswerMode =
    mode === 'retry' && !existing ? 'normal' : mode

  let newStatus: string
  const learningRecordWrite =
    effectiveMode === 'retry' && existing
      ? prisma.learningRecord.update({
          where: { userId_questionId: { userId, questionId } },
          data: {
            totalAttempts: { increment: 1 },
            correctCount: correct ? { increment: 1 } : undefined,
            lastAnswer: selectedAnswer,
            lastQuality: quality,
            lastAttemptedAt: new Date(),
          },
        })
      : null

  let sm2Upsert: ReturnType<typeof prisma.learningRecord.upsert> | null = null
  if (effectiveMode === 'normal') {
    const previousEF = existing ? Number(existing.easinessFactor) : 2.5
    const previousInterval = existing?.intervalDays ?? 0
    const previousRepetitions = existing?.repetitions ?? 0

    const sm2 = calculateSM2(
      { quality, previousEF, previousInterval, previousRepetitions },
      new Date()
    )

    sm2Upsert = prisma.learningRecord.upsert({
      where: { userId_questionId: { userId, questionId } },
      create: {
        userId,
        questionId,
        easinessFactor: sm2.easinessFactor,
        intervalDays: sm2.intervalDays,
        repetitions: sm2.repetitions,
        nextReviewDate: sm2.nextReviewDate,
        status: sm2.status,
        totalAttempts: 1,
        correctCount: correct ? 1 : 0,
        lastAnswer: selectedAnswer,
        lastQuality: quality,
        lastAttemptedAt: new Date(),
      },
      update: {
        easinessFactor: sm2.easinessFactor,
        intervalDays: sm2.intervalDays,
        repetitions: sm2.repetitions,
        nextReviewDate: sm2.nextReviewDate,
        status: sm2.status,
        totalAttempts: { increment: 1 },
        correctCount: correct ? { increment: 1 } : undefined,
        lastAnswer: selectedAnswer,
        lastQuality: quality,
        lastAttemptedAt: new Date(),
      },
    })
    newStatus = sm2.status
  } else {
    newStatus = existing?.status ?? 'learning'
  }

  const answerHistoryWrite = prisma.answerHistory.create({
    data: {
      userId,
      questionId,
      selectedAnswer,
      isCorrect: correct,
      quality,
      responseTimeMs,
      sessionType: mode === 'retry' ? 'retry' : 'daily',
    },
  })

  // 学習記録と履歴をアトミックに書き込む
  const learningWrite = sm2Upsert ?? learningRecordWrite
  if (learningWrite) {
    await prisma.$transaction([learningWrite, answerHistoryWrite])
  } else {
    await answerHistoryWrite
  }

  return {
    isCorrect: correct,
    correctAnswers: question.correctAnswers,
    feedback: correct
      ? (question.correctFeedback ?? '正解です！')
      : (question.incorrectFeedback ?? '不正解です。'),
    pointsEarned: points,
    newStatus,
  }
}

// ============================================
// ホーム画面用の進捗データ取得
// ============================================

export async function getHomeProgress(): Promise<HomeProgress> {
  const userId = await requireAuth()
  const today = new Date()

  // 全問題数（全コンテンツ公開方式）
  const unlockedQuestions = await prisma.question.findMany({
    select: { id: true, categoryCode: true, categoryName: true },
  })
  const totalUnlocked = unlockedQuestions.length

  // 学習記録
  const records = await prisma.learningRecord.findMany({
    where: { userId },
  })

  const attempted = records.filter((r) => r.totalAttempts > 0).length
  const mastered = records.filter((r) => r.status === 'mastered').length
  const coverageRate = totalUnlocked > 0 ? attempted / totalUnlocked : 0

  // ポイント計算
  const correctAnswers = await prisma.answerHistory.count({
    where: { userId, isCorrect: true },
  })
  const totalPoints = correctAnswers * 10

  // 連続学習日数 (JST基準・真のストリーク)
  const prevWeekStart = getPreviousWeekStartJst(today)
  const weekStart = getWeekStartJst(today)

  const recentAnswers = await prisma.answerHistory.findMany({
    where: { userId, answeredAt: { gte: prevWeekStart } },
    select: { answeredAt: true },
  })

  // 全期間のユニーク日を取得 (ストリーク計算用)
  const allAnswersForStreak = await prisma.answerHistory.findMany({
    where: { userId },
    select: { answeredAt: true },
    orderBy: { answeredAt: 'desc' },
    take: 400, // ストリーク判定は直近だけで十分 (1年分あれば足りる)
  })
  const jstDateSet = new Set(
    allAnswersForStreak.map((a) => toJstDateString(a.answeredAt))
  )
  const streakDays = calculateStreak(jstDateSet, today)

  // 今週・先週の回答数 (成長指標)
  let thisWeekCount = 0
  let lastWeekCount = 0
  for (const a of recentAnswers) {
    const t = a.answeredAt.getTime()
    if (t >= weekStart.getTime()) thisWeekCount++
    else if (t >= prevWeekStart.getTime()) lastWeekCount++
  }
  const growthDiff = thisWeekCount - lastWeekCount

  // 推奨問題数 (マイルストーン範囲ベース + 動的残日数 + 直近ミス加算)
  const reviewDueCount = records.filter(
    (r) => r.nextReviewDate && r.nextReviewDate.getTime() <= today.getTime()
  ).length
  const unattemptedCount = totalUnlocked - attempted

  const windowMs = RECENT_MISS_WINDOW_DAYS * 24 * 60 * 60 * 1000
  const recentMissCount = records.filter(
    (r) =>
      r.status !== 'mastered' &&
      r.lastQuality !== null &&
      r.lastQuality < 3 &&
      r.lastAttemptedAt !== null &&
      today.getTime() - r.lastAttemptedAt.getTime() <= windowMs
  ).length

  const milestone = getDaysUntilNextMilestone(today)
  const daysUntilNextTest = milestone.daysUntil

  // 次マイルストーン(練習テスト/終講試験)までに履修予定のカテゴリ範囲の未挑戦数
  // 全393問を基準にすると初日から毎日30問になり、1年生には過剰。直近範囲に絞る。
  const milestoneCategoryCodes = new Set(
    getCumulativeCategories(milestone.lesson)
  )
  const attemptedIds = new Set(
    records.filter((r) => r.totalAttempts > 0).map((r) => r.questionId)
  )
  const unattemptedInMilestone = unlockedQuestions.filter(
    (q) =>
      milestoneCategoryCodes.has(q.categoryCode) && !attemptedIds.has(q.id)
  ).length

  const raw =
    daysUntilNextTest > 0
      ? Math.ceil(unattemptedInMilestone / daysUntilNextTest) +
        reviewDueCount +
        recentMissCount
      : reviewDueCount + recentMissCount
  const recommendedCount = Math.min(30, Math.max(3, raw))

  // カテゴリ別進捗
  const recordMap = new Map(records.map((r) => [r.questionId, r]))
  const categoryMap = new Map<
    string,
    { name: string; total: number; attempted: number; mastered: number }
  >()

  for (const q of unlockedQuestions) {
    const cat = categoryMap.get(q.categoryCode) ?? {
      name: q.categoryName,
      total: 0,
      attempted: 0,
      mastered: 0,
    }
    cat.total++
    const record = recordMap.get(q.id)
    if (record && record.totalAttempts > 0) cat.attempted++
    if (record && record.status === 'mastered') cat.mastered++
    categoryMap.set(q.categoryCode, cat)
  }

  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([code, data]) => ({
      categoryCode: code,
      categoryName: data.name,
      total: data.total,
      attempted: data.attempted,
      mastered: data.mastered,
    }))
    .sort((a, b) => a.categoryCode.localeCompare(b.categoryCode))

  // 授業回別進捗
  const currentLesson = getCurrentLesson(today)
  const lessonProgress: LessonProgress[] = LESSON_SCHEDULE
    .filter((l) => l.categoryCodes.length > 0)
    .map((l) => {
      let lessonTotal = 0
      let lessonAttempted = 0
      let lessonMastered = 0
      for (const q of unlockedQuestions) {
        if (l.categoryCodes.includes(q.categoryCode)) {
          lessonTotal++
          const record = recordMap.get(q.id)
          if (record && record.totalAttempts > 0) lessonAttempted++
          if (record && record.status === 'mastered') lessonMastered++
        }
      }
      return {
        lesson: l.lesson,
        date: l.date,
        title: l.title,
        type: l.type,
        isCurrent: l.lesson === currentLesson,
        totalQuestions: lessonTotal,
        attempted: lessonAttempted,
        mastered: lessonMastered,
      }
    })

  const currentLessonMeta = LESSON_SCHEDULE.find(
    (l) => l.lesson === currentLesson
  )
  const currentLessonTitle = currentLessonMeta?.title ?? ''

  return {
    totalUnlocked,
    attempted,
    mastered,
    coverageRate,
    totalPoints,
    streakDays,
    thisWeekCount,
    growthDiff,
    recommendedCount,
    reviewDueCount,
    unattemptedCount,
    recentMissCount,
    categoryBreakdown,
    lessonProgress,
    currentLesson,
    currentLessonTitle,
    daysUntilNextMilestone: milestone.daysUntil,
    nextMilestoneLabel: milestone.label,
  }
}

// ============================================
// 間違いノート: 不正解問題を取得
// ============================================

export async function getMistakes(): Promise<
  readonly {
    readonly questionId: number
    readonly categoryCode: string
    readonly categoryName: string
    readonly questionText: string
    readonly correctAnswers: string
    readonly incorrectFeedback: string | null
    readonly lastAnswer: string | null
    readonly totalAttempts: number
    readonly correctCount: number
  }[]
> {
  const userId = await requireAuth()

  const records = await prisma.learningRecord.findMany({
    where: { userId, totalAttempts: { gt: 0 } },
    include: { question: true },
    orderBy: { updatedAt: 'desc' },
  })

  // 間違えたことがあり、かつ直近3回連続正解していない問題
  return records
    .filter((r) => r.correctCount < r.totalAttempts && r.repetitions < 3)
    .map((r) => ({
      questionId: r.questionId,
      categoryCode: r.question.categoryCode,
      categoryName: r.question.categoryName,
      questionText: r.question.questionText,
      correctAnswers: r.question.correctAnswers,
      incorrectFeedback: r.question.incorrectFeedback,
      lastAnswer: r.lastAnswer,
      totalAttempts: r.totalAttempts,
      correctCount: r.correctCount,
    }))
}
