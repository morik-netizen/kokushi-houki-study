// ============================================
// 出題エンジン
// ============================================

import type { Question, LearningRecord, QuizSession, UserProgress } from './types'

/**
 * カバー率優先方式で出題する問題を選択する
 *
 * 1. 未挑戦の問題を優先
 * 2. SM-2の復習日が来た問題を追加
 * 3. 同一類似グループから1問まで
 * 4. 上限30問/日
 */
export function selectQuestions(
  availableQuestions: readonly Question[],
  learningRecords: readonly LearningRecord[],
  today: Date,
  maxQuestions: number
): QuizSession {
  const recordMap = new Map(learningRecords.map((r) => [r.questionId, r]))

  // mastered を除外
  const candidates = availableQuestions.filter((q) => {
    const record = recordMap.get(q.id)
    return !record || record.status !== 'mastered'
  })

  // 未挑戦
  const unattempted = candidates.filter((q) => !recordMap.has(q.id))

  // 復習対象 (nextReviewDate <= today)
  const reviewDue = candidates.filter((q) => {
    const record = recordMap.get(q.id)
    if (!record || !record.nextReviewDate) return false
    return record.nextReviewDate.getTime() <= today.getTime()
  })

  // 類似グループ制約を適用しながら選択
  const selected: Question[] = []
  const usedGroups = new Set<number>()

  const tryAdd = (q: Question): boolean => {
    if (selected.length >= maxQuestions) return false
    if (q.similarityGroup !== null) {
      if (usedGroups.has(q.similarityGroup)) return false
      usedGroups.add(q.similarityGroup)
    }
    selected.push(q)
    return true
  }

  // 未挑戦を優先
  let newCount = 0
  for (const q of unattempted) {
    if (tryAdd(q)) newCount++
  }

  // 復習問題を追加
  let reviewCount = 0
  for (const q of reviewDue) {
    // 未挑戦で既に追加済みの場合はスキップ
    if (selected.some((s) => s.id === q.id)) continue
    if (tryAdd(q)) reviewCount++
  }

  return { questions: selected, newCount, reviewCount }
}

/**
 * 今日の推奨問題数を計算する
 *
 * 推奨量 = 次マイルストーン範囲の未挑戦数 ÷ 残日数 + SM-2復習数 + 直近ミス数
 * 下限: 3問, 上限: 30問
 *
 * `unattemptedInMilestoneCount` は「次マイルストーン(練習テスト/終講試験)までに
 * 履修済みとなる範囲」の未挑戦数を想定する。全393問基準ではなく直近範囲基準にする
 * ことで、1日の推奨量が現実的な分量(10問前後)に収まる。
 *
 * 直前期は残日数が小さくなるため、自然と推奨数が増えて追込みモードに移行する
 * (例: 125/13≒10問 → 125/2≒63 → min(30)でクランプ)。
 */
export function calculateRecommendedDaily(
  unattemptedInMilestoneCount: number,
  daysUntilNextTest: number,
  reviewDueCount: number,
  recentMissCount: number = 0
): number {
  const daily =
    daysUntilNextTest > 0
      ? Math.ceil(unattemptedInMilestoneCount / daysUntilNextTest) +
        reviewDueCount +
        recentMissCount
      : reviewDueCount + recentMissCount
  return Math.min(30, Math.max(3, daily))
}

/**
 * 直近ミスか判定する
 * 過去 windowDays 日以内に lastQuality < 3 で不正解したもの
 */
export function isRecentMiss(
  record: LearningRecord | undefined,
  today: Date,
  windowDays: number = 3
): boolean {
  if (!record) return false
  if (record.status === 'mastered') return false
  const q = record.lastQuality
  if (q === null || q === undefined || q >= 3) return false
  if (!record.lastAttemptedAt) return false
  const windowMs = windowDays * 24 * 60 * 60 * 1000
  return today.getTime() - record.lastAttemptedAt.getTime() <= windowMs
}

/**
 * おすすめ問題の並び順を決める純粋関数
 *
 * 優先順位:
 *   1. 直近ミス (過去windowDays日以内、lastQuality<3)
 *   2. 未挑戦（授業連動カテゴリを先頭にブースト）
 *   3. 復習対象 (nextReviewDate <= today)
 *
 * mastered は除外済み前提
 */
export function orderRecommendations(
  candidates: readonly Question[],
  learningRecords: readonly LearningRecord[],
  boostCategoryCodes: readonly string[],
  today: Date,
  recentMissWindowDays: number = 3
): readonly Question[] {
  const recordMap = new Map(learningRecords.map((r) => [r.questionId, r]))
  const boostSet = new Set(boostCategoryCodes)

  // 1. 直近ミス
  const recentMisses = candidates.filter((q) =>
    isRecentMiss(recordMap.get(q.id), today, recentMissWindowDays)
  )
  const recentMissIds = new Set(recentMisses.map((q) => q.id))

  // 2. 未挑戦 (レコード無し) — boost 先頭
  const unattempted = candidates.filter(
    (q) => !recordMap.has(q.id) && !recentMissIds.has(q.id)
  )
  const boostedUnattempted = [
    ...unattempted.filter((q) => boostSet.has(q.categoryCode)),
    ...unattempted.filter((q) => !boostSet.has(q.categoryCode)),
  ]
  const usedIds = new Set<number>([
    ...recentMissIds,
    ...boostedUnattempted.map((q) => q.id),
  ])

  // 3. 復習対象
  const reviewDue = candidates.filter((q) => {
    if (usedIds.has(q.id)) return false
    const r = recordMap.get(q.id)
    if (!r || !r.nextReviewDate) return false
    return r.nextReviewDate.getTime() <= today.getTime()
  })

  return [...recentMisses, ...boostedUnattempted, ...reviewDue]
}

/**
 * ユーザーの進捗情報を計算する
 */
export function calculateProgress(
  totalUnlocked: number,
  learningRecords: readonly LearningRecord[],
  totalPoints: number,
  weeklyActiveDays: number,
  daysUntilNextTest: number
): UserProgress {
  const attempted = learningRecords.filter((r) => r.totalAttempts > 0).length
  const mastered = learningRecords.filter((r) => r.status === 'mastered').length
  const coverageRate = totalUnlocked > 0 ? attempted / totalUnlocked : 0
  const reviewDueCount = 0 // simplified for now
  const recommendedDaily = calculateRecommendedDaily(
    totalUnlocked - attempted,
    daysUntilNextTest,
    reviewDueCount
  )

  return {
    totalQuestions: totalUnlocked,
    attempted,
    mastered,
    coverageRate,
    totalPoints,
    streakDays: weeklyActiveDays,
    recommendedDaily,
  }
}

/**
 * 全問題を返す（全コンテンツ公開方式）
 * @deprecated unlockDate による制限は廃止。互換性のため残す。
 */
export function filterUnlockedQuestions(
  allQuestions: readonly Question[],
  _today: Date
): readonly Question[] {
  return allQuestions
}

/**
 * 練習テスト用に問題をカテゴリ比率に応じて抽出する
 */
export function selectPracticeTestQuestions(
  availableQuestions: readonly Question[],
  totalQuestions: number
): readonly Question[] {
  if (availableQuestions.length <= totalQuestions) {
    return availableQuestions
  }

  // カテゴリごとにグループ化
  const byCategory = new Map<string, Question[]>()
  for (const q of availableQuestions) {
    const existing = byCategory.get(q.categoryCode) ?? []
    byCategory.set(q.categoryCode, [...existing, q])
  }

  // 比率に応じて各カテゴリから抽出
  const result: Question[] = []
  const totalAvailable = availableQuestions.length

  for (const [, questions] of byCategory) {
    const ratio = questions.length / totalAvailable
    const count = Math.round(ratio * totalQuestions)
    // シャッフルして指定数を取得
    const shuffled = [...questions].sort(() => Math.random() - 0.5)
    result.push(...shuffled.slice(0, Math.max(1, count)))
  }

  // 端数調整: 多すぎたら削る、少なすぎたら追加
  while (result.length > totalQuestions) {
    result.pop()
  }
  if (result.length < totalQuestions) {
    const remaining = availableQuestions.filter(
      (q) => !result.some((r) => r.id === q.id)
    )
    const shuffledRemaining = [...remaining].sort(() => Math.random() - 0.5)
    for (const q of shuffledRemaining) {
      if (result.length >= totalQuestions) break
      result.push(q)
    }
  }

  return result
}
