// 아주 작은 템플릿 엔진: {{name}}, {{a.b}}, {{name | filter}}.
import { filters } from './filters.js'

export class TemplateError extends Error {
  constructor(message, { template, name } = {}) {
    super(message)
    this.name = 'TemplateError'
    this.template = template
    this.variable = name
  }
}

const TOKEN = /\{\{\s*([\w.]+)\s*(?:\|\s*(\w+)\s*)?\}\}/g

function lookup(vars, dotted) {
  let cur = vars
  for (const key of dotted.split('.')) {
    if (cur === null || cur === undefined) return undefined
    cur = cur[key]
  }
  return cur
}

export function render(template, vars = {}) {
  return template.replace(TOKEN, (_m, name, filter) => {
    const value = lookup(vars, name)
    if (value === undefined || value === null) throw new TemplateError(`값이 없음: ${name}`, { template, name })
    if (!filter) return String(value)
    const fn = filters[filter]
    if (!fn) throw new TemplateError(`모르는 필터: ${filter}`, { template, name })
    return fn(value)
  })
}

/** 템플릿에 쓰인 변수 이름들 */
export function variablesOf(template) {
  return [...template.matchAll(TOKEN)].map((m) => m[1])
}
