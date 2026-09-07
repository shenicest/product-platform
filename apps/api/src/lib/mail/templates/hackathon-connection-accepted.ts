import type { EmailContent } from '../mailer'
import { escapeHtml, formatBeijingTime } from './hackathon-connection-created'

export interface HackathonConnectionAcceptedInput {
  projectName: string
  projectUrl: string
  acceptedAt: Date
  connectionsUrl: string
}

const SUBJECT = '[Shenicest] 你的建联申请已被项目方接受'

// Accepted-outcome email to the sender (PRD 21.6, revised decision). Same
// privacy line as the created-email: never carries either party's authorized
// contact info — the platform connections page is where contacts unlock.
export function renderHackathonConnectionAcceptedEmail(input: HackathonConnectionAcceptedInput): EmailContent {
  const projectName = escapeHtml(input.projectName)
  const projectUrl = escapeHtml(input.projectUrl)
  const connectionsUrl = escapeHtml(input.connectionsUrl)
  const acceptedAt = formatBeijingTime(input.acceptedAt)

  const subject = SUBJECT
  const html = [
    `<div style="font-family: -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; max-width: 560px; margin: 0 auto; color: #1f2329; line-height: 1.6;">`,
    `<h2 style="font-size: 18px; margin: 24px 0 16px;">你的建联申请已被项目方接受</h2>`,
    `<p><strong>项目：</strong><a href="${projectUrl}">${projectName}</a></p>`,
    `<p style="color: #646a73; font-size: 13px;">接受时间：${acceptedAt}</p>`,
    `<p>项目方已授权自己的联系方式，现在双方都可以在平台的连接记录中查看对方本次授权的联系方式。</p>`,
    `<p><a href="${connectionsUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 6px;">登录平台查看联系方式</a></p>`,
    `<p style="font-size: 12px; color: #8f959e;">为保护双方隐私，联系方式只在平台连接记录中展示，不会出现在邮件里。</p>`,
    `</div>`,
  ].join('\n')

  const text = [
    '你的建联申请已被项目方接受',
    '',
    `项目：${input.projectName}`,
    `项目链接：${input.projectUrl}`,
    `接受时间：${acceptedAt}`,
    '',
    '项目方已授权自己的联系方式，现在双方都可以在平台的连接记录中查看对方本次授权的联系方式。',
    '',
    `登录平台查看联系方式：${input.connectionsUrl}`,
    '',
    '为保护双方隐私，联系方式不会出现在邮件里。',
  ].join('\n')

  return { subject, html, text }
}
