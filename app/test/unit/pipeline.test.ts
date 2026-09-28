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
  steps,
} from '../../src/core/pipeline'
import type { NodeName } from '../../src/shared/contracts'

describe('노드 (3.1)', () => {
  it('순서는 intake → investigate → evidence → rca → fix → verify이고 스키마의 노드 열거값과 같다', () => {
    expect(NODES).toEqual(['intake', 'investigate', 'evidence', 'rca', 'fix', 'verify'])
    expect(NODES).toEqual(handoffSchema.properties.recommended_next.oneOf[1]?.properties?.node.enum)
  })

  it('노드마다 스킬, 화면 이름(D109), 필수 산출물이 있다', () => {
    expect(
      NODES.map((n) => [n, NODE_INFO[n].skill, NODE_INFO[n].title, NODE_INFO[n].artifacts]),
    ).toEqual([
      ['intake', 'work-start', '의도 정리', ['intent.draft.md']],
      ['investigate', 'investigate', '재현과 원인 분석', ['evidence.md', 'rca.md']],
      ['evidence', 'evidence', '재현과 관찰', ['evidence.md']],
      ['rca', 'root-cause', '원인 분석', ['rca.md']],
      ['fix', 'fix', '수정', ['fix.md']],
      ['verify', 'final-verify', '최종 검증', ['verification.md', 'pr.md']],
    ])
  })
})

describe('경로 (3.4)', () => {
  it('L은 evidence와 rca를 따로 지난다', () => {
    expect(route('L')).toEqual(['intake', 'evidence', 'rca', 'fix', 'verify'])
  })

  it('M은 evidence와 rca 대신 investigate 하나를 지난다 (D147)', () => {
    expect(route('M')).toEqual(['intake', 'investigate', 'fix', 'verify'])
  })

  it('S는 조사 단계를 건너뛴다', () => {
    expect(route('S')).toEqual(['intake', 'fix', 'verify'])
  })

  it('고를 수 있는 단계: S와 M은 investigate, L은 evidence와 rca (D149)', () => {
    expect(steps('S')).toEqual(['intake', 'investigate', 'fix', 'verify'])
    expect(steps('M')).toEqual(['intake', 'investigate', 'fix', 'verify'])
    expect(steps('L')).toEqual(['intake', 'evidence', 'rca', 'fix', 'verify'])
    // 같은 산출물을 쓰는 단계가 한 크기에 함께 있지 않다
    for (const size of ['S', 'M', 'L'] as const) {
      const artifacts = steps(size).flatMap((n) => NODE_INFO[n].artifacts)
      expect(new Set(artifacts).size).toBe(artifacts.length)
    }
  })
})

describe('선택 가능한 다음 단계 (3.2)', () => {
  // [노드, 기본 다음 단계, 이전 단계]
  const L: [NodeName, string, NodeName[]][] = [
    ['intake', 'evidence', []],
    ['evidence', 'rca', ['intake']],
    ['rca', 'fix', ['intake', 'evidence']],
    ['fix', 'verify', ['intake', 'evidence', 'rca']],
    ['verify', 'complete', ['intake', 'evidence', 'rca', 'fix']],
  ]
  const M: [NodeName, string, NodeName[]][] = [
    ['intake', 'investigate', []],
    ['investigate', 'fix', ['intake']],
    ['fix', 'verify', ['intake', 'investigate']],
    ['verify', 'complete', ['intake', 'investigate', 'fix']],
  ]
  // 이전 단계에는 S 경로에서 건너뛴 investigate도 들어간다 (D66, D149)
  const S: [NodeName, string, NodeName[]][] = [
    ['intake', 'fix', []],
    ['fix', 'verify', ['intake', 'investigate']],
    ['verify', 'complete', ['intake', 'investigate', 'fix']],
  ]

  it('경로의 노드가 모두 표에 있다', () => {
    expect(L.map(([n]) => n)).toEqual(route('L'))
    expect(M.map(([n]) => n)).toEqual(route('M'))
    expect(S.map(([n]) => n)).toEqual(route('S'))
  })

  it.each(L)('L 경로 %s: 기본 다음 단계 %s, 이전 단계 %j', (node, next, previous) => {
    expect(selectableNext(node, 'L')).toEqual({ defaultNext: next, previous })
  })

  it.each(M)('M 경로 %s: 기본 다음 단계 %s, 이전 단계 %j', (node, next, previous) => {
    expect(selectableNext(node, 'M')).toEqual({ defaultNext: next, previous })
  })

  it.each(S)('S 경로 %s: 기본 다음 단계 %s, 이전 단계 %j', (node, next, previous) => {
    expect(selectableNext(node, 'S')).toEqual({ defaultNext: next, previous })
  })

  it('S Work가 되돌아가 지난 investigate의 기본 다음 단계는 fix다 (D66)', () => {
    expect(selectableNext('investigate', 'S')).toEqual({ defaultNext: 'fix', previous: ['intake'] })
  })

  it('verify의 기본 다음 단계는 Work 완료다', () => {
    expect(defaultNext('verify', 'L')).toBe('complete')
    expect(defaultNext('verify', 'M')).toBe('complete')
    expect(defaultNext('verify', 'S')).toBe('complete')
  })

  it('이전 단계는 그 크기가 고를 수 있는 단계만이다 (D149)', () => {
    expect(previousSteps('fix', 'L')).toEqual(['intake', 'evidence', 'rca'])
    expect(previousSteps('fix', 'M')).toEqual(['intake', 'investigate'])
    expect(previousSteps('fix', 'S')).toEqual(['intake', 'investigate'])
  })

  it('recommended_next로 쓸 수 있는 노드는 이전 단계와 노드인 기본 다음 단계다', () => {
    expect(recommendableNodes('rca', 'L')).toEqual(['intake', 'evidence', 'fix'])
    expect(recommendableNodes('investigate', 'M')).toEqual(['intake', 'fix'])
    expect(recommendableNodes('fix', 'M')).toEqual(['intake', 'investigate', 'verify'])
    expect(recommendableNodes('fix', 'S')).toEqual(['intake', 'investigate', 'verify'])
    expect(recommendableNodes('verify', 'L')).toEqual(['intake', 'evidence', 'rca', 'fix'])
    expect(recommendableNodes('intake', 'S')).toEqual(['fix'])
  })

  it('이전 단계 추천인지 가린다 (D23)', () => {
    expect(isPrevious('verify', 'fix')).toBe(true)
    expect(isPrevious('fix', 'rca')).toBe(true)
    expect(isPrevious('fix', 'investigate')).toBe(true)
    expect(isPrevious('investigate', 'intake')).toBe(true)
    expect(isPrevious('rca', 'rca')).toBe(false)
    expect(isPrevious('rca', 'fix')).toBe(false)
  })
})
