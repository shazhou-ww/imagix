# 发布到 imagix.shazhou.me

将 Imagix 前端发布到子域名 **imagix.shazhou.me**（S3 + CloudFront），API 通过同一域名的 `/api` 走 CloudFront 转发到 Lambda。

## 前置条件

- 后端已部署（`bun run build:backend` + `cd backend && sam deploy`）
- 拥有 shazhou.me 的 DNS 管理权限（用于添加 CNAME 与 ACM 校验）

## 一、申请 ACM 证书（us-east-1）

1. 打开 [AWS Certificate Manager (ACM)](https://us-east-1.console.aws.amazon.com/acm/home?region=us-east-1#/certificates)，区域选 **美国东部 (弗吉尼亚北部) us-east-1**。
2. 请求证书：
   - 域名：`imagix.shazhou.me`
   - 验证方式：DNS 验证
3. 在 ACM 控制台会给出一条 CNAME 记录，到 shazhou.me 的 DNS 里添加该 CNAME，等待状态变为「已颁发」。

## 二、部署前端基础设施（仅首次）

在项目根目录执行（把 `AcmCertificateArn` 换成上一步的证书 ARN，`ApiEndpoint` 换成后端 API 的 host，不含 `https://` 和路径）：

```bash
aws cloudformation deploy \
  --template-file infra/frontend-hosting.yaml \
  --stack-name imagix-frontend \
  --parameter-overrides \
    DomainName=imagix.shazhou.me \
    AcmCertificateArn=arn:aws:acm:us-east-1:YOUR_ACCOUNT:certificate/YOUR_CERT_ID \
    ApiEndpoint=YOUR_API_ID.execute-api.us-east-1.amazonaws.com \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1 \
  --profile AdministratorAccess-914369185440
```

`ApiEndpoint` 可从后端栈输出获取：

```bash
aws cloudformation describe-stacks --stack-name imagix --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text --region us-east-1
```

得到类似 `https://abc123.execute-api.us-east-1.amazonaws.com/prod`，则 ApiEndpoint 填：`abc123.execute-api.us-east-1.amazonaws.com`。

部署完成后记下输出中的 **CloudFrontDomainName**（如 `d1234abcd.cloudfront.net`）。

## 三、配置 DNS

在 shazhou.me 的 DNS 中为子域名添加 CNAME：

- **名称**：`imagix`（或 `imagix.shazhou.me`，视你的 DNS 提供商而定）
- **类型**：CNAME
- **值**：上一步的 CloudFront 域名（如 `d1234abcd.cloudfront.net`）

生效后可通过 https://imagix.shazhou.me 访问（需先完成第四步上传前端）。

## 四、更新 Cognito 回调 URL

在 Cognito 用户池中，为当前使用的 App Client 增加生产环境回调与登出 URL：

- **Callback URL**：`https://imagix.shazhou.me/callback`
- **Sign out URL**：`https://imagix.shazhou.me`

（与本地开发用的 localhost URL 一起保留即可。）

## 五、构建并发布前端

在项目根目录执行：

```bash
bun run deploy:frontend
```

该命令会：构建前端 → 上传到 S3 → 使 CloudFront 缓存失效。完成后访问 https://imagix.shazhou.me 即可使用。

## 后续更新

- 仅改前端：执行 `bun run deploy:frontend`。
- 仅改后端：执行 `cd backend && sam build && sam deploy`；若 API 的 host 变了，需更新 CloudFormation 参数并更新栈（见第二步），或保持 ApiEndpoint 不变则无需改 infra。

## 架构简述

- **imagix.shazhou.me** → CloudFront
  - 默认 → S3（前端静态资源）
  - `/api/*` → API Gateway（Lambda）
- 前端与 API 同域，无需额外 CORS 配置；Cognito 回调使用 `https://imagix.shazhou.me/callback`。
