// 지식 관리의 켜고 끔 (K1, 규약 2.2): 켜면 intake의 context.md에 레포의 지식이 들어가고 넣은 기록이 남는다. RELAY_KNOWLEDGE=off면
// 지식 절도 기록도 없다
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { drive } from './driver'
import { harness, makeRepo, register, settle, type Harness } from './harness'
import {
  PR,
  REPO_FILES,
  REQUEST,
  VERIFICATION,
  handoff,
  scenario,
  type Scenario,
} from './scenarios'

let h: Harness | undefined
afterEach(async () => {
  await h?.close()
  h = undefined
})
const wait: Scenario = { tasks: { 'work-start': [{ do: 'prompt' }, { do: 'wait' }] } }

async function intakeDir(env: Record<string, string>) {
  const hh = await harness({ scenario: wait, env })
  h = hh
  const { repo } = makeRepo(hh.root, 'knowledge', {
    ...REPO_FILES,
    'docs/knowledge/amount-floor.md': '# 금액은 원 단위로 내림\n',
  })
  const projectId = await register(hh, repo)
  const r = await hh.relay.createWork(projectId, {
    request: REQUEST,
    baseBranch: 'main',
    type: 'bugfix',
    baseLocation: 'local',
  })
  if (!r.ok) throw new Error(r.error)
  await hh.ui.until(
    () => hh.records().some((x) => x['type'] === 'hook' && x['event'] === 'UserPromptSubmit'),
    '첫 프롬프트',
  )
  const workId = r.workKey.split('/')[1] ?? ''
  return path.join(hh.home, 'projects', projectId, 'works', workId, 'tasks', '01-intake')
}

describe('[흐름] 지식 켜고 끔', () => {
  it('켜면 레포의 지식을 context.md에 넣고 넣은 기록을 남긴다', async () => {
    const dir = await intakeDir({ RELAY_KNOWLEDGE: 'on' })
    const context = fs.readFileSync(path.join(dir, 'context.md'), 'utf8')
    expect(context).toContain('## 팀 지식')
    expect(context).toContain('# 금액은 원 단위로 내림')
    expect(fs.readFileSync(path.join(dir, 'knowledge-injected.md'), 'utf8')).toContain(
      'docs/knowledge/amount-floor.md',
    )
  })

  it('RELAY_KNOWLEDGE=off면 지식 절도 넣은 기록도 없다', async () => {
    const dir = await intakeDir({ RELAY_KNOWLEDGE: 'off' })
    const context = fs.readFileSync(path.join(dir, 'context.md'), 'utf8')
    expect(context).not.toContain('지식')
    expect(context).not.toContain('docs/knowledge')
    expect(fs.existsSync(path.join(dir, 'knowledge-injected.md'))).toBe(false)
  })
})

const FEE_PATH = 'docs/knowledge/shipping/fee.md'
const FEE_RULE = [
  '---',
  'kind: rule',
  'source: human',
  '---',
  '# 배송비 기준은 쿠폰 뺀 금액',
  '',
  '## 규칙',
  '- 쿠폰을 뺀 금액으로 무료배송을 판단한다.',
].join('\n')

describe('[흐름] verify의 지식 확인 (D293, D294)', () => {
  it('옛 형식의 지식과 줄 없는 handoff는 되돌리고, 고친 뒤에는 Work가 끝난다', async () => {
    const verify: Scenario['tasks'][string] = [
      { do: 'prompt' },
      {
        do: 'commit',
        files: { [FEE_PATH]: '# 배송비\n쿠폰을 뺀 금액으로 본다.\n' },
        message: 'knowledge',
      },
      { do: 'write', file: 'verification.md', text: VERIFICATION },
      { do: 'write', file: 'pr.md', text: PR },
      { do: 'write', file: 'handoff.md', text: handoff({ summary: '고쳤다.' }) },
      {
        do: 'stop',
        onBlock: [
          { do: 'commit', files: { [FEE_PATH]: FEE_RULE }, message: 'knowledge: 형식' },
          {
            do: 'write',
            file: 'handoff.md',
            text: handoff({ summary: `고쳤다.\n새 지식: ${FEE_PATH} — 맞는 기존 항목 없음` }),
          },
          { do: 'stop' },
        ],
      },
    ]
    const hh = await harness({ scenario: scenario({ verify }), env: { RELAY_KNOWLEDGE: 'on' } })
    h = hh
    const { repo } = makeRepo(hh.root, 'knowledge-verify', REPO_FILES)
    const projectId = await register(hh, repo)
    const r = await hh.relay.createWork(projectId, {
      request: REQUEST,
      baseBranch: 'main',
      type: 'bugfix',
      baseLocation: 'local',
    })
    if (!r.ok) throw new Error(r.error)
    const result = await drive(hh.relay, hh.ui, r.workKey)
    await settle(hh, r.workKey)
    expect(result, hh.ui.dump()).toMatchObject({ status: 'completed', reason: null })
    expect(result.tasks.map((t) => [t.label, t.bounces])).toEqual([
      ['01 의도 정리', 0],
      ['02 원인 분석과 수정', 0],
      ['03 리뷰와 검증', 1],
    ])
    const workId = r.workKey.split('/')[1] ?? ''
    const events = fs
      .readFileSync(
        path.join(hh.home, 'projects', projectId, 'works', workId, 'events.jsonl'),
        'utf8',
      )
      .split('\n')
      .filter((l) => l.includes('bounce'))
      .join('\n')
    expect(events).toContain(FEE_PATH)
    expect(events).toContain('새 지식')
  })
})
