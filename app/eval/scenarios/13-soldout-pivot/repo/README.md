# search

쇼핑몰 상품 검색 엔진. 외부 의존성 없이 Node(ESM)로 돈다.

상품 목록을 받아 메모리에 역색인을 만들고, 검색어에 맞는 상품을 점수 순으로 한 쪽씩 돌려준다.

```js
import { createSearch, SAMPLE_PRODUCTS } from './src/index.js'

const engine = createSearch(SAMPLE_PRODUCTS, { pageSize: 20 })
const result = engine.search('텀블러 price:1만-5만', { page: 1, pageSize: 10 })
// { query, sort, page, pageSize, total, totalPages, hasPrev, hasNext, items: [{ id, name, nameHtml, priceText, soldOut, badges, ... }] }
```

## 구조

| 폴더 | 하는 일 |
|---|---|
| `src/text/` | 정규화, 단어 쪼개기(조사 떼기, 불용어), 동의어, 초성 |
| `src/catalog/` | 상품 데이터 정리, 분류, 재고 상태, 예제 상품 |
| `src/search/` | 색인, 검색어 해석, 후보 고르기, 점수, 필터, 정렬, 페이지 나누기, 쪽 훅, 화면용 모양 |
| `src/recommend/` | 함께 산 상품, 비슷한 상품, 최근 본 상품 (검색과 따로 쓴다) |
| `src/log/` | 로거 |

검색 한 번의 흐름(`src/search/engine.js`):

1. `query.js` 검색어 해석: 일반 단어, `brand:`/`category:`/`price:`/`tag:` 필터, `-뺄단어`, 초성(`ㅌㅂㄹ`), `"따옴표 구절"`
2. `match.js` 후보 고르기: 단어가 모두 든 상품(동의어 포함)
3. `score.js` 점수: 필드 가중치 BM25 + 인기도 가산점
4. `filters.js` 필터
5. `sort.js` 정렬: `relevance`(기본), `price_asc`, `price_desc`, `newest`, `popular`
6. `paginate.js` 페이지 나누기
7. `present.js` 쪽 훅(`hooks.js`: 재고 배지, 할인 배지, 위치)을 돌리고 화면용 필드를 채운다

`engine.use('page', fn)`으로 쪽 훅을 더할 수 있다.

## 재고

`stock`이 0 이하면 품절, `null`이면 재고를 관리하지 않는 상품이다. 품절 상품에는 `품절` 배지가 붙는다. 추천(`src/recommend/`)은 품절 상품을 보여 주지 않는다. 검색에서는 `filters: { inStock: true }`(목록 화면의 '재고 있는 상품만')를 줄 때만 뺀다.

## 시험

```
npm test
```
