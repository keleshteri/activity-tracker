import { EventEmitter } from 'events'
import { DatabaseManager } from './database'
import { DistractionSettings, DistractionEvent, AppCategory, ActivityRecord } from './types'
import { BrowserWindow } from 'electron'

export class DistractionDetector extends EventEmitter {
  private db: DatabaseManager
  private settings: DistractionSettings | null = null
  private currentAppStartTime: number = 0
  private currentApp: string = ''
  private distractionTimer: NodeJS.Timeout | null = null
  private notificationCooldown: Map<string, number> = new Map()
  private appCategories: Map<string, AppCategory> = new Map()
  private isEnabled: boolean = true

  constructor(database: DatabaseManager) {
    super()
    this.db = database
    this.loadSettings()
    this.loadAppCategories()
  }

  async initialize(): Promise<void> {
    await this.loadSettings()
    await this.loadAppCategories()
  }

  private async loadSettings(): Promise<void> {
    try {
      this.settings = await this.db.getDistractionSettings()
      if (!this.settings) {
        // Create default settings
        this.settings = {
          enabled: true,
          thresholdMinutes: 5,
          notificationType: 'gentle',
          notificationFrequency: 15,
          quietHoursEnabled: false,
          quietHoursStart: '22:00',
          quietHoursEnd: '08:00',
          excludedApps: [],
          breakReminderEnabled: true,
          breakReminderInterval: 30,
          focusModeEnabled: false
        }
        await this.db.saveDistractionSettings(this.settings)
      }
      this.isEnabled = this.settings.enabled
    } catch (error) {
      console.error('Failed to load distraction settings:', error)
    }
  }

  private async loadAppCategories(): Promise<void> {
    try {
      const categories = await this.db.getAppCategories()
      this.appCategories.clear()
      categories.forEach(category => {
        this.appCategories.set(category.appName, category)
      })
    } catch (error) {
      console.error('Failed to load app categories:', error)
    }
  }

  async updateSettings(newSettings: Partial<DistractionSettings>): Promise<void> {
    if (!this.settings) {
      await this.loadSettings()
    }
    
    this.settings = { ...this.settings!, ...newSettings }
    await this.db.saveDistractionSettings(this.settings)
    this.isEnabled = this.settings.enabled
    
    this.emit('settings-updated', this.settings)
  }

  async onActivityChange(activity: ActivityRecord): Promise<void> {
    if (!this.isEnabled || !this.settings) {
      return
    }

    // Check if we're in quiet hours
    if (this.isInQuietHours()) {
      return
    }

    // Check if app is excluded
    if (this.settings.excludedApps.includes(activity.appName)) {
      return
    }

    // If switching to a new app, check the previous app's usage
    if (this.currentApp && this.currentApp !== activity.appName) {
      await this.checkForDistraction(this.currentApp, Date.now() - this.currentAppStartTime)
    }

    // Update current app tracking
    this.currentApp = activity.appName
    this.currentAppStartTime = Date.now()

    // Start monitoring this app for distraction
    this.startDistractionTimer(activity.appName)
  }

  private startDistractionTimer(appName: string): void {
    if (this.distractionTimer) {
      clearTimeout(this.distractionTimer)
    }

    const category = this.appCategories.get(appName)
    if (!category || category.productivityRating !== 'distracting') {
      return
    }

    const thresholdMs = this.settings!.thresholdMinutes * 60 * 1000
    
    this.distractionTimer = setTimeout(() => {
      this.handleDistractionDetected(appName, thresholdMs)
    }, thresholdMs)
  }

  private async handleDistractionDetected(appName: string, duration: number): Promise<void> {
    const now = Date.now()
    
    // Check notification cooldown
    const lastNotification = this.notificationCooldown.get(appName) || 0
    const cooldownMs = this.settings!.notificationFrequency * 60 * 1000
    
    if (now - lastNotification < cooldownMs) {
      return
    }

    // Determine severity based on duration
    let severity: 'low' | 'medium' | 'high' = 'medium'
    if (duration > 15 * 60 * 1000) { // 15 minutes
      severity = 'high'
    } else if (duration < 2 * 60 * 1000) { // 2 minutes
      severity = 'low'
    }

    // Create distraction event
    const distractionEvent: DistractionEvent = {
      timestamp: now,
      appName,
      duration,
      severity,
      notificationSent: false,
      userAcknowledged: false,
      context: `Spent ${Math.round(duration / 60000)} minutes on potentially distracting app`
    }

    // Save to database
    await this.db.saveDistractionEvent(distractionEvent)

    // Send notification if enabled
    if (this.settings!.notificationType !== 'none') {
      await this.sendDistractionNotification(distractionEvent)
      distractionEvent.notificationSent = true
      this.notificationCooldown.set(appName, now)
    }

    this.emit('distraction-detected', distractionEvent)
  }

  private async checkForDistraction(appName: string, duration: number): Promise<void> {
    const category = this.appCategories.get(appName)
    if (!category || category.productivityRating !== 'distracting') {
      return
    }

    const thresholdMs = this.settings!.thresholdMinutes * 60 * 1000
    if (duration >= thresholdMs) {
      await this.handleDistractionDetected(appName, duration)
    }
  }

  private async sendDistractionNotification(event: DistractionEvent): Promise<void> {
    const windows = BrowserWindow.getAllWindows()
    if (windows.length === 0) {
      return
    }

    const mainWindow = windows[0]
    
    let title = 'Distraction Detected'
    let message = `You've been using ${event.appName} for ${Math.round(event.duration / 60000)} minutes`
    
    switch (this.settings!.notificationType) {
      case 'gentle':
        title = 'Gentle Reminder'
        message = `Consider taking a break from ${event.appName}? You've been focused on it for a while.`
        break
      case 'standard':
        title = 'Focus Check'
        message = `You've spent ${Math.round(event.duration / 60000)} minutes on ${event.appName}. Time to refocus?`
        break
      case 'persistent':
        title = 'Distraction Alert'
        message = `${Math.round(event.duration / 60000)} minutes on ${event.appName}. Consider switching to a productive task.`
        break
    }

    // Send to renderer process for display
    mainWindow.webContents.send('distraction-notification', {
      title,
      message,
      severity: event.severity,
      appName: event.appName,
      duration: event.duration,
      timestamp: event.timestamp
    })
  }

  private isInQuietHours(): boolean {
    if (!this.settings?.quietHoursEnabled) {
      return false
    }

    const now = new Date()
    const currentTime = now.getHours() * 60 + now.getMinutes()
    
    const [startHour, startMin] = this.settings.quietHoursStart.split(':').map(Number)
    const [endHour, endMin] = this.settings.quietHoursEnd.split(':').map(Number)
    
    const startTime = startHour * 60 + startMin
    const endTime = endHour * 60 + endMin

    if (startTime <= endTime) {
      // Same day range (e.g., 9:00 to 17:00)
      return currentTime >= startTime && currentTime <= endTime
    } else {
      // Overnight range (e.g., 22:00 to 08:00)
      return currentTime >= startTime || currentTime <= endTime
    }
  }

  async getDistractionEvents(filters?: {
    startTime?: number
    endTime?: number
    appName?: string
    severity?: 'low' | 'medium' | 'high'
    limit?: number
  }): Promise<DistractionEvent[]> {
    return this.db.getDistractionEvents(filters)
  }

  async getDistractionStats(timeframe: 'day' | 'week' | 'month' = 'day'): Promise<{
    totalEvents: number
    totalDistractionTime: number
    topDistractingApps: Array<{ appName: string; count: number; totalTime: number }>
    averageDistractionDuration: number
    severityBreakdown: { low: number; medium: number; high: number }
  }> {
    const now = Date.now()
    let startTime: number

    switch (timeframe) {
      case 'day':
        startTime = now - (24 * 60 * 60 * 1000)
        break
      case 'week':
        startTime = now - (7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startTime = now - (30 * 24 * 60 * 60 * 1000)
        break
    }

    const events = await this.getDistractionEvents({ startTime })
    
    const totalEvents = events.length
    const totalDistractionTime = events.reduce((sum, event) => sum + event.duration, 0)
    const averageDistractionDuration = totalEvents > 0 ? totalDistractionTime / totalEvents : 0

    // Group by app
    const appStats = new Map<string, { count: number; totalTime: number }>()
    events.forEach(event => {
      const existing = appStats.get(event.appName) || { count: 0, totalTime: 0 }
      existing.count++
      existing.totalTime += event.duration
      appStats.set(event.appName, existing)
    })

    const topDistractingApps = Array.from(appStats.entries())
      .map(([appName, stats]) => ({ appName, ...stats }))
      .sort((a, b) => b.totalTime - a.totalTime)
      .slice(0, 5)

    // Severity breakdown
    const severityBreakdown = events.reduce(
      (acc, event) => {
        acc[event.severity]++
        return acc
      },
      { low: 0, medium: 0, high: 0 }
    )

    return {
      totalEvents,
      totalDistractionTime,
      topDistractingApps,
      averageDistractionDuration,
      severityBreakdown
    }
  }

  async acknowledgeDistraction(timestamp: number): Promise<void> {
    // Update the distraction event to mark as acknowledged
    // This would require adding an update method to the database
    this.emit('distraction-acknowledged', { timestamp })
  }

  async refreshAppCategories(): Promise<void> {
    await this.loadAppCategories()
    this.emit('categories-refreshed')
  }

  getSettings(): DistractionSettings | null {
    return this.settings ? { ...this.settings } : null
  }

  isDistractionDetectionEnabled(): boolean {
    return this.isEnabled && this.settings?.enabled === true
  }

  destroy(): void {
    if (this.distractionTimer) {
      clearTimeout(this.distractionTimer)
    }
    this.removeAllListeners()
  }
}