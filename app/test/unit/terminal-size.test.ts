// [단위] 숨은 탭의 xterm이 PTY 크기를 따른다 (I189). main이 조각과 지난 출력에 붙이는 PTY 크기, 렌더러가 그 크기로
// xterm을 맞추는 차례(앞 조각을 다 그린 뒤), 지난 출력을 그린 크기로 다시 그리고 보이면 화면에 다시 맞추는 것
import { Terminal } from '@xterm/headless'
import { describe, expect, it } from 'vitest'
import { TerminalBuffer } from '../../src/main/terminals'
import { ptyFollower, sizeFix } from '../../src/renderer/src/termSize'
import type { TerminalSize } from '../../src/shared/views'

const PTY = { cols: 120, rows: 30 }

/** CLI처럼 PTY 폭(120)으로 줄 수를 세어 위로 올라가 지우고 다시 그린다. 첫 줄은 100칸이라 80열에서는 접힌다 */
function redraws(times: number): string {
  let out = ''
  for (let n = 1; n <= times; n++) {
    if (n > 1) out += '\x1b[2A\r\x1b[2K\x1b[1B\x1b[2K\x1b[1B\x1b[2K\x1b[2A\r'
    out += `⏺ 진행 ${n} ${'가'.repeat(46)}\r\n${'─'.repeat(110)}\r\n> 입력 ${n}`
  }
  return out
}

function lines(term: Terminal): string[] {
  const b = term.buffer.active
  const out: string[] = []
  for (let i = 0; i < b.length; i++) out.push(b.getLine(i)?.translateToString(true) ?? '')
  while (out.length && !out.at(-1)) out.pop()
  return out
}

const drawn = (term: Terminal) => new Promise<void>((r) => term.write('', r))

/** screen은 보이는 터미널을 화면에 맞추면 될 크기 (refit) */
function setup(shown: boolean, screen: TerminalSize = { cols: 80, rows: 24 }) {
  const term = new Terminal({ cols: 80, rows: 24, allowProposedApi: true })
  const sent: TerminalSize[] = []
  const follower = ptyFollower(term, {
    shown: () => shown,
    resizePty: (s) => void sent.push(s),
    refit: () => term.resize(screen.cols, screen.rows),
  })
  // xterm의 크기 바뀜 가운데 PTY에 보낼 것 (renderer/terminals.ts의 onResize와 같다)
  const told: TerminalSize[] = []
  term.onResize((s) => {
    if (!follower.following) told.push({ cols: s.cols, rows: s.rows })
  })
  return { term, follower, sent, told }
}

const at = (n: number, size: TerminalSize) => ({ at: n, size })

describe('PTY 크기를 붙이기 (main)', () => {
  it('조각에는 크기가 바뀔 때만 붙고, 지난 출력에는 크기가 바뀐 자리가 모두 있다. pty.log로 채운 것에는 없다', () => {
    const b = new TerminalBuffer()
    expect(b.push('표시 줄').size).toBeUndefined()
    expect(b.backlog().sizes).toEqual([])
    b.start(PTY)
    expect(b.push('출력').size).toEqual(PTY)
    expect(b.push('더').size).toBeUndefined()
    b.resized({ cols: 90, rows: 20 })
    expect(b.push('다시 그림').size).toEqual({ cols: 90, rows: 20 })
    // 같은 크기로 다시 띄운 세션은 크기를 다시 붙이지 않는다
    b.start({ cols: 90, rows: 20 })
    expect(b.push('재개').size).toBeUndefined()
    // PTY가 끝나도 지난 출력을 그린 크기는 남는다. PTY를 띄우기 전의 줄은 첫 크기로 그린다
    b.live = false
    expect(b.backlog()).toEqual({
      data: '표시 줄출력더다시 그림재개',
      next: 5,
      live: false,
      sizes: [at(4, PTY), at(7, { cols: 90, rows: 20 })],
    })
    // 출력 없이 크기만 바뀌었으면 끝에 둔다
    b.resized({ cols: 70, rows: 20 })
    expect(b.backlog().sizes.at(-1)).toEqual(at(14, { cols: 70, rows: 20 }))
    expect(TerminalBuffer.fromLog('지난 출력').backlog().sizes).toEqual([])
  })
})

describe('xterm과 PTY의 크기 맞추기 (렌더러)', () => {
  it('맞출 쪽: 숨은 터미널은 xterm, 보이는 터미널은 PTY. 크기를 모르거나 같으면 그대로', () => {
    const term = { cols: 80, rows: 24 }
    expect(sizeFix(term, PTY, false)).toBe('term')
    expect(sizeFix(term, PTY, true)).toBe('pty')
    expect(sizeFix(term, { cols: 80, rows: 24 }, false)).toBeNull()
    expect(sizeFix(term, undefined, false)).toBeNull()
  })

  it('숨은 xterm이 80x24로 남으면 다시 그리기가 덜 지워져 남는다. PTY 크기를 따르면 마지막 화면만 남는다', async () => {
    // 고치기 전: 80x24로 받은 뒤 보일 때 PTY 크기로 맞춘다
    const before = new Terminal({ cols: 80, rows: 24, allowProposedApi: true })
    before.write(redraws(5))
    await drawn(before)
    before.resize(PTY.cols, PTY.rows)
    expect(lines(before).filter((l) => l.startsWith('⏺'))).toHaveLength(5)

    const { term, follower, sent, told } = setup(false)
    let done = false
    follower.backlog({ data: redraws(2), sizes: [at(0, PTY)] }, null, () => (done = true))
    expect([term.cols, term.rows]).toEqual([120, 30])
    expect(follower.replaying).toBe(true)
    follower.chunk({ seq: 0, data: redraws(5).slice(redraws(2).length) })
    await drawn(term)
    expect(done).toBe(true)
    expect(follower.replaying).toBe(false)
    expect(lines(term).filter((l) => l.startsWith('⏺'))).toEqual([`⏺ 진행 5 ${'가'.repeat(46)}`])
    // PTY를 따라 바꾼 크기는 PTY와 main에 보내지 않는다
    expect(sent).toEqual([])
    expect(told).toEqual([])
  })

  it('보이는 터미널도 지난 출력은 그린 크기로 그리고, 다 그린 뒤 화면에 맞춘다', async () => {
    const { term, follower, sent, told } = setup(true, { cols: 100, rows: 28 })
    follower.backlog({ data: redraws(5), sizes: [at(0, PTY)] }, null, () => {})
    await drawn(term)
    expect(lines(term).filter((l) => l.startsWith('⏺'))).toHaveLength(1)
    // 화면에 맞춘 크기는 PTY에 보낸다 (onResize)
    expect([term.cols, term.rows]).toEqual([100, 28])
    expect(told).toEqual([{ cols: 100, rows: 28 }])
    expect(sent).toEqual([])
  })

  it('지난 출력에 크기가 여럿이면 바뀐 자리마다 그 크기로 그린다', async () => {
    const { term, follower } = setup(false)
    // 120열에서 그리면 줄 머리로 돌아가 쓴 y가 첫 칸이다. 60열에서 그리면 접힌 둘째 줄의 머리에 들어간다
    const first = `${'x'.repeat(100)}\x1b[1Gy`
    const small = { cols: 60, rows: 20 }
    follower.backlog(
      { data: `${first}\r\n${'z'.repeat(70)}`, sizes: [at(0, PTY), at(first.length + 2, small)] },
      null,
      () => {},
    )
    await drawn(term)
    expect([term.cols, term.rows]).toEqual([60, 20])
    const l = lines(term)
    expect(l[0]).toBe(`y${'x'.repeat(59)}`)
    expect(l.slice(-2)).toEqual(['z'.repeat(60), 'z'.repeat(10)])
  })

  it('PTY 크기가 바뀐 조각은 앞 조각을 그 크기로 다 그린 뒤에 xterm 크기를 바꾼다', async () => {
    const { term, follower } = setup(false)
    follower.backlog({ data: '', sizes: [at(0, PTY)] }, null, () => {})
    follower.chunk({ seq: 0, data: `${'x'.repeat(100)}\x1b[1Gy` })
    follower.chunk({ seq: 1, data: '', size: { cols: 60, rows: 20 } })
    await drawn(term)
    expect([term.cols, term.rows]).toEqual([60, 20])
    expect(lines(term)[0]).toBe(`y${'x'.repeat(59)}`)
  })

  it('PTY 크기를 모르는 지난 출력(pty.log, 대기열)은 숨었으면 마지막으로 맞춘 크기로 그린다', async () => {
    const { term, follower, told } = setup(false)
    follower.backlog({ data: '지난 출력', sizes: [] }, { cols: 132, rows: 40 }, () => {})
    expect([term.cols, term.rows]).toEqual([132, 40])
    // 나중에 PTY를 띄우면 그 크기를 따른다
    follower.chunk({ seq: 0, data: '새 세션', size: PTY })
    await drawn(term)
    expect([term.cols, term.rows]).toEqual([120, 30])
    expect(told).toEqual([])
    // 보이는 터미널은 화면에 맞춘 크기 그대로 그린다
    const shown = setup(true)
    shown.follower.backlog({ data: '지난 출력', sizes: [] }, { cols: 132, rows: 40 }, () => {})
    expect([shown.term.cols, shown.term.rows]).toEqual([80, 24])
  })

  it('보이는 터미널에 다른 PTY 크기의 조각이 오면 화면에 맞춘 xterm 크기를 PTY에 보낸다', async () => {
    const { term, follower, sent } = setup(true)
    follower.backlog({ data: '', sizes: [] }, null, () => {})
    follower.chunk({ seq: 0, data: '새 세션', size: PTY })
    await drawn(term)
    expect(sent).toEqual([{ cols: 80, rows: 24 }])
    expect([term.cols, term.rows]).toEqual([80, 24])
    // 같은 크기의 조각은 다시 보지 않는다
    follower.chunk({ seq: 1, data: '출력', size: { cols: 80, rows: 24 } })
    await drawn(term)
    expect(sent).toEqual([{ cols: 80, rows: 24 }])
  })
})
