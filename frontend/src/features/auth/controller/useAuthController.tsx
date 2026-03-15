import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import {
  clearPendingChallengeStorage,
  clearSession,
  hydrateSession,
  persistPendingChallenge,
  persistSession,
  runBootstrap,
  runLogin,
  runMfaChallengeVerification,
  runSignup,
} from "@/features/auth/controller/actions";
import type { AuthContextValue, BootstrapPayload, SignupPayload } from "@/features/auth/model/types";
import { loadPendingMfaChallenge, loadStoredSession } from "@/shared/storage/auth-storage";
import type { AuthSession, PendingMfaChallenge } from "@/shared/types/domain";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [pendingChallenge, setPendingChallenge] = useState<PendingMfaChallenge | null>(() => loadPendingMfaChallenge());
  const [status, setStatus] = useState<"loading" | "authenticated" | "anonymous">("loading");

  useEffect(() => {
    const existingSession = loadStoredSession();
    if (!existingSession) {
      setStatus("anonymous");
      return;
    }

    hydrateSession(existingSession)
      .then((resolvedSession) => {
        persistSession(resolvedSession);
        setSession(resolvedSession);
        setStatus("authenticated");
      })
      .catch(() => {
        clearSession();
        setSession(null);
        setStatus("anonymous");
      });
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const result = await runLogin(username, password);
    if (result.kind === "mfa_challenge") {
      clearSession();
      setSession(null);
      persistPendingChallenge(result.challenge);
      setPendingChallenge(result.challenge);
      setStatus("anonymous");
      return result;
    }

    clearPendingChallengeStorage();
    setPendingChallenge(null);
    persistSession(result.session);
    setSession(result.session);
    setStatus("authenticated");
    return result;
  }, []);

  const bootstrap = useCallback(async (payload: BootstrapPayload = {}) => {
    const nextSession = await runBootstrap(payload);
    clearPendingChallengeStorage();
    setPendingChallenge(null);
    persistSession(nextSession);
    setSession(nextSession);
    setStatus("authenticated");
    return nextSession;
  }, []);

  const signup = useCallback(async (payload: SignupPayload) => {
    const result = await runSignup(payload);
    clearPendingChallengeStorage();
    setPendingChallenge(null);
    persistSession(result.session);
    setSession(result.session);
    setStatus("authenticated");
    return result;
  }, []);

  const completeMfaChallenge = useCallback(async (code: string) => {
    if (!pendingChallenge) {
      throw new Error("No MFA challenge is pending");
    }
    const result = await runMfaChallengeVerification(pendingChallenge, code);
    clearPendingChallengeStorage();
    setPendingChallenge(null);
    persistSession(result.session);
    setSession(result.session);
    setStatus("authenticated");
    return result;
  }, [pendingChallenge]);

  const clearPendingChallenge = useCallback(() => {
    clearPendingChallengeStorage();
    setPendingChallenge(null);
  }, []);

  const logout = useCallback(() => {
    clearPendingChallengeStorage();
    setPendingChallenge(null);
    clearSession();
    setSession(null);
    setStatus("anonymous");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      pendingChallenge,
      status,
      login,
      signup,
      bootstrap,
      completeMfaChallenge,
      clearPendingChallenge,
      logout,
    }),
    [bootstrap, clearPendingChallenge, completeMfaChallenge, login, logout, pendingChallenge, session, signup, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
