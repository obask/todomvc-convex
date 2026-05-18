import { render } from "@solidjs/web";
import { ConvexClient } from "convex/browser";
import "./index.css";
import App from "./App";
import { ConvexAuthProvider } from "./auth/solid";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

if (!convexUrl) {
  throw new Error("Missing VITE_CONVEX_URL");
}

const convex = new ConvexClient(convexUrl);

render(
  () => (
    <ConvexAuthProvider client={convex}>
      <App />
    </ConvexAuthProvider>
  ),
  document.getElementById("root")!,
);
