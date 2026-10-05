import { describe, expect, it } from 'vitest'
import { UNRELEASED_VERSION, updatesEnabled, type UpdateTarget } from '../../src/main/update'

const installed: UpdateTarget = {
  env: {},
  packaged: true,
  platform: 'win32',
  version: '0.1.0',
}

describe('자동 업데이트 (I95)', () => {
  it('릴리스한 Windows 설치본에서만 켠다', () => {
    expect(updatesEnabled(installed)).toBe(true)
    expect(updatesEnabled({ ...installed, packaged: false })).toBe(false)
    expect(updatesEnabled({ ...installed, platform: 'linux' })).toBe(false)
    expect(updatesEnabled({ ...installed, platform: 'darwin' })).toBe(false)
    expect(updatesEnabled({ ...installed, version: UNRELEASED_VERSION })).toBe(false)
  })

  it('RELAY_UPDATE=off면 대소문자와 앞뒤 공백에 상관없이 끈다', () => {
    for (const v of ['off', 'OFF', ' Off ']) {
      expect(updatesEnabled({ ...installed, env: { RELAY_UPDATE: v } })).toBe(false)
    }
    for (const v of ['', 'on', 'offline']) {
      expect(updatesEnabled({ ...installed, env: { RELAY_UPDATE: v } })).toBe(true)
    }
  })
})
