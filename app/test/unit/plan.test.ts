// 구현 나눔으로 Work 만들기의 순수 함수 (core/plan, D393~D396)
import { describe, expect, it } from 'vitest'
import {
  ancestorsOf,
  parseSplit,
  planSection,
  sliceBlocked,
  sliceRequest,
  sliceStates,
  type PlanDoc,
  type SliceWork,
} from '../../src/core/plan'

const DOC = [
  '# 알림 설정',
  '',
  '## 결정',
  '',
  '| # | 결정 |',
  '|---|---|',
  '| N1 | 방해 금지 시간은 사용자 시간대로 계산한다 |',
  '',
  '## 구현 나눔',
  '',
  '조각마다 Work 하나.',
  '',
  '| 조각 | 이름 | 유형 | 먼저 | 목표 |',
  '|---|---|---|---|---|',
  '| s1 | 설정 저장 | 기능 추가 | | 종류별 켜고 끄기를 저장한다 |',
  '| s2 | 방해 금지 | 기능 추가 | s1 | 방해 금지 시간에는 보내지 않는다 |',
  '| `s3` | 수신 거부 | 일반 | s1, s2 | 링크로 끈다 |',
  '',
  '## 변경 이력',
  '',
  '| 날짜 | 내용 |',
  '|---|---|',
  '| 2026-10-13 | 처음 |',
].join('\n')

const work = (slice: string, over: Partial<SliceWork> = {}): SliceWork => ({
  workId: `w-${slice}`,
  doc: 'docs/notify.md',
  slice,
  status: 'active',
  merged: false,
  ...over,
})

function doc(): PlanDoc {
  const d = parseSplit('docs/notify.md', DOC)
  if (!d) throw new Error('표를 읽지 못함')
  return d
}

describe('parseSplit', () => {
  it('구현 나눔 절의 표를 칸 제목으로 읽는다. 다른 절의 표는 읽지 않는다', () => {
    const d = doc()
    expect(d.issues).toEqual([])
    expect(d.slices).toEqual([
      {
        id: 's1',
        name: '설정 저장',
        type: 'feature',
        after: [],
        goal: '종류별 켜고 끄기를 저장한다',
      },
      {
        id: 's2',
        name: '방해 금지',
        type: 'feature',
        after: ['s1'],
        goal: '방해 금지 시간에는 보내지 않는다',
      },
      { id: 's3', name: '수신 거부', type: 'general', after: ['s1', 's2'], goal: '링크로 끈다' },
    ])
  })

  it('절이나 표가 없거나 필수 칸이 없으면 null', () => {
    expect(parseSplit('a.md', '# 제목\n\n## 결정\n')).toBeNull()
    expect(parseSplit('a.md', '## 구현 나눔\n\n나중에 정한다\n')).toBeNull()
    expect(parseSplit('a.md', '## 구현 나눔\n\n| 이름 | 목표 |\n|---|---|\n| a | b |\n')).toBeNull()
  })

  it('칸 순서가 달라도, 유형 칸이 없어도 읽는다. 먼저의 "-"와 "없음"은 비어 있음이다', () => {
    const d = parseSplit(
      'a.md',
      '## 구현 나눔\n\n| 먼저 | 조각 | 이름 |\n|---|---|---|\n| - | a | 하나 |\n| 없음 | b | 둘 |\n',
    )
    expect(d?.slices.map((s) => [s.id, s.type, s.after])).toEqual([
      ['a', null, []],
      ['b', null, []],
    ])
  })

  it('없는 먼저, 겹친 조각, 알 수 없는 유형, 도는 먼저를 문제로 적는다', () => {
    const d = parseSplit(
      'a.md',
      [
        '## 구현 나눔',
        '',
        '| 조각 | 이름 | 유형 | 먼저 |',
        '|---|---|---|---|',
        '| a | 하나 | 버그 | b |',
        '| b | 둘 | 일반 | a |',
        '| a | 셋 | 일반 | |',
        '| c | 넷 | 일반 | z |',
      ].join('\n'),
    )
    expect(d?.issues).toEqual([
      '조각 `a`의 유형을 알 수 없음: 버그',
      '조각 `a`가 두 번 나옴',
      '조각 `c`의 먼저 `z`가 표에 없음',
      '먼저 칸이 돌고 돈다',
    ])
  })
})

describe('sliceStates', () => {
  it('맡은 Work가 없으면 먼저 조각이 모두 머지됐을 때만 시작할 수 있다', () => {
    const states = sliceStates(doc(), [])
    expect(states.map((s) => [s.slice.id, s.status, s.missing])).toEqual([
      ['s1', 'ready', []],
      ['s2', 'waiting', ['s1']],
      ['s3', 'waiting', ['s1', 's2']],
    ])
  })

  it('머지된 Work는 머지됨, 머지 전 Work는 진행 중, 포기한 Work와 다른 문서의 Work는 없는 것으로 본다', () => {
    const states = sliceStates(doc(), [
      work('s1', { merged: true, status: 'completed' }),
      work('s2', { status: 'pr' }),
      work('s3', { status: 'abandoned' }),
      work('s3', { workId: 'w-x', doc: 'docs/other.md' }),
    ])
    expect(states.map((s) => [s.slice.id, s.status, s.works])).toEqual([
      ['s1', 'merged', ['w-s1']],
      ['s2', 'active', ['w-s2']],
      ['s3', 'waiting', []],
    ])
  })

  it('시작할 수 없는 까닭: 기다림, 머지됨, 표의 문제. 진행 중인 조각은 다시 시작할 수 있다', () => {
    const d = doc()
    const states = sliceStates(d, [work('s1', { merged: true }), work('s2')])
    expect(sliceBlocked(d, states[0])).toBe('이미 머지된 조각입니다')
    expect(sliceBlocked(d, states[1])).toBeNull()
    expect(sliceBlocked(d, states[2])).toBe('먼저 머지돼야 하는 조각이 있습니다: s2')
    expect(sliceBlocked(d, undefined)).toBe('표에 없는 조각입니다')
    expect(sliceBlocked({ ...d, issues: ['x'] }, states[1])).toBe(
      '구현 나눔 표에 문제가 있습니다: x',
    )
  })
})

describe('sliceRequest', () => {
  it('문서 경로와 조각, 목표, 먼저 조각을 적는다 (intake가 제약으로 옮긴다, D369)', () => {
    expect(sliceRequest(doc(), 's3')).toBe(
      [
        '`docs/notify.md`의 설계를 따른다. 이번 Work는 그 문서의 구현 나눔 가운데 s3 「수신 거부」만 맡는다.',
        '',
        '목표: 링크로 끈다',
        '먼저 머지된 조각: s1 「설정 저장」, s2 「방해 금지」',
      ].join('\n'),
    )
    expect(sliceRequest(doc(), 'zz')).toBe('')
  })
})

describe('planSection', () => {
  it('조각 표와 상태, 앞 조각의 요약·완료조건, 뒤 조각을 넣는다', () => {
    const d = doc()
    const [title, body] = planSection({
      ref: { doc: 'docs/notify.md', slice: 's2' },
      doc: d,
      states: sliceStates(d, [work('s1', { merged: true }), work('s2')]),
      before: [
        {
          slice: 's1',
          workId: 'w-s1',
          merged: true,
          summary: '설정을 저장한다',
          criteria: '- 끈 종류는 보내지 않는다',
        },
      ],
    })
    expect(title).toBe('묶음 (구현 나눔)')
    expect(body).toContain('| s2 (이 Work) | 방해 금지 | s1 | 진행 중 |')
    expect(body).toContain('| s1 | 설정 저장 | - | 머지됨 |')
    expect(body).toContain('#### s1 「설정 저장」 — Work w-s1\n')
    expect(body).toContain('- 끈 종류는 보내지 않는다')
    expect(body).toContain('- s3 「수신 거부」: 링크로 끈다')
    expect(body).toContain('이 조각의 목표: 방해 금지 시간에는 보내지 않는다')
  })

  it('머지되지 않은 앞 조각은 그 코드가 없을 수 있다고 적고, 문서를 읽지 못하면 직접 읽으라고 한다', () => {
    const d = doc()
    const [, body] = planSection({
      ref: { doc: 'docs/notify.md', slice: 's3' },
      doc: d,
      states: sliceStates(d, []),
      before: [{ slice: 's2', workId: 'w-s2', merged: false, summary: null, criteria: null }],
    })
    expect(body).toContain('아직 머지되지 않음')
    expect(body).toContain('### 뒤 조각 (이 Work의 범위가 아님)\n\n없음')
    const [, missing] = planSection({
      ref: { doc: 'docs/x.md', slice: 's1' },
      doc: null,
      states: [],
      before: [],
    })
    expect(missing).toContain('읽지 못했다')
  })
})

describe('ancestorsOf', () => {
  it('먼저의 먼저까지 표의 차례로', () => {
    expect(ancestorsOf(doc(), 's3')).toEqual(['s1', 's2'])
    expect(ancestorsOf(doc(), 's1')).toEqual([])
  })
})
