# Fly.io 部署详细步骤

## 📋 前置准备

### 1. 确保已安装 flyctl

```bash
# 检查是否已安装
fly version

# 如果未安装，安装 flyctl
brew install flyctl
# 或
curl -L https://fly.io/install.sh | sh
```

### 2. 登录 Fly.io

```bash
fly auth login
```

---

## 🗑️ 步骤 1: 清理旧资源（如果存在）

### 1.1 检查现有资源

```bash
# 查看所有应用
fly apps list

# 查看所有数据库
fly postgres list
```

### 1.2 删除旧应用（如果存在）

```bash
# 删除应用
fly apps destroy sms-admin-system

# 确认删除（输入应用名称）
# 输入: sms-admin-system
```

### 1.3 删除旧数据库（如果存在）

```bash
# 删除数据库
fly postgres destroy sms-admin-system-db

# 确认删除（输入数据库名称）
# 输入: sms-admin-system-db
```

**⚠️ 警告：删除数据库会永久删除所有数据！**

### 1.4 验证删除完成

```bash
# 确认应用已删除
fly apps list

# 确认数据库已删除
fly postgres list
```

---

## 🚀 步骤 2: 创建新应用和数据库

### 2.1 进入项目目录

```bash
cd /Users/choward/sms-admin-system
```

### 2.2 运行 fly launch

```bash
fly launch
```

### 2.3 回答提示问题

**问题 1: 使用现有 fly.toml？**
```
? Would you like to use this fly.toml configuration for this app? (y/N)
```
**答案：** `Y` (Yes)

**问题 2: 是否创建新应用？**
```
? Do you still want to launch a new app? (y/N)
```
**答案：** `N` (No) - 如果应用已存在，选择 No

**问题 3: 调整设置？**
```
? Do you want to tweak these settings before proceeding? (y/N)
```
**答案：** `Y` (Yes) - 需要添加 PostgreSQL

**问题 4: 设置 PostgreSQL？**
```
? Would you like to set up a Postgres database now? (y/N)
```
**答案：** `Y` (Yes)

**问题 5: 选择数据库配置**
```
选择以下之一：
- Development - Single node, 1x shared CPU, 256MB RAM, 1GB disk
- Production (HA) - 3 nodes, 2x shared CPUs, 4GB RAM, 40GB disk  ← 推荐
- Production (HA) - 3 nodes, 4x shared CPUs, 8GB RAM, 80GB disk
```
**答案：** 选择 `Production (HA) - 2x CPUs, 4GB RAM`（第二个选项）

**问题 6: 立即部署？**
```
? Would you like to deploy now? (y/N)
```
**答案：** `N` (No) - 先设置环境变量

---

## 🔐 步骤 3: 设置环境变量（Secrets）

### 3.1 生成 Session Secret

```bash
# 生成随机密钥
openssl rand -base64 32
```

**复制生成的密钥，稍后使用**

### 3.2 设置所有必需的 Secrets

```bash
# 设置 Session Secret（替换 YOUR_SECRET 为上面生成的密钥）
fly secrets set SESSION_SECRET="YOUR_SECRET" --app sms-admin-system

# 设置 Pushbullet API Token
fly secrets set PUSHBULLET_API_TOKEN="o.jOVqvNBAGVP8EdIkn41sgaD8ALy2yyTf" --app sms-admin-system

# 设置 SMS 延迟时间（2.5秒）
fly secrets set SMS_DELAY_MS="2500" --app sms-admin-system
```

### 3.3 验证 Secrets 设置

```bash
# 查看所有 secrets
fly secrets list --app sms-admin-system
```

**应该看到：**
- `DATABASE_URL` (自动设置)
- `SESSION_SECRET`
- `PUSHBULLET_API_TOKEN`
- `SMS_DELAY_MS`

---

## 📦 步骤 4: 部署应用

### 4.1 部署

```bash
fly deploy --app sms-admin-system
```

**部署过程会：**
1. 构建 Docker 镜像
2. 运行数据库迁移（自动）
3. 启动应用

### 4.2 查看部署日志

```bash
# 实时查看日志
fly logs --app sms-admin-system

# 查看最近 100 条日志
fly logs --app sms-admin-system --limit 100
```

**查找成功信息：**
- `Server running on http://localhost:8080`
- `Execution engine initialized`
- `Prisma migrate deploy` 成功

### 4.3 检查应用状态

```bash
# 查看应用状态
fly status --app sms-admin-system

# 查看机器状态
fly machines list --app sms-admin-system
```

---

## 👤 步骤 5: 创建管理员账户

### 5.1 SSH 到实例

```bash
fly ssh console --app sms-admin-system
```

### 5.2 在 SSH 会话中创建管理员

```bash
# 进入应用目录
cd /app

# 创建管理员账户
npm run create-admin

# 输入用户名（例如：admin）
# 输入密码（例如：your-secure-password）
# 确认密码
```

### 5.3 退出 SSH

```bash
exit
```

---

## 🌐 步骤 6: 访问应用

### 6.1 打开应用

```bash
# 方法 1: 使用 fly 命令
fly open --app sms-admin-system

# 方法 2: 直接访问
# https://sms-admin-system.fly.dev
```

### 6.2 登录

1. 访问：`https://sms-admin-system.fly.dev`
2. 系统会自动重定向到登录页面
3. 使用步骤 5 创建的管理员账户登录

---

## ✅ 验证清单

部署完成后，检查以下项目：

- [ ] 应用可以通过 HTTPS 访问
- [ ] 可以访问登录页面
- [ ] 可以使用管理员账户登录
- [ ] 可以访问任务列表页面
- [ ] 可以创建新任务
- [ ] 日志显示 "Execution engine initialized"
- [ ] 数据库迁移成功完成

---

## 🔧 故障排查

### 问题 1: 503 错误

```bash
# 查看日志找出问题
fly logs --app sms-admin-system

# 检查环境变量
fly secrets list --app sms-admin-system

# 检查数据库连接
fly postgres list
```

### 问题 2: 数据库连接失败

```bash
# 检查数据库是否附加
fly postgres list

# 如果数据库存在但未附加
fly postgres attach your-db-name --app sms-admin-system
```

### 问题 3: 迁移失败

```bash
# SSH 到实例手动运行迁移
fly ssh console --app sms-admin-system
cd /app
npx prisma migrate deploy
exit
```

### 问题 4: 应用无法启动

```bash
# 查看详细日志
fly logs --app sms-admin-system --limit 200

# 重启应用
fly apps restart sms-admin-system

# 重新部署
fly deploy --app sms-admin-system
```

---

## 📝 常用命令

```bash
# 查看日志
fly logs --app sms-admin-system

# 查看状态
fly status --app sms-admin-system

# SSH 到实例
fly ssh console --app sms-admin-system

# 重启应用
fly apps restart sms-admin-system

# 查看环境变量
fly secrets list --app sms-admin-system

# 更新环境变量
fly secrets set KEY=value --app sms-admin-system

# 连接数据库
fly postgres connect -a your-db-app-name

# 查看指标
fly metrics --app sms-admin-system
```

---

## 🎯 快速参考

### 完整命令序列（一键复制）

```bash
# 1. 清理（如果需要）
fly apps destroy sms-admin-system
fly postgres destroy sms-admin-system-db

# 2. 创建应用和数据库
cd /Users/choward/sms-admin-system
fly launch
# 回答提示：Y, N, Y, Y, 选择 Production HA 2x CPUs, N

# 3. 设置环境变量
openssl rand -base64 32  # 复制生成的密钥
fly secrets set SESSION_SECRET="生成的密钥" --app sms-admin-system
fly secrets set PUSHBULLET_API_TOKEN="o.jOVqvNBAGVP8EdIkn41sgaD8ALy2yyTf" --app sms-admin-system
fly secrets set SMS_DELAY_MS="2500" --app sms-admin-system

# 4. 部署
fly deploy --app sms-admin-system

# 5. 创建管理员
fly ssh console --app sms-admin-system
npm run create-admin
exit

# 6. 访问
fly open --app sms-admin-system
```

---

## 📞 需要帮助？

如果遇到问题：
1. 查看日志：`fly logs --app sms-admin-system`
2. 检查状态：`fly status --app sms-admin-system`
3. SSH 调试：`fly ssh console --app sms-admin-system`
