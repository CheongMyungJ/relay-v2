// 광고 캠페인. 대상(segments)과 보낼 때를 정해 두면 runDue()가 때가 된 것을 보낸다.
// 보내는 것은 notifier.sendPromo이므로 수신 거부와 방해 금지 시간을 그대로 따른다.
import { fail } from '../shared/errors.js'

export function createCampaigns({ store, clock, segments, notifier, ids }) {
  if (!store.campaigns) store.campaigns = []

  function create({ title, text, segment, sendAt }) {
    if (!title || !text) fail('BAD_CAMPAIGN', '제목과 내용이 있어야 합니다')
    if (Number.isNaN(Date.parse(sendAt))) fail('BAD_CAMPAIGN', `보낼 때: ${sendAt}`)
    segments.select(segment)
    const c = { id: ids.next('cmp'), title, text, segment, sendAt: new Date(sendAt).toISOString(), status: 'scheduled' }
    store.campaigns.push(c)
    return { ...c }
  }

  function cancel(id) {
    const c = store.campaigns.find((x) => x.id === id)
    if (!c) fail('NOT_FOUND', `캠페인이 없습니다: ${id}`)
    if (c.status !== 'scheduled') fail('BAD_CAMPAIGN', `이미 ${c.status}`)
    c.status = 'cancelled'
  }

  /** 때가 된 캠페인을 보낸다. 채널별로 보냄·미룸·건너뜀을 센다 */
  function runDue() {
    const now = clock.now().toISOString()
    const ran = []
    for (const c of store.campaigns.filter((x) => x.status === 'scheduled' && x.sendAt <= now)) {
      const targets = segments.select(c.segment)
      const results = notifier.sendPromo(targets, { title: c.title, text: c.text })
      const counts = {}
      for (const r of results.flatMap((x) => x.results)) {
        const key = `${r.channel}.${r.status}`
        counts[key] = (counts[key] ?? 0) + 1
      }
      c.status = 'sent'
      c.sentAt = now
      c.counts = counts
      ran.push({ ...c })
    }
    return ran
  }

  return { create, cancel, runDue, list: () => store.campaigns.map((c) => ({ ...c })) }
}
