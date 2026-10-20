// [단위] 서브모듈 Work의 순수 규칙 (D413~D415): 서브모듈 프로젝트의 기본 브랜치, 에이전트 세션의 git 설정 보호,
// 메인 통합 검증 worktree의 메인 쪽 변경.
import { describe, expect, it } from 'vitest'
import {
  mainSideChanges,
  submoduleDefaultBranch,
  submoduleGuardEnv,
} from '../../src/core/submodule'

describe('[단위] 서브모듈 프로젝트의 기본 브랜치 (D413)', () => {
  it('origin/HEAD가 먼저다', () => {
    expect(
      submoduleDefaultBranch({ remoteHead: 'trunk', configured: 'dev', remote: ['dev', 'main'] }),
    ).toBe('trunk')
  })

  it('.gitmodules의 branch가 origin에 있으면 그것이다. `.`(메인과 같은 이름)는 쓰지 않는다', () => {
    expect(
      submoduleDefaultBranch({ remoteHead: null, configured: 'dev', remote: ['dev', 'main'] }),
    ).toBe('dev')
    expect(
      submoduleDefaultBranch({ remoteHead: null, configured: '.', remote: ['dev', 'main'] }),
    ).toBe('main')
    expect(
      submoduleDefaultBranch({ remoteHead: null, configured: 'gone', remote: ['master'] }),
    ).toBe('master')
  })

  it('main, master 다음은 origin의 첫 브랜치다. 브랜치가 없으면 null', () => {
    expect(submoduleDefaultBranch({ remoteHead: null, configured: null, remote: ['b', 'a'] })).toBe(
      'b',
    )
    expect(submoduleDefaultBranch({ remoteHead: null, configured: null, remote: [] })).toBeNull()
  })
})

describe('[단위] 에이전트 세션의 git 설정 보호 (D415)', () => {
  it('submodule.<이름>.update=none을 환경 변수 설정으로 더한다', () => {
    expect(submoduleGuardEnv({}, ['lib'])).toEqual({
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'submodule.lib.update',
      GIT_CONFIG_VALUE_0: 'none',
    })
  })

  it('이미 있는 환경 변수 설정 뒤에 붙인다', () => {
    expect(
      submoduleGuardEnv(
        {
          GIT_CONFIG_COUNT: '1',
          GIT_CONFIG_KEY_0: 'protocol.file.allow',
          GIT_CONFIG_VALUE_0: 'always',
        },
        ['libs/core'],
      ),
    ).toEqual({
      GIT_CONFIG_COUNT: '2',
      GIT_CONFIG_KEY_1: 'submodule.libs/core.update',
      GIT_CONFIG_VALUE_1: 'none',
    })
  })

  it('숫자가 아닌 GIT_CONFIG_COUNT는 0으로 본다. 이름이 없으면 더하지 않는다', () => {
    expect(submoduleGuardEnv({ GIT_CONFIG_COUNT: 'x' }, ['lib'])['GIT_CONFIG_COUNT']).toBe('1')
    expect(submoduleGuardEnv({}, [])).toEqual({})
  })
})

describe('[단위] 메인 통합 검증 worktree의 메인 쪽 변경 (D414)', () => {
  it('서브모듈 자리(가리키는 커밋이 바뀐 것)를 뺀다', () => {
    expect(
      mainSideChanges([' M lib', ' M src/app.c', '?? notes.txt', 'R  a.c -> lib2/a.c'], 'lib'),
    ).toEqual([' M src/app.c', '?? notes.txt', 'R  a.c -> lib2/a.c'])
    expect(mainSideChanges([' M libs/core'], 'libs/core')).toEqual([])
  })
})
