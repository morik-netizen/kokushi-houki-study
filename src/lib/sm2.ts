// ============================================
// SM-2 間隔反復アルゴリズム
// ============================================

import type { SM2Input, SM2Output, Quality, MasteryThreshold } from './types'

/**
 * SM-2 アルゴリズムで次回の復習スケジュールを計算する
 */
export function calculateSM2(input: SM2Input, today: Date): SM2Output {
  const { quality, previousEF, previousInterval, previousRepetitions } = input

  // EF の更新 (SM-2 公式)
  const rawEF =
    previousEF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  const easinessFactor = Math.max(1.3, rawEF)

  // 不正解 (quality < 3) → リセット
  if (quality < 3) {
    const nextReviewDate = addDays(today, 1)
    return {
      easinessFactor,
      intervalDays: 1,
      repetitions: 0,
      nextReviewDate,
      status: 'learning',
    }
  }

  // 正解時のインターバル計算
  let intervalDays: number
  let repetitions: number

  if (previousRepetitions === 0) {
    intervalDays = 1
    repetitions = 1
  } else if (previousRepetitions === 1) {
    intervalDays = 6
    repetitions = 2
  } else {
    intervalDays = Math.round(previousInterval * easinessFactor)
    repetitions = previousRepetitions + 1
  }

  const nextReviewDate = addDays(today, intervalDays)

  // ステータス判定
  let status: SM2Output['status']
  if (repetitions >= 5) {
    status = 'mastered'
  } else if (repetitions >= 2) {
    status = 'reviewing'
  } else {
    status = 'learning'
  }

  return { easinessFactor, intervalDays, repetitions, nextReviewDate, status }
}

/**
 * 4択の回答結果からSM-2の品質評価を算出する（簡易版）
 * 正解 → quality 4, 不正解 → quality 1
 */
export function evaluateQuality(isCorrect: boolean): Quality {
  return isCorrect ? 4 : 1
}

/**
 * 動的定着閾値を計算する
 * 残日数に応じて必要な連続正答回数と最大間隔を調整
 */
export function calculateMasteryThreshold(
  _unlockDate: Date,
  endDate: Date,
  today: Date
): MasteryThreshold {
  const daysRemaining = Math.max(
    0,
    Math.floor((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  )

  if (daysRemaining <= 14) {
    return { requiredRepetitions: 3, maxIntervalDays: 7 }
  }
  if (daysRemaining <= 30) {
    return { requiredRepetitions: 3, maxIntervalDays: 14 }
  }
  return { requiredRepetitions: 5, maxIntervalDays: 30 }
}

/**
 * 学習記録が定着済みかどうかを判定する
 */
export function isMastered(
  repetitions: number,
  threshold: MasteryThreshold
): boolean {
  return repetitions >= threshold.requiredRepetitions
}

// ---- ヘルパー ----

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}
