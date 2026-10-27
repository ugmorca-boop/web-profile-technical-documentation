import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access'

// Written only by server code (local API). Nobody can create, edit or delete through the API.
export const AuditLogs: CollectionConfig = {
  slug: 'audit-logs',
  admin: { useAsTitle: 'action' },
  access: { read: isAdmin, create: () => false, update: () => false, delete: () => false },
  fields: [
    { name: 'action', type: 'text', required: true },
    { name: 'actor', type: 'text' },
    { name: 'target', type: 'text' },
    { name: 'detail', type: 'json' },
  ],
}
