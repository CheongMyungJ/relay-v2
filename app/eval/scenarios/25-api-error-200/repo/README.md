# shop-api

모바일 쇼핑 앱이 부르는 API 서버의 핸들러다. HTTP 서버 없이 `handle(request, ctx)`로 요청 하나를 처리해 `{ status, body }`를 돌려준다.

- `src/server.js`: 경로 찾기와 공통 처리
- `src/routes/`: 주문, 장바구니, 상품
- `src/db.js`: 메모리 저장소(시험용)

시험: `npm test`
