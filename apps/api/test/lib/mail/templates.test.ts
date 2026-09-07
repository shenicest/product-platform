import { describe, expect, it } from 'bun:test'
import { renderHackathonConnectionAcceptedEmail } from '../../../src/lib/mail/templates/hackathon-connection-accepted'
import { renderHackathonConnectionCreatedEmail } from '../../../src/lib/mail/templates/hackathon-connection-created'

const baseInput = {
  projectName: '月事轻记',
  projectUrl: 'https://shenicest.test/hackathon/projects/42',
  senderNickname: '林晓',
  purpose: '合作交流',
  message: '我们正在做相近方向的产品，希望交流产品设计与用户验证经验。',
  createdAt: new Date('2026-09-07T02:00:00Z'),
  connectionsUrl: 'https://shenicest.test/connections',
}

describe('renderHackathonConnectionCreatedEmail', () => {
  it('uses the fixed PRD subject', () => {
    const email = renderHackathonConnectionCreatedEmail(baseInput)
    expect(email.subject).toBe('[Shenicest] 你的黑客松项目收到一条新的建联申请')
  })

  it('renders project, sender, purpose, message, and links in both versions', () => {
    const email = renderHackathonConnectionCreatedEmail(baseInput)
    for (const body of [email.html, email.text]) {
      expect(body).toContain('月事轻记')
      expect(body).toContain('林晓')
      expect(body).toContain('合作交流')
      expect(body).toContain('我们正在做相近方向的产品，希望交流产品设计与用户验证经验。')
      expect(body).toContain('https://shenicest.test/hackathon/projects/42')
      expect(body).toContain('https://shenicest.test/connections')
    }
    expect(email.html).toContain('<a href="https://shenicest.test/hackathon/projects/42">')
    expect(email.html).toContain('<a href="https://shenicest.test/connections"')
  })

  it('escapes html-sensitive characters in user input but keeps the text version raw', () => {
    const email = renderHackathonConnectionCreatedEmail({
      ...baseInput,
      projectName: 'A&B "<img src=x onerror=1>',
      message: '<script>alert("x")</script> & <b>bold</b>',
    })
    expect(email.html).not.toContain('<script>')
    expect(email.html).not.toContain('<b>')
    expect(email.html).not.toContain('<img')
    expect(email.html).toContain('&lt;script&gt;')
    expect(email.html).toContain('A&amp;B &quot;&lt;img')
    expect(email.text).toContain('<script>alert("x")</script>')
  })

  it('never includes contact info fields or mailto links', () => {
    const email = renderHackathonConnectionCreatedEmail(baseInput)
    expect(email.html).not.toContain('mailto:')
    expect(email.text).not.toContain('mailto:')
    expect(JSON.stringify(email)).not.toContain('wechat')
    expect(JSON.stringify(email)).not.toContain('senderContact')
  })

  it('formats the created time in Beijing time', () => {
    const email = renderHackathonConnectionCreatedEmail(baseInput)
    expect(email.html).toContain('申请时间：2026-09-07 10:00')
    expect(email.text).toContain('申请时间：2026-09-07 10:00')
  })
})

const acceptedBaseInput = {
  projectName: '月事轻记',
  projectUrl: 'https://shenicest.test/hackathon/projects/42',
  acceptedAt: new Date('2026-09-07T02:00:00Z'),
  connectionsUrl: 'https://shenicest.test/connections',
}

describe('renderHackathonConnectionAcceptedEmail', () => {
  it('tells the sender the request was accepted and links the connections page', () => {
    const email = renderHackathonConnectionAcceptedEmail(acceptedBaseInput)
    expect(email.subject).toBe('[Shenicest] 你的建联申请已被项目方接受')
    for (const body of [email.html, email.text]) {
      expect(body).toContain('月事轻记')
      expect(body).toContain('https://shenicest.test/hackathon/projects/42')
      expect(body).toContain('https://shenicest.test/connections')
    }
    expect(email.html).toContain('<a href="https://shenicest.test/connections"')
  })

  it('escapes project input and never includes contact info', () => {
    const email = renderHackathonConnectionAcceptedEmail({
      ...acceptedBaseInput,
      projectName: 'A&B "<img src=x onerror=1>',
    })
    expect(email.html).not.toContain('<img')
    expect(email.html).toContain('A&amp;B &quot;&lt;img')
    expect(JSON.stringify(email)).not.toContain('wechat')
    expect(JSON.stringify(email)).not.toContain('receiverContact')
    expect(email.html).not.toContain('mailto:')
  })

  it('formats the accepted time in Beijing time', () => {
    const email = renderHackathonConnectionAcceptedEmail(acceptedBaseInput)
    expect(email.html).toContain('接受时间：2026-09-07 10:00')
    expect(email.text).toContain('接受时间：2026-09-07 10:00')
  })
})
