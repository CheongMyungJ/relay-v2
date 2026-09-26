#!/usr/bin/env node
// 가짜 gh (docs/implementation.md 8.2). M2는 등록 점검(D67)의 `gh auth status`만 흉내 낸다.
// FAKE_GH_AUTH가 fail이면 종료 코드 1이다. PR 흉내와 인자 기록은 M5에서 더한다.
const [cmd, sub] = process.argv.slice(2)
if (cmd === 'auth' && sub === 'status') {
  const ok = process.env.FAKE_GH_AUTH !== 'fail'
  process.stdout.write(
    ok ? 'Logged in to github.com (fake)\n' : 'You are not logged into any GitHub hosts.\n',
  )
  process.exit(ok ? 0 : 1)
}
process.stderr.write(`가짜 gh: 모르는 명령 ${process.argv.slice(2).join(' ')}\n`)
process.exit(2)
