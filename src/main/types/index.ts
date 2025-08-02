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
  memoryUsage?: number
  focusScore?: number
  productivityRating?: ProductivityRating
  contextSwitches?: number
  keystrokes?: number
  mouseClicks?: number
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
  enableKeyboardTracking: boolean
  enableMouseTracking: boolean
  enableProductivityAnalysis: boolean
  privacyMode: boolean
  excludedApps: string[]
  dataRetentionDays: number
  anonymizeWindowTitles: boolean
  anonymizeUrls: boolean
}

export interface DashboardData {
  today: {
    totalTime: number
    activeTime: number
    idleTime: number
    productiveTime: number
    distractingTime: number
    focusScore: number
    contextSwitches: number
    topApps: Array<{ name: string; time: number; percentage: number; productivity: ProductivityRating }>
    categories: Array<{ name: string; time: number; productivity: ProductivityRating }>
    peakHours: Array<{ hour: number; productivity: number }>
  }
  thisWeek: {
    totalTime: number
    productiveTime: number
    dailyBreakdown: Array<{ day: string; time: number; productivity: number }>
    weeklyTrend: 'improving' | 'declining' | 'stable'
  }
  insights: ProductivityInsight[]
}

export type ProductivityRating = 'productive' | 'neutral' | 'distracting'

export interface ProductivityInsight {
  id: string
  type: 'peak_hours' | 'distraction_pattern' | 'focus_improvement' | 'break_suggestion' | 'app_recommendation'
  title: string
  description: string
  actionable: boolean
  priority: 'low' | 'medium' | 'high'
  timestamp: number
}

export interface WorkSession {
  id?: number
  startTime: number
  endTime: number
  duration: number
  focusScore: number
  productivityRating: ProductivityRating
  contextSwitches: number
  breakDuration: number
  dominantApp: string
  dominantCategory: string
}

export interface AppCategory {
  id?: number
  appName: string
  category: string
  productivityRating: ProductivityRating
  isUserDefined: boolean
  createdAt: number
  updatedAt: number
}

export interface ProductivityMetrics {
  id?: number
  date: string // YYYY-MM-DD format
  totalActiveTime: number
  productiveTime: number
  neutralTime: number
  distractingTime: number
  focusScore: number
  contextSwitches: number
  peakProductivityHour: number
  breakFrequency: number
  averageSessionDuration: number
}

export interface BreakPattern {
  id?: number
  timestamp: number
  duration: number
  type: 'micro' | 'short' | 'long' // <5min, 5-30min, >30min
  beforeActivity: string
  afterActivity: string
}

export interface FocusSession {
  id?: number
  startTime: number
  endTime: number
  duration: number
  appName: string
  category: string
  interruptions: number
  focusScore: number
  keystrokes: number
  mouseClicks: number
}

export interface PrivacySettings {
  id?: number
  anonymizeWindowTitles: boolean
  anonymizeUrls: boolean
  excludedApps: string[]
  excludedDomains: string[]
  enableScreenshots: boolean
  screenshotBlurLevel: number
  dataRetentionDays: number
  exportDataOnDelete: boolean
}

export interface SystemMetrics {
  id?: number
  timestamp: number
  cpuUsage: number
  memoryUsage: number
  diskUsage: number
  networkActivity: number
  batteryLevel?: number
  isCharging?: boolean
}
