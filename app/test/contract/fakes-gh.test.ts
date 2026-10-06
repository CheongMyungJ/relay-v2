// [계약] 가짜 쪽(gh): 가짜 gh가 계약(gh.ts)을 지키고, 실제 gh의 녹화본(fixtures/gh.json)과 같은 모양을 내는지 본다.
// 앱의 어댑터로 읽는다(readWithApp). 모델과 네트워크를 쓰지 않는다.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prLocation } from '../../src/core/pr'
import { FakeGitHub } from '../support/github'
import { FAKE_GH, git, makeRepo } from '../support/harness'
import {
  GH_CONTRACT,
  ghShapeOf,
  ghViolations,
  readGhFixture,
  readWithApp,
  samplesOf,
  type GhKind,
  type GhRead,
} from './gh'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-contract-gh-'))
let read: GhRead

/**
 * 가짜 gh에만 있는 필드. 녹화본에 없는 상황의 필드라 견줄 수 없거나, 실제에도 있지만 녹화한 PR에 없던 것이다
 */
const FAKE_ONLY: Record<string, string> = {
  'inline.in_reply_to_id': '스레드 답글에만 있다',
}

beforeAll(async () => {
  const record = path.join(root, 'record')
  const { repo, remote } = makeRepo(root, 'sample', { 'src/a.js': 'export const a = 1\n' })
  git(repo, 'checkout', '-q', '-b', 'feature')
  fs.writeFileSync(path.join(repo, 'src/a.js'), 'export const a = 2\n')
  git(repo, 'commit', '-qam', 'change')
  git(repo, 'push', '-q', 'origin', 'feature')
  const head = git(repo, 'rev-parse', 'HEAD')
  const url = 'https://github.test/local/sample/pull/1'
  fs.mkdirSync(record, { recursive: true })
  fs.writeFileSync(
    path.join(record, 'prs.json'),
    JSON.stringify([
      {
        number: 1,
        url,
        repo: remote,
        remote,
        head: 'feature',
        base: 'main',
        state: 'open',
        head_oid: null,
        base_oid: null,
      },
    ]),
  )
  const gh = new FakeGitHub(record, remote, path.join(root, 'scratch'))
  const review = gh.review(1, { body: '살펴봤습니다', state: 'COMMENTED', commit: head })
  gh.inline(1, { body: '여기를 고쳐 주세요', path: 'src/a.js', line: 1, review })
  gh.convo(1, '설명을 더해 주세요')
  gh.setChecks(1, head, [gh.checkRun(1, { name: 'test', conclusion: 'SUCCESS' })])
  const location = prLocation(url)
  if (!location) throw new Error('PR 주소를 읽지 못함')
  read = await readWithApp(FAKE_GH, location, repo, { ...process.env, FAKE_GH_RECORD: record })
})

afterAll(() => fs.rmSync(root, { recursive: true, force: true }))

describe('[계약] 가짜 gh', () => {
  it('앱의 어댑터로 읽은 것이 모든 종류를 담고 계약을 지킨다', () => {
    const samples = samplesOf(read)
    const kinds = Object.keys(GH_CONTRACT) as GhKind[]
    expect(kinds.filter((k) => !samples[k])).toEqual([])
    const broken = kinds.flatMap((k) => ghViolations(k, samples[k] ?? {}))
    expect(broken).toEqual([])
  })

  it('녹화본과 필드와 타입이 같다 (가짜가 실제에 없는 필드를 만들지 않는다)', () => {
    const fixture = readGhFixture()
    expect(fixture, '녹화본이 없다: app-claude의 contract 경우로 녹화한다').not.toBeNull()
    const diffs: string[] = []
    for (const [kind, sample] of Object.entries(samplesOf(read))) {
      const real = fixture?.shapes[kind as GhKind]
      if (!real) continue
      const fake = ghShapeOf(sample)
      // 실제 REST 응답은 앱이 읽지 않는 필드가 많다. 가짜는 그 가운데 일부만 두므로 가짜에 있는 필드만 견준다
      for (const [k, t] of Object.entries(fake)) {
        if (real[k] === t || `${kind}.${k}` in FAKE_ONLY) continue
        // 실제가 null이고 가짜가 값이 있는(또는 그 반대) 필드는 계약이 둘 다 받으면 같다고 본다
        const allowed = GH_CONTRACT[kind as GhKind][k]
        if (allowed && real[k] && allowed.includes(real[k]) && allowed.includes(t)) continue
        diffs.push(`${kind}.${k}: 실제 ${real[k] ?? '없음'}, 가짜 ${t}`)
      }
    }
    expect(diffs).toEqual([])
  })
})
