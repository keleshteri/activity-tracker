import { ActivityRecord, ProductivityMetrics, ProductivityInsight, WorkPattern } from '../types'
import { DatabaseManager } from '../database'
import { ProductivityAnalytics } from '../analytics'
import { SystemResourceMonitor } from '../monitor'

export interface ProductivityCalculator {
  calculateRealTimeScore(activity: ActivityRecord): Promise<number>
  generateProductivityInsights(timeRange: { start: number, end: number }): Promise<ProductivityInsight[]>
  analyzeWorkPatterns(activities: ActivityRecord[]): Promise<WorkPattern[]>
  getProductivityTrends(days: number): Promise<ProductivityTrend[]>
  optimizeProductivitySettings(): Promise<ProductivityOptimization>
}

export interface ProductivityTrend {
  date: string
  productivityScore: number
  focusScore: number
  efficiency: number
  topProductiveApps: string[]
  topDistractingApps: string[]
  peakHours: number[]
  totalActiveTime: number
}

export interface ProductivityOptimization {
  recommendations: string[]
  optimalWorkHours: { start: number, end: number }
  suggestedBreakInterval: number
  focusImprovements: string[]
  resourceOptimizations: string[]
}

export class RealTimeProductivityCalculator implements ProductivityCalculator {
  private readonly TREND_CACHE_DURATION = 3600000 // 1 hour
  private trendCache: Map<string, { data: ProductivityTrend[], timestamp: number }> = new Map()

  constructor(
    private db: DatabaseManager,
    private analytics: ProductivityAnalytics,
    private resourceMonitor: SystemResourceMonitor
  ) {}

  async calculateRealTimeScore(activity: ActivityRecord): Promise<number> {
    try {
      // Get base productivity score from analytics
      const baseScore = await this.analytics.calculateProductivityScore(activity)
      
      // Get current system metrics for resource correlation
      const systemMetrics = await this.resourceMonitor.getSystemMetrics()
      const resourceCorrelation = this.resourceMonitor.correlateResourcesWithProductivity(activity, systemMetrics)
      
      // Adjust score based on resource efficiency
      let adjustedScore = baseScore * resourceCorrelation.performanceScore
      
      // Apply time-of-day adjustments
      const timeAdjustment = this.getTimeOfDayAdjustment(activity.timestamp)
      adjustedScore *= timeAdjustment
      
      // Apply recent context adjustments
      const contextAdjustment = await this.getContextAdjustment(activity)
      adjustedScore *= contextAdjustment
      
      return Math.max(0, Math.min(1, adjustedScore))
    } catch (error) {
      console.error('Error calculating real-time productivity score:', error)
      return 0.5 // Default neutral score
    }
  }

  async generateProductivityInsights(timeRange: { start: number, end: number }): Promise<ProductivityInsight[]> {
    try {
      const activities = await this.db.getActivities({
      startDate: timeRange.start,
      endDate: timeRange.end
    })
      const insights: ProductivityInsight[] = []

      // Analyze productivity patterns
      const metrics = await this.analytics.analyzeProductivityPatterns(activities)
      
      // Generate focus insights
      insights.push(...await this.generateFocusInsights(activities, metrics))
      
      // Generate time management insights
      insights.push(...await this.generateTimeManagementInsights(activities, metrics))
      
      // Generate app usage insights
      insights.push(...await this.generateAppUsageInsights(activities))
      
      // Generate resource efficiency insights
      insights.push(...await this.generateResourceInsights(activities))
      
      // Generate break pattern insights
      insights.push(...await this.generateBreakInsights(activities))

      return insights.sort((a, b) => {
        const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 }
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      })
    } catch (error) {
      console.error('Error generating productivity insights:', error)
      return []
    }
  }

  async analyzeWorkPatterns(activities: ActivityRecord[]): Promise<WorkPattern[]> {
    const patterns: WorkPattern[] = []
    
    // Group activities by hour of day
    const hourlyPatterns = this.groupActivitiesByHour(activities)
    
    for (const [hour, hourActivities] of hourlyPatterns.entries()) {
      if (hourActivities.length === 0) continue
      
      const metrics = await this.analytics.analyzeProductivityPatterns(hourActivities)
      const dominantApps = this.getDominantApps(hourActivities, 3)
      
      patterns.push({
        id: `pattern_${hour}_${Date.now()}`,
        type: 'daily' as const,
        name: `Hour ${hour} Pattern`,
        description: `Productivity pattern for hour ${hour}`,
        confidence: metrics.focusScore,
        frequency: hourActivities.length,
        timeOfDay: { start: hour, end: hour + 1 },
        associatedApps: dominantApps,
        productivityImpact: metrics.focusScore > 0.6 ? 'positive' as const : metrics.focusScore < 0.4 ? 'negative' as const : 'neutral' as const,
        detectedAt: Date.now(),
        lastSeen: Date.now()
      })
    }
    
    return patterns.sort((a, b) => b.confidence - a.confidence)
  }

  async getProductivityTrends(days: number): Promise<ProductivityTrend[]> {
    const cacheKey = `trends_${days}`
    const cached = this.trendCache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.TREND_CACHE_DURATION) {
      return cached.data
    }

    try {
      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000))
      
      const trends: ProductivityTrend[] = []
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dayStart = new Date(d).setHours(0, 0, 0, 0)
        const dayEnd = new Date(d).setHours(23, 59, 59, 999)
        
        const activities = await this.db.getActivities({
        startDate: dayStart,
        endDate: dayEnd
      })
        
        if (activities.length === 0) continue
        
        const metrics = await this.analytics.analyzeProductivityPatterns(activities)
        // Resource analysis would go here
        
        const trend: ProductivityTrend = {
          date: d.toISOString().split('T')[0],
          productivityScore: this.calculateOverallProductivityScore(metrics),
          focusScore: metrics.focusScore,
          efficiency: this.calculateEfficiency(activities),
          topProductiveApps: this.getTopProductiveApps(activities, 3),
          topDistractingApps: this.getTopDistractingApps(activities, 3),
          peakHours: this.getPeakProductivityHours(activities),
          totalActiveTime: metrics.totalActiveTime
        }
        
        trends.push(trend)
      }
      
      // Cache the results
      this.trendCache.set(cacheKey, { data: trends, timestamp: Date.now() })
      
      return trends
    } catch (error) {
      console.error('Error getting productivity trends:', error)
      return []
    }
  }

  async optimizeProductivitySettings(): Promise<ProductivityOptimization> {
    try {
      // Analyze last 30 days of data
      const trends = await this.getProductivityTrends(30)
      const recentActivities = await this.getRecentActivities(7) // Last 7 days
      
      const recommendations: string[] = []
      const focusImprovements: string[] = []
      const resourceOptimizations: string[] = []
      
      // Analyze optimal work hours
      const optimalWorkHours = this.findOptimalWorkHours(trends)
      
      // Analyze break patterns
      const suggestedBreakInterval = this.calculateOptimalBreakInterval(recentActivities)
      
      // Generate recommendations based on patterns
      recommendations.push(...this.generateGeneralRecommendations(trends))
      focusImprovements.push(...this.generateFocusRecommendations(trends))
      resourceOptimizations.push(...this.generateResourceRecommendations(recentActivities))
      
      return {
        recommendations,
        optimalWorkHours,
        suggestedBreakInterval,
        focusImprovements,
        resourceOptimizations
      }
    } catch (error) {
      console.error('Error optimizing productivity settings:', error)
      return this.getDefaultOptimization()
    }
  }

  private getTimeOfDayAdjustment(timestamp: number): number {
    const hour = new Date(timestamp).getHours()
    
    // Peak productivity hours (9 AM - 11 AM, 2 PM - 4 PM)
    if ((hour >= 9 && hour <= 11) || (hour >= 14 && hour <= 16)) {
      return 1.1
    }
    
    // Good productivity hours
    if ((hour >= 8 && hour <= 12) || (hour >= 13 && hour <= 17)) {
      return 1.0
    }
    
    // Lower productivity hours
    if (hour >= 18 && hour <= 22) {
      return 0.9
    }
    
    // Very low productivity hours (late night/early morning)
    return 0.7
  }

  private async getContextAdjustment(activity: ActivityRecord): Promise<number> {
    try {
      // Get recent activities (last 30 minutes)
      const recentStart = activity.timestamp - 1800000
      const recentActivities = await this.db.getActivities({
      startDate: recentStart,
      endDate: activity.timestamp
    })
      
      if (recentActivities.length === 0) return 1.0
      
      // Penalize rapid context switching
      const contextSwitches = this.analytics.detectContextSwitches(recentActivities)
      if (contextSwitches > 10) return 0.8
      if (contextSwitches > 5) return 0.9
      
      // Bonus for sustained focus
      const focusScore = this.analytics.calculateFocusScore(recentActivities)
      if (focusScore > 0.8) return 1.1
      
      return 1.0
    } catch (error) {
      return 1.0
    }
  }

  private async generateFocusInsights(_activities: ActivityRecord[], metrics: ProductivityMetrics): Promise<ProductivityInsight[]> {
    const insights: ProductivityInsight[] = []
    
    if (metrics.focusScore < 0.5) {
      insights.push({
        id: `focus_low_${Date.now()}`,
        type: 'focus_improvement',
        title: 'Low Focus Detected',
        description: `Your focus score is ${(metrics.focusScore * 100).toFixed(1)}%. Consider reducing distractions and taking regular breaks.`,
        actionable: true,
        priority: 'high' as const,
        timestamp: Date.now()
      })
    }
    
    if (metrics.contextSwitches > 50) {
      insights.push({
        id: `context_switch_${Date.now()}`,
        type: 'focus_improvement',
        title: 'High Context Switching',
        description: `You switched between apps ${metrics.contextSwitches} times. Try to batch similar tasks together.`,
        actionable: true,
        priority: 'medium' as const,
        timestamp: Date.now()
      })
    }
    
    return insights
  }

  private async generateTimeManagementInsights(_activities: ActivityRecord[], metrics: ProductivityMetrics): Promise<ProductivityInsight[]> {
    const insights: ProductivityInsight[] = []
    
    const productivePercentage = (metrics.productiveTime / metrics.totalActiveTime) * 100
    
    if (productivePercentage > 70) {
      insights.push({
        id: `productivity_high_${Date.now()}`,
        type: 'focus_improvement',
        title: 'Excellent Productivity',
        description: `${productivePercentage.toFixed(1)}% of your time was spent productively. Keep up the great work!`,
        actionable: false,
        priority: 'low' as const,
        timestamp: Date.now()
      })
    } else if (productivePercentage < 40) {
      insights.push({
        id: `productivity_low_${Date.now()}`,
        type: 'focus_improvement',
        title: 'Low Productive Time',
        description: `Only ${productivePercentage.toFixed(1)}% of your time was productive. Consider reviewing your app usage and eliminating distractions.`,
        actionable: true,
        priority: 'high' as const,
        timestamp: Date.now()
      })
    }
    
    return insights
  }

  private async generateAppUsageInsights(activities: ActivityRecord[]): Promise<ProductivityInsight[]> {
    const insights: ProductivityInsight[] = []
    
    const appTimes = new Map<string, number>()
    activities.forEach(activity => {
      const current = appTimes.get(activity.appName) || 0
      appTimes.set(activity.appName, current + activity.duration)
    })
    
    const sortedApps = Array.from(appTimes.entries()).sort((a, b) => b[1] - a[1])
    const topApp = sortedApps[0]
    
    if (topApp && topApp[1] > 7200000) { // More than 2 hours
      const hours = (topApp[1] / 3600000).toFixed(1)
      insights.push({
        id: `app_usage_${Date.now()}`,
        type: 'app_recommendation',
        title: 'High App Usage',
        description: `You spent ${hours} hours in ${topApp[0]}. Consider if this aligns with your productivity goals.`,
        actionable: true,
        priority: 'medium' as const,
        timestamp: Date.now()
      })
    }
    
    return insights
  }

  private async generateResourceInsights(activities: ActivityRecord[]): Promise<ProductivityInsight[]> {
    const insights: ProductivityInsight[] = []
    
    const intensiveApps = this.resourceMonitor.detectResourceIntensiveApps(activities)
    const topIntensive = intensiveApps.slice(0, 3)
    
    topIntensive.forEach(app => {
      if (app.category === 'extreme') {
        insights.push({
          id: `resource_${Date.now()}_${app.appName}`,
          type: 'app_recommendation',
          title: 'Resource-Intensive App',
          description: `${app.appName} is using significant system resources (CPU: ${app.avgCpuUsage.toFixed(1)}%, Memory: ${app.avgMemoryUsage.toFixed(1)}%). Consider optimizing or finding alternatives.`,
          actionable: true,
          priority: 'high' as const,
          timestamp: Date.now()
        })
      }
    })
    
    return insights
  }

  private async generateBreakInsights(activities: ActivityRecord[]): Promise<ProductivityInsight[]> {
    const insights: ProductivityInsight[] = []
    
    // Analyze break patterns (simplified)
    const totalTime = activities.reduce((sum, activity) => sum + activity.duration, 0)
    const hours = totalTime / 3600000
    
    if (hours > 4) { // If working more than 4 hours
      // This is a simplified check - in reality, you'd analyze actual break patterns
      
      insights.push({
        id: `break_${Date.now()}`,
        type: 'break_suggestion',
        title: 'Break Reminder',
        description: `You've been working for ${hours.toFixed(1)} hours. Consider taking regular breaks to maintain productivity.`,
        actionable: true,
        priority: 'medium' as const,
        timestamp: Date.now()
      })
    }
    
    return insights
  }

  private groupActivitiesByHour(activities: ActivityRecord[]): Map<number, ActivityRecord[]> {
    const hourlyGroups = new Map<number, ActivityRecord[]>()
    
    activities.forEach(activity => {
      const hour = new Date(activity.timestamp).getHours()
      const group = hourlyGroups.get(hour) || []
      group.push(activity)
      hourlyGroups.set(hour, group)
    })
    
    return hourlyGroups
  }

  private getDominantApps(activities: ActivityRecord[], count: number): string[] {
    const appTimes = new Map<string, number>()
    
    activities.forEach(activity => {
      const current = appTimes.get(activity.appName) || 0
      appTimes.set(activity.appName, current + activity.duration)
    })
    
    return Array.from(appTimes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([app]) => app)
  }



  private calculateOverallProductivityScore(metrics: ProductivityMetrics): number {
    const productiveRatio = metrics.totalActiveTime > 0 ? metrics.productiveTime / metrics.totalActiveTime : 0
    return (productiveRatio + metrics.focusScore) / 2
  }

  private calculateEfficiency(activities: ActivityRecord[]): number {
    // Simplified efficiency calculation
    const totalTime = activities.reduce((sum, activity) => sum + activity.duration, 0)
    const contextSwitches = this.analytics.detectContextSwitches(activities)
    
    if (totalTime === 0) return 0
    
    const switchPenalty = Math.min(0.5, contextSwitches * 0.01)
    return Math.max(0, 1 - switchPenalty)
  }

  private getTopProductiveApps(activities: ActivityRecord[], count: number): string[] {
    // This would need app category data to determine productivity
    // For now, return apps with longest duration
    return this.getDominantApps(activities, count)
  }

  private getTopDistractingApps(_activities: ActivityRecord[], _count: number): string[] {
    // This would need app category data to determine distracting apps
    // For now, return empty array
    return []
  }

  private getPeakProductivityHours(activities: ActivityRecord[]): number[] {
    const hourlyProductivity = new Map<number, number>()
    
    activities.forEach(activity => {
      const hour = new Date(activity.timestamp).getHours()
      const current = hourlyProductivity.get(hour) || 0
      hourlyProductivity.set(hour, current + activity.duration)
    })
    
    return Array.from(hourlyProductivity.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => hour)
  }

  private async getRecentActivities(days: number): Promise<ActivityRecord[]> {
    const endTime = Date.now()
    const startTime = endTime - (days * 24 * 60 * 60 * 1000)
    return this.db.getActivities({
      startDate: startTime,
      endDate: endTime
    })
  }

  private findOptimalWorkHours(trends: ProductivityTrend[]): { start: number, end: number } {
    // Analyze peak hours across all trends
    const hourCounts = new Map<number, number>()
    
    trends.forEach(trend => {
      trend.peakHours.forEach(hour => {
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1)
      })
    })
    
    const sortedHours = Array.from(hourCounts.entries()).sort((a, b) => b[1] - a[1])
    
    if (sortedHours.length >= 2) {
      const start = Math.min(sortedHours[0][0], sortedHours[1][0])
      const end = Math.max(sortedHours[0][0], sortedHours[1][0]) + 8 // 8-hour work day
      return { start, end: Math.min(end, 18) } // Cap at 6 PM
    }
    
    return { start: 9, end: 17 } // Default 9-5
  }

  private calculateOptimalBreakInterval(_activities: ActivityRecord[]): number {
    // Analyze current break patterns and suggest optimal interval
    // This is simplified - would need more sophisticated analysis
    return 90 // 90 minutes (Pomodoro-style)
  }

  private generateGeneralRecommendations(trends: ProductivityTrend[]): string[] {
    const recommendations: string[] = []
    
    const avgProductivity = trends.reduce((sum, trend) => sum + trend.productivityScore, 0) / trends.length
    
    if (avgProductivity < 0.6) {
      recommendations.push('Consider implementing time-blocking techniques to improve focus')
      recommendations.push('Review and categorize your applications to identify productivity drains')
    }
    
    if (trends.some(trend => trend.totalActiveTime > 36000000)) { // More than 10 hours
      recommendations.push('Consider reducing daily screen time to prevent burnout')
    }
    
    return recommendations
  }

  private generateFocusRecommendations(trends: ProductivityTrend[]): string[] {
    const recommendations: string[] = []
    
    const avgFocus = trends.reduce((sum, trend) => sum + trend.focusScore, 0) / trends.length
    
    if (avgFocus < 0.5) {
      recommendations.push('Try the Pomodoro Technique: 25 minutes focused work, 5 minute breaks')
      recommendations.push('Use website blockers during focused work sessions')
      recommendations.push('Create a dedicated workspace free from distractions')
    }
    
    return recommendations
  }

  private generateResourceRecommendations(activities: ActivityRecord[]): string[] {
    const recommendations: string[] = []
    
    const intensiveApps = this.resourceMonitor.detectResourceIntensiveApps(activities)
    
    if (intensiveApps.some(app => app.category === 'extreme')) {
      recommendations.push('Consider upgrading system RAM for better performance')
      recommendations.push('Close unnecessary background applications')
      recommendations.push('Monitor resource-intensive applications and consider alternatives')
    }
    
    return recommendations
  }

  private getDefaultOptimization(): ProductivityOptimization {
    return {
      recommendations: ['Enable activity tracking to get personalized recommendations'],
      optimalWorkHours: { start: 9, end: 17 },
      suggestedBreakInterval: 90,
      focusImprovements: ['Start tracking your activities to get focus insights'],
      resourceOptimizations: ['Monitor system resources for optimization suggestions']
    }
  }
}