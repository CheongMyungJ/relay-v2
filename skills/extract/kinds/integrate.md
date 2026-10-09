# Integrate run

<!-- integrate run의 종류 절차(L2, 16.4, AI 결정 107~111). L1(contract.md) 다음, 필드 안내(L3) 앞에 간다. 이 종류만의 앱 검사는 아래 "What the app also checks"의 rules 주석이 rules.mjs의 kinds와 같아야 한다(skills/check.mjs). Example은 가상의 펌웨어로, 평가 시나리오와 겹치지 않게 쓴다. -->

## Inputs

- The packet: intent, configurations (from the survey), every unit with its state, the entry points the survey found, the open unknowns, the links earlier integrate runs made, and limits.
- The record listing named in the packet: one line per claim of earlier runs with its global ID, unit, run, section, configurations, a short summary and its evidence locations. Search it with Grep or Read instead of relying on memory.
- The repository at the base commit, to check a link or a gap against the code.
- The perspective keys are listed with the result fields.

## Order

1. Links between earlier claims, by global ID. Go through the listing subject by subject: a symbol, function, command, value or configuration that appears in more than one line, often from different units or runs. Decide for each such pair:
   - `resolves`: an open unknown (from) that later claims (to) answer. Check that their evidence answers the question, and say in `reason` whether wholly or partly. An unknown that needs a datasheet, a measurement or a person stays open: a later claim that repeats a comment or a name is not an answer.
   - `supersedes`: a later run (a reopened, continued or deeper unit) states the same thing again with different content for the same configurations. The run column tells which is later.
   - `merges`: claims that say the same thing for the same configurations. Claims about different configurations stay separate, even with the same text.
   - `conflicts`: claims that cannot both hold in the same configurations. Check both against the code and say in `reason` which one the code supports, with an anchor.
2. Link each pair you checked: a link is a pointer for the person who reads the result and confirms or closes nothing. Leave a pair unlinked only when you could not check it, and put the question in `unknowns`. Links the packet lists as already made stay as they are; add only new ones.
3. Read the units and the entry points. For each entry point, handler and command the survey found, search the listing for the claims and units that cover it.
4. Coverage: for every perspective key, judge each configuration, or each group of configurations that behave the same. `covered` lists in `ids` the claims or units that cover it; `not_applicable` gives the searches that show it does not apply; `unreached` names in `units` the units you propose for it; `unknown` is for a cell the record and a short look at the code cannot settle.
5. Gaps: propose a unit in `units` for each entry point, handler, command or perspective cell nothing in the record reaches, with a lens, `priority`, `depends_on` and `reason`. A gap a closed unit already covers is not a gap.

## Done when

- `done`: every perspective key has a judgement for every configuration, every entry point the survey found is covered by a claim or unit or has a proposed unit, and the listing has been searched for unknowns that later claims answer.
- Otherwise `incomplete` with a checkpoint.

## What the app also checks

<!-- rules: global_refs link_shape coverage_refs coverage_searches coverage_units -->

- Every global ID in `links` and in `ids` is one the packet or the listing gave.
- Every link has IDs on both sides and no ID on both sides; `resolves` starts from unknowns.
- A `covered` cell has `ids`, a `not_applicable` cell has `searches`, and an `unreached` cell names proposed units in `units`.

## Example

```json
{
  "links": [
    {
      "key": "l1",
      "kind": "resolves",
      "from": ["c-0031"],
      "to": ["c-0058"],
      "reason": "c-0031은 펌프 정지 지연의 단위를 물었고, 뒤 trace의 c-0058이 타이머 소비 지점과 틱 원천을 코드로 이어 ms로 유도했다. 전부 답한다.",
      "anchors": []
    },
    {
      "key": "l2",
      "kind": "merges",
      "from": ["c-0044"],
      "to": ["c-0019"],
      "reason": "두 관찰 모두 pump_a에서 수위 센서 오류면 펌프를 끈다고 쓴다. 같은 구성, 같은 동작이다.",
      "anchors": []
    }
  ],
  "coverage": {
    "lifecycle": [
      { "configs": ["pump_a"], "status": "covered", "ids": ["u-0007"], "units": [], "searches": [], "note": "" },
      {
        "configs": ["pump_b"],
        "status": "unreached",
        "ids": [],
        "units": ["n1"],
        "searches": [],
        "note": "pump_b의 저전력 진입은 어느 단위도 다루지 않았다"
      }
    ]
  },
  "units": [
    {
      "key": "n1",
      "purpose": "pump_b의 저전력 진입과 깨우기 순서를 추적한다",
      "lens": "lifecycle",
      "scope": "power/sleep.c, pump_b",
      "priority": "medium",
      "depends_on": [],
      "reason": "coverage의 lifecycle × pump_b가 비었다"
    }
  ]
}
```
