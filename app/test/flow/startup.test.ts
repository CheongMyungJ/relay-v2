// 앱을 켤 때 깨진 프로젝트나 재시작 조정에 실패한 Work 하나가 앱 전체를 막지 않는다 (D332, 점검 A11)
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { harness, makeRepo, register, settle, sleep, type Harness } from '../support/harness'
import { REPO_FILES, REQUEST } from '../support/scenarios'

let h: Harness | undefined
afterEach(async () => {
  await h?.close()
  h = undefined
})

/** 파일을 쓸 수 없게 표시한다 (Linux의 chattr +i, root만). 안 되면 false */
function immutable(file: string, on: boolean): boolean {
  if (process.platform !== 'linux') return false
  return spawnSync('chattr', [on ? '+i' : '-i', file]).status === 0
}

const canLock = (() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-chattr-'))
  const file = path.join(dir, 'x')
  fs.writeFileSync(file, '')
  const ok = immutable(file, true)
  if (ok) immutable(file, false)
  fs.rmSync(dir, { recursive: true, force: true })
  return ok
})()

async function work(hh: Harness, projectId: string): Promise<{ key: string; dir: string }> {
  const r = await hh.relay.createWork(projectId, {
    request: REQUEST,
    baseBranch: 'main',
    type: 'bugfix',
    baseLocation: 'local',
  })
  if (!r.ok) throw new Error(r.error)
  const id = r.workKey.split('/')[1] ?? ''
  return { key: r.workKey, dir: path.join(hh.home, 'projects', projectId, 'works', id) }
}

describe('[흐름] 앱을 켤 때 문제 있는 것만 뺀다 (D332)', () => {
  it('읽을 수 없는 project.json은 그 프로젝트만 빼고 앱을 열고, 파일과 까닭을 경고한다. 파일은 그대로 둔다', async () => {
    h = await harness()
    const hh = h
    const a = await register(hh, makeRepo(hh.root, 'a', REPO_FILES).repo)
    const b = await register(hh, makeRepo(hh.root, 'b', REPO_FILES).repo)
    await hh.relay.close()
    const file = path.join(hh.home, 'projects', a, 'project.json')
    fs.writeFileSync(file, '{ 틀림')
    await hh.reopen()
    const snap = hh.relay.snapshot()
    expect(snap.projects.map((p) => p.id)).toEqual([b])
    expect(snap.warnings.join('\n')).toContain(file)
    expect(fs.readFileSync(file, 'utf8')).toBe('{ 틀림')
  })

  it.skipIf(!canLock)(
    '재시작 조정에서 work.json을 쓰지 못한 Work만 빼고 앱을 열고 경고한다',
    async () => {
      h = await harness()
      const hh = h
      const projectId = await register(hh, makeRepo(hh.root, 'a', REPO_FILES).repo)
      const stuck = await work(hh, projectId)
      const ok = await work(hh, projectId)
      // 세션이 떠 있을 때의 work.json(앱이 갑자기 꺼진 때)을 남긴다
      for (let i = 0; i < 100; i++) {
        const v = hh.relay.snapshot().works.find((w) => w.key === stuck.key)
        if (v?.tasks[0]?.live) break
        await sleep(50)
      }
      const running = fs.readFileSync(path.join(stuck.dir, 'work.json'), 'utf8')
      await hh.relay.close()
      await settle(hh, stuck.key)
      const file = path.join(stuck.dir, 'work.json')
      fs.writeFileSync(file, running)
      expect(immutable(file, true)).toBe(true)
      try {
        await hh.reopen()
        const snap = hh.relay.snapshot()
        expect(snap.works.map((w) => w.key)).toEqual([ok.key])
        expect(snap.warnings.join('\n')).toContain(stuck.key)
      } finally {
        immutable(file, false)
      }
    },
  )
})
