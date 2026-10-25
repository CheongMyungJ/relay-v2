// 커스텀 유형 (5.6.13, D447~D463): 정의 검사, 파이프라인, 상태 기계, context.md, 형식 검사, 승인 방식, 브랜치, 초안, Work 설정
import { describe, expect, it } from 'vitest'
import { approvalMode, autoApproveNote, taskApprovalMode } from '../../src/core/approval'
import { branchType, renderBranchRule } from '../../src/core/branch'
import { checkWorkSettings, mergeWorkSettings } from '../../src/core/config'
import { CUSTOM_QUESTION_LINE, buildContext, previousInputs } from '../../src/core/context'
import {
  missingProcedures,
  parseCustomType,
  serializeCustomType,
  stepIdError,
  typeIdError,
} from '../../src/core/custom-type'
import { parseDraft } from '../../src/core/draft'
import { createWork, currentTask, taskDirName, transition } from '../../src/core/machine'
import {
  customSections,
  nextStage,
  nodeTitle,
  stagesOf,
  taskArtifacts,
  taskTitle,
  WORK_COMPLETE,
} from '../../src/core/pipeline'
import { decisionsBlock } from '../../src/core/records'
import { stageLead, taskLabel } from '../../src/core/review'
import { checkTask, type TaskCheck } from '../../src/core/validate'
import { DEFAULT_CONFIG, type AppConfig } from '../../src/shared/config'
import type { Handoff } from '../../src/shared/contracts'
import { workTypeLabel, type WorkCustomType, type WorkState } from '../../src/shared/work'
import { legacy } from '../support/legacy'

const TYPE_JSON = JSON.stringify({
  schema_version: 1,
  name: '조사 후 적용',
  description: '먼저 바꿀 곳을 조사하고 그대로 적용하는 일',
  steps: [
    { id: 'survey', title: '조사', sections: ['조사한 곳', '적용 계획'], auto_approve: false },
    { id: 'apply', title: '적용', auto_approve: true },
  ],
})

const CUSTOM: WorkCustomType = {
  id: 'survey-apply',
  name: '조사 후 적용',
  description: '먼저 바꿀 곳을 조사하고 그대로 적용하는 일',
  source: 'repo',
  hash: 'sha256:abc',
  steps: [
    { id: 'survey', title: '조사', sections: ['조사한 곳', '적용 계획'], auto_approve: false },
    { id: 'apply', title: '적용', sections: [], auto_approve: true },
  ],
}

let clock = 0
const at = () => `2026-10-23T10:${String(clock++ % 60).padStart(2, '0')}:00+09:00`

const HANDOFF: Handoff = {
  status: 'awaiting_approval',
  blocked_reason: null,
  decisions: [],
  assumptions: [],
  rejected: [],
  open_questions: [],
  intent_deviation: null,
  risks: [],
}

const VALID: TaskCheck = {
  handoff_present: true,
  status: 'awaiting_approval',
  errors: [],
  warnings: [],
  handoff: HANDOFF,
  handoffHeader: HANDOFF,
}

const MANUAL: AppConfig = {
  ...DEFAULT_CONFIG,
  auto_approve: {
    fix: false,
    design: false,
    implement: false,
    refactor: false,
    spec: false,
    execute: false,
    respond: false,
  },
}

function customWork(): WorkState {
  return createWork({
    type: 'custom',
    customType: CUSTOM,
    workId: 'w-20261023-001',
    baseBranch: 'main',
    baseCommit: 'base0001',
    at: at(),
  }).work
}

/** 지금 task를 띄우고 승인한다 */
function approveCurrent(work: WorkState, config: AppConfig = MANUAL) {
  const task = currentTask(work)
  if (!task) throw new Error('task 없음')
  const started = transition(
    work,
    {
      type: 'session.started',
      taskId: task.id,
      at: at(),
      sessionId: `s-${task.id}`,
      pid: 1000 + task.seq,
      startCommit: 'c',
      skillHash: 'h',
      claudeVersion: '2.1.308',
    },
    config,
  ).work
  const waiting = transition(
    started,
    {
      type: 'Stop',
      taskId: task.id,
      at: at(),
      stopHookActive: false,
      handoffChanged: true,
      check: VALID,
    },
    config,
  ).work
  return transition(waiting, { type: 'approve', taskId: task.id, at: at(), check: VALID }, config)
}

describe('type.json 검사 (D449, D453, D457)', () => {
  it('맞는 정의는 이름, 설명, 단계를 읽고 빈 절과 자동 승인은 기본값이다', () => {
    const r = parseCustomType('survey-apply', TYPE_JSON)
    expect(r).toEqual({
      ok: true,
      def: {
        id: 'survey-apply',
        name: '조사 후 적용',
        description: '먼저 바꿀 곳을 조사하고 그대로 적용하는 일',
        steps: [
          {
            id: 'survey',
            title: '조사',
            sections: ['조사한 곳', '적용 계획'],
            auto_approve: false,
          },
          { id: 'apply', title: '적용', sections: [], auto_approve: true },
        ],
      },
    })
  })

  it('id 모양과 기본 유형·노드와의 겹침을 막는다 (D449)', () => {
    expect(typeIdError('Survey')).toMatch('영어 소문자')
    expect(typeIdError('general')).toMatch('기본 유형')
    expect(typeIdError('custom')).toMatch('기본 유형')
    expect(typeIdError('survey-apply')).toBeNull()
    expect(stepIdError('intake')).toMatch('앱이 쓰는 이름')
    expect(stepIdError('verify')).toMatch('앱이 쓰는 이름')
    expect(stepIdError('handoff')).toMatch('앱이 쓰는 이름')
    expect(stepIdError('a--b')).toMatch('영어 소문자')
    expect(stepIdError('survey')).toBeNull()
    // task 디렉터리·산출물·브랜치 이름이 되므로 길이를 묶는다
    expect(typeIdError('a'.repeat(41))).toMatch('40자')
    expect(stepIdError('a'.repeat(41))).toMatch('40자')
    expect(stepIdError('a'.repeat(40))).toBeNull()
  })

  it('이름 없음, 단계 없음, 겹친 단계 id, 틀린 절과 자동 승인은 모두 오류로 모은다', () => {
    const bad = JSON.stringify({
      name: '',
      steps: [
        { id: 'a', title: 'A', sections: ['같음', '같음'] },
        { id: 'a', title: 'A2' },
        { id: 'b', title: 'B', sections: ['## 제목'], auto_approve: 'yes' },
      ],
    })
    const r = parseCustomType('x', bad)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors).toEqual([
      'name: 유형 이름이 없음',
      'steps[0].sections: `같음`이 두 번 있음',
      '단계 id `a`가 두 번 있음',
      'steps[2].sections: 절 이름 `## 제목`에 줄바꿈이나 #이 있음',
      'steps[2].auto_approve: true/false여야 함',
    ])
    expect(parseCustomType('x', JSON.stringify({ name: 'X', steps: [] }))).toEqual({
      ok: false,
      errors: ['steps: 단계가 하나 이상 있어야 함'],
    })
    expect(parseCustomType('x', '{')).toMatchObject({ ok: false })
  })

  it('쓴 글을 다시 읽으면 같은 정의다', () => {
    const r = parseCustomType('survey-apply', TYPE_JSON)
    if (!r.ok) throw new Error('읽지 못함')
    expect(parseCustomType('survey-apply', serializeCustomType(r.def))).toEqual(r)
  })

  it('단계마다 절차 파일이 있어야 한다', () => {
    expect(missingProcedures(CUSTOM, ['type.json', 'survey.md'])).toEqual([
      '`apply.md` 없음: 단계 `apply`(적용)의 절차 파일',
    ])
  })
})

describe('커스텀 파이프라인 (D447, D458, D462)', () => {
  it('새 Work는 intake, 복사한 단계마다 custom 순이고 마지막 단계가 마무리한다 (D493)', () => {
    const w = { type: 'custom' as const, custom_type: CUSTOM, pipeline: 2 as const }
    expect(stagesOf(w)).toEqual([
      { node: 'intake' },
      { node: 'custom', step: 'survey' },
      { node: 'custom', step: 'apply' },
    ])
    expect(nextStage(w, { node: 'custom', step: 'apply' })).toBe(WORK_COMPLETE)
    // 정의에서 찾지 못한 커스텀 단계와 단계가 없는 기록은 리뷰와 검증 없이 완료되지 않게 verify로 간다
    expect(nextStage(w, { node: 'custom', step: 'gone' })).toEqual({ node: 'verify' })
    expect(stagesOf({ type: 'custom', pipeline: 2 })).toEqual([
      { node: 'intake' },
      { node: 'verify' },
    ])
  })

  it('옛 Work는 intake, 복사한 단계마다 custom, verify 순이다 (D501)', () => {
    expect(stagesOf({ type: 'custom', custom_type: CUSTOM })).toEqual([
      { node: 'intake' },
      { node: 'custom', step: 'survey' },
      { node: 'custom', step: 'apply' },
      { node: 'verify' },
    ])
    const w = { type: 'custom' as const, custom_type: CUSTOM }
    expect(nextStage(w, { node: 'intake' })).toEqual({ node: 'custom', step: 'survey' })
    expect(nextStage(w, { node: 'custom', step: 'survey' })).toEqual({
      node: 'custom',
      step: 'apply',
    })
    expect(nextStage(w, { node: 'custom', step: 'apply' })).toEqual({ node: 'verify' })
    expect(nextStage(w, { node: 'verify' })).toBe(WORK_COMPLETE)
    // 정의에서 찾지 못한 커스텀 단계는 리뷰와 검증 없이 완료되지 않게 verify로 간다
    expect(nextStage(w, { node: 'custom', step: 'gone' })).toEqual({ node: 'verify' })
    expect(nextStage({ type: 'custom' }, { node: 'custom', step: 'survey' })).toEqual({
      node: 'verify',
    })
  })

  it('기본 유형은 PIPELINES와 같다', () => {
    expect(nextStage({ type: 'general' }, { node: 'intake' })).toEqual({ node: 'execute' })
    expect(nextStage({}, { node: 'fix' })).toEqual({ node: 'verify' })
  })

  it('커스텀 단계의 산출물은 <단계 id>.md이고 절은 정의, 비면 기본 두 절이다 (D453)', () => {
    expect(taskArtifacts({ node: 'custom', step: 'survey' })).toEqual(['survey.md'])
    expect(taskArtifacts({ node: 'execute' })).toEqual(['execution.md'])
    expect(customSections(CUSTOM.steps[0] ?? { sections: [] })).toEqual(['조사한 곳', '적용 계획'])
    expect(customSections({ sections: [] })).toEqual(['한 일', '완료조건별 자체 확인'])
  })

  it('화면 이름은 task에 옮긴 단계 이름, 없으면 정의, 그것도 없으면 단계 id다', () => {
    expect(nodeTitle({ node: 'custom', step: 'survey', step_title: '조사' })).toBe('조사')
    expect(taskTitle({ custom_type: CUSTOM }, { node: 'custom', step: 'apply' })).toBe('적용')
    expect(nodeTitle({ node: 'custom', step: 'apply' })).toBe('apply')
    expect(nodeTitle({ node: 'verify' })).toBe('리뷰와 검증')
  })
})

describe('커스텀 Work의 상태 기계 (D458, D462)', () => {
  it('만들 때 복사한 정의를 work.json에 두고, 승인마다 다음 커스텀 단계로 가고 마지막 단계를 승인하면 Work 완료다 (D493)', () => {
    let work = customWork()
    expect(work.type).toBe('custom')
    expect(work.custom_type).toEqual(CUSTOM)
    work = approveCurrent(work).work
    const survey = currentTask(work)
    expect(survey).toMatchObject({ node: 'custom', step: 'survey', step_title: '조사' })
    expect(survey && taskDirName(survey)).toBe('02-survey')
    expect(survey && taskLabel(survey)).toBe('02 조사')
    work = approveCurrent(work).work
    expect(currentTask(work)).toMatchObject({ node: 'custom', step: 'apply', step_title: '적용' })
    work = approveCurrent(work).work
    expect(work.status).toBe('completed')
    expect(work.tasks.map((t) => t.step ?? t.node)).toEqual(['intake', 'survey', 'apply'])
    // 옛 Work는 마지막 커스텀 단계 뒤에 verify가 있다 (D501)
    let old = legacy(customWork())
    for (let i = 0; i < 3; i++) old = approveCurrent(old).work
    expect(currentTask(old)).toMatchObject({ node: 'verify' })
    expect(currentTask(old)?.step).toBeUndefined()
    old = approveCurrent(old).work
    expect(old.status).toBe('completed')
  })

  it('[이 단계 끝나면 멈춤] 뒤 [재개]는 다음 커스텀 단계를 시작한다', () => {
    let work = approveCurrent(customWork()).work
    work = transition(work, { type: 'stopAfter', on: true, at: at() }, MANUAL).work
    work = approveCurrent(work).work
    expect(work.status).toBe('stopped')
    work = transition(work, { type: 'resumeWork', at: at() }, MANUAL).work
    expect(currentTask(work)).toMatchObject({ node: 'custom', step: 'apply' })
  })

  it('만든 이벤트에 유형 id와 출처를 남긴다', () => {
    const created = createWork({
      type: 'custom',
      customType: CUSTOM,
      workId: 'w-20261023-002',
      baseBranch: 'main',
      baseCommit: 'b',
      at: at(),
    })
    const log = created.effects.find((e) => e.type === 'log')
    expect(log?.type === 'log' && log.event.payload).toMatchObject({
      type: 'custom',
      custom_type: { id: 'survey-apply', source: 'repo' },
    })
  })
})

describe('커스텀 단계의 승인 방식 (D457)', () => {
  const survey = CUSTOM.steps[0]
  const apply = CUSTOM.steps[1]

  it('Work 설정, type.json 기본값 순으로 보고 Codex는 수동이다', () => {
    expect(approvalMode(MANUAL, {}, 'custom', 'claude', apply)).toBe('auto')
    expect(approvalMode(MANUAL, {}, 'custom', 'claude', survey)).toBe('manual')
    expect(
      approvalMode(MANUAL, { custom_auto_approve: { survey: true } }, 'custom', 'claude', survey),
    ).toBe('auto')
    expect(
      approvalMode(MANUAL, { custom_auto_approve: { apply: false } }, 'custom', 'claude', apply),
    ).toBe('manual')
    expect(approvalMode(MANUAL, {}, 'custom', 'codex', apply)).toBe('manual')
    expect(approvalMode(MANUAL, {}, 'custom', 'claude')).toBe('manual')
  })

  it('자동 승인이 켜진 단계는 Stop에서 카운트다운을 시작한다. 마무리 단계인 마지막 단계는 늘 수동이다 (D457, D498)', () => {
    const final = approveCurrent(approveCurrent(customWork()).work).work
    const last = currentTask(final)
    expect(last).toMatchObject({ node: 'custom', step: 'apply' })
    if (!last) throw new Error('task 없음')
    expect(taskApprovalMode(MANUAL, final, last)).toBe('manual')
    // 옛 Work의 마지막 커스텀 단계는 마무리 단계가 아니라 정의대로 자동 승인한다
    let work = approveCurrent(legacy(customWork())).work
    work = approveCurrent(work).work
    const task = currentTask(work)
    if (!task) throw new Error('task 없음')
    const started = transition(
      work,
      {
        type: 'session.started',
        taskId: task.id,
        at: at(),
        sessionId: 's',
        pid: 1,
        startCommit: 'c',
        skillHash: 'h',
        claudeVersion: '2.1.308',
      },
      MANUAL,
    ).work
    const stopped = transition(
      started,
      {
        type: 'Stop',
        taskId: task.id,
        at: at(),
        stopHookActive: false,
        handoffChanged: true,
        check: VALID,
      },
      MANUAL,
    ).work
    expect(currentTask(stopped)?.countdown).toBeDefined()
  })
})

describe('커스텀 Work의 context.md (D456, D457)', () => {
  function context(work: WorkState) {
    const task = currentTask(work)
    if (!task) throw new Error('task 없음')
    return buildContext({
      work,
      task,
      config: MANUAL,
      taskDir: '/w/tasks/x',
      draftsDir: '/w/work-drafts',
      projectId: 'p-1',
      request: { path: '/w/request.md', text: '요청' },
      intent: null,
      decisionLog: '',
      ...previousInputs([
        {
          taskId: 't-01',
          node: 'intake',
          handoff: '---\nrejected: [옛 안]\n---\n## 요약\n',
          artifacts: [],
        },
      ]),
    })
  }

  it('intake에 유형 이름, 설명, 단계 목록이 있다', () => {
    const text = context(customWork())
    expect(text).toContain('- 업무 유형: 조사 후 적용 (커스텀 유형 `survey-apply`)')
    expect(text).toContain('## 커스텀 유형')
    expect(text).toContain('- 이름: 조사 후 적용 (`survey-apply`, 레포 유형)')
    expect(text).toContain('- 설명: 먼저 바꿀 곳을 조사하고 그대로 적용하는 일')
    expect(text).toContain('- 단계: 의도 정리 → 조사(`survey`) → 적용(`apply`)')
    expect(text).not.toContain('→ 리뷰와 검증')
    expect(text).not.toContain('이 단계의 산출물')
  })

  it('커스텀 단계에는 이 단계의 산출물과 절, 정의의 승인 방식, 고정 질문 방식 줄이 있다', () => {
    const work = approveCurrent(customWork()).work
    const text = context(work)
    expect(text).toContain('- node: custom (커스텀 단계 `survey`: 조사)')
    expect(text).toContain('- skill: custom')
    expect(text).toContain('- 이 단계의 산출물: `survey.md`, 절 `## 조사한 곳`, `## 적용 계획`')
    expect(text).toMatch(/## 승인 방식\n\n수동 승인 \(task를 시작할 때의 설정/)
    expect(text).toContain(`## 질문 방식\n\n${CUSTOM_QUESTION_LINE}`)
    expect(text).toContain('자동 승인이 켜져 있으면')
  })

  it('앞 커스텀 단계는 custom:<단계 id>로 적는다', () => {
    const inputs = previousInputs([
      { taskId: 't-02', node: 'custom', step: 'survey', handoff: '---\n---\n', artifacts: ['/a'] },
    ])
    expect(inputs.artifacts).toEqual([
      { taskId: 't-02', node: 'custom', step: 'survey', path: '/a' },
    ])
    expect(inputs.previousHandoff).toMatchObject({ taskId: 't-02', step: 'survey' })
  })
})

describe('커스텀 단계의 형식 검사 (D453, D455)', () => {
  const step = { id: 'survey', sections: ['조사한 곳', '적용 계획'] }
  const handoff =
    '---\nstatus: awaiting_approval\nblocked_reason:\ndecisions: []\nassumptions: []\nrejected: []\nopen_questions: []\nintent_deviation: null\nrisks: []\n---\n## 요약\n요약\n## 다음 task가 알아야 할 것\n없음\n'
  const config = { handoff_body_warn_chars: 1500, intent_warn_chars: 1500 }

  it('산출물 <단계 id>.md가 없으면 오류다', () => {
    const r = checkTask({
      node: 'custom',
      type: 'custom',
      files: { 'handoff.md': handoff },
      config,
      customStep: step,
    })
    expect(r.errors.map((e) => e.file)).toEqual(['survey.md'])
  })

  it('정의의 절이 빠지면 오류다', () => {
    const r = checkTask({
      node: 'custom',
      type: 'custom',
      files: { 'handoff.md': handoff, 'survey.md': '## 조사한 곳\n없음\n' },
      config,
      customStep: step,
    })
    expect(r.errors).toEqual([
      expect.objectContaining({ file: 'survey.md', field: '적용 계획', part: 'body' }),
    ])
    const ok = checkTask({
      node: 'custom',
      type: 'custom',
      files: { 'handoff.md': handoff, 'survey.md': '## 조사한 곳\n## 적용 계획\n' },
      config,
      customStep: step,
    })
    expect(ok.errors).toEqual([])
  })

  it('커스텀 Work의 intent 초안은 완료조건마다 확인 방법이 있어야 한다 (D455)', () => {
    const draft =
      '## 목표\n목표\n## 비목표\n없음\n## 원하는 결과\n결과\n## 완료조건\n- [ ] `npm test`가 통과한다\n'
    const r = checkTask({
      node: 'intake',
      type: 'custom',
      files: { 'handoff.md': handoff, 'intent.draft.md': draft },
      config,
    })
    expect(r.errors.map((e) => e.message).join()).toContain('확인 방법')
  })
})

describe('승인 화면의 자동 승인 안내 (D457)', () => {
  it('자동 승인을 켠 커스텀 단계는 켜짐으로 보이고 자동 승인하지 않은 까닭을 보인다', () => {
    const work = { settings: {}, custom_type: CUSTOM }
    const task = {
      node: 'custom' as const,
      step: 'apply',
      status: 'awaiting_approval' as const,
      auto_hold: { at: at(), reasons: ['open_questions' as const] },
    }
    const note = autoApproveNote(work, task, MANUAL)
    expect(note.on).toBe(true)
    expect(note.hold).toContain('열린 질문')
    expect(autoApproveNote(work, { ...task, step: 'survey' }, MANUAL).on).toBe(false)
  })
})

describe('승인 화면의 단계 핵심 (D223, D453)', () => {
  it('커스텀 단계는 산출물의 정의한 절을 그 단계 이름으로 보인다', () => {
    const lead = stageLead(
      'custom',
      { 'survey.md': '## 조사한 곳\n- src/a.js\n\n## 적용 계획\n바꾼다\n' },
      { id: 'survey', title: '조사', sections: ['조사한 곳', '적용 계획'] },
    )
    expect(lead).toEqual({
      title: '조사',
      sections: [
        { title: '조사한 곳', text: '- src/a.js' },
        { title: '적용 계획', text: '바꾼다' },
      ],
    })
    expect(stageLead('custom', {})).toBeNull()
  })
})

describe('그 밖의 자리 (D458, D462)', () => {
  it('작업 브랜치의 {type}은 커스텀 유형 id다', () => {
    expect(branchType('custom', 'survey-apply')).toBe('survey-apply')
    expect(branchType('general')).toBe('chore')
    expect(
      renderBranchRule('{type}/{work-id}', {
        workId: 'w-20261023-001',
        type: 'custom',
        customId: 'survey-apply',
        slug: '',
      }),
    ).toBe('survey-apply/w-20261023-001')
  })

  it('Work 초안은 type: custom과 custom_type으로 커스텀 유형을 가리킨다', () => {
    const ok = parseDraft(
      '---\nproject: p-1\ntype: custom\ncustom_type: survey-apply\n---\n할 일\n',
      ['p-1'],
    )
    expect(ok).toMatchObject({ type: 'custom', customType: 'survey-apply', errors: [] })
    expect(parseDraft('---\nproject: p-1\ntype: custom\n---\n할 일\n', ['p-1']).errors).toEqual([
      'custom_type(커스텀 유형 id)이 없음',
    ])
    expect(
      parseDraft('---\nproject: p-1\ntype: bugfix\n---\n할 일\n', ['p-1']).customType,
    ).toBeNull()
  })

  it('Work 설정은 커스텀 단계 자동 승인을 받고, 빈 객체면 지운다', () => {
    expect(checkWorkSettings({ custom_auto_approve: { survey: true } })).toEqual({
      ok: true,
      value: { custom_auto_approve: { survey: true } },
    })
    expect(checkWorkSettings({ custom_auto_approve: { 'Bad Id': true } }).ok).toBe(false)
    expect(checkWorkSettings({ custom_auto_approve: { survey: 'on' } }).ok).toBe(false)
    const merged = mergeWorkSettings({}, { custom_auto_approve: { apply: false } })
    expect(merged).toEqual({ custom_auto_approve: { apply: false } })
    expect(mergeWorkSettings(merged, { custom_auto_approve: {} })).toEqual({})
  })

  it('결정 로그의 머리 줄은 custom:<단계 id>다', () => {
    expect(
      decisionsBlock({
        taskId: 't-02',
        node: 'custom',
        step: 'survey',
        at: '2026-10-23T10:00:00+09:00',
        by: 'human',
        decisions: [],
      }),
    ).toMatch(/^## t-02 custom:survey — /)
  })

  it('유형 화면 이름은 커스텀이면 그 이름이다', () => {
    expect(workTypeLabel({ type: 'custom', custom_type: { name: '조사 후 적용' } })).toBe(
      '조사 후 적용',
    )
    expect(workTypeLabel({ type: 'refactor' })).toBe('리팩터링')
    expect(workTypeLabel({})).toBe('버그 수정')
  })
})
