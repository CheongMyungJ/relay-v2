// [흐름] PR 대응 (docs/implementation.md M10, 시나리오 10-3~10-8, D168~D207).
// 가짜 gh(8.2)와 로컬 bare 원격으로 [실제]와 같은 공통 시나리오(pr-scenario.ts의 runRespondScenario)를 돌고, 가짜로만 만들
// 수 있는 경우를 더 본다: 게시가 실패하거나 끊긴 뒤의 [다시 시도](D123, D194), 게시하고도 오류를 돌려준 요청(D194),
// push가 원격의 새 커밋 때문에 거절된 라운드(D193), 없어진 코멘트(D205), 대응 task가 도는 동안의 재시작(시나리오 9-7)과
// fast-forward(D193), 사람 지시만의 라운드(D182), 기존 테스트 변경(D202), replies.md의 오류(D204).
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CART_FILES, FakeGitHub, FakeWorld } from './github'
import { harness, makeRepo, register, type Harness } from './harness'
import { runRespondScenario, type PrContext } from './pr-scenario'

let h: Harness | undefined

afterEach(async () => {
  await h?.close()
  h = undefined
})

interface Setup {
  ctx: PrContext
  gh: FakeGitHub
  world: FakeWorld
  repo: string
  remote: string
}

async function setup(o: { env?: Record<string, string>; config?: object } = {}): Promise<Setup> {
  h = await harness({ config: o.config ?? {}, env: o.env ?? {} })
  const { repo, remote } = makeRepo(h.root, 'cart', CART_FILES)
  const projectId = await register(h, repo)
  const scratch = path.join(h.root, 'outside')
  fs.mkdirSync(scratch)
  const gh = new FakeGitHub(path.join(h.root, 'record'), remote, scratch)
  const world = new FakeWorld(gh)
  return {
    ctx: { h, world, projectId, repo, note: () => undefined, created: [] },
    gh,
    world,
    repo,
    remote,
  }
}

describe('[흐름] PR 대응 (M10, 가짜 gh)', () => {
  it('공통 시나리오: 다시 실행, [대응 시작], 승인 뒤 push와 답글 게시, 처리됨, 판정표 경고, 머지 (runRespondScenario)', async () => {
    const s = await setup()
    await runRespondScenario(s.ctx)
  })
})
