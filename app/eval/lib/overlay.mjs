// 품질 기준 덧씌우기(run.mjs --quality-overlay, relay-v3 docs/experiments/m2/protocol.md 7절). 모든 쪽의 평가 레포 첫 커밋에
// relay-v3 `relay init` 초안의 .relay/quality.json을 넣는다. v3는 레포의 품질 기준으로 증거를 재므로 이것이 없으면 증거가
// 비고 관문이 늘 사람 머지다. 초안은 레포의 파일로만 정해져(결정론적) 시나리오마다 한 번 만들어 모든 쪽·회차에 같게 넣는다.
// 판정의 기준(시나리오의 repo/)에도 같은 파일을 얹어 덧씌운 파일이 diff에 나오지 않게 한다(baseWithOverlay). 숨긴 시험과
// check-scenario.mjs에는 넣지 않는다(시나리오 정의는 그대로)
import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { cleanEnv } from './env.mjs'
import { copyTree, git } from './util.mjs'

/** 덧씌우는 파일 (relay-v3 engine/check.ts QUALITY_PATH) */
export const QUALITY_FILE = '.relay/quality.json'

/** relay-v3 체크아웃의 명령줄 진입점(node로 바로 돈다) */
export const relay3Cli = (appDir) => path.join(appDir, 'src/cli/main.ts')

export const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex')

/**
 * 시나리오 레포(srcDir)에서 relay-v3 `relay init`(쓰지 않고 출력만)이 내는 초안. init은 git이 아는 파일과 package.json으로
 * 초안을 정하므로 work 아래에 makeRepo와 같은 복사(copyTree)로 git 레포를 만들어 돌린다. 출력은 `relay init --write`가 쓸
 * 글 그대로다(끝 줄바꿈 포함)
 * @param {string} srcDir 시나리오의 repo/
 * @param {string} cli relay-v3의 src/cli/main.ts(relay3Cli). 시험은 가짜를 준다
 * @param {string} work 임시 폴더(끝나면 지운다)
 * @returns {{ path: string, text: string, sha256: string }}
 */
export function qualityOverlay(srcDir, cli, work) {
  // 시나리오가 자기 품질 기준을 가지면 덮어쓰지 않는다. 그런 시나리오가 생기면 어느 쪽을 쓸지 정하고 고친다
  if (fs.existsSync(path.join(srcDir, QUALITY_FILE)))
    throw new Error(`시나리오 레포에 이미 ${QUALITY_FILE}이 있습니다: ${srcDir}`)
  const repo = path.join(work, 'repo')
  copyTree(srcDir, repo)
  try {
    git(repo, 'init', '-q', '-b', 'main')
    let text
    try {
      text = execFileSync(process.execPath, [cli, 'init'], {
        cwd: repo,
        env: cleanEnv(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 60_000,
      })
    } catch (e) {
      const why = String(e?.stderr || e?.message || e)
        .trim()
        .split('\n')
        .slice(-3)
        .join(' / ')
      throw new Error(`품질 기준 초안을 만들지 못했습니다(${cli} init): ${why}`, { cause: e })
    }
    try {
      JSON.parse(text)
    } catch (e) {
      throw new Error(`품질 기준 초안이 JSON이 아닙니다(${cli} init): ${text.slice(0, 200)}`, {
        cause: e,
      })
    }
    return { path: QUALITY_FILE, text, sha256: sha256(text) }
  } finally {
    fs.rmSync(work, { recursive: true, force: true })
  }
}

/** 덧씌울 파일(경로 → 내용). 덧씌우기가 없으면 빈 것 */
export const overlayFiles = (overlay) => (overlay ? { [overlay.path]: overlay.text } : {})

/** dir 아래에 파일(경로 → 내용)을 쓴다 */
export function writeFiles(dir, files) {
  for (const [rel, text] of Object.entries(files ?? {})) {
    const file = path.join(dir, rel)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, text)
  }
}

/**
 * 판정의 기준 폴더: 시나리오의 repo/에 덧씌운 파일을 얹은 것(평가 레포의 첫 커밋과 같은 내용). 덧씌우기가 없으면 repo/
 * 그대로다. 세션이 덧씌운 파일을 고치면 그 고침은 diff에 나온다
 * @param {string} srcDir 시나리오의 repo/
 * @param {{ path: string, text: string } | null} overlay
 * @param {string} dest 덧씌우기가 있을 때 만들 폴더
 */
export function baseWithOverlay(srcDir, overlay, dest) {
  if (!overlay) return srcDir
  copyTree(srcDir, dest)
  writeFiles(dest, overlayFiles(overlay))
  return dest
}

/** run.json과 config.json에 남길 덧씌우기 기록. 내용은 남기지 않는다(같은 해시면 같은 파일). 없으면 false */
export const overlayRecord = (overlay) =>
  overlay ? { path: overlay.path, sha256: overlay.sha256 } : false
