import { ActivityRecord, WorkSession, ProductivityBlock, FocusSession, BreakPattern } from '../types'
import { DatabaseManager } from '../database'
import { ProductivityAnalytics } from '../analytics'

export interface SessionManager {
  startSession(): Promise<void>
  endSession(): Promise<WorkSession | null>
  detectBreaks(activities: ActivityRecord[]): BreakPattern[]
  createProductivityBlocks(activities: ActivityRecord[]): ProductivityBlock[]
  getCurrentSession(): WorkSession | null
  isInSession(): boolean
  getCurrentSessionDuration(): number
}

export class WorkSessionManager implements SessionManager {
  private currentSession: WorkSession | null = null
  private sessionActivities: ActivityRecord[] = []
  private lastActivityTime: number = 0
  private readonly IDLE_THRESHOLD = 300000 // 5 minutes
  private readonly MIN_SESSION_DURATION = 600000 // 10 minutes
  private readonly BREAK_THRESHOLD = 180000 // 3 minutes

  constructor(
    private db: DatabaseManager,
    private analytics: ProductivityAnalytics
  ) {}

  async startSession(): Promise<void> {
    if (this.currentSession) {
      await this.endSession()
    }

    const now = Date.now()
    this.currentSession = {
      startTime: now,
      endTime: now,
      duration: 0,
      focusScore: 0,
      productivityRating: 'neutral',
      contextSwitches: 0,
      breakDuration: 0,
      dominantApp: '',
      dominantCategory: ''
    }
    
    this.sessionActivities = []
    this.lastActivityTime = now
  }

  async endSession(): Promise<WorkSession | null> {
    if (!this.currentSession || this.sessionActivities.length === 0) {
      this.currentSession = null
      this.sessionActivities = []
      return null
    }

    // Only save sessions that meet minimum duration
    const sessionDuration = Date.now() - this.currentSession.startTime
    if (sessionDuration < this.MIN_SESSION_DURATION) {
      this.currentSession = null
      this.sessionActivities = []
      return null
    }

    // Update session with final data
    const session = await this.analytics.createWorkSession(this.sessionActivities)
    session.endTime = Date.now()
    session.duration = session.endTime - session.startTime

    // Calculate break duration
    const breaks = this.detectBreaks(this.sessionActivities)
    session.breakDuration = breaks.reduce((total, breakPattern) => total + breakPattern.duration, 0)

    try {
      await this.db.saveWorkSession(session)
      
      // Create productivity blocks for this session
      const blocks = this.createProductivityBlocks(this.sessionActivities)
      for (const block of blocks) {
        await this.db.saveProductivityBlock(block)
      }

      // Create focus sessions
      const focusSessions = this.createFocusSessions(this.sessionActivities)
      for (const focusSession of focusSessions) {
        await this.db.saveFocusSession(focusSession)
      }

    } catch (error) {
      console.error('Failed to save session data:', error)
    }

    const completedSession = { ...session }
    this.currentSession = null
    this.sessionActivities = []
    
    return completedSession
  }

  addActivity(activity: ActivityRecord): void {
    if (!this.currentSession) {
      this.startSession()
    }

    // Check for session break
    const timeSinceLastActivity = activity.timestamp - this.lastActivityTime
    if (timeSinceLastActivity > this.IDLE_THRESHOLD && this.sessionActivities.length > 0) {
      // End current session and start new one
      this.endSession().then(() => {
        this.startSession().then(() => {
          this.sessionActivities.push(activity)
          this.lastActivityTime = activity.timestamp + activity.duration
        })
      })
      return
    }

    this.sessionActivities.push(activity)
    this.lastActivityTime = activity.timestamp + activity.duration

    // Update current session
    if (this.currentSession) {
      this.currentSession.endTime = activity.timestamp + activity.duration
      this.currentSession.duration = this.currentSession.endTime - this.currentSession.startTime
    }
  }

  detectBreaks(activities: ActivityRecord[]): BreakPattern[] {
    const breaks: BreakPattern[] = []
    
    for (let i = 1; i < activities.length; i++) {
      const prevActivity = activities[i - 1]
      const currentActivity = activities[i]
      
      const gapStart = prevActivity.timestamp + prevActivity.duration
      const gapEnd = currentActivity.timestamp
      const gapDuration = gapEnd - gapStart
      
      if (gapDuration > this.BREAK_THRESHOLD) {
        const breakType = this.classifyBreak(gapDuration)
        
        breaks.push({
          timestamp: gapStart,
          duration: gapDuration,
          type: breakType,
          beforeActivity: prevActivity.appName,
          afterActivity: currentActivity.appName
        })
      }
    }
    
    return breaks
  }

  createProductivityBlocks(activities: ActivityRecord[]): ProductivityBlock[] {
    const blocks: ProductivityBlock[] = []
    const BLOCK_DURATION = 1800000 // 30 minutes
    
    if (activities.length === 0) return blocks
    
    const startTime = activities[0].timestamp
    const endTime = activities[activities.length - 1].timestamp + activities[activities.length - 1].duration
    
    for (let blockStart = startTime; blockStart < endTime; blockStart += BLOCK_DURATION) {
      const blockEnd = Math.min(blockStart + BLOCK_DURATION, endTime)
      
      const blockActivities = activities.filter(activity => 
        activity.timestamp >= blockStart && activity.timestamp < blockEnd
      )
      
      if (blockActivities.length === 0) continue
      
      const focusScore = this.analytics.calculateFocusScore(blockActivities)
      const contextSwitches = this.analytics.detectContextSwitches(blockActivities)
      
      // Find dominant activity
      const appTimes = new Map<string, number>()
      blockActivities.forEach(activity => {
        const current = appTimes.get(activity.appName) || 0
        appTimes.set(activity.appName, current + activity.duration)
      })
      
      const dominantActivity = Array.from(appTimes.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown'
      
      // Calculate energy level based on activity patterns
      const energyLevel = this.calculateEnergyLevel(blockActivities)
      
      blocks.push({
        id: `block_${blockStart}_${blockEnd}`,
        startTime: blockStart,
        endTime: blockEnd,
        duration: blockEnd - blockStart,
        type: focusScore >= 0.7 ? 'deep_focus' : focusScore >= 0.3 ? 'shallow_work' : 'distraction',
        focusScore,
        dominantActivity,
        interruptions: contextSwitches,
        contextSwitches: contextSwitches,
        productivityRating: focusScore >= 0.7 ? 'productive' : focusScore >= 0.3 ? 'neutral' : 'distracting',
        energyLevel,
        qualityScore: Math.round(focusScore * 100)
      })
    }
    
    return blocks
  }

  getCurrentSession(): WorkSession | null {
    return this.currentSession
  }

  isInSession(): boolean {
    return this.currentSession !== null
  }

  getCurrentSessionDuration(): number {
    if (!this.currentSession) {
      return 0
    }
    return Date.now() - this.currentSession.startTime
  }

  private classifyBreak(duration: number): 'micro' | 'short' | 'long' {
    if (duration < 300000) return 'micro' // < 5 minutes
    if (duration < 1800000) return 'short' // < 30 minutes
    return 'long' // >= 30 minutes
  }

  private calculateEnergyLevel(activities: ActivityRecord[]): 'low' | 'medium' | 'high' {
    if (activities.length === 0) return 'low'
    
    // Calculate based on activity intensity
    const avgCpuUsage = activities.reduce((sum, activity) => 
      sum + (activity.cpuUsage || 0), 0) / activities.length
    
    const avgKeystrokes = activities.reduce((sum, activity) => 
      sum + (activity.keystrokes || 0), 0) / activities.length
    
    const avgMouseClicks = activities.reduce((sum, activity) => 
      sum + (activity.mouseClicks || 0), 0) / activities.length
    
    // Combine metrics to determine energy level
    const intensityScore = (avgCpuUsage / 100) + 
                          Math.min(avgKeystrokes / 100, 1) + 
                          Math.min(avgMouseClicks / 50, 1)
    
    if (intensityScore >= 2) return 'high'
    if (intensityScore >= 1) return 'medium'
    return 'low'
  }

  private createFocusSessions(activities: ActivityRecord[]): FocusSession[] {
    const focusSessions: FocusSession[] = []
    const MIN_FOCUS_DURATION = 600000 // 10 minutes
    
    let currentFocusStart: number | null = null
    let currentApp: string | null = null
    let focusActivities: ActivityRecord[] = []
    
    for (const activity of activities) {
      // Start new focus session if app changes or this is the first activity
      if (currentApp !== activity.appName) {
        // Save previous focus session if it was long enough
        if (currentFocusStart && focusActivities.length > 0) {
          const duration = focusActivities[focusActivities.length - 1].timestamp + 
                          focusActivities[focusActivities.length - 1].duration - currentFocusStart
          
          if (duration >= MIN_FOCUS_DURATION) {
            focusSessions.push(this.createFocusSessionFromActivities(currentFocusStart, focusActivities))
          }
        }
        
        // Start new focus session
        currentFocusStart = activity.timestamp
        currentApp = activity.appName
        focusActivities = [activity]
      } else {
        focusActivities.push(activity)
      }
    }
    
    // Handle final focus session
    if (currentFocusStart && focusActivities.length > 0) {
      const duration = focusActivities[focusActivities.length - 1].timestamp + 
                      focusActivities[focusActivities.length - 1].duration - currentFocusStart
      
      if (duration >= MIN_FOCUS_DURATION) {
        focusSessions.push(this.createFocusSessionFromActivities(currentFocusStart, focusActivities))
      }
    }
    
    return focusSessions
  }

  private createFocusSessionFromActivities(startTime: number, activities: ActivityRecord[]): FocusSession {
    const endTime = activities[activities.length - 1].timestamp + activities[activities.length - 1].duration
    const duration = endTime - startTime
    
    const interruptions = this.analytics.detectContextSwitches(activities)
    const focusScore = this.analytics.calculateFocusScore(activities)
    
    const totalKeystrokes = activities.reduce((sum, activity) => sum + (activity.keystrokes || 0), 0)
    const totalMouseClicks = activities.reduce((sum, activity) => sum + (activity.mouseClicks || 0), 0)
    
    return {
      startTime,
      endTime,
      duration,
      appName: activities[0].appName,
      category: activities[0].category || 'unknown',
      interruptions,
      focusScore,
      keystrokes: totalKeystrokes,
      mouseClicks: totalMouseClicks
    }
  }
}