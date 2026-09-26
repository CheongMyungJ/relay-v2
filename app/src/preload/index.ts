import { contextBridge } from 'electron'
import { API_KEY, type RelayApi } from '../shared/api'

const api: RelayApi = {
  platform: process.platform,
}

contextBridge.exposeInMainWorld(API_KEY, api)
