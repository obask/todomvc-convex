import { createTokenStore } from "./simpleAuth/tokenStore";
import { useConvexAuthFromStore } from "./simpleAuth/react";

export const tokenStore = createTokenStore();
export const useAuth = () => useConvexAuthFromStore(tokenStore);
