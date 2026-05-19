import type { AuthConfig } from "convex/server";
import { authConfigProvider } from "./simpleAuth/authConfig";

export default {
  providers: [authConfigProvider()],
} satisfies AuthConfig;
