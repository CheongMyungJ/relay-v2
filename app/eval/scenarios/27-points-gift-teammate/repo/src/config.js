// 쇼핑몰 설정. 금액은 정수 원, 포인트는 1P = 1원이다
export const SHOP_NAME = '숲결마켓'

// 배송비: 쿠폰을 뺀 상품 금액이 FREE_SHIPPING_MIN 이상이면 무료
export const SHIPPING_FEE = 3000
export const FREE_SHIPPING_MIN = 30000

// 포인트
export const POINT_RATE_PERCENT = 1
export const POINT_EXPIRY_DAYS = 365
export const MIN_POINT_USE = 1000
export const POINT_USE_UNIT = 10

// 주문 번호: 일반 주문 O-0000, 선물하기 G-0000, 환불 R-0000
export const ORDER_NUMBER = /^O-\d{4}$/
export const GIFT_NUMBER = /^G-\d{4}$/
export const REFUND_NUMBER = /^R-\d{4}$/
