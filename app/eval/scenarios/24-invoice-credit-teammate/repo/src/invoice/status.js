// 청구서 상태와 옮겨 갈 수 있는 상태

export const STATUS_LABELS = {
  draft: '작성 중',
  issued: '발행',
  paid: '입금 완료',
  void: '취소',
}

const NEXT = {
  draft: ['issued', 'void'],
  issued: ['paid', 'void'],
  paid: [],
  void: [],
}

export function canTransition(from, to) {
  return (NEXT[from] ?? []).includes(to)
}

export function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw new Error(`청구서를 '${STATUS_LABELS[from] ?? from}'에서 '${STATUS_LABELS[to] ?? to}'(으)로 바꿀 수 없다`)
  }
}

export function statusLabel(status) {
  return STATUS_LABELS[status] ?? status
}
