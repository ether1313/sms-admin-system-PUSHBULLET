# Fly.io Deployment Guide

Complete guide for deploying SMS Admin System to Fly.io.

## Prerequisites

1. Install flyctl:
   ```bash
   brew install flyctl
   # or
   curl -L https://fly.io/install.sh | sh
   ```

2. Login to Fly.io:
   ```bash
   fly auth login
   ```

## Step-by-Step Deployment

### Step 1: Create Application and Database

```bash
# Navigate to project directory
cd /path/to/sms-admin-system

# Launch the app (this will create the app and optionally PostgreSQL)
fly launch

# When prompted:
# - App name: sms-admin-system (or your preferred name)
# - Region: Choose closest to you (e.g., iad, sjc, dfw)
# - PostgreSQL: Yes (create a new database)
# - Deploy now: No (we'll set secrets first)
```

### Step 2: Set Environment Variables (Secrets)

**重要：** 部署到 Fly.io 时，**不会**使用项目里的 `.env` 文件（通常也不会上传）。所有环境变量都要在 Fly 上单独配置：

- **敏感/必填**：用 `fly secrets set` 设置（推荐）
- **非敏感/可选**：可在 `fly.toml` 的 `[env]` 里写（如 `NODE_ENV`、`PORT` 已写）

```bash
# 生成随机 session 密钥，例如：openssl rand -base64 32

# 必填：Session 密钥（Cookie、Session 加密）
fly secrets set SESSION_SECRET="your-random-secret-key-here"

# 若任务未选机器，会 fallback 到 env 的 Pushbullet（可选）
fly secrets set PUSHBULLET_API_TOKEN="your-pushbullet-api-token"
fly secrets set PUSHBULLET_DEVICE_IDEN="your-phone-device-iden"

# 可选：风控相关（不设则用代码默认值）
# fly secrets set SMS_DELAY_MS="1000"
# fly secrets set SMS_DELAY_JITTER_MS="2000"
# fly secrets set SMS_MAX_RETRIES="2"
# fly secrets set SMS_RATE_LIMIT_PER_MINUTE="10"

# 验证
fly secrets list
```

**说明：** `DATABASE_URL` 在通过 `fly postgres attach` 挂载数据库时会**自动**写入，一般不用手动 set。

**本地开发：** 本地用 `.env` 和 `.env.example` 即可；Fly 部署只认 Fly 的 secrets 和 `fly.toml` 里的 `[env]`。

### Step 3: Attach PostgreSQL Database (if not done in Step 1)

If you created the database separately:

```bash
# List your PostgreSQL databases
fly postgres list

# Attach database to your app
fly postgres attach --app sms-admin-system your-db-name
```

This automatically sets the `DATABASE_URL` secret.

### Step 4: Deploy the Application

```bash
# Deploy to Fly.io
fly deploy

# The deployment will:
# 1. Build the Docker image
# 2. Run database migrations automatically (via Dockerfile CMD)
# 3. Start the application
```

### Step 5: Verify Deployment

```bash
# Check app status
fly status

# View logs
fly logs

# Open the app in browser
fly open
```

### Step 6: Create Admin Account

```bash
# SSH into the running instance
fly ssh console

# Inside the SSH session:
cd /app
npm run create-admin

# Enter username and password when prompted
# Exit when done
exit
```

### Step 7: Access Your Application

```bash
# Get your app URL
fly status

# Or open directly
fly open
```

Visit: `https://your-app-name.fly.dev`

## Useful Commands

### View Logs
```bash
fly logs
fly logs --app sms-admin-system
```

### SSH into Instance
```bash
fly ssh console
```

### Restart Application
```bash
fly apps restart sms-admin-system
```

### Scale Application
```bash
# View current scale
fly scale show

# Scale to specific number of instances
fly scale count 1
```

### Update Secrets
```bash
fly secrets set KEY=value
fly secrets unset KEY
fly secrets list
```

### Database Management
```bash
# Connect to PostgreSQL
fly postgres connect -a your-db-app-name

# View database info
fly postgres list

# Create database backup
fly postgres backup create -a your-db-app-name
```

### View Metrics
```bash
fly metrics
```

## Troubleshooting

### Application Won't Start

1. Check logs:
   ```bash
   fly logs
   ```

2. SSH and check manually:
   ```bash
   fly ssh console
   cd /app
   ls -la
   node dist/server.js
   ```

### Database Connection Issues

1. Verify DATABASE_URL is set:
   ```bash
   fly secrets list
   ```

2. Test database connection:
   ```bash
   fly postgres connect -a your-db-app-name
   ```

### Migration Issues

1. Run migrations manually:
   ```bash
   fly ssh console
   cd /app
   npx prisma migrate deploy
   ```

2. Check Prisma status:
   ```bash
   fly ssh console
   cd /app
   npx prisma migrate status
   ```

### Execution Engine Not Running

Ensure `min_machines_running = 1` in `fly.toml`:
```toml
[http_service]
  min_machines_running = 1
```

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (auto-set by Fly.io) |
| `SESSION_SECRET` | Yes | Random secret for session encryption |
| `PUSHBULLET_API_TOKEN` | Yes | Your Pushbullet API token |
| `PUSHBULLET_DEVICE_IDEN` | Yes | Device iden of the phone that sends SMS (from Pushbullet devices API) |
| `SMS_DELAY_MS` | No | Delay between SMS sends (default: 2500ms) |
| `NODE_ENV` | No | Set to "production" (default in fly.toml) |
| `PORT` | No | Server port (default: 8080) |

## Post-Deployment Checklist

- [ ] Application is accessible via HTTPS
- [ ] Database migrations completed successfully
- [ ] Admin account created
- [ ] Can login to admin console
- [ ] Can create a test task
- [ ] Execution engine is running (check logs)
- [ ] Pushbullet SMS Texting integration is working (messages appear in Pushbullet and send from your phone)

## Updating the Application

After making code changes:

```bash
# Build and deploy
fly deploy

# Or deploy with specific version
fly deploy --image your-image-name
```

### Updating after adding the multi-machine (sender machines) feature

If you already had the app deployed and have now added the sender machines feature, do this once after deploying:

**1. Deploy the new version** (runs migrations on startup; creates `SenderMachine` and `TaskMachine` tables):

```bash
fly deploy --app sms-admin-system
```

**2. Seed sender machines** (adds SIM 1–SIM 10 that don’t exist yet; skips ones you already have):

```bash
fly ssh console --app sms-admin-system
cd /app
npx prisma db seed
exit
```

**3. Configure the 6 machines** (fill each machine’s Pushbullet API token and device iden):

- Open Prisma Studio on Fly (see [Viewing the database](#viewing-the-database-prisma-studio-on-flyio) below): in one terminal run `fly ssh console`, then `cd /app` and `npx prisma studio --browser none`; in another run `fly proxy 5555:5555 --app sms-admin-system`; open **http://localhost:5555**.
- In Prisma Studio, open the **SenderMachine** table.
- For each of **SIM 1** … **SIM 10**, set:
  - **apiToken**: that machine’s Pushbullet API token
  - **deviceIden**: that machine’s device iden (from `GET https://api.pushbullet.com/v2/devices` with that token)

After this, when creating a task you can select one or more machines; contacts are split across the selected machines.

## Viewing the database (Prisma Studio on Fly.io)

To browse and edit data in the deployed database using Prisma Studio:

**Terminal 1 – start Prisma Studio inside the app container:**

```bash
fly ssh console --app sms-admin-system
cd /app
npx prisma studio --browser none
```

Leave this running. Prisma Studio listens on port 5555 inside the container.

**Terminal 2 – proxy that port to your machine:**

```bash
fly proxy 5555:5555 --app sms-admin-system
```

Then open in your browser: **http://localhost:5555**

- The app container has `DATABASE_URL` from Fly secrets, so Prisma Studio connects to your Fly Postgres automatically.
- When done, stop Prisma Studio in Terminal 1 (Ctrl+C) and stop the proxy in Terminal 2 (Ctrl+C).

**Alternative (local Prisma Studio):** If you have the production `DATABASE_URL` (e.g. from Fly Postgres dashboard or `fly postgres connect`), you can run Prisma Studio locally: `DATABASE_URL="postgres://..." npx prisma studio` and connect directly to the remote database from your machine.

## Monitoring

- View real-time logs: `fly logs`
- Check app metrics: `fly metrics`
- Monitor database: `fly postgres monitor -a your-db-app-name`

## Support

For issues:
1. Check logs: `fly logs`
2. SSH and debug: `fly ssh console`
3. Check Fly.io status: https://status.fly.io
