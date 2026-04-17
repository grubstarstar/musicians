import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

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

export interface MockUser {
  username: string;
  firstName: string | null;
  availableContexts: UserContextType[];
}

// Flip `availableContexts` to a single entry to exercise the single-context UI.
const MOCK_USER: MockUser = {
  username: "rich",
  firstName: "Richard",
  availableContexts: [
    "musician",
    "promoter",
    "recording_engineer",
    "sound_engineer",
    "venue_rep",
  ],
};

interface UserContextValue {
  user: MockUser;
  currentContext: UserContextType;
  setCurrentContext: (next: UserContextType) => void;
}

const UserContextCtx = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentContext, setCurrentContext] = useState<UserContextType>(
    MOCK_USER.availableContexts[0]
  );

  const value = useMemo<UserContextValue>(
    () => ({ user: MOCK_USER, currentContext, setCurrentContext }),
    [currentContext]
  );

  return (
    <UserContextCtx.Provider value={value}>{children}</UserContextCtx.Provider>
  );
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContextCtx);
  if (!ctx) throw new Error("useUser must be used within a UserProvider");
  return ctx;
}
