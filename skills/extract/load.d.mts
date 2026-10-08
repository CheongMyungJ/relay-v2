import type { ChecklistItem } from './run.mjs'
export declare const REPO: string
export declare function baseSchemaPath(kind: string, root?: string): string
export declare function loadBase(kind: string, root?: string): Record<string, unknown>
export declare function lensCardPath(lens: string, root?: string): string
export declare function loadChecklist(lens: string, root?: string): ChecklistItem[]
