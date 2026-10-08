// 평가 하네스의 구독 사용량 확인(결정 28). run과 판정을 띄우기 전마다 get_usage(SDK 제어 요청, 모델 호출 없음)로 주간
// 사용률을 보고 남은 비율이 하한(기본 50%)에 닿으면 멈춘다. get_usage가 사용량을 주지 않으면(rate_limits_available이
// false, 토큰 인증 등) 멈추는 대신 이 실행 폴더에서 부른 실제 claude 횟수를 상한(기본 150) 안으로 묶는다(AI 결정 51).
// get_usage는 실험 기능이라 모양이 바뀔 수 있다("Experimental — the response shape may change", 2.1.293~294).
import { spawn } from 'node:child_process'
import fs from 'node:fs'

/**
 * @returns {Promise<{ available: boolean, weeklyPct: number | null, fiveHourPct: number | null,
 *   fiveHourResetsAt: string | null, weeklyResetsAt: string | null, raw: object | null }>}
 */
export function getUsage(bin, env, timeoutMs = 60_000) {
  return new Promise((resolve) => {
    const p = spawn(
      bin,
      ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose'],
      {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    )
    let out = ''
    const done = (v) => {
      clearTimeout(timer)
      try {
        p.kill()
      } catch {
        // 이미 끝났다
      }
      resolve(v)
    }
    const none = {
      available: false,
      weeklyPct: null,
      fiveHourPct: null,
      fiveHourResetsAt: null,
      weeklyResetsAt: null,
      raw: null,
    }
    const timer = setTimeout(() => done(none), timeoutMs)
    p.on('error', () => done(none))
    p.stdout.on('data', (c) => {
      out += c
      for (const line of out.split('\n')) {
        if (!line.startsWith('{')) continue
        let m
        try {
          m = JSON.parse(line)
        } catch {
          continue
        }
        if (m.type !== 'control_response' || m.response?.request_id !== 'usage-1') continue
        done(parseUsage(m.response.response ?? null))
        return
      }
    })
    p.on('close', () => done(none))
    p.stdin.end(
      JSON.stringify({
        type: 'control_request',
        request_id: 'usage-1',
        request: { subtype: 'get_usage' },
      }) + '\n',
    )
  })
}

/** get_usage 응답을 읽는다. 주간은 seven_day와 limits의 weekly 묶음 가운데 가장 높은 것 */
export function parseUsage(r) {
  const rl = r?.rate_limits
  if (!r?.rate_limits_available || !rl) {
    return {
      available: false,
      weeklyPct: null,
      fiveHourPct: null,
      fiveHourResetsAt: null,
      weeklyResetsAt: null,
      raw: r,
    }
  }
  const weekly = [
    rl.seven_day?.utilization,
    ...(rl.limits ?? []).filter((l) => l.group === 'weekly').map((l) => l.percent),
  ].filter((x) => typeof x === 'number')
  return {
    available: true,
    weeklyPct: weekly.length ? Math.max(...weekly) : null,
    fiveHourPct: rl.five_hour?.utilization ?? null,
    fiveHourResetsAt: rl.five_hour?.resets_at ?? null,
    weeklyResetsAt: rl.seven_day?.resets_at ?? null,
    raw: null,
  }
}

/** 실제 claude를 부른 기록(run, 판정). 사용량을 읽지 못할 때의 상한에 쓴다 */
export function countCalls(file) {
  if (!fs.existsSync(file)) return 0
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).length
}

export function logCall(file, entry) {
  fs.appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n')
}

/**
 * 다음 호출을 해도 되는가.
 * @returns {Promise<{ ok: boolean, why: string, usage: object }>}
 */
export async function guard({
  bin,
  env,
  callsFile,
  floorPct = 50,
  maxCalls = 150,
  dry = false,
  observed = null,
}) {
  if (dry) return { ok: true, why: 'dry', usage: null }
  const usage = await getUsage(bin, env)
  // get_usage는 오래된 값을 줄 수 있어(2.1.293, 같은 때 rate_limit_event보다 낮았다) 최근 run에서 본 값과 큰 쪽을 쓴다
  if (observed?.weeklyPct != null) {
    usage.available = true
    usage.weeklyPct = Math.max(usage.weeklyPct ?? 0, observed.weeklyPct)
  }
  if (observed?.fiveHourPct != null)
    usage.fiveHourPct = Math.max(usage.fiveHourPct ?? 0, observed.fiveHourPct)
  if (usage.available) {
    if (usage.weeklyPct !== null && usage.weeklyPct >= 100 - floorPct)
      return {
        ok: false,
        why: `주간 사용률 ${usage.weeklyPct}%: 남은 비율이 ${floorPct}%에 닿음`,
        usage,
      }
    return { ok: true, why: `주간 ${usage.weeklyPct}%, 5시간 ${usage.fiveHourPct}%`, usage }
  }
  const n = countCalls(callsFile)
  if (n >= maxCalls)
    return {
      ok: false,
      why: `get_usage가 사용량을 주지 않아 호출 상한 ${maxCalls}에 닿음(${n})`,
      usage,
    }
  return { ok: true, why: `get_usage 없음, 호출 ${n}/${maxCalls}`, usage }
}
