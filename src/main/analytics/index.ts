import { ActivityRecord, WorkSession, ProductivityMetrics, AppCategory } from '../types'
import { DatabaseManager } from '../database'

export interface AnalyticsEngine {
  calculateProductivityScore(activity: ActivityRecord): Promise<number>
  calculateFocusScore(activities: ActivityRecord[]): number
  detectContextSwitches(activities: ActivityRecord[]): number
  analyzeProductivityPatterns(activities: ActivityRecord[]): Promise<ProductivityMetrics>
  createWorkSession(activities: ActivityRecord[]): Promise<WorkSession>
  detectSessionBoundaries(activities: ActivityRecord[]): number[]
}

export class ProductivityAnalytics implements AnalyticsEngine {
  private appCategories: Map<string, AppCategory> = new Map()
  private productivityWeights = {
    productive: 1.0,
    neutral: 0.5,
    distracting: 0.0
  }

  constructor(private db: DatabaseManager) {
    this.loadAppCategories()
  }

  private async loadAppCategories(): Promise<void> {
    try {
      const categories = await this.db.getAppCategories()
      categories.forEach(category => {
        this.appCategories.set(category.appName, category)
      })
    } catch (error) {
      console.warn('Failed to load app categories:', error)
    }
  }

  async calculateProductivityScore(activity: ActivityRecord): Promise<number> {
    // Get app category or default to neutral
    const category = this.appCategories.get(activity.appName)
    let baseScore = this.productivityWeights.neutral

    if (category) {
      baseScore = this.productivityWeights[category.productivityRating] || this.productivityWeights.neutral
    }

    // Adjust score based on activity patterns
    let adjustedScore = baseScore

    // Factor in duration - longer focused sessions get bonus
    if (activity.duration > 300000) { // 5+ minutes
      adjustedScore += 0.1
    }

    // Factor in CPU usage - moderate usage indicates active work
    if (activity.cpuUsage && activity.cpuUsage > 10 && activity.cpuUsage < 80) {
      adjustedScore += 0.1
    }

    // Factor in context switches - fewer switches indicate better focus
    if (activity.contextSwitches !== undefined && activity.contextSwitches < 5) {
      adjustedScore += 0.1
    }

    // Ensure score stays within bounds
    return Math.max(0, Math.min(1, adjustedScore))
  }

  calculateFocusScore(activities: ActivityRecord[]): number {
    if (activities.length === 0) return 0

    let totalFocusTime = 0
    let totalTime = 0
    let contextSwitches = 0

    for (let i = 0; i < activities.length; i++) {
      const activity = activities[i]
      totalTime += activity.duration

      // Consider focused time as activities longer than 2 minutes
      if (activity.duration > 120000) { // 2+ minutes
        totalFocusTime += activity.duration
      }

      // Count context switches
      if (i > 0 && activities[i-1].appName !== activity.appName) {
        contextSwitches++
      }
    }

    // Base focus score from time spent in focused activities
    let focusScore = totalTime > 0 ? totalFocusTime / totalTime : 0

    // Penalize excessive context switching
    const contextSwitchPenalty = Math.min(0.5, contextSwitches * 0.05)
    focusScore = Math.max(0, focusScore - contextSwitchPenalty)

    return focusScore
  }

  detectContextSwitches(activities: ActivityRecord[]): number {
    let switches = 0
    for (let i = 1; i < activities.length; i++) {
      if (activities[i].appName !== activities[i-1].appName) {
        switches++
      }
    }
    return switches
  }

  async analyzeProductivityPatterns(activities: ActivityRecord[]): Promise<ProductivityMetrics> {
    if (activities.length === 0) {
      return this.getEmptyMetrics()
    }

    const totalTime = activities.reduce((sum, activity) => sum + activity.duration, 0)
    let productiveTime = 0
    let neutralTime = 0
    let distractingTime = 0
    let totalContextSwitches = 0

    // Calculate productivity breakdown
    for (const activity of activities) {
      const score = await this.calculateProductivityScore(activity)
      
      if (score >= 0.7) {
        productiveTime += activity.duration
      } else if (score >= 0.3) {
        neutralTime += activity.duration
      } else {
        distractingTime += activity.duration
      }

      totalContextSwitches += activity.contextSwitches || 0
    }

    const focusScore = this.calculateFocusScore(activities)
    const peakHour = this.findPeakProductivityHour(activities)
    const avgSessionDuration = this.calculateAverageSessionDuration(activities)
    const breakFrequency = this.calculateBreakFrequency(activities)

    return {
      date: new Date().toISOString().split('T')[0],
      totalActiveTime: totalTime,
      productiveTime,
      neutralTime,
      distractingTime,
      focusScore,
      contextSwitches: totalContextSwitches,
      peakProductivityHour: peakHour,
      breakFrequency,
      averageSessionDuration: avgSessionDuration
    }
  }

  async createWorkSession(activities: ActivityRecord[]): Promise<WorkSession> {
    if (activities.length === 0) {
      throw new Error('Cannot create session from empty activities')
    }

    const startTime = Math.min(...activities.map(a => a.timestamp))
    const endTime = Math.max(...activities.map(a => a.timestamp + a.duration))
    const duration = endTime - startTime
    
    const focusScore = this.calculateFocusScore(activities)
    const contextSwitches = this.detectContextSwitches(activities)
    
    // Find dominant app
    const appTimes = new Map<string, number>()
    activities.forEach(activity => {
      const current = appTimes.get(activity.appName) || 0
      appTimes.set(activity.appName, current + activity.duration)
    })
    
    const dominantApp = Array.from(appTimes.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown'

    // Calculate productivity rating
    let totalProductivity = 0
    for (const activity of activities) {
      const score = await this.calculateProductivityScore(activity)
      totalProductivity += score
    }
    const avgProductivity = activities.length > 0 ? totalProductivity / activities.length : 0

    let productivityRating: 'productive' | 'neutral' | 'distracting' = 'neutral'
    if (avgProductivity >= 0.7) productivityRating = 'productive'
    else if (avgProductivity <= 0.3) productivityRating = 'distracting'

    return {
      startTime,
      endTime,
      duration,
      focusScore,
      productivityRating,
      contextSwitches,
      breakDuration: 0, // Will be calculated separately
      dominantApp,
      dominantCategory: this.appCategories.get(dominantApp)?.category || 'Unknown'
    }
  }

  detectSessionBoundaries(activities: ActivityRecord[]): number[] {
    const boundaries: number[] = []
    const BREAK_THRESHOLD = 300000 // 5 minutes

    for (let i = 1; i < activities.length; i++) {
      const timeBetween = activities[i].timestamp - (activities[i-1].timestamp + activities[i-1].duration)
      
      if (timeBetween > BREAK_THRESHOLD) {
        boundaries.push(i)
      }
    }

    return boundaries
  }

  private getEmptyMetrics(): ProductivityMetrics {
    return {
      date: new Date().toISOString().split('T')[0],
      totalActiveTime: 0,
      productiveTime: 0,
      neutralTime: 0,
      distractingTime: 0,
      focusScore: 0,
      contextSwitches: 0,
      peakProductivityHour: 9,
      breakFrequency: 0,
      averageSessionDuration: 0
    }
  }

  private findPeakProductivityHour(activities: ActivityRecord[]): number {
    const hourlyProductivity = new Map<number, { time: number, score: number }>()

    activities.forEach(async activity => {
      const hour = new Date(activity.timestamp).getHours()
      const score = await this.calculateProductivityScore(activity)
      
      const current = hourlyProductivity.get(hour) || { time: 0, score: 0 }
      hourlyProductivity.set(hour, {
        time: current.time + activity.duration,
        score: current.score + (score * activity.duration)
      })
    })

    let peakHour = 9 // Default to 9 AM
    let peakScore = 0

    hourlyProductivity.forEach((data, hour) => {
      const avgScore = data.time > 0 ? data.score / data.time : 0
      if (avgScore > peakScore) {
        peakScore = avgScore
        peakHour = hour
      }
    })

    return peakHour
  }

  private calculateAverageSessionDuration(activities: ActivityRecord[]): number {
    const boundaries = this.detectSessionBoundaries(activities)
    if (boundaries.length === 0) {
      return activities.reduce((sum, activity) => sum + activity.duration, 0)
    }

    const sessions: number[] = []
    let sessionStart = 0

    boundaries.forEach(boundary => {
      const sessionActivities = activities.slice(sessionStart, boundary)
      if (sessionActivities.length > 0) {
        const duration = sessionActivities.reduce((sum, activity) => sum + activity.duration, 0)
        sessions.push(duration)
      }
      sessionStart = boundary
    })

    // Add final session
    const finalSession = activities.slice(sessionStart)
    if (finalSession.length > 0) {
      const duration = finalSession.reduce((sum, activity) => sum + activity.duration, 0)
      sessions.push(duration)
    }

    return sessions.length > 0 ? sessions.reduce((sum, duration) => sum + duration, 0) / sessions.length : 0
  }

  private calculateBreakFrequency(activities: ActivityRecord[]): number {
    const boundaries = this.detectSessionBoundaries(activities)
    const totalTime = activities.reduce((sum, activity) => sum + activity.duration, 0)
    const hoursTracked = totalTime / 3600000 // Convert to hours
    
    return hoursTracked > 0 ? boundaries.length / hoursTracked : 0
  }
}

// Export new modules
export * from '../insights'
export * from '../patterns'