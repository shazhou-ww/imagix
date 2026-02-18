# Imagix - AI Story Generator

基于 Bun 的全栈 AI 故事生成器项目。

## 技术栈

- **前端**: React + MUI + Vite
- **后端**: AWS Lambda (SAM)
- **数据库**: DynamoDB
- **部署**: DynamoDB + Lambda + CloudFront + S3
- **本地开发**: Docker DynamoDB + SAM + Vite Dev Server
- **认证**: Cognito + Google 登录

## 快速开始

```bash
# 安装依赖
bun install --no-cache

# 启动 DynamoDB (Docker)
bun run dev:db

# 另一终端：初始化表并启动后端
./scripts/init-dynamodb-local.sh
bun run dev:backend

# 另一终端：启动前端
bun run dev:frontend
```

## 目录结构

```text
imagix/
├── frontend/     # React + MUI 前端
├── backend/      # AWS Lambda 后端
├── shared/       # 共享代码 (Zod protocol)
├── docs/         # 文档
└── scripts/      # 构建脚本
```

## 开发命令

| 命令 | 说明 |
|------|------|
| `bun run dev` | 同时启动 DB + 后端 + 前端 |
| `bun run build` | 构建全部 |
| `bun run test` | 运行 Vitest 测试 |
| `bun run typecheck` | `tsc --noEmit` 类型检查 |
| `bun run format` | Biome 格式化 |
| `bun run lint` | Biome 检查 |
| `bun run markdownlint` | Markdown 检查 |

## API Protocol

前后端 API 使用 Zod 定义 schema，位于 `shared/protocol/`：

- `auth.ts` - 登录/认证
- `story.ts` - 故事生成相关

## 文档

详见 [docs/README.md](docs/README.md)。
