import { createStore } from '../src/store.js'

// 시험마다 새 저장소
export const store = () => createStore()

// 회의실 A, 2026-11-02(월)의 시각
export const at = (hhmm, day = '2026-11-02') => `${day}T${hhmm}`

export const slot = (start, end, more = {}) => ({ room: 'A', start: at(start), end: at(end), by: 'kim', ...more })
