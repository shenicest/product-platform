export interface ProjectFormValues {
  name: string
  tagline: string
  teamName: string
  categories: string[]
  stage: string
  description: string
  coverUrl: string
  demoImages: string[]
  demoVideoUrl: string
  demoLink: string
  targetUsers: string
  userProblem: string
  progress: string
  nextSteps: string
  messageToUsers: string
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

export function validateProjectForm(form: ProjectFormValues): ProjectFormErrors {
  const errors: ProjectFormErrors = {}
  const required = [
    'name', 'tagline', 'description', 'coverUrl', 'targetUsers', 'userProblem',
    'progress', 'messageToUsers', 'contactName', 'contactPhone',
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
  if (form.tagline && (lengthOf(form.tagline) < 10 || lengthOf(form.tagline) > 40)) {
    errors.tagline = '一句话介绍需为10-40个字符'
  }
  if (form.description && (lengthOf(form.description) < 100 || lengthOf(form.description) > 2000)) {
    errors.description = '项目介绍至少100字，至多2000字'
  }
  for (const field of ['targetUsers', 'userProblem', 'progress'] as const) {
    const length = lengthOf(form[field])
    if (form[field] && (length < 20 || length > 500)) errors[field] = '内容需为20-500字'
  }
  if (lengthOf(form.nextSteps) > 500) errors.nextSteps = '下一步计划最多500字'
  if (form.contactPhone && !/^1[3-9]\d{9}$/.test(form.contactPhone.trim())) {
    errors.contactPhone = '请输入正确的手机号'
  }
  if (form.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) {
    errors.contactEmail = '请输入正确的邮箱'
  }
  for (const field of ['coverUrl', 'demoVideoUrl', 'demoLink'] as const) {
    if (!isHttpUrl(form[field])) errors[field] = '请输入正确的链接'
  }
  if (form.demoImages.length > 5 || form.demoImages.some((url) => !isHttpUrl(url))) {
    errors.demoImages = 'Demo图片最多上传5张，且地址必须有效'
  }
  if (form.isOpenForBeta && !form.betaDescription.trim()) {
    errors.betaDescription = '请补全必填信息'
  }
  return errors
}

export function firstProjectFormError(errors: ProjectFormErrors): keyof ProjectFormValues | null {
  const order: (keyof ProjectFormValues)[] = [
    'name', 'tagline', 'categories', 'stage', 'description', 'coverUrl',
    'demoImages', 'demoVideoUrl', 'demoLink', 'targetUsers', 'userProblem',
    'progress', 'nextSteps', 'messageToUsers', 'isOpenForBeta',
    'betaDescription', 'contactName', 'contactPhone', 'contactEmail', 'contactWechat',
  ]
  return order.find((field) => errors[field]) ?? null
}
