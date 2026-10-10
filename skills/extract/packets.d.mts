// packets.mjs의 타입 (앱과 [단위] 시험이 TypeScript에서 부른다)
import type { ReviewItem } from './review.mjs'
export interface PacketRecord {
  configs: { name: string; status: string; select: string; build_command: string | null }[]
  units: { id: string; kind: string; lens: string | null; purpose: string; scope: string; status: string; reason: string }[]
  claims: { id: string; unit: string; run: string; section: string; key: string; body: Record<string, unknown> }[]
  evidence: { id: string; kind: string; path: string; start: number; end: number; command: string | null }[]
  decisions: { id: string; trigger: string; question: string; answer: string | null }[]
  links: { id: string; kind: string; from: string[]; to: string[]; reason: string }[]
  reviews: { claim: string; result: string; status: string | null; note: string }[]
  coverage: Record<string, unknown[]> | null
  partial: boolean
  build_index: { status: string; detail: string } | null
  notes?: { at: string; text: string }[]
}
interface Common {
  intent: string
  soft: number
  hard: number
  record: PacketRecord
  scratch: string
}
export declare function claimSummary(c: { section: string; body: Record<string, unknown> }): string
export declare function claimLocations(
  c: { body: Record<string, unknown> },
  evidence: PacketRecord['evidence'],
): string[]
export declare function foldedBy(links: { kind: string; from: string[]; to: string[] }[]): Map<string, string[]>
export declare function resolvedBy(links: { kind: string; from: string[]; to: string[] }[]): Map<string, string[]>
export declare function recordListing(record: PacketRecord): string
export declare function renderIntegratePacket(
  o: Common & { repo: string; base: string; listing: string; since?: string[] },
): string
export declare function renderReviewPacket(
  o: Common & { repo: string; base: string; claims: PacketRecord['claims'] },
): { packet: string; items: ReviewItem[] }
export declare function renderSummarizePacket(o: Common): string
export declare function packetIds(text: string): string[]
