/**
 * 公开协议页的纯函数工具。
 *
 * 协议正文是纯文本，按**空行**分段：单个换行保留为段内换行（渲染时用
 * `white-space: pre-wrap`），连续空行只算一个分段符。这样主办方在后台
 * 直接贴一段带缩进/编号的文本，公开页也不会被压成一整块。
 */
export function agreementParagraphs(content: string | null | undefined): string[] {
  if (!content) return []
  return content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
}
