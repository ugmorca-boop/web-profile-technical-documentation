import type { Access } from 'payload'

const role = (u: unknown) => (u as { role?: string } | null)?.role
export const isAdmin: Access = ({ req }) => role(req.user) === 'admin'
export const isStaff: Access = ({ req }) => ['admin', 'editor'].includes(role(req.user) ?? '')
export const isSignedIn: Access = ({ req }) => Boolean(req.user)
