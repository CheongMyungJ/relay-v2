// Work 정리 (시나리오 8, D16): [Work 정리]를 누르기 전의 확인 요약과 기본 선택, 정리할 수 있는 Work,
// 사람이 고른 것으로 지울 브랜치와 --force를 정한다. git에서 읽는 사실(커밋 안 된 변경, 잠금 파일,
// 작업 브랜치가 원격이나 기준 브랜치에 있는지, 되감기 백업 브랜치)과 살아 있는 세션은 main이 넘긴다.
import type { CleanExpect, CleanInput, CleanPreview } from '../shared/views'
import type { WorkState } from '../shared/work'
import { sameChanges } from './delivery'

/** 정리할 수 있는 Work: 완료나 포기한 Work다 (시나리오 8). 진행 중인 여러 단계 작업(D77)이 있으면 기다린다 */
export function canClean(work: WorkState): boolean {
  return (work.status === 'completed' || work.status === 'abandoned') && !work.operation
}

/** 정리 요약에 쓰는 사실. main이 git과 세션에서 읽는다 */
/**
 * 반쯤 지운 worktree 폴더의 안내 (D140). git worktree remove가 파일을 지우다 실패해도 git은 관리 정보를 지워, 남은
 * 폴더에서는 git status도 git worktree remove도 실패한다. 사람이 폴더를 지우면 다음 정리가 prune만 한다
 */
export function halfRemovedHint(dir: string): string {
  return `반쯤 지운 worktree 폴더가 남아 있음: ${dir} (git은 이 폴더를 더 이상 worktree로 보지 않음). 폴더를 직접 지운 뒤 다시 누르세요`
}

export interface CleanFacts {
  /** worktree가 있다 */
  worktree: boolean
  /** 커밋 안 된 변경 (git status) */
  uncommitted: readonly string[]
  /** worktree의 git 폴더에 남은 잠금 파일 */
  locks: readonly string[]
  /** 이 앱에서 살아 있는 세션 */
  live: number
  /** 작업 브랜치(relay/<work-id>)와, 그 커밋이 origin의 같은 이름 브랜치나 기준 브랜치에 있는지 */
  branch: { name: string; exists: boolean; pushed: boolean; merged: boolean }
  /** 이 Work의 되감기 백업 브랜치 (D115) */
  backups: readonly string[]
  /** 머지로 완료한 Work다 (D178) */
  merged: boolean
  /** origin의 작업 브랜치와 있는지. 머지로 완료한 Work만 본다 (D178). 아니면 null */
  remote: { name: string; exists: boolean } | null
}

/**
 * 확인 요약 (시나리오 8-1). 커밋 안 된 변경은 백업 없이 지워짐을, 살아 있는 세션은 강제 종료함을,
 * git 잠금 파일은 worktree와 함께 지움을 사람이 명시적으로 확인해야 한다. 작업 브랜치는 기본으로 두고
 * push됐거나 머지됐을 때만 삭제를 제안한다. 머지로 완료한 Work는 작업 브랜치 삭제가 기본으로 체크되고 origin의
 * 브랜치 삭제도 고를 수 있다(D178, 기본은 끔). 되감기 백업 브랜치의 "함께 삭제"는 기본으로 체크한다(화면).
 */
export function cleanPreview(facts: CleanFacts): CleanPreview {
  const confirm: string[] = []
  const n = facts.uncommitted.length
  if (n > 0) confirm.push(`커밋 안 된 변경 ${n}개를 백업 없이 지웁니다`)
  if (facts.live > 0) confirm.push(`살아 있는 세션 ${facts.live}개를 강제 종료합니다`)
  if (facts.locks.length > 0) {
    confirm.push(`git 잠금 파일 ${facts.locks.length}개가 남아 있습니다. worktree와 함께 지웁니다`)
  }
  const b = facts.branch
  return {
    worktree: facts.worktree,
    uncommitted: [...facts.uncommitted],
    locks: [...facts.locks],
    live: facts.live,
    branch: { ...b, deletable: b.exists && (b.pushed || b.merged) },
    backups: [...facts.backups],
    merged: facts.merged,
    remote: facts.remote ? { ...facts.remote } : null,
    confirm,
    expect: {
      uncommitted: [...facts.uncommitted],
      locks: [...facts.locks],
      live: facts.live,
      backups: [...facts.backups],
      remote: facts.remote?.exists === true,
    },
  }
}

function sameExpect(a: CleanExpect, b: CleanExpect): boolean {
  return (
    a.live === b.live &&
    a.remote === b.remote &&
    sameChanges(a.uncommitted, b.uncommitted) &&
    sameChanges(a.locks, b.locks) &&
    sameChanges(a.backups, b.backups)
  )
}

export type CleanPlan =
  | { ok: true; force: boolean; deleteBranches: string[]; deleteRemote: string | null }
  | { ok: false; error: string }

/**
 * [정리]를 누른 때 (시나리오 8-2). 확인한 뒤 사실이 바뀌었으면 받지 않는다. 확인이 필요한 것을 확인하지
 * 않았으면 받지 않는다. 커밋 안 된 변경이나 잠금 파일이 있으면 git worktree remove --force로 지운다.
 * 작업 브랜치는 삭제를 제안한 때(push됐거나 머지됨)만 지운다.
 */
export function planClean(preview: CleanPreview, input: CleanInput): CleanPlan {
  if (!sameExpect(preview.expect, input.expect)) {
    return { ok: false, error: '확인한 뒤 Work가 바뀌었음. [Work 정리]를 다시 여세요' }
  }
  if (preview.confirm.length > 0 && !input.confirmed) {
    return { ok: false, error: `확인이 필요함: ${preview.confirm.join(', ')}` }
  }
  if (input.deleteBranch && !preview.branch.deletable) {
    return { ok: false, error: '작업 브랜치는 push됐거나 머지됐을 때만 지움' }
  }
  if (input.deleteRemote && !preview.remote?.exists) {
    return { ok: false, error: 'origin의 브랜치는 머지로 완료한 Work에서 원격에 있을 때만 지움' }
  }
  return {
    ok: true,
    force: preview.uncommitted.length > 0 || preview.locks.length > 0,
    deleteBranches: [
      ...(input.deleteBranch ? [preview.branch.name] : []),
      ...(input.deleteBackups ? preview.backups : []),
    ],
    deleteRemote: input.deleteRemote && preview.remote ? preview.remote.name : null,
  }
}
