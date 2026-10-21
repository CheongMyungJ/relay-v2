// [단위] 재시작과 복구의 규칙 (core/recovery, 시나리오 9, D76, D121~D126)
import { describe, expect, it } from 'vitest'
import { createWork } from '../../src/core/machine'
import {
  changedCopyName,
  changedFileLine,
  changedFiles,
  cleanResume,
  cutOperation,
  filesNotice,
  knownBackups,
  lostCommit,
  lostStashes,
  operationView,
  orphanNotice,
  recordedProcesses,
  workJsonNotice,
} from '../../src/core/recovery'
import type {
  CleanOperation,
  DeliverOperation,
  RewindOperation,
  TaskRecord,
  WorkState,
} from '../../src/shared/work'

const WORK_ID = 'w-20260927-001'
const BACKUP = `relay/${WORK_ID}-discarded-1`

function work(extra: Partial<WorkState> = {}): WorkState {
  const w = createWork({
    type: 'bugfix',
    workId: WORK_ID,
    baseBranch: 'main',
    baseCommit: 'base0001',
    at: '2026-09-27T10:00:00+09:00',
  }).work
  return { ...w, ...extra }
}

function task(id: string, seq: number, node: TaskRecord['node'], pid?: number, started?: string) {
  const t: TaskRecord = {
    id,
    seq,
    node,
    status: 'approved',
    reason: 'default',
    format_version: 1,
    created_at: 'x',
    session: pid
      ? {
          id: `s-${id}`,
          pid,
          ...(started ? { process_started_at: started } : {}),
          started_at: 'x',
          alive: false,
        }
      : null,
    bounce_count: 0,
    check: null,
  }
  return t
}

const REWIND: RewindOperation = {
  kind: 'rewind',
  stage: 'backup',
  started_at: '2026-09-27T10:05:00+09:00',
  node: 'fix',
  from_task: 't-03',
  instruction: null,
  discard: ['t-02', 't-03'],
  reset_to: 'base0001aaaa',
  backup_branch: BACKUP,
  backup_commit: null,
}

const DELIVER: DeliverOperation = {
  kind: 'deliver',
  stage: 'prepare',
  started_at: 'x',
  choice: 'pr',
  task_id: 't-03',
  uncommitted: 'discard',
  branch: `relay/${WORK_ID}`,
  base: 'main',
}

const CLEAN: CleanOperation = {
  kind: 'clean',
  stage: 'branches',
  started_at: 'x',
  force: true,
  delete_branches: [BACKUP],
  head: 'head0001',
}

describe('[단위] 끊긴 작업의 알림 (D121, D123)', () => {
  it('끊긴 표시가 있는 기록만 끊긴 작업이다', () => {
    expect(cutOperation(work())).toBeUndefined()
    expect(cutOperation(work({ operation: REWIND }))).toBeUndefined()
    const cut = { ...REWIND, interrupted_at: 'y' }
    expect(cutOperation(work({ operation: cut }))).toBe(cut)
    expect(operationView(work({ operation: REWIND }))).toBeNull()
  })

  it('D418 전 되감기: [intake 다시]의 유형 변경이 끊기면 바꿀 유형과, [무시]하면 유형이 그대로라는 것을 보인다 (D237, D424)', () => {
    const tasks = [task('t-01', 1, 'intake')]
    const op = { ...REWIND, node: 'intake' as const, type: 'feature' as const, interrupted_at: 'y' }
    const view = operationView(work({ tasks, operation: op }))
    expect(view?.lines.slice(0, 2)).toEqual([
      '고른 단계: 의도 정리(intake)',
      '바꿀 유형: 기능 추가 (D237)',
    ])
    // 되감기는 없어 이어서 하지 않는다: [다시 시도]가 없다 (D424)
    expect(view?.retry).toBeNull()
    expect(view?.ignore).toBe(
      '[무시]: 기록만 지웁니다. 코드와 백업 브랜치는 지금 그대로이고, task는 폐기하지 않습니다. 유형도 버그 수정(으)로 남고 바뀌지 않습니다.',
    )
  })

  it('D418 전 되감기: 고른 단계, 끊긴 단계, 백업, 되돌릴 커밋, 폐기할 task를 보이고 [무시]만 받는다 (D424)', () => {
    const tasks = [task('t-01', 1, 'intake'), task('t-02', 2, 'fix'), task('t-03', 3, 'verify')]
    const backup = operationView(work({ tasks, operation: { ...REWIND, interrupted_at: 'y' } }))
    expect(backup).toEqual({
      kind: 'rewind',
      title: '되감기가 끊겼습니다',
      lines: [
        '고른 단계: 원인 분석과 수정(fix)',
        '끊긴 곳: 백업 브랜치를 만드는 단계',
        `만들려던 백업 브랜치: ${BACKUP}`,
        '코드는 아직 되돌리지 않았습니다.',
        '되돌릴 커밋: base0001',
        '폐기할 task: 02 원인 분석과 수정, 03 리뷰와 검증',
        '지금 앱에는 되감기가 없어 이어서 하지 않습니다 (D418). 코드를 확인하고 [무시]를 누르세요.',
      ],
      retry: null,
      ignore:
        '[무시]: 기록만 지웁니다. 코드와 백업 브랜치는 지금 그대로이고, task는 폐기하지 않습니다.',
      choice: null,
    })
    const reset = operationView(
      work({
        tasks,
        operation: {
          ...REWIND,
          stage: 'reset',
          backup_commit: 'backupc1ffff',
          head: 'h',
          interrupted_at: 'y',
        },
      }),
    )
    expect(reset?.lines.slice(1, 4)).toEqual([
      '끊긴 곳: 코드를 되돌리는 단계',
      `백업 브랜치: ${BACKUP} (backupc1)`,
      '코드는 되돌렸을 수도 있습니다.',
    ])
    const nothing = operationView(
      work({
        tasks,
        operation: { ...REWIND, stage: 'reset', backup_branch: null, interrupted_at: 'y' },
      }),
    )
    expect(nothing?.lines[2]).toBe('백업할 코드가 없었습니다.')
  })

  it('전달: 고른 전달, 끊긴 단계, 앱이 만든 stash와 커밋. 선택지를 보일 이름을 준다', () => {
    const v = operationView(work({ operation: { ...DELIVER, interrupted_at: 'y' } }))
    expect(v).toMatchObject({
      kind: 'deliver',
      title: '전달이 끊겼습니다',
      lines: [
        '전달: [PR 생성]',
        '끊긴 곳: 커밋 안 된 변경 처리',
        `브랜치: relay/${WORK_ID}`,
        '커밋 안 된 변경을 처리하다 만든 stash나 커밋은 [다시 시도]나 [무시]할 때 찾아 결과에 남깁니다.',
      ],
      choice: 'pr',
    })
    expect(v?.retry).toContain('끊긴 시도를 실패로 남기고 [PR 생성]을(를) 처음부터 다시 합니다')
    expect(v?.ignore).toContain('끊긴 시도를 실패로 남깁니다')
    const pushed = operationView(
      work({
        operation: { ...DELIVER, stage: 'pr', stash: 'stash001aaaa', interrupted_at: 'y' },
      }),
    )
    expect(pushed?.lines).toEqual([
      '전달: [PR 생성]',
      '끊긴 곳: PR 만들기',
      `브랜치: relay/${WORK_ID}`,
      '앱이 만든 stash: stash001',
    ])
  })

  it('정리: 끊긴 단계, 지울 브랜치, --force', () => {
    const v = operationView(work({ operation: { ...CLEAN, interrupted_at: 'y' } }))
    expect(v).toMatchObject({
      kind: 'clean',
      title: 'Work 정리가 끊겼습니다',
      lines: [
        '끊긴 곳: 브랜치를 지우는 단계(worktree는 지웠음)',
        `지울 브랜치: ${BACKUP}`,
        '커밋 안 된 변경이나 잠금 파일을 확인하고 --force로 지우던 중이었습니다.',
      ],
      choice: null,
    })
    expect(v?.ignore).toBe('[무시]: 기록만 지웁니다. [Work 정리]를 다시 할 수 있습니다.')
    // [다시 시도]는 끊긴 뒤의 변경을 다시 확인하지 않는다 (D139)
    expect(v?.retry).toContain(
      '끊긴 뒤 worktree를 고치거나 커밋했으면 그것도 지우므로 [무시]를 누른 뒤 [Work 정리]로 다시 확인하세요.',
    )
  })
})

describe('[단위] 끊긴 머지의 알림 (D77, D123, M9)', () => {
  it('머지: 방식과 머지할 head, [다시 시도]는 다시 읽어 머지됐으면 완료하고 아니면 같은 head로 머지한다', () => {
    const v = operationView(
      work({
        status: 'pr',
        operation: {
          kind: 'merge',
          started_at: 'x',
          method: 'squash',
          head: 'abcdef0123456789',
          interrupted_at: 'y',
        },
      }),
    )
    expect(v).toMatchObject({
      kind: 'merge',
      title: '머지가 끊겼습니다',
      lines: ['방식: squash', '머지할 head: abcdef01'],
      choice: null,
    })
    expect(v?.retry).toContain('이미 머지됐으면 완료(머지됨)합니다')
    expect(v?.ignore).toContain('PR 진행으로 남고')
  })
})

describe('[단위] 끊긴 전달과 정리 (D123)', () => {
  it('끊긴 전달이 만들었지만 기록하지 못한 stash와 커밋을 메시지로 찾는다', () => {
    const msg = `relay(${WORK_ID}): 완료 전 버린 변경`
    const entries = [
      { commit: 's3', subject: 'On main: 다른 것' },
      { commit: 's2', subject: `On relay/${WORK_ID}: ${msg}` },
      { commit: 's1', subject: `On relay/${WORK_ID}: ${msg}` },
      {
        commit: 's0',
        subject: `On relay/w-20260927-002: relay(w-20260927-002): 완료 전 버린 변경`,
      },
    ]
    expect(lostStashes(WORK_ID, entries, ['s1'])).toEqual(['s2'])
    const commit = `relay(${WORK_ID}): 완료 전 남은 변경`
    expect(lostCommit(WORK_ID, { id: 'c1', subject: commit }, [])).toBe('c1')
    expect(lostCommit(WORK_ID, { id: 'c1', subject: commit }, ['c1'])).toBeNull()
    expect(lostCommit(WORK_ID, { id: 'c1', subject: 'fix: 고침' }, [])).toBeNull()
    const w = work({
      delivery: { choice: 'push', status: 'failed', at: 'x', stashes: ['s0'], commits: ['c0'] },
    })
    expect(knownBackups(w, { ...DELIVER, stash: 's1', commit: 'c1' })).toEqual({
      stashes: ['s0', 's1'],
      commits: ['c0', 'c1'],
    })
  })

  it('끊긴 정리의 worktree 단계는 기록이 --force였거나 지우다 만 추적 파일뿐일 때만 --force를 준다', () => {
    expect(cleanResume(true, ['?? a'])).toEqual({ ok: true, force: true })
    expect(cleanResume(false, [])).toEqual({ ok: true, force: false })
    expect(cleanResume(false, [' D src/a.js', 'D  b.txt', 'DD c'])).toEqual({
      ok: true,
      force: true,
    })
    const r = cleanResume(false, [' D src/a.js', ' M b.txt'])
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toBe(
      'worktree에 지우다 만 것 말고 다른 변경이 있어 정리를 멈춤. [무시]를 누른 뒤 [Work 정리]로 다시 확인하세요',
    )
    expect(cleanResume(false, ['?? scratch.txt']).ok).toBe(false)
  })
})

describe('[단위] 고아 프로세스 (D76, D126)', () => {
  it('시작 시각을 적은 task 세션과 살아 있던 정리 세션을 확인한다', () => {
    const w = work({
      tasks: [
        task('t-01', 1, 'intake', 101, '2026-09-27T10:00:00.1+09:00'),
        task('t-02', 2, 'fix', 102),
        task('t-03', 3, 'verify'),
      ],
      cleanup_process: {
        pid: 200,
        process_started_at: '2026-09-27T11:00:00+09:00',
        started_at: 'x',
      },
    })
    expect(recordedProcesses(w)).toEqual([
      { taskId: 't-01', label: '01 의도 정리', pid: 101, startedAt: '2026-09-27T10:00:00.1+09:00' },
      { taskId: null, label: '정리 세션', pid: 200, startedAt: '2026-09-27T11:00:00+09:00' },
    ])
    expect(recordedProcesses(work({ cleanup_process: { pid: 1, started_at: 'x' } }))).toEqual([])
    expect(orphanNotice(recordedProcesses(w))).toMatchObject({
      kind: 'orphans',
      title: '앱을 다시 켜며 남아 있던 프로세스를 끝냈습니다',
      lines: ['01 의도 정리의 claude (PID 101)', '정리 세션의 claude (PID 200)'],
    })
  })
  it('살아 있던 곁 세션의 프로세스도 확인한다. 대화만 있으면 없다 (D389)', () => {
    const side = { pid: 300, process_started_at: '2026-09-27T12:00:00+09:00', started_at: 'x' }
    expect(recordedProcesses(work({ side: { session_id: 's-1', process: side } }))).toEqual([
      { taskId: null, label: '곁 세션', pid: 300, startedAt: '2026-09-27T12:00:00+09:00' },
    ])
    expect(recordedProcesses(work({ side: { session_id: 's-1' } }))).toEqual([])
  })
  it('기본 세션의 기록도 받는다. 대화만 있거나 시작 시각이 없으면 없다 (D402)', () => {
    const session = { id: 's-20261017-001', cwd: '/h', created_at: 'x', session_id: 'c-1' }
    const process = { pid: 400, process_started_at: '2026-10-17T12:00:00+09:00', started_at: 'x' }
    expect(recordedProcesses({ ...session, process })).toEqual([
      { taskId: null, label: '기본 세션', pid: 400, startedAt: '2026-10-17T12:00:00+09:00' },
    ])
    expect(recordedProcesses(session)).toEqual([])
    expect(recordedProcesses({ ...session, process: { pid: 1, started_at: 'x' } })).toEqual([])
  })
})

describe('[단위] 앱 소유 파일의 해시 (D124)', () => {
  it('적힌 해시와 지금 해시가 다른 파일: 바뀜, 없어짐, 앱이 쓰지 않았는데 생김', () => {
    const recorded = { 'request.md': 'r1', 'decisions.md': 'd1' }
    expect(
      changedFiles(recorded, { 'request.md': 'r1', 'intent.md': null, 'decisions.md': 'd1' }),
    ).toEqual([])
    expect(
      changedFiles(recorded, { 'request.md': 'r2', 'intent.md': 'i1', 'decisions.md': null }),
    ).toEqual(['request.md', 'intent.md', 'decisions.md'])
    // 읽은 파일만 본다
    expect(changedFiles(recorded, { 'decisions.md': 'd2' })).toEqual(['decisions.md'])
    const at = '2026-09-27T10:05:30+09:00'
    expect(changedFileLine('decisions.md', 'd1', 'd2', at, '/w/decisions.md')).toBe(
      'decisions.md: 내용이 바뀜 (2026-09-27 10:05에 확인) — /w/decisions.md',
    )
    expect(changedFileLine('intent.md', null, 'i1', at, '/w/intent.md')).toContain(
      '앱이 쓰지 않았는데 생김',
    )
    expect(changedFileLine('request.md', 'r1', null, at, '/w/request.md')).toContain('없어짐')
    expect(filesNotice(['a'])).toMatchObject({ kind: 'files', lines: ['a'] })
  })

  it('바뀐 work.json을 남길 이름은 현지 시각이다', () => {
    expect(changedCopyName('2026-09-27T10:05:30+09:00')).toBe('work.json.changed-20260927T100530')
    expect(
      workJsonNotice([
        { at: '2026-09-27T10:05:30+09:00', copy: '/w/work.json.changed-20260927T100530' },
        { at: '2026-09-27T10:07:00+09:00', copy: null },
      ]),
    ).toMatchObject({
      kind: 'work_json',
      lines: [
        '2026-09-27 10:05: 바뀐 내용 — /w/work.json.changed-20260927T100530',
        '2026-09-27 10:07: work.json이 없어져 있었음',
      ],
    })
  })
})
