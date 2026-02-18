# Imagix Documentation

Imagix 是一个基于 AI 的故事生成器。

## 项目结构

- `frontend/` - React + MUI 前端应用
- `backend/` - AWS Lambda 后端 API
- `shared/` - 前后端共享代码（Zod schema、类型定义）
- `docs/` - 项目文档

## 本地开发

### 前置需求

- Bun >= 1.0
- Docker（用于 DynamoDB Local）
- AWS SAM CLI
- AWS CLI（用于 DynamoDB Local 初始化）
- AWS Profile: `AdministratorAccess-914369185440`（已配置于 `backend/samconfig.toml`）

### 安装依赖

```bash
bun install --no-cache
```

### 启动本地环境

1. 启动 DynamoDB Local:

   ```bash
   bun run dev:db
   ```

2. 初始化 DynamoDB 表（新终端）:

   ```bash
   chmod +x scripts/init-dynamodb-local.sh
   ./scripts/init-dynamodb-local.sh
   ```

3. 启动后端 API（新终端）:

   ```bash
   bun run dev:backend
   ```

   API 将在 <http://127.0.0.1:3000>

4. 启动前端（新终端）:

   ```bash
   bun run dev:frontend
   ```

   前端将在 <http://localhost:5173>，API 请求会代理到后端

或一次性启动所有服务：

```bash
bun run dev
```

### 命令速查

| 命令 | 说明 |
|------|------|
| `bun run dev` | 启动完整本地开发环境 |
| `bun run build` | 构建前后端及 shared |
| `bun run test` | 运行所有测试 |
| `bun run typecheck` | TypeScript 类型检查 |
| `bun run format` | Biome 格式化 |
| `bun run lint` | Biome 代码检查 |
| `bun run markdownlint` | Markdown 检查 |

## 部署

部署架构：DynamoDB + Lambda + CloudFront + S3

1. 构建: `bun run build`
2. 部署: `cd backend && sam deploy --guided`（首次需配置）
3. 前端构建产物部署到 S3，通过 CloudFront 分发

## Cognito + Google 登录

配置步骤参见 `docs/cognito-setup.md`。
