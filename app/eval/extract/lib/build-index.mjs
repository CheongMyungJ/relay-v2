// 시나리오의 구성별 빌드 인덱스를 만든다(AI 결정 87). 구성마다 소스를 전처리(-E -dD, 줄 표시)해 살아 있는 줄을,
// 컴파일(-c)한 목적 파일의 심볼 표에서 정의된 심볼을 모은다. 꼴과 읽기는 skills/extract/build-index.mjs가 정한다.
// 컴파일 인자는 check-fixtures.mjs와 같다(scenario.json의 build). 앱은 같은 일을 survey가 찾은 빌드 명령으로 별도
// 체크아웃에서 한다(16.10, 구현 PR의 몫).
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  activeLines,
  elfSymbols,
  mergeLines,
  mergeSymbols,
} from '../../../../skills/extract/build-index.mjs'
import { compileArgs } from './cc.mjs'

/**
 * @param {string} repo 시나리오의 repo 폴더
 * @param {{ cpu: string, includes: string[], configs: Record<string, { defines: string[], sources: string[], forceInclude?: string }> }} build
 * @param {{ file: string, pre: string[] }} cc
 * @returns {{ version: 1, configs: Record<string, { symbols: Record<string, 'strong' | 'weak'>, lines: Record<string, [number, number][]> }> }}
 */
export function buildIndex(repo, build, cc) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-extract-index-'))
  const configs = {}
  try {
    for (const [name, cfg] of Object.entries(build.configs)) {
      const args = compileArgs(build, cfg, cc)
      const symbols = []
      const lines = []
      for (const src of cfg.sources) {
        const pre = spawnSync(cc.file, [...args, '-E', '-dD', src], {
          cwd: repo,
          encoding: 'utf8',
          maxBuffer: 64 * 1024 * 1024,
        })
        if (pre.status !== 0)
          throw new Error(`${name}: ${src} 전처리 실패: ${(pre.stderr ?? '').split('\n')[0]}`)
        lines.push(activeLines(pre.stdout, repo))
        const obj = path.join(tmp, 'x.o')
        const c = spawnSync(cc.file, [...args, '-c', src, '-o', obj], {
          cwd: repo,
          encoding: 'utf8',
        })
        if (c.status !== 0)
          throw new Error(`${name}: ${src} 컴파일 실패: ${(c.stderr ?? '').split('\n')[0]}`)
        symbols.push(elfSymbols(fs.readFileSync(obj)))
      }
      configs[name] = { symbols: sortKeys(mergeSymbols(symbols)), lines: mergeLines(lines) }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
  return { version: 1, configs }
}

const sortKeys = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)))
