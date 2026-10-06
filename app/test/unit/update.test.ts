import { describe, expect, it } from 'vitest'
import {
  isWsl,
  manualInstallCommand,
  manualInstallDetail,
  needsManualInstall,
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

  it('Linux는 릴리스한 .deb 설치본에서만 켠다 (I118)', () => {
    expect(updatesEnabled(deb)).toBe(true)
    expect(updatesEnabled({ ...deb, packaged: false })).toBe(false)
    expect(updatesEnabled({ ...deb, version: UNRELEASED_VERSION })).toBe(false)
    expect(updatesEnabled({ ...deb, env: { RELAY_UPDATE: 'off' } })).toBe(false)
    for (const packageType of [null, 'rpm', 'AppImage'])
      expect(updatesEnabled({ ...deb, packageType })).toBe(false)
  })

  it('.deb는 끌 때 관리자 비밀번호를 묻는다고 알린다 (D377)', () => {
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

  it('WSL을 환경 변수나 커널 릴리스로 알아본다 (D378)', () => {
    expect(isWsl({ WSL_DISTRO_NAME: 'Ubuntu' }, '6.8.0-45-generic')).toBe(true)
    expect(isWsl({}, '5.15.167.4-microsoft-standard-WSL2')).toBe(true)
    expect(isWsl({}, '6.8.0-45-generic')).toBe(false)
  })

  it('WSL이나 그래픽 비밀번호 도구가 없는 곳에서는 사람이 설치한다 (D379)', () => {
    const desktop = {
      platform: 'linux' as const,
      env: {},
      osRelease: '6.8.0-45-generic',
      hasCommand: (n: string) => n === 'pkexec',
    }
    expect(needsManualInstall(desktop)).toBe(false)
    expect(needsManualInstall({ ...desktop, env: { WSL_DISTRO_NAME: 'Ubuntu' } })).toBe(true)
    expect(needsManualInstall({ ...desktop, osRelease: '5.15.1-microsoft-standard-WSL2' })).toBe(
      true,
    )
    expect(needsManualInstall({ ...desktop, hasCommand: () => false })).toBe(true)
    expect(needsManualInstall({ ...desktop, platform: 'win32', hasCommand: () => false })).toBe(
      false,
    )
  })

  it('설치 명령은 경로를 작은따옴표로 감싼다 (D379)', () => {
    expect(manualInstallCommand('/home/u/.cache/relay-updater/pending/relay_0.2.0_amd64.deb')).toBe(
      "sudo apt install '/home/u/.cache/relay-updater/pending/relay_0.2.0_amd64.deb'",
    )
    expect(manualInstallCommand("/home/o'neil/relay.deb")).toBe(
      "sudo apt install '/home/o'\\''neil/relay.deb'",
    )
  })

  it('설치 명령 대화상자는 까닭에 맞는 안내를 보인다 (D379)', () => {
    const cmd = "sudo apt install '/tmp/relay.deb'"
    expect(manualInstallDetail('unsupported', cmd)).toContain('WSL')
    expect(manualInstallDetail('failed', cmd)).toContain('다시 묻습니다')
    for (const r of ['unsupported', 'failed'] as const)
      expect(manualInstallDetail(r, cmd).endsWith(cmd)).toBe(true)
  })
})
