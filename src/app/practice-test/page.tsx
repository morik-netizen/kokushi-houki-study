import Link from 'next/link'
import { BottomNav } from '@/components/BottomNav'
import { getPracticeTestList } from '@/lib/actions/practice-test'

export default async function PracticeTestListPage() {
  let tests: Awaited<ReturnType<typeof getPracticeTestList>> = []
  try {
    tests = await getPracticeTestList()
  } catch {
    // 未ログインまたはDB未接続
  }

  return (
    <main className="min-h-screen pb-20 max-w-lg mx-auto">
      <header className="px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold">練習テスト</h1>
        <p className="text-xs text-muted mt-1">
          各40問・80%以上で合格・何度でも受験可
        </p>
      </header>

      <div className="mx-4 flex flex-col gap-3">
        {tests.map((test) => (
          <div
            key={test.quarter}
            className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h2 className="font-semibold">{test.quarter}</h2>
                <p className="text-xs text-muted mt-0.5">{test.label}</p>
              </div>
              {test.bestPassed === true && (
                <span className="text-xs bg-green-50 text-success px-2 py-0.5 rounded-lg font-medium">
                  合格済
                </span>
              )}
              {test.bestPassed === false && (
                <span className="text-xs bg-red-50 text-error px-2 py-0.5 rounded-lg font-medium">
                  不合格
                </span>
              )}
            </div>

            {test.bestScore !== null && (
              <div className="flex gap-4 text-xs text-muted mb-3">
                <span>
                  最高: {test.bestScore}/{test.bestTotal} (
                  {Math.round(
                    ((test.bestScore ?? 0) / (test.bestTotal ?? 1)) * 100
                  )}
                  %)
                </span>
                <span>受験回数: {test.attempts}回</span>
              </div>
            )}

            <Link
              href={`/practice-test/${test.quarter}`}
              className="block w-full py-2.5 bg-primary text-white rounded-lg font-medium text-center text-sm hover:bg-primary-hover transition-colors"
            >
              {test.attempts > 0 ? '再挑戦' : 'テスト開始'}
            </Link>
          </div>
        ))}

        {tests.length === 0 && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center">
            <p className="text-muted text-sm">
              ログインすると練習テスト一覧が表示されます
            </p>
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  )
}
