// run.mjs의 타입 (앱과 [단위] 시험이 TypeScript에서 부른다)
export declare const KINDS: readonly ['survey', 'trace', 'integrate', 'review', 'summarize']
export declare const PRODUCING_KINDS: readonly ['survey', 'trace']
export declare const LENSES: readonly ['command', 'state', 'timing', 'shared', 'variant', 'lifecycle', 'protocol']
export declare const RUN_TOOLS: readonly string[]
export declare const SCHEMA_ARGV_TARGET: number
export declare const CMD_META: RegExp
export interface ChecklistItem {
  id: string
  meaning: string
}
/** 앱이 run마다 키를 채우는 칸 (결정 36, AI 결정 108·112) */
export interface SlotKeys {
  coverage?: ChecklistItem[]
  answers?: string[]
  verdicts?: string[]
}
export interface RunLayers {
  contract?: string
  kind?: string
  lens?: string
}
export declare const LENS_TRACE_SECTIONS: readonly string[]
export declare function layerText(md: string): string
export declare function lensLayer(card: string): string
export declare function section(md: string, heading: string): string | null
export declare function sha256(text: string): string
export declare function parseChecklist(card: string): ChecklistItem[]
export declare function parsePerspectives(md: string): ChecklistItem[]
export declare function assembleSchema(
  base: object,
  checklist: ChecklistItem[] | null,
  more?: SlotKeys,
): Record<string, unknown>
export declare function schemaArg(schema: object): string
export declare function cmdLength(arg: string): number
export declare function fieldGuide(base: object, checklist: ChecklistItem[] | null, more?: SlotKeys): string
export declare function assembleInstructions(layers: RunLayers & { guide: string }): string
export declare function runArgs(o: {
  model: string
  effort?: string
  schema: string
  instructionsPath: string
  settingsPath: string
  addDirs: string[]
  sessionId: string
}): string[]
export declare function buildRun(o: {
  base: object
  checklist: ChecklistItem[] | null
  layers?: RunLayers
  more?: SlotKeys
}): {
  schema: Record<string, unknown>
  schemaArg: string
  instructions: string
  hashes: { schema: string; instructions: string }
}
