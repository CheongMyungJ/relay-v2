import { describe, expect, it } from 'vitest'
import type { UpdateState } from '../../src/shared/api'
import { afterCheck, updateView } from '../../src/renderer/src/update'

const states: UpdateState[] = [
  { kind: 'off' },
  { kind: 'idle' },
  { kind: 'checking' },
  { kind: 'latest' },
  { kind: 'downloading', version: '0.3.0', percent: 42 },
  { kind: 'ready', version: '0.3.0' },
  { kind: 'manual', version: '0.3.0' },
  { kind: 'error', message: 'net::ERR_INTERNET_DISCONNECTED' },
]

describe('업데이트 버튼의 표시 (I121)', () => {
  it('최신·확인 중·받는 중·실패·설치 준비를 서로 다른 글로 보인다', () => {
    const shown = ['checking', 'latest', 'downloading', 'ready', 'manual', 'error'].map(
      (kind) => updateView(states.find((s) => s.kind === kind) as UpdateState).text,
    )
    expect(shown).toEqual([
      '확인 중',
      '최신',
      '받는 중 42%',
      '설치 준비됨',
      '직접 설치',
      '확인 실패',
    ])
    expect(updateView({ kind: 'downloading', version: '0.3.0', percent: null }).text).toBe(
      '받는 중',
    )
    expect(updateView({ kind: 'error', message: 'boom' }).title).toContain('boom')
  })

  it('누르면 확인하고, 받아 두었으면 설치로, 확인·받는 중이거나 꺼져 있으면 아무것도 하지 않는다', () => {
    const actions = Object.fromEntries(states.map((s) => [s.kind, updateView(s).action]))
    expect(actions).toEqual({
      off: 'none',
      idle: 'check',
      checking: 'none',
      latest: 'check',
      downloading: 'none',
      ready: 'install',
      manual: 'install',
      error: 'check',
    })
  })

  it('사람이 눌러 시작한 확인은 설치 준비가 끝나면 설치 확인 창을 연다', () => {
    let w = afterCheck(true, { kind: 'checking' })
    expect(w).toEqual({ waiting: true, open: false })
    w = afterCheck(w.waiting, { kind: 'downloading', version: '0.3.0', percent: 10 })
    expect(w).toEqual({ waiting: true, open: false })
    expect(afterCheck(w.waiting, { kind: 'ready', version: '0.3.0' })).toEqual({
      waiting: false,
      open: true,
    })
  })

  it('최신·실패·직접 설치면 기다리기를 그치고, 누르지 않았으면 창을 열지 않는다', () => {
    for (const s of [states[3], states[6], states[7]] as UpdateState[])
      expect(afterCheck(true, s)).toEqual({ waiting: false, open: false })
    // 30초 뒤·4시간마다의 자동 확인으로 받은 것은 창을 열지 않는다(OS 알림만)
    expect(afterCheck(false, { kind: 'ready', version: '0.3.0' }).open).toBe(false)
  })
})
