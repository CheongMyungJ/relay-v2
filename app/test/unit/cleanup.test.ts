import { describe, expect, it } from 'vitest'
import {
  canClean,
  canDelete,
  cleanPreview,
  planClean,
  projectRemoveBlock,
  type CleanFacts,
} from '../../src/core/cleanup'
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
    submodules: [],
    live: 0,
    branch: { name: BRANCH, exists: true, pushed: false, merged: false, lost: null },
    backups: [],
    merged: false,
    remote: null,
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
    const work = createWork({
      type: 'bugfix',
      workId: 'w',
      baseBranch: 'main',
      baseCommit: 'c',
      at: 'x',
    }).work
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

describe('기록 지우기와 프로젝트 등록 해제 (D407, D408)', () => {
  const base = createWork({
    type: 'bugfix',
    workId: 'w-20261017-001',
    baseBranch: 'main',
    baseCommit: 'c',
    at: 'x',
  }).work
  const at = (status: WorkState['status'], patch: Partial<WorkState> = {}): WorkState => ({
    ...base,
    status,
    ...patch,
  })
  const cut: Partial<WorkState> = {
    operation: {
      kind: 'clean',
      stage: 'worktree',
      started_at: 'x',
      force: false,
      delete_branches: [],
      head: null,
    },
  }

  it('보관됐거나 정리할 수 있는 Work만 지운다. 끊긴 작업이 있으면 지우지 않는다', () => {
    for (const s of ['completed', 'abandoned', 'archived'] as const)
      expect(canDelete(at(s))).toBe(true)
    for (const s of ['active', 'stopped', 'pr'] as const) expect(canDelete(at(s))).toBe(false)
    expect(canDelete(at('archived', { shelved_at: 'x' }))).toBe(true)
    expect(canDelete(at('completed', cut))).toBe(false)
    expect(canDelete(at('archived', cut))).toBe(false)
  })

  const clear = { unread: [], worktrees: [], worktreesDir: '/h/projects/p-1/worktrees' }

  it('등록 해제는 Work가 모두 보관됐거나 없을 때만 받고, 막으면 보관되지 않은 Work를 적는다', () => {
    expect(projectRemoveBlock([], clear)).toBeNull()
    expect(
      projectRemoveBlock([at('archived'), at('archived', { shelved_at: 'x' })], clear),
    ).toBeNull()
    const blocked = projectRemoveBlock(
      [
        at('archived'),
        at('completed', { work_id: 'w-20261017-002' }),
        at('active', { work_id: 'w-20261017-003' }),
      ],
      clear,
    )
    expect(blocked).toContain('보관되지 않은 Work 2개')
    expect(blocked).toContain('w-20261017-002, w-20261017-003')
    expect(projectRemoveBlock([at('archived', cut)], clear)).toContain('1개')
  })

  it('앱이 읽지 못한 Work 기록이나 남은 worktree 폴더가 있으면 지우지 않고 사람에게 맡긴다 (D409)', () => {
    const unread = projectRemoveBlock([at('archived')], { ...clear, unread: ['w-20261017-009'] })
    expect(unread).toContain('읽지 못한 Work 기록이 있음 (w-20261017-009)')
    const trees = projectRemoveBlock([], { ...clear, worktrees: ['w-20261017-004'] })
    expect(trees).toBe(
      'worktree 폴더가 남아 있음: w-20261017-004 (/h/projects/p-1/worktrees). 폴더를 확인하고 직접 지운 뒤 다시 누르세요',
    )
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
      lost: [],
    })
    expect(planClean(p, input(p))).toEqual({
      ok: true,
      force: false,
      deleteBranches: [],
      deleteRemote: null,
    })
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
      deleteRemote: null,
    })
    const live = cleanPreview(facts({ live: 2 }))
    expect(planClean(live, input(live, { confirmed: true }))).toMatchObject({ force: false })
  })

  it('체크아웃된 서브모듈은 그 안의 작업도 지움을 확인해야 하고, 변경이 없어도 --force로 지운다 (D382)', () => {
    const p = cleanPreview(facts({ submodules: ['lib', 'vendor/ui'] }))
    expect(p.submodules).toEqual(['lib', 'vendor/ui'])
    expect(p.confirm).toEqual([
      '체크아웃된 서브모듈 2개(lib, vendor/ui) 안의 커밋 안 된 변경과 push 안 한 커밋도 함께 지웁니다',
    ])
    expect(planClean(p, input(p)).ok).toBe(false)
    expect(planClean(p, input(p, { confirmed: true }))).toMatchObject({ ok: true, force: true })
    // 확인한 뒤 서브모듈을 체크아웃했으면 받지 않는다
    const none = cleanPreview(facts())
    expect(planClean(p, input(none, { confirmed: true }))).toMatchObject({ ok: false })
  })

  it('작업 브랜치는 push됐거나 머지됐을 때만 삭제를 제안한다 (8-2)', () => {
    for (const [pushed, merged, deletable] of [
      [true, false, true],
      [false, true, true],
      [true, true, true],
      [false, false, false],
    ] as const) {
      const p = cleanPreview(
        facts({ branch: { name: BRANCH, exists: true, pushed, merged, lost: null } }),
      )
      expect(p.branch.deletable).toBe(deletable)
      const r = planClean(p, input(p, { deleteBranch: true }))
      expect(r).toEqual(
        deletable
          ? { ok: true, force: false, deleteBranches: [BRANCH], deleteRemote: null }
          : { ok: false, error: '작업 브랜치는 push됐거나 머지됐을 때만 지움' },
      )
    }
    const gone = cleanPreview(
      facts({ branch: { name: BRANCH, exists: false, pushed: false, merged: false, lost: null } }),
    )
    expect(gone.branch.deletable).toBe(false)
  })

  it('PR을 머지한 Work의 작업 브랜치는 머지한 PR에 없는 커밋이 없으면 지울 수 있다 (squash 머지 뒤, D329)', () => {
    const branch = { name: BRANCH, exists: true, pushed: false, merged: false }
    const p = cleanPreview(facts({ merged: true, branch: { ...branch, lost: [] } }))
    expect(p.branch).toMatchObject({ deletable: true, lost: [] })
    expect(planClean(p, input(p, { deleteBranch: true }))).toMatchObject({
      ok: true,
      deleteBranches: [BRANCH],
    })
    // 머지한 PR의 커밋을 로컬에서 찾지 못하면 잃을 것을 셀 수 없어 지우지 않는다
    expect(
      cleanPreview(facts({ merged: true, branch: { ...branch, lost: null } })).branch.deletable,
    ).toBe(false)
  })

  it('머지한 PR에 없는 커밋이 있으면 그 커밋을 보이고, 잃는 것을 확인해야 지운다 (D329)', () => {
    const lost = [{ sha: 'c'.repeat(40), subject: 'PR 대응: 미룬 push' }]
    const p = cleanPreview(
      facts({
        merged: true,
        branch: { name: BRANCH, exists: true, pushed: false, merged: false, lost },
      }),
    )
    expect(p.branch).toMatchObject({ deletable: true, lost })
    expect(p.expect.lost).toEqual([lost[0]?.sha])
    expect(planClean(p, input(p, { deleteBranch: true }))).toEqual({
      ok: false,
      error: '작업 브랜치에만 있는 커밋 1개를 잃습니다. 확인이 필요함',
    })
    expect(planClean(p, input(p, { deleteBranch: true, confirmLost: true }))).toMatchObject({
      ok: true,
      deleteBranches: [BRANCH],
    })
    // 지우지 않으면 확인하지 않아도 된다
    expect(planClean(p, input(p))).toMatchObject({ ok: true, deleteBranches: [] })
  })

  it('되감기 백업 브랜치는 "함께 삭제"를 고르면 지운다 (8-2)', () => {
    const p = cleanPreview(
      facts({
        backups: [BACKUP],
        branch: { name: BRANCH, exists: true, pushed: true, merged: false, lost: null },
      }),
    )
    expect(planClean(p, input(p))).toEqual({
      ok: true,
      force: false,
      deleteBranches: [BACKUP],
      deleteRemote: null,
    })
    expect(planClean(p, input(p, { deleteBackups: false }))).toEqual({
      ok: true,
      force: false,
      deleteBranches: [],
      deleteRemote: null,
    })
    expect(planClean(p, input(p, { deleteBranch: true }))).toEqual({
      ok: true,
      force: false,
      deleteBranches: [BRANCH, BACKUP],
      deleteRemote: null,
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

describe('머지로 완료한 Work의 정리 (D178)', () => {
  const merged = facts({
    branch: { name: BRANCH, exists: true, pushed: true, merged: false, lost: null },
    merged: true,
    remote: { name: BRANCH, exists: true },
  })

  it('origin의 작업 브랜치 삭제를 고를 수 있다. 확인한 뒤 원격 브랜치가 없어졌으면 받지 않는다', () => {
    const preview = cleanPreview(merged)
    expect(preview).toMatchObject({ merged: true, remote: { name: BRANCH, exists: true } })
    expect(preview.expect.remote).toBe(true)
    expect(planClean(preview, input(preview, { deleteBranch: true, deleteRemote: true }))).toEqual({
      ok: true,
      force: false,
      deleteBranches: [BRANCH],
      deleteRemote: BRANCH,
    })
    expect(planClean(preview, input(preview, { deleteBranch: true }))).toMatchObject({
      deleteRemote: null,
    })
    const gone = cleanPreview({ ...merged, remote: { name: BRANCH, exists: false } })
    expect(planClean(gone, input(preview, { deleteRemote: true }))).toMatchObject({ ok: false })
    expect(planClean(gone, input(gone, { deleteRemote: true }))).toEqual({
      ok: false,
      error: 'origin의 브랜치는 머지로 완료한 Work에서 원격에 있을 때만 지움',
    })
  })

  it('머지하지 않은 Work는 원격 브랜치를 지우지 않는다', () => {
    const preview = cleanPreview(
      facts({ branch: { name: BRANCH, exists: true, pushed: true, merged: false, lost: null } }),
    )
    expect(preview).toMatchObject({ merged: false, remote: null })
    expect(planClean(preview, input(preview, { deleteRemote: true }))).toMatchObject({ ok: false })
  })
})
