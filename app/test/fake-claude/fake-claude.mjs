#!/usr/bin/env node
// 가짜 claude (M0, I25의 최소판). 출력만 낸다: 표식, 받은 인자, PID, 터미널 크기, 한글 한 줄.
// 크기가 바뀌면 새 크기를 출력한다. 끝낼 때까지 살아 있는다.
// 흐름 시험용 기능(훅 신호, 시나리오 파일)은 M2에서 더한다 (docs/implementation.md 8.2).
const size = () => {
  const [cols, rows] = process.stdout.getWindowSize()
  return `${cols}x${rows}`
}

process.stdout.write('FAKE-CLAUDE READY\r\n')
process.stdout.write(`ARGS ${JSON.stringify(process.argv.slice(2))}\r\n`)
process.stdout.write(`PID ${process.pid}\r\n`)
let last = size()
process.stdout.write(`SIZE ${last}\r\n`)
process.stdout.write('한글 출력 확인\r\n')

// Windows의 Node는 stdin을 읽지 않으면 resize 이벤트를 내지 않는다(CI에서 관찰).
// 크기를 직접 물어 바뀌면 출력한다.
setInterval(() => {
  const now = size()
  if (now !== last) {
    last = now
    process.stdout.write(`SIZE ${now}\r\n`)
  }
}, 200)
