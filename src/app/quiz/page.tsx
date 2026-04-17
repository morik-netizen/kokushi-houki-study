import { getQuizQuestions, getLessonAllQuestions } from '@/lib/actions/quiz'
import { QuizSession } from './QuizSession'
import { BottomNav } from '@/components/BottomNav'
import { LESSON_SCHEDULE } from '@/lib/lesson-schedule'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{ lesson?: string; mode?: string }>
}

export default async function QuizPage({ searchParams }: Props) {
  const { lesson: lessonParam, mode: modeParam } = await searchParams

  // レッスン指定がある場合、そのカテゴリで絞り込む（不正値は無視）
  const parsedLesson = lessonParam ? parseInt(lessonParam, 10) : null
  const lessonNum =
    parsedLesson !== null &&
    Number.isInteger(parsedLesson) &&
    parsedLesson >= 1 &&
    parsedLesson <= 15
      ? parsedLesson
      : null
  const lessonInfo = lessonNum
    ? LESSON_SCHEDULE.find((l) => l.lesson === lessonNum)
    : null
  const isRetry = modeParam === 'retry' && lessonNum !== null

  const categoryCodes =
    lessonInfo && lessonInfo.categoryCodes.length > 0
      ? lessonInfo.categoryCodes
      : undefined

  const questions =
    isRetry && lessonNum !== null
      ? await getLessonAllQuestions(lessonNum, 12)
      : await getQuizQuestions(12, categoryCodes)

  if (questions.length === 0) {
    return (
      <main className="min-h-screen pb-20 max-w-lg mx-auto">
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <div className="text-4xl mb-4">🎉</div>
          <h1 className="text-xl font-bold mb-2">
            {lessonInfo ? `${lessonInfo.title}は完了!` : '今日の学習は完了!'}
          </h1>
          <p className="text-muted text-sm text-center mb-4">
            {isRetry
              ? 'この単元には出題できる問題がありません。'
              : lessonInfo
              ? 'この単元の問題はすべてクリア済みです。もう一度解いて復習できます。'
              : '全393問をクリア済みです。素晴らしい！復習が必要な問題が出てきたらまた出題されます。'}
          </p>
          {lessonInfo && !isRetry && lessonInfo.categoryCodes.length > 0 && (
            <Link
              href={`/quiz?lesson=${lessonInfo.lesson}&mode=retry`}
              className="mb-3 inline-block px-5 py-3 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover active:scale-[0.98] transition-all"
            >
              🔄 この単元をもう一度解く
            </Link>
          )}
          <Link href="/" className="text-sm text-primary underline">
            ホームに戻る
          </Link>
        </div>
        <BottomNav />
      </main>
    )
  }

  return (
    <main className="min-h-screen pb-20 max-w-lg mx-auto">
      {lessonInfo && (
        <div className="px-4 py-2 bg-blue-50 text-primary text-xs font-medium flex items-center justify-between">
          <span>
            第{lessonInfo.lesson === 10 ? '10-12' : lessonInfo.lesson}回:{' '}
            {lessonInfo.title}
          </span>
          {isRetry && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-primary text-white">
              🔄 復習モード
            </span>
          )}
        </div>
      )}
      <QuizSession questions={questions} mode={isRetry ? 'retry' : 'normal'} />
      <BottomNav />
    </main>
  )
}
