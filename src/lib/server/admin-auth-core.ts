export interface AdminAttemptState { attempt_count: number; blocked_until: string | null; }
export const ADMIN_MAX_ATTEMPTS = 5;
function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  return difference === 0;
}
export function isAdminPinValid(candidate: unknown, configuredPin: unknown): boolean {
  if (typeof candidate !== "string" || typeof configuredPin !== "string" || !/^\d{3}$/.test(candidate) || !/^\d{3}$/.test(configuredPin)) return false;
  return constantTimeEqual(candidate, configuredPin);
}
export function isAdminAttemptLocked(attemptCount: number, blockedUntil: string | null | undefined, nowMs: number): boolean {
  if (attemptCount >= ADMIN_MAX_ATTEMPTS) return true;
  if (!blockedUntil) return false;
  const blockedUntilMs = Date.parse(blockedUntil);
  return Number.isFinite(blockedUntilMs) && blockedUntilMs > nowMs;
}
