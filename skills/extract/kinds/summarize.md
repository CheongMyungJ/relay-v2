# Summarize run

<!-- summarize run의 종류 절차(L2, 16.4, 결정 15, AI 결정 113). 앱이 렌더링한 통계와 목록만 읽고 {글, 전역 ID} 서술과 handoff 요약·risks를 낸다. extraction.md와 handoff.md는 앱이 렌더링한다. 이 종류만의 앱 검사는 rules 주석이 rules.mjs의 kinds와 같아야 한다(skills/check.mjs). -->

## Inputs

- The packet only: statistics and lists the app made from the record. Units and their ending states, claims by section, open unknowns, conflicts, links, review results, coverage, held or failed units, and whether the analysis is partial. Reading the repository is not needed.

## Order

1. `overview`: a few short paragraphs on what was analyzed (configurations, scope, boundaries), what kinds of behavior and constraints were found, and what remains open. Each paragraph lists in `ids` the global IDs it speaks about.
2. `handoff_summary`: two or three sentences for the next step, which checks the result against the code.
3. `risks`: one item per thing the next step should watch, with its IDs: open unknowns and the material they need, conflicts, held, failed or stalled units, claims a review lowered, perspectives nothing reached, and a partial analysis.
4. Keep every state as the packet gives it. Claims are unreviewed or lowered; a link or an unrefuted review confirms nothing. Write "후보", "확인되지 않음" or "검토에서 반박되지 않음" where a state matters, and leave adoption undecided.
5. Finishing every unit is not finding every requirement: say what the analysis could have missed.

## Done when

- The three fields are written and every ID you use is in the packet.

## What the app also checks

<!-- rules: global_refs -->

- Every global ID in `ids` is one the packet gave.

## Example

```json
{
  "overview": [
    {
      "text": "pump_a와 pump_b 두 구성의 펌프 제어기를 분석했다. 벤더 HAL은 경계로 두고 호출과 설정만 읽었다. 정지 지연과 건조 운전 보호의 수치는 구성마다 다르게 유도됐다.",
      "ids": ["u-0001", "c-0058", "c-0060"]
    }
  ],
  "handoff_summary": {
    "text": "단위 12개가 끝났고 미확정 4건이 남았다. 리뷰가 범위 과장으로 내린 서술 1건을 먼저 본다.",
    "ids": ["c-0071"]
  },
  "risks": [
    { "text": "수위 센서의 응답 시간은 데이터시트가 있어야 정한다(확인되지 않음).", "ids": ["c-0031"] }
  ]
}
```
