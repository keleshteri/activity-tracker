export interface ActivityRecord {
  id?: number
  timestamp: number
  appName: string
  windowTitle: string
  duration: number
  category?: string
  isIdle: boolean
  url?: string
  cpuUsage?: number
}

export interface ScreenshotRecord {
  id?: number
  timestamp: number
  filePath: string
  activityId?: number
}

export interface TrackerConfig {
  screenshotInterval: number // minutes
  idleThreshold: number // seconds
  enableScreenshots: boolean
  enableWebTracking: boolean
  trackingEnabled: boolean
}

export interface DashboardData {
  today: {
    totalTime: number
    activeTime: number
    idleTime: number
    topApps: Array<{ name: string; time: number; percentage: number }>
    categories: Array<{ name: string; time: number }>
  }
  thisWeek: {
    totalTime: number
    dailyBreakdown: Array<{ day: string; time: number }>
  }
}
