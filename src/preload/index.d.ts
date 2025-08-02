import { ElectronAPI } from '@electron-toolkit/preload'

interface TrackerAPI {
  start: () => Promise<void>
  stop: () => Promise<void>
  getStatus: () => Promise<{ isTracking: boolean; currentApp?: string }>
  getConfig: () => Promise<any>
  updateConfig: (config: any) => Promise<void>
}

interface DashboardAPI {
  getData: () => Promise<any>
}

interface DataAPI {
  export: (format: 'json' | 'csv') => Promise<void>
}

interface ActivityAPI {
  getActivities: (filters?: any) => Promise<any[]>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      tracker: TrackerAPI
      dashboard: DashboardAPI
      data: DataAPI
      activity: ActivityAPI
    }
  }
}
