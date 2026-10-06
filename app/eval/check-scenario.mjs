#!/usr/bin/env node
// 시나리오가 제대로 짜였는지 확인한다 (docs/eval.md 5절).
//   node eval/check-scenario.mjs 10            번호, id(10-invoice-rounding), 여럿(9,10) 또는 all
// 확인하는 것:
//   1. 기준 레포: npm test 통과, guard 시험 통과, guard가 아닌 숨긴 시험 실패
//   2. reference.patch(있으면): 숨긴 시험과 npm test 모두 통과
//   3. traps/*.patch(있으면): 숨긴 시험 하나 이상 실패
//   4. Work 둘을 잇는 시나리오(works)의 reference-<n>.patch(있으면): 그것만 적용하면 n번째 Work의 숨긴 시험과
//      npm test가 통과하고, 다른 Work의 guard가 아닌 숨긴 시험은 실패한다(Work마다 고칠 것이 갈린다)
//   5. teammate Work가 있으면(팀원 교대에서 도구가 앞 Work를 main에 머지한다) reference-1..n을 차례로 모두 적용해도
//      npm test와 모든 숨긴 시험이 통과한다(머지된 앞 Work가 뒤 Work의 시험을 깨지 않는다)
//   6. 숨긴 쟁점(설계 시나리오, relay I111): `{ name, issue }`는 시험 파일이 없고 판정 모델이 가르므로 여기서는 돌리지
//      않는다(위 1~3의 숨긴 시험에서 뺀다). 모양만 본다: issue 글이 있고 file이 없다, Work 하나짜리다. 범위 guard
//      `{ name, guard: true, scope: true }`는 기대 밖 파일이 없으면 통과다(위 1~3에서 guard로 돈다)
// 시나리오 폴더는 RELAY_EVAL_SCENARIOS가 있으면 그곳이다(봉인한 hold-out을 만들 때)
// 패치는 repo/를 뿌리로 한 git diff(a/src/..., b/src/...)다. 평가 도구는 repo/만 복사하므로 에이전트에게 보이지 않는다.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { judgeTree } from './lib/repo.mjs'
import { copyTree, isMain, run } from './lib/util.mjs'
import { isIssue } from './lib/issue-judge.mjs'
import { allChecks, multiWork, workParts } from './lib/works.mjs'

const SCENARIOS = process.env.RELAY_EVAL_SCENARIOS
  ? path.resolve(process.env.RELAY_EVAL_SCENARIOS)
  : path.join(import.meta.dirname, 'scenarios')

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
function prepare(dir, work, patches) {
  const tree = path.join(work, 'tree-src')
  copyTree(path.join(dir, 'repo'), tree)
  for (const patch of [patches].flat().filter(Boolean)) {
    // 임시 폴더가 다른 git 레포 안에 있으면 git apply가 그 레포 기준으로 경로를 풀어 조용히 건너뛴다
    const r = run('git', ['apply', '--whitespace=nowarn', patch], {
      cwd: tree,
      env: { ...process.env, GIT_CEILING_DIRECTORIES: path.dirname(tree) },
    })
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
    scenario: { ...scenario, checks: allChecks(scenario) },
    work: path.join(work, 'judge'),
  })
}

const mark = (ok) => (ok ? 'O' : 'X')

/** 숨긴 쟁점과 범위 guard의 모양 (relay I111). 문제 목록을 돌려준다 */
export function shapeProblems(scenario) {
  const problems = []
  for (const c of allChecks(scenario)) {
    if (isIssue(c)) {
      if (!c.issue.trim()) problems.push(`숨긴 쟁점의 issue가 비었음: ${c.name}`)
      if (c.file) problems.push(`숨긴 쟁점에 file이 있음(둘 중 하나만): ${c.name}`)
      if (c.guard || c.scope) problems.push(`숨긴 쟁점은 guard나 scope가 아님: ${c.name}`)
      if (c.ask !== undefined && typeof c.ask !== 'boolean')
        problems.push(`숨긴 쟁점의 ask는 true/false: ${c.name}`)
      if (multiWork(scenario))
        problems.push(`숨긴 쟁점은 Work 하나짜리 시나리오에만 둔다: ${c.name}`)
    } else if (c.scope) {
      if (!c.guard) problems.push(`범위 검사는 guard여야 함: ${c.name}`)
      if (c.file) problems.push(`범위 검사에 file이 있음: ${c.name}`)
    } else if (!c.file) {
      problems.push(`숨긴 시험에 file이 없음: ${c.name}`)
    }
  }
  return problems
}

function checkOne(id) {
  const dir = path.join(SCENARIOS, id)
  const scenario = JSON.parse(fs.readFileSync(path.join(dir, 'scenario.json'), 'utf8'))
  const work = fs.mkdtempSync(path.join(os.tmpdir(), `check-${id}-`))
  const problems = []
  const guard = new Map(allChecks(scenario).map((c) => [c.name, !!c.guard]))
  const names = allChecks(scenario).map((c) => c.name)
  // 숨긴 쟁점은 판정 모델이 가르므로 돌린 결과에서 뺀다 (relay I111)
  const ran = (j) => ({ ...j, checks: j.checks.filter((c) => !c.issue) })
  const issues = allChecks(scenario).filter(isIssue)
  const line = (label, j) =>
    `  ${label.padEnd(28)} npm test ${mark(j.repoTests.pass)}  ${j.checks.map((c) => `${c.name}${guard.get(c.name) ? '(guard)' : ''} ${mark(c.pass)}`).join(', ')}${issues.length ? `  (숨긴 쟁점 ${issues.length}개: 판정 모델)` : ''}`

  console.log(`== ${id}`)
  if (new Set(names).size !== names.length)
    problems.push(`숨긴 시험 이름이 겹침: ${names.join(', ')}`)
  problems.push(...shapeProblems(scenario))
  try {
    const base = ran(judge(dir, scenario, path.join(work, 'base')))
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
      const j = ran(judge(dir, scenario, path.join(work, 'reference'), ref))
      console.log(line('reference.patch', j))
      if (!j.files.length) problems.push('정답 패치를 적용했는데 바뀐 파일이 없음')
      if (!j.repoTests.pass) problems.push(`정답 패치에서 npm test 실패\n${j.repoTests.output}`)
      for (const c of j.checks)
        if (!c.pass) problems.push(`정답 패치에서 숨긴 시험 실패: ${c.name}\n${c.output}`)
      if (j.unrelated.length)
        problems.push(`정답 패치가 기대 밖 파일을 바꿈: ${j.unrelated.join(', ')}`)
    } else {
      console.log('  (reference.patch 없음)')
    }

    // Work마다의 정답 (works). 그 Work의 시험만 통과하고 다른 Work의 시험은 그대로 실패해야 한다
    const parts = workParts(scenario)
    if (parts.length > 1) {
      parts.forEach((w, n) => {
        const patch = path.join(dir, `reference-${n + 1}.patch`)
        if (!fs.existsSync(patch)) {
          console.log(`  (reference-${n + 1}.patch 없음)`)
          return
        }
        const j = judge(dir, scenario, path.join(work, `reference-${n + 1}`), patch)
        console.log(line(`reference-${n + 1}.patch`, j))
        const own = new Set((w.checks ?? []).map((c) => c.name))
        if (!j.files.length) problems.push(`Work ${n + 1} 정답 패치를 적용했는데 바뀐 파일이 없음`)
        if (!j.repoTests.pass)
          problems.push(`Work ${n + 1} 정답 패치에서 npm test 실패\n${j.repoTests.output}`)
        for (const c of j.checks) {
          if ((own.has(c.name) || guard.get(c.name)) && !c.pass)
            problems.push(`Work ${n + 1} 정답 패치에서 숨긴 시험 실패: ${c.name}\n${c.output}`)
          if (!own.has(c.name) && !guard.get(c.name) && c.pass)
            problems.push(
              `Work ${n + 1} 정답 패치만으로 다른 Work의 숨긴 시험이 통과함(Work끼리 갈리지 않음): ${c.name}`,
            )
        }
        if (j.unrelated.length)
          problems.push(`Work ${n + 1} 정답 패치가 기대 밖 파일을 바꿈: ${j.unrelated.join(', ')}`)
      })
    }

    // 팀원 교대가 있으면 정답을 차례로 모두 적용한 상태(머지된 main)에서도 모든 시험이 통과해야 한다
    if (parts.some((w) => w.teammate)) {
      const all = parts.map((_, n) => path.join(dir, `reference-${n + 1}.patch`))
      if (all.every((f) => fs.existsSync(f))) {
        const j = judge(dir, scenario, path.join(work, 'reference-all'), all)
        console.log(line('reference-1..n 차례로', j))
        if (!j.repoTests.pass)
          problems.push(`정답을 차례로 모두 적용하면 npm test 실패\n${j.repoTests.output}`)
        for (const c of j.checks)
          if (!c.pass)
            problems.push(`정답을 차례로 모두 적용하면 숨긴 시험 실패: ${c.name}\n${c.output}`)
      } else {
        problems.push('teammate Work가 있는데 reference-<n>.patch가 모두 있지는 않음')
      }
    }

    const trapsDir = path.join(dir, 'traps')
    const traps = fs.existsSync(trapsDir)
      ? fs
          .readdirSync(trapsDir)
          .filter((f) => f.endsWith('.patch'))
          .sort()
      : []
    for (const t of traps) {
      const j = ran(judge(dir, scenario, path.join(work, `trap-${t}`), path.join(trapsDir, t)))
      console.log(line(`traps/${t}`, j))
      if (!j.files.length) problems.push(`함정 패치를 적용했는데 바뀐 파일이 없음: ${t}`)
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

// 시험(app/eval/test)이 shapeProblems만 가져다 쓸 때는 돌리지 않는다
if (isMain(import.meta.url)) {
  const ids = pick(process.argv[2])
  const ok = ids.map(checkOne).every(Boolean)
  process.exit(ok ? 0 : 1)
}
