import { useEffect, useRef } from "preact/hooks";
import { useSignal, useComputed } from "@preact/signals";
import type { JSX } from "preact";
import { api } from "../convex/_generated/api";
import type { Doc } from "../convex/_generated/dataModel";
import type { OptimisticLocalStore } from "convex/browser";
import { useQuery, useMutation } from "convex-preact";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useAuthActions,
} from "./auth/preact";

type Filter = "all" | "active" | "completed";
type Todo = Doc<"todos">;
type AuthFlow = "signIn" | "signUp";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

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

function useHashFilter() {
  const filter = useSignal<Filter>(parseHash());
  useEffect(() => {
    const onHash = () => {
      filter.value = parseHash();
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
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
  const viewer = useQuery(api.todos.viewer, {});
  return (
    <div class="flex items-center gap-3 text-sm">
      <span class="text-slate-500">{viewer.value ?? "anonymous"}</span>
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
  const flow = useSignal<AuthFlow>("signUp");
  const error = useSignal<string | null>(null);
  const isSubmitting = useSignal(false);

  const submitPassword = (e: JSX.TargetedEvent<HTMLFormElement, Event>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("flow", flow.value);
    error.value = null;
    isSubmitting.value = true;
    void signIn("password", formData)
      .catch((err: unknown) => {
        error.value = getAuthErrorMessage(err, flow.value);
      })
      .finally(() => {
        isSubmitting.value = false;
      });
  };

  const continueAnonymous = () => {
    error.value = null;
    isSubmitting.value = true;
    void signIn("anonymous", {})
      .catch((err: unknown) => {
        error.value = err instanceof Error ? err.message : String(err);
      })
      .finally(() => {
        isSubmitting.value = false;
      });
  };

  return (
    <div class="flex w-full max-w-sm flex-col gap-6">
      <p class="text-center text-slate-500 dark:text-slate-400">
        {flow.value === "signUp"
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
          onInput={() => {
            error.value = null;
          }}
          required
        />
        <input
          class="rounded-md border-2 border-slate-200 bg-light p-2 text-dark dark:border-slate-800 dark:bg-dark dark:text-light"
          type="password"
          name="password"
          placeholder="Password"
          autocomplete={
            flow.value === "signIn" ? "current-password" : "new-password"
          }
          onInput={() => {
            error.value = null;
          }}
          required
        />
        <button
          class="rounded-md bg-dark py-2 font-medium text-light disabled:cursor-not-allowed disabled:opacity-60 dark:bg-light dark:text-dark"
          type="submit"
          disabled={isSubmitting.value}
        >
          {isSubmitting.value
            ? flow.value === "signIn"
              ? "Signing in..."
              : "Signing up..."
            : flow.value === "signIn"
              ? "Sign in"
              : "Sign up"}
        </button>
        <div class="flex flex-row gap-2 text-sm">
          <span>
            {flow.value === "signIn"
              ? "Don't have an account?"
              : "Already have an account?"}
          </span>
          <button
            type="button"
            class="underline hover:no-underline"
            onClick={() => {
              error.value = null;
              flow.value = flow.value === "signIn" ? "signUp" : "signIn";
            }}
          >
            {flow.value === "signIn" ? "Sign up instead" : "Sign in instead"}
          </button>
        </div>
        {error.value !== null && (
          <div class="rounded-md border-2 border-red-500/50 bg-red-500/20 p-2">
            <p class="text-sm">{error.value}</p>
          </div>
        )}
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
        disabled={isSubmitting.value}
      >
        Continue without an account
      </button>
    </div>
  );
}

function TodoApp() {
  const todos = useQuery(api.todos.list, {});
  const filter = useHashFilter();

  const patchList = (
    store: OptimisticLocalStore,
    fn: (todos: Todo[]) => Todo[],
  ) => {
    const existing = store.getQuery(api.todos.list, {});
    if (!existing) return;
    store.setQuery(api.todos.list, {}, fn(existing));
  };

  const create = useMutation(api.todos.create).withOptimisticUpdate(
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
  const setCompleted = useMutation(api.todos.setCompleted).withOptimisticUpdate(
    (store, { id, completed }) =>
      patchList(store, (existing) =>
        existing.map((t) => (t._id === id ? { ...t, completed } : t)),
      ),
  );
  const rename = useMutation(api.todos.rename).withOptimisticUpdate(
    (store, { id, text }) =>
      patchList(store, (existing) => {
        const trimmed = text.trim();
        return trimmed === ""
          ? existing.filter((t) => t._id !== id)
          : existing.map((t) => (t._id === id ? { ...t, text: trimmed } : t));
      }),
  );
  const remove = useMutation(api.todos.remove).withOptimisticUpdate(
    (store, { id }) =>
      patchList(store, (existing) => existing.filter((t) => t._id !== id)),
  );
  const toggleAll = useMutation(api.todos.toggleAll).withOptimisticUpdate(
    (store, { completed }) =>
      patchList(store, (existing) =>
        existing.map((t) => ({ ...t, completed })),
      ),
  );
  const clearCompleted = useMutation(
    api.todos.clearCompleted,
  ).withOptimisticUpdate((store) =>
    patchList(store, (existing) => existing.filter((t) => !t.completed)),
  );

  const visible = useComputed(() => {
    const allTodos = todos.value ?? [];
    if (filter.value === "active") return allTodos.filter((t) => !t.completed);
    if (filter.value === "completed")
      return allTodos.filter((t) => t.completed);
    return allTodos;
  });

  const remaining = useComputed(
    () => (todos.value ?? []).filter((t) => !t.completed).length,
  );
  const completedCount = useComputed(
    () => (todos.value ?? []).length - remaining.value,
  );
  const allCompleted = useComputed(
    () => (todos.value ?? []).length > 0 && remaining.value === 0,
  );

  return (
    <section class="w-full max-w-xl rounded-lg border border-slate-200 bg-light shadow-lg dark:border-slate-800 dark:bg-dark">
      <NewTodoInput
        onCreate={(text) => {
          void create({ text }).catch(() => {});
        }}
      />
      {todos.value === undefined ? (
        <p class="p-4 text-sm text-slate-500">Loading...</p>
      ) : todos.value.length === 0 ? (
        <p class="p-4 text-sm text-slate-500">No todos yet. Add one above.</p>
      ) : (
        <>
          <ul>
            {visible.value.map((todo) => (
              <TodoItem
                key={todo._id}
                todo={todo}
                onToggle={(completed) =>
                  void setCompleted({ id: todo._id, completed }).catch(() => {})
                }
                onRename={(text) =>
                  void rename({ id: todo._id, text }).catch(() => {})
                }
                onRemove={() =>
                  void remove({ id: todo._id }).catch(() => {})
                }
              />
            ))}
          </ul>
          <Footer
            remaining={remaining.value}
            completedCount={completedCount.value}
            filter={filter.value}
            allCompleted={allCompleted.value}
            onToggleAll={() =>
              void toggleAll({ completed: !allCompleted.value }).catch(
                () => {},
              )
            }
            onClearCompleted={() => void clearCompleted({}).catch(() => {})}
          />
        </>
      )}
    </section>
  );
}

function NewTodoInput(props: { onCreate: (text: string) => void }) {
  const value = useSignal("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = value.value.trim();
        if (trimmed === "") return;
        props.onCreate(trimmed);
        value.value = "";
      }}
      class="border-b border-slate-200 dark:border-slate-800"
    >
      <input
        autofocus
        value={value.value}
        onInput={(e) => {
          value.value = e.currentTarget.value;
        }}
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
  const editing = useSignal(false);
  const draft = useSignal(props.todo.text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing.value) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing.value]);

  const startEditing = () => {
    draft.value = props.todo.text;
    editing.value = true;
  };

  const commit = () => {
    if (!editing.value) return;
    editing.value = false;
    const trimmed = draft.value.trim();
    if (trimmed === props.todo.text) return;
    props.onRename(trimmed);
  };

  const cancel = () => {
    editing.value = false;
    draft.value = props.todo.text;
  };

  return (
    <li class="group flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-900">
      <input
        type="checkbox"
        checked={props.todo.completed}
        onChange={(e) => props.onToggle(e.currentTarget.checked)}
        class="size-5 accent-emerald-500"
      />
      {editing.value ? (
        <input
          ref={inputRef}
          value={draft.value}
          onInput={(e) => {
            draft.value = e.currentTarget.value;
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          class="flex-1 rounded border border-slate-300 bg-transparent px-2 py-1 focus:outline-none dark:border-slate-700"
        />
      ) : (
        <label
          onDblClick={startEditing}
          class={cx(
            "flex-1 cursor-pointer break-words",
            props.todo.completed && "text-slate-400 line-through",
          )}
        >
          {props.todo.text}
        </label>
      )}
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
          class={cx(
            "hover:underline",
            props.completedCount === 0 && "invisible",
          )}
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
  const active = props.current === props.value;
  return (
    <a
      href={props.href}
      class={cx(
        "rounded border px-2 py-1",
        active
          ? "border-rose-400/60"
          : "border-transparent hover:border-slate-300 dark:hover:border-slate-700",
      )}
    >
      {props.label}
    </a>
  );
}
