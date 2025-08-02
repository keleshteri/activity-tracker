import { ActivityRecord, ProductivityInsight, Achievement, ProductivityWarning } from '../types'
import { DatabaseManager } from '../database'
import { ProductivityAnalytics } from '../analytics'
import { RealTimeProductivityCalculator, ProductivityTrend } from '../productivity'

export interface InsightGenerator {
  generateAutomatedInsights(timeRange: { start: number, end: number }): Promise<ProductivityInsight[]>
  detectAchievements(activities: ActivityRecord[], trends: ProductivityTrend[]): Promise<Achievement[]>
  detectWarnings(activities: ActivityRecord[], trends: ProductivityTrend[]): Promise<ProductivityWarning[]>
  generateActionableRecommendations(insights: ProductivityInsight[]): Promise<string[]>
}

// Achievement and ProductivityWarning interfaces are now imported from '../types'

export class AutomatedInsightGenerator implements InsightGenerator {
  private readonly ACHIEVEMENT_THRESHOLDS = {
    PRODUCTIVITY_SCORE: { good: 0.7, excellent: 0.85, outstanding: 0.95 },
    FOCUS_SCORE: { good: 0.6, excellent: 0.8, outstanding: 0.9 },
    CONSISTENCY_DAYS: { good: 7, excellent: 14, outstanding: 30 },
    EFFICIENCY_IMPROVEMENT: { good: 0.1, excellent: 0.2, outstanding: 0.3 },
    WORK_LIFE_BALANCE: { good: 8, excellent: 6, outstanding: 4 } // hours of overwork
  }

  private readonly WARNING_THRESHOLDS = {
    DECLINING_PRODUCTIVITY: { days: 3, threshold: 0.15 }, // 15% decline over 3 days
    EXCESSIVE_DISTRACTION: { contextSwitches: 100, focusScore: 0.3 },
    BURNOUT_RISK: { hoursPerDay: 10, daysInRow: 5 },
    POOR_FOCUS: { days: 5, threshold: 0.4 },
    OVERWORK: { hoursPerDay: 12, weeklyHours: 60 }
  }

  constructor(
    private db: DatabaseManager,
    private analytics: ProductivityAnalytics,
    private productivityCalculator: RealTimeProductivityCalculator
  ) {}

  async generateAutomatedInsights(timeRange: { start: number, end: number }): Promise<ProductivityInsight[]> {
    try {
      const activities = await this.db.getActivities({
        startDate: timeRange.start,
        endDate: timeRange.end
      })

      const insights: ProductivityInsight[] = []
      const trends = await this.productivityCalculator.getProductivityTrends(7)

      // Generate pattern-based insights
      insights.push(...await this.generatePatternInsights(activities))
      
      // Generate trend-based insights
      insights.push(...await this.generateTrendInsights(trends))
      
      // Generate comparative insights
      insights.push(...await this.generateComparativeInsights(activities, trends))
      
      // Generate optimization insights
      insights.push(...await this.generateOptimizationInsights(activities))

      // Sort by priority and timestamp
      return insights.sort((a, b) => {
        const priorityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 }
        const aPriority = priorityOrder[a.priority] || 0
        const bPriority = priorityOrder[b.priority] || 0
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority
        }
        return b.timestamp - a.timestamp
      })
    } catch (error) {
      console.error('Failed to generate automated insights:', error)
      return []
    }
  }

  async detectAchievements(_activities: ActivityRecord[], trends: ProductivityTrend[]): Promise<Achievement[]> {
    const achievements: Achievement[] = []
    const now = Date.now()

    // Productivity milestone achievements
    const avgProductivity = trends.reduce((sum, trend) => sum + trend.productivityScore, 0) / trends.length
    if (avgProductivity >= this.ACHIEVEMENT_THRESHOLDS.PRODUCTIVITY_SCORE.outstanding) {
      achievements.push({
        id: `productivity_outstanding_${now}`,
        type: 'productivity_milestone',
        title: 'Outstanding Productivity',
        description: `Achieved ${(avgProductivity * 100).toFixed(1)}% average productivity over the last week!`,
        timestamp: now,
        value: avgProductivity,
        threshold: this.ACHIEVEMENT_THRESHOLDS.PRODUCTIVITY_SCORE.outstanding,
        category: 'weekly',
        badge: '🏆'
      })
    } else if (avgProductivity >= this.ACHIEVEMENT_THRESHOLDS.PRODUCTIVITY_SCORE.excellent) {
      achievements.push({
        id: `productivity_excellent_${now}`,
        type: 'productivity_milestone',
        title: 'Excellent Productivity',
        description: `Maintained ${(avgProductivity * 100).toFixed(1)}% average productivity this week!`,
        timestamp: now,
        value: avgProductivity,
        threshold: this.ACHIEVEMENT_THRESHOLDS.PRODUCTIVITY_SCORE.excellent,
        category: 'weekly',
        badge: '⭐'
      })
    }

    // Focus improvement achievements
    const avgFocus = trends.reduce((sum, trend) => sum + trend.focusScore, 0) / trends.length
    if (avgFocus >= this.ACHIEVEMENT_THRESHOLDS.FOCUS_SCORE.outstanding) {
      achievements.push({
        id: `focus_outstanding_${now}`,
        type: 'focus_improvement',
        title: 'Focus Master',
        description: `Achieved ${(avgFocus * 100).toFixed(1)}% average focus score!`,
        timestamp: now,
        value: avgFocus,
        threshold: this.ACHIEVEMENT_THRESHOLDS.FOCUS_SCORE.outstanding,
        category: 'weekly',
        badge: '🎯'
      })
    }

    // Consistency achievements
    const consistentDays = this.calculateConsistentDays(trends)
    if (consistentDays >= this.ACHIEVEMENT_THRESHOLDS.CONSISTENCY_DAYS.outstanding) {
      achievements.push({
        id: `consistency_outstanding_${now}`,
        type: 'consistency',
        title: 'Consistency Champion',
        description: `Maintained consistent productivity for ${consistentDays} days straight!`,
        timestamp: now,
        value: consistentDays,
        threshold: this.ACHIEVEMENT_THRESHOLDS.CONSISTENCY_DAYS.outstanding,
        category: 'monthly',
        badge: '📈'
      })
    }

    // Efficiency achievements
    const efficiencyImprovement = this.calculateEfficiencyImprovement(trends)
    if (efficiencyImprovement >= this.ACHIEVEMENT_THRESHOLDS.EFFICIENCY_IMPROVEMENT.excellent) {
      achievements.push({
        id: `efficiency_improvement_${now}`,
        type: 'efficiency',
        title: 'Efficiency Expert',
        description: `Improved efficiency by ${(efficiencyImprovement * 100).toFixed(1)}% this week!`,
        timestamp: now,
        value: efficiencyImprovement,
        threshold: this.ACHIEVEMENT_THRESHOLDS.EFFICIENCY_IMPROVEMENT.excellent,
        category: 'weekly',
        badge: '⚡'
      })
    }

    return achievements
  }

  async detectWarnings(activities: ActivityRecord[], trends: ProductivityTrend[]): Promise<ProductivityWarning[]> {
    const warnings: ProductivityWarning[] = []
    const now = Date.now()

    // Declining productivity warning
    const productivityDecline = this.calculateProductivityDecline(trends)
    if (productivityDecline >= this.WARNING_THRESHOLDS.DECLINING_PRODUCTIVITY.threshold) {
      warnings.push({
        id: `declining_productivity_${now}`,
        type: 'declining_productivity',
        severity: productivityDecline >= 0.3 ? 'critical' : productivityDecline >= 0.2 ? 'high' : 'medium',
        title: 'Declining Productivity Detected',
        description: `Your productivity has declined by ${(productivityDecline * 100).toFixed(1)}% over the last ${this.WARNING_THRESHOLDS.DECLINING_PRODUCTIVITY.days} days.`,
        timestamp: now,
        trend: 'decreasing',
        recommendations: [
          'Take a longer break to recharge',
          'Review your current workload and priorities',
          'Consider adjusting your work environment',
          'Ensure you\'re getting adequate sleep'
        ],
        threshold: this.WARNING_THRESHOLDS.DECLINING_PRODUCTIVITY.threshold,
        currentValue: productivityDecline
      })
    }

    // Excessive distraction warning
    const avgContextSwitches = this.calculateAverageContextSwitches(activities)
    const avgFocusScore = trends.reduce((sum, trend) => sum + trend.focusScore, 0) / trends.length
    
    if (avgContextSwitches > this.WARNING_THRESHOLDS.EXCESSIVE_DISTRACTION.contextSwitches || 
        avgFocusScore < this.WARNING_THRESHOLDS.EXCESSIVE_DISTRACTION.focusScore) {
      warnings.push({
        id: `excessive_distraction_${now}`,
        type: 'excessive_distraction',
        severity: avgFocusScore < 0.2 ? 'critical' : avgFocusScore < 0.3 ? 'high' : 'medium',
        title: 'High Distraction Level',
        description: `You\'re experiencing ${avgContextSwitches} context switches per hour with a ${(avgFocusScore * 100).toFixed(1)}% focus score.`,
        timestamp: now,
        trend: 'increasing',
        recommendations: [
          'Use focus apps to block distracting websites',
          'Turn off non-essential notifications',
          'Try the Pomodoro technique',
          'Create a dedicated workspace'
        ],
        threshold: this.WARNING_THRESHOLDS.EXCESSIVE_DISTRACTION.focusScore,
        currentValue: avgFocusScore
      })
    }

    // Burnout risk warning
    const avgDailyHours = this.calculateAverageDailyHours(activities)
    const consecutiveOverworkDays = this.calculateConsecutiveOverworkDays(trends)
    
    if (avgDailyHours > this.WARNING_THRESHOLDS.BURNOUT_RISK.hoursPerDay || 
        consecutiveOverworkDays >= this.WARNING_THRESHOLDS.BURNOUT_RISK.daysInRow) {
      warnings.push({
        id: `burnout_risk_${now}`,
        type: 'burnout_risk',
        severity: avgDailyHours > 12 ? 'critical' : 'high',
        title: 'Burnout Risk Detected',
        description: `You\'ve been working ${avgDailyHours.toFixed(1)} hours per day for ${consecutiveOverworkDays} consecutive days.`,
        timestamp: now,
        trend: 'increasing',
        recommendations: [
          'Schedule mandatory breaks throughout the day',
          'Set strict work hour boundaries',
          'Delegate tasks when possible',
          'Consider taking a day off to recover'
        ],
        threshold: this.WARNING_THRESHOLDS.BURNOUT_RISK.hoursPerDay,
        currentValue: avgDailyHours
      })
    }

    // Poor focus warning
    const poorFocusDays = this.calculatePoorFocusDays(trends)
    if (poorFocusDays >= this.WARNING_THRESHOLDS.POOR_FOCUS.days) {
      warnings.push({
        id: `poor_focus_${now}`,
        type: 'poor_focus',
        severity: poorFocusDays >= 7 ? 'high' : 'medium',
        title: 'Persistent Focus Issues',
        description: `You\'ve had below-average focus for ${poorFocusDays} out of the last 7 days.`,
        timestamp: now,
        trend: 'stable',
        recommendations: [
          'Review your sleep schedule',
          'Minimize multitasking',
          'Try meditation or mindfulness exercises',
          'Optimize your work environment for focus'
        ],
        threshold: this.WARNING_THRESHOLDS.POOR_FOCUS.threshold,
        currentValue: avgFocusScore
      })
    }

    return warnings
  }

  async generateActionableRecommendations(insights: ProductivityInsight[]): Promise<string[]> {
    const recommendations: string[] = []
    const insightTypes = new Set(insights.map(insight => insight.type))

    // Focus improvement recommendations
    if (insightTypes.has('focus_improvement')) {
      recommendations.push(
        'Schedule 25-minute focused work blocks with 5-minute breaks',
        'Use website blockers during focus sessions',
        'Turn off notifications during deep work periods'
      )
    }

    // Time management recommendations
    if (insightTypes.has('break_suggestion')) {
      recommendations.push(
        'Use time-blocking to allocate specific hours for different tasks',
        'Batch similar activities together to reduce context switching',
        'Set realistic daily goals and track progress'
      )
    }

    // Break pattern recommendations
    if (insightTypes.has('break_suggestion')) {
      recommendations.push(
        'Take a 15-minute walk every 2 hours',
        'Practice the 20-20-20 rule for eye strain',
        'Schedule longer breaks for meals and relaxation'
      )
    }

    // App usage recommendations
    if (insightTypes.has('app_recommendation')) {
      recommendations.push(
        'Review and optimize your most-used applications',
        'Consider alternatives for time-consuming apps',
        'Set app usage limits for distracting applications'
      )
    }

    return recommendations
  }

  private async generatePatternInsights(activities: ActivityRecord[]): Promise<ProductivityInsight[]> {
    const insights: ProductivityInsight[] = []
    // const patterns = await this.productivityCalculator.analyzeWorkPatterns(activities)

    // Analyze peak productivity patterns
    const peakHours = this.findPeakProductivityHours(activities)
    if (peakHours.length > 0) {
      insights.push({
        id: `peak_hours_${Date.now()}`,
        type: 'peak_hours',
        title: 'Peak Productivity Hours Identified',
        description: `Your most productive hours are ${peakHours.join(', ')}. Schedule important tasks during these times.`,
        actionable: true,
        priority: 'medium',
        timestamp: Date.now()
      })
    }

    return insights
  }

  private async generateTrendInsights(trends: ProductivityTrend[]): Promise<ProductivityInsight[]> {
    const insights: ProductivityInsight[] = []

    if (trends.length < 3) return insights

    // Analyze productivity trends
    const recentTrend = this.calculateTrendDirection(trends.slice(-3))
    if (recentTrend === 'improving') {
      insights.push({
        id: `trend_improving_${Date.now()}`,
        type: 'focus_improvement',
        title: 'Productivity Improving',
        description: 'Your productivity has been steadily improving over the last 3 days. Keep up the great work!',
        actionable: false,
        priority: 'low',
        timestamp: Date.now()
      })
    } else if (recentTrend === 'declining') {
      insights.push({
        id: `trend_declining_${Date.now()}`,
        type: 'break_suggestion',
        title: 'Productivity Declining',
        description: 'Your productivity has been declining. Consider reviewing your work habits and taking breaks.',
        actionable: true,
        priority: 'high',
        timestamp: Date.now()
      })
    }

    return insights
  }

  private async generateComparativeInsights(_activities: ActivityRecord[], trends: ProductivityTrend[]): Promise<ProductivityInsight[]> {
    const insights: ProductivityInsight[] = []

    // Compare with historical averages
    const currentAvg = trends.reduce((sum, trend) => sum + trend.productivityScore, 0) / trends.length
    const historicalAvg = await this.getHistoricalAverage(30) // Last 30 days

    if (currentAvg > historicalAvg * 1.1) {
      insights.push({
        id: `above_average_${Date.now()}`,
        type: 'focus_improvement',
        title: 'Above Average Performance',
        description: `Your current productivity is ${((currentAvg / historicalAvg - 1) * 100).toFixed(1)}% higher than your 30-day average.`,
        actionable: false,
        priority: 'low',
        timestamp: Date.now()
      })
    }

    return insights
  }

  private async generateOptimizationInsights(activities: ActivityRecord[]): Promise<ProductivityInsight[]> {
    const insights: ProductivityInsight[] = []

    // Analyze app switching patterns
    const contextSwitches = this.analytics.detectContextSwitches(activities)
    const hourlyRate = contextSwitches / (activities.length > 0 ? 
      (activities[activities.length - 1].timestamp - activities[0].timestamp) / 3600000 : 1)

    if (hourlyRate > 20) {
      insights.push({
        id: `high_switching_${Date.now()}`,
        type: 'distraction_pattern',
        title: 'High Context Switching',
        description: `You\'re switching between apps ${hourlyRate.toFixed(1)} times per hour. Consider batching similar tasks.`,
        actionable: true,
        priority: 'medium',
        timestamp: Date.now()
      })
    }

    return insights
  }

  // Helper methods
  private calculateConsistentDays(trends: ProductivityTrend[]): number {
    let consistentDays = 0
    const threshold = 0.6 // 60% productivity threshold
    
    for (let i = trends.length - 1; i >= 0; i--) {
      if (trends[i].productivityScore >= threshold) {
        consistentDays++
      } else {
        break
      }
    }
    
    return consistentDays
  }

  private calculateEfficiencyImprovement(trends: ProductivityTrend[]): number {
    if (trends.length < 2) return 0
    
    const recent = trends.slice(-3).reduce((sum, trend) => sum + trend.productivityScore, 0) / 3
    const previous = trends.slice(-6, -3).reduce((sum, trend) => sum + trend.productivityScore, 0) / 3
    
    return recent - previous
  }

  private calculateProductivityDecline(trends: ProductivityTrend[]): number {
    if (trends.length < this.WARNING_THRESHOLDS.DECLINING_PRODUCTIVITY.days) return 0
    
    const recent = trends.slice(-this.WARNING_THRESHOLDS.DECLINING_PRODUCTIVITY.days)
    const baseline = trends.slice(-7, -this.WARNING_THRESHOLDS.DECLINING_PRODUCTIVITY.days)
    
    if (baseline.length === 0) return 0
    
    const recentAvg = recent.reduce((sum, trend) => sum + trend.productivityScore, 0) / recent.length
    const baselineAvg = baseline.reduce((sum, trend) => sum + trend.productivityScore, 0) / baseline.length
    
    return Math.max(0, baselineAvg - recentAvg)
  }

  private calculateAverageContextSwitches(activities: ActivityRecord[]): number {
    if (activities.length === 0) return 0
    
    const contextSwitches = this.analytics.detectContextSwitches(activities)
    const hours = (activities[activities.length - 1].timestamp - activities[0].timestamp) / 3600000
    
    return hours > 0 ? contextSwitches / hours : 0
  }

  private calculateAverageDailyHours(activities: ActivityRecord[]): number {
    if (activities.length === 0) return 0
    
    const totalTime = activities.reduce((sum, activity) => sum + activity.duration, 0)
    const days = Math.max(1, (activities[activities.length - 1].timestamp - activities[0].timestamp) / 86400000)
    
    return (totalTime / 3600000) / days
  }

  private calculateConsecutiveOverworkDays(trends: ProductivityTrend[]): number {
    let consecutiveDays = 0
    const overworkThreshold = 10 // 10 hours per day
    
    for (let i = trends.length - 1; i >= 0; i--) {
      if (trends[i].totalActiveTime > overworkThreshold * 3600000) {
        consecutiveDays++
      } else {
        break
      }
    }
    
    return consecutiveDays
  }

  private calculatePoorFocusDays(trends: ProductivityTrend[]): number {
    const threshold = this.WARNING_THRESHOLDS.POOR_FOCUS.threshold
    return trends.slice(-7).filter(trend => trend.focusScore < threshold).length
  }

  private findPeakProductivityHours(activities: ActivityRecord[]): string[] {
    const hourlyProductivity = new Map<number, number>()
    
    activities.forEach(activity => {
      const hour = new Date(activity.timestamp).getHours()
      const current = hourlyProductivity.get(hour) || 0
      hourlyProductivity.set(hour, current + (activity.focusScore || 0))
    })
    
    const sortedHours = Array.from(hourlyProductivity.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => `${hour}:00-${hour + 1}:00`)
    
    return sortedHours
  }

  private calculateTrendDirection(trends: ProductivityTrend[]): 'improving' | 'declining' | 'stable' {
    if (trends.length < 2) return 'stable'
    
    const first = trends[0].productivityScore
    const last = trends[trends.length - 1].productivityScore
    const change = (last - first) / first
    
    if (change > 0.1) return 'improving'
    if (change < -0.1) return 'declining'
    return 'stable'
  }

  private async getHistoricalAverage(days: number): Promise<number> {
    try {
      const trends = await this.productivityCalculator.getProductivityTrends(days)
      return trends.reduce((sum, trend) => sum + trend.productivityScore, 0) / trends.length
    } catch (error) {
      console.error('Failed to get historical average:', error)
      return 0.5 // Default average
    }
  }
}

// export type { InsightGenerator } - already exported with class declaration