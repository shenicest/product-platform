export interface EmailContent {
  subject: string
  html: string
  text: string
}

export interface MailSendInput extends EmailContent {
  to: string
  idempotencyKey: string
}

export interface MailSendResult {
  providerMessageId?: string
}

export interface Mailer {
  send(input: MailSendInput): Promise<MailSendResult>
}

// Normalized provider failure. `code` is the stable error code stored in
// connection_notification_deliveries.last_error_code — never the raw provider
// response.
export class MailSendError extends Error {
  constructor(
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code)
    this.name = 'MailSendError'
  }
}

// Test double that records every send call for assertions.
export class InMemoryMailer implements Mailer {
  readonly calls: MailSendInput[] = []

  async send(input: MailSendInput): Promise<MailSendResult> {
    this.calls.push(input)
    return { providerMessageId: `in-memory-${this.calls.length}` }
  }
}
