// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // Activity Tracker APIs
  tracker: {
    start: () => ipcRenderer.invoke('tracker:start'),
    stop: () => ipcRenderer.invoke('tracker:stop'),
    getStatus: () => ipcRenderer.invoke('tracker:status'),
    getConfig: () => ipcRenderer.invoke('tracker:config:get'),
    updateConfig: (config: any) => ipcRenderer.invoke('tracker:config:update', config)
  },

  // Dashboard APIs
  dashboard: {
    getData: () => ipcRenderer.invoke('dashboard:get-data')
  },

  // Data management APIs
  data: {
    export: (format: 'json' | 'csv') => ipcRenderer.invoke('data:export', format),
    getDataPath: () => ipcRenderer.invoke('app:get-data-path')
  },

  // Activity log APIs
  activity: {
    getActivities: (filters?: any) => ipcRenderer.invoke('activity:get-activities', filters)
  },

  // Utility APIs
  ping: () => ipcRenderer.send('ping')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

// Type definitions for the exposed APIs
export type TrackerAPI = typeof api.tracker
export type DashboardAPI = typeof api.dashboard
export type DataAPI = typeof api.data
export type ActivityAPI = typeof api.activity
