# 重置数据库指南

## 完全重置数据库（删除所有数据并重新创建）

### ⚠️ 警告
此操作将**删除所有数据**，包括：
- 所有 Admin 账户
- 所有 Task
- 所有 Contact
- 所有 TaskExecutionLog

### 执行步骤

```bash
# 1. 重置数据库（删除所有数据并重新运行迁移）
npm run prisma:reset

# 2. 重新生成 Prisma Client
npm run prisma:generate

# 3. 创建第一个管理员账户
npm run create-admin
```

### 或者手动执行

```bash
# 方式 1: 使用 Prisma Reset（推荐）
npx prisma migrate reset

# 方式 2: 手动删除并重新迁移
# 删除所有表
npx prisma migrate reset --force

# 重新运行迁移
npx prisma migrate dev

# 生成 Prisma Client
npx prisma generate
```

### 验证

重置后，数据库应该是全新的，只包含表结构，没有任何数据。
