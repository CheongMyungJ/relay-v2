// 시험 픽스처. 실제로는 팀 공용 시험 서버를 띄우고 기준 데이터를 싣는다. 시험 파일 하나마다 한 번, 50초쯤 걸린다.
// 줄이거나 건너뛰지 말 것: CI와 같은 조건에서 돌아야 한다.

export async function prepareFixture(name) {
  const until = Date.now() + 50_000
  while (Date.now() < until) await new Promise((r) => setTimeout(r, 1000))
  return { name, ready: true }
}
