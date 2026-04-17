import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { parse } from 'csv-parse/sync'
import * as fs from 'fs'
import * as path from 'path'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// カテゴリ → unlock_date マッピング (2026-04-16 確定版)
// 注: 全コンテンツ公開方式のためランタイム制限はなし。記録用。
const UNLOCK_DATES: Record<string, string> = {
  '1B': '2026-04-16', // L1 法の体系
  '1C': '2026-04-16', // L1 法の体系
  '2A': '2026-04-16', // L1 リスクマネジメント
  '4A': '2026-04-23', // L2 総則
  '4B': '2026-04-23', // L2 柔整師免許
  '4D': '2026-05-14', // L4 業務
  '4E': '2026-05-21', // L5 施術所
  '4C': '2026-05-28', // L6 指定登録機関
  '4F': '2026-05-28', // L6 広告
  '4G': '2026-05-28', // L6 罰則
  '5A': '2026-06-04', // L7 医療資格制度
  '5B': '2026-06-04', // L7 医療資格制度
  '5C': '2026-06-04', // L7 医療資格制度
  '5D': '2026-06-04', // L7 医療資格制度
  '5E': '2026-06-04', // L7 医療資格制度
  '2B': '2026-06-11', // L8 (講義で補足)
  '3B': '2026-06-11', // L8 社会福祉
  '5F': '2026-06-11', // L8 医療法
  '3A': '2026-06-18', // L9 健康保険
  '3C': '2026-06-18', // L9 介護保険
  '3D': '2026-06-25', // L10-12 療養費
}

interface CsvRow {
  questionname: string
  questiontext: string
  A: string
  B: string
  C: string
  D: string
  'Answer 1': string
  'Answer 2': string
  answernumbering: string
  correctfeedback: string
  partiallycorrectfeedback: string
  incorrectfeedback: string
  defaultmark: string
}

function parseCategoryCode(questionname: string): {
  categoryCode: string
  categoryName: string
} {
  const firstSpace = questionname.indexOf(' ')
  if (firstSpace === -1) {
    return { categoryCode: questionname, categoryName: questionname }
  }
  return {
    categoryCode: questionname.substring(0, firstSpace),
    categoryName: questionname.substring(firstSpace + 1),
  }
}

function buildCorrectAnswers(answer1: string, answer2: string): string {
  const parts = [answer1.trim()].filter(Boolean)
  if (answer2.trim()) {
    parts.push(answer2.trim())
  }
  return parts.sort().join(',')
}

async function main() {
  // CSV path は環境変数 QUESTIONS_CSV で指定可能。未指定時はリポ外のデフォルト位置を参照。
  // このリポには問題データ CSV は含まれていない（著作権上の理由）。
  // Moodle 形式 (questionname/questiontext/A/B/C/D/Answer 1/Answer 2/correctfeedback/incorrectfeedback)
  // の CSV を各自用意してください。
  const csvPath =
    process.env.QUESTIONS_CSV ??
    path.resolve(__dirname, '../data/questions.csv')

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`)
    console.error(
      'Set QUESTIONS_CSV env var to a Moodle-format CSV, or place one at data/questions.csv'
    )
    process.exit(1)
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8')
  const records: CsvRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  })

  console.log(`Parsed ${records.length} questions from CSV`)

  // 既存データをクリア
  await prisma.question.deleteMany()

  let created = 0
  let skipped = 0

  for (const row of records) {
    const { categoryCode, categoryName } = parseCategoryCode(row.questionname)
    const unlockDateStr = UNLOCK_DATES[categoryCode]

    if (!unlockDateStr) {
      console.warn(
        `Unknown category code: ${categoryCode} (${row.questionname})`
      )
      skipped++
      continue
    }

    const correctAnswers = buildCorrectAnswers(
      row['Answer 1'],
      row['Answer 2']
    )

    await prisma.question.create({
      data: {
        categoryCode,
        categoryName,
        questionText: row.questiontext,
        choiceA: row.A,
        choiceB: row.B,
        choiceC: row.C,
        choiceD: row.D,
        correctAnswers,
        correctFeedback: row.correctfeedback || null,
        incorrectFeedback: row.incorrectfeedback || null,
        similarityGroup: null,
        unlockDate: new Date(unlockDateStr),
      },
    })
    created++
  }

  console.log(`Created: ${created}, Skipped: ${skipped}`)

  // 集計表示
  const stats = await prisma.question.groupBy({
    by: ['categoryCode'],
    _count: true,
    orderBy: { categoryCode: 'asc' },
  })
  console.log('\nCategory breakdown:')
  for (const s of stats) {
    console.log(`  ${s.categoryCode}: ${s._count} questions`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
