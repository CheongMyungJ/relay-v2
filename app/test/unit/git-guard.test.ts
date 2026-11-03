// [단위] 세션이 하는 Work의 git·gh 보호 (docs/design.md D558): 작업 브랜치 push와 PR 열기는 두고 되돌리기 어려운 것만 막는다
import { describe, expect, it } from 'vitest'
import { riskyGitCommand } from '../../src/core/git-guard'
import { denyRules } from '../../src/core/settings'

const guard = (cmd: string) => riskyGitCommand(cmd, ['develop', 'relay/w-1'])

describe('[단위] git·gh 보호 (D558)', () => {
  it('작업 브랜치 push, upstream 설정, PR 열기와 보기는 막지 않는다', () => {
    for (const cmd of [
      'git push',
      'git push -u origin work/w-2-median',
      'git push origin HEAD',
      'git push origin HEAD:refs/heads/work/a',
      'git -C /tmp/x push origin feat/b',
      'gh pr create --title t --body b',
      'gh pr view 3',
      'git stash push -m wip',
      'git log --grep=push',
      'echo "git push origin main"',
    ])
      expect(guard(cmd), cmd).toBeNull()
  })

  it('지킬 브랜치(main, master, 머지 대상, 기준)에 push하면 막는다', () => {
    for (const cmd of [
      'git push origin main',
      'git push origin HEAD:main',
      'git push origin refs/heads/master',
      'git push origin develop',
      'cd x && git push origin HEAD:relay/w-1',
    ])
      expect(guard(cmd), cmd).toMatch(/D558/)
  })

  it('따옴표, 서브셸, 명령 치환, bash -c 안의 push와 여러 브랜치 refspec도 본다', () => {
    for (const cmd of [
      'git push origin "HEAD:main"',
      "git push origin 'main'",
      '(git push origin main)',
      "bash -c 'git push origin main'",
      'echo $(git push origin main)',
      'git push origin refs/heads/*:refs/heads/*',
    ])
      expect(guard(cmd), cmd).toMatch(/D558/)
    expect(guard('gh api repos/o/r/pulls/1')).toBeNull()
  })

  it('강제 push, 원격 브랜치 지우기, 모든 브랜치 push, PR 머지를 막는다', () => {
    for (const cmd of [
      'git push -f origin work/a',
      'git push --force origin work/a',
      'git push --force-with-lease',
      'git push -uf origin work/a',
      'git push origin +work/a',
      'git push origin :work/a',
      'git push --delete origin work/a',
      'git push --all',
      'git push --mirror',
      'gh pr merge 3 --squash',
      'git push -ud origin feat',
      'gh api -X PUT repos/o/r/pulls/1/merge',
      'gh api --method DELETE repos/o/r/git/refs/heads/x',
    ])
      expect(guard(cmd), cmd).toMatch(/D558/)
  })

  it('세션이 하는 Work의 task 설정은 git push와 gh pr을 deny에 넣지 않는다 (D557)', () => {
    const base = { workDir: '/w', previousTaskDirs: [] }
    expect(denyRules(base)).toEqual(expect.arrayContaining(['Bash(git push*)', 'Bash(gh pr*)']))
    expect(denyRules({ ...base, allowPush: true })).not.toEqual(
      expect.arrayContaining(['Bash(git push*)']),
    )
  })
})
