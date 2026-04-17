# データベーススキーマ設計

## 使用DB: Aurora Serverless v2 (PostgreSQL)

## テーブル一覧

| テーブル | 用途 |
|---------|------|
| users | ユーザー情報 |
| questions | 問題マスタ（CSVからインポート） |
| learning_records | 学習記録（SM-2状態） |
| answer_history | 全回答履歴 |
| practice_tests | 練習テスト結果 |

## スキーマ定義

```sql
-- ユーザー
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  name          VARCHAR(100) NOT NULL,
  nickname      VARCHAR(50),
  role          VARCHAR(10) NOT NULL DEFAULT 'student',  -- 'student' | 'teacher'
  course        VARCHAR(10),                              -- 'morning' | 'afternoon'
  daily_goal    INTEGER NOT NULL DEFAULT 10,              -- 1日の目標問題数
  notify_freq   VARCHAR(10) NOT NULL DEFAULT 'daily',     -- 'daily' | 'weekly3' | 'off'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 問題マスタ（CSVからインポート）
CREATE TABLE questions (
  id              SERIAL PRIMARY KEY,
  category_code   VARCHAR(10) NOT NULL,     -- '1C', '2A', '4B' etc.
  category_name   VARCHAR(100) NOT NULL,    -- '患者の権利' etc.
  question_text   TEXT NOT NULL,
  choice_a        TEXT NOT NULL,
  choice_b        TEXT NOT NULL,
  choice_c        TEXT NOT NULL,
  choice_d        TEXT NOT NULL,
  correct_answers VARCHAR(10) NOT NULL,     -- 'B' or 'B,D'（複数正答）
  correct_feedback    TEXT,
  incorrect_feedback  TEXT,
  similarity_group    INTEGER,              -- 類似問題グループID
  unlock_date     DATE NOT NULL             -- 授業進度連動の解放日
);

-- 学習記録（SM-2の状態を保持、ユーザー x 問題 で1レコード）
CREATE TABLE learning_records (
  id               SERIAL PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES users(id),
  question_id      INTEGER NOT NULL REFERENCES questions(id),
  -- SM-2 パラメータ
  easiness_factor  DECIMAL(4,2) NOT NULL DEFAULT 2.50,
  interval_days    INTEGER NOT NULL DEFAULT 0,
  repetitions      INTEGER NOT NULL DEFAULT 0,  -- 連続正答回数
  next_review_date DATE,
  -- 状態
  status           VARCHAR(20) NOT NULL DEFAULT 'new',
                   -- 'new' | 'learning' | 'reviewing' | 'mastered'
  -- 統計
  total_attempts   INTEGER NOT NULL DEFAULT 0,
  correct_count    INTEGER NOT NULL DEFAULT 0,
  last_answer      VARCHAR(4),
  last_quality     INTEGER,                     -- SM-2品質 (0-5)
  last_attempted_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, question_id)
);

-- 回答履歴（全回答を記録）
CREATE TABLE answer_history (
  id              SERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users(id),
  question_id     INTEGER NOT NULL REFERENCES questions(id),
  selected_answer VARCHAR(4) NOT NULL,          -- 'A', 'B,D' etc.
  is_correct      BOOLEAN NOT NULL,
  quality         INTEGER NOT NULL,             -- SM-2品質 (0-5)
  response_time_ms INTEGER,                     -- 回答時間（ms）
  session_type    VARCHAR(20) NOT NULL DEFAULT 'daily',
                  -- 'daily' | 'challenge' | 'practice_test' | 'review'
  answered_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 練習テスト結果
CREATE TABLE practice_tests (
  id            SERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id),
  quarter       VARCHAR(2) NOT NULL,            -- 'Q1'-'Q4'
  score         INTEGER NOT NULL,
  total         INTEGER NOT NULL DEFAULT 40,
  passed        BOOLEAN NOT NULL,               -- score/total >= 0.8
  started_at    TIMESTAMPTZ NOT NULL,
  completed_at  TIMESTAMPTZ
);

-- デイリーチャレンジ
CREATE TABLE daily_challenges (
  id            SERIAL PRIMARY KEY,
  challenge_date DATE NOT NULL UNIQUE,
  question_ids  INTEGER[] NOT NULL              -- 5問のID配列
);

-- インデックス
CREATE INDEX idx_lr_user_review ON learning_records(user_id, next_review_date);
CREATE INDEX idx_lr_user_status ON learning_records(user_id, status);
CREATE INDEX idx_ah_user_time ON answer_history(user_id, answered_at DESC);
CREATE INDEX idx_ah_session ON answer_history(session_type, answered_at);
CREATE INDEX idx_questions_unlock ON questions(unlock_date);
CREATE INDEX idx_questions_category ON questions(category_code);
CREATE INDEX idx_questions_similarity ON questions(similarity_group);
```

## ランキング集計ビュー

```sql
CREATE VIEW ranking_total AS
SELECT
  u.id,
  u.nickname,
  u.course,
  COALESCE(SUM(
    CASE WHEN ah.is_correct THEN 10 ELSE 0 END
  ), 0) AS total_points,
  COUNT(DISTINCT lr.question_id)
    FILTER (WHERE lr.status = 'mastered') AS mastered_count,
  COUNT(DISTINCT DATE(ah.answered_at)) AS active_days
FROM users u
LEFT JOIN answer_history ah ON u.id = ah.user_id
LEFT JOIN learning_records lr ON u.id = lr.user_id
WHERE u.role = 'student'
GROUP BY u.id, u.nickname, u.course
ORDER BY total_points DESC;
```

## 授業進度連動の実装

```sql
-- cronジョブ不要。クエリ時に日付フィルタリングするだけ
SELECT * FROM questions
WHERE unlock_date <= CURRENT_DATE
  AND id NOT IN (
    SELECT question_id FROM learning_records
    WHERE user_id = :userId
  )
ORDER BY RANDOM()
LIMIT 10;
```

## CSVインポート

```
prisma/seed.ts で CSV を parse → questions テーブルに INSERT
unlock_date は授業スケジュールに基づいて設定
```

| カテゴリ | unlock_date |
|---------|-------------|
| 1C, 1B | 2026-04-16 |
| 4A, 4B | 2026-04-23 |
| 4C, 4D | 2026-04-30 |
| 4E | 2026-05-14 |
| 4F, 4G | 2026-05-21 |
| 5A-5E | 2026-05-28 |
| 5F | 2026-06-04 |
| 3B | 2026-06-11 |
| 3A | 2026-06-18 |
| 3D | 2026-06-25 |
| 3C | 2026-07-02 |
| 2A, 2B | 2026-07-09 |
