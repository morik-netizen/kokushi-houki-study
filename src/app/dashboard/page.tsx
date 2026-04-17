import { getDashboardData } from '@/lib/actions/dashboard'
import type { DashboardData, StudentSummary } from '@/lib/actions/dashboard'
import Link from 'next/link'

export default async function DashboardPage() {
  const data = await getDashboardData()

  const avgCoverage = data.students.length > 0
    ? Math.round((data.students.reduce((s, st) => s + st.coverageRate, 0) / data.students.length) * 100)
    : 0

  const atRiskStudents = data.students.filter(
    (s) => s.totalAttempted > 0 && !s.isActive
  )

  return (
    <main className="min-h-screen bg-gray-50 pb-8">
      <div className="max-w-5xl mx-auto">
        {/* ヘッダー */}
        <header className="px-4 pt-6 pb-2 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">教員ダッシュボード</h1>
            <p className="text-sm text-gray-500 mt-0.5">関係法規マスター</p>
          </div>
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-primary px-3 py-1.5 rounded-lg hover:bg-white transition-colors"
          >
            ホームへ
          </Link>
        </header>

        {/* KPIサマリー */}
        <section className="px-4 mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon="👥"
            value={data.totalStudents}
            label="登録学生数"
            color="blue"
          />
          <KpiCard
            icon="⚡"
            value={data.activeStudents}
            label="アクティブ (7日以内)"
            sub={data.totalStudents > 0 ? `${Math.round((data.activeStudents / data.totalStudents) * 100)}%` : undefined}
            color={data.activeStudents / Math.max(data.totalStudents, 1) >= 0.7 ? 'green' : 'amber'}
          />
          <KpiCard
            icon="📝"
            value={data.totalQuestions}
            label="総問題数"
            color="blue"
          />
          <KpiCard
            icon="📈"
            value={`${avgCoverage}%`}
            label="全体平均カバー率"
            color={avgCoverage >= 70 ? 'green' : avgCoverage >= 40 ? 'amber' : 'red'}
          />
        </section>

        {/* 要注意アラート */}
        {atRiskStudents.length > 0 && (
          <section className="px-4 mt-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-amber-600 text-lg">⚠</span>
                <h2 className="text-sm font-semibold text-amber-800">
                  要フォロー: {atRiskStudents.length}人が7日以上未学習
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {atRiskStudents.slice(0, 10).map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-amber-200 rounded-full text-xs text-amber-800"
                  >
                    {s.name ?? s.email?.split('@')[0] ?? '?'}
                    <span className="text-amber-500">
                      ({s.lastActiveAt
                        ? s.lastActiveAt.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
                        : '未学習'})
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 学生一覧 */}
        <section className="px-4 mt-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">学生一覧</h2>
              <p className="text-xs text-gray-500 mt-0.5">カバー率順 / 全{data.totalQuestions}問</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                    <th className="px-5 py-3 text-left font-medium">学生</th>
                    <th className="px-3 py-3 text-left font-medium">ステータス</th>
                    <th className="px-3 py-3 text-left font-medium">カバー率</th>
                    <th className="px-3 py-3 text-right font-medium hidden sm:table-cell">挑戦</th>
                    <th className="px-3 py-3 text-right font-medium hidden sm:table-cell">定着</th>
                    <th className="px-3 py-3 text-right font-medium">最終学習</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.students.map((s) => (
                    <StudentRow key={s.id} student={s} totalQuestions={data.totalQuestions} />
                  ))}
                  {data.students.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-gray-400 text-sm">
                        まだ学生が登録されていません
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 授業回別達成状況 */}
        <section className="px-4 mt-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">授業回別の達成状況</h2>
              <p className="text-xs text-gray-500 mt-0.5">全学生平均 / カバー率と正答率</p>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.lessonOverview.map((l) => {
                const attemptPct = Math.round(l.avgAttemptedRate * 100)
                const correctPct = Math.round(l.avgCorrectRate * 100)
                return (
                  <div key={l.lesson} className="rounded-lg border border-gray-100 p-4 hover:border-gray-200 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="text-xs font-medium text-primary bg-blue-50 px-2 py-0.5 rounded">
                          第{l.lesson}回
                        </span>
                        <div className="text-sm font-medium text-gray-900 mt-1">{l.title}</div>
                      </div>
                      <span className="text-xs text-gray-400">{l.totalQuestions}問</span>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">カバー率</span>
                          <span className="font-medium text-gray-700">{attemptPct}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${attemptPct}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">正答率</span>
                          <span className={`font-medium ${correctPct >= 80 ? 'text-green-600' : correctPct >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                            {correctPct}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${correctPct >= 80 ? 'bg-green-500' : correctPct >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${correctPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* 練習テスト合格状況 */}
        <section className="px-4 mt-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">練習テスト合格状況</h2>
            </div>
            <div className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-4">
              {data.practiceTests.map((pt) => {
                const passRate = Math.round(pt.passRate * 100)
                return (
                  <div key={pt.quarter} className="relative rounded-xl border border-gray-100 p-4 text-center overflow-hidden">
                    {/* 背景の円グラフ的な装飾 */}
                    <div
                      className="absolute inset-0 opacity-5"
                      style={{
                        background: `conic-gradient(#3B82F6 ${passRate}%, transparent ${passRate}%)`,
                      }}
                    />
                    <div className="relative">
                      <div className="text-lg font-bold text-gray-900">{pt.quarter}</div>
                      <div className="text-xs text-gray-500 mt-0.5 mb-3">{pt.label}</div>
                      <div className={`text-3xl font-bold ${passRate >= 80 ? 'text-green-600' : passRate >= 50 ? 'text-amber-600' : 'text-gray-400'}`}>
                        {passRate}%
                      </div>
                      <div className="text-xs text-gray-500 mt-1">合格率</div>
                      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-around text-xs text-gray-500">
                        <div>
                          <div className="font-medium text-gray-700">{pt.passCount}/{pt.uniqueStudents}</div>
                          <div>合格</div>
                        </div>
                        <div>
                          <div className="font-medium text-gray-700">{Math.round(pt.avgScore)}</div>
                          <div>平均点</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* 2カラム: 弱点カテゴリ + 難問 */}
        <div className="px-4 mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 正答率が低いカテゴリ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">弱点カテゴリ</h2>
              <p className="text-xs text-gray-500 mt-0.5">初回正答率で授業補強対象を判定</p>
            </div>
            <div className="p-5 space-y-3">
              {data.weakCategories.length > 0 ? data.weakCategories.map((cat) => {
                const pct = Math.round(cat.correctRate * 100)
                return (
                  <div key={cat.categoryCode} className="flex items-center gap-3">
                    <StatusBadge value={pct} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700 truncate">
                          {cat.categoryCode} {cat.categoryName}
                        </span>
                        <span className="text-gray-500 shrink-0 ml-2">
                          {cat.correctCount}/{cat.totalAnswers}
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              }) : (
                <p className="text-sm text-gray-400 text-center py-4">まだデータがありません</p>
              )}
            </div>
          </div>

          {/* 難問TOP20 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">難問ランキング</h2>
              <p className="text-xs text-gray-500 mt-0.5">初回正答率が低い問題 TOP20</p>
            </div>
            <div className="divide-y divide-gray-50">
              {data.hardQuestions.length > 0 ? data.hardQuestions.map((q, i) => {
                const pct = Math.round(q.correctRate * 100)
                return (
                  <div key={q.questionId} className="px-5 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors">
                    <span className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${i < 3 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-700 line-clamp-1">
                        {q.questionText.slice(0, 60)}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400">{q.categoryCode}</span>
                        <StatusBadge value={pct} size="sm" />
                        <span className="text-xs text-gray-400">({q.correctCount}/{q.totalAnswers})</span>
                      </div>
                    </div>
                  </div>
                )
              }) : (
                <div className="px-5 py-8 text-center text-sm text-gray-400">
                  まだデータがありません
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 日別アクティビティ */}
        <section className="px-4 mt-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">日別アクティビティ</h2>
              <p className="text-xs text-gray-500 mt-0.5">過去30日間の学習状況</p>
            </div>
            <div className="p-5">
              {data.dailyActivity.length > 0 ? (
                <div className="space-y-1.5">
                  {data.dailyActivity.map((d) => {
                    const maxUsers = Math.max(...data.dailyActivity.map((dd) => dd.activeUsers), 1)
                    const barWidth = Math.round((d.activeUsers / maxUsers) * 100)
                    const dayOfWeek = new Date(d.date + 'T00:00:00').getDay()
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

                    return (
                      <div key={d.date} className={`flex items-center gap-3 text-xs rounded-lg px-2 py-1 ${isWeekend ? 'bg-gray-50' : ''}`}>
                        <span className={`w-12 shrink-0 font-medium ${isWeekend ? 'text-gray-400' : 'text-gray-600'}`}>
                          {new Date(d.date + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                        </span>
                        <span className="w-4 text-center text-gray-400 shrink-0">
                          {['日', '月', '火', '水', '木', '金', '土'][dayOfWeek]}
                        </span>
                        <div className="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden">
                          <div
                            className="bg-blue-500 h-5 rounded-full transition-all flex items-center"
                            style={{ width: `${Math.max(barWidth, 2)}%` }}
                          >
                            {barWidth > 30 && (
                              <span className="text-white text-[10px] font-medium pl-2">
                                {d.activeUsers}人
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="w-16 text-right text-gray-500 shrink-0">
                          {d.totalAnswers}問
                        </span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">まだデータがありません</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

// ============================================
// KPIカード
// ============================================

function KpiCard({
  icon,
  value,
  label,
  sub,
  color,
}: {
  readonly icon: string
  readonly value: string | number
  readonly label: string
  readonly sub?: string
  readonly color: 'blue' | 'green' | 'amber' | 'red'
}) {
  const colorMap = {
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    green: 'bg-green-50 border-green-100 text-green-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    red: 'bg-red-50 border-red-100 text-red-700',
  }
  const valueColorMap = {
    blue: 'text-blue-700',
    green: 'text-green-700',
    amber: 'text-amber-700',
    red: 'text-red-700',
  }

  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-xs font-medium opacity-80">{label}</span>
      </div>
      <div className={`text-3xl font-bold ${valueColorMap[color]}`}>{value}</div>
      {sub && <div className="text-xs mt-1 opacity-70">{sub}</div>}
    </div>
  )
}

// ============================================
// ステータスバッジ
// ============================================

function StatusBadge({
  value,
  size = 'md',
}: {
  readonly value: number
  readonly size?: 'sm' | 'md'
}) {
  const colorClass = value >= 80
    ? 'bg-green-100 text-green-700'
    : value >= 60
    ? 'bg-amber-100 text-amber-700'
    : 'bg-red-100 text-red-700'

  const sizeClass = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'

  return (
    <span className={`inline-flex items-center font-semibold rounded-full shrink-0 ${colorClass} ${sizeClass}`}>
      {value}%
    </span>
  )
}

// ============================================
// 学生テーブル行
// ============================================

function StudentRow({
  student,
  totalQuestions,
}: {
  readonly student: StudentSummary
  readonly totalQuestions: number
}) {
  const pct = Math.round(student.coverageRate * 100)

  const statusLabel = !student.lastActiveAt
    ? { text: '未学習', class: 'bg-gray-100 text-gray-600' }
    : !student.isActive
    ? { text: '要フォロー', class: 'bg-amber-100 text-amber-700' }
    : pct >= 80
    ? { text: '順調', class: 'bg-green-100 text-green-700' }
    : { text: '学習中', class: 'bg-blue-100 text-blue-700' }

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${student.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="text-sm font-medium text-gray-900">
            {student.name ?? student.email?.split('@')[0] ?? '(未設定)'}
          </span>
        </div>
      </td>
      <td className="px-3 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusLabel.class}`}>
          {statusLabel.text}
        </span>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="w-16 bg-gray-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-gray-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-medium text-gray-700 w-8">{pct}%</span>
        </div>
      </td>
      <td className="px-3 py-3 text-right text-sm text-gray-600 hidden sm:table-cell">
        {student.totalAttempted}/{totalQuestions}
      </td>
      <td className="px-3 py-3 text-right text-sm text-gray-600 hidden sm:table-cell">
        {student.totalMastered}
      </td>
      <td className="px-3 py-3 text-right text-xs text-gray-500">
        {student.lastActiveAt
          ? student.lastActiveAt.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
          : '-'}
      </td>
    </tr>
  )
}
