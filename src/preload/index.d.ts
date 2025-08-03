import { ElectronAPI } from '@electron-toolkit/preload'

interface TrackerAPI {
  start: () => Promise<{ success: boolean; error?: string }>
  stop: () => Promise<{ success: boolean; error?: string }>
  getStatus: () => Promise<{ isTracking: boolean; currentApp?: string }>
  getConfig: () => Promise<any>
  updateConfig: (config: any) => Promise<{ success: boolean; error?: string }>
}

interface DashboardAPI {
  getData: () => Promise<any>
}

interface DataAPI {
  export: (format: 'json' | 'csv') => Promise<{ success: boolean; error?: string }>
  getDataPath: () => Promise<string>
}

interface ActivityAPI {
  getActivities: (filters?: any) => Promise<any[]>
}

interface ShellAPI {
  openPath: (path: string) => Promise<void>
}

interface DatabaseAPI {
  saveUserPreference: (key: string, value: any, type?: string) => Promise<{ success: boolean; error?: string }>
  getUserPreference: (key: string) => Promise<string | null>
  getAllUserPreferences: () => Promise<any>
  savePrivacySettings: (settings: any) => Promise<{ success: boolean; error?: string }>
  getPrivacySettings: () => Promise<any>
  saveDistractionSettings: (settings: any) => Promise<{ success: boolean; error?: string }>
  getDistractionSettings: () => Promise<any>
  backupDatabase: (backupPath: string) => Promise<{ success: boolean; error?: string }>
  cleanupOldData: (cutoffDate: Date) => Promise<{ success: boolean; error?: string }>
}

interface FileAPI {
  selectBackupLocation: () => Promise<{ canceled: boolean; filePaths: string[] }>
  performBackup: (backupPath: string) => Promise<{ success: boolean; error?: string }>
  cleanupOldData: (retentionDays: number) => Promise<{ success: boolean; error?: string }>
}

interface NotificationAPI {
  test: (message?: string) => Promise<{ success: boolean; error?: string }>
  show: (options: any) => Promise<void>
}

interface DialogAPI {
  showOpenDialog: (options: any) => Promise<{ canceled: boolean; filePaths: string[] }>
}

interface ExtendedElectronAPI extends ElectronAPI {
  shell: ShellAPI
}

declare global {
  interface Window {
    electron: ExtendedElectronAPI
    electronAPI: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
      // Export APIs
      exportJSON: (filters: any) => Promise<{ success: boolean; error?: string; recordCount?: number; fileSize?: number }>
      exportCSV: (filters: any) => Promise<{ success: boolean; error?: string; recordCount?: number; fileSize?: number }>
      generateProductivityReport: (format: string, period: any) => Promise<{ success: boolean; error?: string }>
      openExportFolder: () => Promise<void>
      
      // Backup APIs
      createBackup: (options: any) => Promise<{ success: boolean; error?: string; backupSize?: number }>
      restoreBackup: (backupPath: string, options: any) => Promise<{ success: boolean; error?: string; recordsImported?: number }>
      selectBackupFile: () => Promise<{ canceled: boolean; filePaths: string[] }>
      openBackupFolder: () => Promise<void>
      
      // API Server APIs
      startAPI: () => Promise<{ success: boolean; error?: string; port?: number }>
      stopAPI: () => Promise<{ success: boolean; error?: string }>
      getAPIStatus: () => Promise<{ running: boolean; port: number }>
      
      // Webhook APIs
      createWebhook: (webhook: any) => Promise<{ success: boolean; error?: string; webhook?: any }>
      updateWebhook: (id: string, webhook: any) => Promise<{ success: boolean; error?: string }>
      deleteWebhook: (id: string) => Promise<{ success: boolean; error?: string }>
      listWebhooks: () => Promise<any[]>
      testWebhook: (id: string) => Promise<{ success: boolean; error?: string }>
      
      // Integration Config APIs
      getIntegrationConfig: () => Promise<any>
      updateIntegrationConfig: (config: any) => Promise<{ success: boolean; error?: string }>
    }
    api: {
      tracker: TrackerAPI
      dashboard: DashboardAPI
      data: DataAPI
      activity: ActivityAPI
      shell: ShellAPI
      database: DatabaseAPI
      file: FileAPI
      notification: NotificationAPI
    }
    dialog: DialogAPI
    notifications: NotificationAPI
  }
}
