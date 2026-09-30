#!/usr/bin/env node
// 시나리오가 제대로 짜였는지 확인한다 (docs/eval.md 5절).
//   node eval/check-scenario.mjs 10            번호, id(10-invoice-rounding), 여럿(9,10) 또는 all
// 확인하는 것:
//   1. 기준 레포: npm test 통과, guard 시험 통과, guard가 아닌 숨긴 시험 실패
//   2. reference.patch(있으면): 숨긴 시험과 npm test 모두 통과
//   3. traps/*.patch(있으면): 숨긴 시험 하나 이상 실패
// 패치는 repo/를 뿌리로 한 git diff(a/src/..., b/src/...)다. 평가 도구는 repo/만 복사하므로 에이전트에게 보이지 않는다.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { judgeTree } from './lib/repo.mjs'
import { copyTree, run } from './lib/util.mjs'

const SCENARIOS = path.join(import.meta.dirname, 'scenarios')

function pick(spec) {
  const all = fs
    .readdirSync(SCENARIOS)
    .filter((d) => fs.existsSync(path.join(SCENARIOS, d, 'scenario.json')))
    .sort()
  if (!spec || spec === 'all') return all
  return spec.split(/[\s,]+/).map((x) => {
    const id = /^\d+$/.test(x)
      ? all.find((d) => Number(d.split('-')[0]) === Number(x))
      : all.find((d) => d === x || d.endsWith(`-${x}`))
    if (!id) throw new Error(`시나리오를 찾지 못함: ${x}`)
    return id
  })
}

/** repo/를 복사하고 패치를 적용한 폴더. 패치가 없으면 기준 그대로 */
function prepare(dir, work, patch) {
  const tree = path.join(work, 'tree-src')
  copyTree(path.join(dir, 'repo'), tree)
  if (patch) {
    const r = run('git', ['apply', '--whitespace=nowarn', patch], { cwd: tree })
    if (r.code !== 0) throw new Error(`패치 적용 실패 ${path.basename(patch)}: ${r.out.trim()}`)
  }
  return tree
}

function judge(dir, scenario, work, patch) {
  const tree = prepare(dir, work, patch)
  return judgeTree({
    tree,
    baseDir: path.join(dir, 'repo'),
    hiddenDir: path.join(dir, 'hidden'),
    scenario,
    work: path.join(work, 'judge'),
  })
}

const mark = (ok) => (ok ? 'O' : 'X')

function checkOne(id) {
  const dir = path.join(SCENARIOS, id)
  const scenario = JSON.parse(fs.readFileSync(path.join(dir, 'scenario.json'), 'utf8'))
  const work = fs.mkdtempSync(path.join(os.tmpdir(), `check-${id}-`))
  const problems = []
  const guard = new Map((scenario.checks ?? []).map((c) => [c.name, !!c.guard]))
  const line = (label, j) =>
    `  ${label.padEnd(28)} npm test ${mark(j.repoTests.pass)}  ${j.checks.map((c) => `${c.name}${guard.get(c.name) ? '(guard)' : ''} ${mark(c.pass)}`).join(', ')}`

  console.log(`== ${id}`)
  try {
    const base = judge(dir, scenario, path.join(work, 'base'))
    console.log(line('기준', base))
    if (!base.repoTests.pass) problems.push(`기준에서 npm test 실패\n${base.repoTests.output}`)
    for (const c of base.checks) {
      if (guard.get(c.name) && !c.pass)
        problems.push(`기준에서 guard 시험 실패: ${c.name}\n${c.output}`)
      if (!guard.get(c.name) && c.pass)
        problems.push(`기준에서 통과하는 숨긴 시험(버그를 못 잡음): ${c.name}`)
    }

    const ref = path.join(dir, 'reference.patch')
    if (fs.existsSync(ref)) {
      const j = judge(dir, scenario, path.join(work, 'reference'), ref)
      console.log(line('reference.patch', j))
      if (!j.repoTests.pass) problems.push(`정답 패치에서 npm test 실패\n${j.repoTests.output}`)
      for (const c of j.checks)
        if (!c.pass) problems.push(`정답 패치에서 숨긴 시험 실패: ${c.name}\n${c.output}`)
      if (j.unrelated.length)
        problems.push(`정답 패치가 기대 밖 파일을 바꿈: ${j.unrelated.join(', ')}`)
    } else {
      console.log('  (reference.patch 없음)')
    }

    const trapsDir = path.join(dir, 'traps')
    const traps = fs.existsSync(trapsDir)
      ? fs
          .readdirSync(trapsDir)
          .filter((f) => f.endsWith('.patch'))
          .sort()
      : []
    for (const t of traps) {
      const j = judge(dir, scenario, path.join(work, `trap-${t}`), path.join(trapsDir, t))
      console.log(line(`traps/${t}`, j))
      if (j.checks.every((c) => c.pass)) problems.push(`함정 패치가 숨긴 시험을 모두 통과함: ${t}`)
    }
  } catch (e) {
    problems.push(String(e.message ?? e))
  } finally {
    fs.rmSync(work, { recursive: true, force: true })
  }
  for (const p of problems) console.log(`  문제: ${p.split('\n').slice(0, 30).join('\n    ')}`)
  console.log(problems.length ? `  => 문제 ${problems.length}개` : '  => 이상 없음')
  return problems.length === 0
}

const ids = pick(process.argv[2])
const ok = ids.map(checkOne).every(Boolean)
process.exit(ok ? 0 : 1)
