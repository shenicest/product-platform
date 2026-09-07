import { afterEach, describe, expect, it } from 'bun:test'
import { MailSendError } from '../../../src/lib/mail/mailer'
import { SesMailer, type SesMailerOptions } from '../../../src/lib/mail/ses-mailer'

const REQUIRED_VARS = ['TENCENTCLOUD_SECRET_ID', 'TENCENTCLOUD_SECRET_KEY', 'SES_FROM_EMAIL_ADDRESS'] as const

// Sets the given env vars for the duration of `run`, restoring afterwards.
async function withEnv(values: Record<string, string | undefined>, run: () => Promise<void> | void) {
  const saved = REQUIRED_VARS.concat('TENCENTCLOUD_SES_REGION', 'SES_REPLY_TO_ADDRESS').map(
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
  TENCENTCLOUD_SECRET_ID: 'id',
  TENCENTCLOUD_SECRET_KEY: 'key',
  SES_FROM_EMAIL_ADDRESS: 'from@example.com',
}

const input = {
  to: 'receiver@example.com',
  subject: 'Subject',
  html: '<p>HTML 正文</p>',
  text: '纯文本正文',
  idempotencyKey: 'hackathon_connection_created:1',
}

function fakeClient(impl: (request: Record<string, unknown>) => Promise<unknown>) {
  return { SendEmail: impl } as unknown as SesMailerOptions['client']
}

afterEach(() => {
  delete process.env.TENCENTCLOUD_SES_REGION
  delete process.env.SES_REPLY_TO_ADDRESS
})

describe('SesMailer construction', () => {
  it('throws listing every missing required variable', async () => {
    await withEnv(
      { TENCENTCLOUD_SECRET_ID: undefined, TENCENTCLOUD_SECRET_KEY: undefined, SES_FROM_EMAIL_ADDRESS: undefined },
      () => {
        expect(() => new SesMailer()).toThrow(/TENCENTCLOUD_SECRET_ID, TENCENTCLOUD_SECRET_KEY, SES_FROM_EMAIL_ADDRESS/)
      },
    )
  })

  it('throws when only the from address is missing', async () => {
    await withEnv({ ...fullEnv, SES_FROM_EMAIL_ADDRESS: undefined }, () => {
      expect(() => new SesMailer()).toThrow(/SES_FROM_EMAIL_ADDRESS/)
    })
  })

  it('constructs when all required variables are present', async () => {
    await withEnv(fullEnv, () => {
      expect(() => new SesMailer()).not.toThrow()
    })
  })
})

describe('SesMailer.send', () => {
  it('sends base64 html/text to the recipient and returns the provider message id', async () => {
    await withEnv(fullEnv, async () => {
      const requests: Record<string, unknown>[] = []
      const mailer = new SesMailer({
        client: fakeClient(async (request) => {
          requests.push(request)
          return { MessageId: 'ses-message-1', RequestId: 'req-1' }
        }),
      })
      const result = await mailer.send(input)
      expect(result.providerMessageId).toBe('ses-message-1')
      expect(requests).toHaveLength(1)
      const request = requests[0] as {
        FromEmailAddress: string
        Destination: string[]
        Subject: string
        Simple: { Html: string; Text: string }
      }
      expect(request.FromEmailAddress).toBe('from@example.com')
      expect(request.Destination).toEqual(['receiver@example.com'])
      expect(request.Subject).toBe('Subject')
      expect(Buffer.from(request.Simple.Html, 'base64').toString('utf8')).toBe('<p>HTML 正文</p>')
      expect(Buffer.from(request.Simple.Text, 'base64').toString('utf8')).toBe('纯文本正文')
    })
  })

  it('includes the reply-to address when configured', async () => {
    await withEnv({ ...fullEnv, SES_REPLY_TO_ADDRESS: 'support@example.com' }, async () => {
      const requests: Record<string, unknown>[] = []
      const mailer = new SesMailer({
        client: fakeClient(async (request) => {
          requests.push(request)
          return { MessageId: 'ses-message-2' }
        }),
      })
      await mailer.send(input)
      expect(requests[0].ReplyToAddresses).toBe('support@example.com')
    })
  })

  it('normalizes provider errors into MailSendError with the provider code', async () => {
    await withEnv(fullEnv, async () => {
      const mailer = new SesMailer({
        client: fakeClient(async () => {
          throw Object.assign(new Error('quota exceeded'), { code: 'SendLimitExceeded' })
        }),
      })
      expect(mailer.send(input)).rejects.toMatchObject({ code: 'SendLimitExceeded', name: 'MailSendError' })
    })
  })

  it('falls back to UNKNOWN when the provider error carries no code', async () => {
    await withEnv(fullEnv, async () => {
      const mailer = new SesMailer({
        client: fakeClient(async () => {
          throw new Error('network down')
        }),
      })
      expect(mailer.send(input)).rejects.toMatchObject({ code: 'UNKNOWN' })
    })
  })
})

describe('MailSendError', () => {
  it('defaults its message to the code', () => {
    const err = new MailSendError('INVALID_PARAMETER')
    expect(err.message).toBe('INVALID_PARAMETER')
  })
})
