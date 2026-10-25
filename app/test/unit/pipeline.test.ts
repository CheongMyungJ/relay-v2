import { describe, expect, it } from 'vitest'
import handoffSchema from '../../src/shared/generated/handoff.v1.schema.json'
import {
  ALL_NODES,
  LEGACY_PIPELINES,
  NODE_INFO,
  PIPELINES,
  RESPOND,
  completesWork,
  defaultNext,
  finishesWork,
  isPipelineNode,
  legacyPipeline,
  nextStage,
  pipelineOf,
  stagesOf,
  workType,
} from '../../src/core/pipeline'
import type { NodeName } from '../../src/shared/contracts'
import type { WorkType } from '../../src/shared/work'

describe('노드 (3.1)', () => {
  it('버그 수정은 intake → fix, 기능 추가는 intake → design → implement, 리팩터링은 intake → refactor, 설계는 intake → spec, 일반은 intake → execute다. 마지막 단계가 마무리한다 (D227, D232, D258, D302, D350, D493)', () => {
    expect(PIPELINES).toEqual({
      bugfix: ['intake', 'fix'],
      feature: ['intake', 'design', 'implement'],
      refactor: ['intake', 'refactor'],
      spec: ['intake', 'spec'],
      general: ['intake', 'execute'],
      // 커스텀은 단계 수만큼 custom이 든다 (stagesOf, D447)
      custom: ['intake', 'custom'],
    })
  })

  it('옛 Work(pipeline: 2가 없음)는 끝에 verify가 있는 옛 파이프라인이다 (D501)', () => {
    for (const type of Object.keys(PIPELINES) as WorkType[]) {
      expect(LEGACY_PIPELINES[type]).toEqual([...PIPELINES[type], 'verify'])
      expect(pipelineOf({ type })).toEqual(LEGACY_PIPELINES[type])
      expect(pipelineOf({ type, pipeline: 2 })).toEqual(PIPELINES[type])
    }
    expect(legacyPipeline({})).toBe(true)
    expect(legacyPipeline({ pipeline: 2 })).toBe(false)
  })

  it('모든 노드는 모든 파이프라인의 노드를 모은 것이고, 커스텀 단계를 빼면 스키마의 노드 열거값과 같다 (I57, I63, I85, I103, D462)', () => {
    expect(ALL_NODES).toEqual([
      'intake',
      'fix',
      'design',
      'implement',
      'refactor',
      'spec',
      'execute',
      'custom',
      'verify',
    ])
    expect(new Set(Object.values(LEGACY_PIPELINES).flat())).toEqual(new Set(ALL_NODES))
    // D418 전 형식의 recommended_next는 스키마에 남아 옛 handoff가 통과한다 (D422). 커스텀 단계는 그 뒤에 생겨 없다
    expect(ALL_NODES.filter((n) => n !== 'custom')).toEqual(
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
      ['custom', 'custom', '커스텀 단계', []],
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
})

describe('다음 단계 (3.2)', () => {
  // 파이프라인은 앞으로만 간다: 기본 다음 단계뿐이다 (D418). [유형, 노드, 기본 다음 단계]
  const table: [WorkType, NodeName, string][] = [
    ['bugfix', 'intake', 'fix'],
    ['bugfix', 'fix', 'complete'],
    ['feature', 'intake', 'design'],
    ['feature', 'design', 'implement'],
    ['feature', 'implement', 'complete'],
    ['refactor', 'intake', 'refactor'],
    ['refactor', 'refactor', 'complete'],
    ['spec', 'intake', 'spec'],
    ['spec', 'spec', 'complete'],
    ['general', 'intake', 'execute'],
    ['general', 'execute', 'complete'],
  ]

  it('파이프라인의 노드가 모두 표에 있다', () => {
    for (const type of ['bugfix', 'feature', 'refactor', 'spec', 'general'] as const) {
      expect(table.filter(([t]) => t === type).map(([, n]) => n)).toEqual(PIPELINES[type])
    }
  })

  it.each(table)('%s %s: 기본 다음 단계 %s', (type, node, next) => {
    expect(defaultNext(type, node)).toBe(next)
  })

  it('그 유형의 파이프라인에 없는 노드는 다음 단계가 없어 Work 완료로 본다', () => {
    expect(defaultNext('bugfix', 'design')).toBe('complete')
    expect(defaultNext('feature', 'fix')).toBe('complete')
  })

  it('옛 Work는 마지막 작업 단계 다음이 verify이고 verify 다음이 Work 완료다 (D501)', () => {
    expect(nextStage({ type: 'bugfix' }, { node: 'fix' })).toEqual({ node: 'verify' })
    expect(nextStage({ type: 'bugfix' }, { node: 'verify' })).toBe('complete')
    expect(nextStage({ type: 'feature', pipeline: 2 }, { node: 'implement' })).toBe('complete')
  })
})

describe('Work 완료 task와 마무리 단계 (D493, D501)', () => {
  const v2 = { pipeline: 2 as const }
  it('새 Work는 마지막 작업 단계가 Work 완료 task이자 마무리 단계다', () => {
    expect(completesWork({ type: 'bugfix', ...v2 }, { node: 'fix' })).toBe(true)
    expect(finishesWork({ type: 'bugfix', ...v2 }, { node: 'fix' })).toBe(true)
    expect(finishesWork({ type: 'feature', ...v2 }, { node: 'design' })).toBe(false)
    expect(finishesWork({ type: 'feature', ...v2 }, { node: 'implement' })).toBe(true)
    expect(finishesWork({ type: 'spec', ...v2 }, { node: 'spec' })).toBe(true)
    // intake와 PR 대응은 아니다
    expect(completesWork({ type: 'bugfix', ...v2 }, { node: 'intake' })).toBe(false)
    expect(completesWork({ type: 'bugfix', ...v2 }, { node: 'respond' })).toBe(false)
  })

  it('옛 Work는 verify가 Work 완료 task이고 마무리 단계는 없다', () => {
    expect(completesWork({ type: 'bugfix' }, { node: 'fix' })).toBe(false)
    expect(completesWork({ type: 'bugfix' }, { node: 'verify' })).toBe(true)
    expect(finishesWork({ type: 'bugfix' }, { node: 'verify' })).toBe(false)
    expect(finishesWork({ type: 'bugfix' }, { node: 'fix' })).toBe(false)
  })

  it('커스텀 유형은 마지막 커스텀 단계가 마무리하고, 단계가 없는 깨진 기록은 verify로 간다 (D447, D458)', () => {
    const custom_type = {
      id: 'survey-apply',
      name: '조사 후 적용',
      description: '',
      source: 'global' as const,
      hash: 'h',
      steps: [
        { id: 'survey', title: '조사', sections: [], auto_approve: false },
        { id: 'apply', title: '적용', sections: [], auto_approve: true },
      ],
    }
    const work = { type: 'custom' as const, custom_type, ...v2 }
    expect(stagesOf(work).map((s) => s.step ?? s.node)).toEqual(['intake', 'survey', 'apply'])
    expect(finishesWork(work, { node: 'custom', step: 'survey' })).toBe(false)
    expect(finishesWork(work, { node: 'custom', step: 'apply' })).toBe(true)
    expect(stagesOf({ type: 'custom', ...v2 }).map((s) => s.node)).toEqual(['intake', 'verify'])
    expect(nextStage(work, { node: 'custom', step: 'gone' })).toEqual({ node: 'verify' })
  })
})
