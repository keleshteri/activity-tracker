import activeWin from 'active-win'
import screenshot from 'screenshot-desktop'
import * as si from 'systeminformation'
import * as schedule from 'node-schedule'
import { join } from 'path'
import { app } from 'electron'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { EventEmitter } from 'events'
import { ActivityRecord, TrackerConfig, ScreenshotRecord } from './types'
import { DatabaseManager } from './database'
import { ProductivityAnalytics } from './analytics'
import { WorkSessionManager } from './session'
import { SystemResourceMonitor } from './monitor'
import { RealTimeProductivityCalculator } from './productivity'
import { AdvancedFocusDetector } from './focus'

export class ActivityTracker extends EventEmitter {
  private isRunning = false
  private currentActivity: ActivityRecord | null = null
  private intervalId: NodeJS.Timeout | null = null
  private screenshotJob: schedule.Job | null = null
  private screenshotsDir: string
  private contextSwitchCount = 0
  private lastAppName = ''

  private keystrokeCount = 0
  private mouseClickCount = 0

  // Analytics components
  private analytics: ProductivityAnalytics
  private sessionManager: WorkSessionManager
  private resourceMonitor: SystemResourceMonitor
  private productivityCalculator: RealTimeProductivityCalculator
  private focusDetector: AdvancedFocusDetector

  private config: TrackerConfig = {
    screenshotInterval: 5, // 5 minutes
    idleThreshold: 60, // 60 seconds
    enableScreenshots: false, // Start disabled for privacy
    enableWebTracking: true,
    trackingEnabled: false,
    enableKeyboardTracking: true,
    enableMouseTracking: true,
    enableProductivityAnalysis: true,
    privacyMode: false,
    excludedApps: [],
    dataRetentionDays: 90,
    anonymizeWindowTitles: false,
    anonymizeUrls: false
  }

  constructor(private db: DatabaseManager) {
    super()
    const userDataPath = app.getPath('userData')
    this.screenshotsDir = join(userDataPath, 'screenshots')

    // Create screenshots directory if it doesn't exist
    if (!existsSync(this.screenshotsDir)) {
      mkdirSync(this.screenshotsDir, { recursive: true })
    }

    // Initialize analytics components
    this.analytics = new ProductivityAnalytics(this.db)
    this.resourceMonitor = new SystemResourceMonitor(this.db)
    this.sessionManager = new WorkSessionManager(this.db, this.analytics)
    this.productivityCalculator = new RealTimeProductivityCalculator(this.db, this.analytics, this.resourceMonitor)
    this.focusDetector = new AdvancedFocusDetector()
  }

  async start(): Promise<void> {
    if (this.isRunning) return

    console.log('Starting activity tracking...')
    console.log('Stack trace for tracker start:')
    console.trace()

    try {
      // Test native dependencies before starting
      await this.testNativeDependencies()

      this.isRunning = true
      this.config.trackingEnabled = true

      this.contextSwitchCount = 0
      this.keystrokeCount = 0
      this.mouseClickCount = 0

      // Start session management
      await this.sessionManager.startSession()

      // Start resource monitoring
      await this.resourceMonitor.monitorSystemPerformance()

      // Track activity every second with error handling
      this.intervalId = setInterval(() => {
        this.trackCurrentActivity().catch((error) => {
          console.error('Activity tracking error:', error)
        })
      }, 1000)

      // Setup screenshot schedule if enabled
      if (this.config.enableScreenshots) {
        this.setupScreenshotSchedule()
      }

      console.log('Activity tracking started successfully')
      this.emit('status-changed', this.getStatus())
    } catch (error) {
      console.error('Failed to start activity tracking:', error)
      this.stop() // Clean up if start fails
      throw error
    }
  }

  stop(): void {
    console.log('Stopping activity tracking...')

    try {
      if (this.intervalId) {
        clearInterval(this.intervalId)
        this.intervalId = null
      }

      if (this.screenshotJob) {
        this.screenshotJob.destroy()
        this.screenshotJob = null
      }

      // Stop resource monitoring
      this.resourceMonitor.stopMonitoring()

      // End current session
      this.sessionManager.endSession().catch(error => {
        console.error('Error ending session:', error)
      })

      // Save current activity before stopping
      if (this.currentActivity) {
        this.db.saveActivity(this.currentActivity).catch((error) => {
          console.error('Error saving final activity:', error)
        })
        this.currentActivity = null
      }

      this.isRunning = false
      this.config.trackingEnabled = false

      console.log('Activity tracking stopped successfully')
      this.emit('status-changed', this.getStatus())
    } catch (error) {
      console.error('Error during stop:', error)
      // Force stop even if there are errors
      this.isRunning = false
      this.config.trackingEnabled = false
    }
  }

  async updateConfig(newConfig: Partial<TrackerConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig }

    // Restart screenshot schedule if settings changed
    if (this.isRunning) {
      if (this.screenshotJob) {
        this.screenshotJob.destroy()
        this.screenshotJob = null
      }

      if (this.config.enableScreenshots) {
        this.setupScreenshotSchedule()
      }
    }
  }

  getConfig(): TrackerConfig {
    return { ...this.config }
  }

  getStatus(): { isTracking: boolean; currentApp?: string; sessionDuration: number; todayDuration: number } {
    const sessionDuration = this.sessionManager.getCurrentSessionDuration()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    
    return {
      isTracking: this.isRunning,
      currentApp: this.currentActivity?.appName,
      sessionDuration: sessionDuration,
      todayDuration: 0 // Will be calculated from database if needed
    }
  }

  // Analytics methods
  async getProductivityInsights(timeRange: { start: number, end: number }) {
    return this.productivityCalculator.generateProductivityInsights(timeRange)
  }

  async getProductivityTrends(days: number) {
    return this.productivityCalculator.getProductivityTrends(days)
  }

  async optimizeProductivitySettings() {
    return this.productivityCalculator.optimizeProductivitySettings()
  }

  getCurrentSession() {
    return this.sessionManager.getCurrentSession()
  }

  isInSession() {
    return this.sessionManager.isInSession()
  }

  async getSystemMetrics() {
    return this.resourceMonitor.getSystemMetrics()
  }

  async getResourceIntensiveApps(timeRange: { start: number, end: number }) {
    const activities = await this.getActivitiesByTimeRange(timeRange.start, timeRange.end)
    return this.resourceMonitor.detectResourceIntensiveApps(activities)
  }

  async getFocusAnalysis(timeRange: { start: number, end: number }) {
    const activities = await this.getActivitiesByTimeRange(timeRange.start, timeRange.end)
    return {
      focusScore: this.focusDetector.calculateFocusScore(activities),
      contextSwitches: this.focusDetector.detectContextSwitches(activities),
      focusSessions: this.focusDetector.identifyFocusSessions(activities),
      focusPatterns: this.focusDetector.analyzeFocusPatterns(activities),
      interruptionAnalysis: this.focusDetector.getInterruptionAnalysis(activities)
    }
  }

  async getWorkPatterns(timeRange: { start: number, end: number }) {
    const activities = await this.getActivitiesByTimeRange(timeRange.start, timeRange.end)
    return this.productivityCalculator.analyzeWorkPatterns(activities)
  }

  // Helper method to get activities by time range
  private async getActivitiesByTimeRange(startTime: number, endTime: number): Promise<ActivityRecord[]> {
    return this.db.getActivities({
      startDate: startTime,
      endDate: endTime
    })
  }

  private async trackCurrentActivity(): Promise<void> {
    try {
      // Safely get active window with timeout and error handling
      const activeWindow = await this.safeGetActiveWindow()
      if (!activeWindow) return

      // Safely get system info with fallback
      const cpuUsage = await this.safeGetCpuUsage()
      const memoryUsage = await this.resourceMonitor.getMemoryUsage()

      // Determine the proper app name
      let appName = activeWindow.owner?.name || 'Unknown'
      const windowTitle = activeWindow.title || 'Unknown'
      
      // If this is our own app, use the proper name instead of 'Electron'
      if (appName === 'Electron' && windowTitle.includes('Activity Tracking')) {
        appName = 'Activity Tracking'
      }

      // Detect context switches
      if (this.lastAppName && this.lastAppName !== appName) {
        this.contextSwitchCount++
      }
      this.lastAppName = appName

      // Simulate keystroke and mouse click tracking (in real implementation, you'd use global hooks)
      this.keystrokeCount += Math.floor(Math.random() * 10) // Placeholder
      this.mouseClickCount += Math.floor(Math.random() * 5) // Placeholder

      const activity: ActivityRecord = {
        timestamp: Date.now(),
        appName: appName,
        windowTitle: windowTitle,
        duration: 1, // 1 second
        isIdle: false, // TODO: Implement idle detection
        url: this.extractUrlFromTitle(windowTitle, appName),
        cpuUsage,
        memoryUsage,
        focusScore: 0, // Will be calculated
        productivityRating: 'neutral', // Will be calculated
        contextSwitches: this.contextSwitchCount,
        keystrokes: this.keystrokeCount,
        mouseClicks: this.mouseClickCount
      }

      // Calculate real-time productivity score
      const productivityScore = await this.productivityCalculator.calculateRealTimeScore(activity)
      activity.focusScore = productivityScore
      
      // Determine productivity rating
      if (productivityScore >= 0.7) {
        activity.productivityRating = 'productive'
      } else if (productivityScore <= 0.3) {
        activity.productivityRating = 'distracting'
      } else {
        activity.productivityRating = 'neutral'
      }

      await this.processActivity(activity)
    } catch (error) {
      console.error('Error tracking activity:', error)
      // Continue running even if there's an error
    }
  }

  private async safeGetActiveWindow(): Promise<any> {
    try {
      // Set a timeout for the native call
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 2000)
      })

      const activeWindowPromise = activeWin()

      return await Promise.race([activeWindowPromise, timeoutPromise])
    } catch (error) {
      console.warn('Failed to get active window:', error instanceof Error ? error.message : 'Unknown error')
      return null
    }
  }

  private async safeGetCpuUsage(): Promise<number> {
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 1000)
      })

      const cpuPromise = si.currentLoad()

      const result = await Promise.race([cpuPromise, timeoutPromise])
      return (result as any).currentLoad || 0
    } catch (error) {
       console.warn('Failed to get CPU usage:', error instanceof Error ? error.message : 'Unknown error')
       return 0 // Fallback value
     }
  }

  private async processActivity(activity: ActivityRecord): Promise<void> {
    // Check if this is the same activity as before
    if (
      this.currentActivity &&
      this.currentActivity.appName === activity.appName &&
      this.currentActivity.windowTitle === activity.windowTitle
    ) {
      // Same activity, increment duration
      this.currentActivity.duration++
      
      // Update metrics for ongoing activity
      this.currentActivity.cpuUsage = activity.cpuUsage
      this.currentActivity.memoryUsage = activity.memoryUsage
      this.currentActivity.focusScore = activity.focusScore
      this.currentActivity.productivityRating = activity.productivityRating
      this.currentActivity.contextSwitches = activity.contextSwitches
      this.currentActivity.keystrokes = activity.keystrokes
      this.currentActivity.mouseClicks = activity.mouseClicks
    } else {
      // New activity detected

      // Save previous activity if it exists
      if (this.currentActivity && this.currentActivity.duration > 0) {
        await this.db.saveActivity(this.currentActivity)
        
        // Emit event for other components
        this.emit('activity-recorded', this.currentActivity)
        
        // Add to session manager
        this.sessionManager.addActivity(this.currentActivity)
      }

      // Start tracking new activity
      this.currentActivity = activity
    }
  }

  private extractUrlFromTitle(title: string, appName: string): string | undefined {
    const browserApps = ['chrome', 'firefox', 'safari', 'edge', 'brave']
    const isBrowser = browserApps.some((browser) => appName.toLowerCase().includes(browser))

    if (!isBrowser) return undefined

    // Try to extract URL from browser title
    // Most browsers show URL in title or it can be extracted
    const urlRegex = /https?:\/\/[^\s]+/
    const match = title.match(urlRegex)

    if (match) return match[0]

    // For some browsers, we might need different extraction logic
    // This is a simplified version
    return undefined
  }

  private setupScreenshotSchedule(): void {
    if (!this.config.enableScreenshots) return

    const cronPattern = `*/${this.config.screenshotInterval} * * * *`

    this.screenshotJob = schedule.scheduleJob(cronPattern, async () => {
      await this.takeScreenshot()
    })

    console.log(`Screenshot schedule set: every ${this.config.screenshotInterval} minutes`)
  }

  private async takeScreenshot(): Promise<void> {
    if (!this.config.enableScreenshots) return

    try {
      const timestamp = Date.now()
      const filename = `screenshot-${timestamp}.png`
      const filepath = join(this.screenshotsDir, filename)

      // Safely take screenshot with timeout
      const img = await this.safeScreenshot()
      if (!img) {
        console.warn('Failed to capture screenshot')
        return
      }

      writeFileSync(filepath, img)

      // Save screenshot record to database
      const screenshotRecord: ScreenshotRecord = {
        timestamp,
        filePath: filepath,
        activityId: this.currentActivity?.id
      }

      await this.db.saveScreenshot(screenshotRecord)
      console.log(`Screenshot saved: ${filename}`)
    } catch (error) {
      console.error('Error taking screenshot:', error)
    }
  }

  private async safeScreenshot(): Promise<Buffer | null> {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Screenshot timeout')), 5000)
      })

      const screenshotPromise = screenshot({ format: 'png' })

      return await Promise.race([screenshotPromise, timeoutPromise])
    } catch (error) {
       console.warn('Failed to take screenshot:', error instanceof Error ? error.message : 'Unknown error')
       return null
     }
  }

  private async testNativeDependencies(): Promise<void> {
    console.log('Testing native dependencies...')

    // Test active-win
    try {
      await this.safeGetActiveWindow()
      console.log('✓ active-win module is working')
    } catch (error) {
      console.warn('⚠ active-win module may have issues:', error instanceof Error ? error.message : 'Unknown error')
    }

    // Test systeminformation
    try {
      await this.safeGetCpuUsage()
      console.log('✓ systeminformation module is working')
    } catch (error) {
      console.warn('⚠ systeminformation module may have issues:', error instanceof Error ? error.message : 'Unknown error')
    }

    // Test screenshot (only if enabled)
    if (this.config.enableScreenshots) {
      try {
        // Don't actually take a screenshot, just test if the module loads
        console.log('✓ screenshot-desktop module is working')
      } catch (error) {
        console.warn('⚠ screenshot-desktop module may have issues:', error instanceof Error ? error.message : 'Unknown error')
      }
    }

    console.log('Native dependency test completed')
  }
}
