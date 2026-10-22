// [흐름] 일반 유형 (docs/implementation.md M18, I90). 가짜 claude로 일반 Work가
// intake → execute → verify → Work 완료로 가고, 확인 방법이 빠진 intent 초안의 되돌림(D305, I86), 실행의 기본 자동 승인을
// 본다. 다른 유형의 흐름은 flow.test.ts, feature.test.ts, refactor.test.ts가 본다.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { skillText } from '../../src/adapters/claude'
import { sha256 } from '../../src/adapters/store'
import { parseFrontMatter } from '../../src/core/validate'
import type { AppConfig } from '../../src/shared/config'
import type { LifecycleEvent, WorkState, WorkType } from '../../src/shared/work'
import { drive } from '../support/driver'
import { git, harness, makeRepo, register, settle, type Harness } from '../support/harness'
import {
  GENERAL_FILES,
  GENERAL_REQUEST,
  REPO_FILES,
  generalIntentDraft,
  generalScenario,
  steps,
  type Scenario,
} from '../support/scenarios'

let h: Harness | undefined

afterEach(async () => {
  await h?.close()
  h = undefined
})

const read = (file: string) => fs.readFileSync(file, 'utf8')

interface Setup {
  h: Harness
  repo: string
  create(type?: WorkType): Promise<string>
  dir(workKey: string): string
  tree(workKey: string): string
}

async function setup(
  s: Scenario,
  config: Partial<AppConfig> = {},
  o: { productDefaults?: boolean } = {},
): Promise<Setup> {
  h = await harness({ scenario: s, config, ...o })
  const hh = h
  const { repo } = makeRepo(hh.root, 'sample', REPO_FILES)
  const projectId = await register(hh, repo)
  const id = (key: string) => key.split('/')[1] ?? ''
  return {
    h: hh,
    repo,
    create: async (type = 'general') => {
      const r = await hh.relay.createWork(projectId, {
        request: GENERAL_REQUEST,
        type,
        baseBranch: 'main',
        baseLocation: 'local',
      })
      if (!r.ok) throw new Error(`Work 생성 실패: ${r.error}`)
      return r.workKey
    },
    dir: (key) => path.join(hh.home, 'projects', projectId, 'works', id(key)),
    tree: (key) => path.join(hh.home, 'projects', projectId, 'worktrees', id(key)),
  }
}

function work(dir: string): WorkState {
  return JSON.parse(read(path.join(dir, 'work.json'))) as WorkState
}

function events(dir: string): LifecycleEvent[] {
  return read(path.join(dir, 'events.jsonl'))
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as LifecycleEvent)
}

const statuses = (w: WorkState) => w.tasks.map((t) => [t.id, t.node, t.status, t.reason])

describe('[흐름] 일반 유형 (M18)', () => {
  it('intake → execute → verify → [완료만]. 실행의 커밋과 execution.md, 확정본에 type: general (D302, D303, D310)', async () => {
    const s = await setup(generalScenario())
    const key = await s.create()
    const dir = s.dir(key)
    const base = git(s.repo, 'rev-parse', 'main')
    const result = await drive(s.h.relay, s.h.ui, key)
    await settle(s.h, key)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed', reason: null })
    expect(result.tasks.map((t) => [t.label, t.bounces, t.forced])).toEqual([
      ['01 의도 정리', 0, false],
      ['02 실행', 0, false],
      ['03 리뷰와 검증', 0, false],
    ])

    const w = work(dir)
    expect(w).toMatchObject({ type: 'general', status: 'completed', intent: { version: 1 } })
    expect(statuses(w)).toEqual([
      ['t-01', 'intake', 'approved', 'default'],
      ['t-02', 'execute', 'approved', 'default'],
      ['t-03', 'verify', 'approved', 'default'],
    ])
    expect(s.h.ui.works.get(key)?.type).toBe('general')
    expect(events(dir)[0]).toMatchObject({ type: 'work.created', payload: { type: 'general' } })

    const intent = parseFrontMatter(read(path.join(dir, 'intent.md')))
    expect(intent.ok && intent.data).toEqual({ schema_version: 1, version: 1, type: 'general' })
    expect(intent.body.trim()).toBe(generalIntentDraft().trim())

    const tree = s.tree(key)
    expect(git(tree, 'log', '--format=%s', `${base}..HEAD`)).toBe('docs: README')
    expect(read(path.join(tree, 'README.md'))).toBe(GENERAL_FILES['README.md'])
    expect(fs.existsSync(path.join(dir, 'tasks', '02-execute', 'execution.md'))).toBe(true)

    // context.md: 업무 유형과 일반의 다음 단계 (D303, 3.2). verify는 execution.md 경로를 받는다 (D314)
    const executeCtx = read(path.join(dir, 'tasks', '02-execute', 'context.md'))
    expect(executeCtx).toContain('- 업무 유형: 일반 (`general`)')
    expect(executeCtx).not.toContain('선택 가능한 다음 단계')
    const verifyCtx = read(path.join(dir, 'tasks', '03-verify', 'context.md'))
    expect(verifyCtx).toContain(path.join(dir, 'tasks', '02-execute', 'execution.md'))

    const skills = s.h
      .records()
      .filter((r) => r['type'] === 'start' && !r['resume'])
      .map((r) => r['skill'])
    expect(skills).toEqual(['work-start', 'execute', 'verify'])

    // 공용 스킬은 일반의 구간만 배포한다 (D279): verify에 execution.md는 있고 다른 유형의 산출물은 없다
    const skillsSrc = path.resolve(__dirname, '../../../skills')
    const deployed = read(path.join(dir, 'tasks', '03-verify', 'instructions.md'))
    expect(deployed).toBe(await skillText(skillsSrc, 'verify', 'general'))
    expect(deployed).toContain('`execution.md`')
    expect(deployed).not.toContain('`fix.md`')
    expect(deployed).not.toContain('`refactor.md`')
    expect(w.tasks.map((t) => t.skill_hash)).toEqual(
      await Promise.all(
        (['work-start', 'execute', 'verify'] as const).map(
          async (sk) => `sha256:${sha256(await skillText(skillsSrc, sk, 'general'))}`,
        ),
      ),
    )
  })

  it('완료조건에 확인 방법이 빠진 초안은 [의도 승인]이 꺼지고 Stop에서 되돌려진다. 고치면 이어 간다 (D305, I86)', async () => {
    const fixed = steps('intake').find((st) => st.do === 'write' && st.file === 'handoff.md')
    if (!fixed) throw new Error('intake의 handoff 단계가 없음')
    const s = await setup(
      generalScenario({
        'work-start': [
          { do: 'prompt' },
          { do: 'write', file: 'intent.draft.md', text: generalIntentDraft({ noCheck: true }) },
          fixed,
          {
            do: 'stop',
            onBlock: [{ do: 'write', file: 'intent.draft.md', text: generalIntentDraft() }],
          },
        ],
      }),
    )
    const key = await s.create()
    const dir = s.dir(key)
    const result = await drive(s.h.relay, s.h.ui, key)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    expect(result.tasks.map((t) => [t.label, t.bounces])).toEqual([
      ['01 의도 정리', 1],
      ['02 실행', 0],
      ['03 리뷰와 검증', 0],
    ])
    await settle(s.h, key)
    const bounced = events(dir).filter((e) => e.type === 'task.bounced')
    expect(bounced).toHaveLength(1)
    expect(JSON.stringify(bounced[0])).toContain('확인 방법')
    const intent = parseFrontMatter(read(path.join(dir, 'intent.md')))
    expect(intent.body.trim()).toBe(generalIntentDraft().trim())
  })
})
