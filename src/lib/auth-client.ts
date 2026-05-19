import { createAuthClient } from "better-auth/react";
import {
  convexClient,
  crossDomainClient,
} from "@convex-dev/better-auth/client/plugins";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string;
const siteUrl =
  (import.meta.env.VITE_CONVEX_SITE_URL as string | undefined) ??
  convexUrl.replace(/\.convex\.cloud$/, ".convex.site");

export const authClient = createAuthClient({
  baseURL: siteUrl,
  plugins: [convexClient(), crossDomainClient()],
});
