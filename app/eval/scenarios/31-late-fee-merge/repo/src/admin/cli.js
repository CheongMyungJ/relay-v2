// 매장 직원용 명령: node src/admin/cli.js <명령> [인자...]
import { listTools } from '../catalog/tools.js'
import { getRental, listRentals, resetStore } from '../rentals/store.js'
import { seedRentals } from '../seed.js'
import { daysBetween } from '../util/dates.js'
import { formatWon } from '../util/money.js'

const HELP = '명령: tools | rentals | fee <대여id> <날짜>'

export function runCommand(args, out = console.log) {
  const [cmd, ...rest] = args
  switch (cmd) {
    case 'tools':
      for (const t of listTools()) out(`${t.id} ${t.name} ${formatWon(t.dailyRate)}/일`)
      return 0
    case 'rentals':
      for (const r of listRentals())
        out(`${r.id} ${r.toolName} ${r.startDate}~${r.dueDate} ${r.returnedOn ? `반납 ${r.returnedOn}` : '대여 중'}`)
      return 0
    case 'fee': {
      const [id, date] = rest
      if (!id || !date) {
        out(HELP)
        return 1
      }
      const r = getRental(id)
      const d = daysBetween(r.dueDate, date)
      const fee = d > 1 ? Math.min(Math.round((r.dailyRate * d) / 2), r.deposit) : 0
      out(`${r.id} ${r.toolName}: ${d > 0 ? `${d}일 늦음` : '늦지 않음'}, 연체료 ${formatWon(fee)}`)
      return 0
    }
    default:
      out(HELP)
      return 1
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  resetStore(seedRentals)
  process.exitCode = runCommand(process.argv.slice(2))
}
