'use client'

import { useState, useCallback, useRef } from 'react'
import { QuizCard } from '@/components/QuizCard'
import { submitPracticeTest } from '@/lib/actions/practice-test'
import type { QuestionDTO } from '@/lib/actions/quiz'
import type { PracticeTestSubmitResult } from '@/lib/actions/practice-test'
import type { Question } from '@/lib/types'
import Link from 'next/link'

interface Props {
  readonly quarter: string
  readonly questions: readonly QuestionDTO[]
}

type Phase = 'answering' | 'submitting' | 'result'

interface TestState {
  readonly phase: Phase
  readonly currentIndex: number
  readonly answers: readonly { questionId: number; selectedAnswer: string }[]
}

function toQuestion(dto: QuestionDTO): Question {
  return {
    ...dto,
    correctFeedback: dto.correctFeedback ?? '',
    incorrectFeedback: dto.incorrectFeedback ?? '',
    unlockDate: new Date(),
  }
}

export function PracticeTestSession({ quarter, questions }: Props) {
  const [state, setState] = useState<TestState>({
    phase: 'answering',
    currentIndex: 0,
    answers: [],
  })
  const [result, setResult] = useState<PracticeTestSubmitResult | null>(null)
  const startedAt = useRef(new Date().toISOString())

  const currentDTO = questions[state.currentIndex]
  const currentQuestion = currentDTO ? toQuestion(currentDTO) : null

  const handleAnswer = useCallback(
    (selectedAnswer: string) => {
      if (!currentDTO) return

      const newAnswers = [
        ...state.answers,
        { questionId: currentDTO.id, selectedAnswer },
      ]

      const nextIndex = state.currentIndex + 1

      if (nextIndex >= questions.length) {
        // 最後の問題 → 送信
        setState((prev) => ({
          ...prev,
          phase: 'submitting',
          answers: newAnswers,
        }))

        submitPracticeTest(quarter, newAnswers, startedAt.current)
          .then((res) => {
            setResult(res)
            setState((prev) => ({ ...prev, phase: 'result' }))
          })
          .catch(() => {
            // オフラインフォールバック: ローカル採点
            let score = 0
            for (const ans of newAnswers) {
              const q = questions.find((qq) => qq.id === ans.questionId)
              if (
                q &&
                ans.selectedAnswer.toUpperCase() === q.correctAnswers
              ) {
                score++
              }
            }
            setResult({
              score,
              total: newAnswers.length,
              passed: score / newAnswers.length >= 0.8,
              categoryBreakdown: [],
            })
            setState((prev) => ({ ...prev, phase: 'result' }))
          })
      } else {
        setState((prev) => ({
          ...prev,
          currentIndex: nextIndex,
          answers: newAnswers,
        }))
      }
    },
    [currentDTO, state.answers, state.currentIndex, questions, quarter]
  )

  // ============================================
  // 送信中
  // ============================================
  if (state.phase === 'submitting') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full mb-4" />
        <p className="text-muted text-sm">採点中...</p>
      </div>
    )
  }

  // ============================================
  // 結果表示
  // ============================================
  if (state.phase === 'result' && result) {
    const pct =
      result.total > 0
        ? Math.round((result.score / result.total) * 100)
        : 0

    return (
      <div className="flex flex-col gap-4 p-4">
        {/* ヘッダー */}
        <div
          className={`text-center py-8 rounded-2xl ${
            result.passed ? 'bg-green-50' : 'bg-red-50'
          }`}
        >
          <div className="text-5xl mb-3">
            {result.passed ? '🎉' : '📚'}
          </div>
          <div
            className={`text-2xl font-bold ${
              result.passed ? 'text-success' : 'text-error'
            }`}
          >
            {result.passed ? '合格!' : '不合格'}
          </div>
          <div className="text-muted text-sm mt-2">
            {quarter} 練習テスト
          </div>
        </div>

        {/* スコア */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">
                {result.score}/{result.total}
              </div>
              <div className="text-xs text-muted mt-1">正答数</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">{pct}%</div>
              <div className="text-xs text-muted mt-1">正答率</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-muted">80%</div>
              <div className="text-xs text-muted mt-1">合格ライン</div>
            </div>
          </div>
        </div>

        {/* カテゴリ別内訳 */}
        {result.categoryBreakdown.length > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-sm font-medium mb-3">カテゴリ別内訳</h3>
            <div className="flex flex-col gap-2">
              {result.categoryBreakdown.map((cat) => {
                const catPct =
                  cat.total > 0
                    ? Math.round((cat.correct / cat.total) * 100)
                    : 0
                return (
                  <div key={cat.categoryCode}>
                    <div className="flex justify-between text-xs mb-1">
                      <span>
                        {cat.categoryCode} {cat.categoryName}
                      </span>
                      <span
                        className={
                          catPct >= 80 ? 'text-success' : 'text-error'
                        }
                      >
                        {cat.correct}/{cat.total} ({catPct}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          catPct >= 80 ? 'bg-success' : 'bg-error'
                        }`}
                        style={{ width: `${catPct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* アクション */}
        <div className="flex flex-col gap-3">
          <Link
            href={`/practice-test/${quarter}`}
            className="w-full py-3 bg-primary text-white rounded-xl font-medium text-center hover:bg-primary-hover transition-colors"
          >
            もう一度受験
          </Link>
          <Link
            href="/practice-test"
            className="w-full py-3 bg-gray-100 text-foreground rounded-xl font-medium text-center hover:bg-gray-200 transition-colors"
          >
            テスト一覧に戻る
          </Link>
        </div>
      </div>
    )
  }

  // ============================================
  // 問題表示
  // ============================================
  return (
    <>
      {/* ヘッダー */}
      <div className="flex justify-between items-center px-4 py-2 text-xs text-muted">
        <span>{quarter} 練習テスト</span>
        <span>
          残り{' '}
          {questions.length - state.currentIndex - 1}問
        </span>
      </div>

      {/* プログレスバー */}
      <div className="w-full bg-gray-100 h-1">
        <div
          className="bg-primary h-1 transition-all duration-300"
          style={{
            width: `${((state.currentIndex + 1) / questions.length) * 100}%`,
          }}
        />
      </div>

      {currentQuestion && (
        <QuizCard
          key={currentQuestion.id}
          question={currentQuestion}
          current={state.currentIndex + 1}
          total={questions.length}
          onAnswer={handleAnswer}
        />
      )}
    </>
  )
}
