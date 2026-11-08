import { request } from './client-api'
import type {
  CreateSeasonProjectBody,
  ProjectOption,
  PublishRecruitmentCardBody,
  RecruitmentApplicationDto,
  RecruitmentCardDto,
  SeasonProjectDto,
  TeamChallengeDto,
  TeamWorkbenchDto,
} from './team'

/**
 * 组队 tab 的读写客户端。
 *
 * 复用 `client-api` 的 `request`：同源 `/api/*`，浏览器自动带 httpOnly cookie，
 * 统一返回 `{ data, error }` 由表单处理。
 *
 * 为什么不用 eden treaty：组队接口由 api-dev 并行实现，treaty 的类型从
 * `@shenicest/api` 的 `App` 推断 —— 接口还没合并时前端会被类型卡住。
 * 契约文档（`docs/boomland/team-and-recruitment-api.md`）是权威，这里按它写。
 */

/** `GET /seasons/:id/team/me` —— 组队 tab 首屏聚合。 */
export function getTeamWorkbench(seasonId: number) {
  return request<TeamWorkbenchDto>('GET', `/seasons/${seasonId}/team/me`)
}

/** `POST /seasons/:id/projects` —— 发起项目 / 带入已有项目。 */
export function createSeasonProject(seasonId: number, body: CreateSeasonProjectBody) {
  return request<SeasonProjectDto>('POST', `/seasons/${seasonId}/projects`, body)
}

/** `POST /seasons/:id/recruitment-cards` —— 发布招募卡。 */
export function publishRecruitmentCard(
  seasonId: number,
  body: PublishRecruitmentCardBody,
) {
  return request<RecruitmentCardDto>('POST', `/seasons/${seasonId}/recruitment-cards`, body)
}

/** `PATCH /recruitment-cards/:id` —— 关闭 / 重新打开招募卡（仅发起人）。 */
export function updateRecruitmentCard(
  cardId: number,
  body: { status: 'open' | 'closed' },
) {
  return request<RecruitmentCardDto>('PATCH', `/recruitment-cards/${cardId}`, body)
}

/** `POST /recruitment-cards/:id/apply` —— 申请加入别人的招募卡。 */
export function applyToRecruitmentCard(cardId: number, body: { message: string }) {
  return request<RecruitmentApplicationDto>('POST', `/recruitment-cards/${cardId}/apply`, body)
}

/** `PATCH /recruitment-applications/:id` —— 发起人处理收到的申请。 */
export function updateRecruitmentApplication(
  applicationId: number,
  body: { status: 'accepted' | 'declined' },
) {
  return request<RecruitmentApplicationDto>(
    'PATCH',
    `/recruitment-applications/${applicationId}`,
    body,
  )
}

/** `GET /me/recruitment-applications?seasonId=` —— 我发出的申请。 */
export function listMyRecruitmentApplications(seasonId: number) {
  return request<{ items: RecruitmentApplicationDto[]; total: number }>(
    'GET',
    `/me/recruitment-applications?seasonId=${seasonId}`,
  )
}

/** `GET /recruitment-cards/:id/applications` —— 发起人看收到的申请。 */
export function listCardApplications(cardId: number) {
  return request<{ items: RecruitmentApplicationDto[] }>(
    'GET',
    `/recruitment-cards/${cardId}/applications`,
  )
}

/**
 * `POST /seasons/:id/participants/:userId/withdraw` —— 退出赛季。
 *
 * 复用既有接口（契约 §4），不新增。`confirm` 必须为 true：后端用它区分
 * 「误触」与「真的要走」，缺了会 400 `VALIDATION_ERROR`。
 */
export function withdrawSeasonParticipant(seasonId: number, userId: string) {
  return request<unknown>(
    'POST',
    `/seasons/${seasonId}/participants/${encodeURIComponent(userId)}/withdraw`,
    { confirm: true },
  )
}

/** `GET /seasons/:id/challenges` —— 发起项目弹窗里的命题选项（只要已发布）。 */
export function listSeasonChallenges(seasonId: number) {
  return request<{ items: TeamChallengeDto[] }>(
    'GET',
    `/seasons/${seasonId}/challenges`,
  )
}

/**
 * `GET /founder/projects` —— 「带入已有项目」的下拉候选。
 *
 * 这条接口要求 Founder 角色；没有角色的账号会拿到 403，调用方按「没有可带入
 * 项目」处理（弹窗里仍可新建）。
 */
export function listMyProjects() {
  return request<{ data: ProjectOption[]; total: number }>(
    'GET',
    '/founder/projects?limit=100',
  )
}
