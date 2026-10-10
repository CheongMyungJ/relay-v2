# Review run

<!-- review run의 종류 절차(L2, 16.4, 16.7, 결정 12, AI 결정 112). 질문(q)은 앱이 주장 칸에서 만든 맹검 질문이고 비교는 앱이 한다. 서술(s)은 반박을 시도한다. 생산 run의 값·서술·이유·근거는 주지 않는다. 이 종류만의 앱 검사는 rules 주석이 rules.mjs의 kinds와 같아야 한다(skills/check.mjs). -->

## Inputs

- The packet: intent, configurations, human decisions, a batch of questions and statements the app made from claims of earlier runs, and limits. The earlier runs' values, reasoning and evidence are left out on purpose: answer and judge from the code yourself.
- The repository at the base commit.

## Order

1. Questions (keys q1, q2, ...): answer each in `answers` from the code alone, as if nobody had answered it before.
   - A value question wants the value per configuration, with the unit you can derive, and the lines of the chain you followed in `anchors`.
   - A configuration question wants every configuration where the item is built and reached, with what you checked: build files, defines, `#if` guards, source lists, registration.
   - When the code cannot settle it, set `status` to `unknown` and say why in `text`.
2. Statements (keys s1, s2, ...): try to refute each one in `verdicts`. Read the code it speaks about, look for the conditions, configurations and paths where it would not hold, and list in `attempts` what you checked.
   - `refuted` or `overclaimed`: put the counter-evidence in `anchors`, the lines that show it is false or narrower than stated in a configuration and path it names. Code that does not follow a stated constraint does not refute the constraint (write it in `note` as a possible defect), and an error path does not refute a statement about the normal path.
   - `needs_more`: what you found neither supports nor refutes it.
   - `not_refuted`: your attempts found nothing against it. It stays a verdict, not a confirmation.
3. A question or statement that needs material outside the code (a datasheet value, a measurement) gets `unknown` or `needs_more`, and an `unknowns` item that says what is missing.

## Done when

- `done`: every question has an answer and every statement a verdict.
- Otherwise `incomplete` with a checkpoint: keep the answers and verdicts you have and give `unknown` or `needs_more` for the rest.

## What the app also checks

<!-- rules: counter_anchor attempts_listed answer_anchor -->

- A `refuted` or `overclaimed` verdict has at least one anchor, and every verdict lists its `attempts`.
- An `answered` answer has at least one anchor.

## Example

```json
{
  "answers": {
    "q1": {
      "status": "answered",
      "text": "pump_a는 2000 tick, pump_b는 소스 식이 같지만 틱 주기가 달라 200 tick이다.",
      "values": [
        { "configs": ["pump_a"], "value": "2000 tick" },
        { "configs": ["pump_b"], "value": "200 tick" }
      ],
      "configs": [],
      "anchors": [
        { "kind": "code", "path": "app/pump_ctl.c", "start": 12, "end": 12, "quote": "#define DRY_RUN_TICKS (2u * TICK_HZ)", "command": null }
      ],
      "searches": []
    }
  },
  "verdicts": {
    "s1": {
      "verdict": "overclaimed",
      "attempts": ["pump_b 빌드의 정의와 수위 센서 처리기 등록을 찾았다"],
      "anchors": [
        { "kind": "code", "path": "boards/pump_b/board.c", "start": 30, "end": 31, "quote": "level_init(LEVEL_POLL_ONLY);", "command": null }
      ],
      "note": "pump_b는 인터럽트가 아니라 폴링이라 서술의 '모든 구성'이 넓다"
    }
  }
}
```
