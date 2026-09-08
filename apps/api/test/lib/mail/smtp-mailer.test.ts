import { afterEach, describe, expect, it } from 'bun:test'
import { MailSendError } from '../../../src/lib/mail/mailer'
import { SmtpMailer, type SmtpMailerOptions } from '../../../src/lib/mail/smtp-mailer'

const REQUIRED_VARS = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_EMAIL_ADDRESS'] as const

// Sets the given env vars for the duration of `run`, restoring afterwards.
async function withEnv(values: Record<string, string | undefined>, run: () => Promise<void> | void) {
  const saved = REQUIRED_VARS.concat('SMTP_PORT', 'SMTP_SECURE', 'SMTP_REPLY_TO_ADDRESS', 'SMTP_FROM_NAME').map(
    (name) => [name, process.env[name]] as const,
  )
  try {
    for (const [name, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
    await run()
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
}

const fullEnv = {
  SMTP_HOST: 'smtp.example.com',
  SMTP_USER: 'sender@example.com',
  SMTP_PASS: 'secret',
  SMTP_FROM_EMAIL_ADDRESS: 'sender@example.com',
}

const input = {
  to: 'receiver@example.com',
  subject: 'Subject',
  html: '<p>HTML 正文</p>',
  text: '纯文本正文',
  idempotencyKey: 'hackathon_connection_created:1',
}

function fakeTransporter(sendMail: (options: Record<string, unknown>) => Promise<unknown>) {
  return { sendMail } as unknown as SmtpMailerOptions['transporter']
}

afterEach(() => {
  delete process.env.SMTP_PORT
  delete process.env.SMTP_SECURE
  delete process.env.SMTP_REPLY_TO_ADDRESS
  delete process.env.SMTP_FROM_NAME
})

describe('SmtpMailer construction', () => {
  it('throws listing every missing required variable', async () => {
    await withEnv(
      { SMTP_HOST: undefined, SMTP_USER: undefined, SMTP_PASS: undefined, SMTP_FROM_EMAIL_ADDRESS: undefined },
      () => {
        expect(() => new SmtpMailer()).toThrow(/SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM_EMAIL_ADDRESS/)
      },
    )
  })

  it('throws when only the from address is missing', async () => {
    await withEnv({ ...fullEnv, SMTP_FROM_EMAIL_ADDRESS: undefined }, () => {
      expect(() => new SmtpMailer()).toThrow(/SMTP_FROM_EMAIL_ADDRESS/)
    })
  })

  it('constructs when all required variables are present', async () => {
    await withEnv(fullEnv, () => {
      expect(() => new SmtpMailer({ transporter: fakeTransporter(async () => ({ messageId: 'x' })) })).not.toThrow()
    })
  })
})

describe('SmtpMailer.send', () => {
  it('sends html/text content to the recipient and returns the message id', async () => {
    await withEnv(fullEnv, async () => {
      const mails: Record<string, unknown>[] = []
      const mailer = new SmtpMailer({
        transporter: fakeTransporter(async (options) => {
          mails.push(options)
          return { messageId: 'smtp-message-1' }
        }),
      })
      const result = await mailer.send(input)
      expect(result.providerMessageId).toBe('smtp-message-1')
      expect(mails).toHaveLength(1)
      expect(mails[0]).toMatchObject({
        from: { name: 'SheNicest', address: 'sender@example.com' },
        to: 'receiver@example.com',
        subject: 'Subject',
        html: '<p>HTML 正文</p>',
        text: '纯文本正文',
        replyTo: undefined,
      })
    })
  })

  it('includes the reply-to address when configured', async () => {
    await withEnv({ ...fullEnv, SMTP_REPLY_TO_ADDRESS: 'support@example.com' }, async () => {
      const mails: Record<string, unknown>[] = []
      const mailer = new SmtpMailer({
        transporter: fakeTransporter(async (options) => {
          mails.push(options)
          return { messageId: 'smtp-message-2' }
        }),
      })
      await mailer.send(input)
      expect(mails[0].replyTo).toBe('support@example.com')
    })
  })

  it('uses the configured from name instead of the default', async () => {
    await withEnv({ ...fullEnv, SMTP_FROM_NAME: 'SheNicest 通知' }, async () => {
      const mails: Record<string, unknown>[] = []
      const mailer = new SmtpMailer({
        transporter: fakeTransporter(async (options) => {
          mails.push(options)
          return { messageId: 'smtp-message-3' }
        }),
      })
      await mailer.send(input)
      expect(mails[0].from).toEqual({ name: 'SheNicest 通知', address: 'sender@example.com' })
    })
  })

  it('normalizes nodemailer errors into MailSendError with the nodemailer code', async () => {
    await withEnv(fullEnv, async () => {
      const mailer = new SmtpMailer({
        transporter: fakeTransporter(async () => {
          throw Object.assign(new Error('bad credentials'), { code: 'EAUTH' })
        }),
      })
      expect(mailer.send(input)).rejects.toMatchObject({ code: 'EAUTH', name: 'MailSendError' })
    })
  })

  it('uses the SMTP response code when nodemailer carries no code', async () => {
    await withEnv(fullEnv, async () => {
      const mailer = new SmtpMailer({
        transporter: fakeTransporter(async () => {
          throw Object.assign(new Error('relay denied'), { responseCode: 550 })
        }),
      })
      expect(mailer.send(input)).rejects.toMatchObject({ code: 'SMTP_550' })
    })
  })

  it('falls back to UNKNOWN for plain errors', async () => {
    await withEnv(fullEnv, async () => {
      const mailer = new SmtpMailer({
        transporter: fakeTransporter(async () => {
          throw new Error('network down')
        }),
      })
      expect(mailer.send(input)).rejects.toMatchObject({ code: 'UNKNOWN' })
    })
  })
})

describe('MailSendError', () => {
  it('defaults its message to the code', () => {
    const err = new MailSendError('EAUTH')
    expect(err.message).toBe('EAUTH')
  })
})