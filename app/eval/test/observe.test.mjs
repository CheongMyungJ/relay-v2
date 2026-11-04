// 쪽마다 같은 관찰·측정: 깨우기 서명에서 시계만 도는 것 가리기, 앱이 부른 claude -p의 토큰, hands-off 규칙 어김 세기
// (relay-v3 M2 평가 리뷰)
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { handsOffViolations } from '../lib/episode.mjs'
import { appCallUsage, pollSignature, RelayArm } from '../lib/relay-arm.mjs'
import { withoutClock } from '../lib/util.mjs'

describe('깨우기 서명: Claude Code 화면의 시계', () => {
  it('스피너의 경과 시간과 그림, 도는 도구의 깜빡이는 점은 바뀐 것으로 보지 않는다', () => {
    const at = (glyph, time, dot) =>
      [
        `${dot} relay_work - submit_contract (MCP)(contract: {…})`,
        '  ⎿  Running…',
        '',
        `${glyph} Baking… (${time} · ↓ 1.6k tokens · esc to interrupt)`,
      ].join('\n')
    expect(withoutClock(at('✻', '1m 5s', '●'))).toBe(withoutClock(at('✶', '1m 6s', ' ')))
    expect(withoutClock(at('·', '59s', '●'))).toBe(withoutClock(at('*', '1m 0s', '●')))
    // 이 PC의 스피너 그림(✢ ✳ ✽)과 macOS의 점(⏺)도
    expect(withoutClock('✢ Baking… (3s)')).toBe(withoutClock('✽ Baking… (4s)'))
    expect(withoutClock('⏺ Bash(npm test)')).toBe(withoutClock('  Bash(npm test)'))
  })

  it('모델이 내는 것(토큰 수, 새 줄, 글)은 바뀐 것으로 본다', () => {
    const line = (tokens) => `✻ Baking… (12s · ↓ ${tokens} tokens · esc to interrupt)`
    expect(withoutClock(line('1.6k'))).not.toBe(withoutClock(line('1.7k')))
    expect(withoutClock('● 합계는 29,079원')).not.toBe(withoutClock('● 합계는 29,082원'))
    expect(withoutClock('a\nb')).not.toBe(withoutClock('a\nb\nc'))
    // 시계가 아닌 숫자는 그대로다
    expect(withoutClock('ok 47 - [C4.1] 정수 원이 아닌 단가')).toBe(
      'ok 47 - [C4.1] 정수 원이 아닌 단가',
    )
    expect(withoutClock('✻ Baked for 2m 32s · done 8:10 AM')).toBe('  Baked for # · done 8:10 AM')
  })
})

describe('앱 쪽 깨우기 서명', () => {
  // Claude Code 2.1.318이 submit_contract(MCP)가 사람의 답을 기다리는 동안 그린 화면(가짜 API로 띄워 찍음). 앱의 화면
  // 글자(body innerText)에도 xterm 줄이 nbsp와 함께 들어 있다
  const screen = (dot, toolTime, glyph, time) => {
    const terminal = [
      '❯ The request for this Work is in /tmp/w/request.md. Read it and start with the',
      '  contract.',
      '',
      `${dot} Branch · ${toolTime}`,
      '  ⎿  $ git rev-parse --abbrev-ref HEAD',
      '',
      `${glyph} Composing… (${time} · ↓ 124 tokens)`,
      '',
      '  ⏵⏵ bypass permissions on (shift+tab to cycle) · esc to interrupt',
    ].join('\n')
    return {
      text: `relay\n승인 기다림\n세션이 답을 기다림\n${terminal.replaceAll(' ', '\u00a0')}\n계약\n승인`,
      terminal,
    }
  }

  it('계약 승인을 기다리는 동안 시계와 깜빡임만 바뀌면 서명이 같다(화면 글자 속 터미널 줄까지)', () => {
    expect(pollSignature(screen('●', '2s', '✢', '3s'))).toBe(
      pollSignature(screen(' ', '59s', '*', '1m 0s')),
    )
    // 터미널 줄을 화면 글자에서 가리지 않으면 바뀐 것으로 본다(첫 고침이 놓친 것)
    const a = screen('●', '2s', '✢', '3s')
    const b = screen(' ', '3s', '*', '4s')
    expect(`${a.text}\n${withoutClock(a.terminal)}`).not.toBe(
      `${b.text}\n${withoutClock(b.terminal)}`,
    )
  })

  it('앱 글자가 바뀌면 바뀐 것으로 본다', () => {
    const a = screen('●', '2s', '✢', '3s')
    expect(pollSignature(a)).not.toBe(
      pollSignature({ ...a, text: a.text.replace('승인 기다림', '구현 중') }),
    )
  })
})

describe('relay 앱이 부른 claude -p (독립 리뷰, 지식 검토)', () => {
  it('task 폴더 기록의 usage를 relay-v3 리뷰와 같은 모양으로 더한다', () => {
    expect(appCallUsage([])).toBeNull()
    expect(
      appCallUsage([
        {
          kind: 'find',
          usage: { input: 10, output: 2, cacheRead: 100, cacheCreation: 30 },
          error: null,
        },
        { kind: 'check', usage: null, error: 'claude -p 시간 초과' },
        { hash: 'h', usage: { input: 1, output: 1, cacheRead: 0, cacheCreation: 0 }, error: null },
      ]),
    ).toEqual({
      calls: 3,
      done: 2,
      failed: 1,
      skipped: 0,
      usageUnknown: 1,
      input: 11,
      output: 3,
      cacheRead: 100,
      cacheWrite: 30,
    })
  })
})

describe('relay 쪽의 앱 claude -p 기록 읽기', () => {
  it('Work의 task 폴더(커스텀 단계는 단계 이름)에서 독립 리뷰와 지식 검토 기록을 모은다', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-calls-'))
    try {
      const work = path.join(root, 'relay-home', 'projects', 'p', 'works', 'w-1')
      const task = (name, file, calls) => {
        fs.mkdirSync(path.join(work, 'tasks', name), { recursive: true })
        fs.writeFileSync(path.join(work, 'tasks', name, file), JSON.stringify({ calls }))
      }
      const usage = { input: 1, output: 1, cacheRead: 10, cacheCreation: 5 }
      fs.mkdirSync(work, { recursive: true })
      fs.writeFileSync(
        path.join(work, 'work.json'),
        JSON.stringify({
          status: 'done',
          tasks: [
            { seq: 1, node: 'intent' },
            { seq: 2, node: 'custom', step: 'apply' },
            { seq: 3, node: 'verify' },
          ],
        }),
      )
      task('01-intent', 'knowledge-review.json', [{ hash: 'a', usage, error: null }])
      task('02-apply', 'knowledge-review.json', [{ hash: 'b', usage, error: null }])
      task('03-verify', 'independent-review.json', [
        { kind: 'find', usage, error: null },
        { kind: 'check', usage, error: null },
      ])
      const arm = new RelayArm({ dir: root })
      expect(arm.reviewUsage()).toMatchObject({ calls: 4, done: 4, input: 4, cacheRead: 40 })
      expect(new RelayArm({ dir: path.join(root, 'none') }).reviewUsage()).toBeNull()
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('hands-off 규칙 어김', () => {
  const turn = (...actions) => ({ actions })
  it('inspect_diff, 변경 화면 누르기, 터미널의 git diff를 센다', () => {
    const v = handsOffViolations([
      turn({ do: 'click', label: 'button "승인"' }, { do: 'wait', seconds: 60 }),
      turn({ do: 'click', label: 'tab "변경"' }, { do: 'click', label: 'tab "전체 변경"' }),
      turn({ do: 'click', label: 'summary "src/invoice/total.js +5 −2"' }),
      // 증거 패널의 접힌 절은 변경 화면이 아니다
      turn({ do: 'click', label: 'summary "사람에게 보낸 까닭 7"' }),
      turn({ do: 'inspect_diff' }),
      turn({ do: 'type', text: '!git diff main' }, { do: 'type', text: 'git log -p -3' }),
      turn({ do: 'type', text: '좋아요, 끝내 주세요' }, { do: 'done', summary: 'x' }),
    ])
    expect(v).toEqual({ inspectDiff: 1, diffViews: 3, diffCommands: 2, total: 6 })
    expect(handsOffViolations([])).toEqual({
      inspectDiff: 0,
      diffViews: 0,
      diffCommands: 0,
      total: 0,
    })
  })
})
