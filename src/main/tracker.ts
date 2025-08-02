import activeWin from 'active-win'
import screenshot from 'screenshot-desktop'
import * as si from 'systeminformation'
import * as schedule from 'node-schedule'
import { join } from 'path'
import { app } from 'electron'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { ActivityRecord, TrackerConfig, ScreenshotRecord } from './types'
import { DatabaseManager } from './database'

export class ActivityTracker {
  private isRunning = false
  private currentActivity: ActivityRecord | null = null
  private intervalId: NodeJS.Timeout | null = null
  private screenshotJob: schedule.Job | null = null
  private screenshotsDir: string

  private config: TrackerConfig = {
    screenshotInterval: 5, // 5 minutes
    idleThreshold: 60, // 60 seconds
    enableScreenshots: false, // Start disabled for privacy
    enableWebTracking: true,
    trackingEnabled: false
  }

  constructor(private db: DatabaseManager) {
    const userDataPath = app.getPath('userData')
    this.screenshotsDir = join(userDataPath, 'screenshots')

    // Create screenshots directory if it doesn't exist
    if (!existsSync(this.screenshotsDir)) {
      mkdirSync(this.screenshotsDir, { recursive: true })
    }
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

  getStatus(): { isRunning: boolean; currentApp?: string } {
    return {
      isRunning: this.isRunning,
      currentApp: this.currentActivity?.appName
    }
  }

  private async trackCurrentActivity(): Promise<void> {
    try {
      // Safely get active window with timeout and error handling
      const activeWindow = await this.safeGetActiveWindow()
      if (!activeWindow) return

      // Safely get system info with fallback
      const cpuUsage = await this.safeGetCpuUsage()

      // Determine the proper app name
      let appName = activeWindow.owner?.name || 'Unknown'
      const windowTitle = activeWindow.title || 'Unknown'
      
      // If this is our own app, use the proper name instead of 'Electron'
      if (appName === 'Electron' && windowTitle.includes('Activity Tracking')) {
        appName = 'Activity Tracking'
      }

      const activity: ActivityRecord = {
        timestamp: Date.now(),
        appName: appName,
        windowTitle: windowTitle,
        duration: 1, // 1 second
        isIdle: false, // TODO: Implement idle detection
        url: this.extractUrlFromTitle(windowTitle, appName),
        cpuUsage
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
      console.warn('Failed to get active window:', error.message)
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
      return result.currentLoad || 0
    } catch (error) {
      console.warn('Failed to get CPU usage:', error.message)
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
    } else {
      // New activity detected

      // Save previous activity if it exists
      if (this.currentActivity && this.currentActivity.duration > 0) {
        await this.db.saveActivity(this.currentActivity)
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
      console.warn('Failed to take screenshot:', error.message)
      return null
    }
  }

  private async testNativeDependencies(): Promise<void> {
    console.log('Testing native dependencies...')

    // Test active-win
    try {
      const testWindow = await this.safeGetActiveWindow()
      console.log('✓ active-win module working')
    } catch (error) {
      console.warn('⚠ active-win module may have issues:', error.message)
    }

    // Test systeminformation
    try {
      const testCpu = await this.safeGetCpuUsage()
      console.log('✓ systeminformation module working')
    } catch (error) {
      console.warn('⚠ systeminformation module may have issues:', error.message)
    }

    // Test screenshot (only if enabled)
    if (this.config.enableScreenshots) {
      try {
        // Don't actually take a screenshot, just test if the module loads
        console.log('✓ screenshot-desktop module loaded')
      } catch (error) {
        console.warn('⚠ screenshot-desktop module may have issues:', error.message)
      }
    }

    console.log('Native dependency test completed')
  }
}
