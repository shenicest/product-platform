export type MatchProfile = { skills: string[]; seekingSkills: string[]; domains: string[]; durations: string[] }
const ratio = (a: string[], b: string[]) => a.length ? new Set(a.filter((x) => b.includes(x))).size / a.length * 100 : 0
export function calculateTalentMatch(viewer: MatchProfile, candidate: MatchProfile) {
  const shared = ratio(viewer.skills, candidate.skills)
  const complementary = ratio(viewer.seekingSkills, candidate.skills)
  const domains = ratio(viewer.domains, candidate.domains)
  const durations = ratio(viewer.durations, candidate.durations)
  const score = Math.round(shared * .25 + complementary * .35 + domains * .25 + durations * .15)
  const reasons = [
    complementary > 0 && `TA 擅长你正在寻找的 ${candidate.skills.filter((x) => viewer.seekingSkills.includes(x)).slice(0, 2).join('、')}`,
    durations > 0 && '都接受相同的合作周期',
    domains > 0 && `共同关注 ${candidate.domains.filter((x) => viewer.domains.includes(x)).slice(0, 2).join('、')}`,
    shared > 0 && `你们有 ${viewer.skills.filter((x) => candidate.skills.includes(x)).length} 项共同技能`,
  ].filter((x): x is string => Boolean(x)).slice(0, 3)
  return score === 0 ? { score: null, reason: '暂无明显匹配', reasons: [] } : { score, reason: null, reasons }
}
