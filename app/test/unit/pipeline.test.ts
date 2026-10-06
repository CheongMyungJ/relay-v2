import { describe, expect, it } from 'vitest'
import handoffSchema from '../../src/shared/generated/handoff.v1.schema.json'
import {
  ALL_NODES,
  KEEP_CODE_NODES,
  NODE_INFO,
  PIPELINES,
  RESPOND,
  defaultNext,
  isPipelineNode,
  keepDefault,
  keepLabel,
  isPrevious,
  previousSteps,
  recommendableNodes,
  selectableNext,
  workType,
  stopsForRecommendation,
} from '../../src/core/pipeline'
import type { NodeName } from '../../src/shared/contracts'
import type { WorkType } from '../../src/shared/work'

describe('노드 (3.1)', () => {
  it('버그 수정은 intake → fix → verify, 기능 추가는 intake → design → implement → verify, 리팩터링은 intake → refactor → verify, 설계는 intake → spec → verify, 일반은 intake → execute → verify다 (D227, D232, D258, D302, D350)', () => {
    expect(PIPELINES).toEqual({
      bugfix: ['intake', 'fix', 'verify'],
      feature: ['intake', 'design', 'implement', 'verify'],
      refactor: ['intake', 'refactor', 'verify'],
      spec: ['intake', 'spec', 'verify'],
      general: ['intake', 'execute', 'verify'],
    })
  })

  it('모든 노드는 모든 파이프라인의 노드를 모은 것이고 스키마의 노드 열거값과 같다 (I57, I63, I85, I103)', () => {
    expect(ALL_NODES).toEqual([
      'intake',
      'fix',
      'design',
      'implement',
      'refactor',
      'spec',
      'execute',
      'verify',
    ])
    expect(new Set(Object.values(PIPELINES).flat())).toEqual(new Set(ALL_NODES))
    expect(ALL_NODES).toEqual(
      handoffSchema.properties.recommended_next.oneOf[1]?.properties?.node.enum,
    )
  })

  it('노드마다 스킬, 화면 이름(D109), 필수 산출물이 있다', () => {
    expect(
      ALL_NODES.map((n) => [n, NODE_INFO[n].skill, NODE_INFO[n].title, NODE_INFO[n].artifacts]),
    ).toEqual([
      ['intake', 'work-start', '의도 정리', ['intent.draft.md']],
      ['fix', 'fix', '원인 분석과 수정', ['fix.md']],
      ['design', 'design', '설계와 계획', ['design.md']],
      ['implement', 'implement', '구현', ['implement.md']],
      ['refactor', 'refactor', '계획과 리팩터링', ['refactor.md']],
      ['spec', 'spec', '설계 문답', ['spec.md']],
      ['execute', 'execute', '실행', ['execution.md']],
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
    expect(ALL_NODES).not.toContain(RESPOND)
    expect(isPipelineNode(RESPOND)).toBe(false)
    expect(ALL_NODES.every(isPipelineNode)).toBe(true)
  })

  it('노드마다 산출물이 겹치지 않는다', () => {
    const artifacts = ALL_NODES.flatMap((n) => NODE_INFO[n].artifacts)
    expect(new Set(artifacts).size).toBe(artifacts.length)
  })

  it('work.json에 type이 없으면 버그 수정이다 (D256, I58)', () => {
    expect(workType({})).toBe('bugfix')
    expect(workType({ type: 'feature' })).toBe('feature')
    expect(workType({ type: 'general' })).toBe('general')
    expect(workType({ type: 'spec' })).toBe('spec')
  })

  it('[현재 코드 위에서 이어서]는 버그 수정의 fix, 기능 추가의 design과 implement, 리팩터링의 refactor, 설계의 spec, 일반의 execute에서 준다 (6.2, D254, D278, D316, D365)', () => {
    expect(KEEP_CODE_NODES).toEqual({
      bugfix: ['fix'],
      feature: ['design', 'implement'],
      refactor: ['refactor'],
      spec: ['spec'],
      general: ['execute'],
    })
  })

  it('설계의 spec만 "현재 문서 위에서 이어서"이고 처음부터 체크되어 있다 (D365, I105)', () => {
    expect(keepLabel('spec', 'spec')).toBe('현재 문서 위에서 이어서')
    expect(keepDefault('spec', 'spec')).toBe(true)
    for (const [type, nodes] of Object.entries(KEEP_CODE_NODES) as [WorkType, NodeName[]][]) {
      for (const node of nodes.filter((n) => n !== 'spec')) {
        expect(keepLabel(type, node), `${type} ${node}`).toBe('현재 코드 위에서 이어서')
        expect(keepDefault(type, node), `${type} ${node}`).toBe(false)
      }
    }
    // 같은 노드라도 설계 Work가 아니면 아니다
    expect(keepDefault('bugfix', 'spec')).toBe(false)
    // 처음 체크되는 단계는 늘 [현재 코드 위에서 이어서]를 주는 단계다: 한 표(KEEP_CODE)에서 나온다 (PR #36 리뷰)
    for (const type of Object.keys(KEEP_CODE_NODES) as WorkType[]) {
      for (const node of [
        'intake',
        'fix',
        'design',
        'implement',
        'refactor',
        'spec',
        'execute',
        'verify',
      ] as const) {
        if (keepDefault(type, node))
          expect(KEEP_CODE_NODES[type], `${type} ${node}`).toContain(node)
      }
    }
  })
})

describe('선택 가능한 다음 단계 (3.2)', () => {
  // [유형, 노드, 기본 다음 단계, 이전 단계]
  const table: [WorkType, NodeName, string, NodeName[]][] = [
    ['bugfix', 'intake', 'fix', []],
    ['bugfix', 'fix', 'verify', ['intake']],
    ['bugfix', 'verify', 'complete', ['intake', 'fix']],
    ['feature', 'intake', 'design', []],
    ['feature', 'design', 'implement', ['intake']],
    ['feature', 'implement', 'verify', ['intake', 'design']],
    ['feature', 'verify', 'complete', ['intake', 'design', 'implement']],
    ['refactor', 'intake', 'refactor', []],
    ['refactor', 'refactor', 'verify', ['intake']],
    ['refactor', 'verify', 'complete', ['intake', 'refactor']],
    ['spec', 'intake', 'spec', []],
    ['spec', 'spec', 'verify', ['intake']],
    ['spec', 'verify', 'complete', ['intake', 'spec']],
    ['general', 'intake', 'execute', []],
    ['general', 'execute', 'verify', ['intake']],
    ['general', 'verify', 'complete', ['intake', 'execute']],
  ]

  it('파이프라인의 노드가 모두 표에 있다', () => {
    for (const type of ['bugfix', 'feature', 'refactor', 'spec', 'general'] as const) {
      expect(table.filter(([t]) => t === type).map(([, n]) => n)).toEqual(PIPELINES[type])
    }
  })

  it.each(table)('%s %s: 기본 다음 단계 %s, 이전 단계 %j', (type, node, next, previous) => {
    expect(selectableNext(type, node)).toEqual({ defaultNext: next, previous })
    expect(defaultNext(type, node)).toBe(next)
    expect(previousSteps(type, node)).toEqual(previous)
  })

  it('recommended_next로 쓸 수 있는 노드는 이전 단계와 노드인 기본 다음 단계다', () => {
    expect(recommendableNodes('bugfix', 'intake')).toEqual(['fix'])
    expect(recommendableNodes('bugfix', 'fix')).toEqual(['intake', 'verify'])
    expect(recommendableNodes('bugfix', 'verify')).toEqual(['intake', 'fix'])
    expect(recommendableNodes('feature', 'intake')).toEqual(['design'])
    expect(recommendableNodes('feature', 'design')).toEqual(['intake', 'implement'])
    expect(recommendableNodes('feature', 'implement')).toEqual(['intake', 'design', 'verify'])
    expect(recommendableNodes('feature', 'verify')).toEqual(['intake', 'design', 'implement'])
    expect(recommendableNodes('refactor', 'intake')).toEqual(['refactor'])
    expect(recommendableNodes('refactor', 'refactor')).toEqual(['intake', 'verify'])
    expect(recommendableNodes('refactor', 'verify')).toEqual(['intake', 'refactor'])
    expect(recommendableNodes('spec', 'intake')).toEqual(['spec'])
    expect(recommendableNodes('spec', 'spec')).toEqual(['intake', 'verify'])
    expect(recommendableNodes('spec', 'verify')).toEqual(['intake', 'spec'])
    expect(recommendableNodes('general', 'intake')).toEqual(['execute'])
    expect(recommendableNodes('general', 'execute')).toEqual(['intake', 'verify'])
    expect(recommendableNodes('general', 'verify')).toEqual(['intake', 'execute'])
  })

  it('PR 대응 task는 recommended_next로 쓸 수 있는 노드가 없다 (D188)', () => {
    expect(recommendableNodes('bugfix', 'respond')).toEqual([])
    expect(recommendableNodes('feature', 'respond')).toEqual([])
  })

  it('이전 단계 추천인지 가린다 (D23)', () => {
    expect(isPrevious('bugfix', 'verify', 'fix')).toBe(true)
    expect(isPrevious('bugfix', 'verify', 'intake')).toBe(true)
    expect(isPrevious('bugfix', 'verify', 'verify')).toBe(false)
    expect(isPrevious('bugfix', 'fix', 'intake')).toBe(true)
    expect(isPrevious('bugfix', 'fix', 'fix')).toBe(false)
    expect(isPrevious('bugfix', 'fix', 'verify')).toBe(false)
    expect(isPrevious('bugfix', 'intake', 'intake')).toBe(false)
    expect(isPrevious('bugfix', 'intake', 'fix')).toBe(false)
    expect(isPrevious('feature', 'verify', 'implement')).toBe(true)
    expect(isPrevious('feature', 'verify', 'design')).toBe(true)
    expect(isPrevious('feature', 'implement', 'design')).toBe(true)
    expect(isPrevious('feature', 'implement', 'verify')).toBe(false)
    expect(isPrevious('feature', 'design', 'implement')).toBe(false)
    // 그 유형의 파이프라인에 없는 단계는 이전 단계가 아니다
    expect(isPrevious('feature', 'verify', 'fix')).toBe(false)
    expect(isPrevious('bugfix', 'verify', 'design')).toBe(false)
    expect(isPrevious('refactor', 'verify', 'refactor')).toBe(true)
    expect(isPrevious('refactor', 'refactor', 'intake')).toBe(true)
    expect(isPrevious('refactor', 'verify', 'fix')).toBe(false)
    expect(isPrevious('general', 'verify', 'execute')).toBe(true)
    expect(isPrevious('general', 'execute', 'intake')).toBe(true)
    expect(isPrevious('general', 'verify', 'refactor')).toBe(false)
    expect(isPrevious('spec', 'verify', 'spec')).toBe(true)
    expect(isPrevious('spec', 'spec', 'intake')).toBe(true)
    expect(isPrevious('spec', 'verify', 'design')).toBe(false)
  })

  it('추천 때문에 멈추는지: 이전 단계이거나 이 유형의 파이프라인에 없는 노드다 (D23, PR #23 리뷰)', () => {
    expect(stopsForRecommendation('feature', 'verify', 'design')).toBe(true)
    // 형식 오류를 무시하고 승인해도 버그 수정 습관의 fix 추천을 Work 완료로 넘기지 않는다
    expect(stopsForRecommendation('feature', 'verify', 'fix')).toBe(true)
    expect(stopsForRecommendation('bugfix', 'verify', 'implement')).toBe(true)
    expect(stopsForRecommendation('refactor', 'verify', 'refactor')).toBe(true)
    expect(stopsForRecommendation('refactor', 'verify', 'implement')).toBe(true)
    expect(stopsForRecommendation('refactor', 'refactor', 'verify')).toBe(false)
    expect(stopsForRecommendation('general', 'verify', 'execute')).toBe(true)
    expect(stopsForRecommendation('general', 'verify', 'fix')).toBe(true)
    expect(stopsForRecommendation('general', 'execute', 'verify')).toBe(false)
    // 설계의 verify가 spec을 추천하면 멈춘다 (D363, D374)
    expect(stopsForRecommendation('spec', 'verify', 'spec')).toBe(true)
    expect(stopsForRecommendation('spec', 'verify', 'design')).toBe(true)
    expect(stopsForRecommendation('spec', 'spec', 'verify')).toBe(false)
    // 같은 단계를 다시 하자는 추천(형식 오류)도 [오류 무시하고 승인]으로 넘기지 않고 멈춘다
    expect(stopsForRecommendation('general', 'execute', 'execute')).toBe(true)
    expect(stopsForRecommendation('bugfix', 'verify', 'verify')).toBe(true)
    // 기본 다음 단계와 뒤 단계는 멈추지 않는다
    expect(stopsForRecommendation('feature', 'design', 'implement')).toBe(false)
    expect(stopsForRecommendation('feature', 'design', 'verify')).toBe(false)
    expect(stopsForRecommendation('bugfix', 'fix', 'verify')).toBe(false)
    // PR 대응 task는 추천이 없다
    expect(stopsForRecommendation('feature', 'respond', 'fix')).toBe(false)
    // PR 대응 task에는 앞 단계가 없다
    expect(isPrevious('bugfix', 'respond', 'intake')).toBe(false)
    expect(isPrevious('feature', 'respond', 'verify')).toBe(false)
  })
})
