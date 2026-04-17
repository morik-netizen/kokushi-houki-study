// ============================================
// 関係法規マスター - Core Types
// ============================================

/** 問題カテゴリ */
export interface Category {
  readonly code: string       // '1C', '2A', '4B' etc.
  readonly name: string       // '患者の権利' etc.
  readonly unlockDate: Date   // 授業進度連動の解放日
}

/** 問題 */
export interface Question {
  readonly id: number
  readonly categoryCode: string
  readonly categoryName: string
  readonly questionText: string
  readonly choiceA: string
  readonly choiceB: string
  readonly choiceC: string
  readonly choiceD: string
  readonly correctAnswers: string    // 'B' or 'B,D'
  readonly correctFeedback: string
  readonly incorrectFeedback: string
  readonly similarityGroup: number | null
  readonly unlockDate: Date
}

/** 学習記録の状態 */
export type LearningStatus = 'new' | 'learning' | 'reviewing' | 'mastered'

/** SM-2 学習記録 */
export interface LearningRecord {
  readonly userId: string
  readonly questionId: number
  readonly easinessFactor: number    // EF (default 2.5)
  readonly intervalDays: number      // 次回復習までの日数
  readonly repetitions: number       // 連続正答回数
  readonly nextReviewDate: Date | null
  readonly status: LearningStatus
  readonly totalAttempts: number
  readonly correctCount: number
  readonly lastQuality?: number | null
  readonly lastAttemptedAt?: Date | null
}

/** SM-2 品質評価 (0-5) */
export type Quality = 0 | 1 | 2 | 3 | 4 | 5

/** SM-2 アルゴリズムの入力 */
export interface SM2Input {
  readonly quality: Quality
  readonly previousEF: number
  readonly previousInterval: number
  readonly previousRepetitions: number
}

/** SM-2 アルゴリズムの出力 */
export interface SM2Output {
  readonly easinessFactor: number
  readonly intervalDays: number
  readonly repetitions: number
  readonly nextReviewDate: Date
  readonly status: LearningStatus
}

/** 出題リクエスト */
export interface QuizRequest {
  readonly userId: string
  readonly currentDate: Date
  readonly maxQuestions: number       // 出題上限
}

/** 出題結果 */
export interface QuizSession {
  readonly questions: readonly Question[]
  readonly newCount: number           // 未挑戦の問題数
  readonly reviewCount: number        // 復習問題数
}

/** 回答 */
export interface Answer {
  readonly userId: string
  readonly questionId: number
  readonly selectedAnswer: string     // 'A', 'B', 'C', 'D', or 'B,D'
  readonly responseTimeMs: number
}

/** 回答結果 */
export interface AnswerResult {
  readonly isCorrect: boolean
  readonly correctAnswers: string
  readonly feedback: string
  readonly pointsEarned: number
  readonly sm2Update: SM2Output
}

/** 練習テスト */
export interface PracticeTest {
  readonly quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'
  readonly questions: readonly Question[]
  readonly totalQuestions: number     // 40
  readonly passingScore: number      // 0.8
}

/** 練習テスト結果 */
export interface PracticeTestResult {
  readonly quarter: string
  readonly score: number
  readonly total: number
  readonly passed: boolean
  readonly categoryBreakdown: ReadonlyArray<{
    readonly categoryCode: string
    readonly categoryName: string
    readonly correct: number
    readonly total: number
  }>
}

/** ユーザー進捗 */
export interface UserProgress {
  readonly totalQuestions: number      // 解放済み問題の総数
  readonly attempted: number          // 挑戦済み
  readonly mastered: number           // 定着済み
  readonly coverageRate: number       // カバー率 (0-1)
  readonly totalPoints: number
  readonly streakDays: number         // 今週の学習日数
  readonly recommendedDaily: number   // 今日の推奨問題数
}

/** 動的定着閾値 */
export interface MasteryThreshold {
  readonly requiredRepetitions: number  // 3 or 5
  readonly maxIntervalDays: number     // 期末近くは7日制限
}
