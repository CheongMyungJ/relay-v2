// 회사 정보와 청구 설정

export const COMPANY = {
  name: '한빛오피스 주식회사',
  bizNo: '1208147521',
  address: '서울특별시 성동구 성수이로 118, 4층',
  phone: '02-6204-1180',
  bank: '국민은행 841-21-0412-339 한빛오피스(주)',
}

// 부가가치세율(%)
export const VAT_RATE_PERCENT = 10

// 청구서 번호 앞머리. 번호는 INV-2031처럼 붙는다
export const INVOICE_PREFIX = 'INV-'
export const INVOICE_NUMBER_DIGITS = 4

// 반품 전표 번호 앞머리. CN-0112처럼 붙는다
export const CREDIT_NOTE_PREFIX = 'CN-'

// 고객 등급에 결제 조건이 없을 때 쓰는 납부 기한(일)
export const DEFAULT_PAYMENT_DAYS = 30

// 청구서 서식의 가로 폭(글자 칸)
export const INVOICE_TEXT_WIDTH = 48
