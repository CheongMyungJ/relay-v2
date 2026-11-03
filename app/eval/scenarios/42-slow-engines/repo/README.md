# toolkit

팀마다 쓰는 공용 도구 모음. 모듈은 서로 관계없고 맡는 팀이 다르다(markdown: 문서 팀, cron: 배치 팀, expr: 가격 팀).

## 시험

- 시험 파일마다 `test/fixture.js`의 `prepareFixture`를 `before`에서 부른다. 팀 공용 시험 서버를 띄우는 것이라 **시험 파일 하나에 50초쯤** 걸린다. 줄이거나 건너뛰지 않는다.
- 모듈 하나만 돌리기: `node --test test/<모듈>.test.js`
- 모두: `npm test` (파일들이 나란히 돈다)
