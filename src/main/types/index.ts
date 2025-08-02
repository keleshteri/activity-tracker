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

export interface Achievement {
  id: string
  type: 'productivity_milestone' | 'focus_improvement' | 'consistency' | 'efficiency' | 'work_life_balance'
  title: string
  description: string
  timestamp: number
  value: number
  threshold: number
  category: 'daily' | 'weekly' | 'monthly' | 'all_time'
  badge?: string
}

export interface ProductivityWarning {
  id: string
  type: 'declining_productivity' | 'excessive_distraction' | 'burnout_risk' | 'poor_focus' | 'overwork'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  timestamp: number
  trend: 'increasing' | 'stable' | 'decreasing'
  recommendations: string[]
  threshold: number
  currentValue: number
}

export interface WorkHabit {
  id: string
  type: 'app_usage' | 'time_preference' | 'break_timing' | 'focus_duration' | 'multitasking'
  pattern: string
  frequency: number
  confidence: number
  description: string
  impact: 'positive' | 'negative' | 'neutral'
  recommendation?: string
  detectedAt: number
}

export interface ProductivityCycle {
  id: string
  startHour: number
  endHour: number
  type: 'peak' | 'moderate' | 'low'
  averageProductivity: number
  consistency: number
  daysObserved: number
  confidence: number
}

export interface ContextSwitchPattern {
  id: string
  fromApp: string
  toApp: string
  frequency: number
  averageDuration: number
  timeOfDay: number[]
  impact: 'disruptive' | 'neutral' | 'beneficial'
  pattern: 'habitual' | 'reactive' | 'planned'
}

export interface ProductivityTrend {
  date: string
  productivityScore: number
  focusScore: number
  totalActiveTime: number
  contextSwitches: number
  breakFrequency: number
}

export interface ProductivityOptimization {
  recommendations: string[]
  optimalWorkHours: { start: number, end: number }
  suggestedBreakInterval: number
  focusImprovements: string[]
  resourceOptimizations: string[]
}

// Distraction Management Types
export interface DistractionSettings {
  id?: number
  enableDistractionDetection: boolean
  distractionThreshold: number // minutes of distracting app usage before alert
  contextSwitchThreshold: number // number of switches per hour before alert
  enableNotifications: boolean
  notificationStyle: 'gentle' | 'standard' | 'persistent'
  quietHours: {
    enabled: boolean
    start: string // HH:MM format
    end: string // HH:MM format
  }
  blockedApps: string[]
  allowedBreakApps: string[]
  focusSessionReminders: boolean
  breakReminders: boolean
  createdAt: number
  updatedAt: number
}

export interface DistractionEvent {
  id?: number
  timestamp: number
  type: 'app_distraction' | 'excessive_switching' | 'break_overrun' | 'focus_loss'
  appName: string
  duration: number
  severity: 'low' | 'medium' | 'high'
  contextSwitches: number
  wasNotified: boolean
  userResponse?: 'dismissed' | 'acknowledged' | 'blocked_app'
}

// Focus Session Management Types
export interface FocusSessionConfig {
  duration: number // minutes
  type: 'pomodoro' | 'deep_focus' | 'custom'
  breakDuration?: number // minutes
  longBreakDuration?: number // minutes
  sessionsUntilLongBreak?: number
  allowedApps?: string[]
  blockedApps?: string[]
  enableNotifications: boolean
  enableSounds: boolean
  autoStartBreaks: boolean
  strictMode: boolean // blocks all non-allowed apps
}

export interface ActiveFocusSession {
  id: string
  config: FocusSessionConfig
  startTime: number
  plannedEndTime: number
  currentPhase: 'focus' | 'break' | 'long_break'
  phaseStartTime: number
  sessionsCompleted: number
  isPaused: boolean
  pausedAt?: number
  totalPausedTime: number
  interruptions: number
  focusScore: number
}

export interface FocusSessionAnalytics {
  totalSessions: number
  totalFocusTime: number
  averageSessionDuration: number
  completionRate: number
  averageFocusScore: number
  mostProductiveHours: number[]
  commonInterruptions: string[]
  weeklyTrend: 'improving' | 'declining' | 'stable'
  streakDays: number
  bestStreak: number
}

// App Categorization Suggestions
export interface AppCategorizationSuggestion {
  appName: string
  suggestedCategory: string
  suggestedProductivityRating: ProductivityRating
  confidence: number
  reason: string
  isCommonApp: boolean
}
