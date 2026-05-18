import {
  Accessor,
  JSX,
  createContext,
  createEffect,
  createSignal,
  onCleanup,
  useContext,
} from "solid-js";
import type { ConvexClient } from "convex/browser";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";

const ConvexContext = createContext<ConvexClient>();

export function ConvexProvider(props: {
  client: ConvexClient;
  children: JSX.Element;
}) {
  return (
    <ConvexContext.Provider value={props.client}>
      {props.children}
    </ConvexContext.Provider>
  );
}

export function useConvex() {
  const client = useContext(ConvexContext);
  if (!client) throw new Error("Missing ConvexProvider");
  return client;
}

export function createConvexQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: Accessor<FunctionArgs<Query>>,
): Accessor<FunctionReturnType<Query> | undefined> {
  const client = useConvex();
  const [value, setValue] = createSignal<FunctionReturnType<Query>>();

  createEffect(() => {
    const unsubscribe = client.onUpdate(query, args(), (nextValue) => {
      setValue(() => nextValue);
    });
    onCleanup(unsubscribe);
  });

  return value;
}

export function createConvexMutation<
  Mutation extends FunctionReference<"mutation">,
>(mutation: Mutation) {
  const client = useConvex();
  return (args: FunctionArgs<Mutation>) => client.mutation(mutation, args);
}
