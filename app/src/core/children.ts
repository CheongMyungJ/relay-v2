// 자식 Work의 판정 (docs/design.md D543~D548). 자율 Work의 자율 진행이 나란히 코드를 바꿀 일을 자식 Work로 맡긴다. 만들기와
// 진행은 main/children이 하고, 여기는 상한과 겹침, 끝났는지만 정한다
import type { WorkStatus } from '../shared/work'

/** 한 Work의 자식 수 상한 (D545, (기본값)). 포기한 자식은 세지 않는다 */
export const MAX_CHILDREN = 5

/**
 * 정하지 않은 자식인가 (D548): 진행 중이거나 멈춘 자식이다. 완료(merge), PR 진행(pr), 포기(discard), 보관은 정한 것이다. 부모는
 * 정하지 않은 자식이 남아 있으면 마무리하지 못한다
 */
export function isOpenChild(status: WorkStatus): boolean {
  return status === 'active' || status === 'stopped'
}

/** 경로를 비교할 모양으로: 앞의 ./와 끝의 /를 떼고 구분자는 /로 */
const norm = (p: string) => p.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '')

/** 같은 파일이거나 한쪽이 다른 쪽을 담는 폴더인가 */
const overlaps = (a: string, b: string) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`)

/**
 * 새 자식이 맡는 파일과 나란히 도는 다른 자식이 맡는 파일의 겹침 (D545). 막지 않고 경고로 알린다: 합칠 때 부모가 충돌을 푼다
 */
export function childOverlap(
  files: readonly string[],
  others: readonly { work: string; files: readonly string[] }[],
): { work: string; files: string[] }[] {
  const mine = files.map(norm).filter(Boolean)
  return others
    .map((o) => ({
      work: o.work,
      files: o.files.map(norm).filter((f) => mine.some((m) => overlaps(m, f))),
    }))
    .filter((o) => o.files.length > 0)
}

/** 부모가 마무리할 때 정하지 않은 자식이 남은 오류 (D548) */
export function openChildrenIssue(open: readonly string[]): string {
  return `정하지 않은 자식 Work가 있음: ${open.join(', ')}. decide_child로 merge, pr, discard 가운데 하나를 정한 뒤 마무리하세요 (D548)`
}

/** 자식 세션이 받는 연결 규칙의 재료 (D552) */
export interface ChildLink {
  parentWorkId: string
  parentTitle: string
  /** 부모 세션이 일하는 폴더. ListAgents에서 이 폴더의 세션이 부모다 (D553) */
  parentTree: string
  /** 이 자식의 worktree와 브랜치 */
  tree: string
  branch: string
  /** 이 task의 디렉터리 */
  taskDir: string
  /** 부모가 정한 맡는 파일 */
  files: readonly string[]
}

/**
 * 자식 세션의 시스템 프롬프트 (D552, D553, D555): 절차는 없고 연결 규칙만이다. 무엇을 할지는 부모의 지시(context.md)가
 * 정한다. 어디서 일하는지, 커밋과 push 금지, 부모와 말하는 법(ListAgents, SendMessage), 끝나면 부모에게 직접 말하고 턴을
 * 끝냄. relay는 끝 신호를 거치지 않는다
 */
export function childRules(c: ChildLink): string {
  return [
    '# relay: child session',
    '',
    `You are a child session of the relay Work ${c.parentWorkId} ("${c.parentTitle}"). The parent session gave you one piece of its work. What to do is in the parent's brief in \`context.md\` (path at the end). Follow it; the brief decides how you work.`,
    '',
    '## Where you work',
    '',
    `- Work only in this worktree: \`${c.tree}\` (branch \`${c.branch}\`).${c.files.length ? ` The parent gave you these files: ${c.files.map((f) => `\`${f}\``).join(', ')}. Touch other files only if the brief allows it.` : ''}`,
    '- Commit your changes before you finish. Do not push and do not open PRs: the parent merges your branch or delivers it.',
    '',
    '## Talking with the parent',
    '',
    `- The parent session works in \`${c.parentTree}\`. Find it with your \`ListAgents\` tool (the session whose working directory is that folder) and message it with \`SendMessage\`. The parent cannot see your terminal: put everything it needs into the message.`,
    '- Tell the parent what it should know while you work: a finding that affects other pieces, a change of plan, a question. Messages from the parent arrive between your tool calls, or start your next turn if you are idle; read them and adjust.',
    '- If you cannot go on without an answer, send the question and end your turn. The answer starts your next turn.',
    '- The human may also type in your terminal. A human instruction comes first; tell the parent what changed.',
    '',
    '## When you are done',
    '',
    'Commit everything, then send the parent one message: that you are done, what you did, the commits, and the tests you ran with their result. Then end your turn. Always send this message: the parent waits for it. If you stop because you are stuck, say that instead, and what you need.',
    '',
    'Write in Korean.',
    '',
  ].join('\n')
}

/** 자식 세션의 context.md (D552): 부모의 지시와 연결 정보뿐이다. 팀 지식과 결정 로그는 부모가 맡는다 */
export function childContext(c: ChildLink & { brief: string }): string {
  return [
    '# relay 자식 세션 컨텍스트',
    '',
    `- 부모 Work: ${c.parentWorkId} (${c.parentTitle})`,
    `- 부모 세션의 폴더: \`${c.parentTree}\``,
    `- 이 worktree: \`${c.tree}\``,
    `- 브랜치: \`${c.branch}\``,
    ...(c.files.length ? [`- 맡는 파일: ${c.files.map((f) => `\`${f}\``).join(', ')}`] : []),
    '',
    '## 부모의 지시',
    '',
    c.brief.trim(),
    '',
  ].join('\n')
}

/**
 * 부모가 자식을 정할 때 앱이 자식 task에 남기는 기록용 handoff (D555): 자식은 handoff를 쓰지 않고 부모에게 직접 말하므로,
 * 승인 기록(D3)과 Work 완료가 같은 길을 지나게 앱이 대신 쓴다
 */
export function childHandoff(decision: 'merge' | 'pr'): string {
  const what = decision === 'merge' ? '부모가 merge로 정함' : '부모가 따로 PR로 정함'
  return [
    '---',
    'status: awaiting_approval',
    'blocked_reason:',
    'decisions:',
    `  - what: "${what}"`,
    '    why: "자식 세션이 부모에게 끝났다고 알림"',
    '    by: ai',
    'assumptions: []',
    'rejected: []',
    'open_questions: []',
    'intent_deviation: null',
    'risks: []',
    '---',
    '## 요약',
    `${what}. 자식이 한 일은 부모 세션과 주고받은 메시지와 이 브랜치의 커밋에 있다.`,
    '## 다음 task가 알아야 할 것',
    '- 없음',
    '',
  ].join('\n')
}

/** 자식 세션이 턴을 끝내 정할 수 있는 상태인가 (D555): 일하는 중이거나 대기열이 아니다 */
export function childTurnEnded(status: string): boolean {
  return status === 'idle' || status === 'awaiting_approval' || status === 'session_ended'
}
