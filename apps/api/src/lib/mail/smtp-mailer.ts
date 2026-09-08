import nodemailer, { type Transporter } from 'nodemailer'
import { MailSendError, type MailSendInput, type MailSendResult, type Mailer } from './mailer'

export interface SmtpMailerOptions {
  // Test seam: inject a stub transporter instead of opening a real SMTP
  // connection. Env vars are still validated, since the from/reply-to
  // addresses always come from env.
  transporter?: Pick<Transporter, 'sendMail'>
}

// Generic SMTP adapter. The default target is the Tencent Cloud SES SMTP
// gateway (smtp.qcloudmail.com / gz-smtp.qcloudmail.com, port 465, implicit
// TLS). Unlike the SendEmail API — which is template-only by default — SMTP
// carries raw HTML/text content, so no console template is involved.
export class SmtpMailer implements Mailer {
  private readonly transporter: Pick<Transporter, 'sendMail'>
  private readonly from: string
  private readonly fromName: string
  private readonly replyTo: string | null

  constructor(options: SmtpMailerOptions = {}) {
    const host = process.env.SMTP_HOST
    const port = Number(process.env.SMTP_PORT) || 465
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS
    const from = process.env.SMTP_FROM_EMAIL_ADDRESS
    const fromName = process.env.SMTP_FROM_NAME ?? 'SheNicest'
    const replyTo = process.env.SMTP_REPLY_TO_ADDRESS ?? null
    if (!host || !user || !pass || !from) {
      const missing = [
        !host && 'SMTP_HOST',
        !user && 'SMTP_USER',
        !pass && 'SMTP_PASS',
        !from && 'SMTP_FROM_EMAIL_ADDRESS',
      ].filter((name): name is string => Boolean(name))
      throw new Error(`SmtpMailer requires environment variables: ${missing.join(', ')}`)
    }
    // Implicit TLS by default on 465 (Tencent SES); override with SMTP_SECURE.
    const secure =
      process.env.SMTP_SECURE === undefined ? port === 465 : process.env.SMTP_SECURE !== 'false'
    this.from = from
    this.fromName = fromName
    this.replyTo = replyTo
    this.transporter =
      options.transporter ??
      nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
      })
  }

  async send(input: MailSendInput): Promise<MailSendResult> {
    try {
      const info = await this.transporter.sendMail({
        // Display name so recipients see "SheNicest" instead of the raw
        // address's local part (e.g. notification@shenicest.com).
        from: { name: this.fromName, address: this.from },
        replyTo: this.replyTo ?? undefined,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      })
      return { providerMessageId: info.messageId }
    } catch (err) {
      throw new MailSendError(errorCode(err), err instanceof Error ? err.message : String(err))
    }
  }
}

// Normalize nodemailer failures into a stable error code for
// connection_notification_deliveries.last_error_code: nodemailer's own
// `code` (EAUTH, ESOCKET, ETIMEDOUT, ...) when present, the numeric SMTP
// response code otherwise, and UNKNOWN as the fallback.
function errorCode(err: unknown): string {
  const asError = err as { code?: unknown; responseCode?: unknown } | null
  if (typeof asError?.code === 'string' && asError.code) return asError.code
  if (typeof asError?.responseCode === 'number') return `SMTP_${asError.responseCode}`
  return 'UNKNOWN'
}