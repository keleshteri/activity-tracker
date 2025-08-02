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

// Enhanced interfaces for analytics engine
export interface EnhancedDashboardData extends DashboardData {
  patterns: WorkPattern[]
  productivityBlocks: ProductivityBlock[]
  recommendations: Insight[]
  weeklyComparison: {
    currentWeek: number
    previousWeek: number
    percentageChange: number
  }
  monthlyTrends: {
    productivityTrend: 'improving' | 'declining' | 'stable'
    focusTrend: 'improving' | 'declining' | 'stable'
    distractionTrend: 'improving' | 'declining' | 'stable'
  }
}

export interface WorkPattern {
  id: string
  type: 'daily' | 'weekly' | 'monthly'
  name: string
  description: string
  confidence: number // 0-1
  frequency: number
  timeOfDay?: {
    start: number // hour 0-23
    end: number // hour 0-23
  }
  dayOfWeek?: number[] // 0-6, Sunday = 0
  associatedApps: string[]
  productivityImpact: 'positive' | 'negative' | 'neutral'
  detectedAt: number
  lastSeen: number
}

export interface ProductivityBlock {
  id: string
  startTime: number
  endTime: number
  duration: number
  type: 'deep_focus' | 'shallow_work' | 'break' | 'distraction'
  focusScore: number
  dominantActivity: string
  interruptions: number
  contextSwitches: number
  productivityRating: ProductivityRating
  energyLevel?: 'high' | 'medium' | 'low'
  qualityScore: number // 0-100
}

export interface Insight {
  id: string
  category: 'productivity' | 'focus' | 'patterns' | 'health' | 'optimization'
  type: string
  title: string
  description: string
  actionable: boolean
  priority: 'low' | 'medium' | 'high' | 'critical'
  confidence: number // 0-1
  impact: 'low' | 'medium' | 'high'
  timeframe: 'immediate' | 'short_term' | 'long_term'
  data: any // Supporting data for the insight
  timestamp: number
  expiresAt?: number
  isDismissed: boolean
}

// Migration system interfaces
export interface DatabaseMigration {
  version: number
  name: string
  description: string
  up: string[] // SQL statements to apply migration
  down: string[] // SQL statements to rollback migration
  timestamp: number
}

export interface MigrationState {
  currentVersion: number
  appliedMigrations: number[]
  lastMigrationAt: number
}
