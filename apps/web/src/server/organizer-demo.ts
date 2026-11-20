import { redirect } from 'next/navigation'
import { WORKSPACE_SEASON } from '@/lib/season-workspace'

/**
 * 新一批「项目与进度 / 规则归档 / 评委与积分池 / 预算与结算 / 核验与异议 /
 * 审计」页面仍使用 AI4BBS 的前端测试数据。
 *
 * 主办方外壳默认选「最近更新的赛季」，本地 seed 里是 Proto Seeds 第二季，
 * 与页面里的 AI4BBS 数据对不上。这些页面统一落到 AI4BBS（season=1）：
 * 选择器、页头 chip、tab 链接和内容说的是同一个赛季，不会出现「上面选
 * PROTO-S2、下面显示 AI4BBS」的错位。
 *
 * 如果用户在页内把赛季切到别的赛季，页面会重定向回 AI4BBS —— 这是测试
 * 数据的边界，不是真实的后台行为。接后端后删掉这个 helper，改为按选中
 * 赛季取数即可。
 */
export async function redirectToDemoSeason(
  searchParams: Promise<Record<string, string | string[] | undefined>>,
  path: string,
): Promise<void> {
  const params = await searchParams
  const raw = params.season
  const season = Array.isArray(raw) ? raw[0] : raw
  const demoSeason = String(WORKSPACE_SEASON.id)
  if (season !== demoSeason) redirect(`${path}?season=${demoSeason}`)
}
