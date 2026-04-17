# Deployment & Operations Runbook

**Last Updated:** 2026-03-19
**Audience:** Developers & DevOps
**Platform:** AWS Amplify SSR (Next.js 15)

This document describes how to deploy, maintain, and troubleshoot the kokushi-houki learning app in production.

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Initial Setup (First Time Only)](#initial-setup-first-time-only)
3. [Deployment Process](#deployment-process)
4. [Monitoring & Alerts](#monitoring--alerts)
5. [Scaling & Performance](#scaling--performance)
6. [Emergency Procedures](#emergency-procedures)
7. [Database Operations](#database-operations)
8. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

Before any production deployment, verify:

### Code Quality
- [ ] All tests pass: `npm test -- --coverage`
- [ ] Coverage ≥80%: `npm test -- --coverage | grep -i total`
- [ ] Linting passes: `npm run lint`
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] Build succeeds: `npm run build`

### Security
- [ ] No hardcoded secrets in code
- [ ] No API keys in `.env.example`
- [ ] All sensitive variables in Amplify Console (not git)
- [ ] `.env.local` and `.env.production` in `.gitignore`
- [ ] Security audit passes: `npm audit` (no CRITICAL issues)

### Database
- [ ] All pending migrations created: `npx prisma migrate status`
- [ ] Migrations tested locally: `npx prisma migrate dev`
- [ ] Schema is valid: `npx prisma validate`
- [ ] Latest backup exists (Aurora Backup)

### Configuration
- [ ] `NEXTAUTH_URL` / `AUTH_URL` correct in Amplify Console
- [ ] `DATABASE_URL` includes `&uselibpqcompat=true`
- [ ] All 6 environment variables set in Amplify Console
- [ ] Google OAuth redirect URIs match domain
- [ ] `amplify.yml` has all build commands

### Documentation
- [ ] `CHANGELOG.md` updated (if applicable)
- [ ] API changes documented
- [ ] Deployment notes added to this runbook

---

## Initial Setup (First Time Only)

### 1. Create AWS Resources

#### 1a. Aurora Serverless v2 Database

```bash
# In AWS RDS Console:
1. Create database → Aurora (PostgreSQL compatible)
2. Edition: Aurora PostgreSQL (Standard)
3. Capacity: 0.5-1 ACU (auto-scale)
4. Storage: Auto-scaling 20-100 GB
5. Multi-AZ: Yes (for 6+ users, optional for MVP)
6. Public accessibility: No (private subnet)
7. Database: kokushi
8. Username: admin
9. Password: Generate strong password (store in 1Password)
10. Backup retention: 7 days (free tier default)
11. Create database (5-10 min wait)
```

**Outputs:**
- Endpoint: `<your-db-endpoint>.<region>.rds.amazonaws.com`
- Port: 5432
- Database: kokushi

#### 1b. Amplify Hosting Setup

```bash
# In AWS Amplify Console:
1. Create new app → Deploy with Amplify
2. GitHub connect (select repo, branch: main)
3. Build settings:
   - Framework: Next.js
   - Build command: npm run build
   - Output directory: .next
4. Environment variables (see below)
5. Deploy
```

**Build logs location:** Amplify Console → Deployments → Build logs

#### 1c. Environment Variables in Amplify

In AWS Amplify Console, go to App settings → Environment variables and add:

```
AUTH_SECRET=<your-generated-secret>
AUTH_TRUST_HOST=true
AUTH_URL=https://kokushi-app.amplifyapp.com
DATABASE_URL=postgresql://<user>:<password>@<your-db-endpoint>.<region>.rds.amazonaws.com:5432/<dbname>?schema=public&uselibpqcompat=true
GOOGLE_CLIENT_ID=<from-google-cloud-console>
GOOGLE_CLIENT_SECRET=<from-google-cloud-console>
```

Verify `amplify.yml` includes these lines in `preBuild`:
```yaml
- npx prisma generate
- echo "DATABASE_URL=${DATABASE_URL}&uselibpqcompat=true" >> .env.production
```

#### 1d. AWS Budget Alerts

In AWS Budgets Console:

```
Budget 1 (Monthly):
  - Limit: $200/month
  - Alert: Email at 50%, 80%, 100%
  - Scope: Amplify, RDS, Data Transfer

Budget 2 (Cumulative):
  - Limit: $800 (4 months)
  - Alert: Email at 75%, 100%
  - Scope: All services
```

### 2. Initial Database Setup

```bash
# Local: Create initial schema
npx prisma migrate dev --name init

# Get migration file created
ls prisma/migrations/

# Test migration locally
npx prisma db push

# Seed 393 questions
npx prisma db seed

# Verify in Prisma Studio
npx prisma studio
```

### 3. Git Push & Deploy

```bash
# Commit migrations and env config
git add prisma/migrations/ .env.example amplify.yml
git commit -m "feat: initial database schema and Amplify config"

# Push to trigger Amplify build
git push origin main

# Monitor deployment (Amplify Console → Deployments)
# Wait ~5-10 minutes for build + deploy to complete

# Verify domain works
https://kokushi-app.amplifyapp.com
```

---

## Deployment Process

### Standard Deployment (Bug fixes, features, updates)

#### Step 1: Local Testing
```bash
# Pull latest
git pull origin main

# Install dependencies
npm ci

# Run full test suite
npm test -- --coverage

# Build locally
npm run build

# Verify no errors
echo $?  # Should be 0
```

#### Step 2: Code Review
- [ ] Create Pull Request on GitHub
- [ ] Request code review (1+ approver)
- [ ] Address feedback
- [ ] Merge to main

#### Step 3: Amplify Auto-Deploy
Amplify automatically triggers on push to `main` branch:

```
Event: Push to main
  ↓
Amplify Build Start (build logs: Amplify Console)
  ├── npm ci (install dependencies)
  ├── npx prisma generate (generate Prisma client)
  ├── echo "DATABASE_URL=..." >> .env.production (env vars)
  ├── npm run build (Next.js build)
  ↓
Amplify Artifact Upload (.next folder)
  ↓
Amplify Deploy to CDN & Lambda
  ↓
Amplify Domain Live (https://kokushi-app.amplifyapp.com)
```

#### Step 4: Smoke Test
```bash
# Verify deployment
curl -I https://kokushi-app.amplifyapp.com
# Should return 200 OK

# Test login flow
# 1. Open https://kokushi-app.amplifyapp.com in browser
# 2. Click "Login with Google"
# 3. Should redirect to Google, then back to dashboard

# Check database is reachable
# Amplify Console → Logs → Availability (should be green)
```

#### Step 5: Monitor for Issues
- [ ] Check Amplify Console for build errors (Deployments tab)
- [ ] Check CloudWatch logs for Lambda errors (Amplify → Logs)
- [ ] Check student feedback within 1 hour of deploy
- [ ] Monitor error rate: Should be <0.1%

### Rollback Procedure (If needed)

If critical issue discovered after deploy:

```bash
# Option 1: Redeploy previous commit
git log --oneline main  # Find previous good commit
git revert <commit-hash>
git push origin main
# Amplify auto-deploys reverted code (2-5 min)

# Option 2: Manual rollback in Amplify Console
Amplify Console → Deployments → [Previous successful deployment] → Redeploy
```

---

## Monitoring & Alerts

### Daily Checks (Manual)

Every morning, check:

```bash
# Check deployment status
aws amplify list-jobs --app-id <app-id> --branch-name main --query 'jobSummaries[0]' --output table

# Check build status
# Amplify Console → Deployments (green checkmark = OK)

# Check database size
aws rds describe-db-clusters --db-cluster-identifier kokushi-db --query 'DBClusters[0].AllocatedStorage'
```

### CloudWatch Alarms (Automated)

Set up in AWS CloudWatch Console:

```
Alarm 1: Amplify Build Failures
  - Metric: Amplify BuildFailures
  - Threshold: ≥1 in 1 hour
  - Action: SNS → Email alert

Alarm 2: Database CPU
  - Metric: RDS CPUUtilization
  - Threshold: >75% for 5 min
  - Action: SNS → Email alert

Alarm 3: Database Connections
  - Metric: RDS DatabaseConnections
  - Threshold: >30 for 5 min
  - Action: SNS → Email alert
```

### Error Tracking

Check Amplify logs for errors:

```bash
# View live logs (requires AWS CLI)
aws logs tail /aws/amplify/kokushi-app --follow

# Or check Amplify Console → Logs tab for visual dashboard
```

---

## Scaling & Performance

### When to Scale

| Metric | Threshold | Action |
|--------|-----------|--------|
| Database CPU | >75% sustained | Increase Aurora ACU (0.5 → 1 → 2) |
| Database connections | >30 | Check for connection leaks, restart needed |
| Page load time | >2s avg | Check CloudFront cache, optimize queries |
| Build time | >10 min | Optimize dependencies, check npm ci perf |

### Scaling Aurora Serverless v2

```bash
# In AWS RDS Console:
1. Go to Databases → kokushi-db
2. Click "Modify"
3. DB Cluster Capacity Range:
   - Min: 0.5 ACU (auto-pause)
   - Max: 4 ACU (for 500+ concurrent users)
4. Apply immediately (1-2 min downtime)
5. Monitor performance (should improve in 5 min)
```

### Scaling Amplify

Amplify automatically scales compute. If needed:

```bash
# Check current concurrency (Amplify Console → Logs)
# Usually OK for <100 concurrent users

# If issues persist:
1. Enable Amplify Auto Scaling (AWS Lambda Concurrency)
2. Set reserved concurrency to 100
```

---

## Emergency Procedures

### Database Down

**Symptoms:** "Connection refused" errors, timeout on homepage

**Recovery:**
```bash
# 1. Check status
aws rds describe-db-clusters --db-cluster-identifier kokushi-db --query 'DBClusters[0].Status'
# Should return "available"

# 2. Check security group allows inbound traffic
aws ec2 describe-security-groups --group-ids sg-xxxxx

# 3. Check subnet is accessible from Amplify's VPC
# (Should auto-configure if set up correctly)

# 4. Manual restart (last resort)
aws rds reboot-db-cluster --db-cluster-identifier kokushi-db
# Wait 1-2 min for restart
```

### Build Failing

**Symptoms:** Amplify shows red X on Deployments tab

**Recovery:**
```bash
# 1. Check build logs (Amplify Console → Deployments → View Logs)

# 2. Common causes:
#    - npm ci timeout: Retry build (Redeploy button)
#    - Prisma generate failed: Check DATABASE_URL in Amplify Console
#    - Build command error: Check next.config.ts for syntax errors

# 3. If still failing:
git log --oneline main -5  # Check recent commits
git revert <problematic-commit>
git push origin main
# Auto-redeploy (should succeed if previous commit was good)
```

### High Error Rate

**Symptoms:** >10% of requests return 5xx errors, users report failures

**Recovery:**
```bash
# 1. Check error source (Amplify Logs)
aws logs get-log-events --log-group-name /aws/amplify/kokushi-app

# 2. If database errors:
#    - Check CPU/connections (see Monitoring section)
#    - Restart if needed: aws rds reboot-db-cluster...

# 3. If server errors:
#    - Check recent deployment (what changed?)
#    - Roll back: git revert <commit>; git push origin main

# 4. If widespread (>30% error):
#    - Disable new deployments (don't push)
#    - Investigate root cause
#    - Notify students (Amplify health dashboard)
```

### DDoS or Abuse

**Symptoms:** Sudden traffic spike, CloudFront CDN showing thousands of requests/sec

**Recovery:**
```bash
# 1. Enable AWS WAF
aws wafv2 create-web-acl \
  --scope REGIONAL \
  --name kokushi-waf \
  --default-action Block={}

# 2. Add rate limiting
aws wafv2 create-ip-set \
  --name kokushi-ratelimit \
  --scope REGIONAL \
  --ip-address-version IPV4

# 3. Attach to Amplify (via CloudFront distribution)

# 4. Monitor traffic (CloudFront console)
```

---

## Database Operations

### Backups

Aurora automatically backs up every 5 minutes (continuous backup). Retention: 7 days.

**Manual backup:**
```bash
# In AWS RDS Console → Databases → kokushi-db
# → Maintenance & backups → Create snapshot
# Backups are free (stored in S3)
```

**Restore from backup:**
```bash
# If data is corrupted or accidentally deleted:
# 1. RDS Console → Snapshots → [Select backup]
# 2. Restore to new DB cluster (2-10 min)
# 3. Update Amplify Console DATABASE_URL
# 4. Verify in Prisma Studio: npx prisma studio
```

### Migrations in Production

**Never run migrations during peak hours (3-5pm, when students use app).**

Safe migration window: Early morning (6-7am) or evening (after 9pm).

#### Automated migrations (Recommended)

```bash
# 1. Create migration locally
npx prisma migrate dev --name add_new_field

# 2. Test locally: npm run dev

# 3. Commit to git
git add prisma/migrations/
git commit -m "feat: add new field to questions table"
git push origin main

# 4. Amplify auto-runs migration in preBuild:
#    - npx prisma migrate deploy (runs pending migrations)
#    - npm run build (if migrations succeed)
#    - Deploy (only if build succeeds)

# 5. Monitor deployment logs
# Amplify Console → Deployments → View logs
# Should see "Running 1 migration" → "All migrations have been successfully run"
```

#### Manual migrations (If auto-deploy fails)

```bash
# 1. Connect to production database
PGPASSWORD=<password> psql -h <your-db-endpoint>.<region>.rds.amazonaws.com -U admin kokushi

# 2. Run SQL manually (last resort!)
# This is risky—only if Prisma migrate fails

# 3. Or, restart migration:
# - Revert code to pre-migration commit
# - Amplify redeploys (old schema restored)
# - Fix migration issue locally
# - Test thoroughly
# - Redeploy

# DON'T manually edit schema.prisma without running npx prisma migrate dev
```

### Monitoring Database Size

```bash
# Check current size
aws rds describe-db-clusters --db-cluster-identifier kokushi-db --query 'DBClusters[0].[AllocatedStorage,DBClusterArn]'

# Or in Amplify console → Logs (shows DB size metrics)

# Current estimates:
# - 50 students × 393 questions × 5 answer attempts
# - ~500K rows in AnswerHistory table
# - Total storage: ~500 MB (well under 100 GB limit)
```

---

## Troubleshooting

### Build Succeeds Locally but Fails on Amplify

**Cause:** Environment differences (Node version, npm cache, env vars)

**Fix:**
```bash
# 1. Check Node version matches
node --version  # Should be 18+
# Amplify uses node-18 by default (check Amplify Console → Build settings)

# 2. Check npm cache
npm ci --verbose  # Clean install (Amplify also uses this)

# 3. Check environment variables in Amplify Console
# DATABASE_URL, AUTH_SECRET, GOOGLE_* vars must all be present

# 4. Simulate Amplify build locally
rm -rf node_modules .next
npm ci
npx prisma generate
npm run build

# 5. If still fails, check build logs for specific error
# Amplify Console → Deployments → [Failed build] → View logs
```

### "Cannot find module '@prisma/client'" Error

**Cause:** Prisma client not generated after schema change

**Fix:**
```bash
# Generate Prisma client
npx prisma generate

# Then test
npm run dev

# Or, force regenerate
npx prisma generate --force
```

### Database Connection Timeout on Amplify

**Cause:** Aurora cluster not reachable from Amplify's VPC

**Fix:**
1. Check Security Group allows inbound TCP 5432
   ```bash
   aws ec2 describe-security-groups --group-ids sg-xxxxx
   # Should show 0.0.0.0/0 or Amplify's security group
   ```

2. Check subnet routing allows public internet (if using public endpoint)
   ```bash
   # In RDS Console → Database → Connectivity
   # Check "Publicly accessible" is enabled (for dev only)
   ```

3. Verify DATABASE_URL is correct in Amplify Console
   ```bash
   # Should end with ?schema=public&uselibpqcompat=true
   ```

4. Test connection locally
   ```bash
   PGPASSWORD=<password> psql -h <your-db-endpoint>.<region>.rds.amazonaws.com -U <user> <dbname>
   # Should connect without error
   ```

### Students Reporting 502 Bad Gateway

**Cause:** Server error in Lambda or database failure

**Recovery:**
```bash
# 1. Check CloudWatch logs
aws logs tail /aws/amplify/kokushi-app --follow

# 2. Check database status
aws rds describe-db-clusters --db-cluster-identifier kokushi-db --query 'DBClusters[0].Status'

# 3. If database is fine, redeploy
# Amplify Console → Deployments → [Latest] → Redeploy

# 4. If persists, check recent changes
git log --oneline main -5
# Did recent PR introduce SQL errors or timeouts?

# 5. Roll back if needed
git revert <commit>
git push origin main
```

### Prisma Studio Returns "No Route to Host"

**Cause:** Trying to connect to production database from local machine

**Prevention:**
```bash
# Never use this locally
PRISMA_DATABASE_URL="postgresql://prod-url" npx prisma studio
# This tries to modify production data!

# Instead, use Aurora Query Editor (AWS Console)
# RDS Console → Databases → kokushi-db → Query editor
# Or, create local copy: pg_restore from backup
```

---

## On-Call Runbook

### SLA: 1-hour response time for critical issues

**Critical Issues:**
- Database down (students can't login/answer questions)
- Site returns 502/503 for >10% of users
- Authentication broken

**Process:**
1. Get alerted (AWS SNS email) → Click link → Check Amplify Console
2. Identify issue (see troubleshooting section above)
3. Attempt fix (restart service, rollback, etc.)
4. If can't fix in 30 min → Escalate (contact AWS support)
5. Document what happened (update this runbook)

---

## Reference

- [Next.js Deployment on Amplify](https://docs.aws.amazon.com/amplify/latest/userguide/deploy-nextjs.html)
- [Aurora Serverless v2](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/aurora-serverless.html)
- [NextAuth.js Production Checklist](https://next-auth.js.org/deployment)
- [Prisma Migration Guide](https://www.prisma.io/docs/orm/prisma-migrate)
- [AWS CloudWatch Monitoring](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/GettingStarted.html)
