// gh CLI (I12). 등록 점검(D67)과 전달의 PR(시나리오 7-4)을 한다.
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describeFailure, run } from './exec'

export class GhError extends Error {}

export interface GhStatus {
  ok: boolean
  detail: string
}

/** gh auth status가 성공하는가 (D67). gh가 없으면 실패다 */
export async function ghAuthStatus(bin = 'gh', env?: NodeJS.ProcessEnv): Promise<GhStatus> {
  const r = await run(bin, ['auth', 'status'], { env, timeoutMs: 30_000 })
  if (r.code === 0) return { ok: true, detail: '로그인됨' }
  if (r.code === null && r.error?.includes('ENOENT')) {
    return { ok: false, detail: 'gh가 설치되어 있지 않음' }
  }
  return { ok: false, detail: describeFailure(r) }
}

/** 앱에는 터미널이 없으므로 묻지 않게 하고 업데이트 안내를 끈다 (gh help environment) */
function ghEnv(env: NodeJS.ProcessEnv | undefined): NodeJS.ProcessEnv {
  return { ...(env ?? process.env), GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1' }
}

export interface GhRepoOptions {
  /**
   * PR을 둘 레포: origin의 [HOST/]OWNER/REPO(core/delivery ghRepo). gh는 원격이 여럿이고 기본 레포를 정하지
   * 않았으면 upstream, github, origin 차례로 고르므로(gh 소스 context/remote.go) --repo로 준다
   */
  repo: string
  /** gh를 실행할 폴더: 메인 체크아웃 */
  cwd: string
  env?: NodeJS.ProcessEnv
}

export interface OpenPullRequest {
  url: string
  number: number
  isDraft: boolean
  baseRefName: string
}

/** head 브랜치의 열린 PR (gh pr list --head --state open --json). 없으면 null (7-4) */
export async function ghOpenPr(
  bin: string,
  o: GhRepoOptions & { head: string },
): Promise<OpenPullRequest | null> {
  const r = await run(
    bin,
    [
      'pr',
      'list',
      '--repo',
      o.repo,
      '--head',
      o.head,
      '--state',
      'open',
      '--json',
      'url,number,isDraft,baseRefName',
      '--limit',
      '1',
    ],
    { cwd: o.cwd, env: ghEnv(o.env), timeoutMs: 60_000 },
  )
  if (r.code !== 0) throw new GhError(`gh pr list 실패: ${describeFailure(r)}`)
  let list: unknown
  try {
    list = JSON.parse(r.stdout || '[]')
  } catch {
    throw new GhError(`gh pr list의 출력을 읽지 못함: ${r.stdout.slice(0, 200)}`)
  }
  const first: unknown = Array.isArray(list) ? list[0] : undefined
  if (!first || typeof first !== 'object') return null
  const pr = first as Record<string, unknown>
  if (typeof pr['url'] !== 'string') return null
  return {
    url: pr['url'],
    number: typeof pr['number'] === 'number' ? pr['number'] : 0,
    isDraft: pr['isDraft'] === true,
    baseRefName: typeof pr['baseRefName'] === 'string' ? pr['baseRefName'] : '',
  }
}

export interface CreatePrOptions extends GhRepoOptions {
  base: string
  head: string
  title: string
  body: string
  /** draft PR (D71) */
  draft: boolean
}

/**
 * PR을 만든다 (gh pr create). --head를 주면 gh는 브랜치를 push하지 않는다(앱이 먼저 push한다). 본문은
 * 명령줄 길이와 인용을 피하려고 임시 파일(--body-file)로 준다. 성공하면 gh가 표준 출력에 찍는 PR 주소를
 * 돌려준다 (gh 소스 pkg/cmd/pr/create).
 */
export async function ghCreatePr(bin: string, o: CreatePrOptions): Promise<string> {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'relay-pr-'))
  const bodyFile = path.join(dir, 'body.md')
  try {
    await fsp.writeFile(bodyFile, o.body, 'utf8')
    const r = await run(
      bin,
      [
        'pr',
        'create',
        '--repo',
        o.repo,
        '--base',
        o.base,
        '--head',
        o.head,
        '--title',
        o.title,
        '--body-file',
        bodyFile,
        ...(o.draft ? ['--draft'] : []),
      ],
      { cwd: o.cwd, env: ghEnv(o.env), timeoutMs: 120_000 },
    )
    if (r.code !== 0) throw new GhError(`gh pr create 실패: ${describeFailure(r)}`)
    const url = r.stdout
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => /^https?:\/\//.test(l))
      .pop()
    if (!url) throw new GhError(`gh pr create가 PR 주소를 찍지 않음: ${r.stdout.slice(0, 200)}`)
    return url
  } finally {
    await fsp.rm(dir, { recursive: true, force: true })
  }
}
