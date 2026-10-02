// [탐색] K22 거르개를 지난 [실제] 실행의 채택 후보에 대 본다. RELAY_EXPLORE_K22=<후보 JSON>일 때만 돈다.
import fs from 'node:fs'
import { it } from 'vitest'
import { inCodeReason } from '../../src/core/knowledge'

const file = process.env['RELAY_EXPLORE_K22']

it.runIf(!!file)('[탐색] K22 거르개 되대기', () => {
  const xs = JSON.parse(fs.readFileSync(file ?? '', 'utf8')) as {
    kind: 'recipe'
    rule: string
    not_in_code: string
    supersedes: string | null
    decision: string | null
    src: string
  }[]
  const trivial = /^테스트는 .*(npm test|node --test|내장 러너)/
  let tp = 0
  let fp = 0
  let fn = 0
  const lines: string[] = []
  for (const c of xs) {
    const why = c.supersedes || c.decision ? null : inCodeReason(c)
    const t = c.kind === 'recipe' && trivial.test(c.rule)
    if (why && t) tp++
    else if (why) {
      fp++
      lines.push(
        `잘못 걸림 [${why}] ${c.kind}: ${c.rule.slice(0, 70)} || ${c.not_in_code.slice(0, 50)}`,
      )
    } else if (t) {
      fn++
      lines.push(`놓침 ${c.rule.slice(0, 70)} || ${c.not_in_code.slice(0, 50)}`)
    }
  }
  console.log(
    `후보 ${xs.length}, 뻔한 레시피 맞게 걸림 ${tp}, 잘못 걸림 ${fp}, 놓침 ${fn}\n${lines.join('\n')}`,
  )
})

const all = process.env['RELAY_EXPLORE_K22_ALL']

it.runIf(!!all)('[탐색] K22 거르개로 후보마다 까닭', () => {
  const xs = JSON.parse(fs.readFileSync(all ?? '', 'utf8')) as {
    kind: 'recipe'
    rule: string
    not_in_code: string
    supersedes: string | null
    decision: string | null
    src: string
  }[]
  const out = xs.map((c) => ({
    ...c,
    inCode: c.supersedes || c.decision ? null : inCodeReason(c),
  }))
  fs.writeFileSync(`${all}.judged.json`, JSON.stringify(out, null, 1))
})
