// [스모크] 기본 모델·추론 수준([에이전트] 구역)과 단계별 엔진·모델·추론 수준([단계별 진행] 표): 설정 화면에서 고르고
// 저장하면 config.json에 쓰고, 다시 켜도 고른 값이 보인다. 추론 수준을 지원하지 않는 모델이면 칸이 꺼지고 그렇다고 보인다.
// 설정 찾기, 바꾼 설정만 보기, 진행 방식 묶음, [기본값으로]가 화면에서 이어지는지 본다 (D527~D531).
// 같은 규칙(해석, 검사, 한 단계만 바꾸기, 찾기, 묶음)은 [단위] agent.test.ts, config.test.ts, settings-view.test.ts가 본다.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from '@playwright/test'

const APP_DIR = path.resolve(__dirname, '../..')
const STEPS = [
  '의도 정리',
  '원인 분석과 수정',
  '설계와 계획',
  '구현',
  '계획과 리팩터링',
  '설계 문답',
  '실행',
  '리뷰와 검증',
  'PR 대응',
  // 노드가 아닌 곁 세션과 기본 세션도 같은 줄로 고른다 (D391, D399)
  '곁 세션',
  '기본 세션',
]

let root: string
let env: Record<string, string>

function launch(): Promise<ElectronApplication> {
  const exe = process.env['RELAY_APP_EXE']
  return exe
    ? electron.launch({ executablePath: exe, env })
    : electron.launch({ args: [APP_DIR], env })
}

async function openSettings(app: ElectronApplication): Promise<Page> {
  const win = await app.firstWindow()
  await expect(win.locator('.layout')).toBeVisible()
  await win.locator('.sidebar').getByRole('button', { name: '설정', exact: true }).click()
  return win
}

const field = (win: Page, label: string) => win.getByLabel(label, { exact: true })

/** 설정 화면 왼쪽의 구역을 고른다 (D527) */
const section = (win: Page, name: string) =>
  win
    .getByRole('navigation', { name: '설정 구역' })
    .getByRole('button', { name, exact: true })
    .click()

test.beforeAll(() => {
  root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-agent-')))
  env = { ...process.env, RELAY_HOME: path.join(root, 'home'), RELAY_UPDATE: 'off' } as Record<
    string,
    string
  >
})

test.afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
})

test('기본 모델·추론 수준과 단계별 설정을 고르고 저장하면 다시 켜도 보인다', async () => {
  const app = await launch()
  const win = await openSettings(app)
  await section(win, '에이전트')
  // 기본 엔진은 그대로 있고, 모델·추론 수준은 엔진 기본(빈 값)이 기본이다
  await expect(field(win, '기본 엔진')).toHaveValue('claude')
  await expect(field(win, '기본 모델')).toHaveValue('')
  await expect(field(win, '기본 추론 수준')).toHaveValue('')
  await field(win, '기본 모델').selectOption('opus')
  await field(win, '기본 추론 수준').selectOption('high')

  // 단계별 진행 표의 엔진·모델 열은 한 줄 요약이고, 펼치면 아홉 단계와 곁 세션, 기본 세션마다 엔진·모델·추론 수준이 있다
  await section(win, '단계별 진행')
  await expect(field(win, '구현 모델')).toBeHidden()
  await win.getByRole('button', { name: '단계마다 고르기' }).click()
  for (const step of STEPS) {
    for (const part of ['엔진', '모델', '추론 수준']) {
      await expect(field(win, `${step} ${part}`)).toBeVisible()
    }
  }
  await field(win, '설계와 계획 모델').selectOption('sonnet')
  await field(win, '설계와 계획 추론 수준').selectOption('xhigh')
  await field(win, '구현 엔진').selectOption('codex')
  await field(win, '구현 모델').selectOption('gpt-6.1-sol')
  await field(win, '구현 추론 수준').selectOption('ultra')
  // 한 단계를 바꿔도 다른 단계는 그대로다
  await expect(field(win, '설계와 계획 모델')).toHaveValue('sonnet')
  await expect(field(win, '설계와 계획 추론 수준')).toHaveValue('xhigh')
  await expect(field(win, '실행 모델')).toHaveValue('')

  // 추론 수준을 지원하지 않는 모델이면 칸이 꺼지고 안내가 보인다
  await field(win, '리뷰와 검증 추론 수준').selectOption('max')
  await field(win, '리뷰와 검증 모델').selectOption('haiku')
  await expect(field(win, '리뷰와 검증 추론 수준')).toBeDisabled()
  await expect(field(win, '리뷰와 검증 추론 수준')).toHaveValue('')
  await expect(
    win
      .getByRole('group', { name: '공통' })
      .first()
      .getByText('이 모델은 추론 수준을 지원하지 않음'),
  ).toBeVisible()
  // 바꾼 줄은 표시되고 구역 목록에 그 수가 보인다 (D531)
  await expect(
    win.getByRole('navigation', { name: '설정 구역' }).getByRole('button', { name: '단계별 진행' }),
  ).toContainText('3')
  await expect(win.getByRole('button', { name: '구현 기본값으로' })).toBeVisible()
  await expect(win.getByRole('button', { name: '실행 기본값으로' })).toHaveCount(0)
  await win.screenshot({ path: 'test-results/agent-settings.png' })
  await win.getByRole('button', { name: '저장', exact: true }).click()
  await expect(win.getByRole('button', { name: '저장', exact: true })).toBeHidden()
  await app.close()

  const config = JSON.parse(fs.readFileSync(path.join(root, 'home', 'config.json'), 'utf8')) as {
    agent_model: string
    agent_effort: string
    agent_steps: Record<string, unknown>
  }
  expect(config.agent_model).toBe('opus')
  expect(config.agent_effort).toBe('high')
  expect(config.agent_steps).toEqual({
    design: { model: 'sonnet', effort: 'xhigh' },
    implement: { engine: 'codex', model: 'gpt-6.1-sol', effort: 'ultra' },
    verify: { model: 'haiku' },
  })

  const again = await launch()
  const win2 = await openSettings(again)
  await section(win2, '에이전트')
  await expect(field(win2, '기본 모델')).toHaveValue('opus')
  await expect(field(win2, '기본 추론 수준')).toHaveValue('high')
  await section(win2, '단계별 진행')
  // 접힌 요약에 고른 값이 보인다
  await expect(win2.locator('.step-row').filter({ hasText: '구현' }).first()).toContainText(
    'Codex · gpt-6.1-sol · ultra',
  )
  await win2.getByRole('button', { name: '단계마다 고르기' }).click()
  await expect(field(win2, '설계와 계획 모델')).toHaveValue('sonnet')
  await expect(field(win2, '설계와 계획 추론 수준')).toHaveValue('xhigh')
  await expect(field(win2, '구현 엔진')).toHaveValue('codex')
  await expect(field(win2, '구현 모델')).toHaveValue('gpt-6.1-sol')
  await expect(field(win2, '구현 추론 수준')).toHaveValue('ultra')
  await expect(field(win2, '리뷰와 검증 모델')).toHaveValue('haiku')
  await expect(field(win2, '리뷰와 검증 추론 수준')).toBeDisabled()
  await again.close()
})

test('설정 찾기와 바꾼 설정만 보기, 진행 방식 묶음, [기본값으로] (D527~D531)', async () => {
  // 앞 시험이 바꾼 설정 없이 기본값에서 본다
  env = { ...env, RELAY_HOME: path.join(root, 'home-fresh') }
  const app = await launch()
  const win = await openSettings(app)
  const dialog = win.getByRole('dialog', { name: '설정', exact: true })
  // 처음에는 일반 구역만 보인다
  await expect(field(win, '테마')).toBeVisible()
  await expect(field(win, '기본 엔진')).toHaveCount(0)

  // 찾기는 구역을 가로질러 맞는 칸만 보인다. Escape는 창을 닫지 않고 찾는 말을 지운다
  const search = field(win, '설정 찾기')
  await search.fill('카운트다운')
  await expect(field(win, '자동 승인 카운트다운(초)')).toBeVisible()
  await expect(field(win, '테마')).toHaveCount(0)
  await search.fill('모델')
  await expect(field(win, '기본 모델')).toBeVisible()
  await expect(field(win, '지식 검토 모델')).toBeVisible()
  await search.fill('없는 설정 이름')
  await expect(dialog).toContainText('맞는 설정이 없습니다.')
  await search.press('Escape')
  await expect(search).toHaveValue('')
  await expect(dialog).toBeVisible()
  await expect(field(win, '테마')).toBeVisible()

  // 진행 방식: 기본이 골라져 있고, [맡기기]는 설계와 계획까지 자동 승인한다. PR 대응 줄은 바꾸지 않는다
  await section(win, '단계별 진행')
  const presets = win.getByRole('radiogroup', { name: '진행 방식' })
  await expect(presets.getByRole('radio', { name: '기본' })).toHaveAttribute('aria-checked', 'true')
  await expect(field(win, '설계와 계획 자동 승인')).not.toBeChecked()
  await presets.getByRole('radio', { name: '맡기기' }).click()
  await expect(field(win, '설계와 계획 자동 승인')).toBeChecked()
  await expect(field(win, 'PR 대응 자동 승인')).not.toBeChecked()
  // [꼼꼼히]는 모든 단계를 끄고 결정마다 묻는다
  await presets.getByRole('radio', { name: '꼼꼼히' }).click()
  await expect(field(win, '구현 자동 승인')).not.toBeChecked()
  await expect(field(win, '구현 질문 방식')).toHaveValue('confirm_each')
  // 한 칸을 바꾸면 직접 고름이다
  await field(win, '구현 자동 승인').check()
  await expect(presets.getByRole('radio', { checked: true })).toHaveCount(0)
  await presets.getByRole('radio', { name: '기본' }).click()

  // 바꾼 설정만 보기: 기본값과 다른 칸만 구역을 가로질러 보이고, [기본값으로]로 되돌린다
  await section(win, '일반')
  await field(win, '세션 상한').fill('5')
  await field(win, '바꾼 설정만 보기').check()
  await expect(field(win, '세션 상한')).toBeVisible()
  await expect(field(win, '테마')).toHaveCount(0)
  // 고치다 값이 기본값(3)을 지나도 칸이 사라지지 않는다
  await field(win, '세션 상한').fill('3')
  await expect(field(win, '세션 상한')).toBeVisible()
  await field(win, '세션 상한').fill('5')
  // 선택지 이름으로도 찾는다
  await search.fill('Codex')
  await expect(field(win, '기본 엔진')).toHaveCount(0)
  await field(win, '바꾼 설정만 보기').uncheck()
  await expect(field(win, '기본 엔진')).toBeVisible()
  await search.fill('')
  await field(win, '바꾼 설정만 보기').check()
  await win.screenshot({ path: 'test-results/settings-changed.png' })
  await win.getByRole('button', { name: '세션 상한 기본값으로' }).click()
  await expect(dialog).toContainText('기본값과 다른 설정이 없습니다.')
  await win.getByRole('button', { name: '취소', exact: true }).click()
  await app.close()
})
