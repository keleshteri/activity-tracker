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

interface ExtendedElectronAPI extends ElectronAPI {
  shell: ShellAPI
}

declare global {
  interface Window {
    electron: ExtendedElectronAPI
    api: {
      tracker: TrackerAPI
      dashboard: DashboardAPI
      data: DataAPI
      activity: ActivityAPI
      shell: ShellAPI
    }
  }
}
