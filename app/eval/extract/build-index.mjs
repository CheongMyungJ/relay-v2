#!/usr/bin/env node
// 시나리오의 구성별 빌드 인덱스를 만들어 보인다(AI 결정 87, docs/extract-eval.md 3절).
//   node eval/extract/build-index.mjs [시나리오...] [--out 폴더] [--check 결과.json]
// 기본은 구성마다 정의된 심볼과 살아 있는 줄의 수를 보인다. --out이면 <폴더>/build-index.<시나리오>.json을 쓰고,
// --check이면 그 survey 결과를 규칙 config_active로 검사한다(시나리오 하나). 컴파일러가 없으면 0으로 끝난다.
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { checkResult } from '../../../skills/extract/rules.mjs'
import { isMain } from '../lib/util.mjs'
import { buildIndex } from './lib/build-index.mjs'
import { findCompiler } from './lib/cc.mjs'
import { listScenarios, loadScenario } from './run.mjs'

/** 시나리오 하나의 인덱스 */
export function scenarioIndex(id, cc) {
  const { dir, scenario } = loadScenario(id)
  if (!scenario.build) throw new Error(`${id}: build 정의 없음`)
  return buildIndex(path.join(dir, 'repo'), scenario.build, cc)
}

async function main() {
  const { values: v, positionals } = parseArgs({
    allowPositionals: true,
    options: { out: { type: 'string' }, check: { type: 'string' } },
  })
  const cc = findCompiler()
  if (!cc) {
    console.log('C 컴파일러(clang, zig cc)가 없어 빌드 인덱스를 만들지 않는다')
    return
  }
  const ids = positionals.length ? positionals : listScenarios()
  for (const id of ids) {
    const index = scenarioIndex(id, cc)
    for (const [name, c] of Object.entries(index.configs)) {
      const strong = Object.values(c.symbols).filter((s) => s === 'strong').length
      const weak = Object.values(c.symbols).length - strong
      const lines = Object.values(c.lines)
        .flat()
        .reduce((n, [s, e]) => n + e - s + 1, 0)
      console.log(
        `${id}/${name}: 심볼 ${strong}(weak ${weak}), 파일 ${Object.keys(c.lines).length}, 살아 있는 줄 ${lines}`,
      )
    }
    if (v.out) {
      fs.mkdirSync(v.out, { recursive: true })
      fs.writeFileSync(path.join(v.out, `build-index.${id}.json`), JSON.stringify(index) + '\n')
    }
    if (v.check) {
      const result = JSON.parse(fs.readFileSync(v.check, 'utf8'))
      const problems = checkResult(result, { build: index }).filter(
        (p) => p.rule === 'config_active',
      )
      console.log(
        problems.length ? problems.map((p) => `  ${p.problem}`).join('\n') : '  config_active 통과',
      )
      if (problems.length) process.exitCode = 1
    }
  }
}

if (isMain(import.meta.url)) await main()
