// report.mjs의 report.md: 커밋하는 기록이라 모델 이름을 적지 않는다. 이름은 도구 기록(config.json, report.json)에 남는다
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildReport } from '../report.mjs'

const dirs = []
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true })
})

describe('report.md의 모델', () => {
  it('설정의 모델 이름을 적지 않고 effort와 config.json은 그대로다', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-report-'))
    dirs.push(dir)
    const config = {
      agentModel: 'agent-model-x',
      effort: 'medium',
      humanModel: 'human-model-y',
      judgeModel: 'judge-model-z',
    }
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(config))
    const text = buildReport(dir)
    const md = fs.readFileSync(path.join(dir, 'report.md'), 'utf8')
    expect(md).toBe(text)
    for (const name of ['agent-model-x', 'human-model-y', 'judge-model-z'])
      expect(md).not.toContain(name)
    expect(md).toContain('- 에이전트·사람 역할·판정: 설정의 모델 (에이전트 effort medium)')
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'))).toEqual(config)
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8')).config).toEqual(
      config,
    )
  })
})
