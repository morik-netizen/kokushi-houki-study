# Environment Variables Reference

**Last Updated:** 2026-03-19

This guide documents all environment variables required for local development and production deployment.

## Overview

The app requires **5 core variables** plus optional AWS/analytics variables.

### Variables by Environment

```
Development (.env.local):
  DATABASE_URL
  NEXTAUTH_URL
  AUTH_SECRET
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET

Production (Amplify Console):
  DATABASE_URL
  AUTH_URL (different from NEXTAUTH_URL)
  AUTH_SECRET
  AUTH_TRUST_HOST
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
```

---

## Core Variables

### DATABASE_URL

**Type:** Connection string
**Required:** Yes
**Scope:** All environments

PostgreSQL connection string to Aurora Serverless v2 database.

**Format:**
```
postgresql://[user]:[password]@[host]:[port]/[database]?schema=public
```

**Examples:**

Local (localhost):
```
postgresql://postgres:password@localhost:5432/kokushi?schema=public
```

Aurora Serverless:
```
postgresql://<user>:<password>@<your-db-endpoint>.<region>.rds.amazonaws.com:5432/<dbname>?schema=public&uselibpqcompat=true
```

**Important Notes:**
- Use `&uselibpqcompat=true` for Aurora Serverless (libpq compatibility)
- Schema MUST be `?schema=public`
- Do NOT include in git (add to `.gitignore`)
- Change password immediately after initial RDS setup

**Get this from:**
- Local dev: RDS Console → Connectivity & security → Endpoint
- AWS Secrets Manager: Auto-generated when creating Aurora cluster

---

### NEXTAUTH_URL (Development) / AUTH_URL (Production)

**Type:** URL
**Required:** Yes
**Development var:** `NEXTAUTH_URL`
**Production var:** `AUTH_URL`

The origin where your app is hosted. Used by NextAuth for callback validation.

**Examples:**

Development:
```
NEXTAUTH_URL=http://localhost:3000
```

Production (Amplify):
```
AUTH_URL=https://kokushi-app.amplifyapp.com
```

**Important Notes:**
- MUST include protocol (`http://` or `https://`)
- MUST match exactly with Google OAuth redirect URI
- Port MUST match (`:3000` for dev)
- NO trailing slash

**Why two different variable names?**
- `NEXTAUTH_URL` is checked first (supports v4 format)
- `AUTH_URL` is the official NextAuth.js v5 variable name
- Amplify build appends both to ensure compatibility

---

### AUTH_SECRET

**Type:** Base64-encoded random string
**Required:** Yes
**Scope:** All environments (SAME secret for dev & prod)

Encrypts session tokens and CSRF tokens.

**Generate with:**
```bash
openssl rand -base64 32
```

**Output example:**
```
vRjYGPbKB4o5pJW9xQ2vZ8mXuAkL3dEfZxCwP1qR2sT=
```

**Important Notes:**
- Minimum 32 bytes (after base64 decoding)
- MUST be base64-encoded
- MUST be identical in dev & prod
- If changed, all existing sessions become invalid (users logout)
- NEVER commit to git

**How to store:**
1. Generate once
2. Store in password manager (1Password, LastPass, etc.)
3. Add to `.env.local` (git-ignored)
4. Add to Amplify Console environment variables (encrypted at rest)

---

### GOOGLE_CLIENT_ID

**Type:** String (from Google Cloud Console)
**Required:** Yes
**Scope:** All environments

OAuth client ID for Google login.

**Get from:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project (if needed)
3. Enable Google+ API
4. Create OAuth 2.0 credential (Web application)
5. Add authorized redirect URIs:
   - Dev: `http://localhost:3000/api/auth/callback/google`
   - Prod: `https://kokushi-app.amplifyapp.com/api/auth/callback/google`
6. Copy **Client ID** from credentials

**Example:**
```
GOOGLE_CLIENT_ID=123456789-abcdefghijk.apps.googleusercontent.com
```

**Important Notes:**
- Specific to your Google Cloud project
- Visible in source code (not secret)
- Different ID for each environment is optional but recommended

---

### GOOGLE_CLIENT_SECRET

**Type:** String (from Google Cloud Console)
**Required:** Yes
**Scope:** All environments (MUST be kept secret)

OAuth client secret for Google login.

**Get from:**
1. Same location as `GOOGLE_CLIENT_ID` in Google Cloud Console
2. Copy **Client secret** (shown only once, then hidden)
3. If lost, delete and create new credential

**Example:**
```
GOOGLE_CLIENT_SECRET=GOCSPX-abcdef123456xyz789
```

**Important Notes:**
- Treat like password—NEVER commit to git
- Add to `.env.local` and Amplify Console
- Different secret for each environment is optional but recommended

---

## NextAuth.js v5 Production-Only Variables

These variables are set by Amplify build process automatically. You may need to set them in Amplify Console for troubleshooting.

### AUTH_TRUST_HOST

**Type:** Boolean string
**Required:** Prod only
**Default:** Not needed locally

Tells NextAuth to trust the `X-Forwarded-For` header from Amplify's reverse proxy.

**Set in Amplify Console:**
```
AUTH_TRUST_HOST=true
```

**When needed:**
- Always in production
- Prevents "Invalid credentials" errors with reverse proxies
- Amplify build auto-appends this via `amplify.yml`

---

## AWS-Specific Variables (Future Use)

For Phase 3 (AI features), you'll need:

### AWS_REGION

**Type:** String
**Example:** `us-east-1`
**Purpose:** Bedrock API region for AI coach

### AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY

**Type:** AWS IAM credentials
**Purpose:** Authenticate to Bedrock API
**Note:** Better to use IAM roles (no long-lived keys)

---

## Setting Up Environment Variables

### Local Development

1. **Create `.env.local`** (git-ignored):
```bash
cp .env.example .env.local
```

2. **Edit `.env.local`** with your values:
```bash
DATABASE_URL="postgresql://postgres:password@localhost:5432/kokushi?schema=public"
NEXTAUTH_URL="http://localhost:3000"
AUTH_SECRET="vRjYGPbKB4o5pJW9xQ2vZ8mXuAkL3dEfZxCwP1qR2sT="
GOOGLE_CLIENT_ID="123456789-abcdefghijk.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-abcdef123456xyz789"
```

3. **Test it:**
```bash
npm run dev
# Visit http://localhost:3000
# Should see login button (or redirect to login)
```

### Production (AWS Amplify)

1. **In Amplify Console** (AWS dashboard):
   - Go to App settings → Environment variables
   - Add these variables (one per row):

| Name | Value |
|------|-------|
| DATABASE_URL | `postgresql://admin:...` |
| AUTH_SECRET | Your generated secret |
| AUTH_URL | `https://kokushi-app.amplifyapp.com` |
| AUTH_TRUST_HOST | `true` |
| GOOGLE_CLIENT_ID | Your Google client ID |
| GOOGLE_CLIENT_SECRET | Your Google client secret |

2. **Verify `amplify.yml`** includes these build steps:
```yaml
preBuild:
  commands:
    - npm ci
    - npx prisma generate
    - echo "AUTH_SECRET=$AUTH_SECRET" >> .env.production
    - echo "AUTH_TRUST_HOST=true" >> .env.production
    - echo "AUTH_URL=$AUTH_URL" >> .env.production
    - echo "GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID" >> .env.production
    - echo "GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET" >> .env.production
    - echo "DATABASE_URL=${DATABASE_URL}&uselibpqcompat=true" >> .env.production
```

3. **Deploy:**
```bash
git push origin main
# Amplify auto-triggers build with environment variables
```

---

## Validation Checklist

Before launching:

- [ ] `.env.local` created from `.env.example`
- [ ] All 5 core variables filled in `.env.local`
- [ ] All 6 variables set in Amplify Console (including `AUTH_TRUST_HOST`)
- [ ] `DATABASE_URL` includes `&uselibpqcompat=true` for Aurora
- [ ] `NEXTAUTH_URL` and `AUTH_URL` match deployment domains
- [ ] Google OAuth redirect URIs match `NEXTAUTH_URL` + `/api/auth/callback/google`
- [ ] `npm run dev` works locally (can login with Google)
- [ ] `npm run build` succeeds locally
- [ ] Amplify build succeeds (check build logs)
- [ ] Can login on production domain

---

## Troubleshooting

### "Invalid credentials" on login

**Cause:** `NEXTAUTH_URL` or Google OAuth redirect URI mismatch

**Fix:**
1. Check `NEXTAUTH_URL` matches browser URL exactly (including port)
2. Verify Google Cloud Console has matching redirect URI
3. For Amplify prod, ensure `AUTH_TRUST_HOST=true`

### "PrismaClient initialization failed"

**Cause:** `DATABASE_URL` missing or malformed

**Fix:**
1. Run `npx prisma db push` to validate
2. Check connection string format (copy from RDS console)
3. Verify `?schema=public` is included

### "Build succeeded but deploy fails to start"

**Cause:** Production environment variables not set in Amplify

**Fix:**
1. Go to Amplify Console → App settings → Environment variables
2. Verify all 6 variables are present
3. Check for typos (especially `AUTH_SECRET`)
4. Redeploy: Amplify → Deployments → Redeploy

### Tests fail with "Cannot find module '@prisma/client'"

**Cause:** Prisma client not generated

**Fix:**
```bash
npx prisma generate
npm test
```

---

## Security Best Practices

1. **Never commit secrets to git:**
   - `.env.local` is in `.gitignore`
   - `AUTH_SECRET` and `GOOGLE_CLIENT_SECRET` must NEVER appear in code

2. **Rotate secrets if exposed:**
   - If `AUTH_SECRET` leaked: Generate new one, update all environments, users logout
   - If `GOOGLE_CLIENT_SECRET` leaked: Delete credential, create new one in Google Cloud Console

3. **Use strong `AUTH_SECRET`:**
   - Minimum 32 bytes (base64-encoded = 44 chars)
   - Use `openssl rand -base64 32` (not "password123")

4. **Secure storage:**
   - Dev: Keep `.env.local` local only
   - Prod: Amplify Console encrypts at rest, access via IAM roles

---

## Reference

- [NextAuth.js v5 Configuration](https://next-auth.js.org/getting-started/example)
- [Google OAuth Setup](https://next-auth.js.org/providers/google)
- [Prisma Connection Strings](https://www.prisma.io/docs/orm/reference/connection-reference)
- [AWS Aurora Serverless](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/aurora-serverless.html)
