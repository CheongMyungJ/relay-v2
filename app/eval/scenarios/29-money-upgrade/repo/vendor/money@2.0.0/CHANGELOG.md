# money 2.0.0

## 깨지는 변경
- `formatWon(n)`을 `won(n, { suffix })`로 바꿨다. `won(n)`은 예전 `formatWon(n)`과 같은 글을 돌려준다.
- `roundWon(n)`의 기본 반올림이 half-even(은행가 반올림)으로 바뀌었다. 예전처럼 0.5를 올리려면 `roundWon(n, { mode: 'half-up' })`.

## 고침
- 1.x의 `formatWon`이 음수에서 쉼표를 잘못 찍던 문제 (보안 공지 MNY-2026-03과 관련된 입력 검사 포함)
