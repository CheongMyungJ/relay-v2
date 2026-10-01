import { describe, expect, it } from 'vitest'
import handoffSchema from '../../src/shared/generated/handoff.v1.schema.json'
import {
  NODE_INFO,
  NODES,
  RESPOND,
  defaultNext,
  isPipelineNode,
  isPrevious,
  previousSteps,
  recommendableNodes,
  selectableNext,
} from '../../src/core/pipeline'
import type { NodeName } from '../../src/shared/contracts'

describe('노드 (3.1)', () => {
  it('순서는 intake → fix → verify이고 스키마의 노드 열거값과 같다 (D227)', () => {
    expect(NODES).toEqual(['intake', 'fix', 'verify'])
    expect(NODES).toEqual(handoffSchema.properties.recommended_next.oneOf[1]?.properties?.node.enum)
  })

  it('노드마다 스킬, 화면 이름(D109), 필수 산출물이 있다', () => {
    expect(
      NODES.map((n) => [n, NODE_INFO[n].skill, NODE_INFO[n].title, NODE_INFO[n].artifacts]),
    ).toEqual([
      ['intake', 'work-start', '의도 정리', ['intent.draft.md']],
      ['fix', 'fix', '원인 분석과 수정', ['fix.md']],
      ['verify', 'verify', '리뷰와 검증', ['verification.md', 'pr.md']],
    ])
  })

  it('PR 대응(respond)은 파이프라인 밖이다 (D187, D188)', () => {
    expect(NODE_INFO[RESPOND]).toEqual({
      node: 'respond',
      skill: 'pr-respond',
      title: 'PR 대응',
      artifacts: ['response.md'],
    })
    expect(NODES).not.toContain(RESPOND)
    expect(isPipelineNode(RESPOND)).toBe(false)
    expect(NODES.every(isPipelineNode)).toBe(true)
  })

  it('노드마다 산출물이 겹치지 않는다', () => {
    const artifacts = NODES.flatMap((n) => NODE_INFO[n].artifacts)
    expect(new Set(artifacts).size).toBe(artifacts.length)
  })
})

describe('선택 가능한 다음 단계 (3.2)', () => {
  // [노드, 기본 다음 단계, 이전 단계]
  const table: [NodeName, string, NodeName[]][] = [
    ['intake', 'fix', []],
    ['fix', 'verify', ['intake']],
    ['verify', 'complete', ['intake', 'fix']],
  ]

  it('파이프라인의 노드가 모두 표에 있다', () => {
    expect(table.map(([n]) => n)).toEqual(NODES)
  })

  it.each(table)('%s: 기본 다음 단계 %s, 이전 단계 %j', (node, next, previous) => {
    expect(selectableNext(node)).toEqual({ defaultNext: next, previous })
    expect(defaultNext(node)).toBe(next)
    expect(previousSteps(node)).toEqual(previous)
  })

  it('verify의 기본 다음 단계는 Work 완료다', () => {
    expect(defaultNext('verify')).toBe('complete')
  })

  it('recommended_next로 쓸 수 있는 노드는 이전 단계와 노드인 기본 다음 단계다', () => {
    expect(recommendableNodes('intake')).toEqual(['fix'])
    expect(recommendableNodes('fix')).toEqual(['intake', 'verify'])
    expect(recommendableNodes('verify')).toEqual(['intake', 'fix'])
  })

  it('PR 대응 task는 recommended_next로 쓸 수 있는 노드가 없다 (D188)', () => {
    expect(recommendableNodes('respond')).toEqual([])
  })

  it('이전 단계 추천인지 가린다 (D23)', () => {
    expect(isPrevious('verify', 'fix')).toBe(true)
    expect(isPrevious('verify', 'intake')).toBe(true)
    expect(isPrevious('verify', 'verify')).toBe(false)
    expect(isPrevious('fix', 'intake')).toBe(true)
    expect(isPrevious('fix', 'fix')).toBe(false)
    expect(isPrevious('fix', 'verify')).toBe(false)
    expect(isPrevious('intake', 'intake')).toBe(false)
    expect(isPrevious('intake', 'fix')).toBe(false)
    // PR 대응 task에는 앞 단계가 없다
    expect(isPrevious('respond', 'intake')).toBe(false)
    expect(isPrevious('respond', 'verify')).toBe(false)
  })
})
