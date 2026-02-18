# Cognito + Google 登录配置

## 1. 创建 Cognito User Pool

1. 在 AWS Console 打开 Cognito
2. 创建用户池，选择 "Federated identity provider sign-in"
3. 添加 Google 作为身份提供商

## 2. 配置 Google OAuth

1. 在 [Google Cloud Console](https://console.cloud.google.com/) 创建 OAuth 2.0 凭据
2. 添加授权重定向 URI: `https://<your-cognito-domain>.auth.<region>.amazoncognito.com/oauth2/idpresponse`
3. 将 Client ID 和 Client Secret 填入 Cognito 的 Google 提供商配置

## 3. 配置 Cognito App Client

1. 在 User Pool 中创建 App Client
2. 启用 "Cognito User Pool" 和 "Federated sign-in"
3. 配置回调 URL（如 `http://localhost:5173/callback`）
4. 启用 Hosted UI（可选）

## 4. 前端集成

使用 AWS Amplify 配置：

```typescript
import { Amplify } from "aws-amplify";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: "us-east-1_xxx",
      userPoolClientId: "xxx",
      identityPoolId: "us-east-1:xxx", // 可选
      loginWith: {
        oauth: {
          domain: "xxx.auth.us-east-1.amazoncognito.com",
          scopes: ["openid", "email", "profile"],
          redirectSignIn: ["http://localhost:5173/callback"],
          redirectSignOut: ["http://localhost:5173"],
          responseType: "code",
          providers: ["Google"],
        },
      },
    },
  },
});
```

## 5. 部署时传入参数

```bash
sam deploy --parameter-overrides \
  CognitoUserPoolId=us-east-1_xxx \
  CognitoClientId=xxx
```
