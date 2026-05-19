export interface TokenStore {
  get(): string | null;
  set(token: string): void;
  clear(): void;
  subscribe(listener: () => void): () => void;
}

const DEFAULT_KEY = "convex_jwt";

export function createTokenStore(opts: { key?: string } = {}): TokenStore {
  const key = opts.key ?? DEFAULT_KEY;
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
      if (event.key === key) emit();
    });
  }

  return {
    get: () =>
      typeof window === "undefined" ? null : window.localStorage.getItem(key),
    set: (token) => {
      window.localStorage.setItem(key, token);
      emit();
    },
    clear: () => {
      window.localStorage.removeItem(key);
      emit();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
