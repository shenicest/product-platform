import 'dotenv/config'
import { app } from './app'
import { db } from './db'
import { eventManagementDb } from './db/event-management'
import { SmtpMailer } from './lib/mail/smtp-mailer'
import { HackathonService } from './modules/hackathon/service'
import { MailWorker } from './worker/mail-worker'
import { createHackathonConnectionContentResolver } from './worker/hackathon-connection-content'

app.listen(Number(process.env.PORT) || 3000)

console.log(`Server running at http://localhost:${app.server?.port}`)

if (process.env.NOTIFICATION_WORKER !== 'off') {
  const webBaseUrl = process.env.SHENICEST_WEB_BASE_URL
  if (!webBaseUrl) throw new Error('SHENICEST_WEB_BASE_URL is required when NOTIFICATION_WORKER is enabled')
  const pollIntervalMs = Number(process.env.NOTIFICATION_POLL_INTERVAL_MS) || 30000

  const hackathonService = new HackathonService(eventManagementDb, db)
  const worker = new MailWorker({
    db,
    mailer: new SmtpMailer(),
    pollIntervalMs,
    resolveContent: createHackathonConnectionContentResolver({
      db,
      getProjectSummary: async (hackathonProjectId) => {
        const project = await hackathonService.getProject(hackathonProjectId)
        return project ? { name: project.name } : null
      },
      webBaseUrl,
    }),
  })
  worker.start()
  console.log(`Mail worker started (poll every ${pollIntervalMs}ms)`)
}

export type { App } from './app'
