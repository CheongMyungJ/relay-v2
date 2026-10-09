# Lens: variant

<!-- 렌즈 카드(16.3). trace run은 Scope, Trace, Pitfalls, Phrasing, Example을 받고, Checklist의 뜻은 필드 안내(L3)로 받는다. Review questions는 review run을 평가에 넣을 때 쓴다(결정 18). Example은 가상의 펌웨어로, 평가 시나리오와 겹치지 않게 쓴다. -->

## Scope

How the configurations differ in the unit's area: what selects each difference (at build time or at run time), what each configuration ends up doing, and which code no configuration uses.

## Trace

- `build_selection`: build files, command-line defines, force-included and generated headers, per-configuration source lists and link order. Resolve precedence when a header default, a define and a forced include touch the same macro.
- `runtime_selection`: values read at run time (straps, stored settings, detected hardware) and registrations made at initialization, and which behavior each enables. Two configurations with the same build can still differ here.
- `per_config_diff`: for each difference, the behavior or value per configuration, each as its own item with its `configs`.
- `shipping_config`: which configuration ships. Code rarely says so; a default target or a comment is a `doc_claim`. When it matters and code cannot tell, write a `human_decisions` item with trigger `shipping_config`.
- `dead_code`: code that no configuration builds or reaches (an `#if` branch no configuration selects, a function nothing calls or registers), as `absences` with the searches.

## Checklist

| ID | Meaning |
| --- | --- |
| `build_selection` | Configuration selection at build time |
| `runtime_selection` | Configuration selection at run time |
| `per_config_diff` | Differences between configurations |
| `shipping_config` | Which configuration ships |
| `dead_code` | Code no configuration uses |

## Pitfalls

- A configuration named in a header or an `#ifdef` but produced by no build rule is a candidate; describe its code as unreachable by the build, not as a configuration's behavior.
- The default build target is not evidence of the shipping configuration; record it as a `doc_claim` or leave the cell `unknown`.
- A macro can be set in more than one place; resolve it per configuration before writing a value, and cite every place that sets it.
- Behavior gated by a run-time registration or setting differs even inside one build; write the condition into the item.
- Two configurations that look the same in one file can differ through another; check the source lists before writing `all`.

## Phrasing

- Difference: "<구성 A>는 <X>, <구성 B>는 <Y>. 선택: <무엇이 고르는가>." One item per configuration when behavior differs.
- Dead code: "<심볼>은 어느 구성도 빌드하거나 부르지 않는다." with the searches.

## Example

```json
{
  "observations": [
    {
      "key": "o1",
      "text": "lamp_eu는 LAMP_MAINS_HZ가 50이고 lamp_us는 60이다. 값은 Makefile의 -D가 정하고 board.h의 기본값 50을 덮어쓴다.",
      "configs": ["lamp_eu", "lamp_us"],
      "anchors": [
        { "kind": "code", "path": "Makefile", "start": 18, "end": 19, "quote": "lamp_us: CFLAGS += -DLAMP_MAINS_HZ=60", "command": null },
        { "kind": "code", "path": "inc/board.h", "start": 7, "end": 9, "quote": "#ifndef LAMP_MAINS_HZ", "command": null }
      ],
      "inference": false
    }
  ],
  "human_decisions": [
    {
      "key": "d1",
      "trigger": "shipping_config",
      "question": "lamp_eu와 lamp_us 가운데 어느 구성이 출하되는지 코드로 알 수 없다. 둘 다 분석 대상인가?",
      "options": ["둘 다", "lamp_eu만", "lamp_us만"],
      "refs": ["o1"]
    }
  ],
  "checklist": {
    "build_selection": { "status": "covered", "refs": ["o1"], "searches": [] },
    "shipping_config": { "status": "unknown", "refs": ["d1"], "searches": [] }
  }
}
```
