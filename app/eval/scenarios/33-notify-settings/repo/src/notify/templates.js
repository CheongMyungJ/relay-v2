// 알림 글. 이메일은 제목과 본문을 만든다
const SUBJECT = {
  comment: (e) => `[noticeboard] ${e.author}님이 댓글을 남겼습니다`,
  mention: (e) => `[noticeboard] ${e.author}님이 회원님을 언급했습니다`,
  weekly: () => '[noticeboard] 이번 주 요약',
}

export function emailFor(user, event) {
  const subject = SUBJECT[event.kind]?.(event)
  if (!subject) throw new Error(`모르는 알림 종류: ${event.kind}`)
  return {
    to: user.email,
    subject,
    body: `${user.name}님,\n\n${event.text}\n\n— noticeboard`,
  }
}
