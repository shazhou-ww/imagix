import { Amplify } from "aws-amplify";

const {
  IMAGIX_USER_POOL_ID,
  IMAGIX_USER_POOL_CLIENT_ID,
  IMAGIX_COGNITO_DOMAIN,
  IMAGIX_REDIRECT_SIGN_IN,
  IMAGIX_REDIRECT_SIGN_OUT,
} = import.meta.env;
const userPoolId = IMAGIX_USER_POOL_ID;
const userPoolClientId = IMAGIX_USER_POOL_CLIENT_ID;
const cognitoDomain = IMAGIX_COGNITO_DOMAIN;
const redirectSignIn =
  IMAGIX_REDIRECT_SIGN_IN ?? "http://localhost:5173/callback";
const redirectSignOut = IMAGIX_REDIRECT_SIGN_OUT ?? "http://localhost:5173";

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
