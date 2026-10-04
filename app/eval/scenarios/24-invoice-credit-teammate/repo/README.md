# billing

한빛오피스(사무용품 B2B 납품)의 청구서 모듈. 거래처에 보내는 청구서를 만들고, 합계를 계산하고, PDF용 서식과 회계팀에 보내는 자료를 만든다.

## 도메인

- **청구서:** 거래처 하나에 품목 줄 여러 개. 초안(`draft`)으로 만들고 번호를 받아 발행(`issued`)한다. 입금되면 `paid`, 취소하면 `void`.
- **품목 줄:** 단가 × 수량. 줄마다 할인(`{ percent }` 또는 `{ amount }`)이 붙을 수 있다.
- **과세 구분:** 대부분 과세 품목이고, 도서 같은 면세 품목(`taxType: 'exempt'`)은 부가세가 없다.
- **영세율:** 수출 거래처(`zeroRated`)의 청구서는 부가세율이 0이다.
- **금액:** 모두 정수 원이다. 부가세율은 `src/config.js`의 `VAT_RATE_PERCENT`(10%).
- **발행된 청구서:** 발행할 때 합계를 계산해 `totals`에 저장하고, 그 뒤 서식·CSV·분개는 저장된 합계를 쓴다.
- **반품 전표:** 거래처가 발행된 청구서의 품목 일부를 돌려보내면 반품 전표(`CN-0112`)를 만들어 공급가액과 부가세를 돌려준다. 금액은 양수로 적고 분개에서 반대 방향으로 쓴다. 청구서처럼 만들 때 금액을 `totals`에 저장한다.

## 구조

```
src/
  config.js            회사 정보, 세율, 번호 형식
  money.js             원 단위 금액 도우미
  invoice/             청구서: 품목 줄, 할인, 과세 구분, 합계, 상태, 번호, 납부 기한, 반품 전표
  format/              PDF용 고정폭 서식, 금액·날짜·글자 폭
  customers/           거래처, 사업자등록번호, 결제 조건
  export/              회계팀 CSV, 매출 분개, 월별 요약, 연체 안내 메일
  cli.js               청구서 JSON을 서식으로 찍어 보기, 반품 전표 금액 보기
examples/              문의가 들어온 청구서의 입력 데이터 사본, 반품 요청, 거래처 예시
```

## 쓰기

```sh
npm test
node src/cli.js examples/INV-2031.json --customers examples/customers.json
node src/cli.js examples/INV-2031.json --totals
node src/cli.js examples/CN-0112.json --invoice examples/INV-2047.json
```

`src/format/invoice-text.js`의 출력은 PDF 생성기가 줄 단위로 그대로 찍는다. 줄 수나 칸 위치를 바꾸면 인쇄 양식이 어긋난다.
