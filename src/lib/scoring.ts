// ============================================
// 採点・回答判定
// ============================================

import type { Question, Answer, AnswerResult, SM2Output } from './types'

/**
 * 回答を採点する
 */
export function gradeAnswer(
  question: Question,
  answer: Answer,
  sm2Update: SM2Output
): AnswerResult {
  const correct = isCorrectAnswer(answer.selectedAnswer, question.correctAnswers)
  return {
    isCorrect: correct,
    correctAnswers: question.correctAnswers,
    feedback: correct ? question.correctFeedback : question.incorrectFeedback,
    pointsEarned: calculatePoints(correct),
    sm2Update,
  }
}

/**
 * 選択された回答が正解かどうか判定する
 * 単一選択: 'B' === 'B'
 * 複数選択: 'B,D' === 'B,D' (順序不問)
 */
export function isCorrectAnswer(
  selectedAnswer: string,
  correctAnswers: string
): boolean {
  const normalize = (s: string): readonly string[] =>
    s
      .toUpperCase()
      .split(',')
      .map((c) => c.trim())
      .sort()

  const selected = normalize(selectedAnswer)
  const correct = normalize(correctAnswers)

  if (selected.length !== correct.length) return false
  return selected.every((val, idx) => val === correct[idx])
}

/**
 * ポイントを計算する
 * 正解: 10pt, 不正解: 0pt
 */
export function calculatePoints(isCorrect: boolean): number {
  return isCorrect ? 10 : 0
}
