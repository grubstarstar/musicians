import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../auth/AuthContext";

export type UserContextType =
  | "musician"
  | "sound_engineer"
  | "recording_engineer"
  | "promoter"
  | "venue_rep";

export const CONTEXT_LABELS: Record<UserContextType, string> = {
  musician: "Musician",
  sound_engineer: "Sound engineer",
  recording_engineer: "Recording engineer",
  promoter: "Promoter",
  venue_rep: "Venue representative",
};

export interface AppUser {
  username: string;
  firstName: string | null;
  availableContexts: UserContextType[];
}

// Until we have per-user role data on the server (MUS-6 work), every
// authenticated user gets every context. Swap for a real fetch in the next
// ticket that surfaces role data to mobile.
const DEFAULT_CONTEXTS: UserContextType[] = [
  "musician",
  "promoter",
  "recording_engineer",
  "sound_engineer",
  "venue_rep",
];

interface UserContextValue {
  user: AppUser;
  currentContext: UserContextType;
  setCurrentContext: (next: UserContextType) => void;
}

const UserContextCtx = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const { user: authUser } = useAuth();
  const [currentContext, setCurrentContext] = useState<UserContextType>(
    DEFAULT_CONTEXTS[0],
  );

  const value = useMemo<UserContextValue>(() => {
    // UserProvider is only mounted inside the auth gate, so authUser should
    // never be null here. Fail loudly if the tree is wired wrong.
    if (!authUser) {
      throw new Error("UserProvider requires an authenticated user");
    }
    const appUser: AppUser = {
      username: authUser.username,
      firstName: null,
      availableContexts: DEFAULT_CONTEXTS,
    };
    return { user: appUser, currentContext, setCurrentContext };
  }, [authUser, currentContext]);

  return (
    <UserContextCtx.Provider value={value}>{children}</UserContextCtx.Provider>
  );
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContextCtx);
  if (!ctx) throw new Error("useUser must be used within a UserProvider");
  return ctx;
}
