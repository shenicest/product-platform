import { MAX_SEEKING_SKILLS, TALENT_SKILLS } from '@shenicest/shared'

export interface ProjectFormValues {
  name: string
  tagline: string
  teamName: string
  categories: string[]
  stage: string
  problemStatement: string
  differentiation: string
  nextSteps: string
  userCount: string
  monthlyRevenue: string
  retentionRate: string
  businessModel: string
  progress: string
  coverUrl: string
  demoImages: string[]
  demoVideoUrl: string
  demoLink: string
  seekingSkills: string[]
  isOpenForBeta: boolean
  betaDescription: string
  contactName: string
  contactPhone: string
  contactEmail: string
  contactWechat: string
}

export type ProjectFormErrors = Partial<Record<keyof ProjectFormValues, string>>

function lengthOf(value: string): number {
  return [...value.trim()].length
}

function isHttpUrl(value: string): boolean {
  if (!value.trim()) return true
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function isUnsignedInteger(value: string): boolean {
  if (!value.trim()) return true
  return /^\d+$/.test(value.trim())
}

export function validateProjectForm(form: ProjectFormValues): ProjectFormErrors {
  const errors: ProjectFormErrors = {}
  const required = [
    'name', 'tagline', 'problemStatement', 'nextSteps', 'coverUrl', 'contactName',
  ] as const

  for (const field of required) {
    if (!form[field].trim()) errors[field] = '请补全必填信息'
  }
  if (form.categories.length === 0) errors.categories = '请补全必填信息'
  if (!form.stage) errors.stage = '请补全必填信息'

  const nameLength = lengthOf(form.name)
  const nameMax = /\p{Script=Han}/u.test(form.name) ? 30 : 60
  if (form.name && (nameLength < 2 || nameLength > nameMax)) {
    errors.name = '项目名称长度不符合要求'
  }
  if (form.tagline && (lengthOf(form.tagline) < 4 || lengthOf(form.tagline) > 50)) {
    errors.tagline = '一句话介绍需为4-50个字符'
  }
  if (form.problemStatement && (lengthOf(form.problemStatement) < 30 || lengthOf(form.problemStatement) > 300)) {
    errors.problemStatement = '为谁解决什么问题需为30-300字'
  }
  if (lengthOf(form.differentiation) > 100) errors.differentiation = '差异化最多100字'
  if (lengthOf(form.nextSteps) > 300) errors.nextSteps = '下一步计划最多300字'
  if (lengthOf(form.businessModel) > 200) errors.businessModel = '商业模式最多200字'
  if (lengthOf(form.progress) > 300) errors.progress = '当前进展最多300字'

  for (const field of ['userCount', 'monthlyRevenue'] as const) {
    if (!isUnsignedInteger(form[field])) errors[field] = '请输入非负整数'
  }
  const retentionInvalid = !isUnsignedInteger(form.retentionRate) || Number(form.retentionRate) > 100
  if (retentionInvalid) errors.retentionRate = '请输入 0-100 的整数'

  // At least one contact channel. A filled phone mapping the error keeps the
  // same contract as the backend: the error reports against the first channel.
  if (!form.contactPhone.trim() && !form.contactEmail.trim() && !form.contactWechat.trim()) {
    errors.contactPhone = '请至少填写一种联系方式（电话/邮箱/微信）'
  }
  if (form.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) {
    errors.contactEmail = '请输入正确的邮箱'
  }
  for (const field of ['coverUrl', 'demoVideoUrl', 'demoLink'] as const) {
    if (!isHttpUrl(form[field])) errors[field] = '请输入正确的链接'
  }
  if (form.demoImages.length > 5 || form.demoImages.some((url) => !isHttpUrl(url))) {
    errors.demoImages = 'Demo图片最多上传5张，且地址必须有效'
  }

  if (form.seekingSkills.some((skill) => !(TALENT_SKILLS as readonly string[]).includes(skill))) {
    errors.seekingSkills = '包含无效的技能标签'
  } else if (form.seekingSkills.length > MAX_SEEKING_SKILLS) {
    errors.seekingSkills = `最多选择 ${MAX_SEEKING_SKILLS} 个技能标签`
  }

  if (form.isOpenForBeta && !form.betaDescription.trim()) {
    errors.betaDescription = '请补全必填信息'
  }
  return errors
}

export function firstProjectFormError(errors: ProjectFormErrors): keyof ProjectFormValues | null {
  // Display order of the 6-section form: 速览 → 故事 → 前景 → 展示 → 招募 → 联系.
  const order: (keyof ProjectFormValues)[] = [
    'name', 'tagline', 'categories', 'stage',
    'problemStatement', 'differentiation',
    'nextSteps', 'userCount', 'monthlyRevenue', 'retentionRate', 'businessModel', 'progress',
    'coverUrl', 'demoImages', 'demoVideoUrl', 'demoLink',
    'seekingSkills', 'isOpenForBeta', 'betaDescription',
    'contactName', 'contactPhone', 'contactEmail', 'contactWechat', 'teamName',
  ]
  return order.find((field) => errors[field]) ?? null
}
