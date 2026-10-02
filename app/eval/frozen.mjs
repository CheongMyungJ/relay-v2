#!/usr/bin/env node
// 지식 실험에서 고정한 파일의 해시 (docs/knowledge-experiment/protocol.md 8절). 지표의 정의, 사람 역할, 판정, 시나리오를
// 실험 중에 바꾸지 않았는지 확인한다.
//   node eval/frozen.mjs           확인 (바뀐 파일이 있으면 1로 끝남)
//   node eval/frozen.mjs --write   해시를 다시 적는다. 기록(log.md)에 까닭을 적은 고침에만 쓴다
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const LIST = path.join(import.meta.dirname, 'frozen.json')

/** 고정하는 파일과 폴더 (레포 뿌리 기준). 폴더는 안의 파일 모두 */
const FROZEN = [
  'docs/knowledge-experiment/protocol.md',
  'app/eval/primary.mjs',
  'app/eval/report.mjs',
  'app/eval/run.mjs',
  'app/eval/check-scenario.mjs',
  'app/eval/unseal.sh',
  'app/eval/lib/ai.mjs',
  'app/eval/lib/env.mjs',
  'app/eval/lib/episode.mjs',
  'app/eval/lib/human.mjs',
  'app/eval/lib/judge.mjs',
  'app/eval/lib/kind.mjs',
  'app/eval/lib/repo.mjs',
  'app/eval/lib/told.mjs',
  'app/eval/lib/util.mjs',
  'app/eval/lib/works.mjs',
  'app/eval/guides/base.md',
  'app/eval/guides/cli.md',
  'app/eval/sealed',
  'app/eval/scenarios/21-invoice-credit',
  'app/eval/scenarios/22-flaky-retry',
  'app/eval/scenarios/23-double-notify-digest',
  'app/eval/scenarios/24-invoice-credit-teammate',
]

function files(rel) {
  const abs = path.join(ROOT, rel)
  if (!fs.existsSync(abs)) return [rel]
  if (fs.statSync(abs).isFile()) return [rel]
  return fs
    .readdirSync(abs, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => path.relative(ROOT, path.join(d.parentPath ?? d.path, d.name)))
}

function hashes() {
  const out = {}
  for (const f of FROZEN.flatMap(files).sort()) {
    const abs = path.join(ROOT, f)
    out[f] = fs.existsSync(abs)
      ? crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex')
      : '(없음)'
  }
  return out
}

if (process.argv.includes('--write')) {
  fs.writeFileSync(LIST, `${JSON.stringify(hashes(), null, 2)}\n`)
  console.log(`적음: ${path.relative(ROOT, LIST)}`)
} else {
  const want = JSON.parse(fs.readFileSync(LIST, 'utf8'))
  const now = hashes()
  const changed = [...new Set([...Object.keys(want), ...Object.keys(now)])]
    .sort()
    .filter((f) => want[f] !== now[f])
  if (changed.length) {
    console.log(
      `고정 파일이 바뀜 (${changed.length}개):\n${changed.map((f) => `  ${f}`).join('\n')}`,
    )
    process.exit(1)
  }
  console.log(`고정 파일 ${Object.keys(now).length}개 그대로`)
}
