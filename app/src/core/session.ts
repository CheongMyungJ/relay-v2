// 기본 세션 (시나리오 12, D397~D406): 프로젝트나 Work에 매이지 않고 사람이 언제든 만들고 여는 에이전트 세션의 안내
// (시스템 프롬프트)와 이름. 안내는 곁 세션(D387)처럼 내용이 아니라 지도와 규칙이다 (D400). 에이전트는 --add-dir로 붙인
// RELAY_HOME의 프로젝트와 Work, 앱에 묶은 사용자 문서를 스스로 읽는다.
import { projectName, type ProjectState } from '../shared/project'
import { SESSION_NAME_MAX } from '../shared/session'
import type { WorkState } from '../shared/work'
import { WORK_TYPES, WORK_TYPE_LABEL } from '../shared/work'
import { currentTask } from './machine'
import { workType } from './pipeline'
import { workBranch } from './records'
import { TASK_STATUS_LABEL, WORK_STATUS_LABEL, taskLabel } from './review'

/** 이름의 길이 상한(D403)으로 자른다: 앞뒤 공백을 지우고, 20자(코드 포인트)를 넘으면 앞 20자 뒤에 …를 붙인다 */
export function clipSessionName(name: string): string {
  const chars = [...name.trim()]
  return chars.length > SESSION_NAME_MAX
    ? `${chars.slice(0, SESSION_NAME_MAX).join('').trimEnd()}…`
    : chars.join('')
}

/**
 * 첫 요청으로 짓는 이름 (D403): UserPromptSubmit의 prompt에서 앞뒤 공백을 지운 첫 줄. 비었거나 `/`로 시작하면(슬래시
 * 명령은 일의 이름이 아님) 짓지 않는다(null)
 */
export function sessionName(prompt: string): string | null {
  const line = prompt.trim().split(/\r?\n/)[0]?.trim() ?? ''
  if (!line || line.startsWith('/')) return null
  return clipSessionName(line)
}

export interface SessionGuideWork {
  project: ProjectState
  work: WorkState
  /** 사이드바의 Work 제목 (요청의 첫 줄) */
  title: string
  worktree: string
  /** Work 디렉터리 (projects/<project-id>/works/<work-id>) */
  workDir: string
}

export interface SessionGuideInput {
  /** RELAY_HOME. --add-dir로 붙인다 */
  home: string
  /** 앱에 묶은 사용자 문서(README.md)의 경로 (I134) */
  readme: string
  /** 이 세션의 폴더 (D398) */
  cwd: string
  /** 이 세션의 Work 초안 폴더 (D402, D404) */
  draftsDir: string
  projects: readonly ProjectState[]
  /** 열 때의 Work. 보관된 Work는 안내에 넣지 않는다 (D400) */
  works: readonly SessionGuideWork[]
  /** 앱이 게시하는 답글의 표시 문구 (D173). GitHub에 쓰는 글에도 붙인다 (D400) */
  signature: string
}

/** Work 한 줄: id, 제목, 유형, 상태와 지금 단계, worktree, Work 디렉터리 */
function workLines(w: SessionGuideWork): string[] {
  const now = currentTask(w.work)
  const step = now ? `, 지금 단계 ${taskLabel(now)} (${TASK_STATUS_LABEL[now.status]})` : ''
  return [
    `- ${w.work.work_id} "${w.title || w.work.work_id}" — ${WORK_TYPE_LABEL[workType(w.work)]}, ${WORK_STATUS_LABEL[w.work.status]}${step}`,
    `  - worktree: ${w.worktree} (브랜치 ${workBranch(w.work)})`,
    `  - Work 디렉터리: ${w.workDir}`,
  ]
}

/** 프로젝트마다 그 프로젝트와 보관되지 않은 Work */
function projectLines(input: SessionGuideInput): string[] {
  if (!input.projects.length) return ['- (등록한 프로젝트가 없음. 앱의 [프로젝트 추가]로 등록한다)']
  return input.projects.flatMap((p) => {
    const works = input.works.filter(
      (w) => w.project.project_id === p.project_id && w.work.status !== 'archived',
    )
    return [
      `### ${projectName(p)} (id: ${p.project_id})`,
      '',
      `- 레포: ${p.repo_path}`,
      `- 기본 브랜치: ${p.default_branch}`,
      ...(works.length ? works.flatMap(workLines) : ['- Work: (보관되지 않은 Work가 없음)']),
      '',
    ]
  })
}

/**
 * 기본 세션의 안내 (D400). 열 때의 프로젝트와 work.json으로 쓴다. 열린 동안 바뀌는 상태는 에이전트가 work.json을 다시
 * 읽어 안다. 이 글은 시스템 프롬프트에 덧붙어(--append-system-prompt-file, D399) 첫 프롬프트 없이도 들어간다
 */
export function sessionGuide(input: SessionGuideInput): string {
  const home = input.home
  return [
    '# relay 기본 세션',
    '',
    '너는 relay 앱의 기본 세션이다. 프로젝트나 Work에 매이지 않고 사람이 직접 연 세션이며 task(단계)가 아니다.',
    '사람이 묻기 전에는 아무것도 하지 않는다.',
    '',
    '## 이 세션의 역할',
    '',
    '- 쓰임은 셋이다: (1) 맨 Claude Code처럼 아무 일이나, (2) relay 도우미: 앱 사용법, 여러 프로젝트와 Work의 상태 묻기,',
    '  앱이 꼬였을 때의 진단, (3) 새 Work 구상: 어떤 일을 어떤 유형의 Work로 맡길지 사람과 논의하고 Work 초안을 쓴다.',
    '- 등록한 레포의 코드를 바꾸는 일은 먼저 새 Work를 권한다: 단계 흐름은 재현 테스트, 리뷰, 판정표, 승인을 거치지만',
    '  이 세션에서 바꾼 것은 그 기록에 남지 않는다. 진행 중인 Work에 대한 일은 그 Work의 곁 세션([곁 세션 열기])을 먼저',
    '  권한다. 그래도 여기서 하길 원하면 아래 바꾸는 규칙대로 한다.',
    '- 사람은 이 터미널에서 직접 대화한다. 물을 것은 여기서 묻고 턴을 끝내 답을 기다린다(앱 질문창은 없다).',
    '',
    '## 지도',
    '',
    `- RELAY_HOME: ${home}`,
    `- 앱 사용법(사용자 문서): ${input.readme}`,
    `- 이 세션의 폴더(지금 폴더): ${input.cwd}`,
    `- 이 세션의 Work 초안 폴더: ${input.draftsDir}`,
    '',
    '### RELAY_HOME의 파일 배치',
    '',
    '- `config.json`: 앱 설정',
    '- `home/`: 기본 세션의 기본 폴더',
    '- `sessions/<session-id>/session.json`: 기본 세션의 기록(앱 소유). `work-drafts/`는 그 세션의 Work 초안',
    '- `projects/<project-id>/project.json`: 레포 경로, 기본 브랜치, 프로젝트 설정',
    '- `projects/<project-id>/worktrees/<work-id>/`: Work의 worktree. 코드 변경은 그 git 이력에 있다',
    '- `projects/<project-id>/works/<work-id>/`: Work 디렉터리',
    '  - `work.json`: 앱의 상태. `status`가 Work 상태, `tasks[].status`가 task 상태다',
    '  - `request.md`(처음 받은 요청), `intent.md`(승인된 의도), `decisions.md`(승인된 task의 결정)',
    '  - `events.jsonl`: 수명주기 이벤트',
    '  - `tasks/<nn>-<node>/`: task마다 `context.md`(그 task에 준 입력), `instructions.md`(앱이 조립해 준 그 단계의 절차. 산출물이 아니다), 산출물, `handoff.md`, `pty.log`(터미널 기록)',
    '',
    '## 프로젝트와 Work (열 때)',
    '',
    ...projectLines(input),
    '## 읽는 규칙',
    '',
    '- 위 목록은 이 세션을 마지막으로 연(다시 연) 때의 것이다. 상태가 중요하면 `work.json`을 다시 읽고, 새로 생긴 것은 `projects/`를 다시 본다.',
    '- 폐기된 task(`status: discarded`)의 산출물과 결정은 버린 시도다. 사실이나 결정으로 받지 않는다.',
    '- 승인 전 task의 handoff에 적힌 결정은 아직 사람이 승인하지 않았다.',
    '',
    '## 바꾸는 규칙',
    '',
    '- 파일 수정과 지우기, 커밋, push, PR 만들기와 머지, GitHub에 글쓰기(이슈, 코멘트, 리뷰)는 하기 전에 사람에게 무엇을',
    '  할지 보이고 묻는다. 허락받은 것만 한다. 예외는 없다.',
    `- RELAY_HOME 아래에서는 \`home/\`과 이 세션의 Work 초안 폴더만 쓴다. \`config.json\`, \`projects/\` 아래 전부,`,
    '  `sessions/*/session.json`은 고칠 수 없다. 앱 상태를 바꿔야 하면 앱의 버튼을 안내한다.',
    '- Work의 worktree는 고치지 않는다. 그 Work의 곁 세션이나 단계 흐름(지금 단계의 터미널에 지시)을 안내한다.',
    `- GitHub에 쓰는 글 끝에는 빈 줄 뒤에 이 표시를 붙인다: ${input.signature}`,
    '',
    '## Work 초안',
    '',
    '구상이 정해지면 사람에게 보이고 허락받은 뒤 Work 초안 폴더에 초안을 Markdown 파일 하나로 쓴다(`<짧은 이름>.md`).',
    '여러 Work로 나누면 파일도 여럿이다. 형식:',
    '',
    '```markdown',
    '---',
    'project: <프로젝트 id>',
    `type: <${WORK_TYPES.join(' | ')}>`,
    'base: <기준 브랜치. 선택, 없으면 프로젝트의 기본 브랜치>',
    '---',
    '<요청: 새 Work의 request.md가 될 글. 첫 줄이 Work 제목이다>',
    '```',
    '',
    `- 유형: ${WORK_TYPES.map((t) => `\`${t}\` ${WORK_TYPE_LABEL[t]}`).join(', ')}`,
    '- `project`는 위 목록의 프로젝트 id만 쓴다.',
    '- 쓴 뒤에는 사람에게 앱 오른쪽 패널의 초안 카드에서 [새 Work로 만들기]를 누르라고 안내한다. 사람이 새 Work',
    '  대화상자에서 고치고 [만들기]를 눌러야 Work가 생기고, 그때 앱이 초안을 지운다.',
    '',
  ].join('\n')
}
