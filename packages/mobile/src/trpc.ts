import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@musicians/shared";
import { getAuthToken } from "./auth/authToken";
import { handleUnauthorized } from "./auth/unauthorizedHandler";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

export { API_URL };

// A tRPC error is UNAUTHORIZED when the server throws `TRPCError({ code: 'UNAUTHORIZED' })`.
// `TRPCClientError` exposes this via `data.code`.
function isTRPCUnauthorized(err: unknown): boolean {
  if (!(err instanceof TRPCClientError)) return false;
  const code = (err.data as { code?: string } | null | undefined)?.code;
  return code === "UNAUTHORIZED";
}

// If any query or mutation fails with UNAUTHORIZED, boot the user back to
// login. The handler lives in a separate module so AuthContext can register
// itself after mount without tangling the tRPC client with React.
function onCacheError(err: unknown): void {
  if (isTRPCUnauthorized(err)) {
    handleUnauthorized();
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onCacheError }),
  mutationCache: new MutationCache({ onError: onCacheError }),
});

const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_URL}/trpc`,
      // Token is held in a module-scoped ref managed by AuthContext. Reading
      // it per-request (rather than closing over a value) means logout /
      // login / re-auth take effect on the very next request with no client
      // reconstruction.
      headers: () => {
        const token = getAuthToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});
