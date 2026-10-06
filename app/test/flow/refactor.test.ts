// [흐름] 리팩터링 유형 (docs/implementation.md M15, I66). 가짜 claude로 리팩터링 Work가
// intake → refactor → verify → Work 완료로 가고, 계획과 리팩터링의 기본 자동 승인, refactor가 intake를 추천하면 멈춤,
// refactor로 [현재 코드 위에서 이어서] 되감기, 의도 승인 전 [intake 다시]로 유형을 리팩터링으로 바꾸기를 본다.
// 버그 수정 흐름은 flow.test.ts, 기능 추가 흐름은 feature.test.ts가 본다.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { skillText } from '../../src/adapters/claude'
import { sha256 } from '../../src/adapters/store'
import { parseFrontMatter } from '../../src/core/validate'
import type { AppConfig } from '../../src/shared/config'
import type { WorkView } from '../../src/shared/views'
import type { LifecycleEvent, WorkState, WorkType } from '../../src/shared/work'
import { drive } from '../support/driver'
import { git, harness, makeRepo, register, settle, type Harness } from '../support/harness'
import {
  REFACTOR_FILES,
  REFACTOR_REQUEST,
  REFACTOR_SAFETY_FILES,
  REPO_FILES,
  handoff,
  refactorIntentDraft,
  refactorScenario,
  scenario,
  steps,
  type Scenario,
  type Step,
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
    create: async (type = 'refactor') => {
      const r = await hh.relay.createWork(projectId, {
        request: REFACTOR_REQUEST,
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

function untilTask(
  s: Setup,
  key: string,
  pred: (t: WorkView['tasks'][number], w: WorkView) => boolean,
  label: string,
) {
  return s.h.ui.until(
    () => {
      const w = s.h.ui.works.get(key)
      const t = w?.tasks.find((x) => x.id === w.current)
      return w && t && pred(t, w) ? t : null
    },
    label,
    60_000,
  )
}

const statuses = (w: WorkState) => w.tasks.map((t) => [t.id, t.node, t.status, t.reason])

/** handoff가 이전 단계를 추천하는 단계 */
function recommending(
  node: 'refactor' | 'verify',
  to: 'intake' | 'refactor',
  reason: string,
): Step[] {
  const base = node === 'verify' ? (refactorScenario().tasks.verify ?? []) : steps(node)
  return base.map((st) =>
    st.do === 'write' && st.file === 'handoff.md'
      ? { ...st, text: handoff({ recommended_next: { node: to, reason } }) }
      : st,
  )
}

describe('[흐름] 리팩터링 유형 (M15)', () => {
  it('intake → refactor → verify → [완료만]. 안전망 커밋 뒤 단계 커밋, 확정본에 type: refactor (D258, D259, D261)', async () => {
    const s = await setup(refactorScenario())
    const key = await s.create()
    const dir = s.dir(key)
    const base = git(s.repo, 'rev-parse', 'main')
    const result = await drive(s.h.relay, s.h.ui, key)
    await settle(s.h, key)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed', reason: null })
    expect(result.tasks.map((t) => [t.label, t.bounces, t.forced])).toEqual([
      ['01 의도 정리', 0, false],
      ['02 계획과 리팩터링', 0, false],
      ['03 리뷰와 검증', 0, false],
    ])

    const w = work(dir)
    expect(w).toMatchObject({ type: 'refactor', status: 'completed', intent: { version: 1 } })
    expect(statuses(w)).toEqual([
      ['t-01', 'intake', 'approved', 'default'],
      ['t-02', 'refactor', 'approved', 'default'],
      ['t-03', 'verify', 'approved', 'default'],
    ])
    expect(s.h.ui.works.get(key)?.type).toBe('refactor')
    expect(events(dir)[0]).toMatchObject({ type: 'work.created', payload: { type: 'refactor' } })

    const intent = parseFrontMatter(read(path.join(dir, 'intent.md')))
    expect(intent.ok && intent.data).toEqual({ schema_version: 1, version: 1, type: 'refactor' })
    expect(intent.body.trim()).toBe(refactorIntentDraft().trim())

    // 안전망을 먼저 커밋하고 구조를 바꾼 커밋이 뒤따른다 (D259, D269)
    const tree = s.tree(key)
    expect(git(tree, 'log', '--format=%s', `${base}..HEAD`).split('\n')).toEqual([
      'refactor: sum 추출',
      'test: avg 안전망',
    ])
    expect(read(path.join(tree, 'src/sum.js'))).toBe(REFACTOR_FILES['src/sum.js'])
    expect(read(path.join(tree, 'test/avg-safety.test.js'))).toBe(
      REFACTOR_SAFETY_FILES['test/avg-safety.test.js'],
    )
    expect(fs.existsSync(path.join(dir, 'tasks', '02-refactor', 'refactor.md'))).toBe(true)

    // context.md: 업무 유형과 리팩터링의 다음 단계 (D261, 3.2). verify는 refactor.md 경로를 받는다 (D275)
    const refactorCtx = read(path.join(dir, 'tasks', '02-refactor', 'context.md'))
    expect(refactorCtx).toContain('- 업무 유형: 리팩터링 (`refactor`)')
    expect(refactorCtx).toContain('- 기본 다음 단계: verify (리뷰와 검증)')
    const verifyCtx = read(path.join(dir, 'tasks', '03-verify', 'context.md'))
    expect(verifyCtx).toContain(path.join(dir, 'tasks', '02-refactor', 'refactor.md'))

    const skills = s.h
      .records()
      .filter((r) => r['type'] === 'start' && !r['resume'])
      .map((r) => r['skill'])
    expect(skills).toEqual(['work-start', 'refactor', 'verify'])

    // 공용 스킬은 리팩터링의 구간만 배포한다 (D279): verify에 refactor.md는 있고 다른 유형의 산출물은 없다
    const skillsSrc = path.resolve(__dirname, '../../../skills')
    const deployed = read(path.join(dir, '.claude', 'skills', 'relay-verify', 'SKILL.md'))
    expect(deployed).toBe(await skillText(skillsSrc, 'verify', 'refactor'))
    expect(deployed).toContain('`refactor.md`')
    expect(deployed).not.toContain('`fix.md`')
    expect(deployed).not.toContain('`design.md`')
    expect(w.tasks.map((t) => t.skill_hash)).toEqual(
      await Promise.all(
        (['work-start', 'refactor', 'verify'] as const).map(
          async (sk) => `sha256:${sha256(await skillText(skillsSrc, sk, 'refactor'))}`,
        ),
      ),
    )
  })

  it('계획과 리팩터링이 의도 정리를 추천하면 자동 승인하지 않고, 승인하면 멈춘다 (D23)', async () => {
    const s = await setup(
      refactorScenario({ refactor: recommending('refactor', 'intake', '완료조건이 서로 부딪힘') }),
      { auto_approve_countdown_sec: 1 } as Partial<AppConfig>,
      { productDefaults: true },
    )
    const key = await s.create()
    const stopped = await drive(s.h.relay, s.h.ui, key, { awaitAuto: true })
    expect(stopped, s.h.ui.dump()).toMatchObject({
      status: 'stopped',
      reason: '이전 단계 추천으로 멈춤: 의도 정리(intake)로 — 완료조건이 서로 부딪힘',
    })
    expect(stopped.tasks.find((t) => t.label === '02 계획과 리팩터링')?.auto).toBe(false)
    await settle(s.h, key)
    const view = s.h.ui.works.get(key)
    expect(view?.steps.map((c) => [c.node, c.recommended, c.keepCode])).toEqual([
      ['intake', true, false],
      ['refactor', false, true],
      ['verify', false, false],
    ])
  })

  it('verify의 추천대로 refactor로 [현재 코드 위에서 이어서] 되감으면 안전망과 변경 커밋이 남는다 (D278)', async () => {
    const s = await setup({
      tasks: {
        ...refactorScenario().tasks,
        't-03': recommending('verify', 'refactor', 'sum의 이름이 레포 관례와 다름'),
      },
    })
    const key = await s.create()
    const dir = s.dir(key)
    const stopped = await drive(s.h.relay, s.h.ui, key)
    expect(stopped, s.h.ui.dump()).toMatchObject({ status: 'stopped' })
    await settle(s.h, key)
    const head = git(s.tree(key), 'rev-parse', 'HEAD')

    const r = await s.h.relay.stepPreview(key, 'refactor', true)
    if (!r.ok) throw new Error(r.error)
    expect(r.preview).toMatchObject({
      node: 'refactor',
      kind: 'rewind',
      keepCodeOffered: true,
      code: { kind: 'keep' },
      discard: [{ taskId: 't-02' }, { taskId: 't-03' }],
    })
    expect(
      await s.h.relay.selectStep(key, {
        node: 'refactor',
        keepCode: true,
        instruction: '',
        expect: r.preview.expect,
      }),
    ).toEqual({ ok: true })
    await untilTask(s, key, (t) => t.id === 't-04' && t.live, '되감은 refactor')
    await settle(s.h, key)
    expect(git(s.tree(key), 'rev-parse', 'HEAD')).toBe(head)
    const w = work(dir)
    expect(statuses(w).slice(-1)).toEqual([['t-04', 'refactor', 'working', 'rewind']])
    expect(w.tasks.at(-1)?.selection?.keep_code).toBe(true)
    // 안전망 커밋 해시를 이어받도록 폐기된 refactor.md 경로를 넣는다 (D281, PR #24 리뷰)
    const ctx = read(path.join(dir, 'tasks', '04-refactor', 'context.md'))
    expect(ctx).toContain('안전망 커밋은 다시 만들지 않는다')
    expect(ctx).toContain(path.join(dir, 'tasks', '02-refactor', 'refactor.md'))
    expect(ctx).toContain(`- 작업 브랜치: relay/${key.split('/')[1]}`)
  })

  it('의도 승인 전 [intake 다시]에서 유형을 리팩터링으로 바꾸면 다음 단계가 refactor다 (D237, D261)', async () => {
    const s = await setup({
      tasks: { ...scenario().tasks, refactor: steps('refactor') },
    })
    const key = await s.create('bugfix')
    const dir = s.dir(key)
    await untilTask(s, key, (t) => t.id === 't-01' && t.status === 'awaiting_approval', '의도 정리')

    const r = await s.h.relay.stepPreview(key, 'intake', false, 'refactor')
    if (!r.ok) throw new Error(r.error)
    expect(r.preview.typeChange).toBe(
      '유형을 버그 수정에서 리팩터링(으)로 바꿉니다. 의도 승인 뒤에는 바꿀 수 없습니다 (D237)',
    )
    expect(
      await s.h.relay.selectStep(key, {
        node: 'intake',
        keepCode: false,
        instruction: '',
        expect: r.preview.expect,
        type: 'refactor',
      }),
    ).toEqual({ ok: true })
    await untilTask(s, key, (t, w) => t.id === 't-02' && w.type === 'refactor', '다시 돈 intake')
    await settle(s.h, key)
    expect(work(dir).type).toBe('refactor')

    const paused = await drive(s.h.relay, s.h.ui, key, { pauseAt: (t) => t.node === 'verify' })
    expect(paused, s.h.ui.dump()).toMatchObject({ status: 'paused' })
    expect(statuses(work(dir)).map(([, node]) => node)).toEqual([
      'intake',
      'intake',
      'refactor',
      'verify',
    ])
  })
})
