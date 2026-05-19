import {
  Accessor,
  Show,
  createContext,
  createEffect,
  createSignal,
  onCleanup,
  useContext,
} from "solid-js";
import type { JSX } from "@solidjs/web";
import type { ConvexClient } from "convex/browser";
import type { Value } from "convex/values";
import { ConvexProvider } from "convex-solidjs";
import { subscribe, tokenStore } from "convex-simple-auth/token-store";
import { api } from "../../convex/_generated/api";

type AuthActions = {
  signIn(
    this: void,
    provider: "password" | "anonymous",
    params?: FormData | Record<string, Value>,
  ): Promise<{ signingIn: boolean }>;
  signOut(this: void): Promise<void>;
};

type AuthState = {
  isLoading: Accessor<boolean>;
  isAuthenticated: Accessor<boolean>;
};

const AuthActionsContext = createContext<AuthActions>();
const AuthStateContext = createContext<AuthState>();
const AuthTokenContext = createContext<Accessor<string | null>>();

export function ConvexAuthProvider(props: {
  client: ConvexClient;
  children: JSX.Element;
}) {
  const client = props.client;
  const [token, setToken] = createSignal(tokenStore.get());
  const [serverAuthed, setServerAuthed] = createSignal(false, {
    ownedWrite: true,
  });
  const unsubscribe = subscribe(() => setToken(tokenStore.get()));
  onCleanup(unsubscribe);

  const fetchAccessToken = async () => tokenStore.get();

  createEffect(
    () => token(),
    (currentToken) => {
      if (currentToken === null) {
        setServerAuthed(false);
        client.setAuth(async () => null);
        return;
      }
      setServerAuthed(false);
      client.setAuth(fetchAccessToken, setServerAuthed);
    },
  );

  const setAuthToken = (nextToken: string) => {
    tokenStore.set(nextToken);
  };

  const state: AuthState = {
    isLoading: () => token() !== null && !serverAuthed(),
    isAuthenticated: () => serverAuthed(),
  };

  const signIn: AuthActions["signIn"] = async (provider, params) => {
    if (provider === "anonymous") {
      setAuthToken(await client.action(api.auth.signInAnonymous, {}));
      return { signingIn: true };
    }

    const args =
      params instanceof FormData
        ? Object.fromEntries(params.entries())
        : (params ?? {});
    const email = typeof args.email === "string" ? args.email : "";
    const password = typeof args.password === "string" ? args.password : "";
    const flow = args.flow === "signIn" ? "signIn" : "signUp";
    const action = flow === "signIn" ? api.auth.signIn : api.auth.signUp;
    setAuthToken(await client.action(action, { email, password }));
    return { signingIn: true };
  };

  const signOut: AuthActions["signOut"] = async () => {
    tokenStore.clear();
    setServerAuthed(false);
    client.setAuth(async () => null);
  };

  return (
    <ConvexProvider client={client}>
      <AuthStateContext value={state}>
        <AuthActionsContext value={{ signIn, signOut }}>
          <AuthTokenContext value={token}>{props.children}</AuthTokenContext>
        </AuthActionsContext>
      </AuthStateContext>
    </ConvexProvider>
  );
}

export function useConvexAuth(): AuthState {
  const state = useContext(AuthStateContext);
  if (!state) throw new Error("Missing ConvexAuthProvider");
  return state;
}

export function useAuthActions(): AuthActions {
  const actions = useContext(AuthActionsContext);
  if (!actions) throw new Error("Missing ConvexAuthProvider");
  return actions;
}

export function useAuthToken(): Accessor<string | null> {
  const token = useContext(AuthTokenContext);
  if (!token) throw new Error("Missing ConvexAuthProvider");
  return token;
}

export function Authenticated(props: { children: JSX.Element }) {
  const auth = useConvexAuth();
  return (
    <Show when={!auth.isLoading() && auth.isAuthenticated()}>
      {props.children}
    </Show>
  );
}

export function Unauthenticated(props: { children: JSX.Element }) {
  const auth = useConvexAuth();
  return (
    <Show when={!auth.isLoading() && !auth.isAuthenticated()}>
      {props.children}
    </Show>
  );
}

export function AuthLoading(props: { children: JSX.Element }) {
  const auth = useConvexAuth();
  return <Show when={auth.isLoading()}>{props.children}</Show>;
}
