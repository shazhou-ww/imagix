import { api } from "./api";
import { auth } from "./auth";

// Extract API Gateway domain from URL (e.g. "https://xxx.execute-api.us-east-1.amazonaws.com" → "xxx.execute-api.us-east-1.amazonaws.com")
const apiDomain = api.url.apply((url) =>
  url.replace("https://", "").replace(/\/$/, ""),
);

// Shared cache behavior config for API-proxied paths (MCP + OAuth discovery)
const apiBehavior = {
  targetOriginId: "apigateway",
  viewerProtocolPolicy: "redirect-to-https" as const,
  allowedMethods: [
    "DELETE",
    "GET",
    "HEAD",
    "OPTIONS",
    "PATCH",
    "POST",
    "PUT",
  ],
  cachedMethods: ["GET", "HEAD"],
  compress: true,
  // AWS managed policies
  cachePolicyId: "4135ea2d-6df8-44a3-9df3-4b5a84be39ad", // CachingDisabled
  originRequestPolicyId: "b689b0a8-53d0-40ab-baf2-68738e2966ac", // AllViewerExceptHostHeader
};

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
  ...($app.stage === "prod" && {
    domain: "imagix.shazhou.me",
  }),
  transform: {
    cdn: (args) => {
      // Add API Gateway as an additional origin
      args.origins = $resolve(args.origins!).apply((origins) => [
        ...origins,
        {
          originId: "apigateway",
          domainName: apiDomain,
          customOriginConfig: {
            httpPort: 80,
            httpsPort: 443,
            originProtocolPolicy: "https-only",
            originReadTimeout: 30,
            originSslProtocols: ["TLSv1.2"],
          },
        },
      ]);

      // Forward /api/*, /mcp, /mcp/*, and /.well-known/* to API Gateway
      args.orderedCacheBehaviors = [
        { ...apiBehavior, pathPattern: "/api/*" },
        { ...apiBehavior, pathPattern: "/mcp" },
        { ...apiBehavior, pathPattern: "/mcp/*" },
        { ...apiBehavior, pathPattern: "/.well-known/*" },
      ];
    },
  },
});
