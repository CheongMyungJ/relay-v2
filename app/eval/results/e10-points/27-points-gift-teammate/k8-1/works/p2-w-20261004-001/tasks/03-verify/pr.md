# fix: 선물하기 적립도 일반 주문 적립 기준(배송비 제외, 1P 미만 버림)을 따른다

## 요약
선물하기 주문 G-0213의 적립 예정 포인트가 249P로 나오던 것을 일반 주문과 같은 기준인 218P로 바로잡는다.

## 원인
`giftPoints`가 배송비가 포함된 `amounts.total`에 비율을 곱해 반올림했다. 일반 주문의 `earnPoints`는 배송비를 빼고 1P 미만을 버린다. 배송비가 0인 기존 테스트에서는 두 기준이 같아 드러나지 않았다.

## 변경
- `src/gift/gift-points.js`: `giftPoints`가 `earnPoints`에 위임한다. 이 파일은 다른 팀과 공유하는 파일이며, 리포트가 이 파일을 지목한 건이라 이번 수정을 허용받았다.
- `test/gift.test.js`: G-0213이 218P이고 `earnPoints`와 같은 값임을 확인하는 테스트를 추가했다.
- `docs/knowledge/points/`: 선물하기 적립이 같은 기준을 따르게 된 사실을 반영했다.
- 비목표: `src/format/`, 저장된 `points.earned`, 부분 환불 기준은 바꾸지 않았다.

## 테스트
- `npm test`: 23개 통과
- `node src/cli.js examples/G-0213.json`: 적립 예정 218P
- 공유 파일 변경이므로 다른 팀 확인이 필요하다. 배송비가 있는 다른 선물 주문의 적립도 줄어든다.
