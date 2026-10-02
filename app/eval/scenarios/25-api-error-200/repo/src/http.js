/** 응답 하나. body는 JSON으로 나간다 */
export function respond(status, body) {
  return { status, body }
}

export function ok(data) {
  return respond(200, { ok: true, data })
}
