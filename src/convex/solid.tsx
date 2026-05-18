// Solid 2.0 adapter for Convex. Mirrors convex/react: createConvexQuery (skip
// token + AsyncIterable bridge + SSR hydration), createConvexMutation
// (.withOptimisticUpdate), createConvexAction, createConvexConnectionState.
// Auth lives in ../auth/solid.tsx.

import {
  Accessor,
  ParentProps,
  createContext,
  createMemo,
  createSignal,
  onCleanup,
  useContext,
} from "solid-js";
import { isServer } from "@solidjs/web";
import {
  ConvexClient,
  ConvexHttpClient,
  type ConnectionState,
  type ConvexClientOptions,
  type OptimisticUpdate,
} from "convex/browser";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";

export type { OptimisticUpdate, OptimisticLocalStore } from "convex/browser";

// ---------- Shared helpers ----------

export type MaybeAccessor<T> = T | Accessor<T>;
export type QuerySsrSource = "server" | "hybrid" | "initial" | "client";

export interface CreateQueryOptions<T> {
  initialValue?: T;
  ssrSource?: QuerySsrSource;
}

function resolveValue<T>(value: MaybeAccessor<T>): T {
  return typeof value === "function" ? (value as Accessor<T>)() : value;
}

function hasOwnInitialValue<T>(
  options: CreateQueryOptions<T> | undefined,
): options is CreateQueryOptions<T> & { initialValue: T } {
  return (
    options != null &&
    Object.prototype.hasOwnProperty.call(options, "initialValue")
  );
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function missingProviderError(label: string): Error {
  return new Error(`${label} must be used within ConvexProvider`);
}

function missingProviderExecutionError(label: string): Error {
  return new Error(
    `${label} cannot execute during SSR without ConvexProvider`,
  );
}

/** A Promise-like that resolves synchronously when `.then` is invoked. */
function syncThenable<T>(value: T): PromiseLike<T> {
  return {
    then(onfulfilled?: ((current: T) => unknown) | null) {
      return syncThenable(onfulfilled ? onfulfilled(value) : value);
    },
  } as PromiseLike<T>;
}

// ---------- Context + client factories ----------

export const ConvexContext = createContext<ConvexClient | null>(null);

export function ConvexProvider(props: ParentProps<{ client: ConvexClient }>) {
  return (
    <ConvexContext value={props.client}>{props.children}</ConvexContext>
  );
}

export function useConvex(): ConvexClient {
  const client = useContext(ConvexContext);
  if (!client) throw missingProviderError("useConvex");
  return client;
}

export function createConvexClient(
  address: string,
  options?: ConvexClientOptions,
): ConvexClient {
  return new ConvexClient(address, options);
}

export const setupConvex = createConvexClient;

export function createConvexHttpClient(
  address: string,
  options?: ConstructorParameters<typeof ConvexHttpClient>[1],
): ConvexHttpClient {
  return new ConvexHttpClient(address, options);
}

export const setupConvexHttp = createConvexHttpClient;

export async function prefetchQuery<Query extends FunctionReference<"query">>(
  client: ConvexHttpClient,
  query: Query,
  args: FunctionArgs<Query>,
): Promise<FunctionReturnType<Query>> {
  return client.query(query, args);
}

// ---------- createConvexQuery ----------

/**
 * Subscribe to a Convex query. Returns a live accessor backed by Convex's
 * realtime subscription. Reading the accessor participates in `<Loading>` /
 * `<Errored>` / `isPending(() => q())` via Solid 2's async-memo machinery.
 *
 * - `args` accepts either a static object or an `Accessor` for reactive args.
 * - Pass `"skip"` to keep the consumer mounted without subscribing; the
 *   accessor resolves synchronously with `undefined`.
 * - `options.initialValue` seeds the memo for SSR hydration. `options.ssrSource`
 *   forwards to Solid's hydration mode (`"server" | "hybrid" | "initial" | "client"`).
 */
export function createConvexQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: MaybeAccessor<FunctionArgs<Query> | "skip">,
  options?: CreateQueryOptions<FunctionReturnType<Query> | undefined>,
): Accessor<FunctionReturnType<Query> | undefined> {
  const client = useContext(ConvexContext);
  if (!client && !isServer) throw missingProviderError("createConvexQuery");

  const hasInitial = hasOwnInitialValue(options);
  const initialValue = hasInitial ? options.initialValue : undefined;
  const ssrSource =
    options?.ssrSource ?? (hasInitial ? "initial" : undefined);

  let activeDispose: (() => void) | undefined;

  const value = createMemo<FunctionReturnType<Query> | undefined>(
    () => {
      if (!client) throw missingProviderError("createConvexQuery");

      activeDispose?.();

      const queryArgs = resolveValue(args);

      // Skip path: emit a single `undefined` synchronously and finish the
      // iterator. The async-memo runtime sees a sync-resolved value and does
      // not suspend.
      if (queryArgs === "skip") {
        activeDispose = undefined;
        let done = false;
        return {
          [Symbol.asyncIterator]() {
            return {
              next() {
                if (done) {
                  return syncThenable({
                    value: undefined as FunctionReturnType<Query>,
                    done: true,
                  });
                }
                done = true;
                return syncThenable({
                  value: undefined as FunctionReturnType<Query>,
                  done: false,
                });
              },
            };
          },
        } as unknown as FunctionReturnType<Query> | undefined;
      }

      const queue: FunctionReturnType<Query>[] = [];
      let nextResolve:
        | ((result: IteratorResult<FunctionReturnType<Query>>) => void)
        | null = null;
      let nextReject: ((reason?: unknown) => void) | null = null;
      let pendingError: Error | null = null;
      let closed = false;

      const unsubscribe = client.onUpdate(
        query,
        queryArgs,
        (result) => {
          if (closed) return;
          if (nextResolve) {
            const resolve = nextResolve;
            nextResolve = null;
            nextReject = null;
            resolve({ value: result, done: false });
            return;
          }
          queue.push(result);
        },
        (reason) => {
          const error = toError(reason);
          if (closed) return;
          if (nextReject) {
            const reject = nextReject;
            nextResolve = null;
            nextReject = null;
            reject(error);
            return;
          }
          pendingError = error;
        },
      );

      const disposeQuery = () => {
        if (closed) return;
        closed = true;
        unsubscribe.unsubscribe();
        if (nextResolve) {
          nextResolve({
            value: undefined as FunctionReturnType<Query>,
            done: true,
          });
          nextResolve = null;
          nextReject = null;
        }
        if (activeDispose === disposeQuery) activeDispose = undefined;
      };
      activeDispose = disposeQuery;

      const currentValue = unsubscribe.getCurrentValue();
      if (currentValue !== undefined) queue.push(currentValue);

      onCleanup(disposeQuery);

      return {
        [Symbol.asyncIterator]() {
          return {
            next() {
              if (pendingError) {
                const error = pendingError;
                pendingError = null;
                return Promise.reject(error);
              }
              if (queue.length > 0) {
                return syncThenable({ value: queue.shift()!, done: false });
              }
              if (closed) {
                return syncThenable({
                  value: undefined as FunctionReturnType<Query>,
                  done: true,
                });
              }
              return new Promise<IteratorResult<FunctionReturnType<Query>>>(
                (resolve, reject) => {
                  nextResolve = resolve;
                  nextReject = reject;
                },
              );
            },
            return() {
              disposeQuery();
              return syncThenable({
                value: undefined as FunctionReturnType<Query>,
                done: true,
              });
            },
          };
        },
      } as unknown as FunctionReturnType<Query> | undefined;
    },
    initialValue,
    { name: "convex-query", ssrSource } as { ssrSource?: QuerySsrSource },
  );

  onCleanup(() => activeDispose?.());

  return value;
}

// ---------- createConvexMutation ----------

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
  const client = useContext(ConvexContext);
  if (!client) {
    if (!isServer) throw missingProviderError("createConvexMutation");
    const stub = (() => {
      throw missingProviderExecutionError("createConvexMutation");
    }) as unknown as ConvexMutation<M>;
    stub.withOptimisticUpdate = () => stub;
    stub.pending = () => false;
    return stub;
  }
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

// ---------- createConvexAction ----------

export type ConvexAction<A extends FunctionReference<"action">> = {
  (args: FunctionArgs<A>): Promise<FunctionReturnType<A>>;
  pending: Accessor<boolean>;
};

export function createConvexAction<A extends FunctionReference<"action">>(
  action: A,
): ConvexAction<A> {
  const client = useContext(ConvexContext);
  if (!client) {
    if (!isServer) throw missingProviderError("createConvexAction");
    const stub = (() => {
      throw missingProviderExecutionError("createConvexAction");
    }) as unknown as ConvexAction<A>;
    stub.pending = () => false;
    return stub;
  }

  const [inflight, setInflight] = createSignal(0, { ownedWrite: true });

  const call = ((args: FunctionArgs<A>) => {
    setInflight((n) => n + 1);
    return client.action(action, args).finally(() => setInflight((n) => n - 1));
  }) as ConvexAction<A>;

  call.pending = () => inflight() > 0;
  return call;
}

// ---------- createConvexConnectionState ----------

export function createConvexConnectionState(): Accessor<ConnectionState> {
  const client = useConvex();
  const [state, setState] = createSignal(client.connectionState());
  const unsubscribe = client.subscribeToConnectionState((s) =>
    setState(() => s),
  );
  onCleanup(unsubscribe);
  return state;
}
