// 요약 메일 만들기. 모인 알림마다 한 줄씩 적는다.

const SUBJECT = {
  ko: (period, n) => `${period} 알림 요약 (${n}건)`,
  en: (period, n) => `Your notifications for ${period} (${n})`,
}

const FOOTER = {
  ko: '요약 대신 알림을 바로 받으려면 설정에서 "요약으로 받기"를 끄세요.',
  en: 'To get notifications right away, turn off "Daily digest" in settings.',
}

/**
 * @param {{ userId, to, locale, period, items }} job
 */
export function buildDigestMessage({ userId, to, locale, period, items }, { templates, config }) {
  const lang = SUBJECT[locale] ? locale : config.templates.defaultLocale
  const lines = items.map((item) => `- ${lineFor(item, lang, templates)}`)
  return {
    from: config.channels.mail.from,
    to,
    subject: SUBJECT[lang](period, items.length),
    body: [...lines, '', FOOTER[lang]].join('\n'),
    headers: { 'X-Notify-Digest': `${period}/${userId}` },
  }
}

// 알림의 첫 채널 문구에서 제목(없으면 본문)을 한 줄로 쓴다
function lineFor(item, locale, templates) {
  try {
    const channel = templates.channelsFor(item.type)[0]
    const text = templates.renderFor(item.type, channel, locale, { ...item.data, userId: item.userId })
    return text.subject ?? text.body ?? item.type
  } catch {
    return item.type
  }
}
