# Cognito + Google 登录配置

## 方式一：用脚本创建（推荐）

使用项目内 TypeScript 脚本（Bun 运行，跨平台）创建 User Pool、App Client、Domain，并自动写入**根目录 `.env`**。脚本从根目录 `.env` 读取配置（如 `AWS_PROFILE`、`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET` 等）。

### 1. 创建 User Pool 并写入 .env

在项目根目录执行（会读取根目录 `.env`）：

```bash
bun run cognito:setup
```

会创建：

- Cognito User Pool（名称 `imagix-user-pool`）
- Hosted UI 域名（如 `imagix-auth.auth.us-east-1.amazoncognito.com`）
- App Client（OAuth code flow，callback/logout URL 使用 `.env` 中的 `REDIRECT_SIGN_IN` / `REDIRECT_SIGN_OUT`）

并将 `IMAGIX_USER_POOL_ID`、`IMAGIX_USER_POOL_CLIENT_ID`、`IMAGIX_COGNITO_DOMAIN` 等写入**根目录 `.env`**。

根目录 `.env` / `.env.example` 中相关变量（前端仅能读取 `IMAGIX_*`，Vite 安全限制）：

| 变量 | 说明 |
|------|------|
| `AWS_PROFILE` | AWS 配置 profile（脚本与 SAM 使用） |
| `IMAGIX_USER_POOL_ID` / `IMAGIX_USER_POOL_CLIENT_ID` / `IMAGIX_COGNITO_DOMAIN` | Cognito（前端 + 脚本） |
| `IMAGIX_REDIRECT_SIGN_IN` / `IMAGIX_REDIRECT_SIGN_OUT` | 回调与登出 URL |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth（仅脚本使用，勿暴露到前端） |

### 2. 配置 Google 登录（需要 Google OAuth 凭据）

Google 登录需要先在 Google Cloud Console 创建 OAuth 2.0 凭据，再在 Cognito 里配置。

**2.1 在 Google Cloud Console**

1. 打开 [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials。
2. 创建 OAuth 2.0 Client ID（类型选 “Web application”）。
3. 在 “Authorized redirect URIs” 中添加（把 `COGNITO_DOMAIN` 换成你脚本输出或 `frontend/.env` 里的值）：
   - `https://<COGNITO_DOMAIN>/oauth2/idpresponse`  
   例如：`https://imagix-auth.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`
4. 在根目录 `.env` 中填写 `GOOGLE_CLIENT_ID` 和 `GOOGLE_CLIENT_SECRET`。

**2.2 在项目中添加 Google 身份提供商**

在**已有 User Pool** 上添加 Google IdP 并更新 App Client（不重复创建 Pool）。在项目根目录执行（会读取根目录 `.env`）：

```bash
bun run cognito:add-google
```

脚本会从根目录 `.env` 读取 `USER_POOL_ID`、`USER_POOL_CLIENT_ID`、`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`，创建 Google Identity Provider，并把 App Client 的 Supported identity providers 中加入 Google。

完成后前端即可使用「Sign in with Google」。

---

## 方式二：在 AWS Console 手动创建

1. 在 AWS Console 打开 Cognito，创建用户池，选择 “Federated identity provider sign-in”，并添加 Google 身份提供商（需填入 Google Client ID / Client Secret）。
2. 创建 App Client，启用 Hosted UI，配置 Callback URL 与 Sign out URL。
3. 将 `USER_POOL_ID`、`USER_POOL_CLIENT_ID`、`COGNITO_DOMAIN` 等填入根目录 `.env`（格式见根目录 `.env.example`）。

---

## 部署时传入参数

```bash
sam deploy --parameter-overrides \
  CognitoUserPoolId=us-east-1_xxx \
  CognitoClientId=xxx
```
