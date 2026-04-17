import { isRecentMiss, orderRecommendations } from '../quiz-engine'
import type { Question, LearningRecord } from '../types'

// retry モードの振る舞いを検証するテスト。
// submitAnswer(mode='retry') は直接 DB を触るため、ここでは retry の結果として
// 出来上がる LearningRecord を想定し、エンジン側ロジックが retry 起因の更新を
// 正しく扱えるかを保証する。
//
// retry モードが満たすべき不変条件:
// 1. SM-2 フィールド (easinessFactor/intervalDays/repetitions/nextReviewDate/status)
//    は retry では変更されない → 次の復習予定日が retry で動かない
// 2. lastQuality/lastAttemptedAt/totalAttempts/correctCount は更新される
//    → retry で不正解になれば isRecentMiss が true になる
// 3. mastered の問題は再挑戦しても status は 'mastered' のまま
//    → 推薦の候補から外れたまま

function makeQuestion(o: Partial<Question> & { id: number }): Question {
  return {
    categoryCode: '1C',
    categoryName: 'テスト',
    questionText: `問題${o.id}`,
    choiceA: 'A',
    choiceB: 'B',
    choiceC: 'C',
    choiceD: 'D',
    correctAnswers: 'B',
    correctFeedback: '正解',
    incorrectFeedback: '不正解',
    similarityGroup: null,
    unlockDate: new Date('2026-04-16'),
    ...o,
  }
}

function makeRecord(
  o: Partial<LearningRecord> & { questionId: number }
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
    ...o,
  }
}

describe('retry モード: SM-2 スケジュール保護', () => {
  const today = new Date('2026-05-10')

  it('retry で不正解になった mastered でない問題は isRecentMiss=true', () => {
    // retry mode では lastQuality/lastAttemptedAt が更新される
    const record = makeRecord({
      questionId: 1,
      status: 'learning',
      totalAttempts: 2,
      correctCount: 1,
      lastQuality: 1, // retry で不正解
      lastAttemptedAt: new Date('2026-05-09'),
    })
    expect(isRecentMiss(record, today)).toBe(true)
  })

  it('retry で不正解でも mastered の問題は isRecentMiss=false', () => {
    // 不変条件3: mastered は retry で解き直しても status 'mastered' のまま
    const record = makeRecord({
      questionId: 1,
      status: 'mastered',
      totalAttempts: 5,
      correctCount: 4,
      lastQuality: 0, // retry で不正解でも
      lastAttemptedAt: new Date('2026-05-09'),
    })
    expect(isRecentMiss(record, today)).toBe(false)
  })
})

describe('retry モード: おすすめへの影響', () => {
  const today = new Date('2026-05-10')

  it('retry で不正解になった問題は直近ミスとして先頭に来る', () => {
    const questions = [
      makeQuestion({ id: 1, categoryCode: '4A' }), // 未挑戦
      makeQuestion({ id: 2, categoryCode: '4B' }), // retryで不正解
    ]
    const records = [
      makeRecord({
        questionId: 2,
        status: 'learning',
        totalAttempts: 3, // 1回目正解 + retry 2回(うち失敗)
        correctCount: 2,
        lastQuality: 1,
        lastAttemptedAt: new Date('2026-05-09'),
      }),
    ]
    const ordered = orderRecommendations(questions, records, [], today)
    expect(ordered[0].id).toBe(2) // 直近ミス最優先
  })

  it('retry で mastered は復習候補に残らない', () => {
    // 不変条件3: mastered は retry しても出題候補から除外された状態を維持
    const questions = [
      makeQuestion({ id: 1, categoryCode: '4A' }),
      makeQuestion({ id: 2, categoryCode: '4B' }),
    ]
    const records = [
      makeRecord({
        questionId: 1,
        status: 'mastered',
        totalAttempts: 5,
        correctCount: 5,
        // retry で解き直したが SM-2 は動かないはず
        easinessFactor: 2.7,
        intervalDays: 30,
        nextReviewDate: new Date('2026-06-09'), // 未来
        lastQuality: 5,
        lastAttemptedAt: new Date('2026-05-09'),
      }),
    ]
    // 候補集合に mastered を含めて呼んでも、復習期日が未来なので復習枠に入らず、
    // 未挑戦でもないため未挑戦枠にも入らない → 除外される
    const ordered = orderRecommendations(questions, records, [], today)
    const ids = ordered.map((q) => q.id)
    expect(ids).not.toContain(1) // mastered は出さない
    expect(ids).toContain(2) // 未挑戦は出る
  })
})

describe('retry モード: 不変条件の境界', () => {
  const today = new Date('2026-05-10')

  it('SM-2 の nextReviewDate が未来 かつ retry で正解 → 復習候補にならない', () => {
    // 不変条件1: SM-2 は retry で動かないので、未来の予定日はそのまま
    const questions = [makeQuestion({ id: 1, categoryCode: '4A' })]
    const records = [
      makeRecord({
        questionId: 1,
        status: 'learning',
        totalAttempts: 2,
        correctCount: 2,
        nextReviewDate: new Date('2026-05-20'), // 未来の復習予定
        lastQuality: 5, // retry で正解
        lastAttemptedAt: new Date('2026-05-09'),
      }),
    ]
    const ordered = orderRecommendations(questions, records, [], today)
    expect(ordered).toHaveLength(0) // 復習期日が来てないので候補に入らない
  })

  it('直近ミス判定は lastAttemptedAt 起点 (retry で再挑戦すると更新される)', () => {
    // 不変条件2: lastAttemptedAt は retry で更新されるため、
    // 直近ミス判定の時計も retry 実行時点にリセットされる
    const record = makeRecord({
      questionId: 1,
      status: 'learning',
      totalAttempts: 2,
      lastQuality: 1,
      lastAttemptedAt: new Date('2026-05-07'), // 3日前 → 境界
    })
    expect(isRecentMiss(record, today, 3)).toBe(true)

    // さらに4日前なら範囲外
    const olderRecord = makeRecord({
      ...record,
      questionId: 1,
      lastAttemptedAt: new Date('2026-05-06'), // 4日前
    })
    expect(isRecentMiss(olderRecord, today, 3)).toBe(false)
  })
})
