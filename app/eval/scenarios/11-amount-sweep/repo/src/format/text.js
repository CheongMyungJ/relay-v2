import { displayWidth, padEndWidth } from '../util/strings.js'

// 리포트를 글자로. sections: [{ heading, body }]
export function renderReport(title, sections, { generatedAt } = {}) {
  const out = [title, '='.repeat(Math.max(displayWidth(title), 10))]
  if (generatedAt) out.push(`만든 때: ${generatedAt}`)
  for (const section of sections) {
    out.push('')
    if (section.heading) out.push(`[${section.heading}]`)
    out.push(section.body)
  }
  return out.join('\n') + '\n'
}

export function keyValueLines(pairs) {
  const width = Math.max(...pairs.map(([k]) => displayWidth(k)))
  return pairs.map(([k, v]) => `${padEndWidth(k, width)}  ${v}`).join('\n')
}
