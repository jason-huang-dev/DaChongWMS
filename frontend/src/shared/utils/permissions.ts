import type { AuthSession } from "@/shared/types/domain";

export function hasAnyRole(session: AuthSession | null, roles?: string[]): boolean {
  if (!roles || roles.length === 0) {
    return true;
  }
  if (!session) {
    return false;
  }
  return roles.some((role) => session.operatorRole.toLowerCase() === role.toLowerCase());
}
