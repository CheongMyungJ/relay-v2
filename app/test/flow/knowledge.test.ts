// 지식 관리의 켜고 끔 (K1, 규약 2.2): 켜면 intake의 context.md에 레포의 지식이 들어가고 넣은 기록이 남는다. RELAY_KNOWLEDGE=off면
// 지식 절도 기록도 없다
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { harness, makeRepo, register, type Harness } from './harness'
import { REPO_FILES, REQUEST, type Scenario } from './scenarios'

let h: Harness | undefined
afterEach(async () => {
  await h?.close()
  h = undefined
})
const wait: Scenario = { tasks: { 'work-start': [{ do: 'prompt' }, { do: 'wait' }] } }

async function intakeDir(env: Record<string, string>) {
  const hh = await harness({ scenario: wait, env })
  h = hh
  const { repo } = makeRepo(hh.root, 'knowledge', {
    ...REPO_FILES,
    'docs/knowledge/vat-per-line.md': '# 부가세는 품목 줄마다 원 단위 버림\n',
  })
  const projectId = await register(hh, repo)
  const r = await hh.relay.createWork(projectId, {
    request: REQUEST,
    baseBranch: 'main',
    type: 'bugfix',
    baseLocation: 'local',
  })
  if (!r.ok) throw new Error(r.error)
  await hh.ui.until(
    () => hh.records().some((x) => x['type'] === 'hook' && x['event'] === 'UserPromptSubmit'),
    '첫 프롬프트',
  )
  const workId = r.workKey.split('/')[1] ?? ''
  return path.join(hh.home, 'projects', projectId, 'works', workId, 'tasks', '01-intake')
}

describe('[흐름] 지식 켜고 끔', () => {
  it('켜면 레포의 지식을 context.md에 넣고 넣은 기록을 남긴다', async () => {
    const dir = await intakeDir({})
    const context = fs.readFileSync(path.join(dir, 'context.md'), 'utf8')
    expect(context).toContain('## 팀 지식')
    expect(context).toContain('# 부가세는 품목 줄마다 원 단위 버림')
    expect(fs.readFileSync(path.join(dir, 'knowledge-injected.md'), 'utf8')).toContain(
      'docs/knowledge/vat-per-line.md',
    )
  })

  it('RELAY_KNOWLEDGE=off면 지식 절도 넣은 기록도 없다', async () => {
    const dir = await intakeDir({ RELAY_KNOWLEDGE: 'off' })
    const context = fs.readFileSync(path.join(dir, 'context.md'), 'utf8')
    expect(context).not.toContain('지식')
    expect(context).not.toContain('docs/knowledge')
    expect(fs.existsSync(path.join(dir, 'knowledge-injected.md'))).toBe(false)
  })
})
