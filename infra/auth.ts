const googleClientId = new sst.Secret("GoogleClientId");
const googleClientSecret = new sst.Secret("GoogleClientSecret");

export const auth = (() => {
  const userPool = new sst.aws.CognitoUserPool("ImagixUserPool", {
    usernames: ["email"],
    transform: {
      userPool: {
        schemas: [
          { name: "email", required: true, mutable: true, attributeDataType: "String" },
          { name: "name", required: false, mutable: true, attributeDataType: "String" },
        ],
        autoVerifiedAttributes: ["email"],
      },
    },
  });

  const identityProvider =
    new aws.cognito.IdentityProvider("ImagixGoogleIdP", {
      userPoolId: userPool.id,
      providerName: "Google",
      providerType: "Google",
      providerDetails: {
        client_id: googleClientId.value,
        client_secret: googleClientSecret.value,
        authorize_scopes: "openid email profile",
      },
      attributeMapping: {
        email: "email",
        username: "sub",
      },
    });

  const domain = new aws.cognito.UserPoolDomain("ImagixCognitoDomain", {
    userPoolId: userPool.id,
    domain: `imagix-auth-${$app.stage}`,
  });

  const callbackUrls =
    $app.stage === "prod"
      ? ["https://imagix.shazhou.me/callback", "https://api.imagix.shazhou.me/mcp/oauth/callback"]
      : ["http://localhost:4510/callback", "http://localhost:4511/mcp/oauth/callback"];
  const logoutUrls =
    $app.stage === "prod"
      ? ["https://imagix.shazhou.me"]
      : ["http://localhost:4510"];

  const userPoolClient = userPool.addClient("ImagixWebClient", {
    transform: {
      client: (args, opts) => {
        args.name = "imagix-web";
        args.generateSecret = false;
        args.allowedOauthFlowsUserPoolClient = true;
        args.allowedOauthFlows = ["code"];
        args.allowedOauthScopes = ["openid", "email", "profile"];
        args.callbackUrls = callbackUrls;
        args.logoutUrls = logoutUrls;
        args.supportedIdentityProviders = ["Google"];
        opts.dependsOn = [identityProvider];
      },
    },
  });

  const cognitoDomain = $interpolate`${domain.domain}.auth.us-east-1.amazoncognito.com`;

  return { userPool, userPoolClient, identityProvider, domain, cognitoDomain };
})();
