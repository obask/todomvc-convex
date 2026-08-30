// Preact port of @convex-dev/auth/react/client. Trimmed: no SSR serverState,
// no OAuth `?code=` handling, no cross-tab storage sync, no manual mutex
// fallback (requires navigator.locks), no replaceURL/verbose. Wire protocol
// matches the React client — same auth:signIn / auth:signOut actions, same
// JWT/refreshToken storage keys.

import { createContext, type ComponentChildren } from "preact";
import { useContext, useEffect, useMemo, useRef } from "preact/hooks";
import {
  useSignal,
  useComputed,
  type ReadonlySignal,
} from "@preact/signals";
import type { ConvexClient } from "convex/browser";
import type { FunctionReference } from "convex/server";
import type { Value } from "convex/values";
import { api } from "../../convex/_generated/api";
import { ConvexProvider } from "convex-preact";

const JWT_STORAGE_KEY = "__convexAuthJWT";
const REFRESH_TOKEN_STORAGE_KEY = "__convexAuthRefreshToken";

type Tokens = { token: string; refreshToken: string } | null;

type SignInResult = {
  tokens?: Tokens;
  redirect?: string;
  verifier?: string;
  started?: boolean;
};

type AuthActions = {
  signIn(
    this: void,
    provider: string,
    params?: FormData | Record<string, Value>,
  ): Promise<{ signingIn: boolean }>;
  signOut(this: void): Promise<void>;
};

type AuthState = {
  isLoading: ReadonlySignal<boolean>;
  isAuthenticated: ReadonlySignal<boolean>;
};

const AuthActionsContext = createContext<AuthActions | null>(null);
const AuthStateContext = createContext<AuthState | null>(null);
const AuthTokenContext = createContext<ReadonlySignal<string | null> | null>(
  null,
);

export function ConvexAuthProvider(props: {
  client: ConvexClient;
  storageNamespace?: string;
  children: ComponentChildren;
}) {
  const client = props.client;
  const ns = (props.storageNamespace ?? client.client.url).replace(
    /[^a-zA-Z0-9]/g,
    "",
  );
  const k = (key: string) => `${key}_${ns}`;

  const tokenRef = useRef<string | null>(null);
  const tokenSignal = useSignal<string | null>(null);
  const isHydrating = useSignal(true);
  const isRefreshing = useSignal(false);
  const serverAuthed = useSignal(false);

  const signInRef =
    api.auth.signIn as unknown as FunctionReference<"action", "public">;
  const signOutRef =
    api.auth.signOut as unknown as FunctionReference<"action", "public">;

  const setToken = (args: { shouldStore: boolean; tokens: Tokens }) => {
    if (args.tokens === null) {
      tokenRef.current = null;
      if (args.shouldStore) {
        localStorage.removeItem(k(JWT_STORAGE_KEY));
        localStorage.removeItem(k(REFRESH_TOKEN_STORAGE_KEY));
      }
      tokenSignal.value = null;
    } else {
      tokenRef.current = args.tokens.token;
      if (args.shouldStore) {
        localStorage.setItem(k(JWT_STORAGE_KEY), args.tokens.token);
        localStorage.setItem(
          k(REFRESH_TOKEN_STORAGE_KEY),
          args.tokens.refreshToken,
        );
      }
      tokenSignal.value = args.tokens.token;
    }
  };

  const fetchAccessToken = async ({
    forceRefreshToken,
  }: {
    forceRefreshToken: boolean;
  }): Promise<string | null> => {
    if (!forceRefreshToken) return tokenRef.current;
    const before = tokenRef.current;
    return await navigator.locks.request(
      k(REFRESH_TOKEN_STORAGE_KEY),
      async () => {
        const after = tokenRef.current;
        if (after !== before) return after;
        const refreshToken = localStorage.getItem(k(REFRESH_TOKEN_STORAGE_KEY));
        if (!refreshToken) return null;
        isRefreshing.value = true;
        try {
          const result = (await client.action(signInRef, {
            refreshToken,
          })) as SignInResult;
          setToken({ shouldStore: true, tokens: result.tokens ?? null });
        } catch {
          setToken({ shouldStore: true, tokens: null });
        } finally {
          isRefreshing.value = false;
        }
        return tokenRef.current;
      },
    );
  };

  const signIn: AuthActions["signIn"] = async (provider, params) => {
    const args: Record<string, Value> =
      params instanceof FormData
        ? (Object.fromEntries(params.entries()) as Record<string, Value>)
        : params ?? {};
    const result = (await client.action(signInRef, {
      provider,
      params: args,
    })) as SignInResult;
    if (result.tokens !== undefined) {
      setToken({ shouldStore: true, tokens: result.tokens });
      return { signingIn: result.tokens !== null };
    }
    return { signingIn: false };
  };

  const signOut: AuthActions["signOut"] = async () => {
    try {
      await client.action(signOutRef, {});
    } catch {
      // ignore — usually means already signed out
    }
    setToken({ shouldStore: true, tokens: null });
  };

  // Wire client.setAuth whenever a token appears/disappears.
  useEffect(() => {
    const hasToken = tokenSignal.value !== null;
    if (hasToken) {
      client.setAuth(fetchAccessToken, (authed) => {
        serverAuthed.value = authed;
      });
    } else {
      client.setAuth(async () => null);
      serverAuthed.value = false;
    }
  }, [tokenSignal.value]);

  // beforeunload guard while a token refresh is in flight.
  useEffect(() => {
    if (!isRefreshing.value) return;
    const listener = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = true;
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [isRefreshing.value]);

  // Hydrate from storage once on mount.
  useEffect(() => {
    const stored = localStorage.getItem(k(JWT_STORAGE_KEY));
    if (stored !== null) {
      setToken({
        shouldStore: false,
        tokens: { token: stored, refreshToken: "" },
      });
    }
    isHydrating.value = false;
  }, []);

  const isLoading = useComputed(
    () => isHydrating.value || (tokenSignal.value !== null && !serverAuthed.value),
  );
  const isAuthenticated = useComputed(() => serverAuthed.value);
  const state: AuthState = useMemo(
    () => ({ isLoading, isAuthenticated }),
    [isLoading, isAuthenticated],
  );
  const actions: AuthActions = useMemo(() => ({ signIn, signOut }), []);
  const tokenReadonly: ReadonlySignal<string | null> = tokenSignal;

  return (
    <ConvexProvider client={client}>
      <AuthStateContext.Provider value={state}>
        <AuthActionsContext.Provider value={actions}>
          <AuthTokenContext.Provider value={tokenReadonly}>
            {props.children}
          </AuthTokenContext.Provider>
        </AuthActionsContext.Provider>
      </AuthStateContext.Provider>
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

export function useAuthToken(): ReadonlySignal<string | null> {
  const token = useContext(AuthTokenContext);
  if (!token) throw new Error("Missing ConvexAuthProvider");
  return token;
}

export function Authenticated(props: { children: ComponentChildren }) {
  const auth = useConvexAuth();
  return !auth.isLoading.value && auth.isAuthenticated.value ? (
    <>{props.children}</>
  ) : null;
}

export function Unauthenticated(props: { children: ComponentChildren }) {
  const auth = useConvexAuth();
  return !auth.isLoading.value && !auth.isAuthenticated.value ? (
    <>{props.children}</>
  ) : null;
}

export function AuthLoading(props: { children: ComponentChildren }) {
  const auth = useConvexAuth();
  return auth.isLoading.value ? <>{props.children}</> : null;
}
