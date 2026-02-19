import type { AuthUser } from "aws-amplify/auth";
import {
  signOut as amplifySignOut,
  getCurrentUser,
  signInWithRedirect,
} from "aws-amplify/auth";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; user: AuthUser };

const AuthContext = createContext<{
  authState: AuthState;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  isConfigured: boolean;
} | null>(null);

export function AuthProvider({
  children,
  isConfigured,
}: {
  children: ReactNode;
  isConfigured: boolean;
}) {
  const [authState, setAuthState] = useState<AuthState>({ status: "loading" });

  const checkUser = useCallback(async () => {
    if (!isConfigured) {
      setAuthState({ status: "unauthenticated" });
      return;
    }
    try {
      const user = await getCurrentUser();
      setAuthState({ status: "authenticated", user });
    } catch {
      setAuthState({ status: "unauthenticated" });
    }
  }, [isConfigured]);

  useEffect(() => {
    checkUser();
  }, [checkUser]);

  const signInWithGoogle = useCallback(async () => {
    if (!isConfigured) return;
    await signInWithRedirect({ provider: "Google" });
  }, [isConfigured]);

  const signOut = useCallback(async () => {
    if (!isConfigured) return;
    await amplifySignOut();
    setAuthState({ status: "unauthenticated" });
  }, [isConfigured]);

  return (
    <AuthContext.Provider
      value={{ authState, signInWithGoogle, signOut, isConfigured }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
