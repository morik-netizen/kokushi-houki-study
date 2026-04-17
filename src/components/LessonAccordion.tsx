'use client'

import { useState } from 'react'
import Link from 'next/link'

interface LessonItem {
  readonly lesson: number
  readonly title: string
  readonly isCurrent: boolean
  readonly totalQuestions: number
  readonly attempted: number
}

interface Props {
  readonly lessons: readonly LessonItem[]
}

export function LessonAccordion({ lessons }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  const currentLesson = lessons.find((l) => l.isCurrent)
  const totalAttempted = lessons.reduce((s, l) => s + l.attempted, 0)
  const totalQuestions = lessons.reduce((s, l) => s + l.totalQuestions, 0)
  const overallPct = totalQuestions > 0 ? Math.round((totalAttempted / totalQuestions) * 100) : 0

  return (
    <section className="mx-4 mt-4">
      {/* カード型ボタン（タップで開閉） */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full rounded-2xl p-5 text-left transition-all active:scale-[0.98] ${
          isOpen
            ? 'bg-white shadow-sm border border-gray-100'
            : 'bg-blue-50 border-2 border-blue-200 shadow-md'
        }`}
      >
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <span className="text-xl">📚</span>
            <div>
              <h2 className="text-sm font-bold text-foreground">単元別に学習する</h2>
              <span className="text-xs text-muted">{lessons.length}単元</span>
            </div>
          </div>
          <div className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${
            isOpen ? 'bg-gray-100 text-gray-500' : 'bg-primary text-white'
          }`}>
            <span className={`text-sm transition-transform inline-block ${isOpen ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </div>
        </div>

        {/* 今週のおすすめ + ミニ進捗バー */}
        <div className="mt-3">
          {currentLesson && (
            <p className="text-xs text-primary font-medium mb-2">
              今週のおすすめ → 第{currentLesson.lesson === 10 ? '10-12' : currentLesson.lesson}回 {currentLesson.title}
            </p>
          )}
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-primary h-2.5 rounded-full transition-all"
                style={{ width: `${overallPct}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-primary shrink-0">{overallPct}%</span>
          </div>
        </div>

        {!isOpen && (
          <p className="text-xs text-blue-500 mt-3 text-center font-medium">
            タップして単元を選ぶ
          </p>
        )}
      </button>

      {/* 展開コンテンツ */}
      {isOpen && (
        <div className="mt-2 flex flex-col gap-2">
          {lessons.map((lesson) => {
            const pct =
              lesson.totalQuestions > 0
                ? Math.round((lesson.attempted / lesson.totalQuestions) * 100)
                : 0
            const isComplete = pct === 100

            return (
              <div
                key={lesson.lesson}
                className={`rounded-xl p-3 ${
                  lesson.isCurrent
                    ? 'bg-blue-50 border border-primary'
                    : 'bg-white border border-gray-100 shadow-sm'
                }`}
              >
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className={`font-medium ${lesson.isCurrent ? 'text-primary' : ''}`}>
                    第{lesson.lesson === 10 ? '10-12' : lesson.lesson}回 {lesson.title}
                  </span>
                  <span className={isComplete ? 'text-green-600 font-medium' : 'text-muted'}>
                    {lesson.attempted}/{lesson.totalQuestions}
                    {isComplete && ' ✓'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      isComplete ? 'bg-green-500' : 'bg-primary'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-end">
                  <Link
                    href={`/quiz?lesson=${lesson.lesson}`}
                    className="text-xs px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-hover active:scale-[0.98] transition-all font-medium"
                  >
                    この回を学習
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
