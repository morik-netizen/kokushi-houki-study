import { BottomNav } from '@/components/BottomNav'
import { getMistakes } from '@/lib/actions/quiz'

export default async function MistakesPage() {
  let mistakes: Awaited<ReturnType<typeof getMistakes>> = []
  try {
    mistakes = await getMistakes()
  } catch {
    // 未ログインまたはDB未接続
  }

  return (
    <main className="min-h-screen pb-20 max-w-lg mx-auto">
      <header className="px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold">間違いノート</h1>
        {mistakes.length > 0 && (
          <p className="text-xs text-muted mt-1">{mistakes.length}問</p>
        )}
      </header>

      {mistakes.length === 0 ? (
        <div className="mx-4 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
          <p className="text-muted text-sm">
            学習を開始すると、間違えた問題がここに表示されます
          </p>
        </div>
      ) : (
        <div className="mx-4 flex flex-col gap-3">
          {mistakes.map((m) => (
            <div
              key={m.questionId}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs bg-blue-50 text-primary px-2 py-0.5 rounded">
                  {m.categoryCode} {m.categoryName}
                </span>
                <span className="text-xs text-muted">
                  {m.correctCount}/{m.totalAttempts}回正解
                </span>
              </div>
              <p className="text-sm mb-2">{m.questionText}</p>
              <div className="text-xs text-muted">
                <span className="text-success font-medium">
                  正解: {m.correctAnswers}
                </span>
                {m.lastAnswer && (
                  <span className="ml-2 text-error">
                    あなた: {m.lastAnswer}
                  </span>
                )}
              </div>
              {m.incorrectFeedback && (
                <p className="text-xs text-muted mt-2 bg-gray-50 rounded p-2">
                  {m.incorrectFeedback}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <BottomNav />
    </main>
  )
}
