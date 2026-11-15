import { Elysia } from 'elysia'
import { dbPlugin } from '../../plugins/db'
import { authPlugin } from '../../plugins/auth'
import { db } from '../../db'
import { ErrorResponse } from '../../common'
import {
  AnnouncementListQuery,
  AnnouncementListResponse,
  AnnouncementSummaryResponse,
  MarkAllReadResponse,
} from './model'
import { AnnouncementService } from './service'

export const announcementService = new AnnouncementService(db)

/**
 * 公告（收件箱）路由。
 *
 * 三个接口都只操作「调用者自己」——路径里没有 userId，service 只接收
 * `user.userId`，从接口形状上就不存在读别人公告的越权入口。
 *
 * 发布接口不在这里：本期全站公告由种子/脚本调 `announcementService.publishGlobal()`，
 * 运营后台表单与 `POST /operator/announcements` 推后（见 docs/announcement-center.md §6）。
 */
export const announcementModule = new Elysia()
  .use(dbPlugin)
  .use(authPlugin)
  .model({
    AnnouncementListQuery,
    AnnouncementListResponse,
    AnnouncementSummaryResponse,
    MarkAllReadResponse,
  })
  .prefix('model', 'Announcement.')
  .get('/me/announcements/summary', async ({ user }) => announcementService.summary(user.userId), {
    auth: true,
    detail: {
      tags: ['Announcement'],
      summary: 'Unread announcement count and read watermark for the current user',
    },
    response: { 200: 'Announcement.AnnouncementSummaryResponse', 401: ErrorResponse },
  })
  .get('/me/announcements', async ({ user, query }) => announcementService.list(user.userId, query), {
    auth: true,
    query: 'Announcement.AnnouncementListQuery',
    detail: {
      tags: ['Announcement'],
      summary: 'List global and user-targeted announcements, newest first',
    },
    response: { 200: 'Announcement.AnnouncementListResponse', 401: ErrorResponse },
  })
  .post('/me/announcements/read-all', async ({ user }) => announcementService.markAllRead(user.userId), {
    auth: true,
    detail: {
      tags: ['Announcement'],
      summary: 'Mark every announcement as read (advance the per-user read watermark)',
    },
    response: { 200: 'Announcement.MarkAllReadResponse', 401: ErrorResponse },
  })
