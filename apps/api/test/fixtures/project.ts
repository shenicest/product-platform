// A complete project body that passes submitForReview's required-field
// validation. Shared across module and flow tests; override individual
// fields with validProjectBody({ name: 'Something' }).
const BASE: Record<string, unknown> = {
  name: 'Test Project',
  tagline: 'original tagline',
  categories: ['效率工具'],
  stage: 0,
  coverUrl: 'https://example.com/cover.png',
  description: 'original description',
  targetUsers: '目标用户说明，至少二十个字的内容。',
  userProblem: '用户遇到的问题说明，至少二十个字。',
  progress: '当前进展说明，至少二十个字的内容。',
  messageToUsers: '对用户说的话',
  isOpenForBeta: false,
  contactName: 'Tester',
  contactPhone: '13800138000',
}

export function validProjectBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...BASE, ...overrides }
}
