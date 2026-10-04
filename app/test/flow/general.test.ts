// [흐름] 일반 유형 (docs/implementation.md M18, I90). 가짜 claude로 일반 Work가
// intake → execute → verify → Work 완료로 가고, 확인 방법이 빠진 intent 초안의 되돌림(D305, I86), 실행의 기본 자동 승인,
// execute가 intake를 추천하면 멈춤, execute로 [현재 코드 위에서 이어서] 되감기, 의도 승인 전 [intake 다시]로 유형을
// 일반으로 바꾸기를 본다. 다른 유형의 흐름은 flow.test.ts, feature.test.ts, refactor.test.ts가 본다.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { skillText } from '../../src/adapters/claude'
import { sha256 } from '../../src/adapters/store'
import { parseFrontMatter } from '../../src/core/validate'
import type { AppConfig } from '../../src/shared/config'
import type { WorkView } from '../../src/shared/views'
import type { LifecycleEvent, WorkState, WorkType } from '../../src/shared/work'
import { drive } from './driver'
import { git, harness, makeRepo, register, settle, type Harness } from './harness'
import {
  GENERAL_FILES,
  GENERAL_REQUEST,
  REPO_FILES,
  generalIntentDraft,
  generalScenario,
  handoff,
  scenario,
  steps,
  type Scenario,
  type Step,
} from './scenarios'

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
  node: 'execute' | 'verify',
  to: 'intake' | 'execute',
  reason: string,
): Step[] {
  const base = node === 'verify' ? (generalScenario().tasks.verify ?? []) : steps(node)
  return base.map((st) =>
    st.do === 'write' && st.file === 'handoff.md'
      ? { ...st, text: handoff({ recommended_next: { node: to, reason } }) }
      : st,
  )
}

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
    expect(executeCtx).toContain('- 기본 다음 단계: verify (리뷰와 검증)')
    const verifyCtx = read(path.join(dir, 'tasks', '03-verify', 'context.md'))
    expect(verifyCtx).toContain(path.join(dir, 'tasks', '02-execute', 'execution.md'))

    const skills = s.h
      .records()
      .filter((r) => r['type'] === 'start' && !r['resume'])
      .map((r) => r['skill'])
    expect(skills).toEqual(['work-start', 'execute', 'verify'])

    // 공용 스킬은 일반의 구간만 배포한다 (D279): verify에 execution.md는 있고 다른 유형의 산출물은 없다
    const skillsSrc = path.resolve(__dirname, '../../../skills')
    const deployed = read(path.join(dir, '.claude', 'skills', 'relay-verify', 'SKILL.md'))
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

  it('앱 기본값: 실행은 자동 승인한다 (D315)', async () => {
    const s = await setup(
      generalScenario(),
      { auto_approve_countdown_sec: 1 } as Partial<AppConfig>,
      { productDefaults: true },
    )
    const key = await s.create()
    const result = await drive(s.h.relay, s.h.ui, key, { awaitAuto: true })
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    expect(result.tasks.map((t) => [t.label, t.auto])).toEqual([
      ['01 의도 정리', false],
      ['02 실행', true],
      ['03 리뷰와 검증', false],
    ])
    await settle(s.h, key)
    expect(work(s.dir(key)).tasks.map((t) => [t.node, t.approved_by])).toEqual([
      ['intake', 'human'],
      ['execute', 'auto'],
      ['verify', 'human'],
    ])
  })

  it('실행이 의도 정리를 추천하면 자동 승인하지 않고, 승인하면 멈춘다 (D23)', async () => {
    const s = await setup(
      generalScenario({ execute: recommending('execute', 'intake', '완료조건이 서로 부딪힘') }),
      { auto_approve_countdown_sec: 1 } as Partial<AppConfig>,
      { productDefaults: true },
    )
    const key = await s.create()
    const stopped = await drive(s.h.relay, s.h.ui, key, { awaitAuto: true })
    expect(stopped, s.h.ui.dump()).toMatchObject({
      status: 'stopped',
      reason: '이전 단계 추천으로 멈춤: 의도 정리(intake)로 — 완료조건이 서로 부딪힘',
    })
    expect(stopped.tasks.find((t) => t.label === '02 실행')?.auto).toBe(false)
    await settle(s.h, key)
    const view = s.h.ui.works.get(key)
    expect(view?.steps.map((c) => [c.node, c.recommended, c.keepCode])).toEqual([
      ['intake', true, false],
      ['execute', false, true],
      ['verify', false, false],
    ])
  })

  it('verify의 추천대로 execute로 [현재 코드 위에서 이어서] 되감으면 커밋이 남고 폐기된 execution.md 경로를 넣는다 (D316)', async () => {
    const s = await setup({
      tasks: {
        ...generalScenario().tasks,
        't-03': recommending('verify', 'execute', 'README 예시가 틀림'),
      },
    })
    const key = await s.create()
    const dir = s.dir(key)
    const stopped = await drive(s.h.relay, s.h.ui, key)
    expect(stopped, s.h.ui.dump()).toMatchObject({ status: 'stopped' })
    await settle(s.h, key)
    const head = git(s.tree(key), 'rev-parse', 'HEAD')

    const r = await s.h.relay.stepPreview(key, 'execute', true)
    if (!r.ok) throw new Error(r.error)
    expect(r.preview).toMatchObject({
      node: 'execute',
      kind: 'rewind',
      keepCodeOffered: true,
      code: { kind: 'keep' },
      discard: [{ taskId: 't-02' }, { taskId: 't-03' }],
    })
    expect(
      await s.h.relay.selectStep(key, {
        node: 'execute',
        keepCode: true,
        instruction: '',
        expect: r.preview.expect,
      }),
    ).toEqual({ ok: true })
    await untilTask(s, key, (t) => t.id === 't-04' && t.live, '되감은 execute')
    await settle(s.h, key)
    expect(git(s.tree(key), 'rev-parse', 'HEAD')).toBe(head)
    const w = work(dir)
    expect(statuses(w).slice(-1)).toEqual([['t-04', 'execute', 'working', 'rewind']])
    expect(w.tasks.at(-1)?.selection?.keep_code).toBe(true)
    const ctx = read(path.join(dir, 'tasks', '04-execute', 'context.md'))
    expect(ctx).toContain('아래 폐기된 `execution.md`를 참고해 새 `execution.md`를 쓴다.')
    expect(ctx).toContain(path.join(dir, 'tasks', '02-execute', 'execution.md'))
  })

  it('의도 승인 전 [intake 다시]에서 유형을 일반으로 바꾸면 다음 단계가 execute다 (D237, D303)', async () => {
    const s = await setup({
      tasks: {
        ...scenario().tasks,
        't-02': generalScenario().tasks['work-start'] ?? [],
        execute: steps('execute'),
      },
    })
    const key = await s.create('bugfix')
    const dir = s.dir(key)
    await untilTask(s, key, (t) => t.id === 't-01' && t.status === 'awaiting_approval', '의도 정리')

    const r = await s.h.relay.stepPreview(key, 'intake', false, 'general')
    if (!r.ok) throw new Error(r.error)
    expect(r.preview.typeChange).toBe(
      '유형을 버그 수정에서 일반(으)로 바꿉니다. 의도 승인 뒤에는 바꿀 수 없습니다 (D237)',
    )
    expect(
      await s.h.relay.selectStep(key, {
        node: 'intake',
        keepCode: false,
        instruction: '',
        expect: r.preview.expect,
        type: 'general',
      }),
    ).toEqual({ ok: true })
    await untilTask(s, key, (t, w) => t.id === 't-02' && w.type === 'general', '다시 돈 intake')
    await settle(s.h, key)
    expect(work(dir).type).toBe('general')

    const paused = await drive(s.h.relay, s.h.ui, key, { pauseAt: (t) => t.node === 'verify' })
    expect(paused, s.h.ui.dump()).toMatchObject({ status: 'paused' })
    expect(statuses(work(dir)).map(([, node]) => node)).toEqual([
      'intake',
      'intake',
      'execute',
      'verify',
    ])
  })
})
