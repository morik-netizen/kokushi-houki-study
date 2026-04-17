import { isCorrectAnswer, calculatePoints, gradeAnswer } from '../scoring'
import type { Question, Answer, SM2Output } from '../types'

// ============================================
// isCorrectAnswer
// ============================================
describe('isCorrectAnswer', () => {
  it('単一選択: 一致 → true', () => {
    expect(isCorrectAnswer('B', 'B')).toBe(true)
  })

  it('単一選択: 不一致 → false', () => {
    expect(isCorrectAnswer('A', 'B')).toBe(false)
  })

  it('複数選択: 同じ組み合わせ → true', () => {
    expect(isCorrectAnswer('B,D', 'B,D')).toBe(true)
  })

  it('複数選択: 順序違い → true (順序不問)', () => {
    expect(isCorrectAnswer('D,B', 'B,D')).toBe(true)
  })

  it('複数選択: 不一致 → false', () => {
    expect(isCorrectAnswer('A,B', 'B,D')).toBe(false)
  })

  it('複数選択: 片方だけ → false', () => {
    expect(isCorrectAnswer('B', 'B,D')).toBe(false)
  })

  it('大文字小文字を区別しない', () => {
    expect(isCorrectAnswer('b', 'B')).toBe(true)
    expect(isCorrectAnswer('b,d', 'B,D')).toBe(true)
  })
})

// ============================================
// calculatePoints
// ============================================
describe('calculatePoints', () => {
  it('正解 → 10pt', () => {
    expect(calculatePoints(true)).toBe(10)
  })

  it('不正解 → 0pt', () => {
    expect(calculatePoints(false)).toBe(0)
  })
})

// ============================================
// gradeAnswer
// ============================================
describe('gradeAnswer', () => {
  const baseQuestion: Question = {
    id: 1,
    categoryCode: '1C',
    categoryName: '患者の権利',
    questionText: 'テスト問題',
    choiceA: '選択肢A',
    choiceB: '選択肢B',
    choiceC: '選択肢C',
    choiceD: '選択肢D',
    correctAnswers: 'B',
    correctFeedback: '正解です！',
    incorrectFeedback: '不正解です。',
    similarityGroup: null,
    unlockDate: new Date('2026-04-16'),
  }

  const sm2Update: SM2Output = {
    easinessFactor: 2.5,
    intervalDays: 1,
    repetitions: 1,
    nextReviewDate: new Date('2026-04-21'),
    status: 'learning',
  }

  it('正解の場合: isCorrect=true, 10pt, correctFeedback', () => {
    const answer: Answer = {
      userId: 'user1',
      questionId: 1,
      selectedAnswer: 'B',
      responseTimeMs: 5000,
    }
    const result = gradeAnswer(baseQuestion, answer, sm2Update)
    expect(result.isCorrect).toBe(true)
    expect(result.pointsEarned).toBe(10)
    expect(result.feedback).toBe('正解です！')
    expect(result.correctAnswers).toBe('B')
    expect(result.sm2Update).toEqual(sm2Update)
  })

  it('不正解の場合: isCorrect=false, 0pt, incorrectFeedback', () => {
    const answer: Answer = {
      userId: 'user1',
      questionId: 1,
      selectedAnswer: 'A',
      responseTimeMs: 3000,
    }
    const result = gradeAnswer(baseQuestion, answer, sm2Update)
    expect(result.isCorrect).toBe(false)
    expect(result.pointsEarned).toBe(0)
    expect(result.feedback).toBe('不正解です。')
    expect(result.correctAnswers).toBe('B')
  })

  it('複数選択の正解', () => {
    const multiQuestion: Question = {
      ...baseQuestion,
      correctAnswers: 'B,D',
    }
    const answer: Answer = {
      userId: 'user1',
      questionId: 1,
      selectedAnswer: 'D,B',
      responseTimeMs: 8000,
    }
    const result = gradeAnswer(multiQuestion, answer, sm2Update)
    expect(result.isCorrect).toBe(true)
    expect(result.pointsEarned).toBe(10)
  })
})
