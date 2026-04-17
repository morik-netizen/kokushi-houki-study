'use server'

import { prisma } from '../db'
import { auth, isAllowedEmail, signOut } from '../auth'
import { redirect } from 'next/navigation'
import {
  toJstDateString,
  calculateStreak,
  getWeekStartJst,
  getPreviousWeekStartJst,
} from '../streak'

// ============================================
// 型定義
// ============================================

export type RankingCategory = 'streak' | 'growth' | 'weekly' | 'coverage'

export interface RankingEntry {
  readonly rank: number
  readonly name: string
  readonly value: number
  readonly displayValue: string
  readonly secondary?: string
  readonly isCurrentUser: boolean
}

export interface CurrentUserStats {
  readonly streakDays: number
  readonly growthDiff: number
  readonly thisWeekCount: number
  readonly lastWeekCount: number
  readonly coverageRate: number
  readonly totalMastered: number
  readonly streakRank: number | null
  readonly growthRank: number | null
  readonly weeklyRank: number | null
  readonly coverageRank: number | null
}

export interface LeaderboardData {
  readonly totalQuestions: number
  readonly totalStudents: number
  readonly rankings: {
    readonly streak: readonly RankingEntry[]
    readonly growth: readonly RankingEntry[]
    readonly weekly: readonly RankingEntry[]
    readonly coverage: readonly RankingEntry[]
  }
  readonly currentUser: CurrentUserStats
}

const TOP_N = 10

// ============================================
// 取得
// ============================================

export async function getLeaderboard(): Promise<LeaderboardData> {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }
  if (!isAllowedEmail(session.user.email)) {
    await signOut()
    redirect('/login?error=AccessDenied')
  }

  const currentUserId = session.user.id
  const today = new Date()
  const weekStart = getWeekStartJst(today)
  const prevWeekStart = getPreviousWeekStartJst(today)

  // 基礎データ取得
  const [totalQuestions, students, allRecords, allAnswers] = await Promise.all([
    prisma.question.count(),
    prisma.user.findMany({
      where: { role: 'student' },
      select: { id: true, name: true, email: true },
    }),
    prisma.learningRecord.findMany({
      select: { userId: true, totalAttempts: true, status: true },
    }),
    prisma.answerHistory.findMany({
      select: { userId: true, answeredAt: true },
    }),
  ])

  // ユーザー別に集計
  const answersByUser = new Map<string, Date[]>()
  for (const a of allAnswers) {
    const arr = answersByUser.get(a.userId) ?? []
    arr.push(a.answeredAt)
    answersByUser.set(a.userId, arr)
  }

  const recordsByUser = new Map<string, typeof allRecords>()
  for (const r of allRecords) {
    const arr = recordsByUser.get(r.userId) ?? []
    arr.push(r)
    recordsByUser.set(r.userId, arr)
  }

  interface StudentMetrics {
    id: string
    name: string
    streakDays: number
    thisWeekCount: number
    lastWeekCount: number
    growthDiff: number
    coverageRate: number
    totalMastered: number
    totalAttempted: number
  }

  const metrics: StudentMetrics[] = students.map((s, idx) => {
    const answers = answersByUser.get(s.id) ?? []
    const records = recordsByUser.get(s.id) ?? []

    // 連続学習日数
    const dateSet = new Set(answers.map((d) => toJstDateString(d)))
    const streakDays = calculateStreak(dateSet, today)

    // 週次カウント
    let thisWeekCount = 0
    let lastWeekCount = 0
    for (const d of answers) {
      const t = d.getTime()
      if (t >= weekStart.getTime()) thisWeekCount++
      else if (t >= prevWeekStart.getTime()) lastWeekCount++
    }
    const growthDiff = thisWeekCount - lastWeekCount

    // カバー率・定着数
    const totalAttempted = records.filter((r) => r.totalAttempts > 0).length
    const totalMastered = records.filter((r) => r.status === 'mastered').length
    const coverageRate = totalQuestions > 0 ? totalAttempted / totalQuestions : 0

    return {
      id: s.id,
      name: s.name ?? `匿名 #${idx + 1}`,
      streakDays,
      thisWeekCount,
      lastWeekCount,
      growthDiff,
      coverageRate,
      totalMastered,
      totalAttempted,
    }
  })

  // ランキング関数 (汎用)
  const buildRanking = (
    sorted: readonly StudentMetrics[],
    getValue: (m: StudentMetrics) => number,
    format: (m: StudentMetrics) => string,
    secondary?: (m: StudentMetrics) => string
  ): { entries: RankingEntry[]; currentUserRank: number | null } => {
    let currentUserRank: number | null = null
    const entries: RankingEntry[] = sorted.map((m, i) => {
      const rank = i + 1
      const isCurrentUser = m.id === currentUserId
      if (isCurrentUser) currentUserRank = rank
      return {
        rank,
        name: m.name,
        value: getValue(m),
        displayValue: format(m),
        secondary: secondary?.(m),
        isCurrentUser,
      }
    })
    return {
      entries: entries.slice(0, TOP_N),
      currentUserRank,
    }
  }

  // 🔥 連続日数: streakDays desc, tiebreak: thisWeekCount desc
  const streakSorted = [...metrics].sort((a, b) => {
    if (b.streakDays !== a.streakDays) return b.streakDays - a.streakDays
    return b.thisWeekCount - a.thisWeekCount
  })
  const streakRanking = buildRanking(
    streakSorted,
    (m) => m.streakDays,
    (m) => `${m.streakDays}日`,
    (m) => (m.streakDays >= 7 ? '🎉' : '')
  )

  // 📈 成長: growthDiff desc, tiebreak: thisWeekCount desc
  const growthSorted = [...metrics].sort((a, b) => {
    if (b.growthDiff !== a.growthDiff) return b.growthDiff - a.growthDiff
    return b.thisWeekCount - a.thisWeekCount
  })
  const growthRanking = buildRanking(
    growthSorted,
    (m) => m.growthDiff,
    (m) => `${m.growthDiff >= 0 ? '+' : ''}${m.growthDiff}問`,
    (m) => `今週${m.thisWeekCount}問`
  )

  // 🏆 今週: thisWeekCount desc
  const weeklySorted = [...metrics].sort(
    (a, b) => b.thisWeekCount - a.thisWeekCount
  )
  const weeklyRanking = buildRanking(
    weeklySorted,
    (m) => m.thisWeekCount,
    (m) => `${m.thisWeekCount}問`,
    (m) => (m.lastWeekCount > 0 ? `先週${m.lastWeekCount}問` : '')
  )

  // 📊 カバー率: coverageRate desc, tiebreak: totalMastered desc
  const coverageSorted = [...metrics].sort((a, b) => {
    if (b.coverageRate !== a.coverageRate) return b.coverageRate - a.coverageRate
    return b.totalMastered - a.totalMastered
  })
  const coverageRanking = buildRanking(
    coverageSorted,
    (m) => m.coverageRate,
    (m) => `${Math.round(m.coverageRate * 100)}%`,
    (m) => `定着${m.totalMastered}問`
  )

  // 現在のユーザーの自己指標
  const me = metrics.find((m) => m.id === currentUserId)
  const currentUser: CurrentUserStats = {
    streakDays: me?.streakDays ?? 0,
    growthDiff: me?.growthDiff ?? 0,
    thisWeekCount: me?.thisWeekCount ?? 0,
    lastWeekCount: me?.lastWeekCount ?? 0,
    coverageRate: me?.coverageRate ?? 0,
    totalMastered: me?.totalMastered ?? 0,
    streakRank: streakRanking.currentUserRank,
    growthRank: growthRanking.currentUserRank,
    weeklyRank: weeklyRanking.currentUserRank,
    coverageRank: coverageRanking.currentUserRank,
  }

  return {
    totalQuestions,
    totalStudents: students.length,
    rankings: {
      streak: streakRanking.entries,
      growth: growthRanking.entries,
      weekly: weeklyRanking.entries,
      coverage: coverageRanking.entries,
    },
    currentUser,
  }
}
