'use client'

import Link from 'next/link'

interface SessionCompleteProps {
  readonly correctCount: number
  readonly totalCount: number
  readonly pointsEarned: number
}

export function SessionComplete({
  correctCount,
  totalCount,
  pointsEarned,
}: SessionCompleteProps) {
  const rate = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      <div className="text-center">
        <div className="text-4xl mb-2">🎉</div>
        <h1 className="text-2xl font-bold">学習完了!</h1>
      </div>

      <div className="w-full bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm text-muted mb-4">今日の結果</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-primary">
              {correctCount}/{totalCount}
            </div>
            <div className="text-xs text-muted mt-1">正答</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{rate}%</div>
            <div className="text-xs text-muted mt-1">正答率</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-success">
              +{pointsEarned}
            </div>
            <div className="text-xs text-muted mt-1">ポイント</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 w-full">
        <Link
          href="/quiz"
          className="w-full py-3 bg-primary text-white rounded-xl font-medium text-center hover:bg-primary-hover transition-colors"
        >
          もう10問やる
        </Link>
        <Link
          href="/"
          className="w-full py-3 bg-gray-100 text-foreground rounded-xl font-medium text-center hover:bg-gray-200 transition-colors"
        >
          ホームに戻る
        </Link>
      </div>
    </div>
  )
}
