// [흐름] 구현 나눔으로 Work 만들기 (D393~D396): 기준 브랜치의 설계 문서에서 조각과 상태를 읽고, 먼저 조각이 머지되지 않은
// 조각은 만들지 않으며, 조각 Work의 work.json과 context.md에 묶음을 남긴다. 앞 조각이 머지되면 뒤 조각을 시작할 수 있고
// 그 context.md에 앞 조각의 Work가 들어간다. 표 읽기와 상태 계산의 자세한 경우는 [단위] plan.test.ts가 본다.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { WorkState } from '../../src/shared/work'
import { git, harness, makeRepo, register, type Harness } from '../support/harness'
import { REPO_FILES, type Scenario } from '../support/scenarios'

let h: Harness | undefined
afterEach(async () => {
  await h?.close()
  h = undefined
})

const wait: Scenario = { tasks: { 'work-start': [{ do: 'prompt' }, { do: 'wait' }] } }

const DESIGN = [
  '# 알림 설정',
  '',
  '## 구현 나눔',
  '',
  '| 조각 | 이름 | 유형 | 먼저 | 목표 |',
  '|---|---|---|---|---|',
  '| s1 | 설정 저장 | 기능 추가 | | 종류별 켜고 끄기를 저장한다 |',
  '| s2 | 방해 금지 | 일반 | s1 | 방해 금지 시간에는 보내지 않는다 |',
  '',
].join('\n')

describe('[흐름] 구현 나눔으로 Work 만들기', () => {
  it('조각 상태, 먼저 조각이 머지되기 전의 막음, 조각 Work의 기록과 context.md, 머지 뒤 뒤 조각', async () => {
    const hh = await harness({ scenario: wait })
    h = hh
    const { repo } = makeRepo(hh.root, 'plan', { ...REPO_FILES, 'docs/notify.md': DESIGN })
    const projectId = await register(hh, repo)
    const base = { baseBranch: 'main', baseLocation: 'local' as const }
    const workDir = (key: string) =>
      path.join(hh.home, 'projects', projectId, 'works', key.split('/')[1] ?? '')
    const context = (key: string) =>
      fs.readFileSync(path.join(workDir(key), 'tasks', '01-intake', 'context.md'), 'utf8')
    const started = (key: string) =>
      hh.ui.until(
        () => fs.existsSync(path.join(workDir(key), 'tasks', '01-intake', 'context.md')),
        'intake context.md',
      )

    const docs = await hh.relay.planDocs(projectId, 'main', 'local')
    expect(docs.map((d) => d.path)).toEqual(['docs/notify.md'])
    expect(docs[0]?.slices.map((s) => [s.id, s.status, s.blocked])).toEqual([
      ['s1', 'ready', null],
      ['s2', 'waiting', '먼저 머지돼야 하는 조각이 있습니다: s1'],
    ])

    // 먼저 조각이 머지되지 않은 조각은 만들지 않는다 (D394)
    const early = await hh.relay.createWork(projectId, {
      ...base,
      request: docs[0]?.slices[1]?.request ?? '',
      type: 'general',
      plan: { doc: 'docs/notify.md', slice: 's2' },
    })
    expect(early).toEqual({ ok: false, error: '먼저 머지돼야 하는 조각이 있습니다: s1' })

    const first = await hh.relay.createWork(projectId, {
      ...base,
      request: docs[0]?.slices[0]?.request ?? '',
      type: 'feature',
      plan: { doc: 'docs/notify.md', slice: 's1' },
    })
    if (!first.ok) throw new Error(first.error)
    await started(first.workKey)
    const w1 = JSON.parse(
      fs.readFileSync(path.join(workDir(first.workKey), 'work.json'), 'utf8'),
    ) as WorkState
    expect(w1.plan).toEqual({ doc: 'docs/notify.md', slice: 's1' })
    expect(context(first.workKey)).toContain('## 묶음 (구현 나눔)')
    expect(context(first.workKey)).toContain('| s1 (이 Work) | 설정 저장 | - | 진행 중 |')
    expect((await hh.relay.planDocs(projectId, 'main', 'local'))[0]?.slices[0]?.status).toBe(
      'active',
    )

    // s1의 Work 브랜치에 커밋하고 main에 머지한다 (PR 머지와 같음)
    const id1 = first.workKey.split('/')[1] ?? ''
    const tree = path.join(hh.home, 'projects', projectId, 'worktrees', id1)
    fs.writeFileSync(path.join(tree, 'settings.js'), 'module.exports = {}\n')
    git(tree, 'add', '-A')
    git(tree, 'commit', '-q', '-m', 's1')
    git(repo, 'merge', '-q', '--no-ff', '-m', 'merge s1', `relay/${id1}`)

    const after = await hh.relay.planDocs(projectId, 'main', 'local')
    expect(after[0]?.slices.map((s) => [s.id, s.status])).toEqual([
      ['s1', 'merged'],
      ['s2', 'ready'],
    ])
    const second = await hh.relay.createWork(projectId, {
      ...base,
      request: after[0]?.slices[1]?.request ?? '',
      type: 'general',
      plan: { doc: 'docs/notify.md', slice: 's2' },
    })
    if (!second.ok) throw new Error(second.error)
    await started(second.workKey)
    const c2 = context(second.workKey)
    expect(c2).toContain(`#### s1 「설정 저장」 — Work ${id1}\n`)
    expect(c2).toContain('| s1 | 설정 저장 | - | 머지됨 |')
    expect(fs.readFileSync(path.join(workDir(second.workKey), 'request.md'), 'utf8')).toContain(
      '`docs/notify.md`의 설계를 따른다',
    )
  })
})
