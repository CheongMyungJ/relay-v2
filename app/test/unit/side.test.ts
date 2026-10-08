import { describe, expect, it } from 'vitest'
import { createWork } from '../../src/core/machine'
import { sideBlock, sideGuide } from '../../src/core/side'
import type { TaskRecord, WorkState } from '../../src/shared/work'

function task(id: string, seq: number, node: TaskRecord['node'], status: TaskRecord['status']) {
  const t: TaskRecord = {
    id,
    seq,
    node,
    status,
    reason: 'default',
    format_version: 1,
    created_at: 'x',
    session: null,
    bounce_count: 0,
    check: null,
  }
  return t
}

function work(tasks: TaskRecord[], extra: Partial<WorkState> = {}): WorkState {
  const w = createWork({
    type: 'bugfix',
    workId: 'w-20261008-001',
    baseBranch: 'main',
    baseCommit: 'base0001',
    at: '2026-10-08T10:00:00+09:00',
  }).work
  return { ...w, tasks, ...extra }
}

const guide = (w: WorkState) =>
  sideGuide({
    work: w,
    title: '할인 계산이 틀림',
    worktree: '/r/worktrees/w-20261008-001',
    workDir: '/r/works/w-20261008-001',
    signature: '_relay가 쓴 답글입니다_',
  })

describe('곁 세션의 안내 (D387)', () => {
  const tasks = [
    task('t-01', 1, 'intake', 'approved'),
    task('t-02', 2, 'fix', 'discarded'),
    task('t-03', 3, 'fix', 'awaiting_approval'),
  ]
  const text = guide(work(tasks))

  it('지도: Work, 위치, 지금 단계, task마다 상태와 디렉터리', () => {
    expect(text).toContain('- 제목: 할인 계산이 틀림')
    expect(text).toContain('- 유형: 버그 수정')
    expect(text).toContain('- 상태(열 때): 진행 중, 지금 단계 03 원인 분석과 수정 (승인 대기)')
    expect(text).toContain('- 기준 브랜치와 커밋: main base0001')
    expect(text).toContain('- Work 브랜치: relay/w-20261008-001')
    expect(text).toContain('- worktree(지금 폴더): /r/worktrees/w-20261008-001')
    expect(text).toContain('- Work 디렉터리: /r/works/w-20261008-001')
    expect(text).toContain('- t-01 01 의도 정리: 승인됨, tasks/01-intake/\n')
  })

  it('폐기된 task는 버린 시도로, 승인 전 task의 결정은 확정되지 않은 것으로 표시한다', () => {
    expect(text).toContain(
      '- t-02 02 원인 분석과 수정: 폐기됨, tasks/02-fix/ — 폐기됨: 버린 시도다. 산출물과 결정을 사실로 받지 않는다',
    )
    expect(text).toContain(
      '- t-03 03 원인 분석과 수정: 승인 대기, tasks/03-fix/ — 승인 전: handoff의 결정은 아직 확정되지 않았다',
    )
  })

  it('바꾸는 규칙: 묻고 나서만, 작업 중이면 제안만, 앱 소유 파일은 버튼으로, 표시 문구', () => {
    expect(text).toContain('하기 전에 사람에게 무엇을 할지')
    expect(text).toContain('예외는 없다')
    expect(text).toContain(
      'task가 작업 중이면(작업 중, 질문 대기, 입력 필요) 코드는 바꾸지 않고 제안만 한다',
    )
    expect(text).not.toContain('열 때 작업 중인 task가 있었다')
    expect(text).toContain('[단계 선택]의 추가 지시')
    expect(text).toContain('이 표시를 붙인다: _relay가 쓴 답글입니다_')
    expect(guide(work([task('t-01', 1, 'intake', 'working')]))).toContain(
      '열 때 작업 중인 task가 있었다',
    )
  })

  it('역할: 질문과 안내의 곳이고, 코드 수정은 먼저 단계 흐름을 권한다 (D392)', () => {
    expect(text).toContain('## 이 세션의 역할')
    expect(text).toContain('단계 흐름을 대신하지 않는다')
    expect(text).toContain('먼저 단계 흐름을 권한다')
    // 사람이 터미널에서 대화하므로 앱 질문창이 없다 (I130)
    expect(text).toContain('물을 것은 여기서 묻고 턴을 끝내 답을 기다린다(앱 질문창은 없다)')
  })

  it('task가 없으면 그렇게 적는다', () => {
    const empty = guide(work([]))
    expect(empty).toContain('- 상태(열 때): 진행 중\n')
    expect(empty).toContain('## task (열 때)\n\n- (아직 없음)')
  })
})

describe('곁 세션을 열 수 있는지 (D385)', () => {
  it('보관된 Work만 막는다', () => {
    expect(sideBlock({ status: 'archived' })).toMatch(/보관된 Work/)
    for (const status of ['active', 'stopped', 'pr', 'completed', 'abandoned'] as const) {
      expect(sideBlock({ status })).toBeNull()
    }
  })
})
