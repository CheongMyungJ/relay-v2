// 단계 선택의 계산 (6.2, 6.3, D82, D115~D117): 고른 단계로 가면 무엇을 폐기하고, 어느 커밋으로 되돌리고,
// 어느 단계를 건너뛰는지. machine의 전이와 단계 선택 대화상자의 미리 보기가 같은 계산을 쓴다.
// 되돌릴 커밋 수, 커밋 안 된 변경, 산출물 파일, 이미 있는 백업 브랜치는 git과 파일이 알므로 main이 넘긴다.
import type { NodeName } from '../shared/contracts'
import type { DiscardView, StepChoice, StepExpect, StepKind, StepPreview } from '../shared/views'
import {
  WORK_TYPE_LABEL,
  type StartReason,
  type TaskRecord,
  type WorkState,
  type WorkType,
} from '../shared/work'
import {
  KEEP_CODE_NODES,
  NODE_INFO,
  PIPELINES,
  defaultNext,
  inPipeline,
  isPipelineNode,
  order,
  workType,
} from './pipeline'
import { REASON_LABEL, taskLabel } from './review'

export type { StepKind }

export interface StepPlan {
  node: NodeName
  /** 되감기(고른 단계가 지금 단계 k 이하) 또는 건너뛰기(k보다 뒤) (6.2) */
  kind: StepKind
  /** 지금 task(k) */
  from: TaskRecord
  /** k가 끝났다(승인하고 Work가 멈춤). 아니면 k 진행 중이다 (6.2의 표) */
  done: boolean
  /** 진행 중인 k를 끝낸다: 세션이 살아 있으면 session, 대기열에 있으면 queue */
  interrupt: 'session' | 'queue' | null
  /** 폐기할 task. 순번 차례다 */
  discard: TaskRecord[]
  /** 건너뛸 단계: 파이프라인에서 k와 고른 단계 사이 */
  skipped: NodeName[]
  /** 새 task의 시작 이유 (시나리오 2-5) */
  reason: StartReason
  code: StepCode
  /**
   * [현재 코드 위에서 이어서]를 고를 수 있다: 버그 수정의 fix, 기능 추가의 design과 implement, 리팩터링의 refactor로
   * 되감을 때 (6.2, D254, D278)
   */
  keepCodeOffered: boolean
  /** 의도 승인 전 [intake 다시]에서 바꿀 유형 (D237). 바꾸지 않으면 null */
  type: WorkType | null
}

export type StepCode =
  /** to로 되돌리고, 되돌린 커밋과 커밋 안 된 변경은 백업 브랜치에 남긴다 (D115~D117) */
  | { kind: 'reset'; to: string; backupBranch: string }
  /** [현재 코드 위에서 이어서]: 커밋과 커밋 안 된 변경을 그대로 둔다 (6.2) */
  | { kind: 'keep' }
  /** 되돌리지 않는다: 건너뛰기이거나(D117), 폐기하는 task가 한 번도 시작하지 않아 되돌릴 커밋이 없다 */
  | { kind: 'none' }

export interface StepOptions {
  /** [현재 코드 위에서 이어서] (6.2, D254) */
  keepCode?: boolean
  /** 의도 승인 전 [intake 다시]에서 고른 유형 (D237). 지금 유형과 같으면 바꾸지 않는다 */
  type?: WorkType
  /** 이 Work의 백업 브랜치 (git). 새 백업 브랜치의 번호를 정한다 (D115) */
  backups?: readonly string[]
}

export type PlanResult = { ok: true; plan: StepPlan } | { ok: false; error: string }

/** 지금 task. 파이프라인은 한 번에 task 하나만 진행한다 */
function lastTask(work: WorkState): TaskRecord | undefined {
  return work.tasks[work.tasks.length - 1]
}

/** 단계를 고를 수 있는 Work: 진행 중이거나 멈췄다. 완료나 포기한 Work는 끝났다 (3.3) */
export function canSelectStep(work: WorkState): boolean {
  return (work.status === 'active' || work.status === 'stopped') && work.tasks.length > 0
}

/** 되감기인지 건너뛰기인지: 그 유형의 파이프라인에서 지금 단계 k 이하면 되감기다 (6.2) */
export function stepKind(type: WorkType, from: NodeName, to: NodeName): StepKind {
  return order(type, to) <= order(type, from) ? 'rewind' : 'skip'
}

/**
 * 6.3: 그 Work 유형의 단계만 고를 수 있고, 의도 승인 전에는 intake만 고를 수 있다. 고를 수 없으면 이유, 있으면 null
 */
function notAllowed(work: WorkState, node: NodeName): string | null {
  if (!canSelectStep(work)) return '진행 중이거나 멈춘 Work가 아님'
  if (!inPipeline(workType(work), node)) {
    return `${WORK_TYPE_LABEL[workType(work)]} Work의 단계가 아님`
  }
  if (!work.intent && node !== 'intake') return '의도 승인 전에는 intake만 고를 수 있음 (6.3)'
  return null
}

/** 유형을 바꿀 수 있는 단계 선택인가: 의도 승인 전 [intake 다시]뿐이다 (D237) */
function typeChangeAllowed(work: WorkState, node: NodeName): boolean {
  return node === 'intake' && !work.intent
}

// ---------- 백업 브랜치 (D115, D116) ----------

const BACKUP = /-discarded-(\d+)$/

/** 되감기의 백업 브랜치 이름: relay/<work-id>-discarded-<n> (D115) */
export function backupBranch(workId: string, n: number): string {
  return `relay/${workId}-discarded-${n}`
}

/** 이 Work의 백업 브랜치를 찾는 git for-each-ref 패턴 */
export function backupPattern(workId: string): string {
  return `refs/heads/relay/${workId}-discarded-*`
}

/** 다음 백업 브랜치: 이 Work의 백업 브랜치 가운데 가장 큰 번호 + 1 (D115) */
export function nextBackupBranch(workId: string, existing: readonly string[]): string {
  const prefix = `relay/${workId}-discarded-`
  const numbers = existing
    .filter((b) => b.startsWith(prefix))
    .map((b) => Number(BACKUP.exec(b)?.[1] ?? 0))
  return backupBranch(workId, Math.max(0, ...numbers) + 1)
}

/** 커밋 안 된 변경을 백업 브랜치에 남기는 커밋의 메시지 (D116). 시나리오 7-5의 앱 커밋과 같은 꼴이다 */
export function backupMessage(workId: string): string {
  return `relay(${workId}): 되감기 전 커밋 안 된 변경`
}

// ---------- 계산 (6.2) ----------

/**
 * 단계 선택의 결과 (6.2의 표). 순서는 그 Work 유형의 파이프라인이다(I57). 지금 단계를 k, 고른 단계를 j라고 하면:
 * - 되감기(j ≤ k): 진행 중인 k를 끝내고, j 이후 노드의 task(폐기되지 않은 것)를 모두 폐기하고, j를 새로 실행한다.
 *   코드는 폐기하는 task 가운데 가장 앞 task의 시작 커밋으로 되돌린다(D117). 버그 수정의 fix, 기능 추가의 design과
 *   implement로 되감으면 [현재 코드 위에서 이어서]를 고를 수 있다(D254). 의도 승인 전 intake로 되감으면 유형을
 *   바꿀 수 있다(D237).
 * - 건너뛰기(j > k): k가 진행 중이면 끝내고 k를 폐기한다. k가 끝났으면 k는 입력에 남는다.
 *   코드는 되돌리지 않는다(D117). 건너뛴 단계도 폐기한 task도 없으면(k가 끝났고 j가 기본 다음 단계)
 *   새 task의 이유는 기본 진행이다.
 * k가 끝났다는 것은 k를 승인하고 Work가 멈춘 것이다. 진행 중인 Work에서는 k가 늘 진행 중이다.
 */
export function planStep(work: WorkState, node: NodeName, opts: StepOptions = {}): PlanResult {
  const why = notAllowed(work, node)
  if (why) return { ok: false, error: why }
  const from = lastTask(work)
  if (!from) return { ok: false, error: '지금 task가 없음' }
  // PR 대응 task는 PR 진행 중에만 있어 canSelectStep이 이미 막는다 (D182, D188)
  const fromNode = from.node
  if (!isPipelineNode(fromNode))
    return { ok: false, error: 'PR 대응 task에서는 단계를 고를 수 없음 (D182)' }
  const type = workType(work)
  const kind = stepKind(type, fromNode, node)
  const done = from.status === 'approved'
  const keepCodeOffered = kind === 'rewind' && KEEP_CODE_NODES[type].includes(node)
  if (opts.keepCode && !keepCodeOffered) {
    const nodes = KEEP_CODE_NODES[type].join(', ')
    return { ok: false, error: `[현재 코드 위에서 이어서]는 ${nodes}로 되감을 때만 고를 수 있음` }
  }
  const changed = opts.type && opts.type !== type ? opts.type : null
  if (changed && !typeChangeAllowed(work, node)) {
    return { ok: false, error: '유형은 의도 승인 전 [intake 다시]에서만 바꿀 수 있음 (D237)' }
  }
  const interrupt = done
    ? null
    : from.session?.alive
      ? 'session'
      : from.status === 'queued'
        ? 'queue'
        : null

  if (kind === 'rewind') {
    const discard = work.tasks.filter(
      (t) =>
        t.status !== 'discarded' &&
        isPipelineNode(t.node) &&
        order(type, t.node) >= order(type, node),
    )
    const to = discard.find((t) => t.start_commit)?.start_commit
    const code: StepCode = opts.keepCode
      ? { kind: 'keep' }
      : to
        ? { kind: 'reset', to, backupBranch: nextBackupBranch(work.work_id, opts.backups ?? []) }
        : { kind: 'none' }
    return {
      ok: true,
      plan: {
        node,
        kind,
        from,
        done,
        interrupt,
        discard,
        skipped: [],
        reason: 'rewind',
        code,
        keepCodeOffered,
        type: changed,
      },
    }
  }

  const discard = done ? [] : [from]
  // 의도 승인 전에는 건너뛸 수 없다(notAllowed)
  const skipped = PIPELINES[type].filter(
    (n) => order(type, n) > order(type, fromNode) && order(type, n) < order(type, node),
  )
  // 기본 진행은 끝난 k의 기본 다음 단계를 고른 경우뿐이다
  const isDefault =
    skipped.length === 0 && discard.length === 0 && defaultNext(type, fromNode) === node
  return {
    ok: true,
    plan: {
      node,
      kind,
      from,
      done,
      interrupt,
      discard,
      skipped,
      reason: isDefault ? 'default' : 'skip',
      code: { kind: 'none' },
      keepCodeOffered,
      type: null,
    },
  }
}

// ---------- 대화상자 (D82) ----------

const title = (node: NodeName) => `${NODE_INFO[node].title}(${node})`

/**
 * 단계 선택 대화상자의 단계: 그 Work 유형의 파이프라인 차례로, 고를 수 있는지와 그 이유 (6.2, 6.3).
 * 그 유형의 모든 단계를 보인다. 의도 승인 전에는 intake만 고르게 하고, 그때 유형을 바꿀 수 있다 (D237)
 */
export function stepChoices(work: WorkState): StepChoice[] {
  const from = lastTask(work)
  const type = workType(work)
  // PR 대응 task(D188)가 지금 task면 파이프라인의 어느 단계보다 뒤로 본다: 고를 수는 없다 (canSelectStep, D182)
  const fromNode = from ? (isPipelineNode(from.node) ? from.node : 'verify') : null
  const recommended = work.stop?.kind === 'recommended_back' ? work.stop.node : null
  return PIPELINES[type].map((node) => {
    const why = from ? notAllowed(work, node) : '지금 task가 없음'
    const kind = fromNode ? stepKind(type, fromNode, node) : 'rewind'
    return {
      node,
      title: title(node),
      kind,
      allowed: why === null,
      why,
      current: from?.node === node,
      recommended: node === recommended,
      keepCode: kind === 'rewind' && KEEP_CODE_NODES[type].includes(node),
      typeChange: why === null && typeChangeAllowed(work, node),
    }
  })
}

/** 미리 본 때의 지금 task. [확인]에 함께 보낸다 */
export function stepExpect(plan: StepPlan): StepExpect {
  return { taskId: plan.from.id, done: plan.done }
}

/** 미리 보기에 더할 git과 파일의 사실. main이 읽는다 */
export interface PreviewFacts {
  /** 되돌릴 커밋부터 HEAD까지의 커밋 수 (git rev-list --count) */
  commits: number
  /** 커밋 안 된 변경 (git status) */
  uncommitted: readonly string[]
  /** 폐기할 task의 산출물 파일 이름 */
  artifacts: Readonly<Record<string, readonly string[]>>
}

/**
 * 미리 보기 (D82): 폐기될 산출물, 되돌릴 커밋 수와 커밋 안 된 변경과 백업 브랜치, 건너뛸 단계, 진행 중인 task.
 * 되돌릴 커밋도 커밋 안 된 변경도 없으면 백업 브랜치를 만들지 않는다 (D116).
 */
export function stepPreview(work: WorkState, plan: StepPlan, facts: PreviewFacts): StepPreview {
  const discard: DiscardView[] = plan.discard.map((t) => ({
    taskId: t.id,
    label: taskLabel(t),
    artifacts: [...(facts.artifacts[t.id] ?? [])],
  }))
  const code = plan.code
  const reset = code.kind === 'reset'
  const backup = reset && (facts.commits > 0 || facts.uncommitted.length > 0)
  const interrupt =
    plan.interrupt === 'session'
      ? `진행 중인 ${taskLabel(plan.from)}의 세션을 끝냅니다`
      : plan.interrupt === 'queue'
        ? `대기열의 ${taskLabel(plan.from)}을(를) 대기열에서 뺍니다`
        : null
  const version = work.intent ? work.intent.version + 1 : 1
  return {
    node: plan.node,
    title: title(plan.node),
    kind: plan.kind,
    reason: REASON_LABEL[plan.reason],
    expect: stepExpect(plan),
    interrupt,
    discard,
    skipped: plan.skipped.map(title),
    code: {
      kind: code.kind,
      to: reset ? code.to : null,
      commits: reset ? facts.commits : 0,
      uncommitted: [...facts.uncommitted],
      backupBranch: backup ? code.backupBranch : null,
    },
    keepCodeOffered: plan.keepCodeOffered,
    typeChange: plan.type
      ? `유형을 ${WORK_TYPE_LABEL[workType(work)]}에서 ${WORK_TYPE_LABEL[plan.type]}(으)로 바꿉니다. 의도 승인 뒤에는 바꿀 수 없습니다 (D237)`
      : null,
    intent:
      plan.node === 'intake'
        ? work.intent
          ? `의도 승인 때 intent 새 버전(v${version})을 만듭니다. 지금 버전(v${work.intent.version})을 출발점으로 고칩니다 (D40)`
          : '의도 승인 전이라 intent를 처음부터 씁니다'
        : null,
  }
}
