import type { RelayApi } from '../../shared/api'

declare global {
  interface Window {
    readonly relay: RelayApi
  }
}
