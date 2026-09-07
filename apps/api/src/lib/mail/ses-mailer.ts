import { ses } from 'tencentcloud-sdk-nodejs-ses'
import { MailSendError, type MailSendInput, type MailSendResult, type Mailer } from './mailer'

type SesClient = InstanceType<(typeof ses)['v20201002']['Client']>

export interface SesMailerOptions {
  // Test seam: inject a stub client instead of the real SDK client. Env vars
  // are still validated, since the from/reply-to addresses always come from env.
  client?: SesClient
}

// Tencent Cloud SES adapter over the custom-content email API (SendEmail with
// Simple Html/Text, which the API expects base64-encoded).
export class SesMailer implements Mailer {
  private readonly client: SesClient
  private readonly from: string
  private readonly replyTo: string | null

  constructor(options: SesMailerOptions = {}) {
    const secretId = process.env.TENCENTCLOUD_SECRET_ID
    const secretKey = process.env.TENCENTCLOUD_SECRET_KEY
    const region = process.env.TENCENTCLOUD_SES_REGION ?? 'ap-guangzhou'
    const from = process.env.SES_FROM_EMAIL_ADDRESS
    const replyTo = process.env.SES_REPLY_TO_ADDRESS ?? null
    if (!secretId || !secretKey || !from) {
      const missing = [
        !secretId && 'TENCENTCLOUD_SECRET_ID',
        !secretKey && 'TENCENTCLOUD_SECRET_KEY',
        !from && 'SES_FROM_EMAIL_ADDRESS',
      ].filter((name): name is string => Boolean(name))
      throw new Error(`SesMailer requires environment variables: ${missing.join(', ')}`)
    }
    this.from = from
    this.replyTo = replyTo
    this.client =
      options.client ??
      new ses.v20201002.Client({
        credential: { secretId, secretKey },
        region,
      })
  }

  async send(input: MailSendInput): Promise<MailSendResult> {
    try {
      const response = await this.client.SendEmail({
        FromEmailAddress: this.from,
        Destination: [input.to],
        Subject: input.subject,
        Simple: {
          Html: Buffer.from(input.html, 'utf8').toString('base64'),
          Text: Buffer.from(input.text, 'utf8').toString('base64'),
        },
        ...(this.replyTo ? { ReplyToAddresses: this.replyTo } : {}),
      })
      return { providerMessageId: response.MessageId }
    } catch (err) {
      throw new MailSendError(errorCode(err), err instanceof Error ? err.message : String(err))
    }
  }
}

function errorCode(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code
  return typeof code === 'string' && code ? code : 'UNKNOWN'
}
