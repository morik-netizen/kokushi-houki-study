import {
  toJstDateString,
  calculateStreak,
  getWeekStartJst,
  getPreviousWeekStartJst,
  countInRange,
} from '../streak'

// ============================================
// toJstDateString
// ============================================
describe('toJstDateString', () => {
  it('UTC 00:00 → 同じ日のJST 09:00 → 日付不変', () => {
    const d = new Date('2026-04-17T00:00:00Z')
    expect(toJstDateString(d)).toBe('2026-04-17')
  })

  it('UTC 15:00 → JST 翌日 00:00 → 日付+1', () => {
    const d = new Date('2026-04-17T15:00:00Z')
    expect(toJstDateString(d)).toBe('2026-04-18')
  })

  it('UTC 14:59:59 → JST 23:59:59 → 日付不変', () => {
    const d = new Date('2026-04-17T14:59:59Z')
    expect(toJstDateString(d)).toBe('2026-04-17')
  })

  it('月跨ぎ: UTC 4/30 16:00 → JST 5/1 01:00', () => {
    const d = new Date('2026-04-30T16:00:00Z')
    expect(toJstDateString(d)).toBe('2026-05-01')
  })
})

// ============================================
// calculateStreak
// ============================================
describe('calculateStreak', () => {
  const today = new Date('2026-04-17T03:00:00Z') // JST 12:00 木

  it('回答なし → 0日', () => {
    expect(calculateStreak(new Set(), today)).toBe(0)
  })

  it('今日だけ → 1日', () => {
    expect(calculateStreak(new Set(['2026-04-17']), today)).toBe(1)
  })

  it('今日 + 昨日 → 2日', () => {
    expect(
      calculateStreak(new Set(['2026-04-17', '2026-04-16']), today)
    ).toBe(2)
  })

  it('今日 + 昨日 + 一昨日 → 3日', () => {
    expect(
      calculateStreak(
        new Set(['2026-04-17', '2026-04-16', '2026-04-15']),
        today
      )
    ).toBe(3)
  })

  it('間に穴 → 穴の手前までカウント', () => {
    // 今日 + 昨日 OK、一昨日なし、3日前は OK → 2日
    expect(
      calculateStreak(
        new Set(['2026-04-17', '2026-04-16', '2026-04-14']),
        today
      )
    ).toBe(2)
  })

  it('今日未回答・昨日あり → 1日 (猶予期間)', () => {
    expect(calculateStreak(new Set(['2026-04-16']), today)).toBe(1)
  })

  it('今日未回答・昨日未回答・一昨日のみ → 0日', () => {
    expect(calculateStreak(new Set(['2026-04-15']), today)).toBe(0)
  })

  it('月跨ぎ連続', () => {
    const mayFirst = new Date('2026-05-01T03:00:00Z') // JST 5/1 12:00
    expect(
      calculateStreak(
        new Set([
          '2026-05-01',
          '2026-04-30',
          '2026-04-29',
          '2026-04-28',
        ]),
        mayFirst
      )
    ).toBe(4)
  })
})

// ============================================
// getWeekStartJst
// ============================================
describe('getWeekStartJst', () => {
  it('木曜(4/16) → その週の月曜(4/13) 00:00 JST', () => {
    const thursday = new Date('2026-04-16T12:00:00+09:00')
    const weekStart = getWeekStartJst(thursday)
    // 2026-04-13 00:00 JST = 2026-04-12 15:00 UTC
    expect(weekStart.toISOString()).toBe('2026-04-12T15:00:00.000Z')
  })

  it('月曜自身 → その日 00:00 JST', () => {
    const monday = new Date('2026-04-13T12:00:00+09:00')
    const weekStart = getWeekStartJst(monday)
    expect(weekStart.toISOString()).toBe('2026-04-12T15:00:00.000Z')
  })

  it('日曜 → 直前の月曜', () => {
    const sunday = new Date('2026-04-19T12:00:00+09:00')
    const weekStart = getWeekStartJst(sunday)
    // 直前の月曜 = 4/13
    expect(weekStart.toISOString()).toBe('2026-04-12T15:00:00.000Z')
  })

  it('月曜 00:00 JST ちょうど', () => {
    const mondayMidnight = new Date('2026-04-12T15:00:00Z') // JST 4/13 00:00
    const weekStart = getWeekStartJst(mondayMidnight)
    expect(weekStart.toISOString()).toBe('2026-04-12T15:00:00.000Z')
  })
})

// ============================================
// getPreviousWeekStartJst
// ============================================
describe('getPreviousWeekStartJst', () => {
  it('今週月曜から7日引いた日を返す', () => {
    const today = new Date('2026-04-17T12:00:00+09:00')
    const prev = getPreviousWeekStartJst(today)
    // 先週月曜 = 4/6 00:00 JST = 4/5 15:00 UTC
    expect(prev.toISOString()).toBe('2026-04-05T15:00:00.000Z')
  })
})

// ============================================
// countInRange
// ============================================
describe('countInRange', () => {
  const start = new Date('2026-04-12T15:00:00Z') // 月曜 JST 00:00
  const end = new Date('2026-04-19T15:00:00Z')   // 次の月曜 JST 00:00

  it('範囲内のみカウント', () => {
    const dates = [
      new Date('2026-04-15T06:00:00Z'),
      new Date('2026-04-10T00:00:00Z'), // 範囲外
      new Date('2026-04-17T10:00:00Z'),
    ]
    expect(countInRange(dates, start, end)).toBe(2)
  })

  it('start を含み end を含まない', () => {
    expect(countInRange([start], start, end)).toBe(1)
    expect(countInRange([end], start, end)).toBe(0)
  })

  it('空配列 → 0', () => {
    expect(countInRange([], start, end)).toBe(0)
  })
})
