/**
 * 指定した email のユーザーを教員ロールに昇格するスクリプト。
 *
 * Usage:
 *   TEACHER_EMAIL=teacher@example.com npx tsx scripts/set-teacher.ts
 *   npx tsx scripts/set-teacher.ts teacher@example.com
 *
 * 事前に該当ユーザーが一度アプリにログイン済みである必要がある。
 */
import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const email = process.argv[2] ?? process.env.TEACHER_EMAIL
  if (!email) {
    console.error(
      'Usage: TEACHER_EMAIL=teacher@example.com npx tsx scripts/set-teacher.ts'
    )
    console.error('   or: npx tsx scripts/set-teacher.ts teacher@example.com')
    process.exit(1)
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true },
  })

  if (!user) {
    console.log(`User not found: ${email}`)
    console.log('The user must log in to the app at least once first.')
    return
  }

  console.log('Before:', user)

  if (user.role === 'teacher') {
    console.log('Already a teacher. No change needed.')
    return
  }

  const result = await prisma.user.update({
    where: { email },
    data: { role: 'teacher' },
    select: { id: true, name: true, email: true, role: true },
  })

  console.log('After:', result)
  console.log('Done! Role updated to teacher.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
