// Real Relay controller + PTY + git + files. Only Claude and GitHub are fixture processes.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { renderEntry } from '../../src/core/knowledge'
import { readRepoKnowledge } from '../../src/adapters/knowledge'
import { drive } from '../flow/driver'
import { harness, makeRepo, register, settle, type Harness } from '../flow/harness'
import { REPO_FILES, REQUEST, handoff, scenario, steps } from '../flow/scenarios'

function must<T>(value: T | undefined | null): T {
  if (value == null) throw new Error('Missing fixture value')
  return value
}
let h: Harness | undefined
afterEach(async () => {
  await h?.close()
  h = undefined
})

it.each(['drop', 'replace'] as const)(
  'F-%s: Work completion feedback choice survives actual PR delivery',
  async (action) => {
    const id = 'domain-00000001'
    const wrongRule = '빈 배열의 평균은 NaN이다'
    h = await harness({
      scenario: scenario({
        verify: steps('verify').map((step) =>
          step.do === 'write' && step.file === 'handoff.md'
            ? {
                ...step,
                text: handoff({
                  knowledge_feedback: [{ id, note: '빈 배열의 평균은 0으로 보여야 한다' }],
                }),
              }
            : step,
        ),
      }),
    })
    const { repo } = makeRepo(h.root, 'sample', REPO_FILES)
    const projectId = await register(h, repo)
    const pendingDir = path.join(h.home, 'projects', projectId, 'knowledge', 'pending', 'domain')
    fs.mkdirSync(pendingDir, { recursive: true })
    fs.writeFileSync(
      path.join(pendingDir, id + '.md'),
      renderEntry({
        id,
        kind: 'domain',
        subkind: null,
        status: 'active',
        superseded_by: null,
        paths: [],
        terms: ['평균'],
        hashes: {},
        source: { work: 'w-older', task: 't-01', by: 'human' },
        rule: wrongRule,
        why: '예전 요구',
        not_in_code: '사람이 정함',
        incentive: '0을 반환한다',
      }),
    )
    const created = await h.relay.createWork(projectId, {
      request: REQUEST,
      type: 'bugfix',
      baseBranch: 'main',
      baseLocation: 'local',
    })
    if (!created.ok) throw new Error(created.error)
    const key = created.workKey
    const result = await drive(h.relay, h.ui, key, {
      pauseAt: (t) => t.node === 'verify' && t.status === 'awaiting_approval',
    })
    expect(result, h.ui.dump()).toMatchObject({ status: 'paused' })
    await settle(h, key)
    const review = await h.relay.review(key, must(must(h.ui.works.get(key)).current))
    expect(review?.completion?.knowledge?.feedback[0]?.entry?.id).toBe(id)
    expect(review?.completion?.knowledge?.pending[0]?.id).toBe(id)
    const delivery = await h.relay.deliver(key, {
      choice: 'pr',
      uncommitted: null,
      knowledge: { feedback: { [id]: { action, rule: '빈 배열의 평균은 0이다' } } },
    })
    expect(delivery).toEqual({ ok: true })
    await settle(h, key)
    const tree = path.join(h.home, 'projects', projectId, 'worktrees', must(key.split('/')[1]))
    const entries = (await readRepoKnowledge(tree, 'docs/knowledge/')).entries.map((e) => e.entry)
    const evidenceDir = path.resolve('audit-artifacts')
    fs.writeFileSync(
      path.join(evidenceDir, `F-${action}.json`),
      JSON.stringify(
        {
          feedback: review?.completion?.knowledge?.feedback,
          pending: review?.completion?.knowledge?.pending,
          delivery,
          shipped: entries,
        },
        null,
        2,
      ),
    )
    expect(entries.filter((e) => e.status === 'active').map((e) => e.rule)).toEqual(
      action === 'drop' ? [] : ['빈 배열의 평균은 0이다'],
    )
  },
)
