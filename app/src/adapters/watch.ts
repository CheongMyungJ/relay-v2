// task 디렉터리 감시 (I15). 바뀌면 디바운스해 한 번 알린다. 화면을 빨리 바꾸는 용도라
// 놓쳐도 결과가 틀리지 않는다. 판정의 기준은 Stop을 받고 다시 한 검사다.
import fs from 'node:fs'

/** dir을 감시한다. 돌려준 함수로 멈춘다. 디렉터리가 없으면 아무것도 하지 않는다 */
export function watchDir(dir: string, onChange: () => void, debounceMs = 300): () => void {
  let timer: NodeJS.Timeout | undefined
  let closed = false
  let watcher: fs.FSWatcher | undefined
  try {
    watcher = fs.watch(dir, () => {
      if (closed) return
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (!closed) onChange()
      }, debounceMs)
    })
    watcher.on('error', () => {})
  } catch {
    // 감시를 못 해도 Stop 때 다시 검사한다
  }
  return () => {
    closed = true
    clearTimeout(timer)
    watcher?.close()
  }
}
