import { describe, expect, it } from 'vitest'
import { TALENT_SKILLS } from '@shenicest/shared'
import { validateProjectForm, type ProjectFormValues } from '@/lib/project-form-validation'

const validForm: ProjectFormValues = {
  name: '测试项目',
  tagline: '一句话介绍示例',
  teamName: '',
  categories: ['效率工具'],
  stage: '1',
  problemStatement:
    '自由职业者需要同时服务多个客户，还要自己处理合同、收款与报税琐事，过程分散且容易出错。',
  nextSteps: '继续收集反馈并完善核心流程，计划两周内上线预约功能。',
  coverUrl: 'https://example.com/cover.png',
  demoImages: [],
  demoVideoUrl: '',
  demoLink: 'https://example.com/demo',
  differentiation: '与现有方案相比更轻量。',
  businessModel: '',
  progress: '',
  userCount: '',
  monthlyRevenue: '',
  retentionRate: '',
  seekingSkills: [],
  isOpenForBeta: false,
  betaDescription: '',
  contactName: '测试人员',
  contactPhone: '',
  contactEmail: 'test@example.com',
  contactWechat: 'shenicest-fan',
}

describe('validateProjectForm', () => {
  it('accepts a complete valid submission', () => {
    expect(validateProjectForm(validForm)).toEqual({})
  })

  it('rejects when a required field is empty', () => {
    const errors = validateProjectForm({
      ...validForm,
      name: '',
      tagline: '',
      categories: [],
      stage: '',
      problemStatement: '',
      nextSteps: '',
      coverUrl: '',
      contactName: '',
    })
    for (const field of ['name', 'tagline', 'categories', 'stage', 'problemStatement', 'nextSteps', 'coverUrl', 'contactName'] as const) {
      expect(errors[field]).toBe('请补全必填信息')
    }
  })

  it('applies new length rules (tagline 4-50, problemStatement 30-300, nextSteps <=300)', () => {
    const tooShortProblem = '问题太短'
    const errors = validateProjectForm({
      ...validForm,
      tagline: '太短',
      problemStatement: tooShortProblem,
      differentiation: '很'.repeat(101),
      nextSteps: '很'.repeat(301),
      businessModel: '很'.repeat(201),
      progress: '很'.repeat(301),
    })
    expect(errors.tagline).toBe('一句话介绍需为4-50个字符')
    expect(errors.problemStatement).toBe('为谁解决什么问题需为30-300字')
    expect(errors.differentiation).toBe('差异化最多100字')
    expect(errors.nextSteps).toBe('下一步计划最多300字')
    expect(errors.businessModel).toBe('商业模式最多200字')
    expect(errors.progress).toBe('当前进展最多300字')

    const tooLongTagline = validateProjectForm({ ...validForm, tagline: '很'.repeat(51) })
    expect(tooLongTagline.tagline).toBe('一句话介绍需为4-50个字符')
    const tooLongProblem = validateProjectForm({ ...validForm, problemStatement: '很'.repeat(301) })
    expect(tooLongProblem.problemStatement).toBe('为谁解决什么问题需为30-300字')
  })

  it('keeps the name rule (2-30 han characters or 2-60 characters)', () => {
    expect(validateProjectForm({ ...validForm, name: '名' }).name).toBe('项目名称长度不符合要求')
    expect(validateProjectForm({ ...validForm, name: '很'.repeat(31) }).name).toBe('项目名称长度不符合要求')
    const ok = validateProjectForm({ ...validForm, name: 'ab' })
    expect(ok.name).toBeUndefined()
  })

  it('requires at least one contact channel and maps it to contactPhone', () => {
    const errors = validateProjectForm({
      ...validForm,
      contactPhone: '',
      contactEmail: '',
      contactWechat: '',
    })
    expect(errors.contactPhone).toBe('请至少填写一种联系方式（电话/邮箱/微信）')
  })

  it('validates email format only when non-empty; accepts any phone value', () => {
    const badEmail = validateProjectForm({ ...validForm, contactEmail: 'not-an-email' })
    expect(badEmail.contactEmail).toBe('请输入正确的邮箱')

    const anyPhone = validateProjectForm({ ...validForm, contactPhone: '+852 9123 4567' })
    expect(anyPhone.contactPhone).toBeUndefined()
  })

  it('requires beta details only when beta is open', () => {
    expect(validateProjectForm({ ...validForm, isOpenForBeta: true }).betaDescription)
      .toBe('请补全必填信息')
  })

  it('validates http(s) URLs and demoImages aggregate rules', () => {
    const errors = validateProjectForm({
      ...validForm,
      coverUrl: 'ftp://example.com/cover.png',
      demoVideoUrl: 'not-a-url',
      demoLink: 'javascript:alert(1)',
      demoImages: ['https://example.com/a.png', 'broken'],
    })
    expect(errors.coverUrl).toBe('请输入正确的链接')
    expect(errors.demoVideoUrl).toBe('请输入正确的链接')
    expect(errors.demoLink).toBe('请输入正确的链接')
    expect(errors.demoImages).toBe('Demo图片最多上传5张，且地址必须有效')
  })

  it('rejects traction values that are not unsigned integers (retentionRate 0-100)', () => {
    const errors = validateProjectForm({
      ...validForm,
      retentionRate: '101',
    })
    expect(errors.retentionRate).toBe('请输入 0-100 的整数')

    const countErrors = validateProjectForm({
      ...validForm,
      userCount: '-3',
      monthlyRevenue: '1.5',
    })
    expect(countErrors.userCount).toBe('请输入非负整数')
    expect(countErrors.monthlyRevenue).toBe('请输入非负整数')
  })

  it('rejects unknown seeking skills and caps the wall at 5', () => {
    const capped = validateProjectForm({ ...validForm, seekingSkills: [...TALENT_SKILLS, TALENT_SKILLS[0]] as string[] })
    expect(capped.seekingSkills).toBe('最多选择 5 个技能标签')

    const unknown = validateProjectForm({ ...validForm, seekingSkills: ['神秘技能'] })
    expect(unknown.seekingSkills).toBe('包含无效的技能标签')
  })
})
