// 결제 작업 큐. 주문 확정은 작업을 넣기만 하고 바로 돌아온다. 워커(worker.js)가 꺼내 결제사에 청구한다
const jobs = []

export function enqueue(job) {
  jobs.push(job)
}

export function take() {
  return jobs.shift() ?? null
}

export function size() {
  return jobs.length
}
