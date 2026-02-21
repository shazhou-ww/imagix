import { Amplify } from "aws-amplify";

const {
  IMAGIX_USER_POOL_ID,
  IMAGIX_USER_POOL_CLIENT_ID,
  IMAGIX_COGNITO_DOMAIN,
} = import.meta.env;
const userPoolId = IMAGIX_USER_POOL_ID;
const userPoolClientId = IMAGIX_USER_POOL_CLIENT_ID;
const cognitoDomain = IMAGIX_COGNITO_DOMAIN;

// 自动使用当前 origin，避免本地开发与生产 redirect 不一致
const origin = window.location.origin;
const redirectSignIn = `${origin}/callback`;
const redirectSignOut = origin;

export function configureAmplify() {
  if (!userPoolId || !userPoolClientId || !cognitoDomain) {
    console.warn(
      "[Amplify] Missing env: IMAGIX_USER_POOL_ID, IMAGIX_USER_POOL_CLIENT_ID, IMAGIX_COGNITO_DOMAIN. Google login disabled.",
    );
    return false;
  }

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
        loginWith: {
          oauth: {
            domain: cognitoDomain,
            scopes: ["openid", "email", "profile"],
            redirectSignIn: [redirectSignIn],
            redirectSignOut: [redirectSignOut],
            responseType: "code",
            providers: ["Google"],
          },
        },
      },
    },
  });
  return true;
}
