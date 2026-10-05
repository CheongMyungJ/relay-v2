import { NotFoundError } from '../util/errors.js'

const PARTNERS = [
  { id: 'P-1', name: '한빛공구', bank: '국민 123-45-67890' },
  { id: 'P-2', name: '목수 정씨', bank: '신한 110-222-333444' },
]

export function getPartner(id) {
  const p = PARTNERS.find((x) => x.id === id)
  if (!p) throw new NotFoundError('파트너', id)
  return p
}

export function listPartners() {
  return [...PARTNERS]
}
