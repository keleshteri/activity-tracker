import { ActivityRecord, FocusSession } from '../types'

export interface FocusDetector {
  calculateFocusScore(activities: ActivityRecord[]): number
  detectContextSwitches(activities: ActivityRecord[]): ContextSwitch[]
  identifyFocusSessions(activities: ActivityRecord[]): FocusSession[]
  analyzeFocusPatterns(activities: ActivityRecord[]): FocusPattern
  getInterruptionAnalysis(activities: ActivityRecord[]): InterruptionAnalysis
}

export interface ContextSwitch {
  timestamp: number
  fromApp: string
  toApp: string
  duration: number
  switchType: 'quick' | 'normal' | 'extended'
  impact: 'low' | 'medium' | 'high'
}

export interface FocusPattern {
  averageFocusSessionDuration: number
  focusSessionsPerHour: number
  mostFocusedTimeOfDay: number
  leastFocusedTimeOfDay: number
  focusConsistency: number
  interruptionFrequency: number
  recoveryTime: number
}

export interface InterruptionAnalysis {
  totalInterruptions: number
  averageInterruptionDuration: number
  mostDisruptiveApps: string[]
  interruptionsByHour: Map<number, number>
  recoveryPatterns: RecoveryPattern[]
}

export interface RecoveryPattern {
  interruptionApp: string
  averageRecoveryTime: number
  successRate: number
  commonRecoveryApps: string[]
}

export class AdvancedFocusDetector implements FocusDetector {
  private readonly FOCUS_THRESHOLD = 300000 // 5 minutes minimum for focus session
  private readonly QUICK_SWITCH_THRESHOLD = 10000 // 10 seconds
  private readonly EXTENDED_SWITCH_THRESHOLD = 180000 // 3 minutes
  private readonly INTERRUPTION_THRESHOLD = 30000 // 30 seconds

  constructor() {}

  calculateFocusScore(activities: ActivityRecord[]): number {
    if (activities.length === 0) return 0

    let totalTime = 0
    let focusedTime = 0
    let contextSwitchPenalty = 0
    let consistencyBonus = 0

    // Calculate base focus time
    const focusSessions = this.identifyFocusSessions(activities)
    focusedTime = focusSessions.reduce((sum, session) => sum + session.duration, 0)
    totalTime = activities.reduce((sum, activity) => sum + activity.duration, 0)

    // Calculate context switch penalty
    const switches = this.detectContextSwitches(activities)
    const quickSwitches = switches.filter(s => s.switchType === 'quick').length
    contextSwitchPenalty = Math.min(0.5, quickSwitches * 0.02)

    // Calculate consistency bonus
    consistencyBonus = this.calculateConsistencyBonus(activities)

    // Calculate depth bonus (longer sessions get higher scores)
    const depthBonus = this.calculateDepthBonus(focusSessions)

    // Combine all factors
    let focusScore = totalTime > 0 ? focusedTime / totalTime : 0
    focusScore = focusScore - contextSwitchPenalty + consistencyBonus + depthBonus

    return Math.max(0, Math.min(1, focusScore))
  }

  detectContextSwitches(activities: ActivityRecord[]): ContextSwitch[] {
    const switches: ContextSwitch[] = []

    for (let i = 1; i < activities.length; i++) {
      const prevActivity = activities[i - 1]
      const currentActivity = activities[i]

      if (prevActivity.appName !== currentActivity.appName) {
        const switchDuration = currentActivity.timestamp - (prevActivity.timestamp + prevActivity.duration)
        const switchType = this.classifySwitchType(switchDuration)
        const impact = this.calculateSwitchImpact(prevActivity, currentActivity, switchDuration)

        switches.push({
          timestamp: currentActivity.timestamp,
          fromApp: prevActivity.appName,
          toApp: currentActivity.appName,
          duration: switchDuration,
          switchType,
          impact
        })
      }
    }

    return switches
  }

  identifyFocusSessions(activities: ActivityRecord[]): FocusSession[] {
    const sessions: FocusSession[] = []
    let currentSession: ActivityRecord[] = []
    let currentApp: string | null = null

    for (const activity of activities) {
      // Start new session if app changes or significant time gap
      if (currentApp !== activity.appName || this.hasSignificantGap(currentSession, activity)) {
        // Process previous session
        if (currentSession.length > 0) {
          const session = this.createFocusSession(currentSession)
          if (session && session.duration >= this.FOCUS_THRESHOLD) {
            sessions.push(session)
          }
        }

        // Start new session
        currentSession = [activity]
        currentApp = activity.appName
      } else {
        currentSession.push(activity)
      }
    }

    // Process final session
    if (currentSession.length > 0) {
      const session = this.createFocusSession(currentSession)
      if (session && session.duration >= this.FOCUS_THRESHOLD) {
        sessions.push(session)
      }
    }

    return sessions
  }

  analyzeFocusPatterns(activities: ActivityRecord[]): FocusPattern {
    const focusSessions = this.identifyFocusSessions(activities)
    const switches = this.detectContextSwitches(activities)

    // Calculate average focus session duration
    const averageFocusSessionDuration = focusSessions.length > 0 
      ? focusSessions.reduce((sum, session) => sum + session.duration, 0) / focusSessions.length
      : 0

    // Calculate focus sessions per hour
    const totalTime = activities.reduce((sum, activity) => sum + activity.duration, 0)
    const hours = totalTime / 3600000
    const focusSessionsPerHour = hours > 0 ? focusSessions.length / hours : 0

    // Find most and least focused times of day
    const hourlyFocus = this.calculateHourlyFocus(activities)
    const mostFocusedTimeOfDay = this.findPeakFocusHour(hourlyFocus)
    const leastFocusedTimeOfDay = this.findLowestFocusHour(hourlyFocus)

    // Calculate focus consistency
    const focusConsistency = this.calculateFocusConsistency(focusSessions)

    // Calculate interruption frequency
    const interruptionFrequency = hours > 0 ? switches.length / hours : 0

    // Calculate average recovery time
    const recoveryTime = this.calculateAverageRecoveryTime(switches, activities)

    return {
      averageFocusSessionDuration,
      focusSessionsPerHour,
      mostFocusedTimeOfDay,
      leastFocusedTimeOfDay,
      focusConsistency,
      interruptionFrequency,
      recoveryTime
    }
  }

  getInterruptionAnalysis(activities: ActivityRecord[]): InterruptionAnalysis {
    const switches = this.detectContextSwitches(activities)
    const interruptions = switches.filter(s => s.duration < this.INTERRUPTION_THRESHOLD)

    // Calculate total interruptions
    const totalInterruptions = interruptions.length

    // Calculate average interruption duration
    const averageInterruptionDuration = interruptions.length > 0
      ? interruptions.reduce((sum, interruption) => sum + interruption.duration, 0) / interruptions.length
      : 0

    // Find most disruptive apps
    const appInterruptions = new Map<string, number>()
    interruptions.forEach(interruption => {
      const count = appInterruptions.get(interruption.toApp) || 0
      appInterruptions.set(interruption.toApp, count + 1)
    })
    
    const mostDisruptiveApps = Array.from(appInterruptions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([app]) => app)

    // Calculate interruptions by hour
    const interruptionsByHour = new Map<number, number>()
    interruptions.forEach(interruption => {
      const hour = new Date(interruption.timestamp).getHours()
      const count = interruptionsByHour.get(hour) || 0
      interruptionsByHour.set(hour, count + 1)
    })

    // Analyze recovery patterns
    const recoveryPatterns = this.analyzeRecoveryPatterns(switches, activities)

    return {
      totalInterruptions,
      averageInterruptionDuration,
      mostDisruptiveApps,
      interruptionsByHour,
      recoveryPatterns
    }
  }

  private classifySwitchType(duration: number): 'quick' | 'normal' | 'extended' {
    if (duration < this.QUICK_SWITCH_THRESHOLD) return 'quick'
    if (duration < this.EXTENDED_SWITCH_THRESHOLD) return 'normal'
    return 'extended'
  }

  private calculateSwitchImpact(prevActivity: ActivityRecord, _currentActivity: ActivityRecord, switchDuration: number): 'low' | 'medium' | 'high' {
    // Quick switches have higher impact on focus
    if (switchDuration < this.QUICK_SWITCH_THRESHOLD) return 'high'
    
    // Switches from productive apps have higher impact
    if (prevActivity.duration > this.FOCUS_THRESHOLD) return 'medium'
    
    return 'low'
  }

  private hasSignificantGap(currentSession: ActivityRecord[], newActivity: ActivityRecord): boolean {
    if (currentSession.length === 0) return false
    
    const lastActivity = currentSession[currentSession.length - 1]
    const gap = newActivity.timestamp - (lastActivity.timestamp + lastActivity.duration)
    
    return gap > this.EXTENDED_SWITCH_THRESHOLD
  }

  private createFocusSession(activities: ActivityRecord[]): FocusSession | null {
    if (activities.length === 0) return null

    const startTime = activities[0].timestamp
    const endTime = activities[activities.length - 1].timestamp + activities[activities.length - 1].duration
    const duration = endTime - startTime
    const appName = activities[0].appName

    // Count interruptions within the session
    const interruptions = this.countInternalInterruptions(activities)

    // Calculate focus score for this session
    const focusScore = this.calculateSessionFocusScore(activities)

    // Sum up keystrokes and mouse clicks
    const keystrokes = activities.reduce((sum, activity) => sum + (activity.keystrokes || 0), 0)
    const mouseClicks = activities.reduce((sum, activity) => sum + (activity.mouseClicks || 0), 0)

    return {
      startTime,
      endTime,
      duration,
      appName,
      category: activities[0].category || 'unknown',
      interruptions,
      focusScore,
      keystrokes,
      mouseClicks
    }
  }

  private countInternalInterruptions(activities: ActivityRecord[]): number {
    let interruptions = 0
    
    for (let i = 1; i < activities.length; i++) {
      const gap = activities[i].timestamp - (activities[i-1].timestamp + activities[i-1].duration)
      if (gap > this.INTERRUPTION_THRESHOLD && gap < this.EXTENDED_SWITCH_THRESHOLD) {
        interruptions++
      }
    }
    
    return interruptions
  }

  private calculateSessionFocusScore(activities: ActivityRecord[]): number {
    if (activities.length === 0) return 0

    const totalDuration = activities.reduce((sum, activity) => sum + activity.duration, 0)
    const interruptions = this.countInternalInterruptions(activities)
    
    // Base score from duration
    let score = Math.min(1, totalDuration / (30 * 60 * 1000)) // 30 minutes = perfect score
    
    // Penalty for interruptions
    const interruptionPenalty = Math.min(0.5, interruptions * 0.1)
    score -= interruptionPenalty
    
    // Bonus for consistent activity (measured by keystroke/click patterns)
    const activityConsistency = this.calculateActivityConsistency(activities)
    score += activityConsistency * 0.2
    
    return Math.max(0, Math.min(1, score))
  }

  private calculateActivityConsistency(activities: ActivityRecord[]): number {
    if (activities.length < 2) return 0
    
    const keystrokes = activities.map(a => a.keystrokes || 0)
    const mouseClicks = activities.map(a => a.mouseClicks || 0)
    
    // Calculate coefficient of variation (lower = more consistent)
    const keystrokeCV = this.calculateCoefficientOfVariation(keystrokes)
    const mouseCV = this.calculateCoefficientOfVariation(mouseClicks)
    
    // Convert to consistency score (higher = more consistent)
    const keystrokeConsistency = Math.max(0, 1 - keystrokeCV)
    const mouseConsistency = Math.max(0, 1 - mouseCV)
    
    return (keystrokeConsistency + mouseConsistency) / 2
  }

  private calculateCoefficientOfVariation(values: number[]): number {
    if (values.length === 0) return 1
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    if (mean === 0) return 0
    
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    const standardDeviation = Math.sqrt(variance)
    
    return standardDeviation / mean
  }

  private calculateConsistencyBonus(activities: ActivityRecord[]): number {
    if (activities.length < 3) return 0
    
    // Calculate how consistent the activity durations are
    const durations = activities.map(a => a.duration)
    const cv = this.calculateCoefficientOfVariation(durations)
    
    // Lower coefficient of variation = higher consistency = higher bonus
    return Math.max(0, (1 - cv) * 0.1)
  }

  private calculateDepthBonus(focusSessions: FocusSession[]): number {
    if (focusSessions.length === 0) return 0
    
    // Bonus for having long focus sessions
    const longSessions = focusSessions.filter(session => session.duration > 1800000) // 30+ minutes
    const veryLongSessions = focusSessions.filter(session => session.duration > 3600000) // 60+ minutes
    
    let bonus = 0
    bonus += longSessions.length * 0.05
    bonus += veryLongSessions.length * 0.1
    
    return Math.min(0.2, bonus) // Cap at 20% bonus
  }

  private calculateHourlyFocus(activities: ActivityRecord[]): Map<number, number> {
    const hourlyFocus = new Map<number, number>()
    
    activities.forEach(activity => {
      const hour = new Date(activity.timestamp).getHours()
      const currentScore = hourlyFocus.get(hour) || 0
      
      // Simple focus score based on duration
      const activityFocusScore = Math.min(1, activity.duration / this.FOCUS_THRESHOLD)
      hourlyFocus.set(hour, currentScore + activityFocusScore)
    })
    
    return hourlyFocus
  }

  private findPeakFocusHour(hourlyFocus: Map<number, number>): number {
    let peakHour = 9 // Default
    let peakScore = 0
    
    hourlyFocus.forEach((score, hour) => {
      if (score > peakScore) {
        peakScore = score
        peakHour = hour
      }
    })
    
    return peakHour
  }

  private findLowestFocusHour(hourlyFocus: Map<number, number>): number {
    let lowestHour = 15 // Default
    let lowestScore = Infinity
    
    hourlyFocus.forEach((score, hour) => {
      if (score < lowestScore) {
        lowestScore = score
        lowestHour = hour
      }
    })
    
    return lowestHour
  }

  private calculateFocusConsistency(focusSessions: FocusSession[]): number {
    if (focusSessions.length < 2) return 0
    
    const durations = focusSessions.map(session => session.duration)
    const cv = this.calculateCoefficientOfVariation(durations)
    
    // Lower coefficient of variation = higher consistency
    return Math.max(0, 1 - cv)
  }

  private calculateAverageRecoveryTime(switches: ContextSwitch[], activities: ActivityRecord[]): number {
    let totalRecoveryTime = 0
    let recoveryCount = 0
    
    switches.forEach(contextSwitch => {
      // Find the activity that represents returning to focused work
      const switchIndex = activities.findIndex(activity => 
        activity.timestamp === contextSwitch.timestamp
      )
      
      if (switchIndex > 0 && switchIndex < activities.length - 1) {
        const nextActivity = activities[switchIndex + 1]
        
        // If the next activity is longer than focus threshold, consider it recovery
        if (nextActivity.duration > this.FOCUS_THRESHOLD) {
          totalRecoveryTime += contextSwitch.duration
          recoveryCount++
        }
      }
    })
    
    return recoveryCount > 0 ? totalRecoveryTime / recoveryCount : 0
  }

  private analyzeRecoveryPatterns(switches: ContextSwitch[], activities: ActivityRecord[]): RecoveryPattern[] {
    interface PatternData {
      recoveryTimes: number[]
      successes: number
      total: number
      recoveryApps: Map<string, number>
    }
    
    const patterns = new Map<string, PatternData>()
    
    switches.forEach(contextSwitch => {
      const pattern: PatternData = patterns.get(contextSwitch.toApp) || {
        recoveryTimes: [] as number[],
        successes: 0,
        total: 0,
        recoveryApps: new Map<string, number>()
      }
      
      pattern.total++
      
      // Find if user successfully returned to focused work
      const switchIndex = activities.findIndex(activity => 
        activity.timestamp === contextSwitch.timestamp
      )
      
      if (switchIndex < activities.length - 1) {
        const nextActivity = activities[switchIndex + 1]
        
        if (nextActivity.duration > this.FOCUS_THRESHOLD) {
          pattern.successes++
          // Calculate recovery time as the time between switch and return to focus
          const recoveryTime = nextActivity.timestamp - contextSwitch.timestamp
          pattern.recoveryTimes.push(recoveryTime)
          
          const recoveryCount = pattern.recoveryApps.get(nextActivity.appName) || 0
          pattern.recoveryApps.set(nextActivity.appName, recoveryCount + 1)
        }
      }
      
      patterns.set(contextSwitch.toApp, pattern)
    })
    
    return Array.from(patterns.entries()).map(([app, data]) => ({
      interruptionApp: app,
      averageRecoveryTime: data.recoveryTimes.length > 0 
        ? data.recoveryTimes.reduce((sum, time) => sum + time, 0) / data.recoveryTimes.length
        : 0,
      successRate: data.total > 0 ? data.successes / data.total : 0,
      commonRecoveryApps: Array.from(data.recoveryApps.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([appName]) => appName)
    }))
  }
}