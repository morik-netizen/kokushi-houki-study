// ============================================
// 学習ストリーク・週次集計の純粋関数
// サーバータイムゾーンに依存せず、常に JST (Asia/Tokyo, UTC+9) で計算する
// ============================================

const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * UTC の Date を JST 日付文字列 (YYYY-MM-DD) に変換
 * 例: UTC 2026-04-17 16:00:00 → JST 2026-04-18 01:00:00 → "2026-04-18"
 */
export function toJstDateString(date: Date): string {
  return new Date(date.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10)
}

/**
 * 今日を基準に、直近の連続学習日数を計算する
 *
 * - 今日の回答があれば今日から数える
 * - 今日の回答が無くても昨日があれば昨日から数える（猶予期間）
 * - 一昨日以前しかない場合は連続ゼロ
 *
 * @param jstDateStrings 回答があった JST 日付文字列の集合
 * @param today 計算基準日 (UTC Date)
 * @returns 連続学習日数 (0以上の整数)
 */
export function calculateStreak(
  jstDateStrings: ReadonlySet<string>,
  today: Date
): number {
  const todayStr = toJstDateString(today)
  const yesterday = new Date(today.getTime() - DAY_MS)
  const yesterdayStr = toJstDateString(yesterday)

  let cursor: Date
  if (jstDateStrings.has(todayStr)) {
    cursor = today
  } else if (jstDateStrings.has(yesterdayStr)) {
    cursor = yesterday
  } else {
    return 0
  }

  let days = 0
  while (true) {
    const str = toJstDateString(cursor)
    if (!jstDateStrings.has(str)) break
    days++
    cursor = new Date(cursor.getTime() - DAY_MS)
  }
  return days
}

/**
 * 今週の月曜日 00:00 JST を表す Date オブジェクトを返す
 *
 * 戻り値の getTime() は UTC エポックだが、JST で見ると月曜 00:00 になる。
 * DB クエリで `answeredAt >= getWeekStartJst(today)` と書けばそのまま使える。
 */
export function getWeekStartJst(today: Date): Date {
  const todayStr = toJstDateString(today)
  const [y, m, d] = todayStr.split('-').map(Number)
  // UTC の Date を曜日判定だけに利用（日付は同じなので day-of-week は一致）
  const tmp = new Date(Date.UTC(y, m - 1, d))
  const dayOfWeek = tmp.getUTCDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  // 月曜 00:00 JST = UTC(y, m-1, d-daysSinceMonday, -9, 0, 0)
  // hour=-9 は自動的に前日 15:00 UTC に繰り下がる
  return new Date(Date.UTC(y, m - 1, d - daysSinceMonday, -9, 0, 0, 0))
}

/**
 * 先週の月曜日 00:00 JST を返す (週次比較用)
 */
export function getPreviousWeekStartJst(today: Date): Date {
  const thisWeek = getWeekStartJst(today)
  return new Date(thisWeek.getTime() - 7 * DAY_MS)
}

/**
 * UTC Date の配列から「期間内（start以上 end未満）」の件数を数える
 */
export function countInRange(
  dates: readonly Date[],
  startInclusive: Date,
  endExclusive: Date
): number {
  let count = 0
  for (const d of dates) {
    const t = d.getTime()
    if (t >= startInclusive.getTime() && t < endExclusive.getTime()) count++
  }
  return count
}
