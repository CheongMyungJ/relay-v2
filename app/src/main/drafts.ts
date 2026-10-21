// Work 초안 폴더 하나 (D404, D421, I135): 폴더를 만들고 보다가 바뀌면 다시 읽어 카드로 보낸다. 기본 세션(SessionRunner)과
// Work(WorkRunner)가 만든 곳만 달리해 같이 쓴다.
import fsp from 'node:fs/promises'
import path from 'node:path'
import { readDrafts } from '../adapters/store'
import { watchDir } from '../adapters/watch'
import { DRAFT_MAX_BYTES, isDraftFile, parseDraft } from '../core/draft'
import type { DraftSource } from '../shared/session'
import type { CommandResult, DraftView } from '../shared/views'

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** 사이드바의 Work 제목: 요청의 첫 줄 (80자에서 자름) */
export function workTitle(request: string): string {
  const line = request.split(/\r?\n/).find((l) => l.trim()) ?? ''
  const t = line.trim()
  return t.length > 80 ? `${t.slice(0, 80)}…` : t
}

export interface DraftFolderOptions {
  dir: string
  source: DraftSource
  /** 등록된 프로젝트 id. 초안의 project를 맞춰 본다 */
  projectIds(): string[]
  /** 읽은 초안이 바뀌었다 */
  changed(): void
  /** 아직 쓰는 폴더인가. 지운 세션이나 Work면 거짓이라 다시 읽거나 감시하지 않는다 */
  live(): boolean
}

export class DraftFolder {
  private drafts: DraftView[] = []
  private stopWatch: () => void = () => {}
  private watching: Promise<void> = Promise.resolve()
  private reading: Promise<void> | null = null
  private again = false

  constructor(private readonly o: DraftFolderOptions) {}

  get dir(): string {
    return this.o.dir
  }

  /** 읽은 초안. 화면의 카드다 */
  get list(): DraftView[] {
    return this.drafts
  }

  /**
   * 폴더를 (다시) 만들고 새로 본다. 감시는 폴더가 지워졌다 다시 생기거나 시작에 실패하면 알리지 않으므로(watchDir) 세션을
   * 열 때마다 다시 건다. 겹쳐 불러도 차례로 해서 앞 감시를 늘 끈다
   */
  watch(): Promise<void> {
    const run = this.watching.then(async () => {
      if (!this.o.live()) return
      this.stop()
      await fsp.mkdir(this.o.dir, { recursive: true })
      if (!this.o.live()) return
      this.stopWatch = watchDir(this.o.dir, () => void this.refresh())
    })
    this.watching = run.catch(() => undefined)
    return run
  }

  /** 감시를 그만둔다. 다시 보려면 watch를 부른다 */
  stop(): void {
    this.stopWatch()
    this.stopWatch = () => {}
  }

  /** 폴더를 다시 읽는다. 읽는 중에 또 바뀌면 끝난 뒤 한 번 더 읽는다. 폴더가 없으면 초안이 없다 */
  refresh(): Promise<void> {
    if (this.reading) {
      this.again = true
      return this.reading
    }
    this.reading = this.readNow()
      .catch(() => undefined)
      .finally(() => {
        this.reading = null
        if (this.again) {
          this.again = false
          void this.refresh()
        }
      })
    return this.reading
  }

  private async readNow(): Promise<void> {
    if (!this.o.live()) return
    const files = await readDrafts(this.o.dir, isDraftFile, DRAFT_MAX_BYTES)
    const ids = this.o.projectIds()
    this.drafts = files.map(({ name, text, bytes }) => {
      const parsed = parseDraft(text, ids, bytes)
      return { ...parsed, ref: { source: this.o.source, name }, title: workTitle(parsed.request) }
    })
    this.o.changed()
  }

  /** 초안을 지운다: [버리기], 그 초안으로 Work를 만든 뒤 (D404) */
  async remove(name: string): Promise<CommandResult> {
    if (!isDraftFile(name)) return { ok: false, error: '초안 파일 이름이 아님' }
    try {
      await fsp.rm(path.join(this.o.dir, name), { force: true })
    } catch (e) {
      return { ok: false, error: `초안을 지우지 못함: ${message(e)}` }
    }
    await this.refresh()
    return { ok: true }
  }
}
