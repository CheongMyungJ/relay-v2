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
  onActivity: (cb) => subscribe(IPC.activity, cb),
  onProjects: (cb) => subscribe(IPC.projects, cb),
  pickFolder: () => ipcRenderer.invoke(IPC.pickFolder),
  inspectProject: (path) => ipcRenderer.invoke(IPC.inspectProject, path),
  registerProject: (path, branch) => ipcRenderer.invoke(IPC.registerProject, path, branch),
  branches: (projectId) => ipcRenderer.invoke(IPC.branches, projectId),
  createWork: (projectId, input) => ipcRenderer.invoke(IPC.createWork, projectId, input),
  review: (workKey, taskId) => ipcRenderer.invoke(IPC.review, workKey, taskId),
  approve: (workKey, taskId, opts) => ipcRenderer.invoke(IPC.approve, workKey, taskId, opts),
  cancelCountdown: (workKey, taskId) => ipcRenderer.invoke(IPC.cancelCountdown, workKey, taskId),
  answerQuestion: (workKey, taskId, questionId, answers) =>
    ipcRenderer.invoke(IPC.answerQuestion, workKey, taskId, questionId, answers),
  interrupt: (workKey, taskId) => ipcRenderer.invoke(IPC.interrupt, workKey, taskId),
  resume: (workKey, taskId) => ipcRenderer.invoke(IPC.resume, workKey, taskId),
  retry: (workKey, taskId) => ipcRenderer.invoke(IPC.retry, workKey, taskId),
  stopAfter: (workKey, on) => ipcRenderer.invoke(IPC.stopAfter, workKey, on),
  resumeWork: (workKey) => ipcRenderer.invoke(IPC.resumeWork, workKey),
  abandon: (workKey) => ipcRenderer.invoke(IPC.abandon, workKey),
  stepPreview: (workKey, node, keepCode, type) =>
    ipcRenderer.invoke(IPC.stepPreview, workKey, node, keepCode, type),
  selectStep: (workKey, input) => ipcRenderer.invoke(IPC.selectStep, workKey, input),
  deliver: (workKey, input) => ipcRenderer.invoke(IPC.deliver, workKey, input),
  openCleanup: (workKey, choice) => ipcRenderer.invoke(IPC.openCleanup, workKey, choice),
  closeCleanup: (workKey) => ipcRenderer.invoke(IPC.closeCleanup, workKey),
  finishCleanup: (workKey) => ipcRenderer.invoke(IPC.finishCleanup, workKey),
  recheck: (workKey) => ipcRenderer.invoke(IPC.recheck, workKey),
  cleanPreview: (workKey) => ipcRenderer.invoke(IPC.cleanPreview, workKey),
  clean: (workKey, input) => ipcRenderer.invoke(IPC.clean, workKey, input),
  retryOperation: (workKey) => ipcRenderer.invoke(IPC.retryOperation, workKey),
  ignoreOperation: (workKey) => ipcRenderer.invoke(IPC.ignoreOperation, workKey),
  dismissNotice: (workKey, id) => ipcRenderer.invoke(IPC.dismissNotice, workKey, id),
  openExternal: (url) => ipcRenderer.invoke(IPC.openExternal, url),
  prRefresh: (workKey) => ipcRenderer.invoke(IPC.prRefresh, workKey),
  prItem: (workKey, itemId, action) => ipcRenderer.invoke(IPC.prItem, workKey, itemId, action),
  prMergeInfo: (workKey) => ipcRenderer.invoke(IPC.prMergeInfo, workKey),
  prMerge: (workKey, input) => ipcRenderer.invoke(IPC.prMerge, workKey, input),
  prEnd: (workKey) => ipcRenderer.invoke(IPC.prEnd, workKey),
  prCleanOffered: (workKey) => ipcRenderer.invoke(IPC.prCleanOffered, workKey),
  prRespond: (workKey, input) => ipcRenderer.invoke(IPC.prRespond, workKey, input),
  prRerun: (workKey) => ipcRenderer.invoke(IPC.prRerun, workKey),
  updateProjectSettings: (projectId, settings) =>
    ipcRenderer.invoke(IPC.projectSettings, projectId, settings),
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
