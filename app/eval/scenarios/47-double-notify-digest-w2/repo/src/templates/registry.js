// 이벤트 종류와 언어로 템플릿을 찾는다. 없는 언어는 기본 언어로 대신한다.
import { catalog as builtIn } from './catalog.js'
import { filters } from './filters.js'
import { render } from './render.js'

/** 카탈로그 점검: 채널마다 모든 언어의 문구가 있는지, 필터 이름이 맞는지 */
export function validateCatalog(catalog, locales = ['ko', 'en']) {
  const problems = []
  for (const [type, entry] of Object.entries(catalog)) {
    if (!Array.isArray(entry.channels) || entry.channels.length === 0) problems.push(`${type}: 채널이 없다`)
    for (const locale of locales) {
      for (const channel of entry.channels ?? []) {
        const parts = entry[locale]?.[channel]
        if (!parts) {
          problems.push(`${type}/${locale}/${channel}: 문구가 없다`)
          continue
        }
        for (const [field, text] of Object.entries(parts)) {
          for (const m of text.matchAll(/\|\s*(\w+)\s*\}\}/g)) {
            if (!filters[m[1]]) problems.push(`${type}/${locale}/${channel}.${field}: 모르는 필터 ${m[1]}`)
          }
        }
      }
    }
  }
  return problems
}

export function createTemplateRegistry({ catalog = builtIn, defaultLocale = 'ko' } = {}) {
  function entry(type) {
    const e = catalog[type]
    if (!e) throw new Error(`템플릿 없음: ${type}`)
    return e
  }

  return {
    has: (type) => Object.hasOwn(catalog, type),
    channelsFor: (type) => [...entry(type).channels],
    isRequired: (type) => !!entry(type).required,
    /** 채널 하나의 문구를 채운다 */
    renderFor(type, channel, locale, vars) {
      const e = entry(type)
      const byLocale = e[locale] ?? e[defaultLocale]
      const parts = byLocale?.[channel]
      if (!parts) throw new Error(`템플릿 없음: ${type}/${channel}/${locale}`)
      const out = {}
      for (const [field, text] of Object.entries(parts)) out[field] = render(text, vars)
      return out
    },
    types: () => Object.keys(catalog),
  }
}
