// [스모크] 기본 모델·추론 수준과 상세 설정(단계별 엔진·모델·추론 수준): 설정 화면에서 고르고 저장하면 config.json에
// 쓰고, 다시 켜도 고른 값이 보인다. 추론 수준을 지원하지 않는 모델이면 칸이 꺼지고 그렇다고 보인다.
// 같은 규칙(해석, 검사, 한 단계만 바꾸기)은 [단위] agent.test.ts, config.test.ts가 본다.
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
  // 요구사항 추출의 extract는 엔진을 고를 수 없고 늘 Claude Code다 (결정 92)
  '요구사항 추출',
  '리뷰와 검증',
  'PR 대응',
  // 노드가 아닌 곁 세션도 같은 줄로 고른다 (D391)
  '곁 세션',
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
  // 기본 엔진은 그대로 있고, 모델·추론 수준은 엔진 기본(빈 값)이 기본이다
  await expect(field(win, '기본 엔진')).toHaveValue('claude')
  await expect(field(win, '기본 모델')).toHaveValue('')
  await expect(field(win, '기본 추론 수준')).toHaveValue('')
  await field(win, '기본 모델').selectOption('opus')
  await field(win, '기본 추론 수준').selectOption('high')

  // 상세 설정은 접혀 있고, 펼치면 아홉 단계와 곁 세션마다 엔진·모델·추론 수준이 있다
  await expect(field(win, '구현 모델')).toBeHidden()
  await win.getByText('상세 설정 (단계별 엔진·모델·추론 수준)').click()
  for (const step of STEPS) {
    for (const part of ['엔진', '모델', '추론 수준']) {
      await expect(field(win, `${step} ${part}`)).toBeVisible()
    }
  }
  await expect(field(win, '요구사항 추출 엔진')).toBeDisabled()
  await expect(field(win, '요구사항 추출 엔진')).toHaveValue('claude')
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
  await expect(field(win2, '기본 모델')).toHaveValue('opus')
  await expect(field(win2, '기본 추론 수준')).toHaveValue('high')
  await win2.getByText('상세 설정 (단계별 엔진·모델·추론 수준)').click()
  await expect(field(win2, '설계와 계획 모델')).toHaveValue('sonnet')
  await expect(field(win2, '설계와 계획 추론 수준')).toHaveValue('xhigh')
  await expect(field(win2, '구현 엔진')).toHaveValue('codex')
  await expect(field(win2, '구현 모델')).toHaveValue('gpt-6.1-sol')
  await expect(field(win2, '구현 추론 수준')).toHaveValue('ultra')
  await expect(field(win2, '리뷰와 검증 모델')).toHaveValue('haiku')
  await expect(field(win2, '리뷰와 검증 추론 수준')).toBeDisabled()
  await again.close()
})
