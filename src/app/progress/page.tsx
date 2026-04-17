import Link from 'next/link'
import { BottomNav } from '@/components/BottomNav'
import {
  getLeaderboard,
  type RankingCategory,
} from '@/lib/actions/leaderboard'

interface PageProps {
  searchParams: Promise<{ tab?: string }>
}

const TABS: readonly {
  key: RankingCategory
  icon: string
  label: string
  hint: string
}[] = [
  { key: 'streak', icon: '🔥', label: '連続', hint: '毎日コツコツ続ける人' },
  { key: 'growth', icon: '📈', label: '成長', hint: '先週より伸びた人' },
  { key: 'weekly', icon: '🏆', label: '今週', hint: '今週たくさん解いた人' },
  { key: 'coverage', icon: '📊', label: '総合', hint: '全体のカバー率' },
]

function isRankingCategory(v: string | undefined): v is RankingCategory {
  return v === 'streak' || v === 'growth' || v === 'weekly' || v === 'coverage'
}

export default async function ProgressPage({ searchParams }: PageProps) {
  const params = await searchParams
  const activeTab: RankingCategory = isRankingCategory(params.tab)
    ? params.tab
    : 'streak'

  let data: Awaited<ReturnType<typeof getLeaderboard>> | null = null
  try {
    data = await getLeaderboard()
  } catch {
    // 未ログインまたはDB未接続
  }

  const entries = data?.rankings[activeTab] ?? []
  const me = data?.currentUser

  const activeRank =
    activeTab === 'streak'
      ? me?.streakRank
      : activeTab === 'growth'
        ? me?.growthRank
        : activeTab === 'weekly'
          ? me?.weeklyRank
          : me?.coverageRank

  const activeLabel =
    activeTab === 'streak'
      ? '連続学習'
      : activeTab === 'growth'
        ? '成長(先週比)'
        : activeTab === 'weekly'
          ? '今週の回答'
          : 'カバー率'

  return (
    <main className="min-h-screen pb-20 max-w-lg mx-auto">
      <header className="px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold">みんなの進捗</h1>
        <p className="text-xs text-muted mt-1">
          {TABS.find((t) => t.key === activeTab)?.hint}
        </p>
      </header>

      {/* 自分のサマリ (4指標を常に表示) */}
      {data && me && (
        <section className="mx-4 mb-4">
          <div className="bg-primary text-white rounded-2xl p-4">
            <div className="text-xs opacity-80 mb-1">あなたの今の状況</div>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <div className="text-lg font-bold">🔥{me.streakDays}</div>
                <div className="text-[10px] opacity-80">連続日</div>
              </div>
              <div>
                <div className="text-lg font-bold">
                  {me.growthDiff >= 0 ? '+' : ''}
                  {me.growthDiff}
                </div>
                <div className="text-[10px] opacity-80">先週比</div>
              </div>
              <div>
                <div className="text-lg font-bold">{me.thisWeekCount}</div>
                <div className="text-[10px] opacity-80">今週</div>
              </div>
              <div>
                <div className="text-lg font-bold">
                  {Math.round(me.coverageRate * 100)}%
                </div>
                <div className="text-[10px] opacity-80">総合</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* タブ */}
      <section className="mx-4 mb-3">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {TABS.map((t) => {
            const isActive = t.key === activeTab
            return (
              <Link
                key={t.key}
                href={`/progress?tab=${t.key}`}
                scroll={false}
                className={`flex-1 py-2 rounded-lg text-xs font-medium text-center transition-all ${
                  isActive
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="mr-0.5">{t.icon}</span>
                {t.label}
              </Link>
            )
          })}
        </div>
      </section>

      {/* 現在タブでのあなたの順位 */}
      {data && activeRank !== null && activeRank !== undefined && activeRank > TOP_N_VISIBLE && (
        <section className="mx-4 mb-3">
          <div className="bg-blue-50 rounded-xl px-4 py-2 text-xs text-blue-800 text-center">
            あなたの{activeLabel}順位は <span className="font-semibold">{activeRank}位</span>
            （上位10位のみ表示中）
          </div>
        </section>
      )}

      {/* ランキング本体 (TOP10) */}
      <section className="mx-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {entries.length > 0 ? (
            entries.map((entry, i) => {
              const isTop3 = entry.rank <= 3
              const medals = ['', '🥇', '🥈', '🥉']
              return (
                <div
                  key={entry.rank}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    i < entries.length - 1 ? 'border-b border-gray-50' : ''
                  } ${entry.isCurrentUser ? 'bg-blue-50' : ''}`}
                >
                  <div className="w-8 text-center shrink-0">
                    {isTop3 ? (
                      <span className="text-lg">{medals[entry.rank]}</span>
                    ) : (
                      <span className="text-sm text-muted font-medium">
                        {entry.rank}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm truncate ${
                        entry.isCurrentUser ? 'font-semibold text-primary' : ''
                      }`}
                    >
                      {entry.name}
                      {entry.isCurrentUser && ' (あなた)'}
                    </div>
                    {entry.secondary && (
                      <div className="text-xs text-muted">{entry.secondary}</div>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-right shrink-0 min-w-[56px]">
                    {entry.displayValue}
                  </div>
                </div>
              )
            })
          ) : (
            <div className="p-6 text-center">
              <p className="text-muted text-sm">
                {data
                  ? 'まだランキングに載る学生がいません'
                  : 'ログインするとランキングが表示されます'}
              </p>
            </div>
          )}
        </div>

        {/* 下位の学生を守る注意書き */}
        {data && (
          <p className="text-[11px] text-muted text-center mt-3 px-4">
            下位は非表示にしています。自分と戦い、続けた人が勝つ。
          </p>
        )}
      </section>

      <BottomNav />
    </main>
  )
}

const TOP_N_VISIBLE = 10
