// [흐름] 설계 유형 (docs/implementation.md M20, I109). 가짜 claude로 설계 Work가 intake → spec → verify → Work 완료로
// 가고(설계 문서가 커밋되고 pr.md가 설계 템플릿), 설계 문답의 기본 자동 승인, 열린 질문이 남으면 멈춤, verify가 spec을
// 추천하면 멈춤, Work 완료 화면의 다시 볼 결정(revisit), spec으로 되감기의 기본([현재 문서 위에서 이어서])과 체크를 끈
// 되감기, 의도 승인 전 [intake 다시]로 유형을 설계로 바꾸기, PR 대응 context.md의 spec.md 경로를 본다. 다른 유형의
// 흐름은 flow.test.ts, feature.test.ts, refactor.test.ts, general.test.ts가 본다.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { skillText } from '../../src/adapters/claude'
import { parseFrontMatter } from '../../src/core/validate'
import type { AppConfig } from '../../src/shared/config'
import type { WorkView } from '../../src/shared/views'
import type { LifecycleEvent, WorkState, WorkType } from '../../src/shared/work'
import { drive } from '../support/driver'
import { CART_FILES, FakeGitHub, FakeWorld } from '../support/github'
import { git, harness, makeRepo, register, settle, type Harness } from '../support/harness'
import { currentUntil, openPrWork, refreshUntil, workState } from '../support/pr-scenario'
import {
  REPO_FILES,
  SPEC_DECISIONS,
  SPEC_DOC_FILES,
  SPEC_DOC_PATH,
  SPEC_PR,
  SPEC_REQUEST,
  SPEC_REVISIT,
  handoff,
  scenario,
  specScenario,
  specVerification,
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
    create: async (type = 'spec') => {
      const r = await hh.relay.createWork(projectId, {
        request: SPEC_REQUEST,
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

/** handoff를 바꾼 단계 */
function withHandoff(base: Step[], text: string): Step[] {
  return base.map((st) => (st.do === 'write' && st.file === 'handoff.md' ? { ...st, text } : st))
}

const specVerify = () => specScenario().tasks.verify ?? []

describe('[흐름] 설계 유형 (M20)', () => {
  it('intake → spec(주제 목록과 질문 묶음 둘) → verify → [완료만]. 설계 문서 커밋, spec.md, 설계 pr.md, 확정본에 type: spec, 완료 화면의 다시 볼 결정 (D350~D364, I106)', async () => {
    const s = await setup(specScenario())
    const key = await s.create()
    const dir = s.dir(key)
    const base = git(s.repo, 'rev-parse', 'main')
    const paused = await drive(s.h.relay, s.h.ui, key, {
      pauseAt: (t) => t.node === 'verify' && t.status === 'awaiting_approval',
    })
    expect(paused, s.h.ui.dump()).toMatchObject({ status: 'paused' })
    await settle(s.h, key)

    // Work 완료 화면: 판정표 아래의 다시 볼 결정 (시나리오 7-3, D362)
    const verifyTask = work(dir).tasks.at(-1)
    const review = await s.h.relay.review(key, verifyTask?.id ?? '')
    expect(review?.completion?.revisit).toBe(SPEC_REVISIT)
    expect(review?.completion?.verdicts.every((v) => !v.warn)).toBe(true)

    const result = await drive(s.h.relay, s.h.ui, key)
    await settle(s.h, key)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed', reason: null })
    expect(
      [...paused.tasks, ...result.tasks]
        .filter((t, i, all) => all.findIndex((x) => x.label === t.label) === i)
        .map((t) => [t.label, t.bounces, t.forced]),
    ).toEqual([
      ['01 의도 정리', 0, false],
      ['02 설계 문답', 0, false],
      ['03 리뷰와 검증', 0, false],
    ])

    const w = work(dir)
    expect(w).toMatchObject({ type: 'spec', status: 'completed', intent: { version: 1 } })
    expect(statuses(w)).toEqual([
      ['t-01', 'intake', 'approved', 'default'],
      ['t-02', 'spec', 'approved', 'default'],
      ['t-03', 'verify', 'approved', 'default'],
    ])
    expect(s.h.ui.works.get(key)?.type).toBe('spec')
    expect(events(dir)[0]).toMatchObject({ type: 'work.created', payload: { type: 'spec' } })

    const intent = parseFrontMatter(read(path.join(dir, 'intent.md')))
    expect(intent.ok && intent.data).toEqual({ schema_version: 1, version: 1, type: 'spec' })
    expect(intent.body).toContain(`- 설계 문서: \`${SPEC_DOC_PATH}\` (새 문서)`)

    // 설계 문서만 커밋하고 코드는 바꾸지 않는다 (D350, D351)
    const tree = s.tree(key)
    expect(git(tree, 'log', '--format=%s', `${base}..HEAD`)).toBe('docs: 가중 평균 설계')
    expect(git(tree, 'diff', '--name-only', base, 'HEAD')).toBe(SPEC_DOC_PATH)
    expect(read(path.join(tree, SPEC_DOC_PATH))).toBe(SPEC_DOC_FILES[SPEC_DOC_PATH])
    expect(fs.existsSync(path.join(dir, 'tasks', '02-spec', 'spec.md'))).toBe(true)
    expect(read(path.join(dir, 'tasks', '03-verify', 'pr.md'))).toBe(SPEC_PR)

    // 설계 문답은 주제 목록과 질문 묶음 둘을 물었고, 사람의 결정은 by: human이다 (D357, D358)
    const asked = s.h
      .records()
      .filter(
        (r) =>
          r['type'] === 'hook' &&
          r['event'] === 'PreToolUse' &&
          (r['body'] as { tool_name?: string }).tool_name === 'AskUserQuestion',
      )
    expect(asked).toHaveLength(3)
    const decisions = read(path.join(dir, 'decisions.md'))
    for (const d of SPEC_DECISIONS) expect(decisions).toContain(d.what)

    // context.md: 업무 유형, 설계의 다음 단계, 고정된 질문 방식. verify는 spec.md 경로를 받는다 (D374)
    const specCtx = read(path.join(dir, 'tasks', '02-spec', 'context.md'))
    expect(specCtx).toContain('- 업무 유형: 설계 (`spec`)')
    expect(specCtx).toContain('- 기본 다음 단계: verify (리뷰와 검증)')
    expect(specCtx).toContain(
      '결정마다 확인 (`confirm_each`). 설계 문답은 결정을 모두 묻는다 (D358)',
    )
    const verifyCtx = read(path.join(dir, 'tasks', '03-verify', 'context.md'))
    expect(verifyCtx).toContain(path.join(dir, 'tasks', '02-spec', 'spec.md'))

    const skills = s.h
      .records()
      .filter((r) => r['type'] === 'start' && !r['resume'])
      .map((r) => r['skill'])
    expect(skills).toEqual(['work-start', 'spec', 'verify'])

    // 공용 스킬은 설계의 구간만 배포한다 (D279)
    const skillsSrc = path.resolve(__dirname, '../../../skills')
    const deployed = read(path.join(dir, '.claude', 'skills', 'relay-verify', 'SKILL.md'))
    expect(deployed).toBe(await skillText(skillsSrc, 'verify', 'spec'))
    expect(deployed).toContain('`spec.md`')
    expect(deployed).toContain('## 문서 밖 파일 변경')
    expect(deployed).not.toContain('`fix.md`')
    expect(deployed).not.toContain('## 테스트 파일 변경')
  })

  it('설계 문답은 기본으로 자동 승인되고, 열린 질문이 남으면 자동 승인하지 않는다 (D367, 4.3)', async () => {
    const auto = await setup(
      specScenario(),
      { auto_approve_countdown_sec: 1 } as Partial<AppConfig>,
      {
        productDefaults: true,
      },
    )
    const key = await auto.create()
    const r = await drive(auto.h.relay, auto.h.ui, key, {
      awaitAuto: true,
      pauseAt: (t) => t.node === 'verify',
    })
    expect(r, auto.h.ui.dump()).toMatchObject({ status: 'paused' })
    expect(r.tasks.find((t) => t.label === '02 설계 문답')?.auto).toBe(true)
    await auto.h.close()
    h = undefined

    const open = await setup(
      specScenario({
        spec: withHandoff(
          steps('spec'),
          handoff({ decisions: SPEC_DECISIONS, open_questions: ['가중치에 음수를 받나?'] }),
        ),
      }),
      { auto_approve_countdown_sec: 1 } as Partial<AppConfig>,
      { productDefaults: true },
    )
    const key2 = await open.create()
    const held = await drive(open.h.relay, open.h.ui, key2, {
      awaitAuto: true,
      pauseAt: (t) => t.node === 'spec' && t.status === 'awaiting_approval',
    })
    expect(held, open.h.ui.dump()).toMatchObject({ status: 'paused' })
    await settle(open.h, key2)
    expect(work(open.dir(key2)).tasks.at(-1)?.auto_hold?.reasons).toContain('open_questions')
  })

  it('verify가 설계 문답을 추천하면 멈춘다. 다시 볼 결정이 "없음"이면 완료 화면에 보이지 않는다 (D363, D374, I106)', async () => {
    const s = await setup(
      specScenario({
        verify: specVerify().map((st) =>
          st.do === 'write' && st.file === 'verification.md'
            ? { ...st, text: specVerification('없음') }
            : st.do === 'write' && st.file === 'handoff.md'
              ? {
                  ...st,
                  text: handoff({
                    recommended_next: { node: 'spec', reason: '반영하려면 새 결정이 필요함' },
                  }),
                }
              : st,
        ),
      }),
    )
    const key = await s.create()
    const dir = s.dir(key)
    const stopped = await drive(s.h.relay, s.h.ui, key)
    expect(stopped, s.h.ui.dump()).toMatchObject({
      status: 'stopped',
      reason: '이전 단계 추천으로 멈춤: 설계 문답(spec)로 — 반영하려면 새 결정이 필요함',
    })
    await settle(s.h, key)
    const review = await s.h.relay.review(key, work(dir).tasks.at(-1)?.id ?? '')
    expect(review?.completion?.revisit).toBeNull()
    expect(s.h.ui.works.get(key)?.steps.map((c) => [c.node, c.recommended, c.keepDefault])).toEqual(
      [
        ['intake', false, false],
        ['spec', true, true],
        ['verify', false, false],
      ],
    )
  })

  it('spec으로 되감으면 [현재 문서 위에서 이어서]가 기본이다: 문서 커밋이 남고 폐기된 spec.md와 verification.md 경로를 넣는다. 끄면 되돌린다 (D365, I105)', async () => {
    const s = await setup(specScenario())
    const key = await s.create()
    const dir = s.dir(key)
    const paused = await drive(s.h.relay, s.h.ui, key, {
      pauseAt: (t) => t.node === 'verify' && t.status === 'awaiting_approval',
    })
    expect(paused, s.h.ui.dump()).toMatchObject({ status: 'paused' })
    await settle(s.h, key)
    const head = git(s.tree(key), 'rev-parse', 'HEAD')
    const choice = s.h.ui.works.get(key)?.steps.find((c) => c.node === 'spec')
    expect(choice).toMatchObject({
      keepCode: true,
      keepLabel: '현재 문서 위에서 이어서',
      keepDefault: true,
    })

    // 체크를 끄면 다른 유형처럼 spec을 시작할 때의 커밋으로 되돌린다
    const reset = await s.h.relay.stepPreview(key, 'spec', false)
    if (!reset.ok) throw new Error(reset.error)
    expect(reset.preview.code).toMatchObject({ kind: 'reset', commits: 1 })

    const r = await s.h.relay.stepPreview(key, 'spec', true)
    if (!r.ok) throw new Error(r.error)
    expect(r.preview).toMatchObject({
      node: 'spec',
      kind: 'rewind',
      keepCodeOffered: true,
      code: { kind: 'keep', commits: 0 },
      discard: [{ taskId: 't-02' }, { taskId: 't-03' }],
    })
    expect(
      await s.h.relay.selectStep(key, {
        node: 'spec',
        keepCode: true,
        instruction: '결정 2를 다시 본다',
        expect: r.preview.expect,
      }),
    ).toEqual({ ok: true })
    await untilTask(s, key, (t) => t.id === 't-04' && t.live, '되감은 spec')
    await settle(s.h, key)
    expect(git(s.tree(key), 'rev-parse', 'HEAD')).toBe(head)
    const w = work(dir)
    expect(statuses(w).slice(-1)).toEqual([['t-04', 'spec', 'working', 'rewind']])
    expect(w.tasks.at(-1)?.selection?.keep_code).toBe(true)
    const ctx = read(path.join(dir, 'tasks', '04-spec', 'context.md'))
    expect(ctx).toContain('[현재 문서 위에서 이어서]')
    expect(ctx).toContain('결정 2를 다시 본다')
    expect(ctx).toContain(path.join(dir, 'tasks', '02-spec', 'spec.md'))
    expect(ctx).toContain(path.join(dir, 'tasks', '03-verify', 'verification.md'))
  })

  it('체크를 끄고 spec으로 되감으면 문서 커밋을 백업 브랜치에 남기고 되돌린다 (D365, 6.2)', async () => {
    const s = await setup(specScenario())
    const key = await s.create()
    const base = git(s.repo, 'rev-parse', 'main')
    const paused = await drive(s.h.relay, s.h.ui, key, {
      pauseAt: (t) => t.node === 'verify' && t.status === 'awaiting_approval',
    })
    expect(paused, s.h.ui.dump()).toMatchObject({ status: 'paused' })
    await settle(s.h, key)
    const r = await s.h.relay.stepPreview(key, 'spec', false)
    if (!r.ok) throw new Error(r.error)
    expect(
      await s.h.relay.selectStep(key, {
        node: 'spec',
        keepCode: false,
        instruction: '',
        expect: r.preview.expect,
      }),
    ).toEqual({ ok: true })
    await untilTask(s, key, (t) => t.id === 't-04' && t.live, '되감은 spec')
    await settle(s.h, key)
    expect(git(s.tree(key), 'rev-parse', 'HEAD')).toBe(base)
    expect(fs.existsSync(path.join(s.tree(key), SPEC_DOC_PATH))).toBe(false)
    expect(r.preview.code.backupBranch).toBeTruthy()
    expect(git(s.repo, 'branch', '--list', r.preview.code.backupBranch ?? '')).toContain(
      r.preview.code.backupBranch ?? '',
    )
  })

  it('의도 승인 전 [intake 다시]에서 유형을 설계로 바꾸면 다음 단계가 spec이다 (D237, D353)', async () => {
    const s = await setup({
      tasks: {
        ...scenario().tasks,
        't-02': specScenario().tasks['work-start'] ?? [],
        spec: steps('spec'),
      },
    })
    const key = await s.create('bugfix')
    const dir = s.dir(key)
    await untilTask(s, key, (t) => t.id === 't-01' && t.status === 'awaiting_approval', '의도 정리')

    const r = await s.h.relay.stepPreview(key, 'intake', false, 'spec')
    if (!r.ok) throw new Error(r.error)
    expect(r.preview.typeChange).toBe(
      '유형을 버그 수정에서 설계(으)로 바꿉니다. 의도 승인 뒤에는 바꿀 수 없습니다 (D237)',
    )
    expect(
      await s.h.relay.selectStep(key, {
        node: 'intake',
        keepCode: false,
        instruction: '',
        expect: r.preview.expect,
        type: 'spec',
      }),
    ).toEqual({ ok: true })
    await untilTask(s, key, (t, w) => t.id === 't-02' && w.type === 'spec', '다시 돈 intake')
    await settle(s.h, key)
    expect(work(dir).type).toBe('spec')

    const paused = await drive(s.h.relay, s.h.ui, key, { pauseAt: (t) => t.node === 'verify' })
    expect(paused, s.h.ui.dump()).toMatchObject({ status: 'paused' })
    expect(statuses(work(dir)).map(([, node]) => node)).toEqual([
      'intake',
      'intake',
      'spec',
      'verify',
    ])
  })

  it('설계 Work의 PR 대응 context.md에 spec.md 경로가 있다 (D374)', async () => {
    h = await harness({ config: {} })
    const hh = h
    const { repo, remote } = makeRepo(hh.root, 'cart', CART_FILES)
    const projectId = await register(hh, repo)
    const scratch = path.join(hh.root, 'outside')
    fs.mkdirSync(scratch)
    const gh = new FakeGitHub(path.join(hh.root, 'record'), remote, scratch)
    const ctx = {
      h: hh,
      world: new FakeWorld(gh),
      projectId,
      repo,
      note: () => undefined,
      created: [],
    }
    const respond: Step[] = [
      { do: 'prompt' },
      {
        do: 'write',
        file: 'response.md',
        text: '## 항목별 결과\n- 사람 지시 — 고치지 않음 — 문서가 이미 맞음\n\n## 테스트 실행\n- 테스트 명령 없음\n',
      },
      { do: 'write', file: 'handoff.md', text: handoff({ summary: '사람 지시를 봤다.' }) },
      { do: 'stop' },
    ]
    const claude = specScenario({ 'pr-respond': respond })
    const w = await openPrWork(ctx, claude, 'relay M20 흐름 시험', 'spec')
    await refreshUntil(ctx, w, (x) => x.respond.enabled, '[대응 시작]')
    expect(
      await hh.relay.prRespond(w.key, { items: [], instruction: '결정 2의 이유를 더 적어 주세요' }),
    ).toEqual({ ok: true })
    await currentUntil(
      ctx,
      w,
      (x) => x.node === 'respond' && x.status === 'awaiting_approval',
      '대응 task',
    )
    await settle(hh, w.key)
    expect(workState(w).type).toBe('spec')
    const context = read(path.join(w.dir, 'tasks', '04-respond', 'context.md'))
    expect(context).toContain(path.join(w.dir, 'tasks', '02-spec', 'spec.md'))
    expect(context).toContain(`- 설계 문서: \`${SPEC_DOC_PATH}\` (새 문서)`)
  })
})
