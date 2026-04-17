import {
  LESSON_SCHEDULE,
  getCurrentLesson,
  getCumulativeCategories,
  getDaysUntilNextMilestone,
} from '../lesson-schedule'

describe('LESSON_SCHEDULE', () => {
  it('15回の授業がある', () => {
    expect(LESSON_SCHEDULE).toHaveLength(15)
  })

  it('第1回は4/16', () => {
    expect(LESSON_SCHEDULE[0].date).toBe('2026-04-16')
    expect(LESSON_SCHEDULE[0].lesson).toBe(1)
  })

  it('第15回は7/30（終講試験）', () => {
    const last = LESSON_SCHEDULE[LESSON_SCHEDULE.length - 1]
    expect(last.date).toBe('2026-07-30')
    expect(last.lesson).toBe(15)
    expect(last.type).toBe('final_exam')
  })

  it('5/7の授業はない（休校）', () => {
    const dates = LESSON_SCHEDULE.map((l) => l.date)
    expect(dates).not.toContain('2026-05-07')
  })

  it('第1回に2A（リスクマネジメント）を含む', () => {
    const lesson1 = LESSON_SCHEDULE[0]
    expect(lesson1.categoryCodes).toContain('2A')
    expect(lesson1.categoryCodes).toContain('1B')
    expect(lesson1.categoryCodes).toContain('1C')
  })

  it('第3回は4A, 4B（免許復習）', () => {
    const lesson3 = LESSON_SCHEDULE.find((l) => l.lesson === 3)
    expect(lesson3?.categoryCodes).toContain('4A')
    expect(lesson3?.categoryCodes).toContain('4B')
  })

  it('第6回に4C, 4F, 4G（指定登録機関・広告・罰則）を含む', () => {
    const lesson6 = LESSON_SCHEDULE.find((l) => l.lesson === 6)
    expect(lesson6?.categoryCodes).toContain('4C')
    expect(lesson6?.categoryCodes).toContain('4F')
    expect(lesson6?.categoryCodes).toContain('4G')
  })

  it('第8回に2B, 3B, 5F（医療法・社会福祉）を含む', () => {
    const lesson8 = LESSON_SCHEDULE.find((l) => l.lesson === 8)
    expect(lesson8?.categoryCodes).toContain('2B')
    expect(lesson8?.categoryCodes).toContain('3B')
    expect(lesson8?.categoryCodes).toContain('5F')
  })

  it('第9回に3A, 3C（健康保険・介護保険）を含む', () => {
    const lesson9 = LESSON_SCHEDULE.find((l) => l.lesson === 9)
    expect(lesson9?.categoryCodes).toContain('3A')
    expect(lesson9?.categoryCodes).toContain('3C')
  })

  it('第10〜12回は3D（療養費）', () => {
    for (const n of [10, 11, 12]) {
      const lesson = LESSON_SCHEDULE.find((l) => l.lesson === n)
      expect(lesson?.categoryCodes).toContain('3D')
    }
  })

  it('第13回（接骨史）はカテゴリなし', () => {
    const lesson13 = LESSON_SCHEDULE.find((l) => l.lesson === 13)
    expect(lesson13?.categoryCodes).toHaveLength(0)
  })
})

describe('getCurrentLesson', () => {
  it('授業開始前 → 第1回', () => {
    expect(getCurrentLesson(new Date('2026-04-01'))).toBe(1)
  })

  it('第1回当日 → 第1回', () => {
    expect(getCurrentLesson(new Date('2026-04-16'))).toBe(1)
  })

  it('第1回と第2回の間 → 第1回', () => {
    expect(getCurrentLesson(new Date('2026-04-20'))).toBe(1)
  })

  it('第2回当日 → 第2回', () => {
    expect(getCurrentLesson(new Date('2026-04-23'))).toBe(2)
  })

  it('5/7（休校日）→ 第3回（4/30）', () => {
    expect(getCurrentLesson(new Date('2026-05-07'))).toBe(3)
  })

  it('最終回以降 → 第15回', () => {
    expect(getCurrentLesson(new Date('2026-08-01'))).toBe(15)
  })
})

describe('getCumulativeCategories', () => {
  it('第1回まで → 1B, 1C, 2A', () => {
    const codes = getCumulativeCategories(1)
    expect(codes).toContain('1B')
    expect(codes).toContain('1C')
    expect(codes).toContain('2A')
    expect(codes).toHaveLength(3)
  })

  it('第3回まで → 第1回 + 4A, 4B（重複除外）', () => {
    const codes = getCumulativeCategories(3)
    expect(codes).toContain('1B')
    expect(codes).toContain('2A')
    expect(codes).toContain('4A')
    expect(codes).toContain('4B')
    expect(codes).toHaveLength(5)
  })

  it('第12回まで → 全カテゴリ（21種）', () => {
    const codes = getCumulativeCategories(12)
    expect(codes.length).toBeGreaterThanOrEqual(20)
  })
})

describe('getDaysUntilNextMilestone', () => {
  it('4/16 (L1当日) → Q1練習テスト, 14日後 (4/30)', () => {
    const result = getDaysUntilNextMilestone(new Date('2026-04-16'))
    expect(result.label).toBe('Q1練習テスト')
    expect(result.date).toBe('2026-04-30')
    expect(result.daysUntil).toBe(14)
  })

  it('4/29 → Q1練習テストまで1日', () => {
    const result = getDaysUntilNextMilestone(new Date('2026-04-29'))
    expect(result.label).toBe('Q1練習テスト')
    expect(result.daysUntil).toBe(1)
  })

  it('4/30当日 → Q1練習テスト当日扱い (1日に丸め)', () => {
    const result = getDaysUntilNextMilestone(new Date('2026-04-30'))
    expect(result.label).toBe('Q1練習テスト')
    expect(result.daysUntil).toBe(1)
  })

  it('5/1 → Q2練習テスト (5/28)', () => {
    const result = getDaysUntilNextMilestone(new Date('2026-05-01'))
    expect(result.label).toBe('Q2練習テスト')
    expect(result.date).toBe('2026-05-28')
  })

  it('6/20 → Q4練習テスト (7/16)', () => {
    const result = getDaysUntilNextMilestone(new Date('2026-06-20'))
    expect(result.label).toBe('Q4練習テスト')
    expect(result.date).toBe('2026-07-16')
  })

  it('7/17 → 終講試験 (7/30)', () => {
    const result = getDaysUntilNextMilestone(new Date('2026-07-17'))
    expect(result.label).toBe('終講試験')
    expect(result.date).toBe('2026-07-30')
  })

  it('終講試験後 → 30日フォールバック', () => {
    const result = getDaysUntilNextMilestone(new Date('2026-08-01'))
    expect(result.daysUntil).toBe(30)
    expect(result.label).toBe('—')
  })

  it('daysUntil は最低1を保証', () => {
    const result = getDaysUntilNextMilestone(new Date('2026-04-30'))
    expect(result.daysUntil).toBeGreaterThanOrEqual(1)
  })
})
