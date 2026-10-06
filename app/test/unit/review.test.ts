import { describe, expect, it } from 'vitest'
import { createWork } from '../../src/core/machine'
import {
  TASK_STATUS_LABEL,
  WORK_STATUS_LABEL,
  bandText,
  bounceNotice,
  changeRange,
  emphasis,
  handoffSummary,
  hasVisibleText,
  humanNotice,
  permissionNotice,
  resumeHint,
  revisitDecisions,
  stageLead,
  stopNotice,
  taskLabel,
  toolLabel,
  verdicts,
} from '../../src/core/review'
import type { Handoff, NodeName } from '../../src/shared/contracts'
import type {
  AutoHoldReason,
  FormatIssue,
  StepSelection,
  TaskRecord,
  TaskStatus,
  WorkState,
} from '../../src/shared/work'

const HANDOFF: Handoff = {
  status: 'awaiting_approval',
  blocked_reason: null,
  decisions: [],
  assumptions: [],
  rejected: [],
  open_questions: [],
  intent_deviation: null,
  risks: [],
  recommended_next: null,
}

describe('task 이름과 머리 띠 (D109, 시나리오 2-5)', () => {
  it('탭 이름은 순번과 화면 이름이다', () => {
    expect(taskLabel({ seq: 2, node: 'fix' })).toBe('02 원인 분석과 수정')
    expect(taskLabel({ seq: 1, node: 'intake' })).toBe('01 의도 정리')
    expect(taskLabel({ seq: 12, node: 'verify' })).toBe('12 리뷰와 검증')
    // PR 대응의 화면 이름 (D109, D187)
    expect(taskLabel({ seq: 4, node: 'respond' })).toBe('04 PR 대응')
    expect(bandText({ seq: 3, node: 'verify', reason: 'default' })).toBe(
      '03 리뷰와 검증 · 새 세션 · 이유: 기본 진행',
    )
  })

  it('머리 띠는 이름 · 새 세션 · 이유다', () => {
    expect(bandText({ seq: 4, node: 'fix', reason: 'default' })).toBe(
      '04 원인 분석과 수정 · 새 세션 · 이유: 기본 진행',
    )
    // [이 단계 새 세션으로 다시]로 만든 task (D114)
    expect(bandText({ seq: 5, node: 'fix', reason: 'resume' })).toBe(
      '05 원인 분석과 수정 · 새 세션 · 이유: 재개',
    )
    // 단계 선택으로 들어온 task (6.2)
    expect(bandText({ seq: 6, node: 'fix', reason: 'rewind' })).toBe(
      '06 원인 분석과 수정 · 새 세션 · 이유: 되감기',
    )
    expect(bandText({ seq: 7, node: 'verify', reason: 'skip' })).toBe(
      '07 리뷰와 검증 · 새 세션 · 이유: 건너뛰기',
    )
  })

  it('--resume으로 다시 연 세션은 세션 재개다 (시나리오 3-4)', () => {
    const session = { id: 's', pid: 1, started_at: 'x', alive: true }
    expect(bandText({ seq: 4, node: 'fix', reason: 'default', session })).toBe(
      '04 원인 분석과 수정 · 새 세션 · 이유: 기본 진행',
    )
    expect(
      bandText({
        seq: 4,
        node: 'fix',
        reason: 'default',
        session: { ...session, resumed_at: 'y' },
      }),
    ).toBe('04 원인 분석과 수정 · 세션 재개 · 이유: 기본 진행')
  })

  it('권한 확인 끈 모드가 아니면 경고한다 (D94)', () => {
    expect(permissionNotice({})).toBeNull()
    expect(permissionNotice({ permission_mode: 'bypassPermissions' })).toBeNull()
    expect(permissionNotice({ permission_mode: 'auto' })).toBe(
      '권한 확인 끈 모드가 아님(auto 모드): 일부 동작이 막힐 수 있음',
    )
  })

  it('상태마다 이름이 있다 (3.3, 시나리오 3)', () => {
    const all: TaskStatus[] = [
      'queued',
      'working',
      'asking',
      'input_needed',
      'idle',
      'awaiting_approval',
      'blocked',
      'session_ended',
      'interrupted',
      'approved',
      'discarded',
    ]
    expect(Object.keys(TASK_STATUS_LABEL).sort()).toEqual([...all].sort())
    expect(TASK_STATUS_LABEL.queued).toBe('대기열')
    expect(TASK_STATUS_LABEL.discarded).toBe('폐기됨')
    expect(WORK_STATUS_LABEL.abandoned).toBe('포기')
    expect(WORK_STATUS_LABEL.archived).toBe('보관됨')
  })

  it('이전 단계 추천으로 멈추면 알린다 (D23)', () => {
    const work = createWork({
      type: 'bugfix',
      workId: 'w',
      baseBranch: 'main',
      baseCommit: 'c',
      at: 'x',
    }).work
    expect(stopNotice(work)).toBeNull()
    const stopped = {
      ...work,
      status: 'stopped' as const,
      stop: {
        kind: 'recommended_back' as const,
        task_id: 't-05',
        node: 'fix' as const,
        reason: '완료조건 2 실패',
      },
    }
    expect(stopNotice(stopped)).toBe(
      '이전 단계 추천으로 멈춤: 원인 분석과 수정(fix)로 — 완료조건 2 실패',
    )
  })

  it('[이 단계 끝나면 멈춤]으로 멈추면 승인한 task를 알린다 (시나리오 3-4)', () => {
    const work = createWork({
      type: 'bugfix',
      workId: 'w',
      baseBranch: 'main',
      baseCommit: 'c',
      at: 'x',
    }).work
    const stopped = {
      ...work,
      status: 'stopped' as const,
      stop: { kind: 'after_step' as const, task_id: 't-01' },
    }
    expect(stopNotice(stopped)).toBe('이 단계 끝나면 멈춤: 01 의도 정리 승인 뒤 멈춤')
  })

  it('[재개]가 할 일을 알린다: 기본 다음 단계. verify에서 멈췄으면 Work 완료 화면에서 전달을 고른다 (3.3, D119)', () => {
    const work = createWork({
      type: 'bugfix',
      workId: 'w',
      baseBranch: 'main',
      baseCommit: 'c',
      at: 'x',
    }).work
    expect(resumeHint(work)).toBeNull()
    const at = (node: NodeName, stop: WorkState['stop']): WorkState => ({
      ...work,
      status: 'stopped',
      intent: { version: 1 },
      tasks: work.tasks.map((t) => ({ ...t, node })),
      stop,
    })
    const afterStep = { kind: 'after_step' as const, task_id: 't-01' }
    expect(resumeHint(at('intake', afterStep))).toBe(
      '[재개]하면 다음 단계(원인 분석과 수정)를 시작합니다.',
    )
    expect(resumeHint(at('fix', afterStep))).toBe('[재개]하면 다음 단계(리뷰와 검증)를 시작합니다.')
    expect(resumeHint(at('verify', afterStep))).toBe(
      'Work 완료 화면에서 전달을 고르면 Work를 완료합니다.',
    )
    const back = (node: 'intake' | 'fix') => ({
      kind: 'recommended_back' as const,
      task_id: 't-01',
      node,
      reason: '다시',
    })
    expect(resumeHint(at('fix', back('intake')))).toBe(
      '[재개]하면 추천을 따르지 않고 다음 단계(리뷰와 검증)를 시작합니다. 추천대로 되돌아가려면 [단계 선택]을 누르세요.',
    )
    expect(resumeHint(at('verify', back('fix')))).toBe(
      '추천을 따르지 않고 Work 완료 화면에서 전달을 고르면 Work를 완료합니다. 추천대로 되돌아가려면 [단계 선택]을 누르세요.',
    )
  })
})

describe('형식 되돌림 안내 (D220)', () => {
  it('되돌린 뒤 에이전트가 고치는 동안만 몇 번째인지와 함께 안내한다', () => {
    expect(bounceNotice({ status: 'working', bounce_count: 1 }, 2)).toBe(
      '형식 확인으로 되돌림(1/2): 에이전트가 handoff와 산출물의 형식만 고칩니다. 결정과 판정은 바뀌지 않습니다.',
    )
    expect(bounceNotice({ status: 'working', bounce_count: 0 }, 2)).toBeNull()
    // 고쳐서 승인 대기가 됐거나 상한까지 되돌려 대기면 없다
    expect(bounceNotice({ status: 'awaiting_approval', bounce_count: 0 }, 2)).toBeNull()
    expect(bounceNotice({ status: 'idle', bounce_count: 2 }, 2)).toBeNull()
  })
})

describe('첫 출력의 보이는 글자 (D217)', () => {
  it('제어 문자와 이스케이프 시퀀스만 있으면 보이는 글자가 없다. ConPTY가 먼저 보내는 것들이다', () => {
    expect(hasVisibleText('')).toBe(false)
    expect(hasVisibleText('\x1b[?9001h\x1b[?1004h')).toBe(false)
    expect(hasVisibleText('\x1b[?25l\x1b[2J\x1b[m\x1b[H\r\n')).toBe(false)
    expect(hasVisibleText('\x1b]0;C:\\Windows\\system32\\cmd.exe\x07\x1b[?25h')).toBe(false)
    expect(hasVisibleText('\x1b=\x1b>\x1b(B\t \r\n')).toBe(false)
  })

  it('CLI가 그린 글자가 있으면 있다', () => {
    expect(hasVisibleText('\x1b[?9001hFAKE-CLAUDE READY\r\n')).toBe(true)
    expect(hasVisibleText('\x1b[1m╭───\x1b[0m')).toBe(true)
    expect(hasVisibleText('한글')).toBe(true)
  })
})

describe('진행 표시의 도구 이름 (D216)', () => {
  it('도구 이름과 인자 하나를 보인다. 인자가 없는 도구는 이름만 보인다', () => {
    expect(toolLabel('Bash', { command: 'npm test', description: '시험' })).toBe('Bash(npm test)')
    expect(toolLabel('Grep', { pattern: 'avg\\(', path: 'src' })).toBe('Grep(avg\\()')
    expect(toolLabel('WebFetch', { url: 'https://example.com/a', prompt: '요약' })).toBe(
      'WebFetch(https://example.com/a)',
    )
    expect(toolLabel('Task', { description: '원인 찾기', prompt: '길다' })).toBe('Task(원인 찾기)')
    expect(toolLabel('TodoWrite', { todos: [] })).toBe('TodoWrite')
    expect(toolLabel('Bash', { command: '   ' })).toBe('Bash')
    expect(toolLabel('Mystery', 'not an object')).toBe('Mystery')
    expect(toolLabel('exec_command', { cmd: 'npm test' })).toBe('exec_command(npm test)')
  })

  it('작업 폴더 안의 파일은 상대 경로로, 밖의 파일은 그대로 보인다. 구분자는 /와 \\ 둘 다 본다', () => {
    const cwd = '/home/u/wt/w-1'
    expect(toolLabel('Edit', { file_path: '/home/u/wt/w-1/src/avg.js' }, cwd)).toBe(
      'Edit(src/avg.js)',
    )
    expect(toolLabel('Read', { file_path: '/home/u/wt/w-1/src/avg.js' }, `${cwd}/`)).toBe(
      'Read(src/avg.js)',
    )
    expect(toolLabel('Read', { file_path: '/home/u/wt/w-10/a.js' }, cwd)).toBe(
      'Read(/home/u/wt/w-10/a.js)',
    )
    expect(toolLabel('Write', { file_path: 'C:\\wt\\w-1\\tasks\\fix.md' }, 'C:\\wt\\w-1')).toBe(
      'Write(tasks\\fix.md)',
    )
    expect(toolLabel('NotebookEdit', { notebook_path: '/n/a.ipynb' })).toBe(
      'NotebookEdit(/n/a.ipynb)',
    )
  })

  it('여러 줄이면 첫 줄 뒤에 …를 붙이고, 40자가 넘으면 줄인다', () => {
    expect(toolLabel('Bash', { command: "cat > a.js <<'EOF'\nconsole.log(1)\nEOF" })).toBe(
      "Bash(cat > a.js <<'EOF' …)",
    )
    expect(toolLabel('Bash', { command: '\n  npm   test  \n' })).toBe('Bash(npm test)')
    const long = `node -e "${'x'.repeat(60)}"`
    expect(toolLabel('Bash', { command: long })).toBe(`Bash(${long.slice(0, 39)}…)`)
  })
})

describe('리뷰와 검증에서 멈춘 Work (D229)', () => {
  it('verify가 의도 정리를 추천해 멈추면 알리고, [재개] 대신 Work 완료 화면에서 전달을 고른다', () => {
    const work = createWork({
      type: 'bugfix',
      workId: 'w',
      baseBranch: 'main',
      baseCommit: 'c',
      at: 'x',
    }).work
    const back: WorkState = {
      ...work,
      status: 'stopped',
      intent: { version: 1 },
      tasks: work.tasks.map((t) => ({ ...t, node: 'verify' })),
      stop: { kind: 'recommended_back', task_id: 't-01', node: 'intake', reason: '다시' },
    }
    expect(stopNotice(back)).toBe('이전 단계 추천으로 멈춤: 의도 정리(intake)로 — 다시')
    expect(resumeHint(back)).toBe(
      '추천을 따르지 않고 Work 완료 화면에서 전달을 고르면 Work를 완료합니다. 추천대로 되돌아가려면 [단계 선택]을 누르세요.',
    )
  })
})

describe('OS 알림 문구 (D81)', () => {
  const base = createWork({
    type: 'bugfix',
    workId: 'w',
    baseBranch: 'main',
    baseCommit: 'c',
    at: 'x',
  }).work
  const at = (status: TaskStatus, work: WorkState = base): WorkState => ({
    ...work,
    tasks: work.tasks.map((t) => ({ ...t, status })),
  })

  it('사람이 필요한 상태로 바뀌면 알린다', () => {
    expect(humanNotice(at('working'), at('asking'))).toBe('01 의도 정리: 질문 대기')
    expect(humanNotice(at('working'), at('input_needed'))).toBe('01 의도 정리: 입력 필요')
    expect(humanNotice(at('working'), at('awaiting_approval'))).toBe('01 의도 정리: 승인 대기')
    expect(humanNotice(at('working'), at('blocked'))).toBe('01 의도 정리: 막힘')
    expect(humanNotice(at('idle'), at('session_ended'))).toBe(
      '01 의도 정리: handoff 없이 세션 종료',
    )
    const stopped: WorkState = {
      ...at('approved'),
      status: 'stopped',
      stop: { kind: 'after_step', task_id: 't-01' },
    }
    expect(humanNotice(at('awaiting_approval'), stopped)).toBe(
      '이 단계 끝나면 멈춤: 01 의도 정리 승인 뒤 멈춤',
    )
  })

  it('되감기가 코드를 바꾼 뒤 실패해 끊긴 작업이 되면 알린다 (D136)', () => {
    const op = {
      kind: 'rewind' as const,
      stage: 'reset' as const,
      started_at: 'x',
      node: 'intake' as const,
      from_task: 't-01',
      instruction: null,
      discard: ['t-01'],
      reset_to: 'c',
      backup_branch: null,
      backup_commit: null,
    }
    const running = { ...at('awaiting_approval'), operation: op }
    const cut = { ...running, operation: { ...op, interrupted_at: 'y' } }
    expect(humanNotice(running, cut)).toBe('끊긴 작업이 있습니다: [다시 시도]나 [무시]를 누르세요')
  })

  it('같은 상태가 이어지거나 사람이 필요 없는 상태로 바뀌면 알리지 않는다', () => {
    expect(humanNotice(at('asking'), at('input_needed'))).toBeNull()
    expect(humanNotice(at('awaiting_approval'), at('working'))).toBeNull()
    expect(humanNotice(at('working'), at('idle'))).toBeNull()
    expect(humanNotice(at('working'), at('interrupted'))).toBeNull()
    expect(humanNotice(at('queued'), at('working'))).toBeNull()
  })

  it('자동 승인 카운트다운을 시작하면 알린다. 승인 대기로 바뀌는 알림 대신이다 (D81)', () => {
    const counting = (startedAt: string, work = at('awaiting_approval')): WorkState => ({
      ...work,
      tasks: work.tasks.map((t) => ({ ...t, countdown: { started_at: startedAt, seconds: 15 } })),
    })
    expect(humanNotice(at('working'), counting('a'))).toBe(
      '01 의도 정리: 15초 뒤 자동 승인 (멈추려면 [취소])',
    )
    // 승인 대기에서 새로 시작해도 알린다(새 요청 없이 턴이 다시 끝남, D131). 같은 카운트다운이면 다시 알리지 않는다
    expect(humanNotice(counting('a'), counting('b'))).toContain('15초 뒤 자동 승인')
    expect(humanNotice(counting('a'), counting('a'))).toBeNull()
  })

  it('사람이 누르지 않았는데 자동 승인하지 않게 되면 까닭과 함께 알린다. 사람이 앱에서 한 일은 알리지 않는다 (D130)', () => {
    const holding = (reasons: AutoHoldReason[], work = at('awaiting_approval')): WorkState => ({
      ...work,
      tasks: work.tasks.map((t) => ({ ...t, auto_hold: { at: 'x', reasons } })),
    })
    expect(humanNotice(at('working'), holding(['open_questions']))).toBe(
      '01 의도 정리: 승인 대기 — 자동 승인하지 않음(열린 질문이 있음)',
    )
    expect(humanNotice(at('awaiting_approval'), holding(['session']))).toBe(
      '01 의도 정리: 승인 대기 — 자동 승인하지 않음(카운트다운 중에 세션이 끝남)',
    )
    // [취소], [즉시 중단], 설정 끔은 사람이 앱에서 한 일이다. 배지가 바뀌면 보통의 알림이다
    expect(humanNotice(at('awaiting_approval'), holding(['cancel']))).toBeNull()
    expect(humanNotice(at('awaiting_approval'), holding(['interrupt']))).toBeNull()
    expect(humanNotice(at('awaiting_approval'), holding(['settings']))).toBeNull()
    expect(humanNotice(at('working'), holding(['settings']))).toBe('01 의도 정리: 승인 대기')
    // 같은 까닭이 이어지면 다시 알리지 않는다
    expect(humanNotice(holding(['session']), holding(['session']))).toBeNull()
  })
})

describe('[변경]의 범위 (D83: 이 task의 diff)', () => {
  const base = createWork({
    type: 'bugfix',
    workId: 'w',
    baseBranch: 'main',
    baseCommit: 'c0',
    at: 'x',
  }).work
  const first = base.tasks[0] as TaskRecord
  const task = (seq: number, node: NodeName, extra: Partial<TaskRecord> = {}): TaskRecord => ({
    ...first,
    id: `t-${String(seq).padStart(2, '0')}`,
    seq,
    node,
    status: 'approved',
    ...extra,
  })
  const withTasks = (...tasks: TaskRecord[]): WorkState => ({ ...base, tasks })
  const selection = (reset: StepSelection['reset']): StepSelection => ({
    from_task: 't-03',
    instruction: null,
    discarded: [],
    skipped: [],
    keep_code: reset === null,
    reset,
  })

  it('끝난 task는 다음 task의 시작 커밋까지, 지금 코드의 마지막 task는 작업 트리까지다', () => {
    const work = withTasks(
      task(1, 'intake', { start_commit: 'a' }),
      task(2, 'fix', { start_commit: 'b' }),
      task(3, 'verify', { start_commit: 'c', status: 'working' }),
    )
    expect(changeRange(work, 't-01')).toEqual({ from: 'a', to: 'b' })
    expect(changeRange(work, 't-02')).toEqual({ from: 'b', to: 'c' })
    expect(changeRange(work, 't-03')).toEqual({ from: 'c', to: null })
    expect(changeRange(work, 't-09')).toBeNull()
  })

  it('리뷰에서 반영한 커밋은 리뷰와 검증의 [변경]에 있고 원인 분석과 수정의 [변경]에는 없다 (D83, D229)', () => {
    // intake → fix(원인 분석과 수정, 커밋) → verify(사람이 고른 지적을 반영해 커밋). 반영 커밋은 verify가 바꾼 것이다.
    // 모든 커밋은 Work 완료 화면의 [전체 변경](기준 커밋부터)에 들어간다
    const work = withTasks(
      task(1, 'intake', { start_commit: 'a' }),
      task(2, 'fix', { start_commit: 'a' }),
      task(3, 'verify', { start_commit: 'fixed', status: 'awaiting_approval' }),
    )
    expect(changeRange(work, 't-01')).toEqual({ from: 'a', to: 'a' })
    expect(changeRange(work, 't-02')).toEqual({ from: 'a', to: 'fixed' })
    expect(changeRange(work, 't-03')).toEqual({ from: 'fixed', to: null })
  })

  it('시작하지 않은 task는 범위가 없고, 코드를 바꾸지 않아 앞 task의 범위도 끝내지 않는다', () => {
    const work = withTasks(
      task(1, 'intake', { start_commit: 'a' }),
      task(2, 'fix', { status: 'queued' }),
    )
    expect(changeRange(work, 't-02')).toBeNull()
    expect(changeRange(work, 't-01')).toEqual({ from: 'a', to: null })
  })

  it('코드를 되돌린 되감기로 끝난 task는 백업 커밋까지다. 백업이 없었으면 되돌리기 전 HEAD다 (D116)', () => {
    const reset = {
      from: 'head',
      to: 'b',
      backup_branch: 'relay/w-discarded-1',
      backup_commit: 'bk',
    }
    const tasks = [
      task(1, 'intake', { start_commit: 'a' }),
      task(2, 'fix', { start_commit: 'b', status: 'discarded' }),
      task(3, 'verify', { start_commit: 'c', status: 'discarded' }),
    ]
    const work = withTasks(
      ...tasks,
      task(4, 'fix', { start_commit: 'b', status: 'working', selection: selection(reset) }),
    )
    // 폐기된 fix는 폐기된 verify가 시작할 때까지(자기 커밋), 폐기된 verify는 백업 커밋까지다
    expect(changeRange(work, 't-02')).toEqual({ from: 'b', to: 'c' })
    expect(changeRange(work, 't-03')).toEqual({ from: 'c', to: 'bk' })
    expect(changeRange(work, 't-04')).toEqual({ from: 'b', to: null })
    const noBackup = withTasks(
      ...tasks,
      task(4, 'fix', {
        status: 'queued',
        selection: selection({ ...reset, backup_branch: null, backup_commit: null }),
      }),
    )
    expect(changeRange(noBackup, 't-03')).toEqual({ from: 'c', to: 'head' })
  })

  it('코드를 두는 선택(건너뛰기, [현재 코드 위에서 이어서])은 새 task의 시작 커밋까지다', () => {
    const work = withTasks(
      task(1, 'intake', { start_commit: 'a' }),
      task(2, 'fix', { start_commit: 'b' }),
      task(3, 'verify', { start_commit: 'c', status: 'discarded' }),
      task(4, 'fix', { start_commit: 'd', status: 'working', selection: selection(null) }),
    )
    expect(changeRange(work, 't-03')).toEqual({ from: 'c', to: 'd' })
  })

  it('정리한 Work(보관됨)는 작업 트리가 없어 마지막 task도 정리하기 전 HEAD까지다 (시나리오 8)', () => {
    const tasks = [
      task(1, 'intake', { start_commit: 'a' }),
      task(2, 'fix', { start_commit: 'a' }),
      task(3, 'verify', { start_commit: 'b' }),
    ]
    const cleaned = { at: 'x', head: 'h', forced: false, deleted_branches: [] }
    const archived: WorkState = { ...withTasks(...tasks), status: 'archived', cleaned }
    expect(changeRange(archived, 't-02')).toEqual({ from: 'a', to: 'b' })
    expect(changeRange(archived, 't-03')).toEqual({ from: 'b', to: 'h' })
    // worktree가 없어 HEAD를 몰랐으면 빈 범위다
    const unknown: WorkState = { ...archived, cleaned: { ...cleaned, head: null } }
    expect(changeRange(unknown, 't-03')).toEqual({ from: 'b', to: 'b' })
  })
})

describe('강조 영역 (D83, 시나리오 4-2)', () => {
  const ERR: FormatIssue = { file: 'handoff.md', part: 'body', message: '`## 요약` 절 없음' }

  it('사람이 봐야 할 것이 없으면 비어 있다', () => {
    expect(
      emphasis({ node: 'fix', type: 'bugfix', handoff: HANDOFF, errors: [], uncommitted: [] }),
    ).toEqual([])
  })

  it('intent_deviation, 열린 질문, 이전 단계 추천, 커밋 안 된 변경, 형식 오류를 순서대로 모은다', () => {
    const items = emphasis({
      node: 'verify',
      type: 'bugfix',
      handoff: {
        ...HANDOFF,
        intent_deviation: { summary: '범위를 넘음', evidence: 'refresh.ts도 바뀜' },
        open_questions: ['운영 TZ는?'],
        recommended_next: { node: 'fix', reason: '완료조건 2 실패' },
      },
      errors: [ERR],
      uncommitted: [' M src/a.ts'],
    })
    expect(items.map((i) => i.kind)).toEqual([
      'intent_deviation',
      'open_questions',
      'recommended_back',
      'uncommitted',
      'format_errors',
    ])
    expect(items[0]?.lines).toEqual(['범위를 넘음', '근거: refresh.ts도 바뀜'])
    expect(items[2]?.lines).toEqual([
      '원인 분석과 수정(fix)로 — 완료조건 2 실패',
      '승인하면 다음 단계를 시작하지 않고 멈춥니다. 되돌아갈 단계는 멈춘 뒤 [단계 선택]으로 고릅니다.',
    ])
    expect(items[4]?.lines).toEqual(['handoff.md: `## 요약` 절 없음'])
    // 열린 질문은 어디에 답하는지 알린다 (D222)
    expect(items[1]).toEqual({
      kind: 'open_questions',
      title: '열린 질문',
      lines: ['운영 TZ는?'],
      hint: '답은 가운데 터미널에 쓰세요. 답하면 에이전트가 산출물을 고쳐 다시 승인 대기가 됩니다.',
    })
    expect(items.filter((i) => i.hint).map((i) => i.kind)).toEqual(['open_questions'])
    // 세션이 없으면(앱이 꺼져 끝난 세션 등) 터미널이 읽기 전용이라 [세션 재개]를 먼저 누르라고 한다
    const ended = emphasis({
      node: 'intake',
      type: 'bugfix',
      handoff: { ...HANDOFF, open_questions: ['운영 TZ는?'] },
      errors: [],
      uncommitted: [],
      live: false,
    })
    expect(ended[0]?.hint).toBe(
      '세션이 끝나 있습니다. [세션 재개]를 누른 뒤 가운데 터미널에 답을 쓰세요. 답하면 에이전트가 산출물을 고쳐 다시 승인 대기가 됩니다.',
    )
  })

  it('기본 다음 단계 추천은 강조하지 않는다. 막힘은 blocked_reason을 맨 앞에 둔다 (4.4)', () => {
    expect(
      emphasis({
        node: 'fix',
        type: 'bugfix',
        handoff: { ...HANDOFF, recommended_next: { node: 'verify', reason: '다음' } },
        errors: [],
        uncommitted: [],
      }),
    ).toEqual([])
    const blocked = emphasis({
      node: 'fix',
      type: 'bugfix',
      handoff: { ...HANDOFF, status: 'blocked', blocked_reason: '운영 로그가 없음' },
      errors: [],
      uncommitted: [],
    })
    expect(blocked).toEqual([{ kind: 'blocked', title: '막힘', lines: ['운영 로그가 없음'] }])
  })

  it('[요약] 맨 위: 의도 정리는 intent 초안의 목표·비목표·완료조건이다 (D223)', () => {
    const draft = [
      '---',
      'type: bugfix',
      '---',
      '## 목표',
      '빈 배열의 평균을 0으로',
      '## 비목표',
      '- 음수 처리',
      '## 원하는 결과',
      'avg([]) = 0',
      '## 완료조건',
      '- [ ] avg([])가 0이다',
      '',
    ].join('\n')
    expect(stageLead('intake', { 'intent.draft.md': draft })).toEqual({
      title: '의도 초안',
      sections: [
        { title: '목표', text: '빈 배열의 평균을 0으로' },
        { title: '비목표', text: '- 음수 처리' },
        { title: '완료조건', text: '- [ ] avg([])가 0이다' },
      ],
    })
    // 머리글을 읽지 못하거나 절이 빠져도 읽은 만큼 보인다. 보일 절이 하나도 없거나 초안이 없으면 다른 단계처럼 없다
    expect(stageLead('intake', { 'intent.draft.md': '## 목표\n무엇\n' })).toEqual({
      title: '의도 초안',
      sections: [{ title: '목표', text: '무엇' }],
    })
    expect(
      stageLead('intake', { 'intent.draft.md': '---\ntype: bugfix\n---\n본문만\n' }),
    ).toBeNull()
    expect(stageLead('intake', {})).toBeNull()
  })

  it('[요약] 맨 위: 설계와 계획은 design.md의 유저 시나리오와 요구사항, 구현은 implement.md의 계획과 달라진 점이다 (D223, D256)', () => {
    const design = [
      '## 유저 시나리오',
      '1. 개발자가 중앙값을 구한다',
      '',
      '## 요구사항',
      '### 기능',
      '- F1. 빈 배열이면 0',
      '### 비기능',
      '없음',
      '',
      '## 접근',
      '- 방식: 정렬',
      '',
    ].join('\n')
    expect(stageLead('design', { 'design.md': design })).toEqual({
      title: '설계',
      sections: [
        { title: '유저 시나리오', text: '1. 개발자가 중앙값을 구한다' },
        { title: '요구사항', text: '### 기능\n- F1. 빈 배열이면 0\n### 비기능\n없음' },
      ],
    })
    const implement = '## 변경 요약\n- x\n\n## 계획과 달라진 점\n없음\n\n## 새 동작 테스트\n'
    expect(stageLead('implement', { 'implement.md': implement })).toEqual({
      title: '구현',
      sections: [{ title: '계획과 달라진 점', text: '없음' }],
    })
    const refactor =
      '## 계획\n- 목표 구조: sum 추출\n\n## 안전망 테스트\n- 안전망 커밋: abc\n\n## 변경 요약\n- x\n\n## 찾은 버그와 받아들인 차이\n없음\n'
    expect(stageLead('refactor', { 'refactor.md': refactor })).toEqual({
      title: '리팩터링',
      sections: [
        { title: '계획', text: '- 목표 구조: sum 추출' },
        { title: '찾은 버그와 받아들인 차이', text: '없음' },
      ],
    })
    const execution =
      '## 계획\n- 할 일: README를 쓴다\n\n## 변경 요약\n- x\n\n## 완료조건별 자체 확인\n| a | b | c |\n\n## 테스트 실행\n- 명령: npm test\n'
    expect(stageLead('execute', { 'execution.md': execution })).toEqual({
      title: '실행',
      sections: [
        { title: '계획', text: '- 할 일: README를 쓴다' },
        { title: '완료조건별 자체 확인', text: '| a | b | c |' },
      ],
    })
    // 설계 문답은 spec.md의 주제 목록이다 (D374)
    const spec =
      '## 주제 목록\n1. 가중치 모양 — 정함\n2. 구현 나눔 — 사람이 뺌\n\n## 문답 기록\n### 주제 1. 가중치 모양\n- x\n\n## 확인한 것\n- 없음\n\n## 문서 변경\n- y\n'
    expect(stageLead('spec', { 'spec.md': spec })).toEqual({
      title: '설계 문답',
      sections: [{ title: '주제 목록', text: '1. 가중치 모양 — 정함\n2. 구현 나눔 — 사람이 뺌' }],
    })
    expect(stageLead('design', {})).toBeNull()
    expect(stageLead('implement', { 'design.md': design })).toBeNull()
  })

  it('강조 영역의 이전 단계 추천은 그 Work 유형으로 가린다 (D23)', () => {
    const rec = { ...HANDOFF, recommended_next: { node: 'design' as const, reason: '설계' } }
    const back = emphasis({
      node: 'implement',
      type: 'feature',
      handoff: rec,
      errors: [],
      uncommitted: [],
    })
    expect(back.map((e) => e.kind)).toEqual(['recommended_back'])
    expect(back[0]?.lines[0]).toBe('설계와 계획(design)로 — 설계')
  })

  it('[요약] 맨 위: 원인 분석과 수정은 fix.md의 원인 절이다. 절이나 파일이 없으면 없다 (D223, D228)', () => {
    const fix = [
      '## 재현',
      '`node repro.js`가 NaN을 출력',
      '',
      '## 원인',
      'src/avg.js:2에서 길이 0으로 나눔',
      '',
      '## 변경 요약',
      '- 빈 배열이면 0',
      '',
    ].join('\r\n')
    expect(stageLead('fix', { 'fix.md': fix })).toEqual({
      title: '원인',
      sections: [{ title: '원인', text: 'src/avg.js:2에서 길이 0으로 나눔' }],
    })
    expect(stageLead('fix', { 'fix.md': '## 재현\n됨\n' })).toBeNull()
    expect(stageLead('fix', {})).toBeNull()
    // 다른 단계의 파일은 보지 않는다
    expect(stageLead('fix', { 'verification.md': '## 리뷰 지적\n1. x\n' })).toBeNull()
  })

  it('[요약] 맨 위: 리뷰와 검증은 verification.md의 리뷰 지적과 반영 절이다. 다른 단계는 없다 (D223, D229)', () => {
    const review =
      '## 리뷰 지적\r\n1. [권장] src/avg.js:2 — 주석\r\n\r\n## 반영\r\n없음\r\n\r\n## 완료조건 판정\r\n| a | 통과 | b |\r\n'
    expect(stageLead('verify', { 'verification.md': review })).toEqual({
      title: '리뷰 지적',
      sections: [
        { title: '리뷰 지적', text: '1. [권장] src/avg.js:2 — 주석' },
        { title: '반영', text: '없음' },
      ],
    })
    // 있는 절만 보인다
    expect(stageLead('verify', { 'verification.md': '## 리뷰 지적\n없음\n' })).toEqual({
      title: '리뷰 지적',
      sections: [{ title: '리뷰 지적', text: '없음' }],
    })
    expect(stageLead('verify', { 'verification.md': '## 완료조건 판정\n표\n' })).toBeNull()
    // 옛 review.md는 읽지 않는다
    expect(stageLead('verify', { 'review.md': '## 리뷰 지적\n1. x\n' })).toBeNull()
    expect(stageLead('verify', {})).toBeNull()
    expect(stageLead('verify', { 'fix.md': '## 원인\nx\n' })).toBeNull()
    const both = { 'verification.md': review, 'fix.md': '## 원인\nx\n' }
    expect(stageLead('respond', both)).toBeNull()
    expect(stageLead('intake', both)).toBeNull()
  })

  it('handoff의 요약 절을 읽는다. 머리글을 읽지 못해도 본문에서 찾는다', () => {
    const text =
      '---\nstatus: awaiting_approval\n---\n## 요약\n재현됨.\n둘째 줄\n\n## 다음 task가 알아야 할 것\n- x\n'
    expect(handoffSummary(text)).toBe('재현됨.\n둘째 줄')
    expect(handoffSummary('## 요약\n머리글 없음\n')).toBe('머리글 없음')
    expect(handoffSummary('---\nstatus: x\n---\n본문만\n')).toBeNull()
  })
})

describe('판정표 (시나리오 7-3, D59)', () => {
  const text = [
    '## 완료조건 판정',
    '| 완료조건 | 판정 | 근거 |',
    '|---|---|---|',
    '| 재현 절차가 더 이상 실패하지 않는다 | 통과 | `node repro.js` 출력 OK |',
    '| `npm test`가 통과한다 | **통과** | 12 passed |',
    '| 기존 테스트를 약화하거나 삭제하지 않는다 | 실패 | a.test.js의 단언 삭제 \\| 사람 판단: 약화 |',
    '| 운영에서도 맞다 | 판정 불가 | 운영 환경 없음 |',
    '',
    '## 테스트 파일 변경',
    '| 이건 | 다른 | 표 |',
  ].join('\n')

  it('완료조건 판정 절의 행을 읽고 통과가 아니면 경고한다', () => {
    expect(verdicts(text)).toEqual([
      {
        criterion: '재현 절차가 더 이상 실패하지 않는다',
        verdict: '통과',
        basis: '`node repro.js` 출력 OK',
        warn: false,
      },
      { criterion: '`npm test`가 통과한다', verdict: '**통과**', basis: '12 passed', warn: false },
      {
        criterion: '기존 테스트를 약화하거나 삭제하지 않는다',
        verdict: '실패',
        basis: 'a.test.js의 단언 삭제 | 사람 판단: 약화',
        warn: true,
      },
      { criterion: '운영에서도 맞다', verdict: '판정 불가', basis: '운영 환경 없음', warn: true },
    ])
  })

  it('구분 줄은 하이픈 하나여도 행이 아니다 (GFM)', () => {
    const t = [
      '## 완료조건 판정',
      '| 조건 | 판정 | 근거 |',
      '|-|:-:|--|',
      '| A | 통과 | 됨 |',
    ].join('\n')
    expect(verdicts(t).map((v) => v.criterion)).toEqual(['A'])
  })

  it('절이나 표가 없으면 빈 목록이다', () => {
    expect(verdicts('## 남은 위험\n- 없음\n')).toEqual([])
    expect(verdicts('## 완료조건 판정\n표 대신 글\n')).toEqual([])
  })
})

describe('Work 완료 화면의 다시 볼 결정 (시나리오 7-3, D362, I106)', () => {
  const verification = (revisit: string) =>
    [
      '## 완료조건 판정',
      '| 완료조건 | 판정 | 근거 |',
      '|---|---|---|',
      '| 가중치 모양을 정한다 | 통과 | 결정 1 |',
      '',
      '## 문서 밖 파일 변경',
      '- 없음',
      '',
      '## 다시 볼 결정',
      revisit,
      '',
      '## 남은 위험',
      '- 없음',
      '',
    ].join('\n')

  it('설계 Work면 verification.md의 다시 볼 결정 본문이다', () => {
    const text = '- 결정 2: 오류를 내는 대안 — 입력 실수를 놓친다\n- 결정 3: 이름'
    expect(revisitDecisions('spec', verification(text))).toBe(text)
    // 남은 템플릿 안내 줄은 빼고 보인다
    expect(revisitDecisions('spec', verification(`${text}\n(없으면 "없음")`))).toBe(text)
    // "없음"으로 시작하는 낱말이 아닌 줄은 결정이다
    expect(revisitDecisions('spec', verification('- 없음표시 규칙: 다시 볼 만함'))).toBe(
      '- 없음표시 규칙: 다시 볼 만함',
    )
  })

  it('"없음"이거나 절이 없거나 비었으면 null이다. "없음" 뒤의 설명과 남은 템플릿 안내 줄은 가리지 않는다 (PR #36 리뷰)', () => {
    for (const none of [
      '없음',
      '- 없음',
      '"없음"',
      '(없음)',
      '없음.',
      '- 없음 (모든 결정에 근거 있음)',
      '없음 — 대안을 찾지 못함',
      '- 없음\n(없으면 "없음")',
      '(없으면 "없음")',
    ]) {
      expect(revisitDecisions('spec', verification(none)), none).toBeNull()
    }
    expect(revisitDecisions('spec', verification(''))).toBeNull()
    expect(revisitDecisions('spec', '## 남은 위험\n- 없음\n')).toBeNull()
  })

  it('설계 Work가 아니면 절이 있어도 null이다', () => {
    for (const type of ['bugfix', 'feature', 'refactor', 'general'] as const) {
      expect(revisitDecisions(type, verification('- 결정 2'))).toBeNull()
    }
  })
})
