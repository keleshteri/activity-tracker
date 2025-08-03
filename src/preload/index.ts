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

  // Insights APIs
  insights: {
    getProductivity: (limit?: number) => ipcRenderer.invoke('insights:get-productivity', limit),
    getAll: (category?: string, limit?: number) => ipcRenderer.invoke('insights:get-all', category, limit),
    generate: (timeRange: { start: number, end: number }) => ipcRenderer.invoke('insights:generate', timeRange)
  },

  // App Categories APIs
  appCategories: {
    getAll: () => ipcRenderer.invoke('app-categories:get-all'),
    save: (category: any) => ipcRenderer.invoke('app-categories:save', category),
    delete: (appName: string) => ipcRenderer.invoke('app-categories:delete', appName),
    getSuggestions: () => ipcRenderer.invoke('app-categories:get-suggestions'),
    applySuggestions: (suggestions: any[]) => ipcRenderer.invoke('app-categories:apply-suggestions', suggestions)
  },

  // Distraction Management APIs
  distraction: {
    getSettings: () => ipcRenderer.invoke('distraction:get-settings'),
    saveSettings: (settings: any) => ipcRenderer.invoke('distraction:save-settings', settings),
    getEvents: (filters?: any) => ipcRenderer.invoke('distraction:get-events', filters)
  },

  // Focus Session APIs
  focusSession: {
    start: (sessionConfig: any) => ipcRenderer.invoke('focus-session:start', sessionConfig),
    stop: () => ipcRenderer.invoke('focus-session:stop'),
    getCurrent: () => ipcRenderer.invoke('focus-session:get-current'),
    getHistory: (filters?: any) => ipcRenderer.invoke('focus-session:get-history', filters),
    getAnalytics: () => ipcRenderer.invoke('focus-session:get-analytics'),
    getSettings: () => ipcRenderer.invoke('focus-session:get-settings'),
    saveSettings: (settings: any) => ipcRenderer.invoke('focus-session:save-settings', settings),
    pause: () => ipcRenderer.invoke('focus-session:pause'),
    resume: () => ipcRenderer.invoke('focus-session:resume'),
    recordInterruption: (interruption: any) => ipcRenderer.invoke('focus-session:record-interruption', interruption)
  },

  // Goals APIs
  goals: {
    getAll: () => ipcRenderer.invoke('goals:get-all'),
    save: (goal: any) => ipcRenderer.invoke('goals:save', goal),
    delete: (goalId: string) => ipcRenderer.invoke('goals:delete', goalId),
    getProgress: (goalId: string) => ipcRenderer.invoke('goals:get-progress', goalId)
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

  // Platform APIs
  platform: {
    getInfo: () => ipcRenderer.invoke('platform:get-info'),
    getCapabilities: () => ipcRenderer.invoke('platform:get-capabilities'),
    getTheme: () => ipcRenderer.invoke('platform:get-theme'),
    showNotification: (title: string, body: string, options?: any) => 
      ipcRenderer.invoke('platform:show-notification', title, body, options),
    openFileManager: (path?: string) => ipcRenderer.invoke('platform:open-file-manager', path),
    showItemInFolder: (filePath: string) => ipcRenderer.invoke('platform:show-item-in-folder', filePath)
  },

  // Auto-updater APIs
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('updater:check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('updater:download-update'),
    quitAndInstall: () => ipcRenderer.invoke('updater:quit-and-install'),
    getStatus: () => ipcRenderer.invoke('updater:get-status')
  },

  // Tray APIs
  tray: {
    showNotification: (title: string, body: string, options?: any) => 
      ipcRenderer.invoke('tray:show-notification', title, body, options),
    getCapabilities: () => ipcRenderer.invoke('tray:get-capabilities'),
    enableMenuBarMode: () => ipcRenderer.invoke('tray:enable-menubar-mode'),
    disableMenuBarMode: () => ipcRenderer.invoke('tray:disable-menubar-mode')
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
export type InsightsAPI = typeof api.insights
export type AppCategoriesAPI = typeof api.appCategories
export type DistractionAPI = typeof api.distraction
export type FocusSessionAPI = typeof api.focusSession
export type GoalsAPI = typeof api.goals
export type DatabaseAPI = typeof api.database
export type FileAPI = typeof api.file
export type NotificationAPI = typeof api.notification
export type PlatformAPI = typeof api.platform
export type UpdaterAPI = typeof api.updater
export type TrayAPI = typeof api.tray
