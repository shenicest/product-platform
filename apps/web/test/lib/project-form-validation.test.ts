import { describe, expect, it } from 'vitest'
import { validateProjectForm } from '@/lib/project-form-validation'

const validForm = {
  name: '测试项目',
  tagline: '这是一个满足长度要求的一句话介绍',
  categories: ['效率工具'],
  stage: '0',
  description: '这是一段完整的项目介绍，用于说明项目是什么、解决什么问题以及当前进度。为了满足提交要求，这段内容需要达到一百个字符以上，并包含足够清晰的信息。项目已经完成基础原型和首轮用户访谈，接下来会继续验证核心需求、完善产品功能，并根据真实反馈持续改进使用体验。',
  coverUrl: 'https://example.com/cover.png',
  demoImages: [],
  demoVideoUrl: '',
  demoLink: 'https://example.com/demo',
  targetUsers: '主要面向希望提升日常工作效率的个人用户和小型团队。',
  userProblem: '用户目前需要在多个工具之间切换，信息分散且协作效率较低。',
  progress: '目前已经完成可使用的产品原型，并邀请首批用户参与测试。',
  nextSteps: '继续收集反馈并完善核心流程。',
  messageToUsers: '欢迎体验并告诉我们你的真实想法。',
  isOpenForBeta: false,
  betaDescription: '',
  contactName: '测试人员',
  contactPhone: '13800138000',
  contactEmail: 'test@example.com',
  contactWechat: '',
  teamName: '',
}

describe('validateProjectForm', () => {
  it('accepts a complete valid submission', () => {
    expect(validateProjectForm(validForm)).toEqual({})
  })

  it('returns field-specific length and format errors', () => {
    const errors = validateProjectForm({
      ...validForm,
      tagline: '太短',
      description: '不足一百字',
      contactPhone: '12345',
      demoLink: 'not-a-url',
    })

    expect(errors.tagline).toBe('一句话介绍需为10-40个字符')
    expect(errors.description).toBe('项目介绍至少100字，至多2000字')
    expect(errors.contactPhone).toBe('请输入正确的手机号')
    expect(errors.demoLink).toBe('请输入正确的链接')
  })

  it('requires beta details only when beta is open', () => {
    expect(validateProjectForm({ ...validForm, isOpenForBeta: true }).betaDescription)
      .toBe('请补全必填信息')
  })
})
