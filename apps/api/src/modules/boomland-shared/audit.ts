import type { Database } from '../../db'
import { auditLogs } from '../../db/schema'

type AuditEntry = typeof auditLogs.$inferInsert
type AuditWriter = Pick<Database, 'insert'>

export async function writeAudit(db: AuditWriter, entry: AuditEntry): Promise<void> {
  await db.insert(auditLogs).values(entry)
}
