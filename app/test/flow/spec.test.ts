// [흐름] 설계 유형 (docs/implementation.md M20, I109). 가짜 claude로 설계 Work가 intake → spec(마무리, D493) → Work 완료로
// 가고(설계 문서가 커밋되고 pr.md가 설계 템플릿), 마무리 단계인 설계 문답은 자동 승인을 켜도 수동임, Work 완료 화면의
// 다시 볼 결정(revisit), PR 대응 context.md의 spec.md 경로를 본다. 다른 유형의
// 흐름은 flow.test.ts, feature.test.ts, refactor.test.ts, general.test.ts가 본다.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parseFrontMatter } from '../../src/core/validate'
import type { AppConfig } from '../../src/shared/config'
import type { LifecycleEvent, WorkState, WorkType } from '../../src/shared/work'
import { drive } from '../support/driver'
import { CART_FILES, FakeGitHub, FakeWorld } from '../support/github'
import { git, harness, makeRepo, register, settle, type Harness } from '../support/harness'
import { currentUntil, openPrWork, refreshUntil, workState } from '../support/pr-scenario'
import {
  atCompletion,
  REPO_FILES,
  SPEC_DECISIONS,
  SPEC_DOC_FILES,
  SPEC_DOC_PATH,
  SPEC_PR,
  SPEC_REQUEST,
  SPEC_REVISIT,
  handoff,
  specScenario,
  specVerification,
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

const statuses = (w: WorkState) => w.tasks.map((t) => [t.id, t.node, t.status, t.reason])

/** 설계 시나리오에서 독립 리뷰를 받은 뒤의 spec 단계를 바꾼 것 (D496) */
function withReviewed(map: (list: Step[]) => Step[]): Scenario {
  const base = specScenario()
  return { ...base, reviewed: { ...base.reviewed, spec: map(base.reviewed?.spec ?? []) } }
}

describe('[흐름] 설계 유형 (M20)', () => {
  it('intake → spec(주제 목록과 질문 묶음 둘, 마무리) → [완료만]. 설계 문서 커밋, spec.md, 설계 pr.md, 확정본에 type: spec, 완료 화면의 다시 볼 결정 (D350~D364, I106)', async () => {
    const s = await setup(specScenario())
    const key = await s.create()
    const dir = s.dir(key)
    const base = git(s.repo, 'rev-parse', 'main')
    const paused = await drive(s.h.relay, s.h.ui, key, {
      pauseAt: atCompletion('spec'),
    })
    expect(paused, s.h.ui.dump()).toMatchObject({ status: 'paused' })
    await settle(s.h, key)

    // Work 완료 화면: 판정표 아래의 다시 볼 결정 (시나리오 7-3, D362)
    const finalTask = work(dir).tasks.at(-1)
    expect(finalTask?.node).toBe('spec')
    const review = await s.h.relay.review(key, finalTask?.id ?? '')
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
    ])

    const w = work(dir)
    expect(w).toMatchObject({ type: 'spec', status: 'completed', intent: { version: 1 } })
    expect(statuses(w)).toEqual([
      ['t-01', 'intake', 'approved', 'default'],
      ['t-02', 'spec', 'approved', 'default'],
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
    expect(read(path.join(dir, 'tasks', '02-spec', 'pr.md'))).toBe(SPEC_PR)

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

    // context.md: 업무 유형, 설계의 다음 단계, 고정된 질문 방식. 마무리 단계라 마무리 절이 있다 (D493)
    const specCtx = read(path.join(dir, 'tasks', '02-spec', 'context.md'))
    expect(specCtx).toContain('- 업무 유형: 설계 (`spec`)')
    expect(specCtx).not.toContain('선택 가능한 다음 단계')
    expect(specCtx).toContain(
      '결정마다 확인 (`confirm_each`). 설계 문답은 결정을 모두 묻는다 (D358)',
    )
    expect(specCtx).toContain('## 마무리\n')

    const skills = s.h
      .records()
      .filter((r) => r['type'] === 'start' && !r['resume'])
      .map((r) => r['skill'])
    expect(skills).toEqual(['work-start', 'spec'])

    // 공용 스킬과 마무리 절차는 설계의 구간만 배포한다 (D279)
    const deployed = read(path.join(dir, 'tasks', '02-spec', 'instructions.md'))
    expect(deployed).toContain('## Finishing the Work')
    expect(deployed).toContain('`spec.md`')
    expect(deployed).toContain('## 문서 밖 파일 변경')
    expect(deployed).not.toContain('`fix.md`')
    expect(deployed).not.toContain('## 테스트 파일 변경')
  })

  it('설계 문답은 마무리 단계라 자동 승인을 켜도 사람이 승인한다 (D367, D498, 4.3)', async () => {
    // 앱 기본값은 설계 문답의 자동 승인을 켠다. 마지막 작업 단계라 Work 완료 화면이 되어 늘 수동이다
    const auto = await setup(
      specScenario(),
      { auto_approve_countdown_sec: 1 } as Partial<AppConfig>,
      {
        productDefaults: true,
      },
    )
    const key = await auto.create()
    const r = await drive(auto.h.relay, auto.h.ui, key, { awaitAuto: true })
    expect(r, auto.h.ui.dump()).toMatchObject({ status: 'completed' })
    expect(r.tasks.find((t) => t.label === '02 설계 문답')?.auto).toBe(false)
    await settle(auto.h, key)
    expect(work(auto.dir(key)).tasks.map((t) => [t.node, t.approved_by])).toEqual([
      ['intake', 'human'],
      ['spec', 'human'],
    ])
  })

  it('다시 볼 결정이 "없음"이면 완료 화면에 보이지 않는다 (D374, I106)', async () => {
    const s = await setup(
      withReviewed((list) =>
        list.map((st) =>
          st.do === 'write' && st.file === 'verification.md'
            ? { ...st, text: specVerification('없음') }
            : st,
        ),
      ),
    )
    const key = await s.create()
    const dir = s.dir(key)
    const paused = await drive(s.h.relay, s.h.ui, key, {
      pauseAt: atCompletion('spec'),
    })
    expect(paused, s.h.ui.dump()).toMatchObject({ status: 'paused' })
    await settle(s.h, key)
    const review = await s.h.relay.review(key, work(dir).tasks.at(-1)?.id ?? '')
    expect(review?.completion?.revisit).toBeNull()
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
    const context = read(path.join(w.dir, 'tasks', '03-respond', 'context.md'))
    expect(context).toContain(path.join(w.dir, 'tasks', '02-spec', 'spec.md'))
    expect(context).toContain(`- 설계 문서: \`${SPEC_DOC_PATH}\` (새 문서)`)
  })
})
