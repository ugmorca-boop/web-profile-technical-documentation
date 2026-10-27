export type MemberStatus = 'active' | 'suspended' | 'alumni'

/** A member may sign in only if active and their term has not ended. */
export function canSignIn(
  m: { status: MemberStatus; termEndsAt?: string | null },
  now: Date = new Date(),
): boolean {
  if (m.status !== 'active') return false
  if (m.termEndsAt && new Date(m.termEndsAt).getTime() < now.getTime()) return false
  return true
}

/** True when the last activity is older than `days` (default 90). */
export function isInactive(lastActiveAt: string | null | undefined, now: Date = new Date(), days = 90): boolean {
  if (!lastActiveAt) return true
  return now.getTime() - new Date(lastActiveAt).getTime() > days * 86_400_000
}
