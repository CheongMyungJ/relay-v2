# 회의실 예약

## 개요

회의실을 30분 단위로 예약하고, 취소하고, 매주 반복으로 예약한다. 모듈은 `src/booking.js` 하나이고 저장소는 `src/store.js`의 메모리 저장소다. 화면과 HTTP는 이 설계의 범위가 아니다.

## 결정

| # | 결정 | 이유 | 사람 결정 |
|---|---|---|---|
| B1 | 예약의 시작과 끝은 정각이나 30분이고, 끝은 시작보다 늦어야 한다. 어기면 `INVALID_SLOT` | 회의실 표가 30분 칸이다 | ✅ |
| B2 | 같은 회의실에서 시간이 겹치는 예약은 거절한다(`OVERLAP`). 앞 예약의 끝과 뒤 예약의 시작이 같으면 겹치지 않는다 | 연달아 쓰는 회의가 흔하다 | ✅ |
| B3 | 취소한 예약은 지우지 않고 `status: 'cancelled'`로 남기며, 겹침 판정에서 뺀다 | 취소 기록을 감사에 쓴다 | ✅ |
| B4 | 반복 예약은 회차마다 예약 하나를 만들고 같은 `series`(첫 회차의 id)를 단다. 한 회차라도 거절되면 아무 회차도 만들지 않는다(일부만 만들지 않음) | 일부만 잡힌 반복 예약을 사람들이 알아채지 못했다 | ✅ |
| B5 | 오류는 `Error`에 `code`를 단 것으로 던진다(예: `INVALID_SLOT`, `OVERLAP`, `NOT_FOUND`) | 호출하는 쪽이 코드로 가른다 | |

## 모듈 `src/booking.js`

- `createBooking(store, { room, start, end, by })` → 예약 `{ id, room, start, end, by, status: 'active' }`. B1, B2.
- `listBookings(store, room)` → 그 회의실의 예약 전부(취소 포함)를 시작 시각 차례로.
- `cancelBooking(store, id, { now })` → 취소한 예약. 없는 id는 `NOT_FOUND`. B3.
- `createWeekly(store, { room, start, end, by, weeks })` → 만든 예약 목록(회차 차례). 회차 k(0부터)는 시작과 끝에 7k일을 더한 것. B4.

## 정하지 않은 것

- 이미 시작한 예약을 취소할 수 있는지 — 운영팀이 정한다(s2 전에).
- 반복 횟수의 상한 — 운영팀이 정한다(s3 전에).

## 구현 나눔

| 조각 | 이름 | 유형 | 먼저 | 목표 |
|---|---|---|---|---|
| s1 | 예약 만들기 | 기능 추가 | | `createBooking`과 `listBookings`. B1, B2 |
| s2 | 예약 취소 | 기능 추가 | s1 | `cancelBooking`. B3 |
| s3 | 반복 예약 | 기능 추가 | s1, s2 | `createWeekly`. B4 |

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-10-10 | 처음 씀 |
