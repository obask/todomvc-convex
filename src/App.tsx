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
import type { OptimisticLocalStore } from "./convex/solid";
import { createConvexMutation, createConvexQuery } from "./convex/solid";

type Filter = "all" | "active" | "completed";
type GuestTodo = Doc<"guestTodos">;

const sessionKey = "todomvc-solid-convex-session";

function getSessionId() {
  const existing = localStorage.getItem(sessionKey);
  if (existing) return existing;

  const next = crypto.randomUUID();
  localStorage.setItem(sessionKey, next);
  return next;
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
        <span class="text-sm text-slate-500">Solid + Convex guest mode</span>
      </header>
      <main class="flex flex-col items-center p-6 sm:p-10">
        <h1 class="mb-6 select-none text-6xl font-thin text-rose-400/80">
          todos
        </h1>
        <TodoApp />
      </main>
    </div>
  );
}

function TodoApp() {
  const sessionId = getSessionId();
  const todos = createConvexQuery(api.guestTodos.list, () => ({ sessionId }));
  const filter = createHashFilter();

  const patchList = (
    store: OptimisticLocalStore,
    fn: (todos: GuestTodo[]) => GuestTodo[],
  ) => {
    const existing = store.getQuery(api.guestTodos.list, { sessionId });
    if (!existing) return;
    store.setQuery(api.guestTodos.list, { sessionId }, fn(existing));
  };

  const create = createConvexMutation(
    api.guestTodos.create,
  ).withOptimisticUpdate((store, { text }) =>
    patchList(store, (existing) => [
      ...existing,
      {
        _id: crypto.randomUUID() as GuestTodo["_id"],
        _creationTime: Date.now(),
        sessionId,
        text,
        completed: false,
      },
    ]),
  );
  const setCompleted = createConvexMutation(
    api.guestTodos.setCompleted,
  ).withOptimisticUpdate((store, { id, completed }) =>
    patchList(store, (existing) =>
      existing.map((t) => (t._id === id ? { ...t, completed } : t)),
    ),
  );
  const rename = createConvexMutation(
    api.guestTodos.rename,
  ).withOptimisticUpdate((store, { id, text }) =>
    patchList(store, (existing) =>
      existing.map((t) => (t._id === id ? { ...t, text } : t)),
    ),
  );
  const remove = createConvexMutation(api.guestTodos.remove).withOptimisticUpdate(
    (store, { id }) =>
      patchList(store, (existing) => existing.filter((t) => t._id !== id)),
  );
  const toggleAll = createConvexMutation(
    api.guestTodos.toggleAll,
  ).withOptimisticUpdate((store, { completed }) =>
    patchList(store, (existing) => existing.map((t) => ({ ...t, completed }))),
  );
  const clearCompleted = createConvexMutation(
    api.guestTodos.clearCompleted,
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
          void create({ sessionId, text }).catch(() => {});
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
                void toggleAll({
                  sessionId,
                  completed: !allCompleted(),
                }).catch(() => {})
              }
              onClearCompleted={() =>
                void clearCompleted({ sessionId }).catch(() => {})
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
  todo: GuestTodo;
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
