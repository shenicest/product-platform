import type { EmailContent } from '../mailer'

export interface HackathonConnectionCreatedInput {
  projectName: string
  projectUrl: string
  senderNickname: string
  purpose: string
  message: string
  createdAt: Date
  connectionsUrl: string
}

const SUBJECT = '[Shenicest] 你的黑客松项目收到一条新的建联申请'

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
  const senderNickname = escapeHtml(input.senderNickname)
  const purpose = escapeHtml(input.purpose)
  const message = escapeHtml(input.message)
  const projectUrl = escapeHtml(input.projectUrl)
  const connectionsUrl = escapeHtml(input.connectionsUrl)
  const createdAt = formatBeijingTime(input.createdAt)

  const subject = SUBJECT
  const html = [
    `<div style="font-family: -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; max-width: 560px; margin: 0 auto; color: #1f2329; line-height: 1.6;">`,
    `<h2 style="font-size: 18px; margin: 24px 0 16px;">你的黑客松项目收到一条新的建联申请</h2>`,
    `<p><strong>项目：</strong><a href="${projectUrl}">${projectName}</a></p>`,
    `<p><strong>申请人：</strong>${senderNickname}</p>`,
    `<p><strong>联系目的：</strong>${purpose}</p>`,
    `<div style="white-space: pre-wrap; background: #f5f6f7; border-radius: 8px; padding: 12px 16px; margin: 12px 0;">${message}</div>`,
    `<p style="color: #646a73; font-size: 13px;">申请时间：${createdAt}</p>`,
    `<p><a href="${connectionsUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 6px;">登录平台处理申请</a></p>`,
    `<p style="font-size: 12px; color: #8f959e;">${PRIVACY_NOTE}</p>`,
    `</div>`,
  ].join('\n')

  const text = [
    '你的黑客松项目收到一条新的建联申请',
    '',
    `项目：${input.projectName}`,
    `项目链接：${input.projectUrl}`,
    `申请人：${input.senderNickname}`,
    `联系目的：${input.purpose}`,
    `申请时间：${createdAt}`,
    '',
    '申请消息：',
    input.message,
    '',
    `登录平台处理申请：${input.connectionsUrl}`,
    '',
    PRIVACY_NOTE,
  ].join('\n')

  return { subject, html, text }
}
