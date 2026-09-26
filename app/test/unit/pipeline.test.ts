import { describe, expect, it } from 'vitest'
import handoffSchema from '../../src/shared/generated/handoff.v1.schema.json'
import {
  NODE_INFO,
  NODES,
  defaultNext,
  isPrevious,
  previousSteps,
  recommendableNodes,
  route,
  selectableNext,
} from '../../src/core/pipeline'
import type { NodeName } from '../../src/shared/contracts'

describe('노드 (3.1)', () => {
  it('순서는 intake → evidence → rca → fix → verify이고 스키마의 노드 열거값과 같다', () => {
    expect(NODES).toEqual(['intake', 'evidence', 'rca', 'fix', 'verify'])
    expect(NODES).toEqual(handoffSchema.properties.recommended_next.oneOf[1]?.properties?.node.enum)
  })

  it('노드마다 스킬, 화면 이름(D109), 필수 산출물이 있다', () => {
    expect(
      NODES.map((n) => [n, NODE_INFO[n].skill, NODE_INFO[n].title, NODE_INFO[n].artifacts]),
    ).toEqual([
      ['intake', 'work-start', '의도 정리', ['intent.draft.md']],
      ['evidence', 'evidence', '재현과 관찰', ['evidence.md']],
      ['rca', 'root-cause', '원인 분석', ['rca.md']],
      ['fix', 'fix', '수정', ['fix.md']],
      ['verify', 'final-verify', '최종 검증', ['verification.md', 'pr.md']],
    ])
  })
})

describe('경로 (3.4)', () => {
  it('M과 L은 모든 노드를 지난다', () => {
    expect(route('M')).toEqual(['intake', 'evidence', 'rca', 'fix', 'verify'])
    expect(route('L')).toEqual(route('M'))
  })

  it('S는 evidence와 rca를 건너뛴다', () => {
    expect(route('S')).toEqual(['intake', 'fix', 'verify'])
  })
})

describe('선택 가능한 다음 단계 (3.2)', () => {
  // [노드, 기본 다음 단계, 이전 단계]
  const M: [NodeName, string, NodeName[]][] = [
    ['intake', 'evidence', []],
    ['evidence', 'rca', ['intake']],
    ['rca', 'fix', ['intake', 'evidence']],
    ['fix', 'verify', ['intake', 'evidence', 'rca']],
    ['verify', 'complete', ['intake', 'evidence', 'rca', 'fix']],
  ]
  // 이전 단계에는 S 경로에서 건너뛴 evidence와 rca도 들어간다.
  const S: [NodeName, string, NodeName[]][] = [
    ['intake', 'fix', []],
    ['fix', 'verify', ['intake', 'evidence', 'rca']],
    ['verify', 'complete', ['intake', 'evidence', 'rca', 'fix']],
  ]

  it('M 경로의 노드가 모두 표에 있다', () => {
    expect(M.map(([n]) => n)).toEqual(route('M'))
    expect(S.map(([n]) => n)).toEqual(route('S'))
  })

  it.each(M)('M 경로 %s: 기본 다음 단계 %s, 이전 단계 %j', (node, next, previous) => {
    expect(selectableNext(node, 'M')).toEqual({ defaultNext: next, previous })
    expect(selectableNext(node, 'L')).toEqual({ defaultNext: next, previous })
  })

  it.each(S)('S 경로 %s: 기본 다음 단계 %s, 이전 단계 %j', (node, next, previous) => {
    expect(selectableNext(node, 'S')).toEqual({ defaultNext: next, previous })
  })

  it('verify의 기본 다음 단계는 Work 완료다', () => {
    expect(defaultNext('verify', 'M')).toBe('complete')
    expect(defaultNext('verify', 'S')).toBe('complete')
  })

  it('이전 단계는 크기와 관계없다', () => {
    expect(previousSteps('fix')).toEqual(['intake', 'evidence', 'rca'])
  })

  it('recommended_next로 쓸 수 있는 노드는 이전 단계와 노드인 기본 다음 단계다', () => {
    expect(recommendableNodes('rca', 'M')).toEqual(['intake', 'evidence', 'fix'])
    expect(recommendableNodes('fix', 'S')).toEqual(['intake', 'evidence', 'rca', 'verify'])
    expect(recommendableNodes('verify', 'M')).toEqual(['intake', 'evidence', 'rca', 'fix'])
    expect(recommendableNodes('intake', 'S')).toEqual(['fix'])
  })

  it('이전 단계 추천인지 가린다 (D23)', () => {
    expect(isPrevious('verify', 'fix')).toBe(true)
    expect(isPrevious('fix', 'rca')).toBe(true)
    expect(isPrevious('rca', 'rca')).toBe(false)
    expect(isPrevious('rca', 'fix')).toBe(false)
  })
})
