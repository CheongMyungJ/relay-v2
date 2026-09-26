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
  snapshot: () => ipcRenderer.invoke(IPC.snapshot),
  onWork: (cb) => subscribe(IPC.work, cb),
  onProjects: (cb) => subscribe(IPC.projects, cb),
  pickFolder: () => ipcRenderer.invoke(IPC.pickFolder),
  inspectProject: (path) => ipcRenderer.invoke(IPC.inspectProject, path),
  registerProject: (path, branch) => ipcRenderer.invoke(IPC.registerProject, path, branch),
  branches: (projectId) => ipcRenderer.invoke(IPC.branches, projectId),
  createWork: (projectId, input) => ipcRenderer.invoke(IPC.createWork, projectId, input),
  review: (workKey, taskId) => ipcRenderer.invoke(IPC.review, workKey, taskId),
  approve: (workKey, taskId, opts) => ipcRenderer.invoke(IPC.approve, workKey, taskId, opts),
  interrupt: (workKey, taskId) => ipcRenderer.invoke(IPC.interrupt, workKey, taskId),
  resume: (workKey, taskId) => ipcRenderer.invoke(IPC.resume, workKey, taskId),
  retry: (workKey, taskId) => ipcRenderer.invoke(IPC.retry, workKey, taskId),
  stopAfter: (workKey, on) => ipcRenderer.invoke(IPC.stopAfter, workKey, on),
  resumeWork: (workKey) => ipcRenderer.invoke(IPC.resumeWork, workKey),
  abandon: (workKey) => ipcRenderer.invoke(IPC.abandon, workKey),
  updateWorkSettings: (workKey, settings) =>
    ipcRenderer.invoke(IPC.workSettings, workKey, settings),
  config: () => ipcRenderer.invoke(IPC.config),
  updateConfig: (patch) => ipcRenderer.invoke(IPC.updateConfig, patch),
  selectWork: (workKey) => ipcRenderer.send(IPC.selectWork, workKey),
  onFocusWork: (cb) => subscribe(IPC.focusWork, cb),
  terminal: {
    attach: (key) => ipcRenderer.invoke(IPC.terminalAttach, key),
    write: (key, data) => ipcRenderer.invoke(IPC.terminalWrite, key, data),
    resize: (key, cols, rows) => ipcRenderer.invoke(IPC.terminalResize, key, cols, rows),
    onData: (key, cb) => subscribe(IPC.terminalData(key), cb),
  },
}

contextBridge.exposeInMainWorld(API_KEY, api)
