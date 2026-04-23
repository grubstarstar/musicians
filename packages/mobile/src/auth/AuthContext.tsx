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
  // MUS-89: roles surfaced to the client so the (app) auth gate can bounce
  // unroled users (signup just ran, no role picked yet) into the onboarding
  // wizard on cold launch. Populated from the login/register response bodies
  // and `/api/auth/me`, all of which already return the `roles` array.
  roles: string[];
}

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /**
   * Re-fetches the current user from `/api/auth/me` and updates `user` in
   * context. General-purpose escape hatch retained for callers that don't
   * have an authoritative roles array on hand. New code that already knows
   * the post-mutation roles (e.g. from a tRPC mutation that returns them)
   * should call `setRoles` instead — see the doc comment on `setRoles` for
   * the MUS-92 motivation.
   *
   * No-op if there is no token (logged out / loading). Errors are swallowed
   * — a transient `/me` failure shouldn't block UX; the auth gate will
   * re-resolve on the next cold launch.
   */
  refreshUser: () => Promise<void>;
  /**
   * Synchronously replace the user's `roles` in context. Use this from the
   * onSuccess handler of any mutation that already returns the authoritative
   * roles array (e.g. `onboarding.setRole`).
   *
   * MUS-92: the role-picker previously called `await refreshUser()` here —
   * a `/me` round-trip whose `setUser` ran inside an awaited async
   * continuation. React batched that update such that the very next
   * `router.replace` into a deep link could re-evaluate `(app)/_layout.tsx`
   * before the new `roles` had committed, sending the user back to the
   * picker. Switching to a synchronous `setRoles(data.roles)` from inside
   * the same handler that triggers navigation matches the existing
   * `login`/`register` pattern and lets React commit before the next
   * navigation tick.
   *
   * No-op if there is no current user (shouldn't happen — caller is
   * inside a protected mutation — but defensive against logout races).
   */
  setRoles: (roles: string[]) => void;
}

const AuthContextCtx = createContext<AuthContextValue | null>(null);

interface LoginResponse {
  username?: string;
  token?: string;
  roles?: string[];
  error?: string;
}

interface RegisterResponse {
  username?: string;
  token?: string;
  roles?: string[];
  error?: string;
}

interface MeResponse {
  username?: string;
  roles?: string[];
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
): Promise<{ token: string; username: string; roles: string[] }> {
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
  // `roles` absent in an older server build shouldn't block auth; default to
  // an empty array which routes the caller into the onboarding wizard anyway.
  return {
    token: body.token,
    username: body.username,
    roles: body.roles ?? [],
  };
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
): Promise<{ token: string; username: string; roles: string[] }> {
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
  // Fresh registrations always come back with `roles: []`; default to the
  // same shape defensively if the key is ever missing.
  return {
    token: body.token,
    username: body.username,
    roles: body.roles ?? [],
  };
}

/**
 * Validates a stored token against the server. Returns `{ username, roles }`
 * when still valid; null if the token is expired/revoked/invalid. Roles are
 * needed on cold launch (MUS-89) so the auth gate can bounce unroled users
 * into the onboarding wizard instead of landing them on Home.
 */
async function fetchMe(
  apiUrl: string,
  token: string,
): Promise<{ username: string; roles: string[] } | null> {
  try {
    const res = await fetch(`${apiUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as MeResponse;
    if (!body.username) return null;
    return { username: body.username, roles: body.roles ?? [] };
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
      const me = await fetchMe(API_URL, stored);
      if (cancelled) return;
      if (!me) {
        // Token expired or revoked — clear it silently.
        setAuthToken(null);
        await clearStoredToken();
        setStatus("unauthenticated");
        return;
      }
      setTokenState(stored);
      setUser({ username: me.username, roles: me.roles });
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
      setUser({ username: result.username, roles: result.roles });
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
      setUser({ username: result.username, roles: result.roles });
      setStatus("authenticated");
    },
    [],
  );

  // Re-fetch `/me` and replace the user in context. See the doc comment on
  // `AuthContextValue.refreshUser` for the rationale. Reads `token` from
  // state rather than capturing it in a closure-stale way — the callback
  // is recomputed when `token` changes.
  const refreshUser = useCallback(async () => {
    if (!token) return;
    const me = await fetchMe(API_URL, token);
    if (!me) return;
    setUser({ username: me.username, roles: me.roles });
  }, [token]);

  // Functional `setUser` so we don't capture a stale `user` in the closure;
  // the callback identity stays stable across user changes (no deps), which
  // means useMemo below doesn't churn the context value every time `roles`
  // updates.
  const setRoles = useCallback((roles: string[]) => {
    setUser((prev) => (prev ? { ...prev, roles } : null));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      token,
      login,
      register,
      logout,
      refreshUser,
      setRoles,
    }),
    [status, user, token, login, register, logout, refreshUser, setRoles],
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
