---
schema_version: 1
version: 1
title: KST 환경에서 토큰이 9시간 일찍 만료되는 문제 수정
type: bugfix
size: M
delivery: pr
---
## 목표
KST 서버에서 액세스 토큰이 발급 직후 만료로 판정되는 문제를 고친다.

## 비목표
- 토큰 수명 정책 변경
- refresh 흐름 리팩터링

## 원하는 결과
서버 타임존과 관계없이 토큰 만료 판정이 발급 시 정한 수명과 일치한다.

## 완료조건
- [ ] 고정된 재현 테스트 `tests/auth/expiry.test.ts`가 통과한다
- [ ] TZ=Asia/Seoul과 TZ=UTC 두 환경에서 `npm test`가 통과한다
- [ ] 기존 테스트 파일을 수정하지 않는다

## 제약
- 외부 라이브러리 추가 금지
