/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "imagix",
      removal: input?.stage === "prod" ? "retain" : "remove",
      home: "aws",
      providers: {
        aws: {
          region: "us-east-1",
          profile:
            input?.stage === "prod"
              ? "AdministratorAccess-914369185440"
              : undefined,
        },
      },
    };
  },
  async run() {
    await import("./infra/database");
    const { auth } = await import("./infra/auth");
    const { api } = await import("./infra/api");
    const { frontend } = await import("./infra/frontend");

    return {
      api: api.url,
      frontend: frontend.url,
      userPoolId: auth.userPool.id,
      userPoolClientId: auth.userPoolClient.id,
    };
  },
});
