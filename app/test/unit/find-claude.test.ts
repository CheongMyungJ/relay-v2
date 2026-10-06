import { describe, expect, it } from 'vitest'
import { claudeInstallGuide } from '../../src/adapters/agent'
import { findClaude } from '../../src/adapters/claude'
import { pathDirs } from '../../src/adapters/which'

const has =
  (...files: string[]) =>
  (f: string) =>
    files.includes(f)

describe('findClaude (D106)', () => {
  const env = {
    USERPROFILE: 'C:\\Users\\u',
    APPDATA: 'C:\\Users\\u\\AppData\\Roaming',
    PATH: 'C:\\bin;C:\\tools',
  }

  it('CLAUDE_BIN이 가장 먼저다', () => {
    const r = findClaude({
      env: { ...env, CLAUDE_BIN: 'D:\\x\\claude.exe' },
      platform: 'win32',
      exists: () => true,
    })
    expect(r).toBe('D:\\x\\claude.exe')
  })

  it('CLAUDE_BIN이 경로가 아닌 명령 이름이면 그대로 쓴다: 실행할 때 PATH에서 찾는다 (PR #30 리뷰)', () => {
    for (const name of ['claude', 'claude.cmd'])
      expect(
        findClaude({ env: { ...env, CLAUDE_BIN: name }, platform: 'win32', exists: () => false }),
      ).toBe(name)
  })

  it('CLAUDE_BIN의 파일이 없으면 못 찾은 것이다: 로그인 실패 대신 설치 안내를 보인다 (D106, findCodex와 같음)', () => {
    const r = findClaude({
      env: { ...env, CLAUDE_BIN: 'D:\\x\\claude.exe' },
      platform: 'win32',
      exists: (f) => f !== 'D:\\x\\claude.exe',
    })
    expect(r).toBeNull()
  })

  it('네이티브 설치 → npm 전역 → PATH 순서다', () => {
    const native = 'C:\\Users\\u\\.local\\bin\\claude.exe'
    const npm = 'C:\\Users\\u\\AppData\\Roaming\\npm\\claude.cmd'
    const onPath = 'C:\\tools\\claude.exe'
    expect(findClaude({ env, platform: 'win32', exists: has(native, npm, onPath) })).toBe(native)
    expect(findClaude({ env, platform: 'win32', exists: has(npm, onPath) })).toBe(npm)
    expect(findClaude({ env, platform: 'win32', exists: has(onPath) })).toBe(onPath)
  })

  it('PATH에서 claude.cmd도 찾는다 (Path 이름도 읽는다)', () => {
    const e = { Path: 'C:\\nvm' }
    expect(findClaude({ env: e, platform: 'win32', exists: has('C:\\nvm\\claude.cmd') })).toBe(
      'C:\\nvm\\claude.cmd',
    )
  })

  it('못 찾으면 null이다', () => {
    expect(findClaude({ env, platform: 'win32', exists: () => false })).toBeNull()
  })

  it('Linux는 네이티브 설치 → PATH 순서다: PATH에 ~/.local/bin이 없어도 찾는다 (I106)', () => {
    const linux = { HOME: '/home/u', PATH: '/usr/bin:/usr/local/bin' }
    const native = '/home/u/.local/bin/claude'
    const onPath = '/usr/local/bin/claude'
    expect(findClaude({ env: linux, platform: 'linux', exists: has(native, onPath) })).toBe(native)
    expect(findClaude({ env: linux, platform: 'linux', exists: has(onPath) })).toBe(onPath)
    expect(
      findClaude({ env: { PATH: '/usr/bin' }, platform: 'linux', exists: has(native) }),
    ).toBeNull()
  })
})

describe('claude 설치 안내 (I106)', () => {
  it('OS에 맞는 설치 명령을 보인다', () => {
    expect(claudeInstallGuide('win32')).toContain('irm https://claude.ai/install.ps1 | iex')
    expect(claudeInstallGuide('linux')).toContain('curl -fsSL https://claude.ai/install.sh | bash')
    expect(claudeInstallGuide('linux')).not.toContain('PowerShell')
  })
})

describe('PATH 폴더 (PR #37 리뷰)', () => {
  it('Windows는 Path도 읽고 ;로, 그 밖은 :로 나누며 빈 항목은 뺀다', () => {
    expect(pathDirs({ Path: 'C:\\a;;C:\\b' }, 'win32')).toEqual(['C:\\a', 'C:\\b'])
    expect(pathDirs({ PATH: '/usr/bin::/bin' }, 'linux')).toEqual(['/usr/bin', '/bin'])
    expect(pathDirs({}, 'linux')).toEqual([])
  })
})
