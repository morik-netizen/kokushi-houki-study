# 柔道整復師国家試験 関係法規 学習アプリ (Kokushi Houki Study)

日本の柔道整復師国家試験「関係法規」科目を対象とした、間隔反復学習(SM-2)ベースの Web 学習アプリ。

**Tech Stack**: Next.js 15 (App Router / SSR) + NextAuth.js v5 (Google OAuth) + Prisma ORM + PostgreSQL (Aurora Serverless v2 推奨) + AWS Amplify Hosting

---

## ✨ 主な機能

- **SM-2 アルゴリズム**による間隔反復学習 — 忘却曲線に沿った出題
- **マイルストーン連動の推奨問題数** — 次のテストまでの残日数と未挑戦数から自動算出
- **4種のランキング** — 🔥連続学習日数 / 📈先週比成長 / 🏆今週の回答数 / 📊総合カバー率（下位は非表示で学習性無力感を回避）
- **retry モード** — SM-2 スケジュールを保護しつつ全問正解済みレッスンを再挑戦可能
- **教員ダッシュボード** — 初回正答率ベースで弱点カテゴリ・難問を可視化（授業改善の意思決定用）
- **練習テスト (Q1-Q4)** — 授業進度に連動した範囲でカテゴリ比率を反映した出題
- **PWA** — オフライン対応、ホーム画面インストール可

## 📐 アーキテクチャ概要

```
Browser (PWA)
   │  Google OAuth
   ▼
Next.js (AWS Amplify SSR)
   │  Server Actions
   ▼
Prisma → PostgreSQL (Aurora Serverless v2)
```

- 認証: NextAuth.js v5 with Prisma Adapter, Google Provider only
- 学習記録: SM-2 の 5 要素 (easinessFactor, intervalDays, repetitions, nextReviewDate, status)
- 回答履歴: AnswerHistory テーブル (sessionType で normal/retry 区別)
- 時刻: すべて JST (Asia/Tokyo) で計算、サーバータイムゾーン非依存

詳細は [docs/02_ARCHITECTURE.md](docs/02_ARCHITECTURE.md) と [docs/06_DATABASE_SCHEMA.md](docs/06_DATABASE_SCHEMA.md) を参照。

---

## 🚀 セットアップ

### 前提

- Node.js 18+
- PostgreSQL 12+ (ローカル開発) または Aurora Serverless v2 (本番)
- Google Cloud Console での OAuth クライアント (Web アプリ)

### 手順

```bash
# 1. 依存インストール
npm ci

# 2. 環境変数設定
cp .env.example .env.local
# .env.local を編集して DATABASE_URL / AUTH_SECRET / GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET を記入
# AUTH_SECRET は `openssl rand -base64 32` で生成

# 3. Prisma クライアント生成 + DB マイグレーション
npx prisma generate
npx prisma migrate dev --name init

# 4. 問題データの投入 (※ CSV は別途ご用意ください)
QUESTIONS_CSV=/path/to/your/questions.csv npx prisma db seed

# 5. 開発サーバー起動
npm run dev
```

### ⚠️ 問題データ CSV について

本リポジトリには**問題データ本体は含まれていません**（著作権上の理由）。

Moodle 形式 (以下の列) の CSV を各自でご用意ください。

```
questionname, questiontext, A, B, C, D,
Answer 1, Answer 2, answernumbering,
correctfeedback, partiallycorrectfeedback, incorrectfeedback, defaultmark
```

`questionname` の先頭にカテゴリコード (例: `1C 患者の権利`) を付けると、アプリ側でカテゴリ分類します。

### 環境変数

| 変数 | 必須 | 用途 |
|------|------|------|
| `DATABASE_URL` | ✅ | PostgreSQL 接続文字列。Aurora なら `&uselibpqcompat=true` を付与 |
| `AUTH_SECRET` | ✅ | NextAuth セッション暗号化用 (32バイト以上) |
| `AUTH_URL` | ✅ (本番) | 本番 URL (例: `https://your-app.example.com`) |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth Client Secret |
| `ALLOWED_EMAIL_DOMAINS` | 推奨 | ログイン許可ドメイン (カンマ区切り)。未設定なら全許可 |
| `QUESTIONS_CSV` | 任意 | seed 時に使う CSV のパス |
| `TEACHER_EMAIL` | 任意 | `scripts/set-teacher.ts` で昇格させる教員アカウント |

---

## 🧪 テスト

```bash
npx jest                 # 全テスト (約111件)
npx jest --coverage      # カバレッジ
npm run build            # Next.js 本番ビルド (型チェック込み)
npm run lint             # ESLint
```

主なテスト対象:
- `sm2.ts` — SM-2 アルゴリズム
- `streak.ts` — 連続日数計算 (JST固定、境界ケース網羅)
- `quiz-engine.ts` — 出題選定・推奨数計算
- `quiz-retry.ts` — retry モードの不変条件
- `scoring.ts` — ポイント計算

---

## 📁 ディレクトリ構成

```
src/
  app/                 # Next.js App Router (Server Components + Server Actions)
    page.tsx           # ホーム画面 (🔥連続日数・📈先週比バッジ)
    quiz/              # 出題画面
    progress/          # みんなの進捗 (4タブランキング)
    dashboard/         # 教員ダッシュボード
    practice-test/     # 練習テスト Q1-Q4
    mistakes/          # 間違いノート
    login/             # ログイン
  lib/
    sm2.ts             # SM-2 アルゴリズム
    streak.ts          # 連続日数・週次計算 (JST)
    quiz-engine.ts     # 出題選定・推奨数
    lesson-schedule.ts # 授業カレンダー
    actions/           # Server Actions
prisma/
  schema.prisma        # DB スキーマ
  seed.ts              # CSV → DB 投入スクリプト
docs/                  # 設計ドキュメント (PRD / アーキテクチャ / UX / スキーマ等)
scripts/
  set-teacher.ts       # ユーザーを教員ロールに昇格
```

---

## 🚢 デプロイ (AWS Amplify)

1. GitHub リポジトリを Amplify Console で接続
2. 環境変数を Amplify Console に登録 (上記一覧参照)
3. `amplify.yml` が自動ビルド設定として使われる
4. `master` ブランチへの push で自動デプロイ

詳細は [docs/RUNBOOK.md](docs/RUNBOOK.md) を参照。

---

## 📜 ライセンス

[MIT License](LICENSE) — 詳細は LICENSE ファイルを参照。

本リポジトリに含まれるコード・設定・ドキュメントは MIT ライセンスの下で公開されています。  
ただし、各自で用意する**問題データ CSV の著作権**については、各データ提供元のライセンスに従ってください（本リポジトリではデータ本体を配布しません）。

---

## 🙏 謝辞

- [Next.js](https://nextjs.org/)
- [NextAuth.js](https://next-auth.js.org/)
- [Prisma](https://www.prisma.io/)
- [SuperMemo SM-2 Algorithm](https://super-memory.com/english/ol/sm2.htm)
- Duolingo / Anki に着想を得た UX
