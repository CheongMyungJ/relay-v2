# Trace run

## Inputs

- The packet: intent, configurations (from the survey), the unit (lens, purpose, scope) and limits.
- The lens card below: what this lens traces, how, and its pitfalls. The checklist keys are listed with the result fields.

## Order

1. Read the unit and the lens card. Every checklist key must end as `covered`, `not_applicable` (with searches), `unknown` or `unreached`.
2. Resolve, per configuration, what is active for the unit before reading behavior: build-file defines, force-included headers, `#if` guards, per-configuration source lists, run-time selection or registration.
3. Map the unit before writing anything: search the whole repository for every symbol, function, peripheral and path the unit's purpose and scope name, and list each definition, caller and consumer you find. The map is usually wider than the first file.
4. Trace every entry in the map as the lens card says. Each time you confirm something, add it to your scratch note with its anchor.
5. Put each finding in its field: behavior in `observations`, numbers in `quantities`, candidates in `requirements` (refs to observations), limits in `constraints` (with reason) or `impl_choices`, disagreements in `conflicts`, absence claims in `absences` (with searches), missing material in `unknowns`, more code to trace in `followups` (with a lens).
6. Fill the checklist. A `covered` cell refers to the keys of the items that cover it.
7. Take quotes and line numbers from the tool output you have; re-open the range when unsure.

## Done when

- `done`: every entry in your map has been followed, every checklist key is `covered`, `not_applicable` or `unknown`, and nothing in scope remains that code could answer. A status on every checklist key alone is not done; keep tracing the map, or submit `incomplete` with the rest in the checkpoint.
- `needs_external`: the unit cannot go further without material outside the code; the `unknowns` say what.
- `out_of_scope`: the intent excludes this unit; quote the intent in `outcome_reason`.
- `incomplete`: a deadline, limit or context ran out, or a cell is `unreached`; give the checkpoint.
