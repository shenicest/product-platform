// A complete project body that passes submitForReview's required-field
// validation. Shared across module and flow tests; override individual
// fields with validProjectBody({ name: 'Something' }).
const BASE: Record<string, unknown> = {
  name: 'Test Project',
  tagline: '这是一个用于测试项目提交的一句话介绍',
  categories: ['效率工具'],
  stage: 0,
  coverUrl: 'https://example.com/cover.png',
  description: '这是项目的详细介绍，用于说明项目是什么、解决什么问题以及目前已经完成的工作。为了覆盖项目提交时的字段长度校验，这段测试内容需要达到一百个字符以上，并保持内容清晰可读。项目目前已经完成基础原型，也收集了第一批用户反馈，接下来会继续验证核心需求并改进产品体验。',
  targetUsers: '主要面向希望提升日常工作效率的个人用户和小型协作团队。',
  userProblem: '用户目前需要在多个工具之间频繁切换，信息分散且协作效率较低。',
  progress: '目前已经完成可以使用的产品原型，并邀请第一批真实用户参与测试。',
  messageToUsers: '对用户说的话',
  isOpenForBeta: false,
  contactName: 'Tester',
  contactPhone: '13800138000',
}

export function validProjectBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...BASE, ...overrides }
}
