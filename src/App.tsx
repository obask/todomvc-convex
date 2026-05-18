import {
  Errored,
  For,
  Loading,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
} from "solid-js";
import { api } from "../convex/_generated/api";
import type { Doc } from "../convex/_generated/dataModel";
import type { OptimisticLocalStore } from "convex-solidjs";
import { createMutation, createQuery } from "convex-solidjs";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useAuthActions,
} from "./auth/solid";

type Filter = "all" | "active" | "completed";
type Todo = Doc<"todos">;
type AuthFlow = "signIn" | "signUp";

function getAuthErrorMessage(error: unknown, flow: AuthFlow): string {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("JWT_PRIVATE_KEY") ||
    message.includes("Missing environment variable")
  ) {
    return "Authentication is not configured for this deployment. Set up Convex Auth environment variables and try again.";
  }
  if (
    message.includes("InvalidAccountId") ||
    message.includes("InvalidSecret") ||
    message.includes("Server Error")
  ) {
    return flow === "signIn"
      ? "Invalid email or password."
      : "Could not create that account. Try another email or password.";
  }
  return flow === "signIn"
    ? "Sign in failed. Check your email and password and try again."
    : "Sign up failed. Check your email and password and try again.";
}

function parseHash(): Filter {
  const h = window.location.hash;
  if (h === "#/active") return "active";
  if (h === "#/completed") return "completed";
  return "all";
}

function createHashFilter() {
  const [filter, setFilter] = createSignal<Filter>(parseHash());
  const onHash = () => setFilter(parseHash());
  window.addEventListener("hashchange", onHash);
  onCleanup(() => window.removeEventListener("hashchange", onHash));
  return filter;
}

export default function App() {
  return (
    <div class="min-h-screen bg-slate-100 text-dark dark:bg-slate-950 dark:text-light">
      <header class="sticky top-0 z-10 flex items-center justify-between border-b-2 border-slate-200 bg-light/80 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-dark/80">
        <span class="font-semibold tracking-wide">todos</span>
        <Authenticated>
          <SignOutButton />
        </Authenticated>
      </header>
      <main class="flex flex-col items-center p-6 sm:p-10">
        <h1 class="mb-6 select-none text-6xl font-thin text-rose-400/80">
          todos
        </h1>
        <AuthLoading>
          <p class="text-sm text-slate-500">Loading...</p>
        </AuthLoading>
        <Unauthenticated>
          <SignInForm />
        </Unauthenticated>
        <Authenticated>
          <TodoApp />
        </Authenticated>
      </main>
    </div>
  );
}

function SignOutButton() {
  const { signOut } = useAuthActions();
  const viewer = createQuery(api.todos.viewer, () => ({}));
  return (
    <div class="flex items-center gap-3 text-sm">
      <span class="text-slate-500">{viewer() ?? "anonymous"}</span>
      <button
        class="rounded-md bg-slate-200 px-3 py-1 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700"
        onClick={() => void signOut()}
      >
        Sign out
      </button>
    </div>
  );
}

function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = createSignal<AuthFlow>("signUp");
  const [error, setError] = createSignal<string | null>(null);
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  const submitPassword = (e: SubmitEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    formData.set("flow", flow());
    setError(null);
    setIsSubmitting(true);
    void signIn("password", formData)
      .catch((err: unknown) => setError(getAuthErrorMessage(err, flow())))
      .finally(() => setIsSubmitting(false));
  };

  const continueAnonymous = () => {
    setError(null);
    setIsSubmitting(true);
    void signIn("anonymous", {})
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : String(err)),
      )
      .finally(() => setIsSubmitting(false));
  };

  return (
    <div class="flex w-full max-w-sm flex-col gap-6">
      <p class="text-center text-slate-500 dark:text-slate-400">
        {flow() === "signUp"
          ? "Create an account to sync your todos."
          : "Sign in to sync your todos."}
      </p>
      <form class="flex flex-col gap-2" onSubmit={submitPassword}>
        <input
          class="rounded-md border-2 border-slate-200 bg-light p-2 text-dark dark:border-slate-800 dark:bg-dark dark:text-light"
          type="email"
          name="email"
          placeholder="Email"
          autocomplete="email"
          onInput={() => setError(null)}
          required
        />
        <input
          class="rounded-md border-2 border-slate-200 bg-light p-2 text-dark dark:border-slate-800 dark:bg-dark dark:text-light"
          type="password"
          name="password"
          placeholder="Password"
          autocomplete={
            flow() === "signIn" ? "current-password" : "new-password"
          }
          onInput={() => setError(null)}
          required
        />
        <button
          class="rounded-md bg-dark py-2 font-medium text-light disabled:cursor-not-allowed disabled:opacity-60 dark:bg-light dark:text-dark"
          type="submit"
          disabled={isSubmitting()}
        >
          {isSubmitting()
            ? flow() === "signIn"
              ? "Signing in..."
              : "Signing up..."
            : flow() === "signIn"
              ? "Sign in"
              : "Sign up"}
        </button>
        <div class="flex flex-row gap-2 text-sm">
          <span>
            {flow() === "signIn"
              ? "Don't have an account?"
              : "Already have an account?"}
          </span>
          <button
            type="button"
            class="underline hover:no-underline"
            onClick={() => {
              setError(null);
              setFlow(flow() === "signIn" ? "signUp" : "signIn");
            }}
          >
            {flow() === "signIn" ? "Sign up instead" : "Sign in instead"}
          </button>
        </div>
        <Show when={error()}>
          {(message) => (
            <div class="rounded-md border-2 border-red-500/50 bg-red-500/20 p-2">
              <p class="text-sm">{message()}</p>
            </div>
          )}
        </Show>
      </form>
      <div class="flex items-center gap-2 text-xs text-slate-400">
        <hr class="flex-1 border-slate-200 dark:border-slate-800" />
        <span>or</span>
        <hr class="flex-1 border-slate-200 dark:border-slate-800" />
      </div>
      <button
        type="button"
        class="rounded-md border border-slate-300 py-2 text-sm hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-900"
        onClick={continueAnonymous}
        disabled={isSubmitting()}
      >
        Continue without an account
      </button>
    </div>
  );
}

function TodoApp() {
  const todos = createQuery(api.todos.list, () => ({}));
  const filter = createHashFilter();

  const patchList = (
    store: OptimisticLocalStore,
    fn: (todos: Todo[]) => Todo[],
  ) => {
    const existing = store.getQuery(api.todos.list, {});
    if (!existing) return;
    store.setQuery(api.todos.list, {}, fn(existing));
  };

  const create = createMutation(api.todos.create).withOptimisticUpdate(
    (store, { text }) =>
      patchList(store, (existing) => {
        const trimmed = text.trim();
        if (trimmed === "") return existing;
        const lastTime = existing[existing.length - 1]?._creationTime ?? 0;
        return [
          ...existing,
          {
            _id: crypto.randomUUID() as Todo["_id"],
            _creationTime: lastTime + 1,
            userId: existing[0]?.userId ?? ("optimistic" as Todo["userId"]),
            text: trimmed,
            completed: false,
          },
        ];
      }),
  );
  const setCompleted = createMutation(
    api.todos.setCompleted,
  ).withOptimisticUpdate((store, { id, completed }) =>
    patchList(store, (existing) =>
      existing.map((t) => (t._id === id ? { ...t, completed } : t)),
    ),
  );
  const rename = createMutation(api.todos.rename).withOptimisticUpdate(
    (store, { id, text }) =>
      patchList(store, (existing) => {
        const trimmed = text.trim();
        return trimmed === ""
          ? existing.filter((t) => t._id !== id)
          : existing.map((t) => (t._id === id ? { ...t, text: trimmed } : t));
      }),
  );
  const remove = createMutation(api.todos.remove).withOptimisticUpdate(
    (store, { id }) =>
      patchList(store, (existing) => existing.filter((t) => t._id !== id)),
  );
  const toggleAll = createMutation(
    api.todos.toggleAll,
  ).withOptimisticUpdate((store, { completed }) =>
    patchList(store, (existing) => existing.map((t) => ({ ...t, completed }))),
  );
  const clearCompleted = createMutation(
    api.todos.clearCompleted,
  ).withOptimisticUpdate((store) =>
    patchList(store, (existing) => existing.filter((t) => !t.completed)),
  );

  const visible = createMemo(() => {
    const allTodos = todos()!;
    if (filter() === "active") return allTodos.filter((t) => !t.completed);
    if (filter() === "completed") return allTodos.filter((t) => t.completed);
    return allTodos;
  });

  const remaining = createMemo(
    () => todos()!.filter((t) => !t.completed).length,
  );
  const completedCount = createMemo(() => todos()!.length - remaining());
  const allCompleted = createMemo(
    () => todos()!.length > 0 && remaining() === 0,
  );

  return (
    <section class="w-full max-w-xl rounded-lg border border-slate-200 bg-light shadow-lg dark:border-slate-800 dark:bg-dark">
      <NewTodoInput
        onCreate={(text) => {
          void create({ text }).catch(() => {});
        }}
      />
      <Errored
        fallback={(err, reset) => (
          <div class="p-4 text-sm text-rose-500">
            <p>Failed to load: {String(err())}</p>
            <button onClick={reset} class="mt-2 underline">
              Retry
            </button>
          </div>
        )}
      >
        <Loading fallback={<p class="p-4 text-sm text-slate-500">Loading...</p>}>
          <Show
            when={todos()!.length > 0}
            fallback={
              <p class="p-4 text-sm text-slate-500">
                No todos yet. Add one above.
              </p>
            }
          >
            <ul>
              <For each={visible()}>
                {(todo) => (
                  <TodoItem
                    todo={todo}
                    onToggle={(completed) =>
                      void setCompleted({ id: todo._id, completed }).catch(
                        () => {},
                      )
                    }
                    onRename={(text) =>
                      void rename({ id: todo._id, text }).catch(() => {})
                    }
                    onRemove={() =>
                      void remove({ id: todo._id }).catch(() => {})
                    }
                  />
                )}
              </For>
            </ul>
            <Footer
              remaining={remaining()}
              completedCount={completedCount()}
              filter={filter()}
              allCompleted={allCompleted()}
              onToggleAll={() =>
                void toggleAll({ completed: !allCompleted() }).catch(() => {})
              }
              onClearCompleted={() =>
                void clearCompleted({}).catch(() => {})
              }
            />
          </Show>
        </Loading>
      </Errored>
    </section>
  );
}

function NewTodoInput(props: { onCreate: (text: string) => void }) {
  const [value, setValue] = createSignal("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = value().trim();
        if (trimmed === "") return;
        props.onCreate(trimmed);
        setValue("");
      }}
      class="border-b border-slate-200 dark:border-slate-800"
    >
      <input
        autofocus
        value={value()}
        onInput={(e) => setValue(e.currentTarget.value)}
        placeholder="What needs to be done?"
        class="w-full bg-transparent px-4 py-4 text-lg italic placeholder:text-slate-400 focus:outline-none"
      />
    </form>
  );
}

function TodoItem(props: {
  todo: Todo;
  onToggle: (completed: boolean) => void;
  onRename: (text: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = createSignal(false);
  const [draft, setDraft] = createSignal(props.todo.text);
  let inputRef: HTMLInputElement | undefined;

  createEffect(
    () => editing(),
    (isEditing) => {
      if (isEditing) {
        inputRef?.focus();
        inputRef?.select();
      }
    },
  );

  const startEditing = () => {
    setDraft(props.todo.text);
    setEditing(true);
  };

  const commit = () => {
    if (!editing()) return;
    setEditing(false);
    const trimmed = draft().trim();
    if (trimmed === props.todo.text) return;
    props.onRename(trimmed);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(props.todo.text);
  };

  return (
    <li class="group flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-900">
      <input
        type="checkbox"
        checked={props.todo.completed}
        onChange={(e) => props.onToggle(e.currentTarget.checked)}
        class="size-5 accent-emerald-500"
      />
      <Show
        when={editing()}
        fallback={
          <label
            onDblClick={startEditing}
            class={[
              "flex-1 cursor-pointer break-words",
              { "text-slate-400 line-through": props.todo.completed },
            ]}
          >
            {props.todo.text}
          </label>
        }
      >
        <input
          ref={(el) => {
            inputRef = el;
          }}
          value={draft()}
          onInput={(e) => setDraft(e.currentTarget.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          class="flex-1 rounded border border-slate-300 bg-transparent px-2 py-1 focus:outline-none dark:border-slate-700"
        />
      </Show>
      <button
        onClick={props.onRemove}
        aria-label="Delete todo"
        class="text-rose-400 opacity-0 transition-opacity group-hover:opacity-100"
      >
        x
      </button>
    </li>
  );
}

function Footer(props: {
  remaining: number;
  completedCount: number;
  filter: Filter;
  allCompleted: boolean;
  onToggleAll: () => void;
  onClearCompleted: () => void;
}) {
  return (
    <footer class="flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm text-slate-500">
      <span>
        <strong class="text-dark dark:text-light">{props.remaining}</strong>{" "}
        {props.remaining === 1 ? "item" : "items"} left
      </span>
      <nav class="flex gap-1">
        <FilterLink current={props.filter} value="all" href="#/" label="All" />
        <FilterLink
          current={props.filter}
          value="active"
          href="#/active"
          label="Active"
        />
        <FilterLink
          current={props.filter}
          value="completed"
          href="#/completed"
          label="Completed"
        />
      </nav>
      <div class="flex items-center gap-3">
        <button onClick={props.onToggleAll} class="hover:underline">
          {props.allCompleted ? "Mark all active" : "Mark all done"}
        </button>
        <button
          onClick={props.onClearCompleted}
          class={[
            "hover:underline",
            { invisible: props.completedCount === 0 },
          ]}
        >
          Clear completed
        </button>
      </div>
    </footer>
  );
}

function FilterLink(props: {
  current: Filter;
  value: Filter;
  href: string;
  label: string;
}) {
  const active = () => props.current === props.value;
  return (
    <a
      href={props.href}
      class={[
        "rounded border px-2 py-1",
        active()
          ? "border-rose-400/60"
          : "border-transparent hover:border-slate-300 dark:hover:border-slate-700",
      ]}
    >
      {props.label}
    </a>
  );
}
