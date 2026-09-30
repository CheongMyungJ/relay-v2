// [스모크] 설치한 앱이 뜨고, 가짜 claude로 [의도 승인], [즉시 중단]과 [재개], 설정 화면(자동 승인 포함), [단계 선택],
// 자동 승인 카운트다운의 [취소], [push]와 [Work 정리], 다시 켠 뒤 끊긴 작업의 [다시 시도]를 누른다 (I27).
// M2: 프로젝트 등록 → 새 Work → intake 탭에 PTY 출력 → 창 크기 변경이 PTY에 전달 → [의도 승인]
// → intent.md 확정, intake 세션 트리 종료, 다음 task 시작. M12: 다음 task의 터미널은 표시 줄로 시작하고, 머리 띠와
// 패널에 진행 표시(마지막 동작 Bash(npm test))가 보인다.
// M3: 다음 task를 [즉시 중단]하면 중단됨·읽기 전용이 되고 트리가 끝난다 → [재개]하면 같은 세션을
// --resume으로 이전 화면 뒤에 잇고, 이어서 하라는 입력으로 바로 작업 중이 된다(M12) → 설정 화면에서 세션 상한을
// 바꾼다. M7: 같은 설정 화면에서 카운트다운을 600초로 바꾼다(수정 단계의 자동 승인은 M12부터 기본으로 켜져 있다).
// M4: [단계 선택]에서 intake를 고르면 미리 보기(폐기될 산출물, 중단할 task, 코드, intent 새 버전)를 보이고,
// 추가 지시와 함께 [확인]하면 진행 중인 세션을 끝내고 intake를 되감기로 다시 시작한다(앞 탭은 폐기됨)
// → 새 intake를 [의도 승인]하면 intent v2가 되고 v1은 intent.history에 남는다.
// M5: 두 번째 Work를 S 경로로 최종 검증까지 가면 Work 완료 화면에 전달 버튼이 보인다 → [push]하면 최종 검증이 남긴
// 커밋 안 된 파일 때문에 선택지가 뜨고, [AI 세션 열기]로 정리 세션을 연다(7-5) → 정리 세션 중에 [이 단계 끝나면 멈춤]을
// 켜면 [승인하고 멈춤] 화면이 되어도 [정리 세션 닫기]가 남고, 멈추는 동안은 전달하지 않는다(D137) → 끄고
// [정리 끝 → push/PR 진행]을 누르면 로컬 bare 원격에 Work 브랜치가 생기고 Work 완료(전달: push)가 된다 → [Work 정리]의
// 요약에 push됨이 보이고 [정리]하면 worktree가 없어지고 보관됨이 된다(산출물은 남음).
// M7: 두 번째 Work의 새 Work 대화상자에 이 Work의 자동 승인(앱 설정 따름: 켜짐)이 보인다 → 수정이 승인 대기가 되면
// 승인 화면에 자동 승인 카운트다운과 [취소]가 보인다 → [취소]하면 카운트다운이 없어지고 까닭([취소]를 누름)이 보이며,
// 사람이 [승인]한다.
// M11: 같은 설정 화면에 PR 대응의 자동 승인과 "자동 대응 (PR 진행)" 절(대응 자동 시작, 자동 대응 라운드 상한)이 있고
// 기본은 꺼짐, 3이다.
// M8, M12: 설정 화면에 리뷰의 질문 방식과 자동 승인(기본 켬)이 있다 → 두 번째 Work는 수정 뒤 리뷰를 지난다. 리뷰에
// 지적이 있어 카운트다운 없이 까닭("리뷰에 지적이 있음")과 함께 승인 대기가 되고 [산출물]에 review.md가 보이며, 사람이
// [승인]하면 최종 검증으로 간다.
// M6: 앱 종료 확인을 거쳐 앱을 끄고, 첫 Work의 work.json에 끊긴 되감기 기록을 넣고 decisions.md를 고친 뒤 다시
// 켠다 → 첫 Work의 배지가 "끊긴 작업"이고, 패널 맨 위에 끊긴 곳과 [다시 시도]·[무시], 바뀐 파일과 [확인]이
// 보인다. 끊긴 동안 [단계 선택]은 없다 → [확인]하면 파일 알림이 닫히고, [다시 시도]하면 앞 task를 폐기하고
// intake를 되감기로 다시 시작한다 → 앱 종료 확인을 거쳐 끝낸다.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'
import { git, makeRepo } from '../flow/repo'
import { REPO_FILES, REQUEST, scenario, steps } from '../flow/scenarios'

const isWin = process.platform === 'win32'
const APP_DIR = path.resolve(__dirname, '../..')
const FAKE = path.resolve(
  __dirname,
  '../fake-claude',
  isWin ? 'fake-claude.cmd' : 'fake-claude.mjs',
)

let app: ElectronApplication
let root: string
let home: string
let repo: string
let remote: string
let env: Record<string, string>

/** 앱을 띄운다. RELAY_APP_EXE가 있으면 설치된 앱이다 */
async function launch(): Promise<ElectronApplication> {
  const exe = process.env['RELAY_APP_EXE']
  const a = exe
    ? await electron.launch({ executablePath: exe, env })
    : await electron.launch({ args: [APP_DIR], env })
  // Electron 기본 대화상자는 Playwright가 가로채지 못하므로 메인 프로세스에서 바꿔 끼운다.
  // 앱 종료 확인(시나리오 3-6)에는 [종료]로 답한다.
  await a.evaluate(({ dialog }, dir) => {
    dialog.showOpenDialog = (() =>
      Promise.resolve({ canceled: false, filePaths: [dir] })) as typeof dialog.showOpenDialog
    dialog.showMessageBox = (() =>
      Promise.resolve({ response: 0, checkboxChecked: false })) as typeof dialog.showMessageBox
  }, repo)
  return a
}

test.beforeAll(async () => {
  root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-smoke-')))
  home = path.join(root, 'home')
  ;({ repo, remote } = makeRepo(root, 'sample', REPO_FILES))
  // intake는 초안과 handoff를 쓰고 멈추고, evidence는 시작만 한다. 최종 검증은 커밋 안 된 파일을 남기고,
  // 정리 세션은 그 파일을 지운다 (7-5)
  const scenarioFile = path.join(root, 'scenario.json')
  fs.writeFileSync(
    scenarioFile,
    JSON.stringify({
      ...scenario('L', {
        evidence: [
          { do: 'prompt' },
          { do: 'tool', name: 'Bash', input: { command: 'npm test' } },
          { do: 'wait' },
        ],
        'final-verify': [
          ...steps('verify', 'S').slice(0, -1),
          { do: 'edit', files: { 'debug.log': '실험 출력\n' } },
          { do: 'stop' },
        ],
      }),
      cleanup: [
        { do: 'prompt', text: '커밋 안 된 파일을 지워 줘' },
        { do: 'git', args: ['clean', '-f', '-q'] },
        { do: 'stop' },
        { do: 'wait' },
      ],
    }),
  )
  env = {
    ...process.env,
    CLAUDE_BIN: FAKE,
    RELAY_HOME: home,
    FAKE_CLAUDE_SCENARIO: scenarioFile,
    // 가짜 claude가 세션을 적어 두어야 --resume으로 다시 연다
    FAKE_CLAUDE_RECORD: path.join(root, 'record'),
  } as Record<string, string>
  app = await launch()
})

test.afterAll(async () => {
  await app?.close()
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
})

test('가짜 claude로 [의도 승인], [즉시 중단]과 [재개], 설정 화면, [단계 선택], 자동 승인 카운트다운의 [취소], [push]와 [Work 정리], 다시 켠 뒤 끊긴 작업의 [다시 시도]를 누른다', async () => {
  const win = await app.firstWindow()
  await expect(win.locator('.layout')).toBeVisible()
  await expect(win.locator('.sidebar')).toBeVisible()
  await expect(win.locator('.panel')).toBeVisible()

  // 프로젝트 등록 (시나리오 0)
  await win.locator('.sidebar').getByRole('button', { name: '프로젝트 추가' }).click()
  await win.getByRole('button', { name: '레포 폴더 고르기' }).click()
  const checks = win.locator('table.checks')
  await expect(checks).toContainText('git 레포의 루트인가', { timeout: 30_000 })
  await expect(win.getByLabel('기본 브랜치')).toHaveValue('main')
  await win.getByRole('button', { name: '등록' }).click()
  await expect(win.locator('.project-name')).toHaveText('sample', { timeout: 30_000 })

  // 새 Work (시나리오 1)
  await win.getByRole('button', { name: '새 Work' }).click()
  await win.getByLabel('요청').fill(REQUEST)
  await win.getByRole('button', { name: '시작' }).click()

  // intake 탭: PTY 출력과 머리 띠 (시나리오 2-5, D109)
  const rows = win.locator('.terminal-host:not([hidden]) .xterm-rows')
  await expect(rows).toContainText('FAKE-CLAUDE READY', { timeout: 60_000 })
  await expect(win.locator('.band')).toContainText('01 의도 정리 · 새 세션 · 이유: 기본 진행')
  const pid = Number(/PID (\d+)/.exec((await rows.textContent()) ?? '')?.[1])
  expect(pid).toBeGreaterThan(0)
  expect(alive(pid)).toBe(true)

  // 창 크기를 바꾸면 PTY 크기도 바뀐다
  const before = lastSize((await rows.textContent()) ?? '')
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(1200, 800)
  })
  await expect
    .poll(async () => lastSize((await rows.textContent()) ?? ''), { timeout: 15_000 })
    .not.toBe(before)

  // 승인 화면 (D83)과 [의도 승인] (4.1)
  const approve = win.getByRole('button', { name: '의도 승인' })
  await expect(approve).toBeEnabled({ timeout: 60_000 })
  await expect(win.getByLabel('size')).toHaveValue('L')
  await win.screenshot({ path: 'test-results/approval.png' })
  await approve.click()

  // 다음 task가 시작되고, intake 세션은 트리째 끝난다 (시나리오 4-4, 5)
  await expect(win.getByRole('tab', { name: /02 재현과 관찰/ })).toBeVisible({ timeout: 60_000 })
  await expect.poll(() => alive(pid), { timeout: 15_000 }).toBe(false)
  // 스냅샷은 할 일(파일 쓰기)보다 먼저 온다
  await expect.poll(() => findFile(path.join(home, 'projects'), 'intent.md')).not.toBeNull()
  const intent = findFile(path.join(home, 'projects'), 'intent.md')
  expect(fs.readFileSync(intent ?? '', 'utf8')).toContain(
    'schema_version: 1\nversion: 1\ntype: bugfix\nsize: L\n',
  )
  await expect(rows).toContainText('FAKE-CLAUDE READY', { timeout: 60_000 })
  await win.screenshot({ path: 'test-results/next-task.png' })
  const badge = win.locator('.work-item .badge')
  await expect(badge).toHaveText('작업 중')

  // 새 세션은 표시 줄로 시작하고(D215), 머리 띠와 패널에 진행 표시가 있다(D216)
  await expect(rows).toContainText('[가짜 claude] wait', { timeout: 60_000 })
  await expect(rows).toContainText('── relay: 02 재현과 관찰 · 새 세션을 띄우는 중 ──')
  await expect(win.locator('.band .activity')).toContainText('마지막 동작 Bash(npm test)')
  await expect(win.locator('.panel .progress')).toContainText('마지막 동작 Bash(npm test)')
  await win.screenshot({ path: 'test-results/activity.png' })

  // [즉시 중단] (시나리오 3-4): 중단됨, 읽기 전용, 프로세스 트리 종료
  const next = Number(/PID (\d+)/.exec((await rows.textContent()) ?? '')?.[1])
  expect(alive(next)).toBe(true)
  await win.getByRole('button', { name: '즉시 중단', exact: true }).click()
  await expect(win.locator('.band')).toContainText('중단됨', { timeout: 30_000 })
  await expect(win.locator('.band')).toContainText('읽기 전용')
  await expect(badge).toHaveText('중단됨')
  await expect.poll(() => alive(next), { timeout: 15_000 }).toBe(false)
  await win.screenshot({ path: 'test-results/interrupted.png' })

  // [재개]: 같은 세션 id로 --resume, 이전 화면 뒤에 잇는다. 이어서 하라는 입력을 함께 주어 다시 연 세션이 바로 일한다
  // (D218)
  await expect(win.locator('.panel .notice')).toContainText(
    '중단됨. [재개]하면 같은 대화를 다시 열고 하던 일을 이어서 하라고 알립니다.',
  )
  await win.getByRole('button', { name: '재개', exact: true }).click()
  await expect(win.locator('.band')).toContainText('02 재현과 관찰 · 세션 재개', {
    timeout: 30_000,
  })
  await expect(rows).toContainText('relay: 세션 재개', { timeout: 30_000 })
  await expect(rows).toContainText('--resume', { timeout: 30_000 })
  await expect(badge).toHaveText('작업 중')
  await win.screenshot({ path: 'test-results/resumed.png' })

  // 설정 화면 (D70): 세션 상한과 카운트다운을 바꾸면 config.json에 쓴다. 자동 승인은 기본으로 수정과 리뷰가 켜져
  // 있다 (4.2, D213, D214)
  await win.locator('.sidebar').getByRole('button', { name: '설정', exact: true }).click()
  await win.getByLabel('세션 상한').fill('2')
  await expect(win.getByLabel('수정 자동 승인')).toBeChecked()
  await expect(win.getByLabel('원인 분석 자동 승인', { exact: true })).not.toBeChecked()
  await win.getByLabel('자동 승인 카운트다운(초)').fill('600')
  // 리뷰는 질문 방식과 자동 승인을 고른다. 자동 승인은 지적이 없을 때만 한다 (5.1.1, D213)
  await expect(win.getByLabel('리뷰 질문 방식')).toHaveValue('draft_first')
  await expect(win.getByLabel('리뷰 자동 승인')).toBeChecked()
  // 자동 대응 (M11, D154, D169, D171): 기본은 꺼짐과 상한 3이다
  await expect(win.getByLabel('PR 대응 자동 승인')).not.toBeChecked()
  await expect(win.getByLabel('대응 자동 시작')).not.toBeChecked()
  await expect(win.getByLabel('자동 대응 라운드 상한')).toHaveValue('3')
  await win.screenshot({ path: 'test-results/settings.png' })
  await win.getByRole('button', { name: '저장', exact: true }).click()
  const config = () =>
    JSON.parse(fs.readFileSync(path.join(home, 'config.json'), 'utf8')) as {
      session_limit: number
      auto_approve: Record<string, boolean>
      auto_approve_countdown_sec: number
    }
  await expect.poll(() => config().session_limit).toBe(2)
  expect(config().auto_approve).toEqual({
    investigate: false,
    evidence: false,
    rca: false,
    fix: true,
    review: true,
    respond: false,
  })
  expect(config().auto_approve_countdown_sec).toBe(600)

  // [단계 선택] (6.2, D82): intake를 고르면 결과를 미리 보인다
  const resumedPid = lastPid((await rows.textContent()) ?? '')
  expect(alive(resumedPid)).toBe(true)
  await win.getByRole('button', { name: '단계 선택', exact: true }).click()
  const dialog = win.getByRole('dialog', { name: /단계 선택/ })
  await dialog.getByLabel('의도 정리(intake)').check()
  const preview = dialog.getByLabel('미리 보기')
  await expect(preview).toContainText('01 의도 정리: intent.draft.md', { timeout: 30_000 })
  await expect(preview).toContainText('02 재현과 관찰: 산출물 없음')
  await expect(preview).toContainText('진행 중인 02 재현과 관찰의 세션을 끝냅니다')
  await expect(preview).toContainText('되돌릴 커밋 0개')
  await expect(preview).toContainText('백업 브랜치를 만들지 않습니다')
  await expect(preview).toContainText('intent 새 버전(v2)')
  await dialog.getByLabel('추가 지시').fill('완료조건에 음수만 든 배열을 더해 주세요')
  await win.screenshot({ path: 'test-results/step-select.png' })
  await dialog.getByRole('button', { name: '확인', exact: true }).click()

  // 진행 중인 세션을 끝내고 intake를 되감기로 다시 시작한다. 앞 task는 폐기됨이다
  await expect(win.getByRole('tab', { name: /03 의도 정리/ })).toBeVisible({ timeout: 30_000 })
  await expect(win.locator('.band')).toContainText('03 의도 정리 · 새 세션 · 이유: 되감기')
  await expect(win.locator('.tab.discarded')).toHaveCount(2)
  await expect.poll(() => alive(resumedPid), { timeout: 15_000 }).toBe(false)
  const intentFile = findFile(path.join(home, 'projects'), 'intent.md') ?? ''
  const v1 = fs.readFileSync(intentFile, 'utf8')
  // context.md는 탭이 보인 뒤 task를 띄우며 쓴다
  await expect
    .poll(() => findFile(path.join(home, 'projects'), 'context.md', '03-intake'))
    .not.toBeNull()
  const context = findFile(path.join(home, 'projects'), 'context.md', '03-intake') ?? ''
  expect(fs.readFileSync(context, 'utf8')).toContain('완료조건에 음수만 든 배열을 더해 주세요')

  // 새 intake를 [의도 승인]하면 intent v2가 된다 (D40)
  const again = win.getByRole('button', { name: '의도 승인' })
  await expect(again).toBeEnabled({ timeout: 60_000 })
  await win.screenshot({ path: 'test-results/rewound.png' })
  await again.click()
  await expect(win.getByRole('tab', { name: /04 재현과 관찰/ })).toBeVisible({ timeout: 60_000 })
  await expect
    .poll(() => fs.readFileSync(intentFile, 'utf8'), { timeout: 15_000 })
    .toContain('version: 2\n')
  expect(
    fs.readFileSync(path.join(path.dirname(intentFile), 'intent.history', 'v1.md'), 'utf8'),
  ).toBe(v1)

  // 두 번째 Work (M5): S 경로로 최종 검증까지 간다. 세션 상한 2에서 첫 Work의 세션 하나와 함께 돈다
  await win.getByRole('button', { name: '새 Work' }).click()
  await win.getByLabel('요청').fill(`${REQUEST}\n두 번째 Work`)
  // 이 Work의 자동 승인은 고르지 않으면 앱 설정을 따른다 (D72)
  await win.getByText('이 Work의 자동 승인').click()
  await expect(win.getByLabel('수정 자동 승인')).toHaveValue('')
  await expect(win.getByLabel('수정 자동 승인').locator('option').first()).toHaveText(
    '앱 설정 따름 (켜짐)',
  )
  await win.getByRole('button', { name: '시작' }).click()
  await expect(win.locator('.work-item')).toHaveCount(2, { timeout: 30_000 })
  const intake2 = win.getByRole('button', { name: '의도 승인' })
  await expect(intake2).toBeEnabled({ timeout: 60_000 })
  await win.getByLabel('size').selectOption('S')
  await intake2.click()
  const approveFix = win.getByRole('button', { name: '승인', exact: true })
  await expect(approveFix).toBeEnabled({ timeout: 60_000 })
  await expect(win.locator('.band')).toContainText('02 수정')
  // 자동 승인이 켜진 수정은 승인 화면에 카운트다운과 [취소]가 보인다 (4.3, D83)
  const countdown = win.getByRole('status', { name: '자동 승인 카운트다운' })
  await expect(countdown).toContainText('자동 승인까지', { timeout: 30_000 })
  await win.screenshot({ path: 'test-results/countdown.png' })
  await countdown.getByRole('button', { name: '취소', exact: true }).click()
  await expect(countdown).toBeHidden({ timeout: 30_000 })
  await expect(win.locator('.notice.auto-hold')).toContainText(
    '자동 승인하지 않음: [취소]를 누름',
    { timeout: 30_000 },
  )
  await win.screenshot({ path: 'test-results/countdown-cancelled.png' })
  await approveFix.click()

  // 리뷰 (M8): 수정 다음은 모든 크기가 리뷰다. 리뷰의 자동 승인이 켜져 있어도 지적이 있으면 카운트다운 없이 까닭을
  // 보이고 [승인]을 기다린다. 지적은 [산출물]의 review.md에 있다 (D163, D213)
  await expect(win.locator('.band')).toContainText('03 리뷰', { timeout: 60_000 })
  const approveReview = win.getByRole('button', { name: '승인', exact: true })
  await expect(approveReview).toBeEnabled({ timeout: 60_000 })
  await expect(countdown).toBeHidden()
  await expect(win.locator('.notice.auto-hold')).toContainText(
    '자동 승인하지 않음: 리뷰에 지적이 있음',
    { timeout: 30_000 },
  )
  await win.getByRole('tab', { name: '산출물', exact: true }).click()
  await expect(win.locator('.review-body')).toContainText('review.md')
  await win.screenshot({ path: 'test-results/review.png' })
  await approveReview.click()

  // Work 완료 화면 (시나리오 7-3): 판정표와 전달 버튼. origin(로컬 bare)이 있어 [push]를 누를 수 있다
  const push = win.getByRole('button', { name: 'push', exact: true })
  await expect(push).toBeEnabled({ timeout: 60_000 })
  await expect(win.locator('.band')).toContainText('04 최종 검증')
  await expect(win.getByRole('button', { name: '완료만', exact: true })).toBeEnabled()
  await expect(win.locator('table.verdicts')).toContainText('재현 절차가 더 이상 실패하지 않는다')
  await win.screenshot({ path: 'test-results/completion.png' })
  await push.click()

  // 최종 검증이 남긴 커밋 안 된 파일 때문에 고른다 (7-5): [AI 세션 열기]로 정리 세션을 연다
  await expect(win.getByRole('list', { name: '커밋 안 된 변경' })).toContainText('debug.log', {
    timeout: 30_000,
  })
  await win.getByRole('button', { name: 'AI 세션 열기', exact: true }).click()
  const closeCleanup = win.getByRole('button', { name: '정리 세션 닫기', exact: true })
  const finishCleanup = win.getByRole('button', { name: '정리 끝 → push/PR 진행', exact: true })
  await expect(closeCleanup).toBeVisible({ timeout: 60_000 })
  await expect(win.getByText('git status가 깨끗합니다')).toBeVisible({ timeout: 60_000 })
  // 정리 세션 중에도 받는 [이 단계 끝나면 멈춤](D137)을 켜면 [승인하고 멈춤] 화면이 된다. 정리 세션을 끝내는 버튼은
  // 남고, 정리 세션이 열린 동안은 승인하지 않으며, 멈추는 동안은 전달하지 않는다
  const stopAfter = win.getByLabel('이 단계 끝나면 멈춤')
  await stopAfter.click()
  await expect(stopAfter).toBeChecked({ timeout: 30_000 })
  await expect(win.getByRole('button', { name: '승인하고 멈춤', exact: true })).toBeDisabled({
    timeout: 30_000,
  })
  await expect(closeCleanup).toBeEnabled()
  await expect(finishCleanup).toBeDisabled()
  await win.screenshot({ path: 'test-results/cleanup-stop.png' })
  await stopAfter.click()
  await expect(stopAfter).not.toBeChecked({ timeout: 30_000 })
  await expect(finishCleanup).toBeEnabled({ timeout: 30_000 })
  await win.screenshot({ path: 'test-results/cleanup.png' })
  await finishCleanup.click()
  const done = win.locator('.notice.done')
  await expect(done).toContainText('Work 완료 (전달: push)', { timeout: 60_000 })
  await expect(done).toContainText('비교 URL이 없습니다')
  const badge2 = win.locator('.work-item.selected .badge')
  await expect(badge2).toHaveText('완료')
  const workId2 = /w-\d{8}-\d{3}/.exec(
    (await win.locator('.action-bar .info').textContent()) ?? '',
  )?.[0]
  expect(workId2).toBeTruthy()
  expect(git(remote, 'branch', '--list', `relay/${workId2 ?? ''}`)).toContain(
    `relay/${workId2 ?? ''}`,
  )
  await win.screenshot({ path: 'test-results/delivered.png' })

  // [Work 정리] (시나리오 8): 요약을 보이고 [정리]하면 worktree를 지우고 보관됨이 된다
  await win.getByRole('button', { name: 'Work 정리', exact: true }).click()
  const clean = win.getByRole('dialog', { name: /Work 정리/ })
  await expect(clean.getByLabel('정리 요약')).toContainText('origin에 push됐습니다', {
    timeout: 30_000,
  })
  await expect(clean.getByLabel('작업 브랜치 삭제')).not.toBeChecked()
  await win.screenshot({ path: 'test-results/clean.png' })
  await clean.getByRole('button', { name: '정리', exact: true }).click()
  await expect(clean).toBeHidden({ timeout: 30_000 })
  await expect(badge2).toHaveText('보관됨', { timeout: 30_000 })
  const worktree = findDir(path.join(home, 'projects'), workId2 ?? '', 'worktrees')
  expect(worktree).toBeNull()
  expect(findFile(path.join(home, 'projects'), 'pr.md', '04-verify')).not.toBeNull()
  await win.screenshot({ path: 'test-results/archived.png' })

  // M6: 앱을 끈다(살아 있는 세션이 있어 종료 확인을 거친다). 되감기가 백업 브랜치를 만들기 전에 앱이 꺼진 것처럼
  // 첫 Work의 work.json에 진행 중 작업 기록을 넣고, 꺼진 동안 스크립트가 decisions.md를 고친다
  await app.close()
  const works = path.dirname(findDir(path.join(home, 'projects'), workId2 ?? '', 'works') ?? '')
  const workId1 = fs.readdirSync(works).sort()[0] ?? ''
  const dir1 = path.join(works, workId1)
  const w1 = JSON.parse(fs.readFileSync(path.join(dir1, 'work.json'), 'utf8')) as {
    tasks: { id: string; created_at: string; start_commit?: string }[]
    operation?: object
  }
  const intake3 = w1.tasks.find((t) => t.id === 't-03')
  w1.operation = {
    kind: 'rewind',
    stage: 'backup',
    started_at: w1.tasks.at(-1)?.created_at,
    node: 'intake',
    from_task: 't-04',
    instruction: null,
    discard: ['t-03', 't-04'],
    reset_to: intake3?.start_commit,
    backup_branch: `relay/${workId1}-discarded-1`,
    backup_commit: null,
  }
  fs.writeFileSync(path.join(dir1, 'work.json'), `${JSON.stringify(w1, null, 2)}\n`)
  fs.appendFileSync(path.join(dir1, 'decisions.md'), '\n스크립트가 더한 줄\n')

  // 다시 켜면 첫 Work의 배지가 끊긴 작업이다 (시나리오 9-4, D121)
  app = await launch()
  const win2 = await app.firstWindow()
  const item1 = win2.locator('.work-item').nth(1)
  await expect(item1.locator('.badge')).toHaveText('끊긴 작업', { timeout: 30_000 })
  await item1.click()
  // 패널 맨 위에 무엇이 어디서 끊겼는지와 [다시 시도]·[무시] (D123)
  const cut = win2.getByRole('alert', { name: '끊긴 작업' })
  await expect(cut).toContainText('되감기가 끊겼습니다', { timeout: 30_000 })
  await expect(cut).toContainText('끊긴 곳: 백업 브랜치를 만드는 단계')
  await expect(cut).toContainText('폐기할 task: 03 의도 정리, 04 재현과 관찰')
  await expect(cut.getByRole('button', { name: '무시', exact: true })).toBeEnabled()
  // 끊긴 동안은 [다시 시도], [무시], Work 설정만 받는다 (D122)
  await expect(win2.getByRole('button', { name: '단계 선택', exact: true })).toHaveCount(0)
  await expect(win2.getByRole('button', { name: 'Work 설정', exact: true })).toBeVisible()
  // 앱 밖에서 바뀐 decisions.md (D124)
  const changed = win2.locator('.recovery .notice', { hasText: '앱 밖에서 바뀐 파일이 있습니다' })
  await expect(changed).toContainText('decisions.md: 내용이 바뀜')
  await win2.screenshot({ path: 'test-results/recovery.png' })
  await changed.getByRole('button', { name: '확인', exact: true }).click()
  await expect(changed).toBeHidden({ timeout: 30_000 })

  // [다시 시도]: 끊긴 곳부터 잇는다. 코드는 이미 되돌릴 커밋이라 백업 없이 폐기하고 intake를 되감기로 시작한다
  await cut.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(win2.getByRole('tab', { name: /05 의도 정리/ })).toBeVisible({ timeout: 60_000 })
  await expect(win2.locator('.band')).toContainText('05 의도 정리 · 새 세션 · 이유: 되감기')
  await expect(cut).toBeHidden()
  await expect(item1.locator('.badge')).not.toHaveText('끊긴 작업')
  await expect(win2.locator('.tab.discarded')).toHaveCount(4)
  await expect(win2.getByRole('button', { name: '의도 승인' })).toBeEnabled({ timeout: 60_000 })
  await win2.screenshot({ path: 'test-results/recovered.png' })
})

function lastPid(text: string): number {
  return Number([...text.matchAll(/PID (\d+)/g)].pop()?.[1] ?? 0)
}

function lastSize(text: string): string | undefined {
  return [...text.matchAll(/SIZE (\d+x\d+)/g)].pop()?.[1]
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** worktrees 아래의 name 폴더. 없으면 null */
function findDir(dir: string, name: string, parent: string): string | null {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue
    const p = path.join(dir, e.name)
    if (e.name === name && path.basename(dir) === parent) return p
    const found = findDir(p, name, parent)
    if (found) return found
  }
  return null
}

/** name 파일을 찾는다. within이 있으면 그 이름의 폴더 안에서만 찾는다 */
function findFile(dir: string, name: string, within?: string): string | null {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isFile() && e.name === name && (!within || path.basename(dir) === within)) return p
    if (e.isDirectory() && e.name !== 'worktrees') {
      const found = findFile(p, name, within)
      if (found) return found
    }
  }
  return null
}
