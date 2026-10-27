import type { CollectionConfig } from 'payload'
import { isSignedIn } from '../access'
import { canTransition, type ArticleStatus, type Role } from '../lib/workflow'

export const Articles: CollectionConfig = {
  slug: 'articles',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'author', 'status'] },
  access: {
    create: isSignedIn,
    read: ({ req }) => {
      const u = req.user as any
      if (!u) return { status: { equals: 'published' } }
      if (['admin', 'editor'].includes(u.role)) return true
      return { or: [{ status: { equals: 'published' } }, { author: { equals: u.id } }] }
    },
    update: ({ req }) => {
      const u = req.user as any
      if (!u) return false
      if (['admin', 'editor'].includes(u.role)) return true
      return { and: [{ author: { equals: u.id } }, { status: { in: ['draft', 'submitted'] } }] }
    },
    delete: ({ req }) => (req.user as any)?.role === 'admin',
  },
  hooks: {
    beforeChange: [
      ({ data, originalDoc, req, operation }) => {
        const u = req.user as any
        if (!u) throw new Error('Not signed in')
        if (operation === 'create') data.author = u.id
        const from: ArticleStatus = operation === 'create' ? 'draft' : originalDoc.status
        const to: ArticleStatus = data.status ?? from
        const authorId = operation === 'create' ? u.id : (originalDoc.author?.id ?? originalDoc.author)
        const ok = canTransition({ role: u.role as Role, from, to, isAuthor: authorId === u.id })
        if (!ok) throw new Error(`Status change ${from} to ${to} is not allowed.`)
        return data
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 160 },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'team', type: 'select', options: ['mechanical', 'electrical', 'control', 'software'] },
    { name: 'author', type: 'relationship', relationTo: 'members', admin: { readOnly: true } },
    { name: 'status', type: 'select', defaultValue: 'draft', required: true, options: ['draft', 'submitted', 'approved', 'published'] },
    { name: 'body', type: 'richText', required: true }, // structured JSON, not raw HTML
    { name: 'reviewNote', type: 'textarea', admin: { description: 'Feedback from the editor.' } },
  ],
}
