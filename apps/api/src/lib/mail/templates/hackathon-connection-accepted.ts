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
    emailShellOpen(),
    emailEyebrow('CONNECTION REQUEST / ACCEPTED'),
    `<h2 style="font-size:20px; line-height:1.4; margin:0 0 22px; color:${EMAIL_COLORS.white}; font-family:${EMAIL_FONT_SANS};">你的建联申请已被项目方接受</h2>`,
    emailPanelOpen(),
    emailField('项目：', `<a href="${projectUrl}" style="color:${EMAIL_COLORS.pink}; text-decoration:underline;">${projectName}</a>`),
    `<p style="font:13px/1.5 ${EMAIL_FONT_MONO}; color:${EMAIL_COLORS.muted}; margin:0 0 10px;">接受时间：${acceptedAt}</p>`,
    `<p style="font-family:${EMAIL_FONT_SANS}; font-size:15px; margin:0;">项目方已授权自己的联系方式，现在双方都可以在平台的<strong style="color:${EMAIL_COLORS.pink};">连接记录</strong>中查看对方本次授权的联系方式。</p>`,
    emailPanelClose(),
    emailCta('登录平台查看联系方式', connectionsUrl),
    emailNote('为保护双方隐私，联系方式只在平台连接记录中展示，不会出现在邮件里。'),
    emailShellClose(),
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
    '',
    'SHENICEST PLATFORM MESSAGE',
  ].join('\n')

  return { subject, html, text }
}
