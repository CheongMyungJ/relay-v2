// [탐색] test/flow/explore-gui-prep.test.ts가 만든 RELAY_HOME으로 앱을 띄워 Work 완료 화면의 [지식] 탭과 지식 화면을
// 찍고, 보이는 조작(버튼과 입력)을 적는다. 합격 판정 없이 test-results/explore/gui/에 남긴다.
import fs from 'node:fs'
import path from 'node:path'
import { _electron as electron, test } from '@playwright/test'

const APP_DIR = path.resolve(__dirname, '../..')
const OUT = path.join(APP_DIR, 'test-results', 'explore', 'gui')
const prep = path.join(APP_DIR, 'test-results', 'explore', 'gui-home.txt')
const FAKE = path.resolve(__dirname, '../fake-claude/fake-claude.mjs')

test('[탐색] 지식 탭과 지식 화면', async () => {
  test.skip(!fs.existsSync(prep), 'gui-home.txt 없음')
  test.setTimeout(120_000)
  fs.mkdirSync(OUT, { recursive: true })
  const { home } = JSON.parse(fs.readFileSync(prep, 'utf8')) as { home: string }
  const app = await electron.launch({
    args: [APP_DIR],
    env: { ...process.env, RELAY_HOME: home, CLAUDE_BIN: FAKE } as Record<string, string>,
  })
  const notes: string[] = []
  try {
    const win = await app.firstWindow()
    await win.setViewportSize({ width: 1440, height: 900 })
    await win.locator('.layout').waitFor()
    await win.locator('.work-item').first().click()
    await win.waitForTimeout(2000)
    await win.screenshot({ path: path.join(OUT, '01-work.png') })
    const tab = win.getByRole('tab', { name: /^지식/ })
    await tab.first().waitFor({ timeout: 30_000 })
    notes.push(`지식 탭 이름: ${await tab.first().textContent()}`)
    await tab.first().click()
    await win.waitForTimeout(500)
    await win.screenshot({ path: path.join(OUT, '02-knowledge-tab.png'), fullPage: true })
    const body = win.locator('.review-body')
    notes.push('--- 지식 탭 글 ---', (await body.innerText()).slice(0, 6000))
    const box = await body.boundingBox()
    const scroll = await body.evaluate((el) => ({ h: el.scrollHeight, c: el.clientHeight }))
    notes.push(
      `지식 탭 높이: 보이는 ${scroll.c}px / 전체 ${scroll.h}px, 상자 ${JSON.stringify(box)}`,
    )
    // 스크롤하며 몇 장 더 찍는다
    for (let i = 1; i <= 4; i++) {
      await body.evaluate((el, y) => el.scrollTo(0, y), i * 700)
      await win.screenshot({ path: path.join(OUT, `02-knowledge-tab-${i}.png`) })
    }
    notes.push(
      `버튼 줄: ${await win
        .locator('.knowledge-line')
        .innerText()
        .catch(() => '없음')}`,
    )

    // 지식 화면
    await win.getByRole('button', { name: '지식', exact: true }).click()
    const dlg = win.getByRole('dialog', { name: /^지식 · / })
    await dlg.waitFor({ timeout: 30_000 })
    await win.waitForTimeout(1500)
    await win.screenshot({ path: path.join(OUT, '03-screen.png') })
    notes.push('--- 지식 화면 글 ---', (await dlg.innerText()).slice(0, 6000))
    const buttons = await dlg.getByRole('button').allInnerTexts()
    notes.push(`지식 화면 버튼: ${JSON.stringify([...new Set(buttons)])}`)
    const inputs = await dlg.locator('input, select, textarea').count()
    notes.push(`지식 화면 입력 칸 수: ${inputs}`)
    const search = await dlg.getByPlaceholder(/검색|찾기/).count()
    notes.push(`검색 칸: ${search}`)
  } finally {
    fs.writeFileSync(path.join(OUT, 'notes.txt'), notes.join('\n'))
    await app.close()
  }
})

const many = path.join(APP_DIR, 'test-results', 'explore', 'gui-many.txt')

test('[탐색] 항목이 많은 지식 화면과 고침 칸', async () => {
  test.skip(!fs.existsSync(many), 'gui-many.txt 없음')
  test.setTimeout(120_000)
  fs.mkdirSync(OUT, { recursive: true })
  const { home } = JSON.parse(fs.readFileSync(many, 'utf8')) as { home: string }
  const app = await electron.launch({
    args: [APP_DIR],
    env: { ...process.env, RELAY_HOME: home, CLAUDE_BIN: FAKE } as Record<string, string>,
  })
  const notes: string[] = []
  try {
    const win = await app.firstWindow()
    await win.setViewportSize({ width: 1440, height: 900 })
    await win.locator('.layout').waitFor()
    const t0 = Date.now()
    await win.getByRole('button', { name: '지식', exact: true }).click()
    const dlg = win.getByRole('dialog', { name: /^지식 · / })
    await dlg.getByText(/^팀 \(\d+\)/).waitFor({ timeout: 60_000 })
    notes.push(`열기까지 ${Date.now() - t0}ms`)
    const heads = await dlg.locator('h3, h4, strong').allInnerTexts()
    notes.push(`묶음 머리: ${JSON.stringify(heads.filter((x) => /\(\d+\)/.test(x)))}`)
    const size = await dlg.evaluate((el) => ({ h: el.scrollHeight, c: el.clientHeight }))
    notes.push(`높이: 보이는 ${size.c}px / 전체 ${size.h}px`)
    notes.push(`재확인 필요 표시 수: ${await dlg.getByText('재확인 필요').count()}`)
    notes.push(
      `[그대로 맞음] 버튼 수: ${await dlg.getByRole('button', { name: '그대로 맞음' }).count()}`,
    )
    notes.push(
      `[모두 그대로 맞음] 같은 일괄 버튼: ${await dlg.getByRole('button', { name: /모두/ }).count()}`,
    )
    notes.push(
      `검색·거르기 입력: ${await dlg.locator('input[type=search], input[placeholder]').count()}`,
    )
    await win.screenshot({ path: path.join(OUT, '10-many.png') })
    await dlg.getByRole('button', { name: '고침', exact: true }).first().click()
    const labels = await dlg.locator('.knowledge-edit label span').allInnerTexts()
    notes.push(`팀 항목 고침 칸: ${JSON.stringify(labels)}`)
    notes.push(`종류·갈래 고르기: ${await dlg.locator('.knowledge-edit select').count()}`)
    await win.screenshot({ path: path.join(OUT, '11-edit.png') })
  } finally {
    fs.writeFileSync(path.join(OUT, 'notes-many.txt'), notes.join('\n'))
    await app.close()
  }
})
