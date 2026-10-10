#!/usr/bin/env node
// 픽스처가 구성마다 컴파일되고 정답의 핵심 상수가 그 구성에서 맞는지 본다 (requirements-extraction-flow.md 결정 20, 21).
//   node eval/extract/check-fixtures.mjs [시나리오...]
// scenario.json의 build: 구성마다 정의(-D), 강제 포함(-include), 소스, 단정(asserts: 그 구성에서 참인 C 상수식).
// 소스마다 thumb 대상(-ffreestanding -Wall -Wextra)으로 컴파일해 진단이 없어야 하고, 단정은 _Static_assert로 확인한다.
// 컴파일러: CC 환경 변수, clang, 아니면 `python -m ziglang cc`(pip의 ziglang, clang 동봉). 없으면 건너뛰고 0으로 끝난다.
// libc 헤더는 newlib 대신 eval/extract/stubs의 최소 헤더를 쓴다.
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isMain } from '../lib/util.mjs'
import { compileArgs, findCompiler } from './lib/cc.mjs'
import { listScenarios, loadScenario } from './run.mjs'

export function checkScenario(id, cc) {
  const { dir, scenario } = loadScenario(id)
  const build = scenario.build
  if (!build) return [`${id}: build 정의 없음`]
  const repo = path.join(dir, 'repo')
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-extract-cc-'))
  const problems = []
  try {
    for (const [name, cfg] of Object.entries(build.configs)) {
      const args = compileArgs(build, cfg, cc)
      for (const src of cfg.sources) {
        const r = spawnSync(cc.file, [...args, '-c', src, '-o', path.join(tmp, 'x.o')], {
          cwd: repo,
          encoding: 'utf8',
        })
        const diag = (r.stderr ?? '').trim()
        if (r.status !== 0 || diag)
          problems.push(`${id}/${name}: ${src}: ${diag.split('\n')[0] || `종료 코드 ${r.status}`}`)
      }
      const file = path.join(tmp, `assert_${name}.c`)
      fs.writeFileSync(
        file,
        [
          ...build.headers.map((h) => `#include "${h}"`),
          ...cfg.asserts.map((a, i) => `_Static_assert(${a}, "assert ${i}");`),
          '',
        ].join('\n'),
      )
      const r = spawnSync(cc.file, [...args, '-c', file, '-o', path.join(tmp, 'a.o')], {
        cwd: repo,
        encoding: 'utf8',
      })
      if (r.status !== 0)
        problems.push(
          `${id}/${name}: 단정 실패: ${(r.stderr ?? '').split('\n').find((l) => /error/.test(l)) ?? r.status}`,
        )
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
  return problems
}

async function main() {
  const cc = findCompiler()
  if (!cc) {
    console.log('C 컴파일러(clang, zig cc)가 없어 픽스처 컴파일 확인을 건너뛴다')
    return
  }
  const version = execFileSync(cc.file, [...cc.pre, '--version'], { encoding: 'utf8' }).split(
    '\n',
  )[0]
  console.log(`컴파일러: ${cc.file} ${cc.pre.join(' ')} (${version})`)
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : listScenarios()
  let failed = 0
  for (const id of ids) {
    const problems = checkScenario(id, cc)
    failed += problems.length
    console.log(problems.length ? problems.map((p) => `  FAIL ${p}`).join('\n') : `  ok   ${id}`)
  }
  if (failed) process.exitCode = 1
}

if (isMain(import.meta.url)) await main()
