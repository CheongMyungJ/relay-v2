// build-index.mjs의 타입 (앱과 [단위] 시험이 TypeScript에서 부른다)
export interface ElfSymbol {
  name: string
  bind: 'local' | 'global' | 'weak'
  type: 'func' | 'object' | 'other'
}
export interface BuildIndexConfig {
  symbols: Record<string, 'strong' | 'weak'>
  lines: Record<string, [number, number][]>
}
export interface BuildIndex {
  version: 1
  configs: Record<string, BuildIndexConfig>
}
export declare function elfSymbols(buf: Uint8Array): ElfSymbol[]
export declare function mergeSymbols(lists: ElfSymbol[][]): Record<string, 'strong' | 'weak'>
export declare function activeLines(text: string, repo: string): Record<string, Set<number>>
export declare function toRanges(set: Set<number>): [number, number][]
export declare function mergeLines(
  maps: Record<string, Set<number>>[],
): Record<string, [number, number][]>
export declare function inventoryProblems(result: unknown, index: BuildIndex | null): string[]
