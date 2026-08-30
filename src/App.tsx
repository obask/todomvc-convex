"use client";

import {
  Authenticated,
  Unauthenticated,
  useAction,
  useConvexAuth,
  useMutation,
  useQuery,
} from "convex/react";
import { api } from "../convex/_generated/api";
import { tokenStore } from "convex-simple-auth/react";
import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Doc, Id } from "../convex/_generated/dataModel";

type Filter = "all" | "active" | "completed";
type AuthFlow = "signIn" | "signUp";

function getAuthErrorMessage(error: unknown, flow: AuthFlow): string {
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes("JWT_PRIVATE_KEY") ||
    message.includes("Missing environment variable")
  ) {
    return "Authentication is not configured for this deployment. Set JWT_PRIVATE_KEY in Convex and try again.";
  }

  if (
    message.includes("Invalid email or password") ||
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

function useHashFilter(): Filter {
  const [filter, setFilter] = useState<Filter>(() =>
    typeof window === "undefined" ? "all" : parseHash(),
  );
  useEffect(() => {
    const onHash = () => setFilter(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return filter;
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-dark dark:text-light">
      <header className="sticky top-0 z-10 bg-light/80 dark:bg-dark/80 backdrop-blur px-4 py-3 border-b-2 border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <span className="font-semibold tracking-wide">todos</span>
        <SignOutButton />
      </header>
      <main className="p-6 sm:p-10 flex flex-col items-center">
        <h1 className="text-6xl font-thin text-rose-400/80 mb-6 select-none">
          todos
        </h1>
        <Authenticated>
          <TodoApp />
        </Authenticated>
        <Unauthenticated>
          <SignInForm />
        </Unauthenticated>
      </main>
    </div>
  );
}

function SignOutButton() {
  const { isAuthenticated } = useConvexAuth();
  if (!isAuthenticated) return null;
  return (
    <button
      className="bg-slate-200 dark:bg-slate-800 text-dark dark:text-light rounded-md px-3 py-1 text-sm hover:bg-slate-300 dark:hover:bg-slate-700"
      onClick={() => tokenStore.clear()}
    >
      Sign out
    </button>
  );
}

function SignInForm() {
  const signIn = useAction(api.auth.signIn);
  const signUp = useAction(api.auth.signUp);
  const [flow, setFlow] = useState<AuthFlow>("signIn");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  return (
    <div className="flex flex-col gap-6 w-full max-w-sm">
      <p className="text-center text-slate-500 dark:text-slate-400">
        Sign in to sync your todos.
      </p>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const emailValue = formData.get("email");
          const passwordValue = formData.get("password");
          const email = typeof emailValue === "string" ? emailValue : "";
          const password =
            typeof passwordValue === "string" ? passwordValue : "";
          setError(null);
          setIsSubmitting(true);
          const authAction = flow === "signIn" ? signIn : signUp;
          void authAction({ email, password })
            .then((token) => tokenStore.set(token))
            .catch((err: unknown) => {
              setError(getAuthErrorMessage(err, flow));
            })
            .finally(() => {
              setIsSubmitting(false);
            });
        }}
      >
        <input
          className="bg-light dark:bg-dark text-dark dark:text-light rounded-md p-2 border-2 border-slate-200 dark:border-slate-800"
          type="email"
          name="email"
          placeholder="Email"
          autoComplete="email"
          onChange={() => setError(null)}
          required
        />
        <input
          className="bg-light dark:bg-dark text-dark dark:text-light rounded-md p-2 border-2 border-slate-200 dark:border-slate-800"
          type="password"
          name="password"
          placeholder="Password"
          autoComplete={flow === "signIn" ? "current-password" : "new-password"}
          onChange={() => setError(null)}
          required
        />
        <button
          className="bg-dark dark:bg-light text-light dark:text-dark rounded-md py-2 font-medium disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? flow === "signIn"
              ? "Signing in..."
              : "Signing up..."
            : flow === "signIn"
              ? "Sign in"
              : "Sign up"}
        </button>
        <div className="flex flex-row gap-2 text-sm">
          <span>
            {flow === "signIn"
              ? "Don't have an account?"
              : "Already have an account?"}
          </span>
          <button
            type="button"
            className="underline hover:no-underline"
            onClick={() => {
              setError(null);
              setFlow(flow === "signIn" ? "signUp" : "signIn");
            }}
          >
            {flow === "signIn" ? "Sign up instead" : "Sign in instead"}
          </button>
        </div>
        {error && (
          <div className="bg-red-500/20 border-2 border-red-500/50 rounded-md p-2">
            <p className="text-sm">{error}</p>
          </div>
        )}
      </form>
    </div>
  );
}

function TodoApp() {
  const todos = useQuery(api.todos.list, {});
  const filter = useHashFilter();

  const create = useMutation(api.todos.create).withOptimisticUpdate(
    (localStore, { text }) => {
      const existing = localStore.getQuery(api.todos.list, {});
      if (existing === undefined) return;
      const trimmed = text.trim();
      if (trimmed === "") return;
      const lastTime = existing[existing.length - 1]?._creationTime ?? 0;
      const optimistic: Doc<"todos"> = {
        _id: crypto.randomUUID() as Id<"todos">,
        _creationTime: lastTime + 1,
        userId: existing[0]?.userId ?? ("optimistic" as Id<"users">),
        text: trimmed,
        completed: false,
      };
      localStore.setQuery(api.todos.list, {}, [...existing, optimistic]);
    },
  );
  const setCompleted = useMutation(api.todos.setCompleted).withOptimisticUpdate(
    (localStore, { id, completed }) => {
      const existing = localStore.getQuery(api.todos.list, {});
      if (existing === undefined) return;
      localStore.setQuery(
        api.todos.list,
        {},
        existing.map((t) => (t._id === id ? { ...t, completed } : t)),
      );
    },
  );
  const rename = useMutation(api.todos.rename).withOptimisticUpdate(
    (localStore, { id, text }) => {
      const existing = localStore.getQuery(api.todos.list, {});
      if (existing === undefined) return;
      const trimmed = text.trim();
      const next =
        trimmed === ""
          ? existing.filter((t) => t._id !== id)
          : existing.map((t) => (t._id === id ? { ...t, text: trimmed } : t));
      localStore.setQuery(api.todos.list, {}, next);
    },
  );
  const remove = useMutation(api.todos.remove).withOptimisticUpdate(
    (localStore, { id }) => {
      const existing = localStore.getQuery(api.todos.list, {});
      if (existing === undefined) return;
      localStore.setQuery(
        api.todos.list,
        {},
        existing.filter((t) => t._id !== id),
      );
    },
  );
  const toggleAll = useMutation(api.todos.toggleAll).withOptimisticUpdate(
    (localStore, { completed }) => {
      const existing = localStore.getQuery(api.todos.list, {});
      if (existing === undefined) return;
      localStore.setQuery(
        api.todos.list,
        {},
        existing.map((t) => ({ ...t, completed })),
      );
    },
  );
  const clearCompleted = useMutation(
    api.todos.clearCompleted,
  ).withOptimisticUpdate((localStore) => {
    const existing = localStore.getQuery(api.todos.list, {});
    if (existing === undefined) return;
    localStore.setQuery(
      api.todos.list,
      {},
      existing.filter((t) => !t.completed),
    );
  });

  const visible = useMemo(() => {
    if (todos === undefined) return undefined;
    if (filter === "active") return todos.filter((t) => !t.completed);
    if (filter === "completed") return todos.filter((t) => t.completed);
    return todos;
  }, [todos, filter]);

  const remaining = todos?.filter((t) => !t.completed).length ?? 0;
  const completedCount = (todos?.length ?? 0) - remaining;
  const allCompleted = (todos?.length ?? 0) > 0 && remaining === 0;

  return (
    <section className="w-full max-w-xl bg-light dark:bg-dark border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg">
      <NewTodoInput
        onCreate={(text) => {
          void create({ text }).catch(() => {});
        }}
      />
      {todos === undefined ? (
        <p className="p-4 text-sm text-slate-500">Loading…</p>
      ) : todos.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">
          No todos yet — add one above.
        </p>
      ) : (
        <>
          <ul>
            {visible?.map((todo) => (
              <TodoItem
                key={todo._id}
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
            ))}
          </ul>
          <Footer
            remaining={remaining}
            completedCount={completedCount}
            filter={filter}
            allCompleted={allCompleted}
            onToggleAll={() => void toggleAll({ completed: !allCompleted })}
            onClearCompleted={() => void clearCompleted({}).catch(() => {})}
          />
        </>
      )}
    </section>
  );
}

function NewTodoInput({ onCreate }: { onCreate: (text: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = value.trim();
        if (trimmed === "") return;
        onCreate(trimmed);
        setValue("");
      }}
      className="border-b border-slate-200 dark:border-slate-800"
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="What needs to be done?"
        className="w-full bg-transparent px-4 py-4 text-lg italic placeholder:text-slate-400 focus:outline-none"
      />
    </form>
  );
}

function TodoItem({
  todo,
  onToggle,
  onRename,
  onRemove,
}: {
  todo: Doc<"todos">;
  onToggle: (completed: boolean) => void;
  onRename: (text: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEditing = () => {
    setDraft(todo.text);
    setEditing(true);
  };

  const commit = () => {
    if (!editing) return;
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed === todo.text) return;
    onRename(trimmed);
  };
  const cancel = () => {
    setEditing(false);
    setDraft(todo.text);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") commit();
    else if (e.key === "Escape") cancel();
  };

  return (
    <li className="group flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-900">
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={(e) => onToggle(e.target.checked)}
        className="size-5 accent-emerald-500"
      />
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKey}
          className="flex-1 bg-transparent border border-slate-300 dark:border-slate-700 rounded px-2 py-1 focus:outline-none"
        />
      ) : (
        <label
          onDoubleClick={startEditing}
          className={`flex-1 cursor-pointer break-words ${todo.completed ? "line-through text-slate-400" : ""}`}
        >
          {todo.text}
        </label>
      )}
      <button
        onClick={onRemove}
        aria-label="Delete todo"
        className="text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        ✕
      </button>
    </li>
  );
}

function Footer({
  remaining,
  completedCount,
  filter,
  allCompleted,
  onToggleAll,
  onClearCompleted,
}: {
  remaining: number;
  completedCount: number;
  filter: Filter;
  allCompleted: boolean;
  onToggleAll: () => void;
  onClearCompleted: () => void;
}) {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm text-slate-500">
      <span>
        <strong className="text-dark dark:text-light">{remaining}</strong>{" "}
        {remaining === 1 ? "item" : "items"} left
      </span>
      <nav className="flex gap-1">
        <FilterLink current={filter} value="all" href="#/" label="All" />
        <FilterLink
          current={filter}
          value="active"
          href="#/active"
          label="Active"
        />
        <FilterLink
          current={filter}
          value="completed"
          href="#/completed"
          label="Completed"
        />
      </nav>
      <div className="flex items-center gap-3">
        <button onClick={onToggleAll} className="hover:underline">
          {allCompleted ? "Mark all active" : "Mark all done"}
        </button>
        <button
          onClick={onClearCompleted}
          className={`hover:underline ${completedCount === 0 ? "invisible" : ""}`}
        >
          Clear completed
        </button>
      </div>
    </footer>
  );
}

function FilterLink({
  current,
  value,
  href,
  label,
}: {
  current: Filter;
  value: Filter;
  href: string;
  label: string;
}) {
  const active = current === value;
  return (
    <a
      href={href}
      className={`px-2 py-1 rounded border ${active ? "border-rose-400/60" : "border-transparent hover:border-slate-300 dark:hover:border-slate-700"}`}
    >
      {label}
    </a>
  );
}
