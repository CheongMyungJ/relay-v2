import { describe, expect, it } from 'vitest'
import { canClean, cleanPreview, planClean, type CleanFacts } from '../../src/core/cleanup'
import { createWork } from '../../src/core/machine'
import type { CleanInput } from '../../src/shared/views'
import type { WorkState } from '../../src/shared/work'

const BRANCH = 'relay/w-20260927-001'
const BACKUP = `${BRANCH}-discarded-1`

function facts(patch: Partial<CleanFacts> = {}): CleanFacts {
  return {
    worktree: true,
    uncommitted: [],
    locks: [],
    live: 0,
    branch: { name: BRANCH, exists: true, pushed: false, merged: false },
    backups: [],
    ...patch,
  }
}

function input(preview: ReturnType<typeof cleanPreview>, patch: Partial<CleanInput> = {}) {
  return {
    deleteBranch: false,
    deleteBackups: true,
    confirmed: false,
    expect: preview.expect,
    ...patch,
  }
}

describe('정리할 수 있는 Work (시나리오 8)', () => {
  it('완료나 포기한 Work만 정리한다. 진행 중 작업이 있으면 기다린다 (D77)', () => {
    const work = createWork({ workId: 'w', baseBranch: 'main', baseCommit: 'c', at: 'x' }).work
    const at = (status: WorkState['status'], patch: Partial<WorkState> = {}): WorkState => ({
      ...work,
      status,
      ...patch,
    })
    expect(canClean(at('completed'))).toBe(true)
    expect(canClean(at('abandoned'))).toBe(true)
    for (const s of ['active', 'stopped', 'archived'] as const) expect(canClean(at(s))).toBe(false)
    const busy = at('completed', {
      operation: {
        kind: 'clean',
        stage: 'worktree',
        started_at: 'x',
        force: false,
        delete_branches: [],
        head: null,
      },
    })
    expect(canClean(busy)).toBe(false)
  })
})

describe('정리 전 확인 요약 (8-1)', () => {
  it('확인할 것이 없으면 확인 없이 정리한다. 작업 브랜치는 기본으로 두고 삭제를 제안하지 않는다', () => {
    const p = cleanPreview(facts())
    expect(p.confirm).toEqual([])
    expect(p.branch).toEqual({
      name: BRANCH,
      exists: true,
      pushed: false,
      merged: false,
      deletable: false,
    })
    expect(planClean(p, input(p))).toEqual({ ok: true, force: false, deleteBranches: [] })
  })

  it('커밋 안 된 변경, 살아 있는 세션, 잠금 파일은 사람이 명시적으로 확인해야 한다', () => {
    const p = cleanPreview(
      facts({ uncommitted: [' M src/avg.js', '?? notes.txt'], live: 1, locks: ['index.lock'] }),
    )
    expect(p.confirm).toEqual([
      '커밋 안 된 변경 2개를 백업 없이 지웁니다',
      '살아 있는 세션 1개를 강제 종료합니다',
      'git 잠금 파일 1개가 남아 있습니다. worktree와 함께 지웁니다',
    ])
    expect(planClean(p, input(p))).toEqual({
      ok: false,
      error: `확인이 필요함: ${p.confirm.join(', ')}`,
    })
    // 커밋 안 된 변경이나 잠금 파일이 있으면 git worktree remove --force다
    expect(planClean(p, input(p, { confirmed: true }))).toEqual({
      ok: true,
      force: true,
      deleteBranches: [],
    })
    const live = cleanPreview(facts({ live: 2 }))
    expect(planClean(live, input(live, { confirmed: true }))).toMatchObject({ force: false })
  })

  it('작업 브랜치는 push됐거나 머지됐을 때만 삭제를 제안한다 (8-2)', () => {
    for (const [pushed, merged, deletable] of [
      [true, false, true],
      [false, true, true],
      [true, true, true],
      [false, false, false],
    ] as const) {
      const p = cleanPreview(facts({ branch: { name: BRANCH, exists: true, pushed, merged } }))
      expect(p.branch.deletable).toBe(deletable)
      const r = planClean(p, input(p, { deleteBranch: true }))
      expect(r).toEqual(
        deletable
          ? { ok: true, force: false, deleteBranches: [BRANCH] }
          : { ok: false, error: '작업 브랜치는 push됐거나 머지됐을 때만 지움' },
      )
    }
    const gone = cleanPreview(
      facts({ branch: { name: BRANCH, exists: false, pushed: false, merged: false } }),
    )
    expect(gone.branch.deletable).toBe(false)
  })

  it('되감기 백업 브랜치는 "함께 삭제"를 고르면 지운다 (8-2)', () => {
    const p = cleanPreview(
      facts({
        backups: [BACKUP],
        branch: { name: BRANCH, exists: true, pushed: true, merged: false },
      }),
    )
    expect(planClean(p, input(p))).toEqual({ ok: true, force: false, deleteBranches: [BACKUP] })
    expect(planClean(p, input(p, { deleteBackups: false }))).toEqual({
      ok: true,
      force: false,
      deleteBranches: [],
    })
    expect(planClean(p, input(p, { deleteBranch: true }))).toEqual({
      ok: true,
      force: false,
      deleteBranches: [BRANCH, BACKUP],
    })
  })

  it('확인한 뒤 사실이 바뀌었으면 받지 않는다', () => {
    const seen = cleanPreview(facts())
    const now = cleanPreview(facts({ uncommitted: ['?? new.txt'] }))
    expect(planClean(now, input(seen, { confirmed: true }))).toEqual({
      ok: false,
      error: '확인한 뒤 Work가 바뀌었음. [Work 정리]를 다시 여세요',
    })
    const more = cleanPreview(facts({ backups: [BACKUP] }))
    expect(planClean(more, input(seen)).ok).toBe(false)
  })
})
