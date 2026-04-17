'use client'

import { useState, useCallback } from 'react'
import type { Question } from '@/lib/types'

interface QuizCardProps {
  readonly question: Question
  readonly current: number
  readonly total: number
  readonly onAnswer: (selectedAnswer: string) => void
}

const CHOICE_LABELS = ['A', 'B', 'C', 'D'] as const

export function QuizCard({
  question,
  current,
  total,
  onAnswer,
}: QuizCardProps) {
  const [selectedSet, setSelectedSet] = useState<ReadonlySet<string>>(new Set())
  const [submitted, setSubmitted] = useState(false)

  const isMultiple = question.correctAnswers.includes(',')
  const requiredCount = isMultiple
    ? question.correctAnswers.split(',').length
    : 1

  const choices = [
    question.choiceA,
    question.choiceB,
    question.choiceC,
    question.choiceD,
  ]

  const handleSelect = useCallback(
    (label: string) => {
      if (submitted) return

      if (isMultiple) {
        // 複数選択: トグル
        setSelectedSet((prev) => {
          const next = new Set(prev)
          if (next.has(label)) {
            next.delete(label)
          } else {
            next.add(label)
          }
          return next
        })
      } else {
        // 単一選択: 即確定
        setSelectedSet(new Set([label]))
        setSubmitted(true)
        onAnswer(label)
      }
    },
    [submitted, isMultiple, onAnswer]
  )

  const handleSubmit = useCallback(() => {
    if (submitted || selectedSet.size === 0) return
    setSubmitted(true)
    const answer = Array.from(selectedSet).sort().join(',')
    onAnswer(answer)
  }, [submitted, selectedSet, onAnswer])

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex justify-between items-center text-sm text-muted">
        <span>
          問題 {current}/{total}
        </span>
        <span className="bg-blue-50 text-primary px-2 py-0.5 rounded text-xs font-medium">
          {question.categoryCode} {question.categoryName}
        </span>
      </div>

      <h2 className="text-lg font-medium leading-relaxed">
        {question.questionText}
      </h2>

      {isMultiple && !submitted && (
        <p className="text-sm text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg font-medium">
          {requiredCount}つ選んでください
        </p>
      )}

      <div className="flex flex-col gap-3 mt-2">
        {choices.map((choice, idx) => {
          const label = CHOICE_LABELS[idx]
          const isSelected = selectedSet.has(label)
          return (
            <button
              key={label}
              onClick={() => handleSelect(label)}
              disabled={submitted}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                isSelected
                  ? 'border-primary bg-blue-50'
                  : submitted
                    ? 'border-gray-200 bg-gray-50 opacity-60'
                    : 'border-gray-200 bg-white hover:border-primary hover:bg-blue-50 active:scale-[0.98]'
              }`}
            >
              <span className="font-semibold text-primary mr-2">{label}</span>
              <span>{choice}</span>
            </button>
          )
        })}
      </div>

      {isMultiple && !submitted && (
        <button
          onClick={handleSubmit}
          disabled={selectedSet.size === 0}
          className={`w-full py-3 rounded-xl font-medium text-center transition-all ${
            selectedSet.size > 0
              ? 'bg-primary text-white hover:bg-primary-hover active:scale-[0.98]'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          回答する（{selectedSet.size}/{requiredCount}つ選択中）
        </button>
      )}
    </div>
  )
}
