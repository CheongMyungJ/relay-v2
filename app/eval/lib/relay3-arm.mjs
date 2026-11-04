// relay-v3 쪽 (relay-v3 docs/experiments/m2/protocol.md): relay-v3의 Electron 앱(빌드한 out/)을 Playwright로 띄운다.
// 사람 역할이 보는 화면(스크린샷, 보이는 글자, 터미널 글, 누를 수 있는 요소)과 행동, 첫 실행 창 수락, 스냅숏, 판정할 폴더
// 고르기는 relay 쪽(RelayArm)의 것을 그대로 물려받는다(같은 관찰·조작). 다른 것은 앱을 띄우는 법, 프로젝트 등록, 앱 저장소의
// 모양이다: Work는 $RELAY_HOME/works/<id>/work.json, worktree는 $RELAY_HOME/worktrees/<id>, 작업 브랜치는 relay/<짧은 이름>-<4자>.
// 독립 리뷰(claude -p)는 대화 기록을 남기지 않아(--no-session-persistence) 앱이 events.jsonl에 남긴 사용량으로 센다.
import fs from 'node:fs'
import path from 'node:path'
import { _electron as electron } from '@playwright/test'
import { cleanEnv, findClaude } from './env.mjs'
import { RelayArm } from './relay-arm.mjs'

/** relay-v3 체크아웃. RELAY3_APP으로 바꿀 수 있다. 기본은 relay-v2 옆의 relay-v3 */
export const RELAY3_APP = process.env.RELAY3_APP
  ? path.resolve(process.env.RELAY3_APP)
  : path.resolve(import.meta.dirname, '../../../../relay-v3')

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
 * 독립 리뷰(claude -p)의 호출 수와 토큰. events.jsonl의 review 기록(relay-v3 works-evidence.ts)의 usage를 더한다. 호출은
 * 실제로 돈 것(done, failed)만이다. 리뷰를 끈 쪽(RELAY_ABLATE=review)도 [끝내기]마다 status 'skipped' 기록을 남기므로
 * 따로 센다. 돈 리뷰 가운데 usage가 없는 것(시간 초과 등 claude -p가 사용량을 알리지 못한 실패)은 usageUnknown이다.
 * review 기록이 없으면 null
 * @returns {{ calls: number, done: number, failed: number, skipped: number, usageUnknown: number, input: number, output: number, cacheRead: number, cacheWrite: number } | null}
 */
export function reviewUsage(events) {
  const records = events.filter((e) => e?.type === 'review')
  if (!records.length) return null
  const ran = records.filter((e) => e.status !== 'skipped')
  const total = {
    calls: ran.length,
    done: ran.filter((e) => e.status === 'done').length,
    failed: ran.filter((e) => e.status !== 'done').length,
    skipped: records.length - ran.length,
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
 * 실제로 돈 첫 리뷰 뒤에 세션이 도구를 더 썼는가(리뷰가 코드에 닿을 수 있었나, 평가 규약 Q1). 리뷰 지적은 세션에 넣지
 * 않으니(V4) 사람이 읽고 말해야 닿는다. PR이 없는 평가에서는 리뷰가 [끝내기] 때만 돌고 곧 Work가 끝나 대개 false다.
 * 돈 리뷰가 없으면 null
 */
export function workedAfterReview(events) {
  const i = events.findIndex((e) => e?.type === 'review' && e.status !== 'skipped')
  if (i < 0) return null
  return events.slice(i + 1).some((e) => e?.type === 'hook' && e.event === 'PreToolUse')
}

const USAGE_KEYS = [
  'calls',
  'done',
  'failed',
  'skipped',
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
 * 관문 결론의 요약(평가 규약 Q4의 그림자). 없으면 null. export는 이 결론이 내보내기(리뷰 포함) 측정에서 나왔는가다: 마지막
 * evidence 기록이 내보내기이고 그 head가 내보낸 head(exported_head)와 같을 때다. Stop 뒤의 측정(내보내기 아님)에는 늘
 * '리뷰 없음'이 사람 머지 사실로 붙어 그림자가 될 수 없으므로 G1, G2는 내보내기 결론만으로 센다
 * @param {object | null} gate work.json의 gate
 * @param {object[]} [events] events.jsonl의 기록
 * @param {string | null} [exportedHead] work.json의 exported_head
 */
export function gateSummary(gate, events = [], exportedHead = null) {
  if (!gate || typeof gate !== 'object') return null
  const last = events.findLast((e) => e?.type === 'evidence') ?? null
  return {
    conclusion: gate.conclusion ?? null,
    condition: gate.condition ?? null,
    shadow: !!gate.shadow,
    decisive: gate.decisive ?? null,
    export: !!last && last.export === true && !!exportedHead && last.head === exportedHead,
  }
}

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
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
      const dir = rec.worktree || path.join(home, 'worktrees', id)
      if (fs.existsSync(path.join(dir, '.git'))) trees.push({ path: dir, label: workLabel(k, id) })
    }
    return trees
  }

  /**
   * Work의 상태(work.json 요약). 단계가 없어 세션 하나를 task 하나로 두고(단계별 토큰 표에 'session'으로 보인다), 관문
   * 결론과 리뷰 사용량을 함께 둔다. files는 결과 폴더에 함께 남길 앱 파일(마지막 증거 묶음, 실적 장부)이다
   */
  works() {
    return this.records().map(({ k, id, home, dir, rec }) => {
      const events = fs.existsSync(path.join(dir, 'events.jsonl'))
        ? parseEvents(fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8'))
        : []
      const contract = readJson(path.join(dir, 'contract.json'))
      return {
        id: workLabel(k, id),
        dir,
        status: rec.state ?? null,
        branch: rec.branch ?? null,
        contract: contract
          ? { id: contract.id ?? null, approvedBy: contract.approved_by ?? null }
          : null,
        gate: gateSummary(rec.gate, events, rec.exported_head ?? null),
        exportedHead: rec.exported_head ?? null,
        error: rec.error ?? null,
        review: reviewUsage(events),
        workedAfterReview: workedAfterReview(events),
        files: {
          ...(rec.evidence_path ? { 'evidence.json': rec.evidence_path } : {}),
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

  /** 독립 리뷰의 호출 수와 토큰(모든 Work). 리뷰가 없었으면 null */
  reviewUsage() {
    return sumReviews(this.works().map((w) => w.review))
  }
}
