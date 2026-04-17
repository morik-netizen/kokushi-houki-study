import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './db'

/**
 * ログインを許可する Google Workspace ドメイン (カンマ区切り)。
 * 環境変数 ALLOWED_EMAIL_DOMAINS が未設定の場合は全ドメイン許可。
 * 例: ALLOWED_EMAIL_DOMAINS="example.ac.jp,student.example.ac.jp"
 */
const ALLOWED_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS ?? '')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean)

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false
  if (ALLOWED_DOMAINS.length === 0) return true // 未設定なら全許可 (開発用)
  const domain = email.split('@')[1]?.toLowerCase()
  return !!domain && ALLOWED_DOMAINS.includes(domain)
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'select_account',
        },
      },
    }),
  ],
  callbacks: {
    signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        const email = (profile as { email?: string })?.email ?? user.email
        if (!isAllowedEmail(email)) {
          return '/login?error=AccessDenied'
        }
      }
      return true
    },
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
})
