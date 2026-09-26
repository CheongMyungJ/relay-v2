#!/usr/bin/env node
// 가짜 claude (M0, I25의 최소판). 출력만 낸다: 표식, 받은 인자, PID, 터미널 크기, 한글 한 줄.
// 크기가 바뀌면 새 크기를 출력한다. 끝낼 때까지 살아 있는다.
// 흐름 시험용 기능(훅 신호, 시나리오 파일)은 M2에서 더한다 (docs/implementation.md 8.2).
const size = () => `${process.stdout.columns}x${process.stdout.rows}`

process.stdout.write('FAKE-CLAUDE READY\r\n')
process.stdout.write(`ARGS ${JSON.stringify(process.argv.slice(2))}\r\n`)
process.stdout.write(`PID ${process.pid}\r\n`)
process.stdout.write(`SIZE ${size()}\r\n`)
process.stdout.write('한글 출력 확인\r\n')
process.stdout.on('resize', () => process.stdout.write(`SIZE ${size()}\r\n`))
setInterval(() => {}, 1 << 30)
