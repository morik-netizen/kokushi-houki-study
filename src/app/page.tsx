import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BottomNav } from '@/components/BottomNav'
import { LessonAccordion } from '@/components/LessonAccordion'
import { getHomeProgress } from '@/lib/actions/quiz'
import { auth, signIn, signOut, isAllowedEmail } from '@/lib/auth'
import { prisma } from '@/lib/db'

export default async function HomePage() {
  const session = await auth()

  // Domain restriction: sign out unauthorized users
  if (session?.user?.email && !isAllowedEmail(session.user.email)) {
    await signOut()
    redirect('/login?error=AccessDenied')
  }

  // Check if teacher
  let isTeacher = false
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })
    isTeacher = user?.role === 'teacher'
  }

  let progress: Awaited<ReturnType<typeof getHomeProgress>> | null = null
  try {
    progress = await getHomeProgress()
  } catch {
    // 未ログインまたはDB未接続時はnull
  }

  const coveragePct = progress
    ? Math.round(progress.coverageRate * 100)
    : 0

  return (
    <main className="min-h-screen pb-20 max-w-lg mx-auto">
      {/* ヘッダー */}
      <header className="px-4 pt-6 pb-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">関係法規マスター</h1>
          <div className="flex gap-1.5">
            <span className="text-xs bg-orange-50 text-orange-600 px-2 py-1 rounded-lg font-medium">
              🔥 {progress?.streakDays ?? 0}日連続
            </span>
            {progress && progress.growthDiff !== 0 && (
              <span
                className={`text-xs px-2 py-1 rounded-lg font-medium ${
                  progress.growthDiff > 0
                    ? 'bg-green-50 text-green-600'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                📈 先週比{progress.growthDiff >= 0 ? '+' : ''}
                {progress.growthDiff}
              </span>
            )}
          </div>
        </div>
        {session?.user && (
          <div className="mt-3 bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold shrink-0">
                {(session.user.name ?? session.user.email ?? '?')[0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">
                  {session.user.name ?? 'ユーザー'}
                </div>
                <div className="text-xs text-muted truncate">
                  {session.user.email}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <form
                action={async () => {
                  'use server'
                  await signOut()
                  await signIn('google', { redirectTo: '/' })
                }}
                className="flex-1"
              >
                <button
                  type="submit"
                  className="w-full py-2 text-xs font-medium text-primary bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  アカウント切替
                </button>
              </form>
              <form
                action={async () => {
                  'use server'
                  await signOut({ redirectTo: '/login' })
                }}
                className="flex-1"
              >
                <button
                  type="submit"
                  className="w-full py-2 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                >
                  ログアウト
                </button>
              </form>
            </div>
          </div>
        )}
        {isTeacher && (
          <Link
            href="/dashboard"
            className="mt-2 block w-full py-2 bg-gray-900 text-white rounded-lg font-medium text-center text-sm hover:bg-gray-800 transition-colors"
          >
            教員ダッシュボード
          </Link>
        )}
      </header>

      {/* 今日の学習 */}
      <section className="mx-4 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">🎯</span>
          <h2 className="text-sm font-bold text-foreground">今日の学習</h2>
        </div>
        {progress && progress.currentLessonTitle && (
          <div className="mb-3 px-3 py-2 rounded-md bg-blue-50 text-xs text-primary">
            📚 今週の授業: 第{progress.currentLesson}回 {progress.currentLessonTitle}
          </div>
        )}
        <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
          <div
            className="bg-primary h-3 rounded-full transition-all"
            style={{ width: `${coveragePct}%` }}
          />
        </div>
        <div className="text-xs text-muted mb-3">
          {progress?.attempted ?? 0}/{progress?.totalUnlocked ?? 0}問 クリア済み
          (カバー率 {coveragePct}%)
        </div>
        {progress && (() => {
          // 合計内訳: 復習・直近ミス・未挑戦の合計が recommendedCount を超えないようにクランプ
          const reviewShow = Math.min(
            progress.reviewDueCount,
            progress.recommendedCount
          )
          const missShow = Math.min(
            progress.recentMissCount,
            progress.recommendedCount - reviewShow
          )
          const untriedShow = Math.max(
            0,
            progress.recommendedCount - reviewShow - missShow
          )
          return (
            <div className="flex gap-2 mb-4">
              <div className="flex-1 bg-blue-50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-primary">{reviewShow}</div>
                <div className="text-xs text-muted">復習</div>
              </div>
              <div className="flex-1 bg-green-50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-green-600">{untriedShow}</div>
                <div className="text-xs text-muted">未挑戦</div>
              </div>
              {missShow > 0 && (
                <div className="flex-1 bg-red-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-red-600">{missShow}</div>
                  <div className="text-xs text-muted">直近ミス</div>
                </div>
              )}
              <div className="flex-1 bg-orange-50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-orange-600">{progress.recommendedCount}</div>
                <div className="text-xs text-muted">合計</div>
              </div>
            </div>
          )
        })()}
        <Link
          href="/quiz"
          className="block w-full py-3 bg-primary text-white rounded-xl font-medium text-center hover:bg-primary-hover active:scale-[0.98] transition-all"
        >
          おすすめを始める →
        </Link>
        {progress && progress.nextMilestoneLabel !== '—' && (
          <p className="text-xs text-muted text-center mt-2">
            {progress.nextMilestoneLabel}まで あと{progress.daysUntilNextMilestone}日
          </p>
        )}
      </section>

      {/* 単元別に学習（アコーディオン） */}
      {progress && progress.lessonProgress.length > 0 ? (
        <LessonAccordion
          lessons={progress.lessonProgress.map((l) => ({
            lesson: l.lesson,
            title: l.title,
            isCurrent: l.isCurrent,
            totalQuestions: l.totalQuestions,
            attempted: l.attempted,
          }))}
        />
      ) : (
        <section className="mx-4 mt-4 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-sm text-muted mb-3">単元別に学習する</h2>
          <p className="text-sm text-muted">
            学習を開始すると、授業回別の進捗が表示されます
          </p>
        </section>
      )}

      {/* 練習テスト */}
      <section className="mx-4 mt-4 mb-4 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-sm text-muted mb-3">🏆 練習テスト</h2>
        <p className="text-sm text-muted mb-3">
          Q1〜Q4 各40問・80%以上で合格
        </p>
        <Link
          href="/practice-test"
          className="block w-full py-3 bg-white border-2 border-primary text-primary rounded-xl font-medium text-center hover:bg-blue-50 transition-colors"
        >
          練習テスト一覧
        </Link>
      </section>

      <BottomNav />
    </main>
  )
}
