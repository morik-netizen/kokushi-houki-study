'use client'

import { useState, useCallback, useRef } from 'react'
import { QuizCard } from '@/components/QuizCard'
import { ResultCard } from '@/components/ResultCard'
import { SessionComplete } from '@/components/SessionComplete'
import { submitAnswer } from '@/lib/actions/quiz'
import type { QuestionDTO, SubmitAnswerResult, AnswerMode } from '@/lib/actions/quiz'
import type { Question, AnswerResult } from '@/lib/types'

interface QuizSessionProps {
  readonly questions: readonly QuestionDTO[]
  readonly mode?: AnswerMode
}

type Phase = 'answering' | 'result' | 'complete'

interface SessionState {
  readonly phase: Phase
  readonly currentIndex: number
  readonly results: readonly AnswerResult[]
  readonly selectedAnswers: readonly string[]
  readonly totalPoints: number
  readonly correctCount: number
}

function toQuestion(dto: QuestionDTO): Question {
  return {
    ...dto,
    correctFeedback: dto.correctFeedback ?? '',
    incorrectFeedback: dto.incorrectFeedback ?? '',
    unlockDate: new Date(),
  }
}

function toAnswerResult(
  serverResult: SubmitAnswerResult,
  correctAnswers: string
): AnswerResult {
  return {
    isCorrect: serverResult.isCorrect,
    correctAnswers,
    feedback: serverResult.feedback,
    pointsEarned: serverResult.pointsEarned,
    sm2Update: {
      easinessFactor: 2.5,
      intervalDays: 1,
      repetitions: 0,
      nextReviewDate: new Date(),
      status: serverResult.newStatus as 'new' | 'learning' | 'reviewing' | 'mastered',
    },
  }
}

export function QuizSession({ questions, mode = 'normal' }: QuizSessionProps) {
  const [session, setSession] = useState<SessionState>({
    phase: 'answering',
    currentIndex: 0,
    results: [],
    selectedAnswers: [],
    totalPoints: 0,
    correctCount: 0,
  })
  const [submitting, setSubmitting] = useState(false)
  const answerStartTime = useRef<number>(Date.now())

  const currentDTO = questions[session.currentIndex]
  const currentQuestion = currentDTO ? toQuestion(currentDTO) : null

  const handleAnswer = useCallback(
    async (selectedAnswer: string) => {
      if (!currentDTO || submitting) return
      setSubmitting(true)

      const responseTimeMs = Date.now() - answerStartTime.current

      try {
        const serverResult = await submitAnswer(
          currentDTO.id,
          selectedAnswer,
          responseTimeMs,
          mode
        )

        const result = toAnswerResult(serverResult, currentDTO.correctAnswers)

        setSession((prev) => ({
          ...prev,
          phase: 'result',
          results: [...prev.results, result],
          selectedAnswers: [...prev.selectedAnswers, selectedAnswer],
          totalPoints: prev.totalPoints + result.pointsEarned,
          correctCount: prev.correctCount + (result.isCorrect ? 1 : 0),
        }))
      } catch {
        // エラー時はローカルで採点 (オフライン対応)
        const isCorrect =
          selectedAnswer.toUpperCase() === currentDTO.correctAnswers
        const fallbackResult: AnswerResult = {
          isCorrect,
          correctAnswers: currentDTO.correctAnswers,
          feedback: isCorrect
            ? (currentDTO.correctFeedback ?? '正解です！')
            : (currentDTO.incorrectFeedback ?? '不正解です。'),
          pointsEarned: isCorrect ? 10 : 0,
          sm2Update: {
            easinessFactor: 2.5,
            intervalDays: 1,
            repetitions: 0,
            nextReviewDate: new Date(),
            status: 'learning',
          },
        }

        setSession((prev) => ({
          ...prev,
          phase: 'result',
          results: [...prev.results, fallbackResult],
          selectedAnswers: [...prev.selectedAnswers, selectedAnswer],
          totalPoints: prev.totalPoints + fallbackResult.pointsEarned,
          correctCount: prev.correctCount + (fallbackResult.isCorrect ? 1 : 0),
        }))
      } finally {
        setSubmitting(false)
      }
    },
    [currentDTO, submitting, mode]
  )

  const handleNext = useCallback(() => {
    answerStartTime.current = Date.now()
    setSession((prev) => {
      const nextIndex = prev.currentIndex + 1
      if (nextIndex >= questions.length) {
        return { ...prev, phase: 'complete' }
      }
      return { ...prev, phase: 'answering', currentIndex: nextIndex }
    })
  }, [questions.length])

  if (session.phase === 'complete') {
    return (
      <SessionComplete
        correctCount={session.correctCount}
        totalCount={questions.length}
        pointsEarned={session.totalPoints}
      />
    )
  }

  const lastResult = session.results[session.results.length - 1]
  const lastAnswer =
    session.selectedAnswers[session.selectedAnswers.length - 1]

  return (
    <>
      {/* プログレスバー */}
      <div className="w-full bg-gray-100 h-1">
        <div
          className="bg-primary h-1 transition-all duration-300"
          style={{
            width: `${((session.currentIndex + (session.phase === 'result' ? 1 : 0)) / questions.length) * 100}%`,
          }}
        />
      </div>

      {session.phase === 'answering' && currentQuestion && (
        <QuizCard
          key={currentQuestion.id}
          question={currentQuestion}
          current={session.currentIndex + 1}
          total={questions.length}
          onAnswer={handleAnswer}
        />
      )}

      {submitting && (
        <div className="flex justify-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      )}

      {session.phase === 'result' && lastResult && lastAnswer && (
        <ResultCard
          result={lastResult}
          selectedAnswer={lastAnswer}
          onNext={handleNext}
          isLast={session.currentIndex + 1 >= questions.length}
        />
      )}
    </>
  )
}
