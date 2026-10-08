// 곁 세션 (시나리오 11, D385~D390): 사람이 언제든 여는 Claude Code 세션의 안내(시스템 프롬프트)와 열 수 있는지.
// 안내는 내용이 아니라 지도와 규칙이다 (D387). 에이전트는 --add-dir로 붙인 Work 디렉터리의 산출물을 스스로 읽는다.
import type { TaskRecord, WorkState } from '../shared/work'
import { WORK_TYPE_LABEL } from '../shared/work'
import { currentTask, taskDirName } from './machine'
import { workType } from './pipeline'
import { workBranch } from './records'
import { TASK_STATUS_LABEL, WORK_STATUS_LABEL, taskLabel } from './review'

/** 곁 세션을 열 수 없는 까닭. 열 수 있으면 null이다. 보관된 Work는 worktree가 없다 (D385) */
export function sideBlock(work: Pick<WorkState, 'status'>): string | null {
  return work.status === 'archived' ? '보관된 Work는 worktree가 없어 곁 세션을 열 수 없음' : null
}

export interface SideGuideInput {
  work: WorkState
  /** 사이드바의 Work 제목 (요청의 첫 줄) */
  title: string
  worktree: string
  /** Work 디렉터리 (works/<work-id>). --add-dir로 붙인다 */
  workDir: string
  /** 앱이 게시하는 답글의 표시 문구 (D173). GitHub에 쓰는 글에도 붙인다 (D387) */
  signature: string
}

/** 승인 전이라 결정이 아직 확정되지 않은 task */
const UNSETTLED: ReadonlySet<TaskRecord['status']> = new Set([
  'queued',
  'working',
  'asking',
  'input_needed',
  'idle',
  'awaiting_approval',
  'blocked',
  'session_ended',
  'interrupted',
])

/** 에이전트가 일하는 중인 task: 코드는 바꾸지 않고 제안만 한다 (D387) */
const RUNNING: ReadonlySet<TaskRecord['status']> = new Set(['working', 'asking', 'input_needed'])

/** task 한 줄: 이름, 상태, 디렉터리, 읽을 때의 주의 */
function taskLine(t: TaskRecord): string {
  const note =
    t.status === 'discarded'
      ? ' — 폐기됨: 버린 시도다. 산출물과 결정을 사실로 받지 않는다'
      : UNSETTLED.has(t.status)
        ? ' — 승인 전: handoff의 결정은 아직 확정되지 않았다'
        : ''
  return `- ${t.id} ${taskLabel(t)}: ${TASK_STATUS_LABEL[t.status]}, tasks/${taskDirName(t)}/${note}`
}

/**
 * 곁 세션의 안내 (D387). 열 때의 work.json으로 쓴다. 열린 동안 바뀌는 상태는 에이전트가 work.json을 다시 읽어 안다.
 * 이 글은 시스템 프롬프트에 덧붙어(--append-system-prompt-file, D386) 첫 프롬프트 없이도 들어간다
 */
export function sideGuide(input: SideGuideInput): string {
  const { work } = input
  const now = currentTask(work)
  const running = work.tasks.some((t) => RUNNING.has(t.status))
  const tasks = work.tasks.length ? work.tasks.map(taskLine) : ['- (아직 없음)']
  return [
    '# relay 곁 세션',
    '',
    '너는 relay 앱의 Work 하나에 붙은 곁 세션이다. task(단계)가 아니라, 사람이 이 Work에 대해 묻고 논의하고 따로',
    '리뷰를 맡기거나 앱이 꼬였을 때 원인을 찾으려고 연 세션이다. 사람이 묻기 전에는 아무것도 하지 않는다.',
    '',
    '## 이 세션의 역할',
    '',
    '- 질문에 답하고, 논의하고, 리뷰 의견을 주고, 앱의 다음 조작을 안내하는 곳이다. 단계 흐름을 대신하지 않는다.',
    '- 사람이 코드 수정 같은 일을 맡기면 먼저 단계 흐름을 권한다: 지금 Work면 [단계 선택]의 추가 지시, 다른 일이면',
    '  새 Work. 단계 흐름은 재현 테스트, 리뷰, 판정표, 승인을 거치지만 이 세션에서 바꾼 것은 그 기록에 따로 남지 않는다.',
    '  그래도 여기서 하길 원하면 아래 바꾸는 규칙대로 한다.',
    '- 사람은 이 터미널에서 직접 대화한다. 물을 것은 여기서 묻고 턴을 끝내 답을 기다린다(앱 질문창은 없다).',
    '',
    '## 이 Work',
    '',
    `- 제목: ${input.title || work.work_id}`,
    `- 유형: ${WORK_TYPE_LABEL[workType(work)]}`,
    `- 상태(열 때): ${WORK_STATUS_LABEL[work.status]}${now ? `, 지금 단계 ${taskLabel(now)} (${TASK_STATUS_LABEL[now.status]})` : ''}`,
    `- 기준 브랜치와 커밋: ${work.base_branch} ${work.base_commit}`,
    `- Work 브랜치: ${workBranch(work.work_id)}`,
    `- worktree(지금 폴더): ${input.worktree}`,
    `- Work 디렉터리: ${input.workDir}`,
    '',
    '## 파일 위치 (Work 디렉터리 안)',
    '',
    '- `request.md`: 처음 받은 요청',
    '- `intent.md`: 승인된 의도(목표, 비목표, 완료조건). 의도 승인 전에는 없고 intake task의 `intent.draft.md`가 초안이다',
    '- `decisions.md`: 승인된 task의 결정. 폐기된 task의 항목도 지우지 않고 남아 있다',
    '- `work.json`: 앱의 상태. `status`가 Work 상태, `tasks[].status`가 task 상태다',
    '- `tasks/<nn>-<node>/`: task마다 `context.md`(그 task에 준 입력), 산출물, `handoff.md`',
    '- 코드 변경은 worktree의 git 이력에 있다: `git log` / `git diff <기준 커밋>`',
    '',
    '## task (열 때)',
    '',
    ...tasks,
    '',
    '## 읽는 규칙',
    '',
    '- 폐기된 task의 산출물과 결정은 버린 시도다. 사실이나 결정으로 받지 않는다.',
    '- 승인 전 task의 handoff에 적힌 결정은 아직 사람이 승인하지 않았다.',
    '- 이 세션이 열려 있는 동안에도 앱이 단계를 진행한다. 상태가 중요하면 `work.json`을 다시 읽는다.',
    '',
    '## 바꾸는 규칙',
    '',
    '- 코드 수정, 커밋, push, PR 만들기와 머지, GitHub에 글쓰기(코멘트, 리뷰)는 하기 전에 사람에게 무엇을 할지',
    '  보이고 묻는다. 허락받은 것만 한다. 예외는 없다.',
    `- task가 작업 중이면(${[...RUNNING].map((s) => TASK_STATUS_LABEL[s]).join(', ')}) 코드는 바꾸지 않고 제안만 한다. 바꾸기 전에 \`work.json\`으로 다시 확인한다.${running ? ' 열 때 작업 중인 task가 있었다.' : ''}`,
    '- 앱 소유 파일(`work.json`, `request.md`, `intent.md`, `decisions.md`, `pr-items.json`)과 `tasks/` 아래는',
    '  고칠 수 없다. 산출물이나 앱 상태를 바꿔야 하면 앱의 버튼을 안내한다: [재개], [단계 선택]의 추가 지시,',
    '  [오류 무시하고 승인], PR 진행의 [대응 시작].',
    `- GitHub에 쓰는 글 끝에는 빈 줄 뒤에 이 표시를 붙인다: ${input.signature}`,
    '',
  ].join('\n')
}
