// [흐름] 지식 정리 후보 (D393): 기준 브랜치의 지식 파일과 코드를 git에서 읽어 후보와 요청을 만든다. 지식 관리를 끄면 후보가
// 없다. 사이드바의 후보 수(D395)는 앱을 켤 때, 등록 뒤, Work 완료 뒤에 센다. 후보 판정의 자세한 경우는 [단위] knowledge-tidy.test.ts가 본다.
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { drive } from '../support/driver'
import { git, harness, makeRepo, register, type Harness } from '../support/harness'
import { GENERAL_REQUEST, REPO_FILES, generalScenario } from '../support/scenarios'

let h: Harness | undefined
afterEach(async () => {
  await h?.close()
  h = undefined
})

const rule = (anchor: string) =>
  `---\nkind: rule\nsource: human\nanchor: ${anchor}\n---\n# ${anchor}\n\n## 규칙\n- 규칙\n`

const FILES = {
  ...REPO_FILES,
  'src/vat.js': 'const VAT_RATE = 0.1\nmodule.exports = { VAT_RATE }\n',
  'docs/knowledge/billing/vat-a.md': rule('VAT_RATE'),
  'docs/knowledge/billing/vat-b.md': rule('VAT_RATE'),
  'docs/knowledge/billing/old.md': rule('legacyRound'),
}

describe('[흐름] 지식 정리 후보', () => {
  it('같은 anchor와 코드에 없는 anchor를 찾고 일반 Work의 요청을 채운다', async () => {
    const hh = await harness({ env: { RELAY_KNOWLEDGE: 'on' } })
    h = hh
    const { repo } = makeRepo(hh.root, 'tidy', FILES)
    const projectId = await register(hh, repo)
    const view = await hh.relay.knowledgeTidy(projectId, 'main', 'local')
    expect(view.candidates).toEqual([
      {
        kind: 'same_anchor',
        paths: ['docs/knowledge/billing/vat-a.md', 'docs/knowledge/billing/vat-b.md'],
        detail: 'VAT_RATE',
      },
      { kind: 'stale_anchor', paths: ['docs/knowledge/billing/old.md'], detail: 'legacyRound' },
    ])
    expect(view.request).toContain('`docs/knowledge/`의 팀 지식을 정리한다')
  })

  it('지식 관리를 끄면 후보가 없다', async () => {
    const hh = await harness({ env: { RELAY_KNOWLEDGE: 'off' } })
    h = hh
    const { repo } = makeRepo(hh.root, 'tidy', FILES)
    const projectId = await register(hh, repo)
    expect(await hh.relay.knowledgeTidy(projectId, 'main', 'local')).toEqual({
      candidates: [],
      request: '',
    })
  })
})

// 사이드바의 지식 정리 후보 (D395): 앱을 켤 때, 등록 뒤, Work 완료 뒤에 기본 브랜치에서 센다. 화면은 [스모크]가 본다
describe('[흐름] 사이드바의 지식 정리 후보', () => {
  const tidyOf = (hh: Harness) => hh.ui.projectList[0]?.tidy ?? null

  it('등록하면 세고, Work가 완료되면 다시 센다. origin이 앞서면 다시 켤 때 origin에서 센다', async () => {
    const hh = await harness({ scenario: generalScenario(), env: { RELAY_KNOWLEDGE: 'on' } })
    h = hh
    const { repo, remote } = makeRepo(hh.root, 'tidy', FILES)
    const projectId = await register(hh, repo)
    await hh.relay.settled()
    expect(tidyOf(hh)).toEqual({ count: 2, location: 'local' })

    // 기본 브랜치에서 중복을 정리해도 세는 때(Work 완료)까지는 그대로다
    git(repo, 'rm', '-q', 'docs/knowledge/billing/vat-b.md')
    git(repo, 'commit', '-q', '-m', 'tidy')
    const r = await hh.relay.createWork(projectId, {
      request: GENERAL_REQUEST,
      type: 'general',
      baseBranch: 'main',
      baseLocation: 'local',
    })
    if (!r.ok) throw new Error(r.error)
    await hh.relay.settled()
    expect(tidyOf(hh)).toEqual({ count: 2, location: 'local' })
    const result = await drive(hh.relay, hh.ui, r.workKey, { force: true })
    expect(result.status, hh.ui.dump()).toBe('completed')
    await hh.relay.settled()
    expect(tidyOf(hh)).toEqual({ count: 1, location: 'local' })

    // 다른 곳에서 낡은 항목도 지워 push하고 fetch만 했다: 다시 켜면 origin에서 세어 후보가 없다
    const other = path.join(hh.root, 'other')
    git(hh.root, 'clone', '-q', remote, other)
    git(other, 'config', 'user.email', 'relay-test@example.com')
    git(other, 'config', 'user.name', 'relay test')
    git(other, 'pull', '-q', repo, 'main')
    git(other, 'rm', '-q', 'docs/knowledge/billing/old.md')
    git(other, 'commit', '-q', '-m', 'tidy old')
    git(other, 'push', '-q', 'origin', 'HEAD:main')
    git(repo, 'fetch', '-q', 'origin')
    await hh.relay.close()
    await hh.reopen()
    await hh.relay.settled()
    expect(tidyOf(hh)).toBeNull()
  })

  it('지식 관리를 끄면 세지 않는다', async () => {
    const hh = await harness({ env: { RELAY_KNOWLEDGE: 'off' } })
    h = hh
    const { repo } = makeRepo(hh.root, 'tidy', FILES)
    await register(hh, repo)
    await hh.relay.settled()
    expect(tidyOf(hh)).toBeNull()
  })
})
