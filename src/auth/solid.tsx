// Solid 2.0 port of @convex-dev/auth/react/client. Trimmed: no SSR
// serverState, no OAuth `?code=` handling, no cross-tab storage sync, no
// manual mutex fallback (requires navigator.locks), no replaceURL/verbose.
// Wire protocol matches the React client — same auth:signIn / auth:signOut
// actions, same JWT/refreshToken storage keys.

import {
  Accessor,
  Show,
  createContext,
  createEffect,
  createSignal,
  onSettled,
  useContext,
} from "solid-js";
import type { JSX } from "@solidjs/web";
import type { ConvexClient } from "convex/browser";
import type { FunctionReference } from "convex/server";
import type { Value } from "convex/values";
import { api } from "../../convex/_generated/api";
import { ConvexProvider } from "convex-solidjs";

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
  isLoading: Accessor<boolean>;
  isAuthenticated: Accessor<boolean>;
};

const AuthActionsContext = createContext<AuthActions>();
const AuthStateContext = createContext<AuthState>();
const AuthTokenContext = createContext<Accessor<string | null>>();

export function ConvexAuthProvider(props: {
  client: ConvexClient;
  storageNamespace?: string;
  children: JSX.Element;
}) {
  const client = props.client;
  const ns = (props.storageNamespace ?? client.client.url).replace(
    /[^a-zA-Z0-9]/g,
    "",
  );
  const k = (key: string) => `${key}_${ns}`;

  const tokenRef: { current: string | null } = { current: null };
  const [tokenSignal, setTokenSignal] = createSignal<string | null>(null);
  const [isHydrating, setIsHydrating] = createSignal(true, {
    ownedWrite: true,
  });
  const [isRefreshing, setIsRefreshing] = createSignal(false, {
    ownedWrite: true,
  });
  const [serverAuthed, setServerAuthed] = createSignal(false, {
    ownedWrite: true,
  });

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
      setTokenSignal(null);
    } else {
      tokenRef.current = args.tokens.token;
      if (args.shouldStore) {
        localStorage.setItem(k(JWT_STORAGE_KEY), args.tokens.token);
        localStorage.setItem(
          k(REFRESH_TOKEN_STORAGE_KEY),
          args.tokens.refreshToken,
        );
      }
      setTokenSignal(args.tokens.token);
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
        setIsRefreshing(true);
        try {
          const result = (await client.action(signInRef, {
            refreshToken,
          })) as SignInResult;
          setToken({ shouldStore: true, tokens: result.tokens ?? null });
        } catch {
          setToken({ shouldStore: true, tokens: null });
        } finally {
          setIsRefreshing(false);
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
  createEffect(
    () => tokenSignal() !== null,
    (hasToken) => {
      if (hasToken) {
        client.setAuth(fetchAccessToken, (authed) => setServerAuthed(authed));
      } else {
        client.setAuth(async () => null);
        setServerAuthed(false);
      }
    },
  );

  // beforeunload guard while a token refresh is in flight.
  createEffect(
    () => isRefreshing(),
    (refreshing) => {
      if (!refreshing) return;
      const listener = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = true;
      };
      window.addEventListener("beforeunload", listener);
      return () => window.removeEventListener("beforeunload", listener);
    },
  );

  // Hydrate from storage once on mount.
  onSettled(() => {
    const stored = localStorage.getItem(k(JWT_STORAGE_KEY));
    if (stored !== null) {
      setToken({
        shouldStore: false,
        tokens: { token: stored, refreshToken: "" },
      });
    }
    setIsHydrating(false);
    return () => {};
  });

  const state: AuthState = {
    isLoading: () =>
      isHydrating() || (tokenSignal() !== null && !serverAuthed()),
    isAuthenticated: () => serverAuthed(),
  };

  return (
    <ConvexProvider client={client}>
      <AuthStateContext value={state}>
        <AuthActionsContext value={{ signIn, signOut }}>
          <AuthTokenContext value={tokenSignal}>
            {props.children}
          </AuthTokenContext>
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

