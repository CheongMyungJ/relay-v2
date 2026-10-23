// [단위] 기본 세션 (시나리오 12, D400, D403): 첫 요청으로 짓는 이름과 안내(시스템 프롬프트).
import { describe, expect, it } from 'vitest'
import { createWork } from '../../src/core/machine'
import { clipSessionName, sessionGuide, sessionName } from '../../src/core/session'
import type { ProjectState } from '../../src/shared/project'
import type { TaskRecord, WorkState } from '../../src/shared/work'

describe('기본 세션의 이름 (D403)', () => {
  it('앞뒤 공백을 지운 첫 줄이다', () => {
    expect(sessionName('  로그인 버그 원인 찾기  \n자세히는 이렇다')).toBe('로그인 버그 원인 찾기')
    expect(sessionName('\r\n\n  첫 줄\r\n둘째 줄')).toBe('첫 줄')
  })

  it('20자(코드 포인트)를 넘으면 앞 20자 뒤에 …를 붙인다', () => {
    expect(sessionName('가'.repeat(20))).toBe('가'.repeat(20))
    expect(sessionName('가'.repeat(21))).toBe(`${'가'.repeat(20)}…`)
    // 서로게이트 쌍도 한 자로 센다
    expect(sessionName('😀'.repeat(21))).toBe(`${'😀'.repeat(20)}…`)
    // 자른 자리의 공백은 남기지 않는다
    expect(sessionName(`${'가'.repeat(19)} 나다라`)).toBe(`${'가'.repeat(19)}…`)
  })

  it('비었거나 슬래시 명령이면 짓지 않는다', () => {
    expect(sessionName('')).toBeNull()
    expect(sessionName('   \n  ')).toBeNull()
    expect(sessionName('/clear')).toBeNull()
    expect(sessionName('  /model opus\n이어서')).toBeNull()
  })

  it('사람이 바꾼 이름에도 같은 자르기를 쓴다', () => {
    expect(clipSessionName('  새 Work 구상  ')).toBe('새 Work 구상')
    expect(clipSessionName('나'.repeat(25))).toBe(`${'나'.repeat(20)}…`)
    expect(clipSessionName('   ')).toBe('')
  })
})

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

function work(id: string, tasks: TaskRecord[], extra: Partial<WorkState> = {}): WorkState {
  const w = createWork({
    type: 'feature',
    workId: id,
    baseBranch: 'main',
    baseCommit: 'base0001',
    at: '2026-10-17T10:00:00+09:00',
  }).work
  return { ...w, tasks, ...extra }
}

const project: ProjectState = {
  schema_version: 1,
  project_id: 'shop-a1b2c3',
  repo_path: '/repos/shop',
  default_branch: 'main',
  created_at: 'x',
  checks: { origin: true, gh: true, checked_at: 'x' },
}

const input = {
  home: '/u/.relay',
  readme: '/opt/relay/resources/README.md',
  cwd: '/u/.relay/home',
  draftsDir: '/u/.relay/sessions/s-20261017-001/work-drafts',
  signature: '_relay가 쓴 답글입니다_',
}

describe('기본 세션의 안내 (D400)', () => {
  it('지도: RELAY_HOME, 사용자 문서, 세션 폴더와 초안 폴더, 프로젝트와 보관되지 않은 Work와 지금 단계', () => {
    const active = work('w-20261017-001', [task('t-01', 1, 'intake', 'awaiting_approval')])
    const archived = work('w-20261017-002', [], { status: 'archived' })
    const g = sessionGuide({
      ...input,
      projects: [project],
      works: [
        {
          project,
          work: active,
          title: '쿠폰 적용',
          worktree: '/u/.relay/projects/shop-a1b2c3/worktrees/w-20261017-001',
          workDir: '/u/.relay/projects/shop-a1b2c3/works/w-20261017-001',
        },
        { project, work: archived, title: '옛 일', worktree: '/w2', workDir: '/d2' },
      ],
    })
    expect(g).toContain('- RELAY_HOME: /u/.relay')
    expect(g).toContain('- 앱 사용법(사용자 문서): /opt/relay/resources/README.md')
    expect(g).toContain('- 이 세션의 폴더(지금 폴더): /u/.relay/home')
    expect(g).toContain('- 이 세션의 Work 초안 폴더: /u/.relay/sessions/s-20261017-001/work-drafts')
    expect(g).toContain('### shop (id: shop-a1b2c3)')
    expect(g).toContain('- 기본 브랜치: main')
    expect(g).toContain(
      '- w-20261017-001 "쿠폰 적용" — 기능 추가·변경, 진행 중, 지금 단계 01 의도 정리 (승인 대기)',
    )
    expect(g).toContain(
      '  - worktree: /u/.relay/projects/shop-a1b2c3/worktrees/w-20261017-001 (브랜치 relay/w-20261017-001)',
    )
    // 보관된 Work는 넣지 않는다
    expect(g).not.toContain('w-20261017-002')
  })

  it('프로젝트가 없으면 등록을 안내한다', () => {
    expect(sessionGuide({ ...input, projects: [], works: [] })).toContain(
      '등록한 프로젝트가 없음. 앱의 [프로젝트 추가]로 등록한다',
    )
  })

  it('바꾸는 규칙: 묻고 나서만 하고, 앱 소유 파일과 worktree를 고치지 않으며, GitHub 글에 표시를 붙인다', () => {
    const g = sessionGuide({ ...input, projects: [project], works: [] })
    expect(g).toContain('하기 전에 사람에게 무엇을')
    expect(g).toContain('예외는 없다')
    expect(g).toContain('`home/`과 이 세션의 Work 초안 폴더만 쓴다')
    expect(g).toContain('Work의 worktree는 고치지 않는다')
    expect(g).toContain('이 표시를 붙인다: _relay가 쓴 답글입니다_')
    // 코드를 바꾸는 일은 새 Work를, 진행 중인 Work의 일은 곁 세션을 먼저 권한다
    expect(g).toContain('먼저 새 Work를 권한다')
    expect(g).toContain('곁 세션([곁 세션 열기])을 먼저')
  })

  it('Work 초안의 형식과 [새 Work로 만들기] 안내 (D404)', () => {
    const g = sessionGuide({ ...input, projects: [project], works: [] })
    expect(g).toContain(
      [
        '---',
        'project: <프로젝트 id>',
        'type: <bugfix | feature | refactor | spec | general | custom>',
        'custom_type: <type이 custom일 때만. 커스텀 유형 id>',
      ].join('\n'),
    )
    expect(g).toContain('`bugfix` 버그 수정')
    expect(g).toContain('[새 Work로 만들기]')
  })
})
