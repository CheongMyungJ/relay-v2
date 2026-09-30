import { describe, expect, it } from 'vitest'
import {
  cleanupActions,
  approvalStops,
  closingButtons,
  commitMessage,
  compareUrl,
  completedDelivery,
  deliveryButtons,
  deliveryStart,
  deliveryView,
  ghRepo,
  prText,
  remoteRepo,
  sameChanges,
  stashMessage,
  stoppedVerify,
} from '../../src/core/delivery'
import { createWork } from '../../src/core/machine'
import type { TaskCheck } from '../../src/core/validate'
import type { Handoff } from '../../src/shared/contracts'
import type { TaskRecord, TaskStatus, WorkState } from '../../src/shared/work'

const HANDOFF: Handoff = {
  status: 'awaiting_approval',
  blocked_reason: null,
  decisions: [],
  assumptions: [],
  rejected: [],
  open_questions: [],
  intent_deviation: null,
  risks: [],
  recommended_next: null,
}

function check(h: Partial<Handoff> = {}, errors = 0): TaskCheck {
  return {
    handoff_present: true,
    status: 'awaiting_approval',
    errors: Array.from({ length: errors }, () => ({
      file: 'pr.md',
      part: 'body' as const,
      message: '`pr.md` 첫 줄이 `# <PR 제목>`이 아님',
    })),
    warnings: [],
    handoff: { ...HANDOFF, ...h },
    handoffHeader: { ...HANDOFF, ...h },
    intentDraft: null,
    reviewFindings: null,
  }
}

/** 지금 task가 verify(t-03)인 S 경로 Work */
function atVerify(status: TaskStatus, patch: Partial<WorkState> = {}): WorkState {
  const base = createWork({
    workId: 'w-20260927-001',
    baseBranch: 'main',
    baseCommit: 'c0',
    at: 'x',
  }).work
  const task = (seq: number, node: TaskRecord['node'], s: TaskStatus): TaskRecord => ({
    ...(base.tasks[0] as TaskRecord),
    id: `t-0${seq}`,
    seq,
    node,
    status: s,
  })
  return {
    ...base,
    intent: { version: 1, size: 'S' },
    tasks: [task(1, 'intake', 'approved'), task(2, 'fix', 'approved'), task(3, 'verify', status)],
    ...patch,
  }
}

describe('전달 버튼 (시나리오 7-4, D67, D118)', () => {
  it('origin이 없으면 [push]와 [PR 생성], gh가 없으면 [PR 생성]만 이유와 함께 끈다', () => {
    expect(deliveryButtons({ origin: true, gh: true })).toEqual({
      none: { enabled: true, reason: null },
      push: { enabled: true, reason: null },
      pr: { enabled: true, reason: null },
    })
    expect(deliveryButtons({ origin: true, gh: false })).toEqual({
      none: { enabled: true, reason: null },
      push: { enabled: true, reason: null },
      pr: { enabled: false, reason: 'gh가 없거나 로그인되지 않음' },
    })
    const none = deliveryButtons({ origin: false, gh: true })
    expect(none.push).toEqual({ enabled: false, reason: 'origin 원격이 없음' })
    expect(none.pr).toEqual({ enabled: false, reason: 'origin 원격이 없음' })
    expect(none.none.enabled).toBe(true)
  })

  it('gh가 2.48.0보다 낮으면 [PR 생성]을 이유와 함께 끈다. 버전을 모르면 끄지 않는다 (D198)', () => {
    expect(deliveryButtons({ origin: true, gh: true, gh_version: '2.47.0' }).pr).toEqual({
      enabled: false,
      reason: 'gh 2.48.0 이상이 필요함 (지금 2.47.0)',
    })
    expect(deliveryButtons({ origin: true, gh: true, gh_version: '2.48.0' }).pr.enabled).toBe(true)
    expect(deliveryButtons({ origin: true, gh: true, gh_version: null }).pr.enabled).toBe(true)
    expect(closingButtons({ origin: true, gh: true, gh_version: '1.0.0' })).toEqual([
      '[완료만]',
      '[push]',
    ])
  })

  it('마무리 안내 문구의 버튼은 누를 수 있는 전달 버튼이다 (D104)', () => {
    expect(closingButtons({ origin: true, gh: true })).toEqual(['[완료만]', '[push]', '[PR 생성]'])
    expect(closingButtons({ origin: true, gh: false })).toEqual(['[완료만]', '[push]'])
    expect(closingButtons({ origin: false, gh: true })).toEqual(['[완료만]'])
  })
})

describe('전달을 시작할 수 있는 verify (7-3, D119, D120)', () => {
  it('승인할 수 있는 verify는 전달한다: 승인 대기, 대기, 세션 종료 (D112)', () => {
    for (const s of ['awaiting_approval', 'idle', 'session_ended'] as const) {
      const r = deliveryStart(atVerify(s), check())
      expect(r).toMatchObject({ ok: true, from: 'review', task: { id: 't-03' } })
    }
  })

  it('형식 오류가 있거나 턴이 끝나지 않았거나 verify가 아니면 전달하지 않는다', () => {
    expect(deliveryStart(atVerify('awaiting_approval'), check({}, 1))).toEqual({
      ok: false,
      error: 't-03의 handoff가 유효하지 않음',
    })
    expect(deliveryStart(atVerify('awaiting_approval'), null).ok).toBe(false)
    expect(deliveryStart(atVerify('working'), check())).toEqual({
      ok: false,
      error: 't-03는 승인할 수 있는 상태가 아님',
    })
    const fix = atVerify('awaiting_approval')
    const notVerify = {
      ...fix,
      tasks: fix.tasks.slice(0, 2).map((t) => ({ ...t, status: 'awaiting_approval' as const })),
    }
    expect(deliveryStart(notVerify, check())).toEqual({
      ok: false,
      error: '최종 검증의 Work 완료 화면이 아님',
    })
  })

  it('승인하면 멈추는 verify는 전달하지 않는다: [이 단계 끝나면 멈춤], 이전 단계 추천 (D119)', () => {
    const error = '승인하면 Work가 멈춤: [승인하고 멈춤]을 누르세요'
    expect(
      deliveryStart(atVerify('awaiting_approval', { stop_after_step: true }), check()),
    ).toEqual({ ok: false, error })
    const back = check({ recommended_next: { node: 'fix', reason: '완료조건 2 실패' } })
    expect(deliveryStart(atVerify('awaiting_approval'), back)).toEqual({ ok: false, error })
    expect(approvalStops({}, 'verify', back.handoffHeader)).toBe(true)
    expect(approvalStops({}, 'verify', check().handoffHeader)).toBe(false)
    expect(approvalStops({ stop_after_step: true }, 'fix', null)).toBe(true)
  })

  it('verify에서 멈춘 Work는 전달한다. verify는 이미 승인됐다 (D119)', () => {
    const stopped = atVerify('approved', {
      status: 'stopped',
      stop: { kind: 'after_step', task_id: 't-03' },
    })
    expect(stoppedVerify(stopped)?.id).toBe('t-03')
    expect(deliveryStart(stopped, null)).toMatchObject({ ok: true, from: 'stopped' })
    // fix에서 멈춘 Work는 아니다
    const atFix = {
      ...stopped,
      tasks: stopped.tasks.slice(0, 2),
      stop: { kind: 'after_step' as const, task_id: 't-02' },
    }
    expect(stoppedVerify(atFix)).toBeUndefined()
    expect(deliveryStart(atFix, null)).toEqual({ ok: false, error: '전달할 수 있는 Work가 아님' })
  })

  it('진행 중인 여러 단계 작업이 있거나 끝난 Work면 전달하지 않는다 (D77)', () => {
    const busy = atVerify('awaiting_approval', {
      operation: {
        kind: 'deliver',
        stage: 'push',
        started_at: 'x',
        choice: 'push',
        task_id: 't-03',
        uncommitted: null,
        branch: 'relay/w-20260927-001',
        base: 'main',
      },
    })
    expect(deliveryStart(busy, check())).toEqual({ ok: false, error: '진행 중인 작업이 있음' })
    for (const status of ['completed', 'abandoned', 'archived'] as const) {
      expect(deliveryStart(atVerify('approved', { status }), check()).ok).toBe(false)
    }
  })
})

describe('pr.md의 제목과 본문 (7-4, D62)', () => {
  it('첫 줄 # 제목이 제목이고 나머지가 본문이다. 본문 앞의 빈 줄과 끝의 공백은 뗀다', () => {
    expect(prText('# 빈 배열의 평균을 0으로\n\n## 요약\n고쳤다.\n\n')).toEqual({
      ok: true,
      title: '빈 배열의 평균을 0으로',
      body: '## 요약\n고쳤다.',
    })
    expect(prText('\uFEFF#   제목  \r\n\r\n본문\r\n')).toEqual({
      ok: true,
      title: '제목',
      body: '본문',
    })
    expect(prText('# 제목만')).toEqual({ ok: true, title: '제목만', body: '' })
  })

  it('첫 줄이 # 제목이 아니면 오류다 (형식 검사와 같은 규칙)', () => {
    for (const text of ['제목\n본문', '#제목', '#   ', '', '\n# 제목']) {
      expect(prText(text)).toEqual({ ok: false, error: 'pr.md 첫 줄이 `# <PR 제목>`이 아님' })
    }
  })
})

describe('비교 URL (7-4)', () => {
  it('origin 주소를 GitHub 레포로 읽는다: https, ssh://, scp 꼴', () => {
    const repo = { host: 'github.com', owner: 'o', repo: 'r' }
    for (const url of [
      'https://github.com/o/r.git',
      'https://github.com/o/r',
      'https://github.com/o/r/',
      'https://www.github.com/o/r.git',
      'https://user@GitHub.com/o/r.git',
      'http://github.com/o/r.git',
      'git@github.com:o/r.git',
      'github.com:o/r',
      'ssh://git@github.com/o/r.git',
      'ssh://git@github.com:22/o/r.git',
      'git+ssh://git@github.com/o/r.git',
      'git://github.com/o/r.git',
    ]) {
      expect(remoteRepo(url), url).toEqual(repo)
    }
    expect(remoteRepo('https://ghe.example.com/team/app.git')).toEqual({
      host: 'ghe.example.com',
      owner: 'team',
      repo: 'app',
    })
  })

  it('로컬 경로와 소유자/레포 꼴이 아닌 주소는 읽지 않는다', () => {
    for (const url of [
      '/tmp/x/sample.git',
      '../sample.git',
      'C:\\work\\sample.git',
      'C:/work/sample.git',
      'file:///tmp/x/sample.git',
      'https://github.com/o',
      'https://github.com/o/r/extra',
      'https://github.com/o/.git',
      'not a url',
      '',
    ]) {
      expect(remoteRepo(url), url).toBeNull()
    }
  })

  it('gh --repo에는 같은 규칙으로 읽은 HOST/OWNER/REPO를 주고, 읽을 수 없으면 주소를 그대로 준다', () => {
    // gh는 git@나 ssh:, https:로 시작하지 않는 주소를 URL로 읽지 않는다 (go-gh IsURL)
    expect(ghRepo('me@github.com:o/r.git')).toBe('github.com/o/r')
    expect(ghRepo('git@github.com:o/r.git')).toBe('github.com/o/r')
    expect(ghRepo('https://GitHub.com/o/r.git')).toBe('github.com/o/r')
    expect(ghRepo('ssh://git@ghe.example.com:2222/team/app.git')).toBe('ghe.example.com/team/app')
    expect(ghRepo('/tmp/x/sample.git')).toBe('/tmp/x/sample.git')
  })

  it('비교 URL은 gh pr create --web과 같은 꼴이고 브랜치 이름은 경로 조각으로 인코딩한다', () => {
    expect(compareUrl('git@github.com:o/r.git', 'main', 'relay/w-20260927-001')).toBe(
      'https://github.com/o/r/compare/main...relay%2Fw-20260927-001?expand=1',
    )
    expect(compareUrl('https://github.com/o/r.git', 'release/2.0', 'relay/w-1')).toBe(
      'https://github.com/o/r/compare/release%2F2.0...relay%2Fw-1?expand=1',
    )
    expect(compareUrl('/tmp/x/sample.git', 'main', 'relay/w-1')).toBeNull()
  })
})

describe('커밋 안 된 변경 (7-5)', () => {
  it('커밋과 stash의 메시지는 되감기 백업 커밋(D116)과 같은 꼴이다', () => {
    expect(commitMessage('w-20260927-001')).toBe('relay(w-20260927-001): 완료 전 남은 변경')
    expect(stashMessage('w-20260927-001')).toBe('relay(w-20260927-001): 완료 전 버린 변경')
  })

  it('사람에게 보인 목록과 지금 목록을 순서 없이 비교한다', () => {
    expect(sameChanges([' M a.js', '?? b.txt'], ['?? b.txt', ' M a.js'])).toBe(true)
    expect(sameChanges([' M a.js'], [' M a.js', '?? b.txt'])).toBe(false)
    expect(sameChanges([' M a.js'], ['?? a.js'])).toBe(false)
    expect(sameChanges([], [])).toBe(true)
  })
})

describe('전달 결과의 화면 (7-6)', () => {
  it('실패는 단계 이름과 오류를, 성공은 링크를 보인다. 완료한 Work의 전달은 성공한 전달이다', () => {
    const base = atVerify('awaiting_approval')
    expect(deliveryView(undefined)).toBeNull()
    expect(completedDelivery(base)).toBe('none')
    const failed = {
      ...base,
      delivery: {
        choice: 'pr' as const,
        status: 'failed' as const,
        at: 't',
        stage: 'pr' as const,
        error: 'gh pr create 실패',
        branch: 'relay/w-20260927-001',
      },
    }
    expect(deliveryView(failed.delivery)).toEqual({
      choice: 'pr',
      label: 'PR 생성',
      status: 'failed',
      at: 't',
      stage: 'PR 만들기',
      error: 'gh pr create 실패',
      branch: 'relay/w-20260927-001',
      compareUrl: null,
      prUrl: null,
      prExisting: false,
      draft: false,
    })
    expect(completedDelivery(failed)).toBe('none')
    const pushed = {
      ...base,
      delivery: {
        choice: 'push' as const,
        status: 'succeeded' as const,
        at: 't',
        branch: 'relay/w-20260927-001',
        compare_url: 'https://github.com/o/r/compare/main...relay%2Fw-20260927-001?expand=1',
      },
    }
    expect(deliveryView(pushed.delivery)).toMatchObject({
      label: 'push',
      stage: null,
      error: null,
      compareUrl: 'https://github.com/o/r/compare/main...relay%2Fw-20260927-001?expand=1',
    })
    expect(completedDelivery(pushed)).toBe('push')
  })
})

describe('정리 세션이 열린 동안의 조작 (D137)', () => {
  it('재개, 다시, 단계 선택, 포기를 끈다. 나머지는 그대로다', () => {
    const all = {
      interrupt: true,
      resume: true,
      retry: true,
      resumeWork: true,
      selectStep: true,
      stopAfter: true,
      abandon: true,
      clean: true,
    }
    expect(cleanupActions(all)).toEqual({
      interrupt: true,
      resume: false,
      retry: false,
      resumeWork: false,
      selectStep: false,
      stopAfter: true,
      abandon: false,
      clean: true,
    })
  })
})
