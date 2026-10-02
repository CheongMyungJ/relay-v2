// 보고서 보관. 기간별 폴더에 보고서 하나를 JSON 파일 하나로 둔다: reports/2026-09/report-3.json
// 정산팀이 밤 배치 뒤에 가져가고, 배치가 도는 도중에도 읽는다.
import { now } from '../clock.js'
import { stamp } from '../util/ids.js'

export function reportDir(period) {
  return `reports/${period ?? 'no-period'}`
}

export function reportPath(period, reportId) {
  if (!reportId) throw new Error('reportId가 필요합니다')
  return `${reportDir(period)}/${reportId}.json`
}

/**
 * 보고서를 보관소에 저장하고 경로를 돌려준다.
 * 쓰다 만 파일을 정산팀이 읽어 가지 않게, 같은 폴더의 임시 파일에 다 쓴 뒤 제 이름으로 옮긴다.
 * @param {ReturnType<import('./file-store.js').createFileStore>} files
 * @param {{ reportId: string, period?: string | null }} report
 */
export async function saveReport(files, report) {
  const path = reportPath(report.period, report.reportId)
  const tmp = `${reportDir(report.period)}/.${stamp(now())}.tmp`
  await files.writeFile(tmp, JSON.stringify(report))
  await files.rename(tmp, path)
  return path
}

export async function loadReport(files, period, reportId) {
  return JSON.parse(await files.readFile(reportPath(period, reportId)))
}

/** 기간의 보관된 보고서 경로들 (임시 파일은 빼고) */
export function listReports(files, period) {
  return files
    .list(`${reportDir(period)}/`)
    .filter((p) => p.endsWith('.json') && !p.slice(p.lastIndexOf('/') + 1).startsWith('.'))
}

/** 남은 임시 파일 (중간에 실패한 저장의 흔적) */
export function strayTemps(files, period) {
  return files.list(`${reportDir(period)}/`).filter((p) => p.endsWith('.tmp'))
}
