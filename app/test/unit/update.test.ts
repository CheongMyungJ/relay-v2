import { describe, expect, it } from 'vitest'
import {
  UNRELEASED_VERSION,
  updateNoticeBody,
  updatesEnabled,
  type UpdateTarget,
} from '../../src/main/update'

const installed: UpdateTarget = {
  env: {},
  packaged: true,
  platform: 'win32',
  version: '0.1.0',
  packageType: null,
}

const deb: UpdateTarget = { ...installed, platform: 'linux', packageType: 'deb' }

describe('자동 업데이트 (I95)', () => {
  it('릴리스한 Windows 설치본에서 켠다', () => {
    expect(updatesEnabled(installed)).toBe(true)
    expect(updatesEnabled({ ...installed, packaged: false })).toBe(false)
    expect(updatesEnabled({ ...installed, platform: 'darwin' })).toBe(false)
    expect(updatesEnabled({ ...installed, version: UNRELEASED_VERSION })).toBe(false)
  })

  it('Linux는 릴리스한 .deb 설치본에서만 켠다 (I105)', () => {
    expect(updatesEnabled(deb)).toBe(true)
    expect(updatesEnabled({ ...deb, packaged: false })).toBe(false)
    expect(updatesEnabled({ ...deb, version: UNRELEASED_VERSION })).toBe(false)
    expect(updatesEnabled({ ...deb, env: { RELAY_UPDATE: 'off' } })).toBe(false)
    for (const packageType of [null, 'rpm', 'AppImage'])
      expect(updatesEnabled({ ...deb, packageType })).toBe(false)
  })

  it('.deb는 끌 때 관리자 비밀번호를 묻는다고 알린다 (D351)', () => {
    expect(updateNoticeBody('linux')).toContain('관리자 비밀번호')
    expect(updateNoticeBody('win32')).not.toContain('비밀번호')
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
