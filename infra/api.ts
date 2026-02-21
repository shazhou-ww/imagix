import { auth } from "./auth";
import { database } from "./database";

export const api = new sst.aws.ApiGatewayV2("ImagixApi", {
  cors: {
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    allowOrigins: ["*"],
  },
});

api.route("$default", {
  handler: "backend/src/index.handler",
  runtime: "nodejs20.x",
  memory: "256 MB",
  timeout: "30 seconds",
  link: [database],
  environment: {
    COGNITO_USER_POOL_ID: auth.userPool.id,
    COGNITO_CLIENT_ID: auth.userPoolClient.id,
    COGNITO_DOMAIN: auth.cognitoDomain,
    ...($app.stage === "prod" && {
      MCP_PUBLIC_ORIGIN: "https://imagix.shazhou.me",
    }),
  },
  nodejs: {
    esbuild: {
      external: ["@aws-sdk/*"],
    },
  },
});
