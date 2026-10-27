import type { CollectionConfig } from 'payload'
import { isAdmin, isStaff } from '../access'
import { canSignIn } from '../lib/membership'

export const Members: CollectionConfig = {
  slug: 'members',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'email', 'role', 'status', 'termEndsAt', 'lastActiveAt'] },
  auth: { tokenExpiration: 60 * 60 * 8, maxLoginAttempts: 5, lockTime: 15 * 60 * 1000 },
  access: {
    admin: ({ req }) => ['admin', 'editor'].includes((req.user as any)?.role ?? ''),
    create: isAdmin, // invite-only: no public sign-up
    delete: isAdmin,
    update: isAdmin,
    read: ({ req }) => {
      if (!req.user) return false
      if (['admin', 'editor'].includes((req.user as any).role)) return true
      return { id: { equals: req.user.id } }
    },
  },
  hooks: {
    beforeLogin: [
      ({ user }) => {
        if (!canSignIn(user as any)) throw new Error('This account is not active. Contact an ORCA admin.')
        return user
      },
    ],
    afterLogin: [
      async ({ user, req }) => {
        await req.payload.update({ collection: 'members', id: user.id, data: { lastActiveAt: new Date().toISOString() } })
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req, operation }) => {
        if (operation === 'update' && (doc.role !== previousDoc?.role || doc.status !== previousDoc?.status)) {
          await req.payload.create({
            collection: 'audit-logs',
            data: {
              action: 'member.access_changed',
              actor: String(req.user?.id ?? 'system'),
              target: String(doc.id),
              detail: { role: [previousDoc?.role, doc.role], status: [previousDoc?.status, doc.status] },
            },
          })
        }
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'role', type: 'select', defaultValue: 'member', required: true, options: ['member', 'editor', 'admin'], access: { update: isAdmin } },
    { name: 'status', type: 'select', defaultValue: 'active', required: true, options: ['active', 'suspended', 'alumni'], access: { update: isAdmin } },
    { name: 'termEndsAt', type: 'date', admin: { description: 'Access ends after this date unless renewed.' }, access: { update: isAdmin } },
    { name: 'lastActiveAt', type: 'date', admin: { readOnly: true }, access: { read: isStaff, update: () => false } },
  ],
}
