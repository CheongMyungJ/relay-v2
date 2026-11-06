// 배송지 주소록. 고객마다 여러 곳을 두고 하나를 기본으로 쓴다. 우편번호로 배송 지역을 정한다.
import { fail } from '../shared/errors.js'

// 도서산간 우편번호(대행사 표의 일부). 제주는 63000~63644
const ISLAND_RANGES = [
  [23004, 23010], // 옹진 일부
  [23100, 23116],
  [40200, 40240], // 울릉
  [52570, 52571], // 남해 섬
  [53031, 53033], // 통영 섬
  [53089, 53104],
  [58760, 58762], // 목포 섬
  [58800, 58810], // 신안
  [58816, 58818],
  [58826, 58866],
  [59102, 59103], // 완도 섬
  [59127, 59127],
]

const METRO_PREFIX = ['10', '11', '12', '13', '14', '15', '16', '17', '18', '21', '22']

/** 우편번호(5자리)의 배송 지역: seoul, metro, local, jeju, island */
export function regionOf(postcode) {
  if (!/^\d{5}$/.test(String(postcode))) fail('BAD_POSTCODE', `우편번호: ${postcode}`)
  const n = Number(postcode)
  if (n >= 63000 && n <= 63644) return 'jeju'
  if (ISLAND_RANGES.some(([a, b]) => n >= a && n <= b)) return 'island'
  if (n < 10000) return 'seoul'
  if (METRO_PREFIX.includes(String(postcode).slice(0, 2))) return 'metro'
  return 'local'
}

export function createAddresses(store, customers) {
  if (!store.addresses) store.addresses = new Map()

  const book = (customerId) => {
    customers.get(customerId)
    if (!store.addresses.has(customerId)) store.addresses.set(customerId, [])
    return store.addresses.get(customerId)
  }

  function add(customerId, { label = '집', recipient, postcode, line1, line2 = '', makeDefault = false }) {
    if (!recipient) fail('BAD_ADDRESS', '받는 사람이 없습니다')
    if (!line1) fail('BAD_ADDRESS', '주소가 없습니다')
    const list = book(customerId)
    if (list.length >= 10) fail('TOO_MANY_ADDRESSES', '주소는 10곳까지 둘 수 있습니다')
    const address = {
      id: `${customerId}-addr-${list.length + 1}`,
      label,
      recipient,
      postcode: String(postcode),
      region: regionOf(postcode),
      line1,
      line2,
      isDefault: list.length === 0 || makeDefault,
    }
    if (address.isDefault) for (const a of list) a.isDefault = false
    list.push(address)
    // 기본 주소의 지역이 고객의 배송 지역이 된다
    if (address.isDefault) customers.update(customerId, { region: address.region })
    return { ...address }
  }

  function setDefault(customerId, addressId) {
    const list = book(customerId)
    const target = list.find((a) => a.id === addressId)
    if (!target) fail('NOT_FOUND', `주소가 없습니다: ${addressId}`)
    for (const a of list) a.isDefault = a === target
    customers.update(customerId, { region: target.region })
    return { ...target }
  }

  function remove(customerId, addressId) {
    const list = book(customerId)
    const i = list.findIndex((a) => a.id === addressId)
    if (i < 0) fail('NOT_FOUND', `주소가 없습니다: ${addressId}`)
    const [removed] = list.splice(i, 1)
    if (removed.isDefault && list.length > 0) setDefault(customerId, list[0].id)
  }

  return {
    add,
    setDefault,
    remove,
    list: (customerId) => book(customerId).map((a) => ({ ...a })),
    defaultOf: (customerId) => {
      const a = book(customerId).find((x) => x.isDefault)
      return a ? { ...a } : null
    },
  }
}
