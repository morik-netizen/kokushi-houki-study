import {
  filterUnlockedQuestions,
  selectQuestions,
  calculateRecommendedDaily,
  calculateProgress,
  selectPracticeTestQuestions,
  isRecentMiss,
  orderRecommendations,
} from '../quiz-engine'
import type { Question, LearningRecord } from '../types'

// ============================================
// テストヘルパー
// ============================================
function makeQuestion(overrides: Partial<Question> & { id: number }): Question {
  return {
    categoryCode: '1C',
    categoryName: 'テスト',
    questionText: `問題${overrides.id}`,
    choiceA: 'A',
    choiceB: 'B',
    choiceC: 'C',
    choiceD: 'D',
    correctAnswers: 'B',
    correctFeedback: '正解',
    incorrectFeedback: '不正解',
    similarityGroup: null,
    unlockDate: new Date('2026-04-16'),
    ...overrides,
  }
}

function makeLearningRecord(
  overrides: Partial<LearningRecord> & { questionId: number }
): LearningRecord {
  return {
    userId: 'user1',
    easinessFactor: 2.5,
    intervalDays: 1,
    repetitions: 0,
    nextReviewDate: null,
    status: 'new',
    totalAttempts: 0,
    correctCount: 0,
    ...overrides,
  }
}

// ============================================
// filterUnlockedQuestions
// ============================================
describe('filterUnlockedQuestions', () => {
  const today = new Date('2026-05-01')

  it('全コンテンツ公開: unlockDateに関わらず全問返す', () => {
    const questions = [
      makeQuestion({ id: 1, unlockDate: new Date('2026-04-16') }),
      makeQuestion({ id: 2, unlockDate: new Date('2026-05-01') }),
      makeQuestion({ id: 3, unlockDate: new Date('2026-05-08') }),
    ]
    const result = filterUnlockedQuestions(questions, today)
    expect(result).toHaveLength(3)
    expect(result.map((q) => q.id)).toEqual([1, 2, 3])
  })

  it('空配列 → 空配列', () => {
    const result = filterUnlockedQuestions([], today)
    expect(result).toHaveLength(0)
  })
})

// ============================================
// selectQuestions
// ============================================
describe('selectQuestions', () => {
  const today = new Date('2026-05-01')

  it('未挑戦の問題を優先する', () => {
    const questions = [
      makeQuestion({ id: 1 }),
      makeQuestion({ id: 2 }),
      makeQuestion({ id: 3 }),
    ]
    const records: LearningRecord[] = [
      makeLearningRecord({
        questionId: 1,
        status: 'learning',
        totalAttempts: 1,
        nextReviewDate: new Date('2026-06-01'), // 復習日は未来
      }),
    ]
    const session = selectQuestions(questions, records, today, 30)
    // question 2, 3 は未挑戦なので優先
    expect(session.newCount).toBe(2)
    expect(session.questions.some((q) => q.id === 2)).toBe(true)
    expect(session.questions.some((q) => q.id === 3)).toBe(true)
  })

  it('SM-2復習日が来た問題を含む', () => {
    const questions = [makeQuestion({ id: 1 })]
    const records: LearningRecord[] = [
      makeLearningRecord({
        questionId: 1,
        status: 'reviewing',
        totalAttempts: 3,
        nextReviewDate: new Date('2026-04-30'), // 昨日 → 復習対象
      }),
    ]
    const session = selectQuestions(questions, records, today, 30)
    expect(session.reviewCount).toBe(1)
    expect(session.questions.some((q) => q.id === 1)).toBe(true)
  })

  it('同一類似グループから1問まで', () => {
    const questions = [
      makeQuestion({ id: 1, similarityGroup: 1 }),
      makeQuestion({ id: 2, similarityGroup: 1 }),
      makeQuestion({ id: 3, similarityGroup: 1 }),
      makeQuestion({ id: 4, similarityGroup: 2 }),
    ]
    const session = selectQuestions(questions, [], today, 30)
    const group1 = session.questions.filter((q) => q.similarityGroup === 1)
    expect(group1).toHaveLength(1)
  })

  it('上限 maxQuestions を超えない', () => {
    const questions = Array.from({ length: 50 }, (_, i) =>
      makeQuestion({ id: i + 1 })
    )
    const session = selectQuestions(questions, [], today, 30)
    expect(session.questions.length).toBeLessThanOrEqual(30)
  })

  it('mastered な問題は出題しない', () => {
    const questions = [makeQuestion({ id: 1 })]
    const records: LearningRecord[] = [
      makeLearningRecord({
        questionId: 1,
        status: 'mastered',
        totalAttempts: 5,
        repetitions: 5,
        nextReviewDate: new Date('2026-04-30'),
      }),
    ]
    const session = selectQuestions(questions, records, today, 30)
    expect(session.questions).toHaveLength(0)
  })
})

// ============================================
// calculateRecommendedDaily
// ============================================
describe('calculateRecommendedDaily', () => {
  it('基本計算: 未挑戦 / 残日数 + 復習数', () => {
    // 100 / 20 + 5 = 10
    expect(calculateRecommendedDaily(100, 20, 5)).toBe(10)
  })

  it('直近ミスも加算される', () => {
    // 100/20 + 5 + 3 = 13
    expect(calculateRecommendedDaily(100, 20, 5, 3)).toBe(13)
  })

  it('下限 3問', () => {
    expect(calculateRecommendedDaily(0, 100, 1)).toBe(3)
  })

  it('上限 30問', () => {
    expect(calculateRecommendedDaily(500, 1, 20)).toBe(30)
  })

  it('残日数 0 の場合でもエラーにならない (復習数のみ)', () => {
    const result = calculateRecommendedDaily(100, 0, 10)
    expect(result).toBeGreaterThanOrEqual(3)
    expect(result).toBeLessThanOrEqual(30)
  })

  it('マイルストーン範囲ベース: 125問を13日で割ると10問/日', () => {
    // Q1範囲125問、残13日 → ceil(125/13) = 10
    expect(calculateRecommendedDaily(125, 13, 0, 0)).toBe(10)
  })

  it('直前期: 残日数が小さいと自然に追込モードへ', () => {
    // Q1範囲125問、残2日 → ceil(125/2)=63 → 上限30
    expect(calculateRecommendedDaily(125, 2, 0, 0)).toBe(30)
  })
})

// ============================================
// isRecentMiss
// ============================================
describe('isRecentMiss', () => {
  const today = new Date('2026-05-10')

  it('3日以内・lastQuality<3 → true', () => {
    const r = makeLearningRecord({
      questionId: 1,
      status: 'learning',
      totalAttempts: 1,
      lastQuality: 1,
      lastAttemptedAt: new Date('2026-05-08'), // 2日前
    })
    expect(isRecentMiss(r, today)).toBe(true)
  })

  it('4日前 → false (ウィンドウ外)', () => {
    const r = makeLearningRecord({
      questionId: 1,
      status: 'learning',
      lastQuality: 1,
      lastAttemptedAt: new Date('2026-05-06'),
    })
    expect(isRecentMiss(r, today)).toBe(false)
  })

  it('lastQuality >= 3 (正解) → false', () => {
    const r = makeLearningRecord({
      questionId: 1,
      status: 'learning',
      lastQuality: 4,
      lastAttemptedAt: new Date('2026-05-09'),
    })
    expect(isRecentMiss(r, today)).toBe(false)
  })

  it('mastered → false (除外)', () => {
    const r = makeLearningRecord({
      questionId: 1,
      status: 'mastered',
      lastQuality: 1,
      lastAttemptedAt: new Date('2026-05-09'),
    })
    expect(isRecentMiss(r, today)).toBe(false)
  })

  it('lastAttemptedAt null → false', () => {
    const r = makeLearningRecord({
      questionId: 1,
      status: 'learning',
      lastQuality: 1,
      lastAttemptedAt: null,
    })
    expect(isRecentMiss(r, today)).toBe(false)
  })

  it('record undefined → false', () => {
    expect(isRecentMiss(undefined, today)).toBe(false)
  })
})

// ============================================
// orderRecommendations
// ============================================
describe('orderRecommendations', () => {
  const today = new Date('2026-05-10')

  it('直近ミスを先頭に配置', () => {
    const questions = [
      makeQuestion({ id: 1, categoryCode: '4A' }),
      makeQuestion({ id: 2, categoryCode: '4A' }),
      makeQuestion({ id: 3, categoryCode: '4A' }),
    ]
    const records: LearningRecord[] = [
      makeLearningRecord({
        questionId: 2,
        status: 'learning',
        totalAttempts: 1,
        lastQuality: 1,
        lastAttemptedAt: new Date('2026-05-09'),
      }),
    ]
    const ordered = orderRecommendations(questions, records, [], today)
    expect(ordered[0].id).toBe(2) // 直近ミスが先頭
  })

  it('授業連動カテゴリを未挑戦の中で先に配置', () => {
    const questions = [
      makeQuestion({ id: 1, categoryCode: '3A' }),
      makeQuestion({ id: 2, categoryCode: '4A' }),
      makeQuestion({ id: 3, categoryCode: '4A' }),
    ]
    const ordered = orderRecommendations(questions, [], ['4A'], today)
    // 4A が先頭に来る
    expect(ordered[0].categoryCode).toBe('4A')
    expect(ordered[1].categoryCode).toBe('4A')
    expect(ordered[2].categoryCode).toBe('3A')
  })

  it('復習対象を最後に追加', () => {
    const questions = [
      makeQuestion({ id: 1 }),
      makeQuestion({ id: 2 }),
    ]
    const records: LearningRecord[] = [
      makeLearningRecord({
        questionId: 2,
        status: 'reviewing',
        totalAttempts: 3,
        nextReviewDate: new Date('2026-05-09'), // 過去 → 復習対象
      }),
    ]
    const ordered = orderRecommendations(questions, records, [], today)
    expect(ordered[0].id).toBe(1) // 未挑戦が先
    expect(ordered[1].id).toBe(2) // 復習対象が後
  })

  it('直近ミス → ブースト未挑戦 → 非ブースト未挑戦 → 復習 の順', () => {
    const questions = [
      makeQuestion({ id: 1, categoryCode: '4A' }), // 非ブースト未挑戦
      makeQuestion({ id: 2, categoryCode: '3A' }), // ブースト未挑戦
      makeQuestion({ id: 3, categoryCode: '4A' }), // 直近ミス
      makeQuestion({ id: 4, categoryCode: '4A' }), // 復習対象
    ]
    const records: LearningRecord[] = [
      makeLearningRecord({
        questionId: 3,
        status: 'learning',
        totalAttempts: 1,
        lastQuality: 1,
        lastAttemptedAt: new Date('2026-05-09'),
      }),
      makeLearningRecord({
        questionId: 4,
        status: 'reviewing',
        totalAttempts: 2,
        nextReviewDate: new Date('2026-05-09'),
      }),
    ]
    const ordered = orderRecommendations(questions, records, ['3A'], today)
    expect(ordered.map((q) => q.id)).toEqual([3, 2, 1, 4])
  })
})

// ============================================
// calculateProgress
// ============================================
describe('calculateProgress', () => {
  it('基本的な進捗を計算', () => {
    const records: LearningRecord[] = [
      makeLearningRecord({ questionId: 1, totalAttempts: 3, status: 'mastered', repetitions: 5 }),
      makeLearningRecord({ questionId: 2, totalAttempts: 1, status: 'learning', repetitions: 1 }),
      makeLearningRecord({ questionId: 3, totalAttempts: 2, status: 'reviewing', repetitions: 2 }),
    ]
    const progress = calculateProgress(100, records, 50, 3, 60)
    expect(progress.totalQuestions).toBe(100)
    expect(progress.attempted).toBe(3)
    expect(progress.mastered).toBe(1)
    expect(progress.coverageRate).toBeCloseTo(0.03, 2) // 3/100
    expect(progress.totalPoints).toBe(50)
    expect(progress.streakDays).toBe(3)
  })

  it('問題なし → coverageRate 0', () => {
    const progress = calculateProgress(0, [], 0, 0, 60)
    expect(progress.coverageRate).toBe(0)
    expect(progress.attempted).toBe(0)
    expect(progress.mastered).toBe(0)
  })
})

// ============================================
// selectPracticeTestQuestions
// ============================================
describe('selectPracticeTestQuestions', () => {
  it('指定数の問題を返す', () => {
    const questions = Array.from({ length: 100 }, (_, i) =>
      makeQuestion({
        id: i + 1,
        categoryCode: `cat${(i % 5) + 1}`,
      })
    )
    const result = selectPracticeTestQuestions(questions, 40)
    expect(result).toHaveLength(40)
  })

  it('問題数が足りない場合は全問返す', () => {
    const questions = Array.from({ length: 20 }, (_, i) =>
      makeQuestion({ id: i + 1 })
    )
    const result = selectPracticeTestQuestions(questions, 40)
    expect(result).toHaveLength(20)
  })

  it('カテゴリ比率に応じて抽出する', () => {
    // 60問 catA, 40問 catB → 40問抽出時に catA:24, catB:16 程度
    const questions = [
      ...Array.from({ length: 60 }, (_, i) =>
        makeQuestion({ id: i + 1, categoryCode: 'catA' })
      ),
      ...Array.from({ length: 40 }, (_, i) =>
        makeQuestion({ id: 61 + i, categoryCode: 'catB' })
      ),
    ]
    const result = selectPracticeTestQuestions(questions, 40)
    const catACnt = result.filter((q) => q.categoryCode === 'catA').length
    const catBCnt = result.filter((q) => q.categoryCode === 'catB').length
    // 比率は概ね 60:40 (= 24:16) になるはず (±2の許容)
    expect(catACnt).toBeGreaterThanOrEqual(22)
    expect(catACnt).toBeLessThanOrEqual(26)
    expect(catBCnt).toBeGreaterThanOrEqual(14)
    expect(catBCnt).toBeLessThanOrEqual(18)
  })
})
