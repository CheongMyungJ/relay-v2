// 보관소(파일 저장소). 운영에서는 오브젝트 저장소에 쓰지만, 여기서는 파일을 메모리에 두고 지연만 흉내 낸다.
import { sleep } from '../clock.js'
import { jitter } from '../util/jitter.js'

function notFound(path) {
  const error = new Error(`ENOENT: 파일이 없습니다: ${path}`)
  error.code = 'ENOENT'
  error.path = path
  return error
}

function checkPath(path) {
  if (typeof path !== 'string' || !path || path.startsWith('/') || path.split('/').includes('..')) {
    throw new TypeError(`경로가 틀렸습니다: ${path}`)
  }
}

/**
 * @param {object} [o]
 * @param {{ baseMs?: number, perKbMs?: number, jitterMs?: number }} [o.latency] 요청 한 번에 걸리는 시간
 */
export function createFileStore(o = {}) {
  const files = new Map()
  const { baseMs = 0, perKbMs = 0, jitterMs = 0 } = o.latency ?? {}
  const wait = (bytes = 0) => sleep(baseMs + Math.round((bytes / 1024) * perKbMs) + jitter(jitterMs))
  const stats = { writes: 0, reads: 0, renames: 0 }

  return {
    /** 파일을 쓴다. 실제 저장소처럼 쓰는 도중에는 앞부분만 보인다 */
    async writeFile(path, text) {
      checkPath(path)
      if (typeof text !== 'string') throw new TypeError('내용은 문자열이어야 합니다')
      stats.writes++
      files.set(path, text.slice(0, Math.floor(text.length / 2)))
      await wait(text.length)
      files.set(path, text)
    },

    /** 부른 때의 내용을 돌려준다 */
    async readFile(path) {
      checkPath(path)
      stats.reads++
      const text = files.get(path)
      await wait(text?.length ?? 0)
      if (text === undefined) throw notFound(path)
      return text
    },

    /** 이름을 바꾼다. 한 번에 일어나므로 옮기는 도중의 모습은 보이지 않는다. 이미 있는 to는 덮어쓴다 */
    async rename(from, to) {
      checkPath(from)
      checkPath(to)
      stats.renames++
      await wait()
      if (!files.has(from)) throw notFound(from)
      files.set(to, files.get(from))
      files.delete(from)
    },

    async remove(path) {
      checkPath(path)
      await wait()
      return files.delete(path)
    },

    exists(path) {
      return files.has(path)
    },

    /** prefix로 시작하는 경로, 이름 순 */
    list(prefix = '') {
      return [...files.keys()].filter((p) => p.startsWith(prefix)).sort()
    },

    get stats() {
      return { ...stats }
    },
  }
}
