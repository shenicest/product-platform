import { t } from 'elysia'

// 取值与 @shenicest/shared 的 AnnouncementType / AnnouncementLevel 一致。
// 这里显式写字面量（与 season-application/model.ts 同一做法）：TypeBox 的
// Union 需要确定的元素类型，而从 shared 的对象推导出来会让类型退化成 string。
const AnnouncementTypeSchema = t.Union([
  t.Literal('system'),
  t.Literal('season'),
  t.Literal('application'),
  t.Literal('team'),
  t.Literal('challenge'),
])

const AnnouncementLevelSchema = t.Union([
  t.Literal('info'),
  t.Literal('success'),
  t.Literal('warning'),
])

export const AnnouncementSummaryResponse = t.Object({
  unreadCount: t.Number({ description: '精确未读数；前端超过 99 时展示 99+' }),
  lastReadAt: t.Union([t.String(), t.Null()], {
    description: 'ISO 时间；null 表示从未点过「全部已读」，即全部可见公告都算未读',
  }),
})
export type AnnouncementSummaryResponse = typeof AnnouncementSummaryResponse.static

export const AnnouncementItem = t.Object({
  id: t.Number(),
  type: AnnouncementTypeSchema,
  level: AnnouncementLevelSchema,
  title: t.String(),
  content: t.String({ description: '纯文本，前端按换行渲染' }),
  linkPath: t.Union([t.String(), t.Null()], { description: '站内相对路径' }),
  seasonId: t.Union([t.Number(), t.Null()]),
  publishedAt: t.String({ description: 'ISO 时间' }),
  isRead: t.Boolean({ description: 'lastReadAt != null 且 publishedAt <= lastReadAt' }),
})
export type AnnouncementItem = typeof AnnouncementItem.static

export const AnnouncementListQuery = t.Object({
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50, description: '默认 20' })),
  cursor: t.Optional(
    t.String({
      pattern: '^\\d+_\\d+$',
      description: '上一页最后一条的 <publishedAt 毫秒>_<id>',
    }),
  ),
  unreadOnly: t.Optional(t.Union([t.Literal('true'), t.Literal('false')])),
})
export type AnnouncementListQuery = typeof AnnouncementListQuery.static

export const AnnouncementListResponse = t.Object({
  items: t.Array(AnnouncementItem),
  nextCursor: t.Union([t.String(), t.Null()]),
  unreadCount: t.Number({ description: '全量未读数，不受 unreadOnly 影响' }),
})
export type AnnouncementListResponse = typeof AnnouncementListResponse.static

export const MarkAllReadResponse = t.Object({
  lastReadAt: t.String({ description: '推进后的读水位线（ISO）' }),
  unreadCount: t.Literal(0),
})
export type MarkAllReadResponse = typeof MarkAllReadResponse.static
