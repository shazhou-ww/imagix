import { api } from "./api";
import { auth } from "./auth";

export const frontend = new sst.aws.StaticSite("ImagixFrontend", {
  path: "frontend",
  build: {
    command: "bun run build",
    output: "dist",
  },
  environment: {
    IMAGIX_USER_POOL_ID: auth.userPool.id,
    IMAGIX_USER_POOL_CLIENT_ID: auth.userPoolClient.id,
    IMAGIX_COGNITO_DOMAIN: auth.cognitoDomain,
    IMAGIX_API_URL: api.url,
  },
  ...(($app.stage === "prod") && {
    domain: "imagix.shazhou.me",
  }),
});
