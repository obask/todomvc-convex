import { useCallback, useSyncExternalStore } from "react";
import type { TokenStore } from "./tokenStore";

export function useConvexAuthFromStore(store: TokenStore) {
  const token = useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.get(),
    () => null,
  );
  const fetchAccessToken = useCallback(async () => store.get(), [store]);

  return {
    isLoading: false,
    isAuthenticated: token !== null,
    fetchAccessToken,
  };
}
