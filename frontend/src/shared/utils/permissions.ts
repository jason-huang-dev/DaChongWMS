import type { AuthSession } from "@/shared/types/domain";

export function hasAnyRole(session: AuthSession | null, roles?: string[]): boolean {
  if (!roles || roles.length === 0) {
    return true;
  }
  if (!session) {
    return false;
  }
  const normalizedRole = session.operatorRole.toLowerCase();
  if (normalizedRole === "owner") {
    return true;
  }
  return roles.some((role) => normalizedRole === role.toLowerCase());
}
