import type { AuthSession, PendingMfaChallenge } from "@/shared/types/domain";

const storageKey = "dachongwms.auth.session";
const pendingChallengeKey = "dachongwms.auth.pending-mfa";

export function loadStoredSession(): AuthSession | null {
  const rawValue = window.localStorage.getItem(storageKey);
  if (!rawValue) {
    return null;
  }
  try {
    return JSON.parse(rawValue) as AuthSession;
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

export function saveStoredSession(session: AuthSession): void {
  window.localStorage.setItem(storageKey, JSON.stringify(session));
}

export function clearStoredSession(): void {
  window.localStorage.removeItem(storageKey);
}

export function loadPendingMfaChallenge(): PendingMfaChallenge | null {
  const rawValue = window.sessionStorage.getItem(pendingChallengeKey);
  if (!rawValue) {
    return null;
  }
  try {
    return JSON.parse(rawValue) as PendingMfaChallenge;
  } catch {
    window.sessionStorage.removeItem(pendingChallengeKey);
    return null;
  }
}

export function savePendingMfaChallenge(challenge: PendingMfaChallenge): void {
  window.sessionStorage.setItem(pendingChallengeKey, JSON.stringify(challenge));
}

export function clearPendingMfaChallenge(): void {
  window.sessionStorage.removeItem(pendingChallengeKey);
}
