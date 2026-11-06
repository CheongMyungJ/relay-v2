// relay-v3 쪽 (relay-v3 docs/experiments/m2/protocol.md, docs/m2.1-design.md 14절): relay-v3의 Electron 앱(빌드한 out/)을
// Playwright로 띄운다. 사람 역할이 보는 화면(스크린샷, 보이는 글자, 터미널 글, 누를 수 있는 요소)과 행동, 첫 실행 창 수락,
// 스냅숏, 판정할 폴더 고르기는 relay 쪽(RelayArm)의 것을 그대로 물려받는다(같은 관찰·조작). 사람 역할이 터미널에 치는 글은
// 보이는 xterm의 입력 칸에 넣고 키를 눌러(RelayArm.act의 type·key) 사람과 같은 길(xterm onData → ipc terminalWrite)로 간다:
// relay-v3가 되먹임(V24)의 60초 창과 쓰다 둔 글(lastHumanInputAt, draft)을 그 길에서 센다. 화면 흐름(M2의 [끝 확정]과
// M2.1의 한 번 끝·걸린 끝·상자, [세션에 넘기기], 늘 보이는 고칠 점 칸)은 사람 역할의 설명서가 알려 주고 이 운전자는 누를
// 수 있는 요소를 모두 보인다. 다른 것은 앱을 띄우는 법, 프로젝트 등록, 앱 저장소의 모양이다: Work는
// $RELAY_HOME/works/<id>/work.json, worktree는 $RELAY_HOME/worktrees/<id>, 작업 브랜치는 relay/<짧은 이름>-<4자>. M2.1은
// work.json의 내보내기(exports[], V22)마다 관문과 묶음이 있고, 옛 기록(M2, relay3-m2p)은 그 칸이 Work에 있다(exportsOf).
// 독립 리뷰(claude -p)는 대화 기록을 남기지 않아(--no-session-persistence) 앱이 events.jsonl에 남긴 사용량으로 센다.
import fs from 'node:fs'
import path from 'node:path'
import { _electron as electron } from '@playwright/test'
import { cleanEnv, findClaude } from './env.mjs'
import { relay3Build } from './kind.mjs'
import { RelayArm } from './relay-arm.mjs'
import { deviceMetrics } from './relay3-devices.mjs'
import { run } from './util.mjs'

/** relay-v3 체크아웃. RELAY3_APP으로 바꿀 수 있다. 기본은 relay-v2 옆의 relay-v3 */
export const RELAY3_APP = process.env.RELAY3_APP
  ? path.resolve(process.env.RELAY3_APP)
  : path.resolve(import.meta.dirname, '../../../../relay-v3')

/**
 * relay3-m2p 쪽의 체크아웃(M2 빌드에 미룬 고침을 합친 커밋을 빌드한 것). RELAY3_M2P_APP으로 바꿀 수 있다. 기본은 relay-v2 옆의
 * relay-v3-m2p
 */
export const RELAY3_M2P_APP = process.env.RELAY3_M2P_APP
  ? path.resolve(process.env.RELAY3_M2P_APP)
  : path.resolve(import.meta.dirname, '../../../../relay-v3-m2p')

/**
 * relay-v3 쪽이 띄울 체크아웃(kind.mjs relay3Build). relay-v3 쪽이 아니면 null
 * @param {string} arm
 * @param {{ main?: string, m2p?: string }} [apps] 바꿔 줄 폴더(run.mjs의 opts.relay3App, opts.relay3M2pApp)
 */
export function relay3AppOf(arm, apps = {}) {
  const build = relay3Build(arm)
  if (build === 'm2p') return apps.m2p ?? RELAY3_M2P_APP
  if (build === 'main') return apps.main ?? RELAY3_APP
  return null
}

/** relay 앱의 창 크기(relay-v2 main/index.ts). 두 앱의 화면을 같은 크기로 본다(v3 기본은 1400×880) */
const WINDOW = { width: 1500, height: 950 }

/**
 * 결과 폴더와 스냅숏의 이름. Work id(UUID)의 앞 8자다. 팀원 교대 뒤의 앱 저장소는 relay 쪽처럼 앞에 사람 번호를 붙인다
 * @param {number} k 앱 저장소의 차례(0부터)
 * @param {string} id Work id
 */
export function workLabel(k, id) {
  const short = String(id).slice(0, 8)
  return k === 0 ? short : `p${k + 1}-${short}`
}

/** events.jsonl의 글을 기록 목록으로. 깨진 줄(쓰는 중)은 건너뛴다 */
export function parseEvents(text) {
  const out = []
  for (const line of String(text ?? '').split('\n')) {
    if (!line.trim()) continue
    try {
      out.push(JSON.parse(line))
    } catch {
      // 쓰는 중인 줄
    }
  }
  return out
}

/**
 * 독립 리뷰(claude -p)의 호출 수와 토큰. events.jsonl의 review 기록(relay-v3 works-review.ts)의 usage를 더한다. 호출은
 * 실제로 돈 것(done, failed)만이다. 리뷰를 끈 쪽(RELAY_ABLATE=review)도 리뷰할 자리마다 status 'skipped' 기록을 남기므로
 * 따로 센다. 돈 리뷰 가운데 usage가 없는 것(시간 초과 등 claude -p가 사용량을 알리지 못한 실패)은 usageUnknown이다.
 * M2.1(V23)의 review 기록에는 계기(trigger: prepared | pr | end)가 있고, 둘은 호출로도 토큰으로도 세지 않고 따로 센다:
 * - reused: 같은 head·계약에서 앞서 끝난 리뷰(미리 리뷰)를 내보내기가 다시 쓴 것. claude -p를 부르지 않았다(usage 없음)
 * - aborted: 도는 사이 head나 계약이 바뀌어(또는 앱을 닫아) 멈추고 버린 리뷰. 결과가 묶음에 남지 않는다
 * prepared는 돈 리뷰 가운데 미리 리뷰(trigger prepared)의 수다. review 기록이 없으면 null
 * @returns {{ calls: number, done: number, failed: number, skipped: number, prepared: number, reused: number, aborted: number, usageUnknown: number, input: number, output: number, cacheRead: number, cacheWrite: number } | null}
 */
export function reviewUsage(events) {
  const records = events.filter((e) => e?.type === 'review')
  if (!records.length) return null
  const reused = records.filter((e) => e.reused === true)
  const aborted = records.filter((e) => e.aborted === true && e.reused !== true)
  const own = records.filter((e) => e.reused !== true && e.aborted !== true)
  const ran = own.filter((e) => e.status !== 'skipped')
  const total = {
    calls: ran.length,
    done: ran.filter((e) => e.status === 'done').length,
    failed: ran.filter((e) => e.status !== 'done').length,
    skipped: own.length - ran.length,
    prepared: ran.filter((e) => e.trigger === 'prepared').length,
    reused: reused.length,
    aborted: aborted.length,
    usageUnknown: 0,
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
  }
  for (const { usage: u } of ran) {
    if (!u || typeof u !== 'object') {
      total.usageUnknown++
      continue
    }
    total.input += u.input_tokens ?? 0
    total.output += u.output_tokens ?? 0
    total.cacheRead += u.cache_read_input_tokens ?? 0
    total.cacheWrite += u.cache_creation_input_tokens ?? 0
  }
  return total
}

/**
 * 실제로 돈 첫 리뷰(다시 쓴 것, 멈춘 것, 건너뛴 것은 빼고) 뒤에 세션이 도구를 더 썼는가(리뷰가 코드에 닿을 수 있었나,
 * 평가 규약 Q1). M2(V4)에서는 리뷰 지적을 세션에 넣지 않아 사람이 읽고 말해야 닿았다. M2.1(V24)에서는 세션 몫의 올림이
 * 쉬는 세션에 저절로 가고 사람 몫은 [세션에 넘기기]로 간다. 돈 리뷰가 없으면 null
 */
export function workedAfterReview(events) {
  const i = events.findIndex(
    (e) =>
      e?.type === 'review' && e.status !== 'skipped' && e.reused !== true && e.aborted !== true,
  )
  if (i < 0) return null
  return events.slice(i + 1).some((e) => e?.type === 'hook' && e.event === 'PreToolUse')
}

const USAGE_KEYS = [
  'calls',
  'done',
  'failed',
  'skipped',
  'prepared',
  'reused',
  'aborted',
  'usageUnknown',
  'input',
  'output',
  'cacheRead',
  'cacheWrite',
]

/** 여러 Work의 리뷰 사용량을 더한다. 모두 null이면 null */
export function sumReviews(list) {
  const own = list.filter(Boolean)
  if (!own.length) return null
  return Object.fromEntries(USAGE_KEYS.map((k) => [k, own.reduce((a, r) => a + (r[k] ?? 0), 0)]))
}

/**
 * 에이전트 토큰(대화 기록에서 센 것)에 앱이 따로 부른 claude -p의 토큰을 더한다(relay-v3의 독립 리뷰, relay의 독립 리뷰와
 * 지식 검토. 두 앱에 같게). 세션이 아니라 세션 수와 메시지 수는 그대로 두고, 더한 몫은 review에 따로 남긴다
 * (relay-v3 M2 평가 규약 4절 P5: relay3은 리뷰 호출 포함)
 */
export function withReviewUsage(agent, review) {
  if (!review) return agent
  return {
    ...agent,
    input: agent.input + review.input,
    output: agent.output + review.output,
    cacheRead: agent.cacheRead + review.cacheRead,
    cacheWrite: agent.cacheWrite + review.cacheWrite,
    review,
  }
}

/**
 * 내보내기 하나의 evidence 기록(V22): 그 단위의 것(one_branch와 옛 기록은 unit이 없는 것)이고 통합 증거(integration)는 뺀다.
 * 통합 증거는 Work 브랜치의 결정론 증거라 내보내기의 결론이 아니다
 */
const exportEvidence = (events, unit = null) =>
  events.filter(
    (e) => e?.type === 'evidence' && e.integration !== true && (e.unit ?? null) === (unit ?? null),
  )

/**
 * 관문 결론의 요약(평가 규약 Q4의 그림자). 없으면 null. export는 이 결론이 내보내기(리뷰 포함) 측정에서 나왔는가다: 그
 * 내보내기의 마지막 evidence 기록이 내보내기이고 그 head가 내보낸 head(exported_head)와 같을 때다. Stop 뒤의 측정(내보내기
 * 아님)에는 리뷰가 없거나(M2) 장부에 남지 않는 미리 리뷰라(M2.1 V23) G1, G2는 내보내기 결론만으로 센다. head(끝낸 때 그
 * 내보내기의 끝: worktree HEAD나 브랜치 ref)를 주면 그것이 내보낸 head일 때만이다: [끝내기] 뒤 세션이 커밋했는데 다시 재기
 * 전에 끝나면 결론은 앞 커밋의 것이라 판정한 상태(숨긴 시험)와 어긋난다. unit은 V22의 단위 브랜치 내보내기다(결과에도 붙인다)
 * @param {object | null} gate work.json의 gate(M2.1은 exports[].gate)
 * @param {object[]} [events] events.jsonl의 기록
 * @param {string | null} [exportedHead] work.json의 exported_head(M2.1은 exports[].exported_head)
 * @param {string | null} [head] 그 내보내기의 끝. 주지 않으면 보지 않는다
 * @param {string | null} [unit] 단위(one_branch와 옛 기록은 null)
 */
export function gateSummary(gate, events = [], exportedHead = null, head = undefined, unit = null) {
  if (!gate || typeof gate !== 'object') return null
  const last = exportEvidence(events, unit).at(-1) ?? null
  return {
    conclusion: gate.conclusion ?? null,
    condition: gate.condition ?? null,
    shadow: !!gate.shadow,
    decisive: gate.decisive ?? null,
    export:
      !!last &&
      last.export === true &&
      !!exportedHead &&
      last.head === exportedHead &&
      (head === undefined || head === exportedHead),
    ...(unit ? { unit } : {}),
  }
}

/**
 * work.json의 내보내기(V22). M2.1은 exports[]이고, 옛 기록(M2, relay3-m2p)은 Work 브랜치의 내보내기 하나로 옮긴다(relay-v3
 * main/store.ts upgradeWork와 같다). modern은 M2.1 기록인가다: 그 빌드는 Work 브랜치의 ref를 잰다(V21)
 * @returns {{ modern: boolean, exports: { unit: string | null, branch: string | null, gate: object | null, exportedHead: string | null, evidencePath: string | null, pr: object | null }[] }}
 */
export function exportsOf(rec) {
  if (Array.isArray(rec?.exports))
    return {
      modern: true,
      exports: rec.exports.map((x) => ({
        unit: x?.unit ?? null,
        branch: x?.branch ?? null,
        gate: x?.gate ?? null,
        exportedHead: x?.exported_head ?? null,
        evidencePath: x?.evidence_path ?? null,
        pr: x?.pr ?? null,
      })),
    }
  return {
    modern: false,
    exports: [
      {
        unit: null,
        branch: rec?.branch ?? null,
        gate: rec?.gate ?? null,
        exportedHead: rec?.exported_head ?? null,
        evidencePath: rec?.evidence_path ?? null,
        pr: rec?.pr ?? null,
      },
    ],
  }
}

/** Work가 끝났다고 세는 끝(workEnd). relay@auto의 [Work 완료]와 같은 수준이다 */
const ENDED = new Set(['confirmed', 'merged', 'closed', 'prepared', 'done'])

/**
 * Work의 끝. M2(V18)의 [끝내기]는 내보내기 증거와 리뷰를 재고 확인 상자를 띄울 뿐이고 [끝 확정]이 Work를 끝낸다. M2.1(V25)의
 * [끝내기]는 열린 것이 없으면 바로 끝내고(ended.how once·armed), 있으면 상자에서 [그래도 끝내기](how box)로 끝낸다. 끝의
 * 기준은 커밋된 상태다(사람 역할의 끝의 기준, v3 증거는 커밋만 잰다). relay@auto의 [Work 완료](세션이 쉴 때 사람이 끝냄)와
 * 같은 수준의 끝을 ENDED로 센다:
 * - confirmed: [끝 확정]·[끝내기]·[그래도 끝내기]로 끝남(events.jsonl의 ended 기록. 어떻게 끝냈는지는 ended.how).
 *   merged: PR 머지(앱의 [머지]·정책 머지는 merged, 앱 밖 머지는 merged_outside 기록). closed: PR 닫힘(pr_closed 기록).
 *   done: 끝났는데 그 기록이 없음(기록을 읽지 못함)
 * - prepared: 앱에서 끝내지 않고 실행이 끝났지만(사람 역할의 done 등) 끝낸 커밋 상태가 내보내기 증거·리뷰를 받은 그 상태다
 *   (내보내기마다 마지막 evidence 기록이 내보내기이고 그 head = 내보낸 head = 그 내보내기의 끝, 커밋하지 않은 변경 없음).
 *   사람은 그 커밋의 증거와 리뷰를 본 뒤 끝냈고 [끝 확정]은 세션을 닫을 뿐이라 끝으로 센다
 * - stale: 내보내기 증거는 있지만 그 뒤 커밋이 더 생겼거나 커밋하지 않은 변경이 남음(끝낸 상태의 증거·리뷰가 아님). 끝이 아니다
 * - abandoned: [버리기]. null: 내보내기 증거 없이 끝남([끝내기]를 누르지 않았거나 리뷰가 도는 중)
 * @param {{ state: string | null, events: object[], exportedHead?: string | null, head?: string | null, clean: boolean, exports?: { unit: string | null, exportedHead: string | null, tip: string | null }[] }} o
 *   exports는 내보내기마다 내보낸 head와 지금 끝(V22)이다. 없으면 exportedHead와 head(Work worktree의 HEAD) 하나다. clean은
 *   커밋하지 않은 변경이 없는지다
 */
export function workEnd(o) {
  if (o.state === 'abandoned') return 'abandoned'
  if (o.state === 'done') {
    // relay-v3 works-exports.ts·works.ts가 남기는 기록 이름이다(pr_merged는 상태 사건 이름일 뿐 기록하지 않는다)
    const has = (...types) => o.events.some((e) => types.includes(e?.type))
    if (has('merged', 'merged_outside')) return 'merged'
    if (has('pr_closed')) return 'closed'
    if (has('ended')) return 'confirmed'
    return 'done'
  }
  const exports = o.exports ?? [
    { unit: null, exportedHead: o.exportedHead ?? null, tip: o.head ?? null },
  ]
  const exported = (x) => !!x.exportedHead && exportEvidence(o.events, x.unit).some((e) => e.export)
  if (!exports.some(exported)) return null
  const prepared = (x) => {
    const last = exportEvidence(o.events, x.unit).at(-1)
    return last?.export === true && last.head === x.exportedHead && x.tip === x.exportedHead
  }
  return exports.length > 0 && exports.every(prepared) && o.clean ? 'prepared' : 'stale'
}

/** worktree의 HEAD와 커밋하지 않은 변경이 없는지. 읽지 못하면 null, false */
function treeState(dir) {
  const ok = !!dir && fs.existsSync(path.join(dir, '.git'))
  const head = ok ? run('git', ['rev-parse', 'HEAD'], { cwd: dir }) : null
  const status = ok ? run('git', ['status', '--porcelain'], { cwd: dir }) : null
  return {
    head: head?.code === 0 ? head.out.trim() : null,
    clean: status?.code === 0 && status.out.trim() === '',
  }
}

/** 브랜치의 끝(refs/heads/<branch>). 없거나 읽지 못하면 null */
function refTip(dir, branch) {
  if (!dir || !branch || !fs.existsSync(path.join(dir, '.git'))) return null
  const r = run('git', ['rev-parse', '--verify', '-q', `refs/heads/${branch}^{commit}`], {
    cwd: dir,
  })
  return r.code === 0 ? r.out.trim() || null : null
}

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

/**
 * Work의 증거 묶음들. finals는 내보내기마다 마지막 묶음(work.json의 evidence_path, 없으면 null)이다. all은 이 Work에서 잰
 * 묶음 모두다: Work 브랜치의 내보내기(one_branch, 옛 기록)는 엔진이 head마다 파일 하나를 쓰므로(마지막 묶음의 폴더, 리뷰가
 * 붙으면 그 묶음) evidence 기록의 head마다 읽는다. byHead는 그 head마다의 묶음이다(되먹임의 결과를 센다). 단위 브랜치(V22)는
 * 마지막 묶음만 남는다. 같은 파일은 한 번만 넣는다
 */
export function workBundles(events, exports) {
  const finals = exports.map((x) => ({
    unit: x.unit,
    bundle: x.evidencePath ? readJson(x.evidencePath) : null,
  }))
  const seen = new Map()
  const all = []
  const add = (file) => {
    if (!file) return null
    if (seen.has(file)) return seen.get(file)
    const b = readJson(file)
    seen.set(file, b)
    if (b) all.push(b)
    return b
  }
  const byHead = {}
  for (const x of exports) {
    if (x.unit === null && x.evidencePath) {
      const dir = path.dirname(x.evidencePath)
      for (const e of exportEvidence(events, null))
        if (typeof e.head === 'string' && /^[0-9a-f]{7,64}$/.test(e.head)) {
          const b = add(path.join(dir, `${e.head}.json`))
          if (b) byHead[e.head] = b
        }
    }
    add(x.evidencePath)
  }
  return { finals, all, byHead }
}

export class Relay3Arm extends RelayArm {
  /**
   * @param {object} o RelayArm과 같다. 더해서
   * @param {Record<string, string>} [o.appEnv] 앱에 더 줄 환경 변수(relay3-noreview는 RELAY_ABLATE=review, kind.mjs relay3Env)
   * @param {string} [o.appDir] relay-v3 체크아웃(빌드한 out/와 node_modules가 있는 곳). 없으면 RELAY3_APP
   */
  constructor(o) {
    super({ ...o, appDir: o.appDir ?? RELAY3_APP })
    this.home = path.join(o.dir, 'relay3-home')
    this.homes = [this.home]
  }

  kind = 'relay3'

  env() {
    return cleanEnv({
      ...this.o.agentEnv,
      CLAUDE_CONFIG_DIR: this.o.agentConfigDir,
      CLAUDE_BIN: findClaude(),
      RELAY_HOME: this.home,
      ...(this.o.appEnv ?? {}),
    })
  }

  async launch() {
    fs.mkdirSync(this.home, { recursive: true })
    // root에서는 Chromium 샌드박스 없이 뜬다(relay-v3 [스모크]와 같음). 앱은 창 저장소를 $RELAY_HOME/electron에 둔다
    this.app = await electron.launch({
      executablePath: path.join(this.appDir, 'node_modules/electron/dist/electron'),
      args: ['--no-sandbox', this.appDir, `--user-data-dir=${this.userData}`],
      env: this.env(),
      timeout: 60_000,
    })
    this.launches++
    // 폴더 고르기 대화상자는 메인에서 바꿔 끼운다(relay 쪽, relay-v3 [스모크]와 같음. ipc.ts는 부를 때마다 찾는다).
    // OS 알림은 모아 사람 역할에게 보인다
    await this.app.evaluate(({ dialog, Notification }, dir) => {
      dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [dir] })
      dialog.showMessageBox = () => Promise.resolve({ response: 0, checkboxChecked: false })
      globalThis.__evalNotices = []
      const show = Notification.prototype.show
      Notification.prototype.show = function () {
        globalThis.__evalNotices.push({ title: this.title, body: this.body, at: Date.now() })
        try {
          show.call(this)
        } catch {
          // 가상 화면에는 알림 서버가 없을 수 있다
        }
      }
    }, this.o.repo)
    this.win = await this.app.firstWindow()
    // [버리기]의 확인 창(window.confirm)은 사람이 누른 대로 받아들인다. relay 쪽의 앱 종료 확인을 [종료]로 고르는 것과 같다
    this.win.on('dialog', (d) => void d.accept().catch(() => {}))
    await this.app.evaluate(({ BrowserWindow }, size) => {
      BrowserWindow.getAllWindows()[0]?.setSize(size.width, size.height)
    }, WINDOW)
    await this.win.waitForSelector('.app', { timeout: 60_000 })
    this.noticeSeen = 0
  }

  /** 평가 전 준비: 프로젝트 등록([스모크]와 같은 순서). 사람 역할의 부담에 넣지 않는다. 프로젝트 설정은 앱 기본 그대로다 */
  async prepare() {
    await this.launch()
    const win = this.win
    await win.getByRole('button', { name: '프로젝트 추가', exact: true }).click({ timeout: 30_000 })
    const project = win.getByTestId('project').first()
    await project.waitFor({ timeout: 30_000 })
    const name = path.basename(this.o.repo)
    if (!(await project.innerText()).includes(name))
      throw new Error(`프로젝트 등록 실패: ${await project.innerText()}`)
  }

  /**
   * 장기 평가의 뒤 Work(run-sequence.mjs): 앞 Work가 남긴 앱 저장소(프로젝트 등록, Work 기록, 실적 장부)로 앱을 다시 띄운다.
   * 사람이 다음 일을 하려고 앱을 다시 켠 것과 같다
   */
  async resume() {
    await this.launch()
    await this.win.getByTestId('project').first().waitFor({ timeout: 30_000 })
  }

  /** Work 기록(work.json): 팀원 교대 전의 앱 저장소 것도 */
  records() {
    const out = []
    for (const [k, home] of this.homes.entries()) {
      const dir = path.join(home, 'works')
      if (!fs.existsSync(dir)) continue
      for (const id of fs.readdirSync(dir)) {
        const rec = readJson(path.join(dir, id, 'work.json'))
        if (rec) out.push({ k, id, home, dir: path.join(dir, id), rec })
      }
    }
    return out
  }

  /**
   * Work의 worktree들. $RELAY_HOME/worktrees 아래에는 앱이 증거를 재는 check worktree(<레포 키>/base, head)도 있어
   * 폴더를 훑지 않고 work.json의 worktree를 쓴다
   */
  worktrees() {
    const trees = []
    for (const { k, id, home, rec } of this.records()) {
      const label = workLabel(k, id)
      if (this.earlier.has(label)) continue
      const dir = rec.worktree || path.join(home, 'worktrees', id)
      if (fs.existsSync(path.join(dir, '.git'))) trees.push({ path: dir, label })
    }
    return trees
  }

  /** 앞 Work(earlier)의 Work 브랜치와 내보내기의 단위 브랜치 */
  earlierBranches() {
    const out = []
    for (const { k, id, rec } of this.records()) {
      if (!this.earlier.has(workLabel(k, id))) continue
      if (rec.branch) out.push(rec.branch)
      for (const x of exportsOf(rec).exports) if (x.branch) out.push(x.branch)
    }
    return out
  }

  /**
   * Work의 상태(work.json 요약). 단계가 없어 세션 하나를 task 하나로 두고(단계별 토큰 표에 'session'으로 보인다), 관문
   * 결론과 리뷰 사용량을 함께 둔다. gates는 내보내기마다(V22) 관문 요약이고, gate는 내보내기가 하나일 때 그것이다(옛 결과와
   * 같은 칸). 내보내기의 끝은 M2.1 기록이면 그 브랜치의 ref(V21: 앱이 재는 것), 옛 기록이면 worktree의 HEAD다. end는 끝의
   * 종류(workEnd), devices는 M2.1 장치의 지표(relay3-devices.mjs)다. files는 결과 폴더에 함께 남길 앱 파일(Work 브랜치
   * 내보내기의 마지막 증거 묶음, 실적 장부)이다. 단위 브랜치의 묶음과 통합 증거는 Work 폴더(evidence/) 안에 있어 함께 남는다
   */
  works() {
    return this.records().map(({ k, id, home, dir, rec }) => {
      const events = fs.existsSync(path.join(dir, 'events.jsonl'))
        ? parseEvents(fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8'))
        : []
      const contract = readJson(path.join(dir, 'contract.json'))
      const worktree = rec.worktree || path.join(home, 'worktrees', id)
      const tree = treeState(worktree)
      const { modern, exports } = exportsOf(rec)
      const tips = exports.map((x) =>
        x.unit !== null
          ? refTip(worktree, x.branch)
          : modern
            ? (refTip(worktree, x.branch ?? rec.branch) ?? tree.head)
            : tree.head,
      )
      const end = workEnd({
        state: rec.state ?? null,
        events,
        exports: exports.map((x, i) => ({
          unit: x.unit,
          exportedHead: x.exportedHead,
          tip: tips[i],
        })),
        clean: tree.clean,
      })
      const gates = exports.map((x, i) =>
        gateSummary(x.gate, events, x.exportedHead, tips[i], x.unit),
      )
      const bundles = workBundles(events, exports)
      const main = exports.find((x) => x.unit === null)
      return {
        id: workLabel(k, id),
        dir,
        status: rec.state ?? null,
        end,
        ended: ENDED.has(end),
        branch: rec.branch ?? null,
        contract: contract
          ? { id: contract.id ?? null, approvedBy: contract.approved_by ?? null }
          : null,
        gate: gates.length === 1 ? gates[0] : null,
        gates,
        exportedHead: exports.length === 1 ? exports[0].exportedHead : null,
        error: rec.error ?? null,
        review: reviewUsage(events),
        workedAfterReview: workedAfterReview(events),
        devices: deviceMetrics({ events, rec, contract, ...bundles }),
        files: {
          ...(main?.evidencePath ? { 'evidence.json': main.evidencePath } : {}),
          'ledger.jsonl': path.join(home, 'ledger.jsonl'),
        },
        tasks: [
          {
            seq: 1,
            node: 'session',
            status: rec.state ?? null,
            approved_by: contract?.approved_by ?? null,
            session: rec.session_id ?? null,
            contextChars: null,
            knowledgeChars: null,
          },
        ],
      }
    })
  }

  /**
   * 세션이 평가 레포에 만들었는데 relay가 재지 않은 로컬 브랜치(V21 재는 법, docs/m2.1-design.md 2절): main, Work 브랜치,
   * 내보내기의 단위 브랜치(V22)가 아니고 기준 뒤에 커밋이 있는 것. 판정은 따로 한다(finalTrees의 branchTrees)
   */
  unmeasuredBranches() {
    const repo = this.o.repo
    if (!repo || !fs.existsSync(repo)) return []
    const r = run('git', ['for-each-ref', '--format=%(refname:short)', 'refs/heads'], { cwd: repo })
    if (r.code !== 0) return []
    const known = new Set(['main'])
    for (const { rec } of this.records()) {
      if (rec.branch) known.add(rec.branch)
      for (const x of exportsOf(rec).exports) if (x.branch) known.add(x.branch)
    }
    return r.out
      .split('\n')
      .map((b) => b.trim())
      .filter((b) => b && !known.has(b))
      .filter((b) => {
        const c = run('git', ['rev-list', '--count', `${this.o.base}..refs/heads/${b}`], {
          cwd: repo,
        })
        return c.code === 0 && Number(c.out.trim()) > 0
      })
  }

  /** 독립 리뷰의 호출 수와 토큰(모든 Work). 리뷰가 없었으면 null */
  reviewUsage() {
    return sumReviews(this.works().map((w) => w.review))
  }
}
