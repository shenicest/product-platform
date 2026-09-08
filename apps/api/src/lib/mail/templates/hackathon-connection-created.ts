import type { EmailContent } from '../mailer'
import {
  EMAIL_COLORS,
  EMAIL_FONT_MONO,
  EMAIL_FONT_SANS,
  emailCta,
  emailEyebrow,
  emailField,
  emailNote,
  emailPanelClose,
  emailPanelOpen,
  emailShellClose,
  emailShellOpen,
} from './layout'

export interface HackathonConnectionCreatedInput {
  projectName: string
  projectUrl: string
  purpose: string
  message: string
  createdAt: Date
  connectionsUrl: string
}

const SUBJECT = '[SheNicest] 你的黑客松项目收到一条新的建联申请'

// The email must never carry the sender's authorized contact info (PRD 6.2):
// this template deliberately accepts no contact fields, and everything
// user-controlled is HTML-escaped before interpolation.
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

// Beijing wall-clock time, matching the platform's "daily" semantics.
// Exported because the accepted-outcome template shares it.
export function formatBeijingTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}

const PRIVACY_NOTE =
  '隐私说明：申请方的联系方式不会在邮件中展示。只有项目方接受申请并授权自己的联系方式后，双方才能在平台的连接记录中查看。'

export function renderHackathonConnectionCreatedEmail(input: HackathonConnectionCreatedInput): EmailContent {
  const projectName = escapeHtml(input.projectName)
  const purpose = escapeHtml(input.purpose)
  const message = escapeHtml(input.message)
  const projectUrl = escapeHtml(input.projectUrl)
  const connectionsUrl = escapeHtml(input.connectionsUrl)
  const createdAt = formatBeijingTime(input.createdAt)

  const subject = SUBJECT
  const html = [
    emailShellOpen(),
    emailEyebrow('CONNECTION REQUEST / NEW'),
    `<h2 style="font-size:20px; line-height:1.4; margin:0 0 22px; color:${EMAIL_COLORS.white}; font-family:${EMAIL_FONT_SANS};">你的黑客松项目收到一条新的建联申请</h2>`,
    emailPanelOpen(),
    emailField('项目：', `<a href="${projectUrl}" style="color:${EMAIL_COLORS.pink}; text-decoration:underline;">${projectName}</a>`),
    emailField('联系目的：', purpose),
    `<div style="white-space:pre-wrap; color:${EMAIL_COLORS.white}; font-family:${EMAIL_FONT_SANS}; border-left:2px solid ${EMAIL_COLORS.pink}; margin:14px 0 12px; padding:10px 14px; background:${EMAIL_COLORS.void};">${message}</div>`,
    `<p style="font:13px/1.5 ${EMAIL_FONT_MONO}; color:${EMAIL_COLORS.muted}; margin:0;">申请时间：${createdAt}</p>`,
    emailPanelClose(),
    emailCta('登录平台处理申请', connectionsUrl),
    emailNote(escapeHtml(PRIVACY_NOTE)),
    emailShellClose(),
  ].join('\n')

  const text = [
    '你的黑客松项目收到一条新的建联申请',
    '',
    `项目：${input.projectName}`,
    `项目链接：${input.projectUrl}`,
    `联系目的：${input.purpose}`,
    `申请时间：${createdAt}`,
    '',
    '申请消息：',
    input.message,
    '',
    `登录平台处理申请：${input.connectionsUrl}`,
    '',
    PRIVACY_NOTE,
    '',
    'SHENICEST PLATFORM MESSAGE',
  ].join('\n')

  return { subject, html, text }
}
