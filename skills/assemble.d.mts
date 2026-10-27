export declare const TYPES: readonly string[]
export declare function assemble(text: string, type: string): string
export declare function stripFrontMatter(text: string): string
export declare const FLAGS: readonly string[]
export declare const SLOTS: readonly string[]
export declare const BUILTIN: readonly string[]
export declare const STEPS: Readonly<Record<string, readonly string[]>>
export declare function selectFlags(text: string, flags: readonly string[]): string
export declare function fillSlots(text: string, slots: Readonly<Record<string, string>>): string
export declare function flagsOf(
  type: string,
  def?: { check_method?: boolean; target?: string },
): string[]
export declare function readType(type: string, root?: string): Record<string, unknown>
export declare function assembleSkill(
  skill: string,
  o: {
    type: string
    typeDir?: string
    step?: string
    flags?: readonly string[]
    stepBase?: boolean
    finishing?: boolean
  },
  root?: string,
): string
