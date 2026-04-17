import { getPracticeTestQuestions } from '@/lib/actions/practice-test'
import { PracticeTestSession } from './PracticeTestSession'
import { BottomNav } from '@/components/BottomNav'

interface Props {
  params: Promise<{ quarter: string }>
}

export default async function PracticeTestPage({ params }: Props) {
  const { quarter } = await params

  if (!['Q1', 'Q2', 'Q3', 'Q4'].includes(quarter)) {
    return (
      <main className="min-h-screen pb-20 max-w-lg mx-auto flex items-center justify-center">
        <p className="text-muted">無効なテストです</p>
        <BottomNav />
      </main>
    )
  }

  let questions: Awaited<ReturnType<typeof getPracticeTestQuestions>> = []
  let error: string | null = null

  try {
    questions = await getPracticeTestQuestions(quarter)
  } catch (e) {
    console.error('Practice test error:', e)
    error = 'テストの読み込みに失敗しました。もう一度お試しください。'
  }

  if (error) {
    return (
      <main className="min-h-screen pb-20 max-w-lg mx-auto flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-muted mb-4">{error}</p>
          <a
            href="/practice-test"
            className="text-primary text-sm underline"
          >
            テスト一覧に戻る
          </a>
        </div>
        <BottomNav />
      </main>
    )
  }

  return (
    <main className="min-h-screen pb-20 max-w-lg mx-auto">
      <PracticeTestSession quarter={quarter} questions={questions} />
      <BottomNav />
    </main>
  )
}
