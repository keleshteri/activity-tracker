import { ActivityRecord, WorkPattern, FocusSession, BreakPattern } from '../types'
import { AdvancedFocusDetector } from '../focus'

export interface PatternAnalyzer {
  identifyRecurringWorkPatterns(activities: ActivityRecord[]): Promise<WorkPattern[]>
  detectFocusBlocks(activities: ActivityRecord[]): Promise<FocusSession[]>
  analyzeBreakPatterns(activities: ActivityRecord[]): Promise<BreakPattern[]>
  findWorkHabits(activities: ActivityRecord[]): Promise<WorkHabit[]>
  detectProductivityCycles(activities: ActivityRecord[]): Promise<ProductivityCycle[]>
  analyzeContextSwitchingPatterns(activities: ActivityRecord[]): Promise<ContextSwitchPattern[]>
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

export class ComprehensivePatternAnalyzer implements PatternAnalyzer {
  private readonly MIN_PATTERN_OCCURRENCES = 3
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.6
  private readonly FOCUS_BLOCK_MIN_DURATION = 900000 // 15 minutes
  private readonly PRODUCTIVITY_CYCLE_MIN_DAYS = 5

  constructor(
    private focusDetector: AdvancedFocusDetector
  ) {}

  async identifyRecurringWorkPatterns(activities: ActivityRecord[]): Promise<WorkPattern[]> {
    const patterns: WorkPattern[] = []
    
    // Group activities by day of week and hour
    const timePatterns = this.groupActivitiesByTime(activities)
    
    // Analyze daily patterns
    const dailyPatterns = await this.analyzeDailyPatterns(timePatterns)
    patterns.push(...dailyPatterns)
    
    // Analyze weekly patterns
    const weeklyPatterns = await this.analyzeWeeklyPatterns(timePatterns)
    patterns.push(...weeklyPatterns)
    
    // Analyze app usage patterns
    const appPatterns = await this.analyzeAppUsagePatterns(activities)
    patterns.push(...appPatterns)
    
    // Analyze productivity patterns
    const productivityPatterns = await this.analyzeProductivityPatterns(activities)
    patterns.push(...productivityPatterns)
    
    return patterns.filter(pattern => pattern.confidence >= this.MIN_CONFIDENCE_THRESHOLD)
  }

  async detectFocusBlocks(activities: ActivityRecord[]): Promise<FocusSession[]> {
    const focusSessions: FocusSession[] = []
    
    // Use the existing focus detector but enhance with pattern analysis
    const baseFocusSessions = this.focusDetector.identifyFocusSessions(activities)
    
    for (const session of baseFocusSessions) {
      if (session.duration >= this.FOCUS_BLOCK_MIN_DURATION) {
        // Enhance with additional pattern analysis
        const enhancedSession = await this.enhanceFocusSession(session, activities)
        focusSessions.push(enhancedSession)
      }
    }
    
    // Detect sustained focus blocks (multiple consecutive sessions)
    const sustainedBlocks = this.detectSustainedFocusBlocks(focusSessions)
    focusSessions.push(...sustainedBlocks)
    
    return focusSessions
  }

  async analyzeBreakPatterns(activities: ActivityRecord[]): Promise<BreakPattern[]> {
    const breakPatterns: BreakPattern[] = []
    const breaks = this.identifyBreaks(activities)
    
    // Analyze break timing patterns
    const timingPatterns = this.analyzeBreakTiming(breaks)
    breakPatterns.push(...timingPatterns)
    
    // Analyze break duration patterns
    const durationPatterns = this.analyzeBreakDurations(breaks)
    breakPatterns.push(...durationPatterns)
    
    // Analyze break frequency patterns
    const frequencyPatterns = this.analyzeBreakFrequency(breaks)
    breakPatterns.push(...frequencyPatterns)
    
    return breakPatterns
  }

  async findWorkHabits(activities: ActivityRecord[]): Promise<WorkHabit[]> {
    const habits: WorkHabit[] = []
    
    // Analyze app usage habits
    habits.push(...await this.analyzeAppUsageHabits(activities))
    
    // Analyze time preference habits
    habits.push(...await this.analyzeTimePreferenceHabits(activities))
    
    // Analyze break timing habits
    habits.push(...await this.analyzeBreakTimingHabits(activities))
    
    // Analyze focus duration habits
    habits.push(...await this.analyzeFocusDurationHabits(activities))
    
    // Analyze multitasking habits
    habits.push(...await this.analyzeMultitaskingHabits(activities))
    
    return habits.filter(habit => habit.confidence >= this.MIN_CONFIDENCE_THRESHOLD)
  }

  async detectProductivityCycles(activities: ActivityRecord[]): Promise<ProductivityCycle[]> {
    const cycles: ProductivityCycle[] = []
    
    // Group activities by hour of day
    const hourlyData = this.groupActivitiesByHour(activities)
    
    // Analyze productivity by hour
    const hourlyProductivity = this.calculateHourlyProductivity(hourlyData)
    
    // Identify productivity peaks and valleys
    const peaks = this.identifyProductivityPeaks(hourlyProductivity)
    const valleys = this.identifyProductivityValleys(hourlyProductivity)
    
    // Create productivity cycles
    cycles.push(...this.createProductivityCycles(peaks, 'peak'))
    cycles.push(...this.createProductivityCycles(valleys, 'low'))
    
    // Fill in moderate periods
    const moderatePeriods = this.identifyModeratePeriods(hourlyProductivity, peaks, valleys)
    cycles.push(...this.createProductivityCycles(moderatePeriods, 'moderate'))
    
    return cycles.filter(cycle => cycle.confidence >= this.MIN_CONFIDENCE_THRESHOLD)
  }

  async analyzeContextSwitchingPatterns(activities: ActivityRecord[]): Promise<ContextSwitchPattern[]> {
    const patterns: ContextSwitchPattern[] = []
    const switches = this.identifyContextSwitches(activities)
    
    // Group switches by app pairs
    const switchPairs = this.groupSwitchesByAppPair(switches)
    
    for (const [appPair, switchData] of switchPairs) {
      if (switchData.length >= this.MIN_PATTERN_OCCURRENCES) {
        const [fromApp, toApp] = appPair.split(' -> ')
        
        const pattern: ContextSwitchPattern = {
          id: `switch_${fromApp}_${toApp}_${Date.now()}`,
          fromApp,
          toApp,
          frequency: switchData.length,
          averageDuration: switchData.reduce((sum, s) => sum + s.duration, 0) / switchData.length,
          timeOfDay: this.extractTimeOfDay(switchData),
          impact: this.assessSwitchImpact(switchData),
          pattern: this.classifySwitchPattern(switchData)
        }
        
        patterns.push(pattern)
      }
    }
    
    return patterns
  }

  // Private helper methods
  private groupActivitiesByTime(activities: ActivityRecord[]): Map<string, ActivityRecord[]> {
    const grouped = new Map<string, ActivityRecord[]>()
    
    activities.forEach(activity => {
      const date = new Date(activity.timestamp)
      const dayOfWeek = date.getDay()
      const hour = date.getHours()
      const key = `${dayOfWeek}_${hour}`
      
      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key)!.push(activity)
    })
    
    return grouped
  }

  private async analyzeDailyPatterns(timePatterns: Map<string, ActivityRecord[]>): Promise<WorkPattern[]> {
    const patterns: WorkPattern[] = []
    const dailyData = new Map<number, ActivityRecord[]>()
    
    // Group by day of week
    timePatterns.forEach((activities, key) => {
      const dayOfWeek = parseInt(key.split('_')[0])
      if (!dailyData.has(dayOfWeek)) {
        dailyData.set(dayOfWeek, [])
      }
      dailyData.get(dayOfWeek)!.push(...activities)
    })
    
    // Analyze each day
    dailyData.forEach((activities, dayOfWeek) => {
      if (activities.length >= this.MIN_PATTERN_OCCURRENCES) {
        const avgProductivity = activities.reduce((sum, a) => sum + (a.focusScore || 0), 0) / activities.length
        // const totalTime = activities.reduce((sum, a) => sum + a.duration, 0)
        
        patterns.push({
          id: `daily_pattern_${dayOfWeek}_${Date.now()}`,
          type: 'daily',
          name: `Daily Pattern - ${this.getDayName(dayOfWeek)}`,
          description: `Consistent activity on ${this.getDayName(dayOfWeek)} with ${activities.length} activities`,
          frequency: activities.length,
          confidence: Math.min(0.9, activities.length / 10),
          associatedApps: [...new Set(activities.map(a => a.appName))],
          productivityImpact: avgProductivity > 0.7 ? 'positive' : avgProductivity < 0.3 ? 'negative' : 'neutral',
          detectedAt: Date.now(),
          lastSeen: Date.now()
        })
      }
    })
    
    return patterns
  }

  private async analyzeWeeklyPatterns(timePatterns: Map<string, ActivityRecord[]>): Promise<WorkPattern[]> {
    const patterns: WorkPattern[] = []
    
    // Analyze weekly productivity trends
    const weeklyProductivity = this.calculateWeeklyProductivity(timePatterns)
    
    if (weeklyProductivity.length >= 2) {
      const trend = this.calculateTrend(weeklyProductivity)
      
      patterns.push({
         id: `weekly_trend_${Date.now()}`,
         type: 'weekly',
         name: 'Weekly Productivity Trend',
         description: `Weekly productivity trend: ${trend > 0.1 ? 'improving' : trend < -0.1 ? 'declining' : 'stable'}`,
         frequency: weeklyProductivity.length,
         confidence: Math.min(0.9, weeklyProductivity.length / 4),
         associatedApps: [],
         productivityImpact: trend > 0.1 ? 'positive' : trend < -0.1 ? 'negative' : 'neutral',
         detectedAt: Date.now(),
         lastSeen: Date.now()
       })
    }
    
    return patterns
  }

  private async analyzeAppUsagePatterns(activities: ActivityRecord[]): Promise<WorkPattern[]> {
    const patterns: WorkPattern[] = []
    const appUsage = new Map<string, { time: number, count: number, productivity: number }>()
    
    activities.forEach(activity => {
      const current = appUsage.get(activity.appName) || { time: 0, count: 0, productivity: 0 }
      current.time += activity.duration
      current.count += 1
      current.productivity += activity.focusScore || 0
      appUsage.set(activity.appName, current)
    })
    
    // Find dominant apps
    const sortedApps = Array.from(appUsage.entries())
      .map(([app, data]) => ({ app, ...data, avgProductivity: data.productivity / data.count }))
      .sort((a, b) => b.time - a.time)
      .slice(0, 5)
    
    sortedApps.forEach(appData => {
      if (appData.count >= this.MIN_PATTERN_OCCURRENCES) {
        patterns.push({
          id: `app_usage_${appData.app}_${Date.now()}`,
          type: 'daily',
          name: `Heavy App Usage - ${appData.app}`,
          description: `Heavy usage of ${appData.app}`,
          frequency: appData.count,
          confidence: Math.min(0.9, appData.count / 20),
          associatedApps: [appData.app],
          productivityImpact: appData.avgProductivity > 0.7 ? 'positive' : appData.avgProductivity < 0.3 ? 'negative' : 'neutral',
          detectedAt: Date.now(),
          lastSeen: Date.now()
        })
      }
    })
    
    return patterns
  }

  private async analyzeProductivityPatterns(activities: ActivityRecord[]): Promise<WorkPattern[]> {
    const patterns: WorkPattern[] = []
    
    // Analyze productivity by time of day
    const hourlyProductivity = this.calculateHourlyProductivity(
      this.groupActivitiesByHour(activities)
    )
    
    // Find peak productivity hours
    const peakHours = Object.entries(hourlyProductivity)
      .filter(([_, productivity]) => productivity > 0.7)
      .map(([hour]) => parseInt(hour))
    
    if (peakHours.length > 0) {
      patterns.push({
        id: `productivity_peak_${Date.now()}`,
        type: 'daily',
        name: 'Peak Productivity Hours',
        description: `Peak productivity during hours: ${peakHours.join(', ')}`,
        frequency: peakHours.length,
        confidence: 0.8,
        associatedApps: [],
        productivityImpact: 'positive',
        detectedAt: Date.now(),
        lastSeen: Date.now()
      })
    }
    
    return patterns
  }

  private async enhanceFocusSession(session: FocusSession, activities: ActivityRecord[]): Promise<FocusSession> {
    // Add pattern-based enhancements to focus session
    const sessionActivities = activities.filter(activity => 
      activity.timestamp >= session.startTime && 
      activity.timestamp <= session.endTime
    )
    
    // Calculate additional metrics
    // const avgCpuUsage = sessionActivities.reduce((sum, a) => sum + (a.cpuUsage || 0), 0) / sessionActivities.length
    const totalKeystrokes = sessionActivities.reduce((sum, a) => sum + (a.keystrokes || 0), 0)
    const totalMouseClicks = sessionActivities.reduce((sum, a) => sum + (a.mouseClicks || 0), 0)
    
    return {
      ...session,
      keystrokes: totalKeystrokes,
      mouseClicks: totalMouseClicks,
      // Enhanced analysis would go here if needed
    }
  }

  private detectSustainedFocusBlocks(focusSessions: FocusSession[]): FocusSession[] {
    const sustainedBlocks: FocusSession[] = []
    const GAP_THRESHOLD = 300000 // 5 minutes
    
    for (let i = 0; i < focusSessions.length - 1; i++) {
      const current = focusSessions[i]
      const next = focusSessions[i + 1]
      
      // Check if sessions are close enough to be considered sustained
      if (next.startTime - current.endTime <= GAP_THRESHOLD && 
          current.appName === next.appName) {
        
        // Create sustained block
        sustainedBlocks.push({
          startTime: current.startTime,
          endTime: next.endTime,
          duration: next.endTime - current.startTime,
          appName: current.appName,
          category: current.category,
          interruptions: current.interruptions + next.interruptions,
          focusScore: (current.focusScore + next.focusScore) / 2,
          keystrokes: (current.keystrokes || 0) + (next.keystrokes || 0),
          mouseClicks: (current.mouseClicks || 0) + (next.mouseClicks || 0)
        })
      }
    }
    
    return sustainedBlocks
  }

  private identifyBreaks(activities: ActivityRecord[]): Array<{ start: number, end: number, duration: number }> {
    const breaks: Array<{ start: number, end: number, duration: number }> = []
    const BREAK_THRESHOLD = 300000 // 5 minutes
    
    for (let i = 1; i < activities.length; i++) {
      const prevActivity = activities[i - 1]
      const currentActivity = activities[i]
      
      const gap = currentActivity.timestamp - (prevActivity.timestamp + prevActivity.duration)
      
      if (gap >= BREAK_THRESHOLD) {
        breaks.push({
          start: prevActivity.timestamp + prevActivity.duration,
          end: currentActivity.timestamp,
          duration: gap
        })
      }
    }
    
    return breaks
  }

  private analyzeBreakTiming(breaks: Array<{ start: number, end: number, duration: number }>): BreakPattern[] {
    const patterns: BreakPattern[] = []
    const hourlyBreaks = new Map<number, number>()
    
    breaks.forEach(breakItem => {
      const hour = new Date(breakItem.start).getHours()
      hourlyBreaks.set(hour, (hourlyBreaks.get(hour) || 0) + 1)
    })
    
    // Find peak break hours
    const peakBreakHours = Array.from(hourlyBreaks.entries())
      .filter(([_, count]) => count >= this.MIN_PATTERN_OCCURRENCES)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
    
    peakBreakHours.forEach(() => {
      patterns.push({
        timestamp: Date.now(),
        duration: 0, // This is a timing pattern, not a specific break
        type: 'short' as const,
        beforeActivity: '',
        afterActivity: ''
      })
    })
    
    return patterns
  }

  private analyzeBreakDurations(breaks: Array<{ start: number, end: number, duration: number }>): BreakPattern[] {
    const patterns: BreakPattern[] = []
    
    // Categorize breaks by duration
    const shortBreaks = breaks.filter(b => b.duration < 900000) // < 15 minutes
    // Categorize breaks by duration
    // const mediumBreaks = breaks.filter(b => b.duration >= 900000 && b.duration < 3600000) // 15-60 minutes
    // const longBreaks = breaks.filter(b => b.duration >= 3600000) // > 1 hour
    
    if (shortBreaks.length >= this.MIN_PATTERN_OCCURRENCES) {
      patterns.push({
        timestamp: Date.now(),
        duration: shortBreaks.reduce((sum, b) => sum + b.duration, 0) / shortBreaks.length,
        type: 'micro' as const,
        beforeActivity: '',
        afterActivity: ''
      })
    }
    
    return patterns
  }

  private analyzeBreakFrequency(breaks: Array<{ start: number, end: number, duration: number }>): BreakPattern[] {
    const patterns: BreakPattern[] = []
    
    if (breaks.length >= this.MIN_PATTERN_OCCURRENCES) {
      // Calculate average time between breaks
      const intervals: number[] = []
      for (let i = 1; i < breaks.length; i++) {
        intervals.push(breaks[i].start - breaks[i - 1].end)
      }
      
      const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
      
      patterns.push({
        timestamp: Date.now(),
        duration: avgInterval,
        type: 'short' as const,
        beforeActivity: '',
        afterActivity: ''
      })
    }
    
    return patterns
  }

  // Additional helper methods for habit analysis
  private async analyzeAppUsageHabits(activities: ActivityRecord[]): Promise<WorkHabit[]> {
    const habits: WorkHabit[] = []
    const appUsage = new Map<string, ActivityRecord[]>()
    
    activities.forEach(activity => {
      if (!appUsage.has(activity.appName)) {
        appUsage.set(activity.appName, [])
      }
      appUsage.get(activity.appName)!.push(activity)
    })
    
    appUsage.forEach((appActivities, appName) => {
      if (appActivities.length >= this.MIN_PATTERN_OCCURRENCES) {
        const totalTime = appActivities.reduce((sum, a) => sum + a.duration, 0)
        const avgProductivity = appActivities.reduce((sum, a) => sum + (a.focusScore || 0), 0) / appActivities.length
        
        habits.push({
          id: `app_habit_${appName}_${Date.now()}`,
          type: 'app_usage',
          pattern: `Regular use of ${appName}`,
          frequency: appActivities.length,
          confidence: Math.min(0.9, appActivities.length / 20),
          description: `You frequently use ${appName} for ${(totalTime / 3600000).toFixed(1)} hours total`,
          impact: avgProductivity > 0.7 ? 'positive' : avgProductivity < 0.3 ? 'negative' : 'neutral',
          recommendation: avgProductivity < 0.3 ? `Consider limiting time spent on ${appName}` : undefined,
          detectedAt: Date.now()
        })
      }
    })
    
    return habits
  }

  private async analyzeTimePreferenceHabits(activities: ActivityRecord[]): Promise<WorkHabit[]> {
    const habits: WorkHabit[] = []
    const hourlyActivity = this.groupActivitiesByHour(activities)
    
    // Find preferred working hours
    const hourlyProductivity = this.calculateHourlyProductivity(hourlyActivity)
    const peakHours = Object.entries(hourlyProductivity)
      .filter(([_, productivity]) => productivity > 0.6)
      .map(([hour]) => parseInt(hour))
      .sort((a, b) => a - b)
    
    if (peakHours.length >= 2) {
      habits.push({
        id: `time_preference_${Date.now()}`,
        type: 'time_preference',
        pattern: `Productive during ${peakHours[0]}:00-${peakHours[peakHours.length - 1]}:00`,
        frequency: peakHours.length,
        confidence: 0.8,
        description: `You are most productive during ${peakHours.join(', ')} o'clock hours`,
        impact: 'positive',
        recommendation: `Schedule important tasks during your peak hours: ${peakHours.join(', ')}`,
        detectedAt: Date.now()
      })
    }
    
    return habits
  }

  private async analyzeBreakTimingHabits(activities: ActivityRecord[]): Promise<WorkHabit[]> {
    const habits: WorkHabit[] = []
    const breaks = this.identifyBreaks(activities)
    
    if (breaks.length >= this.MIN_PATTERN_OCCURRENCES) {
      // Calculate average break interval
      const intervals: number[] = []
      for (let i = 1; i < breaks.length; i++) {
        intervals.push(breaks[i].start - breaks[i - 1].end)
      }
      
      const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
      const intervalHours = avgInterval / 3600000
      
      habits.push({
        id: `break_timing_${Date.now()}`,
        type: 'break_timing',
        pattern: `Takes breaks every ${intervalHours.toFixed(1)} hours`,
        frequency: breaks.length,
        confidence: Math.min(0.9, breaks.length / 10),
        description: `You typically take breaks every ${intervalHours.toFixed(1)} hours`,
        impact: intervalHours > 3 ? 'negative' : intervalHours < 1 ? 'negative' : 'positive',
        recommendation: intervalHours > 3 ? 'Consider taking more frequent breaks' : 
                       intervalHours < 1 ? 'Your breaks might be too frequent' : undefined,
        detectedAt: Date.now()
      })
    }
    
    return habits
  }

  private async analyzeFocusDurationHabits(activities: ActivityRecord[]): Promise<WorkHabit[]> {
    const habits: WorkHabit[] = []
    const focusSessions = this.focusDetector.identifyFocusSessions(activities)
    
    if (focusSessions.length >= this.MIN_PATTERN_OCCURRENCES) {
      const avgDuration = focusSessions.reduce((sum, session) => sum + session.duration, 0) / focusSessions.length
      const durationMinutes = avgDuration / 60000
      
      habits.push({
        id: `focus_duration_${Date.now()}`,
        type: 'focus_duration',
        pattern: `Average focus session: ${durationMinutes.toFixed(1)} minutes`,
        frequency: focusSessions.length,
        confidence: Math.min(0.9, focusSessions.length / 10),
        description: `Your average focus session lasts ${durationMinutes.toFixed(1)} minutes`,
        impact: durationMinutes > 45 ? 'positive' : durationMinutes < 15 ? 'negative' : 'neutral',
        recommendation: durationMinutes < 15 ? 'Try to extend your focus sessions to at least 25 minutes' : undefined,
        detectedAt: Date.now()
      })
    }
    
    return habits
  }

  private async analyzeMultitaskingHabits(activities: ActivityRecord[]): Promise<WorkHabit[]> {
    const habits: WorkHabit[] = []
    const contextSwitches = this.identifyContextSwitches(activities)
    
    if (activities.length > 0) {
      const totalTime = activities[activities.length - 1].timestamp - activities[0].timestamp
      const switchRate = contextSwitches.length / (totalTime / 3600000) // switches per hour
      
      habits.push({
        id: `multitasking_${Date.now()}`,
        type: 'multitasking',
        pattern: `${switchRate.toFixed(1)} context switches per hour`,
        frequency: contextSwitches.length,
        confidence: 0.8,
        description: `You switch between applications ${switchRate.toFixed(1)} times per hour`,
        impact: switchRate > 30 ? 'negative' : switchRate < 10 ? 'positive' : 'neutral',
        recommendation: switchRate > 30 ? 'Try to reduce context switching by batching similar tasks' : undefined,
        detectedAt: Date.now()
      })
    }
    
    return habits
  }

  // Utility methods
  private groupActivitiesByHour(activities: ActivityRecord[]): Map<number, ActivityRecord[]> {
    const grouped = new Map<number, ActivityRecord[]>()
    
    activities.forEach(activity => {
      const hour = new Date(activity.timestamp).getHours()
      if (!grouped.has(hour)) {
        grouped.set(hour, [])
      }
      grouped.get(hour)!.push(activity)
    })
    
    return grouped
  }

  private calculateHourlyProductivity(hourlyData: Map<number, ActivityRecord[]>): Record<number, number> {
    const productivity: Record<number, number> = {}
    
    hourlyData.forEach((activities, hour) => {
      const avgProductivity = activities.reduce((sum, a) => sum + (a.focusScore || 0), 0) / activities.length
      productivity[hour] = avgProductivity
    })
    
    return productivity
  }

  private calculateWeeklyProductivity(timePatterns: Map<string, ActivityRecord[]>): number[] {
    const weeklyData: number[] = []
    
    // This is a simplified implementation - in reality, you'd group by actual weeks
    timePatterns.forEach((activities) => {
      const avgProductivity = activities.reduce((sum, a) => sum + (a.focusScore || 0), 0) / activities.length
      weeklyData.push(avgProductivity)
    })
    
    return weeklyData
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0
    
    const first = values[0]
    const last = values[values.length - 1]
    
    return (last - first) / first
  }

  private identifyProductivityPeaks(hourlyProductivity: Record<number, number>): number[] {
    return Object.entries(hourlyProductivity)
      .filter(([_, productivity]) => productivity > 0.7)
      .map(([hour]) => parseInt(hour))
  }

  private identifyProductivityValleys(hourlyProductivity: Record<number, number>): number[] {
    return Object.entries(hourlyProductivity)
      .filter(([_, productivity]) => productivity < 0.3)
      .map(([hour]) => parseInt(hour))
  }

  private identifyModeratePeriods(hourlyProductivity: Record<number, number>, peaks: number[], valleys: number[]): number[] {
    const excludeHours = new Set([...peaks, ...valleys])
    return Object.keys(hourlyProductivity)
      .map(hour => parseInt(hour))
      .filter(hour => !excludeHours.has(hour))
  }

  private createProductivityCycles(hours: number[], type: 'peak' | 'moderate' | 'low'): ProductivityCycle[] {
    if (hours.length === 0) return []
    
    // Group consecutive hours
    const cycles: ProductivityCycle[] = []
    let currentCycle: number[] = [hours[0]]
    
    for (let i = 1; i < hours.length; i++) {
      if (hours[i] === hours[i - 1] + 1) {
        currentCycle.push(hours[i])
      } else {
        if (currentCycle.length > 0) {
          cycles.push(this.createCycle(currentCycle, type))
        }
        currentCycle = [hours[i]]
      }
    }
    
    if (currentCycle.length > 0) {
      cycles.push(this.createCycle(currentCycle, type))
    }
    
    return cycles
  }

  private createCycle(hours: number[], type: 'peak' | 'moderate' | 'low'): ProductivityCycle {
    return {
      id: `cycle_${type}_${hours[0]}_${Date.now()}`,
      startHour: hours[0],
      endHour: hours[hours.length - 1],
      type,
      averageProductivity: type === 'peak' ? 0.8 : type === 'low' ? 0.2 : 0.5,
      consistency: 0.8,
      daysObserved: this.PRODUCTIVITY_CYCLE_MIN_DAYS,
      confidence: 0.8
    }
  }

  private identifyContextSwitches(activities: ActivityRecord[]): Array<{ from: string, to: string, timestamp: number, duration: number }> {
    const switches: Array<{ from: string, to: string, timestamp: number, duration: number }> = []
    
    for (let i = 1; i < activities.length; i++) {
      const prev = activities[i - 1]
      const current = activities[i]
      
      if (prev.appName !== current.appName) {
        switches.push({
          from: prev.appName,
          to: current.appName,
          timestamp: current.timestamp,
          duration: current.timestamp - (prev.timestamp + prev.duration)
        })
      }
    }
    
    return switches
  }

  private groupSwitchesByAppPair(switches: Array<{ from: string, to: string, timestamp: number, duration: number }>): Map<string, Array<{ from: string, to: string, timestamp: number, duration: number }>> {
    const grouped = new Map<string, Array<{ from: string, to: string, timestamp: number, duration: number }>>()
    
    switches.forEach(switchItem => {
      const key = `${switchItem.from} -> ${switchItem.to}`
      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key)!.push(switchItem)
    })
    
    return grouped
  }

  private extractTimeOfDay(switches: Array<{ timestamp: number }>): number[] {
    return switches.map(s => new Date(s.timestamp).getHours())
  }

  private assessSwitchImpact(switches: Array<{ duration: number }>): 'disruptive' | 'neutral' | 'beneficial' {
    const avgDuration = switches.reduce((sum, s) => sum + s.duration, 0) / switches.length
    
    if (avgDuration < 10000) return 'disruptive' // < 10 seconds
    if (avgDuration > 300000) return 'beneficial' // > 5 minutes
    return 'neutral'
  }

  private classifySwitchPattern(switches: Array<{ timestamp: number }>): 'habitual' | 'reactive' | 'planned' {
    // Analyze timing patterns to classify switch behavior
    const hours = switches.map(s => new Date(s.timestamp).getHours())
    const uniqueHours = new Set(hours)
    
    if (uniqueHours.size <= 2) return 'habitual' // Switches happen at specific times
    if (switches.length > 10) return 'reactive' // Frequent switches suggest reactive behavior
    return 'planned' // Moderate, distributed switches suggest planned behavior
  }

  private getDayName(dayOfWeek: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return days[dayOfWeek] || 'Unknown'
  }
}

// Exports are handled by the interface and class declarations above