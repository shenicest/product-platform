// Shared dark "SheNicest" shell for notification emails (docs/ui-kit-standalone.html).
//
// Design token mapping: void background carries space, signal white carries
// reading, pink is reserved for key actions and data (≤20% area). The site's
// Monocraft / HarmonySN / DSEG7 cannot load in email clients, so the mono
// roles fall back to web-safe Courier/monospace and Chinese text to the
// PingFang / Microsoft YaHei stack. Everything is inline styles with hard
// edges (no border-radius) and no animations, reducing-motion safe by nature.

export const EMAIL_FONT_SANS = "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif"
export const EMAIL_FONT_MONO = "'Courier New', Menlo, monospace"

export const EMAIL_COLORS = {
  void: '#08080b',
  surface: '#15141a',
  pink: '#ff2da6',
  deepPink: '#91245f',
  white: '#f7f7f4',
  muted: '#a8a5ae',
  line: '#3d3740',
} as const

// Brand wordmark with the pink signal span, like the site topbar.
export function emailBrandMark(): string {
  return `<div style="font:22px/1 ${EMAIL_FONT_MONO}; color:${EMAIL_COLORS.white}; letter-spacing:.02em; margin:32px 0 24px;">SHE<span style="color:${EMAIL_COLORS.pink};">NICEST</span>:</div>`
}

// Mono eyebrow label — the site's label/meta tier (12px, letterspaced pink).
export function emailEyebrow(text: string): string {
  return `<p style="font:12px/1.4 ${EMAIL_FONT_MONO}; color:${EMAIL_COLORS.pink}; letter-spacing:.12em; margin:0 0 18px;">${text}</p>`
}

// Terminal-panel container for structured fields (PRD pattern 05: terminal card).
export function emailPanelOpen(): string {
  return `<div style="background:${EMAIL_COLORS.surface}; border:1px solid ${EMAIL_COLORS.line}; padding:18px 20px; margin:0 0 26px;">`
}

export function emailPanelClose(): string {
  return `</div>`
}

// Meta value row inside a panel. `value` is caller-escaped.
export function emailField(label: string, valueHtml: string): string {
  return `<p style="font-family:${EMAIL_FONT_SANS}; font-size:15px; margin:0 0 10px;"><span style="color:${EMAIL_COLORS.muted};">${label}</span>${valueHtml}</p>`
}

// Primary action: hard-edged pink block, void label (kit button.primary).
export function emailCta(label: string, url: string): string {
  return `<a href="${url}" style="display:inline-block; background:${EMAIL_COLORS.pink}; border:2px solid ${EMAIL_COLORS.pink}; color:${EMAIL_COLORS.void}; font:700 15px/1.2 ${EMAIL_FONT_SANS}; letter-spacing:.01em; padding:13px 22px; text-decoration:none;">${label}</a>`
}

export function emailNote(text: string): string {
  return `<p style="font:11px/1.5 ${EMAIL_FONT_MONO}; color:${EMAIL_COLORS.muted}; margin:18px 0 0;">${text}</p>`
}

export function emailShellOpen(): string {
  return [
    `<div style="background:${EMAIL_COLORS.void}; background-image:radial-gradient(circle at 72% 0%, rgba(58,34,77,.32), transparent 42%);">`,
    // Hazard edge: 6px signal strip; gradient-striped like the site, solid fallback.
    `<div style="height:6px; background:${EMAIL_COLORS.deepPink}; background-image:repeating-linear-gradient(55deg, #91245f 0 15px, transparent 15px 29px);"></div>`,
    `<div style="max-width:560px; margin:0 auto; padding:0 24px 40px; color:${EMAIL_COLORS.white}; font-family:${EMAIL_FONT_SANS}; line-height:1.6; font-size:15px;">`,
    emailBrandMark(),
  ].join('\n')
}

export function emailShellClose(): string {
  return [
    `<p style="font:10px ${EMAIL_FONT_MONO}; color:${EMAIL_COLORS.muted}; letter-spacing:.08em; margin:28px 0 0; border-top:1px solid ${EMAIL_COLORS.line}; padding-top:16px;">SHENICEST PLATFORM MESSAGE</p>`,
    `</div>`,
    `</div>`,
  ].join('\n')
}
