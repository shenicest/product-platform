// A complete project body that passes submitForReview's required-field
// validation. Shared across module and flow tests; override individual
// fields with validProjectBody({ name: 'Something' }).
const BASE: Record<string, unknown> = {
  name: 'Test Project',
  tagline: '这是一个用于测试项目提交的一句话介绍',
  categories: ['效率工具'],
  stage: 0,
  coverUrl: 'https://example.com/cover.png',
  problemStatement: '用户需要在多个工具之间频繁切换，信息分散且协作效率较低，缺少统一入口。',
  nextSteps: '完善核心工作流并邀请第一批真实用户参与内部测试。',
  isOpenForBeta: false,
  contactName: 'Tester',
  contactPhone: '13800138000',
}

export function validProjectBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...BASE, ...overrides }
}
