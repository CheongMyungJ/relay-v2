# Perspectives

<!-- integrate run의 관점 목록(16.3). coverage 행렬의 행 키이고 결과 스키마 coverage의 필수 키다(결정 36의 꼴, AI 결정 111). 열은 survey가 낸 구성이다. 뜻은 필드 안내(L3)의 "Coverage keys"로 run에 간다. 렌즈와 겹치지만 렌즈는 단위 하나를 추적하는 방법이고, 관점은 기록 전체에서 빈칸을 찾는 축이다. -->

## Perspectives

| ID | Meaning |
| --- | --- |
| `entry_points` | Every entry point the survey found (reset, vectors, interrupt handlers, tasks, main loop, timers) is traced by some unit |
| `commands` | Every command or request path, with its error and timeout responses |
| `state` | Each state variable that more than one module or context writes: writers and transitions |
| `timing` | Time constants, timeouts and periods: values per configuration and their clock or tick sources |
| `concurrency` | Data shared between interrupts, tasks and DMA, and how it is protected |
| `config_differences` | Every place where configurations differ, at build time or at run time |
| `lifecycle` | Start-up order, power modes, watchdog, fault handling and data kept across reset |
| `protocol` | Framing, checksums and parsers of each link to a host or a peer device |
| `error_paths` | Error, timeout and recovery paths that cross modules |
| `memory` | Memory layout per configuration: linker scripts, sections, buffers a DMA must reach |
