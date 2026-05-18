// Solid 2.0 adapter for Convex. Mirrors convex/react: createConvexQuery (skip
// token + cache priming), createConvexMutation (.withOptimisticUpdate),
// createConvexAction, createConvexAuth + Authenticated/Unauthenticated/AuthLoading,
// createConvexConnectionState.

import {
  Accessor,
  NotReadyError,
  Show,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  useContext,
} from "solid-js";
import type { JSX } from "@solidjs/web";
import type {
  ConnectionState,
  ConvexClient,
  OptimisticUpdate,
} from "convex/browser";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";

export type { OptimisticUpdate, OptimisticLocalStore } from "convex/browser";

const ConvexContext = createContext<ConvexClient>();

export function ConvexProvider(props: {
  client: ConvexClient;
  children: JSX.Element;
}) {
  return <ConvexContext value={props.client}>{props.children}</ConvexContext>;
}

export function useConvex(): ConvexClient {
  const client = useContext(ConvexContext);
  if (!client) throw new Error("Missing ConvexProvider");
  return client;
}

type QueryCell<T> = { kind: "pending" } | { kind: "ok"; value: T } | {
  kind: "error";
  error: Error;
} | { kind: "skip" };

/**
 * Subscribe to a Convex query. Pass `"skip"` as args to suspend the
 * subscription without unmounting the consumer.
 *
 * While the first result is in flight the returned accessor throws
 * `NotReadyError`, integrating with `<Loading>`. Subscription errors propagate
 * synchronously on read, integrating with `<Errored>`. With args `"skip"` the
 * accessor returns `undefined` without suspending.
 */
export function createConvexQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: Accessor<FunctionArgs<Query> | "skip">,
): Accessor<FunctionReturnType<Query> | undefined> {
  const client = useConvex();
  const [cell, setCell] = createSignal<QueryCell<FunctionReturnType<Query>>>({
    kind: "pending",
  });

  createEffect(args, (nextArgs) => {
    if (nextArgs === "skip") {
      setCell({ kind: "skip" });
      return;
    }
    setCell({ kind: "pending" });
    const unsubscribe = client.onUpdate(
      query,
      nextArgs,
      (value) => setCell({ kind: "ok", value }),
      (error) => setCell({ kind: "error", error }),
    );
    const current = unsubscribe.getCurrentValue();
    if (current !== undefined) setCell({ kind: "ok", value: current });
    return unsubscribe;
  });

  return createMemo(() => {
    const c = cell();
    if (c.kind === "ok") return c.value;
    if (c.kind === "skip") return undefined;
    if (c.kind === "error") throw c.error;
    throw new NotReadyError(cell);
  });
}

export type ConvexMutation<M extends FunctionReference<"mutation">> = {
  (args: FunctionArgs<M>): Promise<FunctionReturnType<M>>;
  withOptimisticUpdate(
    update: OptimisticUpdate<FunctionArgs<M>>,
  ): ConvexMutation<M>;
  pending: Accessor<boolean>;
};

export function createConvexMutation<M extends FunctionReference<"mutation">>(
  mutation: M,
): ConvexMutation<M> {
  const client = useConvex();
  return buildMutation(client, mutation, undefined);
}

function buildMutation<M extends FunctionReference<"mutation">>(
  client: ConvexClient,
  mutation: M,
  optimisticUpdate: OptimisticUpdate<FunctionArgs<M>> | undefined,
): ConvexMutation<M> {
  const [inflight, setInflight] = createSignal(0, { ownedWrite: true });

  const call = ((args: FunctionArgs<M>) => {
    setInflight((n) => n + 1);
    return client
      .mutation(mutation, args, optimisticUpdate ? { optimisticUpdate } : {})
      .finally(() => setInflight((n) => n - 1));
  }) as ConvexMutation<M>;

  call.withOptimisticUpdate = (update) =>
    buildMutation(client, mutation, update);
  call.pending = () => inflight() > 0;

  return call;
}

export type ConvexAction<A extends FunctionReference<"action">> = {
  (args: FunctionArgs<A>): Promise<FunctionReturnType<A>>;
  pending: Accessor<boolean>;
};

export function createConvexAction<A extends FunctionReference<"action">>(
  action: A,
): ConvexAction<A> {
  const client = useConvex();
  const [inflight, setInflight] = createSignal(0, { ownedWrite: true });

  const call = ((args: FunctionArgs<A>) => {
    setInflight((n) => n + 1);
    return client.action(action, args).finally(() => setInflight((n) => n - 1));
  }) as ConvexAction<A>;

  call.pending = () => inflight() > 0;
  return call;
}

export function createConvexConnectionState(): Accessor<ConnectionState> {
  const client = useConvex();
  const [state, setState] = createSignal(client.connectionState());
  const unsubscribe = client.subscribeToConnectionState((s) =>
    setState(() => s),
  );
  onCleanup(unsubscribe);
  return state;
}

// ---- Auth ----

export type ConvexAuthState = {
  isLoading: Accessor<boolean>;
  isAuthenticated: Accessor<boolean>;
};

const AuthContext = createContext<ConvexAuthState>();

export type ConvexAuthHook = () => {
  isLoading: Accessor<boolean>;
  isAuthenticated: Accessor<boolean>;
  fetchAccessToken: (args: {
    forceRefreshToken: boolean;
  }) => Promise<string | null | undefined>;
};

/**
 * Wires `client.setAuth` to a Solid-native auth hook and exposes the resulting
 * `{ isLoading, isAuthenticated }` to descendants via createConvexAuth().
 */
export function ConvexAuthProvider(props: {
  client: ConvexClient;
  useAuth: ConvexAuthHook;
  children: JSX.Element;
}) {
  const { isLoading, isAuthenticated, fetchAccessToken } = props.useAuth();
  const [serverAuthed, setServerAuthed] = createSignal(false);

  createEffect(
    () => isLoading(),
    (loading) => {
      if (loading) return;
      if (isAuthenticated()) {
        props.client.setAuth(fetchAccessToken, (authed) =>
          setServerAuthed(authed),
        );
      } else {
        props.client.setAuth(async () => null);
        setServerAuthed(false);
      }
    },
  );

  const state: ConvexAuthState = {
    isLoading: () => isLoading() || (isAuthenticated() && !serverAuthed()),
    isAuthenticated: () => serverAuthed(),
  };

  return (
    <ConvexContext value={props.client}>
      <AuthContext value={state}>{props.children}</AuthContext>
    </ConvexContext>
  );
}

export function createConvexAuth(): ConvexAuthState {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("Missing ConvexAuthProvider");
  return auth;
}

export function Authenticated(props: { children: JSX.Element }) {
  const auth = createConvexAuth();
  return (
    <Show when={!auth.isLoading() && auth.isAuthenticated()}>
      {props.children}
    </Show>
  );
}

export function Unauthenticated(props: { children: JSX.Element }) {
  const auth = createConvexAuth();
  return (
    <Show when={!auth.isLoading() && !auth.isAuthenticated()}>
      {props.children}
    </Show>
  );
}

export function AuthLoading(props: { children: JSX.Element }) {
  const auth = createConvexAuth();
  return <Show when={auth.isLoading()}>{props.children}</Show>;
}
