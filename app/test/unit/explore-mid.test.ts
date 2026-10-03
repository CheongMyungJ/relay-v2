// 지식 탐색 12절: 평가 결과 폴더의 handoff로 Work 완료 화면의 지식 칸을 다시 계산해 견준다 (기존 항목 없이).
// RELAY_EXPLORE_MID=<결과 폴더>[,<결과 폴더>...] npx vitest run --project unit test/unit/explore-mid.test.ts
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { reviewKnowledge, type CandidateTask } from '../../src/core/knowledge'
import { defaultCandidateChoice } from '../../src/shared/knowledge'
import type { AnyHandoff } from '../../src/shared/contracts'
import type { TaskNode } from '../../src/shared/work'

const DIRS = (process.env['RELAY_EXPLORE_MID'] ?? '').split(',').filter(Boolean)

function tasksOf(workDir: string): CandidateTask[] {
  const dir = path.join(workDir, 'tasks')
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .sort()
    .flatMap((t) => {
      const f = path.join(dir, t, 'handoff.md')
      if (!fs.existsSync(f)) return []
      const m = /^---\n([\s\S]*?)\n---/.exec(fs.readFileSync(f, 'utf8'))
      if (!m) return []
      const header = parse(m[1] ?? '') as AnyHandoff
      const node = t.replace(/^\d+-/, '') as TaskNode
      return [{ taskId: `t-${t.slice(0, 2)}`, node, version: 2, header }]
    })
}

describe.skipIf(DIRS.length === 0)('지식 칸 다시 계산 (12절)', () => {
  it('Work마다 지식 칸', () => {
    const rows: string[] = []
    for (const root of DIRS) {
      for (const sc of fs
        .readdirSync(root)
        .filter((d) => /^2[1-6]-/.test(d))
        .sort()) {
        for (const arm of fs.readdirSync(path.join(root, sc)).filter((a) => /^relay-\d/.test(a))) {
          const works = path.join(root, sc, arm, 'works')
          if (!fs.existsSync(works)) continue
          for (const w of fs.readdirSync(works).sort()) {
            const tasks = tasksOf(path.join(works, w))
            const r = reviewKnowledge({
              tasks,
              pool: [],
              changed: [],
              share: true,
              dir: 'd/',
              offerPending: true,
            })
            const adopt = r.candidates.filter((c) => defaultCandidateChoice(c, true).adopt).length
            const verifyDecisions = tasks
              .filter((t) => t.node === 'verify' || t.node === 'respond')
              .flatMap((t) => (t.header?.decisions ?? []).filter((d) => d.by === 'human'))
              .filter((d) => !r.candidates.some((c) => c.decision === d.what.trim())).length
            const fb = tasks.reduce(
              (n, t) =>
                n +
                ((t.header as { knowledge_feedback?: unknown[] })?.knowledge_feedback?.length ?? 0),
              0,
            )
            const cf = tasks.reduce(
              (n, t) =>
                n +
                ((t.header as { knowledge_confirmed?: unknown[] })?.knowledge_confirmed?.length ??
                  0),
              0,
            )
            rows.push(
              [
                path.basename(root),
                sc,
                arm,
                w.slice(-3),
                r.candidates.length + r.feedback.length,
                adopt,
                r.candidates.length - adopt,
                r.candidates.filter((c) => c.workScoped).length,
                r.candidates.filter((c) => c.similarTo).length,
                verifyDecisions,
                fb,
                cf,
              ].join('\t'),
            )
          }
        }
      }
    }
    console.log(
      [
        '결과',
        '시나리오',
        '쪽',
        'Work',
        '칸',
        '기본채택',
        '접힘',
        '범위',
        '비슷',
        'verify결정(뺌)',
        '보고',
        '확인',
      ].join('\t'),
    )
    console.log(rows.join('\n'))
    expect(rows.length).toBeGreaterThan(0)
  })
})
