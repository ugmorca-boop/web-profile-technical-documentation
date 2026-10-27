export type Role = 'member' | 'editor' | 'admin'
export type ArticleStatus = 'draft' | 'submitted' | 'approved' | 'published'

/** Server-side rule for article status changes. Nobody approves their own article. */
export function canTransition(p: { role: Role; from: ArticleStatus; to: ArticleStatus; isAuthor: boolean }): boolean {
  const { role, from, to, isAuthor } = p
  if (from === to) return true
  const staff = role === 'editor' || role === 'admin'
  if (from === 'draft' && to === 'submitted') return isAuthor
  if (from === 'submitted' && to === 'draft') return isAuthor || staff
  if (!staff || isAuthor) return false
  if (from === 'submitted' && to === 'approved') return true
  if (from === 'approved' && to === 'published') return true
  if (from === 'published' && to === 'approved') return true
  return false
}
