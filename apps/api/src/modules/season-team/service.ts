import { and, asc, count, desc, eq, inArray, ne, or } from 'drizzle-orm'
import {
  ChallengeStatus,
  ProjectStatus,
  RecruitmentApplicationStatus,
  RecruitmentCardStatus,
  SeasonParticipantStatus,
  SeasonProjectMemberRole,
  SeasonProjectMemberStatus,
  SeasonProjectSource,
  SeasonProjectStatus,
} from '@shenicest/shared'
import type { Database } from '../../db'
import {
  challenges,
  projects,
  recruitmentApplications,
  recruitmentCards,
  seasonApplications,
  seasonParticipants,
  seasonProjectMembers,
  seasonProjects,
  seasons,
} from '../../db/schema'
import { UserProfileService } from '../user/service'
import type { PublicProfile } from '../user/model'
import {
  BoomlandAccessService,
  boomlandError,
  getSeasonSummary,
  iso,
  writeAudit,
} from '../boomland-shared'
import type {
  ApplyRecruitmentCardBody,
  CreateSeasonProjectBody,
  PublishRecruitmentCardBody,
  SeasonProjectQuery,
  UpdateRecruitmentApplicationBody,
  UpdateRecruitmentCardBody,
} from './model'

type SeasonRow = typeof seasons.$inferSelect
type SeasonProjectRow = typeof seasonProjects.$inferSelect
type SeasonProjectMemberRow = typeof seasonProjectMembers.$inferSelect
type RecruitmentCardRow = typeof recruitmentCards.$inferSelect
type RecruitmentApplicationRow = typeof recruitmentApplications.$inferSelect
type ProjectRow = typeof projects.$inferSelect

/** 招募卡 / 申请的截止判断基准：一处 now，避免同一次请求里两处时间不一致。 */
function isPast(date: Date, now: Date): boolean {
  return date.getTime() < now.getTime()
}

/**
 * 成员 / 申请人的公开资料。
 *
 * 昵称头像在外部 `users` 表里，一个用户一次查询。列表路径先整批取一次再查表，
 * 不在 `map` 里逐条 await —— 与 `listParticipants` 里 `applicationsById` 的做法一致。
 */
type ProfileMap = Map<string, PublicProfile | null>

export class SeasonTeamService {
  private access: BoomlandAccessService
  private users: UserProfileService

  constructor(private db: Database) {
    this.access = new BoomlandAccessService(db)
    this.users = new UserProfileService(db)
  }

  // -------------------------------------------------------------------------
  // 内部工具
  // -------------------------------------------------------------------------

  private async getSeason(seasonId: number): Promise<SeasonRow> {
    const rows = await this.db.select().from(seasons).where(eq(seasons.id, seasonId)).limit(1)
    if (!rows[0]) throw boomlandError('SEASON_NOT_FOUND', '赛季不存在', 404)
    return rows[0]
  }

  private async profileMap(userIds: string[]): Promise<ProfileMap> {
    const unique = [...new Set(userIds)]
    const entries = await Promise.all(unique.map(async (userId) => {
      return [userId, await this.users.getPublicProfile(userId)] as const
    }))
    return new Map(entries)
  }

  private profileDto(userId: string, profiles: ProfileMap) {
    const profile = profiles.get(userId)
    return {
      userId,
      name: profile?.nickname ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
    }
  }

  /**
   * 该赛季的 active 选手行；不是选手时抛 `NOT_SEASON_PARTICIPANT`。
   *
   * 组队相关的写操作全部要求「本人是选手」——主办方替选手发起项目没有业务意义，
   * 而且 `season_projects.owner_user_id` 必须能对上成员行。
   */
  private async requireParticipant(seasonId: number, userId: string) {
    const rows = await this.db
      .select()
      .from(seasonParticipants)
      .where(
        and(
          eq(seasonParticipants.seasonId, seasonId),
          eq(seasonParticipants.userId, userId),
        ),
      )
      .limit(1)
    const row = rows[0]
    if (!row || row.status !== SeasonParticipantStatus.Active) {
      throw boomlandError('NOT_SEASON_PARTICIPANT', '只有该赛季的选手可以组队', 409)
    }
    return row
  }

  private assertTeamDeadlineOpen(season: SeasonRow, now: Date) {
    if (season.teamDeadline && isPast(season.teamDeadline, now)) {
      throw boomlandError('TEAM_DEADLINE_PASSED', '组队已截止，不能再发起或带入项目', 409, {
        detail: { teamDeadline: iso(season.teamDeadline) },
      })
    }
  }

  /**
   * 组装 `SeasonProject` DTO（契约 §3）。
   *
   * 一次批量取齐：项目内容（名称 / 简介）、成员行、命题、以及每个命题已被多少项目选中。
   * `selectedCount` 用「该赛季所有未归档赛季项目的 challengeIds」在内存里计数，
   * 而不是逐命题发一条 count —— 一个赛季的命题数与项目数都是几十的量级。
   */
  private async projectDtos(rows: SeasonProjectRow[]) {
    if (rows.length === 0) return []
    const projectIds = [...new Set(rows.map((row) => row.projectId))]
    const seasonProjectIds = rows.map((row) => row.id)
    const seasonIds = [...new Set(rows.map((row) => row.seasonId))]
    const challengeIds = [...new Set(rows.flatMap((row) => row.challengeIds ?? []))]
    const [projectRows, memberRows, challengeRows, siblingRows] = await Promise.all([
      this.db
        .select({ id: projects.id, name: projects.name, tagline: projects.tagline })
        .from(projects)
        .where(inArray(projects.id, projectIds)),
      this.db
        .select()
        .from(seasonProjectMembers)
        .where(inArray(seasonProjectMembers.seasonProjectId, seasonProjectIds))
        .orderBy(asc(seasonProjectMembers.id)),
      challengeIds.length > 0
        ? this.db
          .select({
            id: challenges.id,
            title: challenges.title,
            type: challenges.type,
            capacity: challenges.capacity,
          })
          .from(challenges)
          .where(inArray(challenges.id, challengeIds))
        : Promise.resolve([] as Array<{ id: number; title: string; type: string | null; capacity: number | null }>),
      this.db
        .select({
          seasonId: seasonProjects.seasonId,
          challengeIds: seasonProjects.challengeIds,
        })
        .from(seasonProjects)
        .where(and(
          inArray(seasonProjects.seasonId, seasonIds),
          ne(seasonProjects.status, SeasonProjectStatus.Archived),
        )),
    ])

    const projectsById = new Map(projectRows.map((row) => [row.id, row]))
    const challengesById = new Map(challengeRows.map((row) => [row.id, row]))
    const membersByProject = new Map<number, SeasonProjectMemberRow[]>()
    for (const member of memberRows) {
      const list = membersByProject.get(member.seasonProjectId)
      if (list) list.push(member)
      else membersByProject.set(member.seasonProjectId, [member])
    }
    const selectedCounts = new Map<string, number>()
    for (const sibling of siblingRows) {
      for (const challengeId of sibling.challengeIds ?? []) {
        const key = `${sibling.seasonId}:${challengeId}`
        selectedCounts.set(key, (selectedCounts.get(key) ?? 0) + 1)
      }
    }
    const profiles = await this.profileMap(memberRows.map((member) => member.userId))

    return rows.map((row) => {
      const project = projectsById.get(row.projectId)
      const memberRowsForProject = membersByProject.get(row.id) ?? []
      return {
        id: row.id,
        seasonId: row.seasonId,
        projectId: row.projectId,
        ownerUserId: row.ownerUserId,
        source: row.source,
        name: project?.name ?? '',
        tagline: project?.tagline ?? null,
        themes: row.themes ?? [],
        challengeIds: row.challengeIds ?? [],
        challenges: (row.challengeIds ?? []).map((challengeId) => {
          const challenge = challengesById.get(challengeId)
          return {
            id: challengeId,
            title: challenge?.title ?? '',
            type: challenge?.type ?? null,
            capacity: challenge?.capacity ?? null,
            selectedCount: selectedCounts.get(`${row.seasonId}:${challengeId}`) ?? 0,
          }
        }),
        status: row.status,
        // 生长阶段（契约 §1.4）：只做展示，阶段流转接口不在本批。
        stage: row.stage,
        members: memberRowsForProject.map((member) => ({
          userId: member.userId,
          name: profiles.get(member.userId)?.nickname ?? null,
          avatarUrl: profiles.get(member.userId)?.avatarUrl ?? null,
          role: member.role,
          status: member.status,
        })),
        createdAt: iso(row.createdAt)!,
        updatedAt: iso(row.updatedAt)!,
      }
    })
  }

  /** 单个赛季项目 DTO；写操作回读时用。 */
  private async projectDto(seasonProjectId: number) {
    const rows = await this.db
      .select()
      .from(seasonProjects)
      .where(eq(seasonProjects.id, seasonProjectId))
      .limit(1)
    if (!rows[0]) throw boomlandError('SEASON_PROJECT_NOT_FOUND', '赛季项目不存在', 404)
    const [dto] = await this.projectDtos([rows[0]])
    return dto!
  }

  /** 招募卡 DTO（契约 §3）：带项目名、发起人资料与申请数。 */
  private async cardDtos(rows: RecruitmentCardRow[]) {
    if (rows.length === 0) return []
    const cardIds = rows.map((row) => row.id)
    const seasonProjectIds = [...new Set(rows.map((row) => row.seasonProjectId))]
    const [seasonProjectRows, applicationCounts, profiles] = await Promise.all([
      this.db
        .select({ id: seasonProjects.id, projectId: seasonProjects.projectId })
        .from(seasonProjects)
        .where(inArray(seasonProjects.id, seasonProjectIds)),
      this.db
        .select({ cardId: recruitmentApplications.cardId, value: count() })
        .from(recruitmentApplications)
        .where(inArray(recruitmentApplications.cardId, cardIds))
        .groupBy(recruitmentApplications.cardId),
      this.profileMap(rows.map((row) => row.creatorUserId)),
    ])
    const projectIds = [...new Set(seasonProjectRows.map((row) => row.projectId))]
    const projectRows = projectIds.length > 0
      ? await this.db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(inArray(projects.id, projectIds))
      : []
    const projectNamesById = new Map(projectRows.map((row) => [row.id, row.name]))
    const seasonProjectById = new Map(seasonProjectRows.map((row) => [row.id, row]))
    const countsByCard = new Map(applicationCounts.map((row) => [row.cardId, row.value]))

    return rows.map((row) => {
      const seasonProject = seasonProjectById.get(row.seasonProjectId)
      const projectName = seasonProject ? projectNamesById.get(seasonProject.projectId) ?? '' : ''
      return {
        id: row.id,
        seasonId: row.seasonId,
        seasonProjectId: row.seasonProjectId,
        projectName,
        creatorUserId: row.creatorUserId,
        creator: this.profileDto(row.creatorUserId, profiles),
        roles: row.roles ?? [],
        skills: row.skills ?? [],
        description: row.description,
        deadline: iso(row.deadline)!,
        status: row.status,
        applicationCount: countsByCard.get(row.id) ?? 0,
        createdAt: iso(row.createdAt)!,
        updatedAt: iso(row.updatedAt)!,
      }
    })
  }

  private async cardDto(cardId: number) {
    const rows = await this.db
      .select()
      .from(recruitmentCards)
      .where(eq(recruitmentCards.id, cardId))
      .limit(1)
    if (!rows[0]) throw boomlandError('RECRUITMENT_CARD_NOT_FOUND', '招募卡不存在', 404)
    const [dto] = await this.cardDtos([rows[0]])
    return dto!
  }

  /**
   * 招募申请 DTO（契约 §3）。
   *
   * `card` 摘要是申请列表的唯一上下文：工作台「我的申请」只拿得到申请行，
   * 没有项目名就分不清投的是哪一张卡。项目名要 join 两次
   * （`recruitment_cards` → `season_projects` → `projects`），所以整批取。
   */
  private async applicationDtos(rows: RecruitmentApplicationRow[]) {
    if (rows.length === 0) return []
    const cardIds = [...new Set(rows.map((row) => row.cardId))]
    const cardRows = await this.db
      .select()
      .from(recruitmentCards)
      .where(inArray(recruitmentCards.id, cardIds))
    const seasonProjectIds = [...new Set(cardRows.map((row) => row.seasonProjectId))]
    const [seasonProjectRows, profiles] = await Promise.all([
      seasonProjectIds.length > 0
        ? this.db
          .select({ id: seasonProjects.id, projectId: seasonProjects.projectId })
          .from(seasonProjects)
          .where(inArray(seasonProjects.id, seasonProjectIds))
        : Promise.resolve([] as Array<{ id: number; projectId: number }>),
      this.profileMap(rows.map((row) => row.applicantUserId)),
    ])
    const projectIds = [...new Set(seasonProjectRows.map((row) => row.projectId))]
    const projectRows = projectIds.length > 0
      ? await this.db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(inArray(projects.id, projectIds))
      : []
    const projectNamesById = new Map(projectRows.map((row) => [row.id, row.name]))
    const seasonProjectById = new Map(seasonProjectRows.map((row) => [row.id, row]))
    const cardById = new Map(cardRows.map((row) => [row.id, row]))

    return rows.map((row) => {
      const card = cardById.get(row.cardId)
      const seasonProject = card ? seasonProjectById.get(card.seasonProjectId) : undefined
      const projectName = seasonProject ? projectNamesById.get(seasonProject.projectId) ?? '' : ''
      return {
        id: row.id,
        cardId: row.cardId,
        applicantUserId: row.applicantUserId,
        applicant: this.profileDto(row.applicantUserId, profiles),
        message: row.message,
        status: row.status,
        decidedAt: iso(row.decidedAt),
        createdAt: iso(row.createdAt)!,
        card: {
          id: row.cardId,
          projectName,
          roles: card?.roles ?? [],
          deadline: iso(card?.deadline ?? null),
          status: card?.status ?? RecruitmentCardStatus.Closed,
        },
      }
    })
  }

  private async applicationDto(applicationId: number) {
    const rows = await this.db
      .select()
      .from(recruitmentApplications)
      .where(eq(recruitmentApplications.id, applicationId))
      .limit(1)
    if (!rows[0]) throw boomlandError('RECRUITMENT_APPLICATION_NOT_FOUND', '招募申请不存在', 404)
    const [dto] = await this.applicationDtos([rows[0]])
    return dto!
  }

  /**
   * 校验并归一化命题 id：必须全部是该赛季**已发布**的命题，数量 1—
   * `rules.maxChallengesPerProject`（平行、无主次，见 PRD 5.3）。
   */
  private async normalizeChallengeIds(
    season: SeasonRow,
    rawIds: number[],
  ): Promise<number[]> {
    const ids = [...new Set(rawIds)]
    const max = season.rules.maxChallengesPerProject
    if (ids.length === 0) {
      throw boomlandError('VALIDATION_ERROR', '至少选择一个命题', 400, { field: 'challengeIds' })
    }
    if (ids.length > max) {
      throw boomlandError(
        'CHALLENGE_LIMIT_EXCEEDED',
        `每个项目最多选择 ${max} 个命题`,
        400,
        { field: 'challengeIds', detail: { max } },
      )
    }
    const rows = await this.db
      .select({ id: challenges.id, status: challenges.status })
      .from(challenges)
      .where(and(eq(challenges.seasonId, season.id), inArray(challenges.id, ids)))
    const published = new Set(
      rows
        .filter((row) => row.status === ChallengeStatus.Published)
        .map((row) => row.id),
    )
    const invalid = ids.filter((id) => !published.has(id))
    if (invalid.length > 0) {
      throw boomlandError(
        'CHALLENGE_NOT_PUBLISHED',
        '所选命题必须都是该赛季已发布的命题',
        400,
        { field: 'challengeIds', detail: { invalid } },
      )
    }
    return ids
  }

  /** `themes` 必须是 `seasons.themes` 的子集，0—5 个。 */
  private normalizeThemes(season: SeasonRow, rawThemes: string[] | undefined): string[] {
    const allowed = new Set(season.themes ?? [])
    const themes: string[] = []
    for (const raw of rawThemes ?? []) {
      const value = raw.trim()
      if (!value || themes.includes(value)) continue
      themes.push(value)
    }
    if (themes.some((theme) => !allowed.has(theme))) {
      throw boomlandError('SEASON_THEME_INVALID', '项目方向必须在赛季主题范围内', 400, {
        field: 'themes',
        detail: { allowed: [...allowed] },
      })
    }
    return themes
  }

  private async projectCountForOwner(seasonId: number, userId: string): Promise<number> {
    const rows = await this.db
      .select({ value: count() })
      .from(seasonProjects)
      .where(and(
        eq(seasonProjects.seasonId, seasonId),
        eq(seasonProjects.ownerUserId, userId),
        ne(seasonProjects.status, SeasonProjectStatus.Archived),
      ))
    return rows[0]?.value ?? 0
  }

  /**
   * `mode=create` 下的「同项目重复登记」判定。
   *
   * 每次 create 都会新建一条 `projects` 行，所以 `(season_id, project_id)` 唯一约束
   * 永远打不到 —— 用户在同一个赛季里把同一个项目再发起一遍时，唯一稳定的身份是
   * 项目名。按「本人 + 同赛季 + 同名（未归档）」判重，才能给出契约要求的
   * `SEASON_PROJECT_DUPLICATED`，而不是让用户先撞上 `PROJECT_LIMIT_REACHED`。
   */
  private async findDuplicateByName(
    seasonId: number,
    userId: string,
    name: string,
  ): Promise<number | null> {
    const rows = await this.db
      .select({ id: seasonProjects.id })
      .from(seasonProjects)
      .innerJoin(projects, eq(seasonProjects.projectId, projects.id))
      .where(and(
        eq(seasonProjects.seasonId, seasonId),
        eq(seasonProjects.ownerUserId, userId),
        ne(seasonProjects.status, SeasonProjectStatus.Archived),
        eq(projects.name, name),
      ))
      .limit(1)
    return rows[0]?.id ?? null
  }

  // -------------------------------------------------------------------------
  // GET /seasons/:id/team/me —— 组队 tab 首屏聚合
  // -------------------------------------------------------------------------

  /**
   * 组队页 5 张卡一次取齐（契约 §2.1）。
   *
   * 不要求调用者是选手：未报名用户也要能打开组队 tab（看到规则卡与「去报名」），
   * 所以 `participant` / `project` 都允许为 null。
   */
  async workbench(seasonId: number, userId: string) {
    const season = await this.getSeason(seasonId)
    const now = new Date()
    const [
      summary,
      participantRows,
      applicationRows,
      projectRows,
      cardRows,
      myApplicationRows,
      activeParticipantRows,
      ownerRows,
      openCardRows,
    ] = await Promise.all([
      getSeasonSummary(this.db, season),
      this.db
        .select()
        .from(seasonParticipants)
        .where(and(
          eq(seasonParticipants.seasonId, seasonId),
          eq(seasonParticipants.userId, userId),
        ))
        .limit(1),
      this.db
        .select({ id: seasonApplications.id, status: seasonApplications.status })
        .from(seasonApplications)
        .where(and(
          eq(seasonApplications.seasonId, seasonId),
          eq(seasonApplications.userId, userId),
        ))
        .limit(1),
      this.db
        .select()
        .from(seasonProjects)
        .where(and(
          eq(seasonProjects.seasonId, seasonId),
          eq(seasonProjects.ownerUserId, userId),
          ne(seasonProjects.status, SeasonProjectStatus.Archived),
        ))
        .orderBy(asc(seasonProjects.id))
        .limit(1),
      this.db
        .select()
        .from(recruitmentCards)
        .where(and(
          eq(recruitmentCards.seasonId, seasonId),
          eq(recruitmentCards.creatorUserId, userId),
        ))
        .orderBy(desc(recruitmentCards.id))
        .limit(1),
      this.db
        .select({ application: recruitmentApplications })
        .from(recruitmentApplications)
        .innerJoin(recruitmentCards, eq(recruitmentApplications.cardId, recruitmentCards.id))
        .where(and(
          eq(recruitmentCards.seasonId, seasonId),
          eq(recruitmentApplications.applicantUserId, userId),
        ))
        .orderBy(desc(recruitmentApplications.id)),
      // 未组队选手数 = active 选手 − 已有赛季项目的 owner。两次查询，不做 N+1。
      this.db
        .select({ userId: seasonParticipants.userId })
        .from(seasonParticipants)
        .where(and(
          eq(seasonParticipants.seasonId, seasonId),
          eq(seasonParticipants.status, SeasonParticipantStatus.Active),
        )),
      this.db
        .select({ userId: seasonProjects.ownerUserId })
        .from(seasonProjects)
        .where(and(
          eq(seasonProjects.seasonId, seasonId),
          ne(seasonProjects.status, SeasonProjectStatus.Archived),
        )),
      this.db
        .select({ value: count() })
        .from(recruitmentCards)
        .where(and(
          eq(recruitmentCards.seasonId, seasonId),
          eq(recruitmentCards.status, RecruitmentCardStatus.Open),
        )),
    ])

    const ownerUserIds = new Set(ownerRows.map((row) => row.userId))
    const unassignedParticipantCount = activeParticipantRows
      .filter((row) => !ownerUserIds.has(row.userId))
      .length

    const participantRow = participantRows[0]
    const [projectDto] = projectRows.length > 0 ? await this.projectDtos(projectRows) : [null]
    const [cardDto] = cardRows.length > 0 ? await this.cardDtos(cardRows) : [null]
    const myApplications = await this.applicationDtos(
      myApplicationRows.map((row) => row.application),
    )

    return {
      season: summary,
      participant: participantRow
        ? {
          userId: participantRow.userId,
          status: participantRow.status,
          wechatStatus: participantRow.wechatStatus,
          canWithdraw: participantRow.status === SeasonParticipantStatus.Active
            && (!season.teamDeadline || !isPast(season.teamDeadline, now)),
        }
        : null,
      application: applicationRows[0] ?? null,
      project: projectDto,
      recruitmentCard: cardDto,
      myApplications,
      stats: {
        unassignedParticipantCount,
        openRecruitmentCardCount: openCardRows[0]?.value ?? 0,
      },
      rules: {
        maxCoreMembers: season.rules.maxCoreMembers,
        maxProjectsPerParticipant: season.rules.maxProjectsPerParticipant,
        // 组队规则卡第 5 条要显示「每个项目可选 1—N 个平行命题」：N 必须来自
        // 赛季配置，否则规则卡写 3、后端按 1 校验，用户按规则卡选就会被拒。
        maxChallengesPerProject: season.rules.maxChallengesPerProject,
        teamDeadline: iso(season.teamDeadline),
        deadlinePassed: Boolean(season.teamDeadline && isPast(season.teamDeadline, now)),
      },
    }
  }

  // -------------------------------------------------------------------------
  // POST /seasons/:id/projects —— 发起项目 / 带入已有项目
  // -------------------------------------------------------------------------

  /**
   * 发起（`mode=create`）或带入（`mode=bring`）赛季项目。
   *
   * 两种模式在赛季层的产物一致：一条 `season_projects` 关联行 + owner 成员行
   * （`accepted`）。差别只在 `projects` 行从哪来 —— create 新建并直接置为
   * `ProjectStatus.Live`（产品共生里项目发起即对外可见），bring 校验属主后只建关联。
   *
   * 整段必须在一个事务里：`projects` 行与赛季关联行是同一件事，中间失败会留下
   * 一个「平台里有、赛季里没有」的孤儿项目。
   */
  async createProject(seasonId: number, userId: string, body: CreateSeasonProjectBody) {
    const season = await this.getSeason(seasonId)
    await this.requireParticipant(seasonId, userId)
    const now = new Date()
    this.assertTeamDeadlineOpen(season, now)

    const themes = this.normalizeThemes(season, body.themes)
    const challengeIds = await this.normalizeChallengeIds(season, body.challengeIds)

    let projectRow: ProjectRow | null = null
    let projectName: string
    if (body.mode === 'bring') {
      const rows = await this.db
        .select()
        .from(projects)
        .where(eq(projects.id, body.projectId))
        .limit(1)
      projectRow = rows[0] ?? null
      if (!projectRow) throw boomlandError('PROJECT_NOT_FOUND', '项目不存在', 404)
      if (projectRow.userId !== userId) {
        throw boomlandError('FORBIDDEN', '只能带入自己的项目', 403)
      }
      projectName = projectRow.name
      // 重复登记比「超出项目数上限」更具体：先报重复，用户才知道该去编辑而不是删项目。
      const duplicated = await this.db
        .select({ id: seasonProjects.id })
        .from(seasonProjects)
        .where(and(
          eq(seasonProjects.seasonId, seasonId),
          eq(seasonProjects.projectId, body.projectId),
        ))
        .limit(1)
      if (duplicated.length > 0) {
        throw boomlandError('SEASON_PROJECT_DUPLICATED', '该项目已在本赛季登记', 409, {
          detail: { seasonProjectId: duplicated[0]!.id },
        })
      }
    } else {
      projectName = body.name.trim()
      const duplicated = await this.findDuplicateByName(seasonId, userId, projectName)
      if (duplicated !== null) {
        throw boomlandError('SEASON_PROJECT_DUPLICATED', '该项目已在本赛季登记', 409, {
          detail: { seasonProjectId: duplicated },
        })
      }
    }

    const existingCount = await this.projectCountForOwner(seasonId, userId)
    if (existingCount >= season.rules.maxProjectsPerParticipant) {
      throw boomlandError(
        'PROJECT_LIMIT_REACHED',
        `每人最多参与 ${season.rules.maxProjectsPerParticipant} 个项目`,
        409,
        { detail: { max: season.rules.maxProjectsPerParticipant } },
      )
    }

    const seasonProjectId = await this.db.transaction(async (tx) => {
      let projectId: number
      if (body.mode === 'create') {
        const [created] = await tx.insert(projects).values({
          userId,
          status: ProjectStatus.Live,
          name: projectName,
          tagline: body.tagline?.trim() || null,
        })
        projectId = created.insertId
      } else {
        projectId = projectRow!.id
      }
      const [link] = await tx.insert(seasonProjects).values({
        seasonId,
        projectId,
        ownerUserId: userId,
        source: body.mode === 'create'
          ? SeasonProjectSource.Created
          : SeasonProjectSource.BroughtIn,
        themes,
        challengeIds,
        status: SeasonProjectStatus.Published,
      })
      await tx.insert(seasonProjectMembers).values({
        seasonProjectId: link.insertId,
        userId,
        role: SeasonProjectMemberRole.Owner,
        status: SeasonProjectMemberStatus.Accepted,
      })
      await writeAudit(tx, {
        seasonId,
        actorUserId: userId,
        action: 'season_project.created',
        targetType: 'season_project',
        targetId: String(link.insertId),
        detail: {
          projectId,
          source: body.mode === 'create'
            ? SeasonProjectSource.Created
            : SeasonProjectSource.BroughtIn,
          challengeIds,
          themes,
        },
      })
      return link.insertId
    })

    return this.projectDto(seasonProjectId)
  }

  // -------------------------------------------------------------------------
  // GET /me/season-projects?seasonId=
  // -------------------------------------------------------------------------

  async listMyProjects(userId: string, query: SeasonProjectQuery) {
    const memberRows = await this.db
      .select({ seasonProjectId: seasonProjectMembers.seasonProjectId })
      .from(seasonProjectMembers)
      .where(eq(seasonProjectMembers.userId, userId))
    const memberIds = [...new Set(memberRows.map((row) => row.seasonProjectId))]
    const ownership = memberIds.length > 0
      ? or(
        eq(seasonProjects.ownerUserId, userId),
        inArray(seasonProjects.id, memberIds),
      )!
      : eq(seasonProjects.ownerUserId, userId)
    const conditions = [ownership, ne(seasonProjects.status, SeasonProjectStatus.Archived)]
    if (query.seasonId) conditions.push(eq(seasonProjects.seasonId, query.seasonId))
    const rows = await this.db
      .select()
      .from(seasonProjects)
      .where(and(...conditions))
      .orderBy(desc(seasonProjects.id))
    return { items: await this.projectDtos(rows) }
  }

  // -------------------------------------------------------------------------
  // POST /seasons/:id/recruitment-cards —— 发布招募卡
  // -------------------------------------------------------------------------

  async publishRecruitmentCard(
    seasonId: number,
    userId: string,
    body: PublishRecruitmentCardBody,
  ) {
    const season = await this.getSeason(seasonId)
    await this.requireParticipant(seasonId, userId)
    const rows = await this.db
      .select()
      .from(seasonProjects)
      .where(eq(seasonProjects.id, body.seasonProjectId))
      .limit(1)
    const seasonProject = rows[0]
    if (!seasonProject || seasonProject.seasonId !== seasonId) {
      throw boomlandError('SEASON_PROJECT_NOT_FOUND', '赛季项目不存在', 404)
    }
    if (seasonProject.ownerUserId !== userId) {
      throw boomlandError('FORBIDDEN', '只有项目发起人可以发布招募卡', 403)
    }
    const deadline = new Date(body.deadline)
    if (!Number.isFinite(deadline.getTime())) {
      throw boomlandError('VALIDATION_ERROR', '截止时间不合法', 400, { field: 'deadline' })
    }
    if (deadline.getTime() <= Date.now()) {
      throw boomlandError('RECRUITMENT_DEADLINE_INVALID', '截止时间必须晚于当前时间', 400, {
        field: 'deadline',
      })
    }
    const openRows = await this.db
      .select({ id: recruitmentCards.id })
      .from(recruitmentCards)
      .where(and(
        eq(recruitmentCards.seasonProjectId, seasonProject.id),
        eq(recruitmentCards.status, RecruitmentCardStatus.Open),
      ))
      .limit(1)
    if (openRows.length > 0) {
      throw boomlandError('RECRUITMENT_CARD_EXISTS', '该项目已有进行中的招募卡', 409, {
        detail: { cardId: openRows[0]!.id },
      })
    }
    const roles = body.roles.map((role) => role.trim()).filter(Boolean)
    const skills = (body.skills ?? []).map((skill) => skill.trim()).filter(Boolean)
    const [created] = await this.db.insert(recruitmentCards).values({
      seasonId,
      seasonProjectId: seasonProject.id,
      creatorUserId: userId,
      roles,
      skills,
      description: body.description.trim(),
      deadline,
      status: RecruitmentCardStatus.Open,
    })
    await writeAudit(this.db, {
      seasonId,
      actorUserId: userId,
      action: 'recruitment_card.published',
      targetType: 'recruitment_card',
      targetId: String(created.insertId),
      detail: { seasonProjectId: seasonProject.id, roles, skills },
    })
    return this.cardDto(created.insertId)
  }

  // -------------------------------------------------------------------------
  // PATCH /recruitment-cards/:id —— 关闭 / 重新打开
  // -------------------------------------------------------------------------

  private async getCardRow(cardId: number): Promise<RecruitmentCardRow> {
    const rows = await this.db
      .select()
      .from(recruitmentCards)
      .where(eq(recruitmentCards.id, cardId))
      .limit(1)
    if (!rows[0]) throw boomlandError('RECRUITMENT_CARD_NOT_FOUND', '招募卡不存在', 404)
    return rows[0]
  }

  async updateRecruitmentCard(
    cardId: number,
    userId: string,
    body: UpdateRecruitmentCardBody,
  ) {
    const row = await this.getCardRow(cardId)
    if (row.creatorUserId !== userId) {
      throw boomlandError('FORBIDDEN', '只有卡片发起人可以调整招募卡', 403)
    }
    if (row.status === body.status) return this.cardDto(cardId)
    if (body.status === RecruitmentCardStatus.Open) {
      const openRows = await this.db
        .select({ id: recruitmentCards.id })
        .from(recruitmentCards)
        .where(and(
          eq(recruitmentCards.seasonProjectId, row.seasonProjectId),
          eq(recruitmentCards.status, RecruitmentCardStatus.Open),
        ))
        .limit(1)
      if (openRows.length > 0) {
        throw boomlandError('RECRUITMENT_CARD_EXISTS', '该项目已有进行中的招募卡', 409, {
          detail: { cardId: openRows[0]!.id },
        })
      }
    }
    await this.db
      .update(recruitmentCards)
      .set({ status: body.status })
      .where(eq(recruitmentCards.id, cardId))
    await writeAudit(this.db, {
      seasonId: row.seasonId,
      actorUserId: userId,
      action: 'recruitment_card.status_changed',
      targetType: 'recruitment_card',
      targetId: String(cardId),
      detail: { from: row.status, to: body.status },
    })
    return this.cardDto(cardId)
  }

  // -------------------------------------------------------------------------
  // POST /recruitment-cards/:id/apply —— 申请加入
  // -------------------------------------------------------------------------

  async applyToCard(cardId: number, userId: string, body: ApplyRecruitmentCardBody) {
    const card = await this.getCardRow(cardId)
    await this.getSeason(card.seasonId)
    if (card.creatorUserId === userId) {
      throw boomlandError('SELF_APPLICATION', '不能申请自己的招募卡', 409)
    }
    if (card.status !== RecruitmentCardStatus.Open || isPast(card.deadline, new Date())) {
      throw boomlandError('RECRUITMENT_CARD_CLOSED', '招募卡已关闭或已过截止时间', 409, {
        detail: { status: card.status, deadline: iso(card.deadline) },
      })
    }
    const existing = await this.db
      .select({ id: recruitmentApplications.id })
      .from(recruitmentApplications)
      .where(and(
        eq(recruitmentApplications.cardId, cardId),
        eq(recruitmentApplications.applicantUserId, userId),
      ))
      .limit(1)
    if (existing.length > 0) {
      throw boomlandError('RECRUITMENT_APPLICATION_DUPLICATED', '你已申请过这张招募卡', 409)
    }
    const [created] = await this.db.insert(recruitmentApplications).values({
      cardId,
      applicantUserId: userId,
      message: body.message.trim(),
      status: RecruitmentApplicationStatus.Pending,
    })
    await writeAudit(this.db, {
      seasonId: card.seasonId,
      actorUserId: userId,
      action: 'recruitment_application.submitted',
      targetType: 'recruitment_application',
      targetId: String(created.insertId),
      detail: { cardId },
    })
    return this.applicationDto(created.insertId)
  }

  // -------------------------------------------------------------------------
  // GET /me/recruitment-applications?seasonId=
  // -------------------------------------------------------------------------

  async listMyApplications(userId: string, query: SeasonProjectQuery) {
    const conditions = [eq(recruitmentApplications.applicantUserId, userId)]
    if (query.seasonId) conditions.push(eq(recruitmentCards.seasonId, query.seasonId))
    const rows = await this.db
      .select({ application: recruitmentApplications })
      .from(recruitmentApplications)
      .innerJoin(recruitmentCards, eq(recruitmentApplications.cardId, recruitmentCards.id))
      .where(and(...conditions))
      .orderBy(desc(recruitmentApplications.id))
    return {
      items: await this.applicationDtos(rows.map((row) => row.application)),
      total: rows.length,
    }
  }

  // -------------------------------------------------------------------------
  // GET /recruitment-cards/:id/applications —— 发起人看收到的申请
  // -------------------------------------------------------------------------

  async listCardApplications(cardId: number, userId: string) {
    const card = await this.getCardRow(cardId)
    if (card.creatorUserId !== userId) {
      throw boomlandError('FORBIDDEN', '只有卡片发起人可以查看申请', 403)
    }
    const rows = await this.db
      .select()
      .from(recruitmentApplications)
      .where(eq(recruitmentApplications.cardId, cardId))
      .orderBy(desc(recruitmentApplications.id))
    return { items: await this.applicationDtos(rows) }
  }

  // -------------------------------------------------------------------------
  // PATCH /recruitment-applications/:id —— 发起人处理申请
  // -------------------------------------------------------------------------

  /**
   * 接受 / 拒绝一条申请。
   *
   * 接受**不等于**登记为赛季核心成员（PRD 原文）：组队仍走
   * `season_project_members` 的登记流程，这里只落申请本身的处理结果。
   */
  async decideApplication(
    applicationId: number,
    userId: string,
    body: UpdateRecruitmentApplicationBody,
  ) {
    const rows = await this.db
      .select()
      .from(recruitmentApplications)
      .where(eq(recruitmentApplications.id, applicationId))
      .limit(1)
    const application = rows[0]
    if (!application) {
      throw boomlandError('RECRUITMENT_APPLICATION_NOT_FOUND', '招募申请不存在', 404)
    }
    const card = await this.getCardRow(application.cardId)
    if (card.creatorUserId !== userId) {
      throw boomlandError('FORBIDDEN', '只有卡片发起人可以处理申请', 403)
    }
    if (application.status === body.status) return this.applicationDto(applicationId)
    await this.db
      .update(recruitmentApplications)
      .set({ status: body.status, decidedAt: new Date() })
      .where(eq(recruitmentApplications.id, applicationId))
    await writeAudit(this.db, {
      seasonId: card.seasonId,
      actorUserId: userId,
      action: 'recruitment_application.decided',
      targetType: 'recruitment_application',
      targetId: String(applicationId),
      detail: { cardId: card.id, from: application.status, to: body.status },
    })
    return this.applicationDto(applicationId)
  }
}
