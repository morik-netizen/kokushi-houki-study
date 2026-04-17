import { calculateSM2, evaluateQuality, calculateMasteryThreshold, isMastered } from '../sm2'
import type { SM2Input, SM2Output, Quality, MasteryThreshold } from '../types'

// ============================================
// evaluateQuality
// ============================================
describe('evaluateQuality', () => {
  it('正解 → quality 4', () => {
    expect(evaluateQuality(true)).toBe(4)
  })

  it('不正解 → quality 1', () => {
    expect(evaluateQuality(false)).toBe(1)
  })
})

// ============================================
// calculateSM2
// ============================================
describe('calculateSM2', () => {
  const today = new Date('2026-04-20')

  describe('初回正解 (quality >= 3)', () => {
    it('repetitions=0 → interval 1日, repetitions 1', () => {
      const input: SM2Input = {
        quality: 4,
        previousEF: 2.5,
        previousInterval: 0,
        previousRepetitions: 0,
      }
      const result = calculateSM2(input, today)
      expect(result.intervalDays).toBe(1)
      expect(result.repetitions).toBe(1)
      expect(result.easinessFactor).toBeCloseTo(2.5, 1)
      expect(result.status).toBe('learning')
    })

    it('repetitions=1 → interval 6日, repetitions 2', () => {
      const input: SM2Input = {
        quality: 4,
        previousEF: 2.5,
        previousInterval: 1,
        previousRepetitions: 1,
      }
      const result = calculateSM2(input, today)
      expect(result.intervalDays).toBe(6)
      expect(result.repetitions).toBe(2)
      expect(result.status).toBe('reviewing')
    })

    it('repetitions=2 → interval = previous * EF', () => {
      const input: SM2Input = {
        quality: 4,
        previousEF: 2.5,
        previousInterval: 6,
        previousRepetitions: 2,
      }
      const result = calculateSM2(input, today)
      expect(result.intervalDays).toBe(15) // 6 * 2.5 = 15
      expect(result.repetitions).toBe(3)
      expect(result.status).toBe('reviewing')
    })
  })

  describe('不正解 (quality < 3)', () => {
    it('不正解でリセット: repetitions → 0, interval → 1', () => {
      const input: SM2Input = {
        quality: 1,
        previousEF: 2.5,
        previousInterval: 15,
        previousRepetitions: 3,
      }
      const result = calculateSM2(input, today)
      expect(result.intervalDays).toBe(1)
      expect(result.repetitions).toBe(0)
      expect(result.status).toBe('learning')
    })
  })

  describe('EF (Easiness Factor) の更新', () => {
    it('quality 5 → EF が上がる', () => {
      const input: SM2Input = {
        quality: 5,
        previousEF: 2.5,
        previousInterval: 1,
        previousRepetitions: 1,
      }
      const result = calculateSM2(input, today)
      expect(result.easinessFactor).toBeGreaterThan(2.5)
    })

    it('quality 3 → EF が下がる', () => {
      const input: SM2Input = {
        quality: 3,
        previousEF: 2.5,
        previousInterval: 1,
        previousRepetitions: 1,
      }
      const result = calculateSM2(input, today)
      expect(result.easinessFactor).toBeLessThan(2.5)
    })

    it('EF の下限は 1.3', () => {
      const input: SM2Input = {
        quality: 0,
        previousEF: 1.3,
        previousInterval: 1,
        previousRepetitions: 1,
      }
      const result = calculateSM2(input, today)
      expect(result.easinessFactor).toBeGreaterThanOrEqual(1.3)
    })
  })

  describe('nextReviewDate', () => {
    it('today + intervalDays が nextReviewDate', () => {
      const input: SM2Input = {
        quality: 4,
        previousEF: 2.5,
        previousInterval: 0,
        previousRepetitions: 0,
      }
      const result = calculateSM2(input, today)
      const expected = new Date('2026-04-21') // today + 1
      expect(result.nextReviewDate.getTime()).toBe(expected.getTime())
    })
  })

  describe('mastered ステータス', () => {
    it('repetitions >= 5 で mastered', () => {
      const input: SM2Input = {
        quality: 4,
        previousEF: 2.5,
        previousInterval: 30,
        previousRepetitions: 4,
      }
      const result = calculateSM2(input, today)
      expect(result.repetitions).toBe(5)
      expect(result.status).toBe('mastered')
    })
  })
})

// ============================================
// calculateMasteryThreshold
// ============================================
describe('calculateMasteryThreshold', () => {
  it('残日数が十分 (>30日) → requiredRepetitions 5, maxInterval 制限なし(30)', () => {
    const unlockDate = new Date('2026-04-16')
    const endDate = new Date('2026-07-30')
    const today = new Date('2026-04-20')
    const result = calculateMasteryThreshold(unlockDate, endDate, today)
    expect(result.requiredRepetitions).toBe(5)
    expect(result.maxIntervalDays).toBe(30)
  })

  it('残日数が少ない (<=14日) → requiredRepetitions 3, maxInterval 7', () => {
    const unlockDate = new Date('2026-07-01')
    const endDate = new Date('2026-07-30')
    const today = new Date('2026-07-20')
    const result = calculateMasteryThreshold(unlockDate, endDate, today)
    expect(result.requiredRepetitions).toBe(3)
    expect(result.maxIntervalDays).toBe(7)
  })

  it('残日数が中程度 (15-30日) → requiredRepetitions 3, maxInterval 14', () => {
    const unlockDate = new Date('2026-06-01')
    const endDate = new Date('2026-07-30')
    const today = new Date('2026-07-10')
    const result = calculateMasteryThreshold(unlockDate, endDate, today)
    expect(result.requiredRepetitions).toBe(3)
    expect(result.maxIntervalDays).toBe(14)
  })
})

// ============================================
// isMastered
// ============================================
describe('isMastered', () => {
  it('repetitions >= threshold → true', () => {
    const threshold: MasteryThreshold = { requiredRepetitions: 3, maxIntervalDays: 7 }
    expect(isMastered(3, threshold)).toBe(true)
    expect(isMastered(5, threshold)).toBe(true)
  })

  it('repetitions < threshold → false', () => {
    const threshold: MasteryThreshold = { requiredRepetitions: 5, maxIntervalDays: 30 }
    expect(isMastered(4, threshold)).toBe(false)
    expect(isMastered(0, threshold)).toBe(false)
  })
})
