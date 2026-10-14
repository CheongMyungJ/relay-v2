// [흐름] 지식 정리 후보 (D393): 기준 브랜치의 지식 파일과 코드를 git에서 읽어 후보와 요청을 만든다. 지식 관리를 끄면 후보가
// 없다. 후보 판정의 자세한 경우는 [단위] knowledge-tidy.test.ts가 본다.
import { afterEach, describe, expect, it } from 'vitest'
import { harness, makeRepo, register, type Harness } from '../support/harness'
import { REPO_FILES } from '../support/scenarios'

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
