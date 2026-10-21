import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BRANCH_RULE,
  branchClash,
  branchSuffix,
  checkBranchName,
  checkBranchRule,
  pickWorkBranch,
  renderBranchRule,
  ruleHasSlug,
  slugOf,
  withSuffix,
} from '../../src/core/branch'
import { targetBranch, workBranch } from '../../src/core/records'

const WORK = 'w-20261021-003'

describe('작업 브랜치 규칙 (D426)', () => {
  it('자리에 work-id, 날짜, 순번, 유형, 짧은 이름을 채운다', () => {
    expect(renderBranchRule(DEFAULT_BRANCH_RULE, { workId: WORK, type: 'bugfix', slug: '' })).toBe(
      'relay/w-20261021-003',
    )
    const rule = '{type}/{date}-{seq}-{slug}'
    expect(renderBranchRule(rule, { workId: WORK, type: 'bugfix', slug: 'login-timeout' })).toBe(
      'fix/20261021-003-login-timeout',
    )
    expect(renderBranchRule(rule, { workId: WORK, type: 'feature', slug: 'x' })).toBe(
      'feat/20261021-003-x',
    )
    expect(renderBranchRule('{type}/{work-id}', { workId: WORK, type: 'general', slug: '' })).toBe(
      'chore/w-20261021-003',
    )
  })

  it('짧은 이름이 비면 그 자리와 바로 앞 구분자 하나를 함께 뺀다', () => {
    const at = (rule: string) =>
      renderBranchRule(rule, { workId: WORK, type: 'refactor', slug: '' })
    expect(at('{type}/{date}-{seq}-{slug}')).toBe('refactor/20261021-003')
    expect(at('{type}/{slug}')).toBe('refactor')
    expect(at('{slug}_{seq}')).toBe('_003')
  })

  it('짧은 이름은 영문 소문자, 숫자, -만 남긴다', () => {
    expect(slugOf('  Login Timeout_fix ')).toBe('login-timeout-fix')
    expect(slugOf('로그인 오류')).toBe('')
    expect(slugOf('a--b')).toBe('a-b')
    expect(renderBranchRule('{slug}/{seq}', { workId: WORK, type: 'spec', slug: 'API v2!' })).toBe(
      'api-v2/003',
    )
  })

  it('규칙을 확인한다: 모르는 자리, 맞지 않는 괄호, 브랜치 이름으로 쓸 수 없는 모양을 받지 않는다', () => {
    expect(checkBranchRule('{type}/{date}-{seq}-{slug}')).toBeNull()
    expect(checkBranchRule('feature/{slug}')).toBeNull()
    expect(checkBranchRule('{name}/{seq}')).toContain('{name}')
    expect(checkBranchRule('{type/{seq}')).toContain('{ }')
    expect(checkBranchRule('a..b/{seq}')).toContain('a..b')
    expect(checkBranchRule('  ')).toContain('비었')
    expect(ruleHasSlug('{type}/{slug}')).toBe(true)
    expect(ruleHasSlug(DEFAULT_BRANCH_RULE)).toBe(false)
  })
})

describe('브랜치 이름 (git check-ref-format)', () => {
  it.each([
    ['relay/w-20261021-001', null],
    ['fix/login', null],
    ['', '비었'],
    ['a b', '쓸 수 없는 글자'],
    ['a~b', '쓸 수 없는 글자'],
    ['-x', '-로 시작'],
    ['a//b', '/'],
    ['a/', '/'],
    ['a..b', '모양'],
    ['a/.b', '.로 시작'],
    ['a.lock', '.lock'],
    ['a.', '.로 끝'],
  ])('%s', (name, error) => {
    const r = checkBranchName(name)
    if (error === null) expect(r).toBeNull()
    else expect(r).toContain(error)
  })
})

describe('끝의 임의의 4자 (D427)', () => {
  it('영문 소문자와 숫자 4자를 뽑고, -로 잇는다(끝이 구분자면 그대로 잇는다)', () => {
    expect(branchSuffix(() => 0)).toBe('aaaa')
    expect(branchSuffix(() => 0.9999)).toBe('9999')
    expect(branchSuffix()).toMatch(/^[a-z0-9]{4}$/)
    expect(withSuffix('fix/x', 'k7q2')).toBe('fix/x-k7q2')
    expect(withSuffix('fix/', 'k7q2')).toBe('fix/k7q2')
    expect(withSuffix('', 'k7q2')).toBe('k7q2')
  })

  it('이미 있는 브랜치와 같거나 ref 이름이 부딪히는지 본다', () => {
    expect(branchClash('a/b', ['a/b'])).toBe('a/b')
    expect(branchClash('a/b', ['a/b/c'])).toBe('a/b/c')
    expect(branchClash('a/b/c', ['a/b'])).toBe('a/b')
    expect(branchClash('a/bc', ['a/b'])).toBeNull()
  })
})

describe('Work를 만들 때의 작업 브랜치 (D425~D427)', () => {
  const base = {
    rule: '{type}/{date}-{seq}-{slug}',
    name: null,
    slug: 'login',
    workId: WORK,
    type: 'bugfix' as const,
    existing: ['main'],
  }

  it('규칙으로 만든 이름 끝에 임의의 4자를 붙인다', () => {
    expect(pickWorkBranch({ ...base, random: () => 0 })).toEqual({
      ok: true,
      branch: 'fix/20261021-003-login-aaaa',
    })
  })

  it('사람이 고친 이름이 있으면 규칙 대신 쓴다', () => {
    expect(pickWorkBranch({ ...base, name: ' team/payment ', random: () => 0 })).toEqual({
      ok: true,
      branch: 'team/payment-aaaa',
    })
  })

  it('이미 있는 이름과 부딪히면 4자를 다시 뽑는다', () => {
    const seq = [0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5]
    let i = 0
    const r = pickWorkBranch({
      ...base,
      existing: ['fix/20261021-003-login-aaaa'],
      random: () => seq[i++] ?? 0,
    })
    expect(r).toEqual({ ok: true, branch: 'fix/20261021-003-login-ssss' })
  })

  it('쓸 수 없는 이름이나 늘 부딪히는 이름은 오류다', () => {
    expect(pickWorkBranch({ ...base, name: 'a b' })).toMatchObject({ ok: false })
    // feat가 있으면 feat/<4자>는 만들 수 없다
    expect(
      pickWorkBranch({ ...base, name: 'feat/', existing: ['feat'], random: () => 0 }),
    ).toMatchObject({ ok: false, error: expect.stringContaining('feat') })
  })
})

describe('work.json의 작업 브랜치와 머지 대상 (D425, D428)', () => {
  it('적힌 이름을 쓰고, 적기 전의 Work는 relay/<work-id>, 머지 대상이 없으면 기준 브랜치다', () => {
    expect(workBranch({ work_id: WORK })).toBe('relay/w-20261021-003')
    expect(workBranch({ work_id: WORK, branch: 'fix/x-aaaa' })).toBe('fix/x-aaaa')
    expect(targetBranch({ base_branch: 'relay/w-1' })).toBe('relay/w-1')
    expect(targetBranch({ base_branch: 'relay/w-1', target_branch: 'main' })).toBe('main')
  })
})
