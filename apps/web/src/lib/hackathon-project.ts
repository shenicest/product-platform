export function stripTrackAppendix(description: string | null | undefined) {
  if (!description) return ''
  return description
    .replace(/\s*---+\s*(?:\r?\n\s*)?G001[^\r\n]*赛道附加材料[\s\S]*$/i, '')
    .trim()
}
