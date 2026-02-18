/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly IMAGIX_USER_POOL_ID?: string;
  readonly IMAGIX_USER_POOL_CLIENT_ID?: string;
  readonly IMAGIX_COGNITO_DOMAIN?: string;
  readonly IMAGIX_REDIRECT_SIGN_IN?: string;
  readonly IMAGIX_REDIRECT_SIGN_OUT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
