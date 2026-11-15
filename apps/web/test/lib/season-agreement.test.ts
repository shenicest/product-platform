import { describe, expect, it } from 'vitest'
import { agreementParagraphs } from '@/lib/season-agreement'

describe('agreementParagraphs', () => {
  it('splits on blank lines and trims each paragraph', () => {
    expect(agreementParagraphs('第一条 参赛资格\n\n第二条 作品要求')).toEqual([
      '第一条 参赛资格',
      '第二条 作品要求',
    ])
  })

  it('keeps single line breaks inside a paragraph', () => {
    expect(agreementParagraphs('第一条 参赛资格\n（1）年满 18 岁')).toEqual([
      '第一条 参赛资格\n（1）年满 18 岁',
    ])
  })

  it('treats runs of blank lines as one separator and drops empty content', () => {
    expect(agreementParagraphs('  A  \n\n\n\n  B  \n\n')).toEqual(['A', 'B'])
  })

  it('returns an empty list for null / blank content', () => {
    expect(agreementParagraphs(null)).toEqual([])
    expect(agreementParagraphs(undefined)).toEqual([])
    expect(agreementParagraphs('   \n\n  ')).toEqual([])
  })
})
