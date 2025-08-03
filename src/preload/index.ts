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

  // Shell APIs
  shell: {
    openPath: (path: string) => ipcRenderer.invoke('shell:open-path', path)
  },

  // Database APIs
  database: {
    saveUserPreference: (key: string, value: any, type?: string) => 
      ipcRenderer.invoke('database:save-user-preference', key, value, type),
    getUserPreference: (key: string) => 
      ipcRenderer.invoke('database:get-user-preference', key),
    getAllUserPreferences: () => 
      ipcRenderer.invoke('database:get-all-user-preferences'),
    savePrivacySettings: (settings: any) => 
      ipcRenderer.invoke('database:save-privacy-settings', settings),
    getPrivacySettings: () => 
      ipcRenderer.invoke('database:get-privacy-settings'),
    saveDistractionSettings: (settings: any) => 
      ipcRenderer.invoke('database:save-distraction-settings', settings),
    getDistractionSettings: () => 
      ipcRenderer.invoke('database:get-distraction-settings')
  },

  // File system APIs
  file: {
    selectBackupLocation: () => ipcRenderer.invoke('file:select-backup-location'),
    performBackup: (backupPath: string) => ipcRenderer.invoke('file:perform-backup', backupPath),
    cleanupOldData: (retentionDays: number) => ipcRenderer.invoke('file:cleanup-old-data', retentionDays)
  },

  // Notification APIs
  notification: {
    test: (message?: string) => ipcRenderer.invoke('notification:test', message)
  },

  // Utility APIs
  ping: () => ipcRenderer.send('ping'),

  // IPC invoke method for compatibility
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args)
}

// Create electronAPI object with export/integration methods
const electronAPIExtended = {
  // Export APIs
  exportJSON: (filters: any) => ipcRenderer.invoke('export:json', filters),
  exportCSV: (filters: any) => ipcRenderer.invoke('export:csv', filters),
  generateProductivityReport: (format: string, period: any) => 
    ipcRenderer.invoke('export:productivity-report', format, period),
  openExportFolder: () => ipcRenderer.invoke('export:open-folder'),

  // Backup APIs
  createBackup: (options: any) => ipcRenderer.invoke('backup:create', options),
  restoreBackup: (backupPath: string, options: any) => 
    ipcRenderer.invoke('backup:restore', backupPath, options),
  selectBackupFile: () => ipcRenderer.invoke('backup:select-file'),
  openBackupFolder: () => ipcRenderer.invoke('backup:open-folder'),

  // API Server APIs
  startAPI: () => ipcRenderer.invoke('api:start'),
  stopAPI: () => ipcRenderer.invoke('api:stop'),
  getAPIStatus: () => ipcRenderer.invoke('api:status'),

  // Webhook APIs
  createWebhook: (webhook: any) => ipcRenderer.invoke('webhook:create', webhook),
  updateWebhook: (id: string, webhook: any) => ipcRenderer.invoke('webhook:update', id, webhook),
  deleteWebhook: (id: string) => ipcRenderer.invoke('webhook:delete', id),
  listWebhooks: () => ipcRenderer.invoke('webhook:list'),
  testWebhook: (id: string) => ipcRenderer.invoke('webhook:test', id),

  // Integration Config APIs
  getIntegrationConfig: () => ipcRenderer.invoke('integration:config:get'),
  updateIntegrationConfig: (config: any) => ipcRenderer.invoke('integration:config:update', config)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('electronAPI', electronAPIExtended)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.electronAPI = electronAPIExtended
  // @ts-ignore (define in dts)
  window.api = api
}

// Type definitions for the exposed APIs
export type TrackerAPI = typeof api.tracker
export type DashboardAPI = typeof api.dashboard
export type DataAPI = typeof api.data
export type ActivityAPI = typeof api.activity
export type DatabaseAPI = typeof api.database
export type FileAPI = typeof api.file
export type NotificationAPI = typeof api.notification
