// ============================================
// 授業スケジュール定義
// 第1回(4/16) 〜 第15回(7/30), 5/7休校
// 2026-04-16 確定版
// ============================================

export interface Lesson {
  readonly lesson: number
  readonly date: string // ISO date (Thursday)
  readonly title: string
  readonly categoryCodes: readonly string[]
  readonly type: 'lecture' | 'review' | 'practice_test' | 'final_exam'
}

export const LESSON_SCHEDULE: readonly Lesson[] = [
  { lesson: 1,  date: '2026-04-16', title: '法の体系・リスクマネジメント・IC・憲法', categoryCodes: ['1B', '1C', '2A'], type: 'lecture' },
  { lesson: 2,  date: '2026-04-23', title: '総則・柔整師免許', categoryCodes: ['4A', '4B'], type: 'lecture' },
  { lesson: 3,  date: '2026-04-30', title: '柔整師免許と国試', categoryCodes: ['4A', '4B'], type: 'lecture' },
  { lesson: 4,  date: '2026-05-14', title: '業務', categoryCodes: ['4D'], type: 'lecture' },
  { lesson: 5,  date: '2026-05-21', title: '施術所', categoryCodes: ['4E'], type: 'lecture' },
  { lesson: 6,  date: '2026-05-28', title: '雑則・罰則・指定登録機関・附則・広告', categoryCodes: ['4C', '4F', '4G'], type: 'lecture' },
  { lesson: 7,  date: '2026-06-04', title: '医師と他の医療資格制度', categoryCodes: ['5A', '5B', '5C', '5D', '5E'], type: 'lecture' },
  { lesson: 8,  date: '2026-06-11', title: '医療法・社会福祉', categoryCodes: ['5F', '3B', '2B'], type: 'lecture' },
  { lesson: 9,  date: '2026-06-18', title: '健康保険・介護保険・個情・国民医療費', categoryCodes: ['3A', '3C'], type: 'lecture' },
  { lesson: 10, date: '2026-06-25', title: '療養費', categoryCodes: ['3D'], type: 'lecture' },
  { lesson: 11, date: '2026-07-02', title: '療養費（続）', categoryCodes: ['3D'], type: 'lecture' },
  { lesson: 12, date: '2026-07-09', title: '療養費#2・医業類似行為・倫理', categoryCodes: ['3D'], type: 'lecture' },
  { lesson: 13, date: '2026-07-16', title: '接骨史', categoryCodes: [], type: 'lecture' },
  { lesson: 14, date: '2026-07-23', title: 'まとめ', categoryCodes: [], type: 'review' },
  { lesson: 15, date: '2026-07-30', title: '終講試験', categoryCodes: [], type: 'final_exam' },
]

/**
 * 現在の授業回を取得する
 * 直近の過去の授業日を基準に、次の授業を「今週のおすすめ」とする
 */
export function getCurrentLesson(today: Date): number {
  const todayStr = today.toISOString().slice(0, 10)

  // まだ授業開始前
  if (todayStr < LESSON_SCHEDULE[0].date) return 1

  // 最終回以降
  const lastLesson = LESSON_SCHEDULE[LESSON_SCHEDULE.length - 1]
  if (todayStr >= lastLesson.date) return lastLesson.lesson

  // 直近の授業回を探す
  for (let i = LESSON_SCHEDULE.length - 1; i >= 0; i--) {
    if (todayStr >= LESSON_SCHEDULE[i].date) {
      return LESSON_SCHEDULE[i].lesson
    }
  }

  return 1
}

/**
 * 指定した授業回までの累積カテゴリコードを取得
 */
export function getCumulativeCategories(upToLesson: number): readonly string[] {
  const codes = new Set<string>()
  for (const lesson of LESSON_SCHEDULE) {
    if (lesson.lesson > upToLesson) break
    for (const code of lesson.categoryCodes) {
      codes.add(code)
    }
  }
  return Array.from(codes)
}

// ============================================
// マイルストーン（練習テスト・終講試験）
// ============================================

export interface MilestoneInfo {
  readonly daysUntil: number
  readonly date: string
  readonly label: string
  readonly lesson: number
}

// 練習テストと終講試験のマイルストーン定義
// (lesson, label) — lesson はマイルストーンの対応授業回
const MILESTONES: readonly { lesson: number; label: string }[] = [
  { lesson: 3,  label: 'Q1練習テスト' },
  { lesson: 6,  label: 'Q2練習テスト' },
  { lesson: 9,  label: 'Q3練習テスト' },
  { lesson: 13, label: 'Q4練習テスト' },
  { lesson: 15, label: '終講試験' },
]

/**
 * 次のマイルストーン（練習テスト or 終講試験）までの日数を計算する
 *
 * 戻り値のdaysUntilは最低1を保証（ゼロ除算回避）
 * 最終マイルストーン以降はフォールバック30日
 */
export function getDaysUntilNextMilestone(today: Date): MilestoneInfo {
  const todayStr = today.toISOString().slice(0, 10)

  for (const m of MILESTONES) {
    const lesson = LESSON_SCHEDULE.find((l) => l.lesson === m.lesson)
    if (!lesson) continue
    if (todayStr <= lesson.date) {
      const diffMs =
        new Date(lesson.date).getTime() - new Date(todayStr).getTime()
      const daysUntil = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
      return {
        daysUntil,
        date: lesson.date,
        label: m.label,
        lesson: m.lesson,
      }
    }
  }

  // 終講試験以降 → 30日フォールバック
  return {
    daysUntil: 30,
    date: '',
    label: '—',
    lesson: 15,
  }
}
