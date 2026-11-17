import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_SHARE_IMAGE,
  NO_INDEX_ROBOTS,
  SHARE_DESCRIPTION_MAX_LENGTH,
  SITE_DESCRIPTION,
  SITE_LOCALE,
  SITE_NAME,
  SITE_TITLE,
  pageMetadata,
  resolveSiteUrl,
  truncateDescription,
} from '@/lib/site-metadata'

describe('pageMetadata', () => {
  it('一次给全 og / twitter / canonical，避免子页面漏字段被整体替换', () => {
    const meta = pageMetadata({
      title: '项目 A',
      description: '一句话介绍',
      path: '/projects/1',
      type: 'article',
    })

    expect(meta.title).toBe('项目 A')
    expect(meta.description).toBe('一句话介绍')
    expect(meta.alternates).toEqual({ canonical: '/projects/1' })
    expect(meta.openGraph).toEqual({
      title: '项目 A',
      description: '一句话介绍',
      url: '/projects/1',
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      type: 'article',
      images: [DEFAULT_SHARE_IMAGE],
    })
    expect(meta.twitter).toEqual({
      card: 'summary_large_image',
      title: '项目 A',
      description: '一句话介绍',
      images: [DEFAULT_SHARE_IMAGE.url],
    })
  })

  it('没有标题时退回站点标题，没有描述时退回站点描述', () => {
    const meta = pageMetadata({ path: '/talents' })
    expect(meta.title).toBeUndefined()
    expect(meta.openGraph?.title).toBe(SITE_TITLE)
    expect(meta.description).toBe(SITE_DESCRIPTION)
    expect(meta.openGraph?.description).toBe(SITE_DESCRIPTION)
  })

  it('空白描述也算没有描述', () => {
    const meta = pageMetadata({ path: '/talents', description: '   ' })
    expect(meta.description).toBe(SITE_DESCRIPTION)
  })

  it('页面自己的封面优先，且保持原顺序', () => {
    const meta = pageMetadata({
      title: '项目 A',
      path: '/projects/1',
      images: [{ url: 'https://assets.example.com/a.jpg', alt: 'A' }],
    })
    expect(meta.openGraph?.images).toEqual([
      { url: 'https://assets.example.com/a.jpg', alt: 'A' },
    ])
    expect(meta.twitter?.images).toEqual(['https://assets.example.com/a.jpg'])
  })

  it('默认是 website，详情页可指定 article', () => {
    // `openGraph` 在 Next 的类型里是联合类型，不是每个成员都有 `type`，
    // 所以用 toMatchObject 断言，而不是直接读属性。
    expect(pageMetadata({ path: '/' }).openGraph).toMatchObject({ type: 'website' })
    expect(
      pageMetadata({ path: '/challenges/1', type: 'article' }).openGraph,
    ).toMatchObject({ type: 'article' })
  })

  it('noIndex 时附上 robots，其它页面不带 robots', () => {
    expect(pageMetadata({ path: '/me', noIndex: true }).robots).toEqual(
      NO_INDEX_ROBOTS,
    )
    expect(pageMetadata({ path: '/' }).robots).toBeUndefined()
  })
})

describe('truncateDescription', () => {
  it('压缩换行与多余空白', () => {
    expect(truncateDescription('第一行\n\n第二行   同一行')).toBe(
      '第一行 第二行 同一行',
    )
  })

  it('正好等于上限时不截断', () => {
    const text = 'a'.repeat(SHARE_DESCRIPTION_MAX_LENGTH)
    expect(truncateDescription(text)).toBe(text)
  })

  it('超出上限时截到上限并补省略号', () => {
    const text = 'a'.repeat(SHARE_DESCRIPTION_MAX_LENGTH + 10)
    const result = truncateDescription(text)
    expect(result).toHaveLength(SHARE_DESCRIPTION_MAX_LENGTH)
    expect(result.endsWith('…')).toBe(true)
  })
})

describe('resolveSiteUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('优先 NEXT_PUBLIC_SITE_URL', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://site.example.com')
    vi.stubEnv('SHENICEST_WEB_BASE_URL', 'https://fallback.example.com')
    expect(resolveSiteUrl().toString()).toBe('https://site.example.com/')
  })

  it('没有 NEXT_PUBLIC_SITE_URL 时退回 SHENICEST_WEB_BASE_URL', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    vi.stubEnv('SHENICEST_WEB_BASE_URL', 'https://fallback.example.com')
    expect(resolveSiteUrl().toString()).toBe('https://fallback.example.com/')
  })

  it('都没配时退回本地默认值', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    vi.stubEnv('SHENICEST_WEB_BASE_URL', '')
    expect(resolveSiteUrl().toString()).toBe('http://localhost:3000/')
  })

  it('非法域名直接抛错，避免悄悄生成 localhost 卡片', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'not a url')
    expect(() => resolveSiteUrl()).toThrow(/is not a valid URL/)
  })
})
