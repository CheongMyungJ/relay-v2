import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { API_KEY, IPC, type RelayApi } from '../shared/api'

function subscribe<T>(channel: string, cb: (value: T) => void): () => void {
  const listener = (_e: IpcRendererEvent, value: T): void => cb(value)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const api: RelayApi = {
  appInfo: () => ipcRenderer.invoke(IPC.appInfo),
  terminal: {
    pickFolder: () => ipcRenderer.invoke(IPC.pickFolder),
    create: (cwd) => ipcRenderer.invoke(IPC.create, cwd),
    start: (id, cols, rows) => ipcRenderer.invoke(IPC.start, id, cols, rows),
    write: (id, data) => ipcRenderer.invoke(IPC.write, id, data),
    resize: (id, cols, rows) => ipcRenderer.invoke(IPC.resize, id, cols, rows),
    close: (id) => ipcRenderer.invoke(IPC.close, id),
    onData: (id, cb) => subscribe(IPC.data(id), cb),
    onExit: (id, cb) => subscribe(IPC.exit(id), cb),
  },
}

contextBridge.exposeInMainWorld(API_KEY, api)
