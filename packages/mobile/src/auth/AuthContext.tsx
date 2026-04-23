import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_URL } from "../trpc";
import { setAuthToken } from "./authToken";
import {
  clearStoredToken,
  getStoredToken,
  storeToken,
} from "./tokenStorage";
import { setUnauthorizedHandler } from "./unauthorizedHandler";

export interface AuthUser {
  username: string;
}

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContextCtx = createContext<AuthContextValue | null>(null);

interface LoginResponse {
  username?: string;
  token?: string;
  error?: string;
}

interface RegisterResponse {
  username?: string;
  token?: string;
  error?: string;
}

interface MeResponse {
  username?: string;
  error?: string;
}

/**
 * Exchanges credentials for a bearer token. Surfaces a clean `Error` on
 * non-2xx responses so the login form can render the server's message.
 * Pure-ish: no React / no storage side effects.
 */
async function requestLogin(
  apiUrl: string,
  username: string,
  password: string,
): Promise<{ token: string; username: string }> {
  const res = await fetch(`${apiUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const body = (await res.json().catch(() => ({}))) as LoginResponse;
  if (!res.ok) {
    throw new Error(body.error ?? "Login failed");
  }
  if (!body.token || !body.username) {
    throw new Error("Login response was missing token or username");
  }
  return { token: body.token, username: body.username };
}

/**
 * Creates a new account, then behaves like login — server returns the same
 * `{ token, username }` shape on success. Surfaces server errors (duplicate
 * username, validation) as plain `Error`s for the signup form to render.
 */
async function requestRegister(
  apiUrl: string,
  username: string,
  password: string,
): Promise<{ token: string; username: string }> {
  const res = await fetch(`${apiUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const body = (await res.json().catch(() => ({}))) as RegisterResponse;
  if (!res.ok) {
    throw new Error(body.error ?? "Signup failed");
  }
  if (!body.token || !body.username) {
    throw new Error("Signup response was missing token or username");
  }
  return { token: body.token, username: body.username };
}

/**
 * Validates a stored token against the server. Returns the username when
 * still valid; null if the token is expired/revoked/invalid.
 */
async function fetchMe(apiUrl: string, token: string): Promise<string | null> {
  try {
    const res = await fetch(`${apiUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as MeResponse;
    return body.username ?? null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);

  // Set the module-level auth token whenever our state changes. This is what
  // the tRPC client reads on every request. Keep it in a ref-synced effect
  // so the update happens as part of render commit, not user event callbacks.
  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  const logout = useCallback(async () => {
    setStatus("unauthenticated");
    setUser(null);
    setTokenState(null);
    setAuthToken(null);
    await clearStoredToken();
    // Drop any cached protected-query data so the next login starts clean.
    queryClient.clear();
  }, [queryClient]);

  // Guard re-entrant 401 handling (e.g. a batch of 4 calls all returning 401
  // would otherwise call logout 4 times). First invocation wins per session.
  const loggingOutRef = useRef(false);
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (loggingOutRef.current) return;
      loggingOutRef.current = true;
      void logout().finally(() => {
        loggingOutRef.current = false;
      });
    });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // On mount, silent re-auth: if we have a stored token and the server says
  // it's still valid, skip the login screen.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getStoredToken();
      if (cancelled) return;
      if (!stored) {
        setStatus("unauthenticated");
        return;
      }
      // Seed the tRPC client's token immediately so any early query issued
      // against the authed state (unlikely but possible with Suspense) goes
      // out with the right header.
      setAuthToken(stored);
      const username = await fetchMe(API_URL, stored);
      if (cancelled) return;
      if (!username) {
        // Token expired or revoked — clear it silently.
        setAuthToken(null);
        await clearStoredToken();
        setStatus("unauthenticated");
        return;
      }
      setTokenState(stored);
      setUser({ username });
      setStatus("authenticated");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const result = await requestLogin(API_URL, username, password);
      await storeToken(result.token);
      setAuthToken(result.token);
      setTokenState(result.token);
      setUser({ username: result.username });
      setStatus("authenticated");
    },
    [],
  );

  // Signup and login both end with "we now have a token and a username";
  // persist and flip state the same way so navigation to the post-auth group
  // happens via the `status` -> `authenticated` transition exactly like login.
  const register = useCallback(
    async (username: string, password: string) => {
      const result = await requestRegister(API_URL, username, password);
      await storeToken(result.token);
      setAuthToken(result.token);
      setTokenState(result.token);
      setUser({ username: result.username });
      setStatus("authenticated");
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, token, login, register, logout }),
    [status, user, token, login, register, logout],
  );

  return (
    <AuthContextCtx.Provider value={value}>{children}</AuthContextCtx.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContextCtx);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
