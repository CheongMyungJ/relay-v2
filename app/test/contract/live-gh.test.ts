// [계약] 실제 쪽(gh): 실제 gh와 GitHub가 아직 계약(gh.ts)과 녹화본(fixtures/gh.json)대로인지 본다. 읽기만 한다.
// RELAY_CONTRACT_LIVE_GH=1과 시험용 레포(RELAY_TEST_GH_REPO, GH_TOKEN)가 있을 때만 돈다(app-claude 워크플로의 contract 경우,
// I43). RELAY_CONTRACT_UPDATE=1이면 녹화본을 새로 쓴다.
// 시험용 레포에서 리뷰, 인라인 코멘트, 대화 코멘트, Actions 체크가 모두 있는 최근 PR 하나를 골라 앱의 어댑터로 읽는다.
// [실제]의 pr 경우(M9, M10)가 남긴 닫힌 PR이 그런 PR이다.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { prLocation } from '../../src/core/pr'
import { ghShapeOf, ghViolations, GH_FIXTURE, readGhFixture, readWithApp, samplesOf } from './gh'
import type { GhFixture, GhKind } from './gh'

const REPO = process.env['RELAY_TEST_GH_REPO'] ?? ''
const LIVE = process.env['RELAY_CONTRACT_LIVE_GH'] === '1' && REPO !== ''
const UPDATE = process.env['RELAY_CONTRACT_UPDATE'] === '1'
const OUT = path.resolve(__dirname, '../../test-results/contract')
const lines: string[] = []
const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-contract-gh-live-'))

afterAll(() => {
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'live-gh.md'), ['# [계약] 실제 gh', '', ...lines, ''].join('\n'))
  fs.rmSync(cwd, { recursive: true, force: true })
})

const gh = (args: string[]) => execFileSync('gh', args, { encoding: 'utf8', cwd })

describe.runIf(LIVE)('[계약] 실제 gh', () => {
  it('앱의 어댑터로 읽은 PR이 계약을 지키고 녹화본과 견준다', async () => {
    const version = gh(['--version']).split('\n')[0] ?? ''
    const prs = JSON.parse(
      gh(['pr', 'list', '--repo', REPO, '--state', 'all', '--limit', '30', '--json', 'url']),
    ) as { url: string }[]
    type Pick = { url: string; samples: ReturnType<typeof samplesOf> }
    let picked = null as Pick | null
    let best = null as Pick | null
    for (const { url } of prs) {
      const location = prLocation(url)
      if (!location) continue
      let samples: ReturnType<typeof samplesOf>
      try {
        samples = samplesOf(await readWithApp('gh', location, cwd))
      } catch (e) {
        // 지워진 실행 같은 까닭으로 읽지 못한 PR은 건너뛴다. 모두 실패하면 아래에서 PR이 없다고 멈춘다
        lines.push(`- 건너뜀 ${url}: ${String(e).slice(0, 200)}`)
        continue
      }
      if (!best || Object.keys(samples).length > Object.keys(best.samples).length)
        best = { url, samples }
      if (Object.keys(samples).length === 7) {
        picked = { url, samples }
        break
      }
    }
    picked ??= best
    expect(picked, `${REPO}에 PR이 없다`).not.toBeNull()
    if (!picked) return
    const kinds = Object.keys(picked.samples) as GhKind[]
    lines.push(`- gh: ${version}`, `- 읽은 PR: ${picked.url}`, `- 녹화한 종류: ${kinds.join(', ')}`)
    const broken = kinds.flatMap((k) => ghViolations(k, picked.samples[k] ?? {}))
    lines.push(`- 계약 위반: ${broken.length ? broken.join('; ') : '없음'}`)
    expect(broken).toEqual([])

    const now: GhFixture = {
      ghVersion: version,
      recordedAt: new Date().toISOString().slice(0, 10),
      source: picked.url.replace(/^https:\/\/[^/]+\//, ''),
      shapes: Object.fromEntries(kinds.map((k) => [k, ghShapeOf(picked.samples[k] ?? {})])),
    }
    if (UPDATE) {
      fs.mkdirSync(path.dirname(GH_FIXTURE), { recursive: true })
      fs.writeFileSync(GH_FIXTURE, JSON.stringify(now, null, 2) + '\n')
      lines.push('- 녹화본을 새로 썼다')
      return
    }
    const old = readGhFixture()
    const diffs: string[] = []
    for (const k of kinds) {
      const before = old?.shapes[k] ?? {}
      const after = now.shapes[k] ?? {}
      for (const f of new Set([...Object.keys(before), ...Object.keys(after)]))
        if (before[f] !== after[f])
          diffs.push(`${k}.${f}: ${before[f] ?? '없음'} → ${after[f] ?? '없음'}`)
    }
    // 앱이 읽지 않는 필드의 변화는 앱을 깨지 않는다. 실패로 치지 않고 결과 요약에 남긴다
    lines.push(`- 녹화본과 다른 필드: ${diffs.length ? diffs.slice(0, 50).join('; ') : '없음'}`)
  })
})
