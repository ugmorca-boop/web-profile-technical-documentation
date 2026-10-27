import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { Members } from './collections/Members'
import { Articles } from './collections/Articles'
import { AuditLogs } from './collections/AuditLogs'

export default buildConfig({
  admin: { user: 'members' },
  collections: [Members, Articles, AuditLogs],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET!,
  db: postgresAdapter({ pool: { connectionString: process.env.DATABASE_URI } }),
  typescript: { outputFile: 'src/payload-types.ts' },
})
