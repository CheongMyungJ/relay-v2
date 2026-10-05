import { config } from '../config.js'

const TEMPLATES = {
  'due-soon': '[{store}] {name}님, {tool} 반납일이 내일({due})입니다.',
  overdue: '[{store}] {name}님, {tool} 반납이 {days}일 늦었습니다. 현재 연체료 {fee}. 빨리 반납해 주세요.',
  returned: '[{store}] {name}님, {tool} 반납을 확인했습니다. 돌려드릴 보증금 {refund}.',
}

export function render(key, vars) {
  const t = TEMPLATES[key]
  if (!t) throw new Error(`없는 문자 틀: ${key}`)
  return t.replace(/\{(\w+)\}/g, (_, k) => String(k === 'store' ? config.storeName : (vars[k] ?? '')))
}
