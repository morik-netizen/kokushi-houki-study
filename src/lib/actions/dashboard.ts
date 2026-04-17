'use server'

import { prisma } from '../db'
import { auth, isAllowedEmail, signOut } from '../auth'
import { redirect } from 'next/navigation'
import { LESSON_SCHEDULE } from '../lesson-schedule'

// ============================================
// 型定義
// ============================================

export interface StudentSummary {
  readonly id: string
  readonly name: string | null
  readonly email: string | null
  readonly totalAttempted: number
  readonly totalMastered: number
  readonly coverageRate: number
  readonly lastActiveAt: Date | null
  readonly isActive: boolean // 7日以内に学習
}

export interface LessonOverview {
  readonly lesson: number
  readonly title: string
  readonly totalQuestions: number
  readonly avgAttemptedRate: number // 全学生平均のカバー率
  readonly avgCorrectRate: number  // 全学生平均の正答率
}

export interface PracticeTestOverview {
  readonly quarter: string
  readonly label: string
  readonly totalAttempts: number
  readonly uniqueStudents: number
  readonly passCount: number
  readonly passRate: number
  readonly avgScore: number
}

export interface WeakCategory {
  readonly categoryCode: string
  readonly categoryName: string
  readonly totalAnswers: number
  readonly correctCount: number
  readonly correctRate: number
}

export interface HardQuestion {
  readonly questionId: number
  readonly categoryCode: string
  readonly categoryName: string
  readonly questionText: string
  readonly totalAnswers: number
  readonly correctCount: number
  readonly correctRate: number
}

export interface DailyActivity {
  readonly date: string
  readonly activeUsers: number
  readonly totalAnswers: number
}

export interface DashboardData {
  readonly totalStudents: number
  readonly activeStudents: number
  readonly totalQuestions: number
  readonly students: readonly StudentSummary[]
  readonly lessonOverview: readonly LessonOverview[]
  readonly practiceTests: readonly PracticeTestOverview[]
  readonly weakCategories: readonly WeakCategory[]
  readonly hardQuestions: readonly HardQuestion[]
  readonly dailyActivity: readonly DailyActivity[]
}

// ============================================
// 認証: 教員のみ
// ============================================

async function requireTeacher(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }
  if (!isAllowedEmail(session.user.email)) {
    await signOut()
    redirect('/login?error=AccessDenied')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (user?.role !== 'teacher') {
    redirect('/')
  }

  return session.user.id
}

// ============================================
// ダッシュボードデータ取得
// ============================================

export async function getDashboardData(): Promise<DashboardData> {
  await requireTeacher()

  const now = new Date()
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(now.getDate() - 7)
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(now.getDate() - 30)

  // 全問題
  const allQuestions = await prisma.question.findMany({
    select: { id: true, categoryCode: true, categoryName: true, questionText: true },
  })
  const totalQuestions = allQuestions.length

  // 全学生
  const allUsers = await prisma.user.findMany({
    where: { role: 'student' },
    select: { id: true, name: true, email: true },
  })
  const totalStudents = allUsers.length

  // 全学習記録
  const allRecords = await prisma.learningRecord.findMany({
    select: { userId: true, questionId: true, totalAttempts: true, correctCount: true, status: true },
  })

  // 全回答履歴
  const allAnswers = await prisma.answerHistory.findMany({
    select: { userId: true, questionId: true, isCorrect: true, answeredAt: true },
  })

  // 初回回答のみ抽出 (userId × questionId で最古1件)
  // 弱点カテゴリ・難問TOPの指標に使う。retry での正解を含めると「授業で吸収できたか」が
  // 見えなくなり、授業改善の判断材料として機能しなくなるため。
  const firstAnswerMap = new Map<string, (typeof allAnswers)[number]>()
  for (const a of allAnswers) {
    const key = `${a.userId}:${a.questionId}`
    const existing = firstAnswerMap.get(key)
    if (!existing || a.answeredAt.getTime() < existing.answeredAt.getTime()) {
      firstAnswerMap.set(key, a)
    }
  }
  const firstAttemptAnswers = Array.from(firstAnswerMap.values())

  // ---- 学生一覧 + 進捗 ----
  const recordsByUser = new Map<string, typeof allRecords>()
  for (const r of allRecords) {
    const arr = recordsByUser.get(r.userId) ?? []
    arr.push(r)
    recordsByUser.set(r.userId, arr)
  }

  const lastActiveByUser = new Map<string, Date>()
  for (const a of allAnswers) {
    const current = lastActiveByUser.get(a.userId)
    if (!current || a.answeredAt > current) {
      lastActiveByUser.set(a.userId, a.answeredAt)
    }
  }

  const students: StudentSummary[] = allUsers.map((u) => {
    const records = recordsByUser.get(u.id) ?? []
    const attempted = records.filter((r) => r.totalAttempts > 0).length
    const mastered = records.filter((r) => r.status === 'mastered').length
    const lastActive = lastActiveByUser.get(u.id) ?? null

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      totalAttempted: attempted,
      totalMastered: mastered,
      coverageRate: totalQuestions > 0 ? attempted / totalQuestions : 0,
      lastActiveAt: lastActive,
      isActive: lastActive !== null && lastActive >= sevenDaysAgo,
    }
  })

  const activeStudents = students.filter((s) => s.isActive).length

  // ---- 授業回別の全体達成状況 ----
  const studentIds = new Set(allUsers.map((u) => u.id))
  const studentCount = studentIds.size

  const lessonOverview: LessonOverview[] = LESSON_SCHEDULE
    .filter((l) => l.categoryCodes.length > 0)
    .map((l) => {
      const lessonQuestionIds = allQuestions
        .filter((q) => l.categoryCodes.includes(q.categoryCode))
        .map((q) => q.id)
      const lessonTotal = lessonQuestionIds.length

      if (lessonTotal === 0 || studentCount === 0) {
        return { lesson: l.lesson, title: l.title, totalQuestions: 0, avgAttemptedRate: 0, avgCorrectRate: 0 }
      }

      let sumAttemptedRate = 0
      let sumCorrectRate = 0

      for (const uid of studentIds) {
        const userRecords = recordsByUser.get(uid) ?? []
        const relevant = userRecords.filter((r) => lessonQuestionIds.includes(r.questionId))
        const attempted = relevant.filter((r) => r.totalAttempts > 0).length
        const correctSum = relevant.reduce((sum, r) => sum + r.correctCount, 0)
        const attemptsSum = relevant.reduce((sum, r) => sum + r.totalAttempts, 0)

        sumAttemptedRate += attempted / lessonTotal
        sumCorrectRate += attemptsSum > 0 ? correctSum / attemptsSum : 0
      }

      return {
        lesson: l.lesson,
        title: l.title,
        totalQuestions: lessonTotal,
        avgAttemptedRate: sumAttemptedRate / studentCount,
        avgCorrectRate: sumCorrectRate / studentCount,
      }
    })

  // ---- 練習テスト合格状況 ----
  const practiceTestConfigs = [
    { quarter: 'Q1', label: '第1回〜第4回' },
    { quarter: 'Q2', label: '第5回〜第7回' },
    { quarter: 'Q3', label: '第8回〜第11回' },
    { quarter: 'Q4', label: '総合テスト' },
  ]

  const allPracticeTests = await prisma.practiceTest.findMany()

  const practiceTests: PracticeTestOverview[] = practiceTestConfigs.map((config) => {
    const tests = allPracticeTests.filter((t) => t.quarter === config.quarter)
    const uniqueStudents = new Set(tests.map((t) => t.userId)).size
    const passCount = new Set(
      tests.filter((t) => t.passed).map((t) => t.userId)
    ).size
    const avgScore = tests.length > 0
      ? tests.reduce((sum, t) => sum + t.score, 0) / tests.length
      : 0

    return {
      quarter: config.quarter,
      label: config.label,
      totalAttempts: tests.length,
      uniqueStudents,
      passCount,
      passRate: uniqueStudents > 0 ? passCount / uniqueStudents : 0,
      avgScore,
    }
  })

  // ---- 正答率が低いカテゴリ (初回回答のみ) ----
  // 授業で扱った直後の初回正答率を基に、次回授業で強化すべきカテゴリを判断する。
  const categoryStats = new Map<string, { name: string; total: number; correct: number }>()
  for (const a of firstAttemptAnswers) {
    const q = allQuestions.find((qq) => qq.id === a.questionId)
    if (!q) continue
    const stat = categoryStats.get(q.categoryCode) ?? { name: q.categoryName, total: 0, correct: 0 }
    stat.total++
    if (a.isCorrect) stat.correct++
    categoryStats.set(q.categoryCode, stat)
  }

  const weakCategories: WeakCategory[] = Array.from(categoryStats.entries())
    .map(([code, stat]) => ({
      categoryCode: code,
      categoryName: stat.name,
      totalAnswers: stat.total,
      correctCount: stat.correct,
      correctRate: stat.total > 0 ? stat.correct / stat.total : 0,
    }))
    .sort((a, b) => a.correctRate - b.correctRate)

  // ---- 正答率が低い問題TOP20 (初回回答のみ) ----
  // 「学生が授業後に初見で解けるか」を測る。retry で正解した回答を含めると
  // 本来難問の問題が「みんな解けている」と誤判定される。国試は初回勝負なので
  // 初回正答率で難問を同定するのが学習効果改善の近道。
  const questionStats = new Map<number, { total: number; correct: number }>()
  for (const a of firstAttemptAnswers) {
    const stat = questionStats.get(a.questionId) ?? { total: 0, correct: 0 }
    stat.total++
    if (a.isCorrect) stat.correct++
    questionStats.set(a.questionId, stat)
  }

  const hardQuestions: HardQuestion[] = Array.from(questionStats.entries())
    .filter(([, stat]) => stat.total >= 3) // 最低3回以上回答がある問題
    .map(([qid, stat]) => {
      const q = allQuestions.find((qq) => qq.id === qid)
      return {
        questionId: qid,
        categoryCode: q?.categoryCode ?? '',
        categoryName: q?.categoryName ?? '',
        questionText: q?.questionText ?? '',
        totalAnswers: stat.total,
        correctCount: stat.correct,
        correctRate: stat.total > 0 ? stat.correct / stat.total : 0,
      }
    })
    .sort((a, b) => a.correctRate - b.correctRate)
    .slice(0, 20)

  // ---- 日別アクティブユーザー数 (過去30日) ----
  const recentAnswers = allAnswers.filter((a) => a.answeredAt >= thirtyDaysAgo)
  const dailyMap = new Map<string, { users: Set<string>; count: number }>()

  for (const a of recentAnswers) {
    const dateStr = a.answeredAt.toISOString().slice(0, 10)
    const entry = dailyMap.get(dateStr) ?? { users: new Set(), count: 0 }
    entry.users.add(a.userId)
    entry.count++
    dailyMap.set(dateStr, entry)
  }

  const dailyActivity: DailyActivity[] = Array.from(dailyMap.entries())
    .map(([date, entry]) => ({
      date,
      activeUsers: entry.users.size,
      totalAnswers: entry.count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    totalStudents,
    activeStudents,
    totalQuestions,
    students: students.sort((a, b) => b.coverageRate - a.coverageRate),
    lessonOverview,
    practiceTests,
    weakCategories,
    hardQuestions,
    dailyActivity,
  }
}
