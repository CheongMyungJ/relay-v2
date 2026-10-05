import { config } from '../config.js'

const TEMPLATES = {
  'billing-soon': '[{service}] {name}님, {date}에 {plan} {amount}이 결제됩니다.',
  cancelled: '[{service}] {name}님, 구독이 해지되었습니다. 그동안 고맙습니다.',
}

export function render(key, vars) {
  const t = TEMPLATES[key]
  if (!t) throw new Error(`없는 문자 틀: ${key}`)
  return t.replace(/\{(\w+)\}/g, (_, k) => String(k === 'service' ? config.serviceName : (vars[k] ?? '')))
}
