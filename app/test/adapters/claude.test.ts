import { describe, expect, it } from 'vitest'
import { findClaude } from '../../src/adapters/claude'

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
})
