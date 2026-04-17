# アーキテクチャ設計

## 技術スタック

| レイヤー | 技術 | 理由 |
|---------|------|------|
| フレームワーク | Next.js 15 (App Router) | Claude Codeとの相性最良、SSR + Server Actions |
| 認証 | NextAuth.js v5 + Google Provider | Cognitoより圧倒的に簡単、ドメイン制限可能 |
| ORM | Prisma | 型安全、マイグレーション管理 |
| DB | Aurora Serverless v2 (PostgreSQL) | Auto Pause対応、SQL集計が容易 |
| ホスティング | AWS Amplify Hosting | Git連携自動デプロイ、$1000クレジット活用 |
| PWA | Serwist (next-pwa後継) | 静的アセットキャッシュのみ |
| AI（Phase 3） | AWS Bedrock Haiku 4.0 (デフォルト) + Sonnet 4.6 (詳細) | コスト最適化 |

## 構成図

```
┌──────────────────────────────────────┐
│          学生のスマホ/タブレット        │
└─────────────┬────────────────────────┘
              │ HTTPS
              ▼
┌──────────────────────────────────────┐
│   AWS Amplify Hosting (Next.js 15)   │
│   ├── NextAuth.js v5 (Google OAuth)  │
│   ├── Prisma ORM                     │
│   ├── Server Actions (API層)         │
│   ├── SM-2 Algorithm                 │
│   └── PWA (Serwist)                  │
└─────────────┬────────────────────────┘
              │
              ▼
┌──────────────────────────────────────┐
│  Aurora Serverless v2 (PostgreSQL)   │
│  Auto Pause: 未使用時 $0             │
└──────────────────────────────────────┘

【Phase 3で追加】
┌──────────────────────────────────────┐
│  AWS Bedrock                         │
│  ├── Haiku 4.0（デフォルト）           │
│  └── Sonnet 4.6（詳しい解説ボタン）    │
│  レート制限: 10回/日/人              │
└──────────────────────────────────────┘
```

## 不採用とした構成と理由

| 不採用技術 | 理由 |
|-----------|------|
| DynamoDB | 50人規模に過剰。JOINがなくランキング集計が困難 |
| Cognito | セットアップが複雑。NextAuth.jsで十分 |
| Lambda + API Gateway | Next.js Server Actionsで代替可能 |
| Bedrock Sonnet 4.6（デフォルト） | コストが4倍。Haiku 4.0で学習アドバイスには十分 |

## セキュリティ

| 項目 | 実装方針 |
|------|---------|
| 認証 | NextAuth.js + Google Workspace ドメイン制限 |
| API認可 | Next.js middleware でセッション検証 |
| データ保護 | HTTPS強制、サーバーサイドのみDB接続 |
| 問題データ | 1問ずつ配信（全問一括取得不可） |
| SQLインジェクション | Prisma ORM パラメータ化クエリ |
| 個人情報 | 利用目的の明示と同意取得 |
| ランキング | ニックネーム制またはオプトイン |

## コスト見通し

| 期間 | 月額 | 備考 |
|------|------|------|
| 4-6月（AI無し） | ~$15 | Amplify + Aurora |
| 7月〜（AI有り） | ~$35 | + Bedrock Haiku 4.0 |
| **4ヶ月合計** | **$120-200** | $1000クレジットで十分 |

### 必須設定

- AWS Budgets: $200/月 で警告メール
- AWS Budgets: $800（累計）で緊急警告
- AIコーチ利用制限: 10回/日/人
- DynamoDB PITR → Aurora の自動バックアップ有効化
