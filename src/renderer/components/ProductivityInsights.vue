<template>
  <div class="productivity-insights">
    <div class="header">
      <h2>Productivity Insights</h2>
      <div class="actions">
        <button @click="refreshInsights" class="btn btn-secondary" :disabled="loading">
          <i class="icon-refresh"></i>
          Refresh
        </button>
        <button @click="generateReport" class="btn btn-primary">
          <i class="icon-report"></i>
          Generate Report
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Analyzing your productivity patterns...</p>
    </div>

    <!-- Insights Grid -->
    <div v-else class="insights-grid">
      <!-- Key Metrics -->
      <div class="metrics-section">
        <h3>Key Metrics</h3>
        <div class="metrics-cards">
          <div class="metric-card">
            <div class="metric-value">{{ formatScore(averageProductivity) }}%</div>
            <div class="metric-label">Average Productivity</div>
            <div class="metric-trend" :class="productivityTrend">
              <i :class="getTrendIcon(productivityTrend)"></i>
              {{ formatTrend(productivityChange) }}
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-value">{{ formatScore(averageFocus) }}%</div>
            <div class="metric-label">Focus Score</div>
            <div class="metric-trend" :class="focusTrend">
              <i :class="getTrendIcon(focusTrend)"></i>
              {{ formatTrend(focusChange) }}
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-value">{{ formatDuration(totalActiveTime) }}</div>
            <div class="metric-label">Active Time Today</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">{{ distractionCount }}</div>
            <div class="metric-label">Distractions</div>
            <div class="metric-trend" :class="distractionTrend">
              <i :class="getTrendIcon(distractionTrend, true)"></i>
              {{ formatTrend(distractionChange, true) }}
            </div>
          </div>
        </div>
      </div>

      <!-- AI Insights -->
      <div class="ai-insights-section">
        <h3>AI-Generated Insights</h3>
        <div class="insights-list">
          <div v-for="insight in insights" :key="insight.id" class="insight-card" :class="insight.priority">
            <div class="insight-header">
              <div class="insight-type">{{ getInsightTypeLabel(insight.type) }}</div>
              <div class="insight-priority">{{ insight.priority }}</div>
            </div>
            <h4 class="insight-title">{{ insight.title }}</h4>
            <p class="insight-description">{{ insight.description }}</p>
            <div v-if="insight.actionable" class="insight-actions">
              <button @click="applyRecommendation(insight)" class="btn btn-sm btn-primary">
                Apply Recommendation
              </button>
              <button @click="dismissInsight(insight.id)" class="btn btn-sm btn-secondary">
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Recommendations -->
      <div class="recommendations-section">
        <h3>Personalized Recommendations</h3>
        <div class="recommendations-list">
          <div v-for="(recommendation, index) in recommendations" :key="index" class="recommendation-card">
            <div class="recommendation-icon">
              <i :class="getRecommendationIcon(recommendation.type)"></i>
            </div>
            <div class="recommendation-content">
              <h4>{{ recommendation.title }}</h4>
              <p>{{ recommendation.description }}</p>
              <div class="recommendation-impact">
                Expected impact: <span class="impact-level">{{ recommendation.impact }}</span>
              </div>
            </div>
            <div class="recommendation-actions">
              <button @click="implementRecommendation(recommendation)" class="btn btn-sm btn-success">
                Implement
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Achievements -->
      <div class="achievements-section">
        <h3>Recent Achievements</h3>
        <div class="achievements-grid">
          <div v-for="achievement in achievements" :key="achievement.id" class="achievement-card">
            <div class="achievement-badge">{{ achievement.badge }}</div>
            <div class="achievement-content">
              <h4>{{ achievement.title }}</h4>
              <p>{{ achievement.description }}</p>
              <div class="achievement-date">{{ formatDate(achievement.timestamp) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">

// Interface definitions
interface Insight {
  id: string
  type: string
  priority: string
  title: string
  description: string
  timestamp: number
  score: number
  actionable?: boolean
  impact?: string
  badge?: string
}

interface DashboardData {
  today?: {
    productivityScore?: number
    focusScore?: number
    activeTime?: number
    distractions?: {
      count?: number
    }
  }
}

export default {
  name: 'ProductivityInsights',
  data() {
    return {
      loading: false,
      insights: [] as Insight[],
      recommendations: [] as Insight[],
      achievements: [] as Insight[],
      averageProductivity: 0,
      averageFocus: 0,
      totalActiveTime: 0,
      distractionCount: 0,
      productivityTrend: 'stable' as 'up' | 'down' | 'stable',
      focusTrend: 'stable' as 'up' | 'down' | 'stable',
      distractionTrend: 'stable' as 'up' | 'down' | 'stable',
      productivityChange: 0,
      focusChange: 0,
      distractionChange: 0
    }
  },
  async mounted() {
    await this.loadInsights()
  },
  methods: {
    async loadInsights() {
      this.loading = true
      try {
        // Check if electronAPI is available (Electron mode vs web preview mode)
        if (window.electronAPI && window.electronAPI.invoke) {
          // Load productivity insights
          const productivityInsights = await window.electronAPI.invoke('insights:get-productivity', 10) as any[]
          
          // Load general insights
          const allInsights = await window.electronAPI.invoke('insights:get-all', null, 20) as any[]
          
          // Generate new insights for current time range
          const timeRange = {
            start: Date.now() - (7 * 24 * 60 * 60 * 1000), // Last 7 days
            end: Date.now()
          }
          const generatedInsights = await window.electronAPI.invoke('insights:generate', timeRange) as any[]
          
          this.insights = [...productivityInsights, ...allInsights, ...generatedInsights]
          
          // Load dashboard data for metrics
          const dashboardData = await window.electronAPI.invoke('dashboard:get-data') as DashboardData
          this.updateMetrics(dashboardData)
        } else {
          // Fallback mock data for web preview mode
          this.insights = this.getMockInsights()
          this.updateMetrics(this.getMockDashboardData())
        }
        
        // Extract recommendations and achievements
        this.recommendations = this.insights.filter(insight => insight.type === 'recommendation').slice(0, 5)
        this.achievements = this.insights.filter(insight => insight.type === 'achievement').slice(0, 6)
        
      } catch (error) {
        console.error('Failed to load insights:', error)
        // Fallback to mock data on error
        this.insights = this.getMockInsights()
        this.updateMetrics(this.getMockDashboardData())
        this.recommendations = this.insights.filter(insight => insight.type === 'recommendation').slice(0, 5)
        this.achievements = this.insights.filter(insight => insight.type === 'achievement').slice(0, 6)
      } finally {
        this.loading = false
      }
    },
    
    updateMetrics(dashboardData: DashboardData) {
      if (dashboardData && dashboardData.today) {
        this.averageProductivity = dashboardData.today.productivityScore || 0
        this.averageFocus = dashboardData.today.focusScore || 0
        this.totalActiveTime = dashboardData.today.activeTime || 0
        this.distractionCount = dashboardData.today.distractions?.count || 0
        
        // Calculate trends (simplified)
        this.productivityTrend = this.averageProductivity > 70 ? 'up' : this.averageProductivity < 50 ? 'down' : 'stable'
        this.focusTrend = this.averageFocus > 70 ? 'up' : this.averageFocus < 50 ? 'down' : 'stable'
        this.distractionTrend = this.distractionCount < 5 ? 'up' : this.distractionCount > 15 ? 'down' : 'stable'
      }
    },
    
    async refreshInsights() {
      await this.loadInsights()
    },
    
    async generateReport() {
      try {
        // TODO: Implement report generation
        console.log('Generating productivity report...')
      } catch (error) {
        console.error('Failed to generate report:', error)
      }
    },
    
    async applyRecommendation(insight: Insight) {
      try {
        // TODO: Implement recommendation application
        console.log('Applying recommendation:', insight.title)
      } catch (error) {
        console.error('Failed to apply recommendation:', error)
      }
    },
    
    async dismissInsight(insightId: string) {
      try {
        // TODO: Implement insight dismissal
        this.insights = this.insights.filter(insight => insight.id !== insightId)
      } catch (error) {
        console.error('Failed to dismiss insight:', error)
      }
    },
    
    async implementRecommendation(recommendation: Insight) {
      try {
        // TODO: Implement recommendation implementation
        console.log('Implementing recommendation:', recommendation.title)
      } catch (error) {
        console.error('Failed to implement recommendation:', error)
      }
    },
    
    formatScore(score: number) {
      return Math.round(score * 100)
    },
    
    formatDuration(ms: number) {
      const hours = Math.floor(ms / (1000 * 60 * 60))
      const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
      return `${hours}h ${minutes}m`
    },
    
    formatTrend(change: number, inverse = false) {
      const absChange = Math.abs(change)
      const direction = inverse ? (change > 0 ? 'down' : 'up') : (change > 0 ? 'up' : 'down')
      return `${absChange.toFixed(1)}% ${direction}`
    },
    
    formatDate(timestamp: number) {
      return new Date(timestamp).toLocaleDateString()
    },
    
    getTrendIcon(trend: 'up' | 'down' | 'stable', inverse = false) {
      if (trend === 'up') return inverse ? 'icon-arrow-down' : 'icon-arrow-up'
      if (trend === 'down') return inverse ? 'icon-arrow-up' : 'icon-arrow-down'
      return 'icon-minus'
    },
    
    getInsightTypeLabel(type: string) {
      const labels: Record<string, string> = {
        pattern: 'Pattern',
        recommendation: 'Recommendation',
        achievement: 'Achievement',
        warning: 'Warning'
      }
      return labels[type] || type
    },
    
    getRecommendationIcon(type: string) {
      const icons: Record<string, string> = {
        focus: 'icon-target',
        break: 'icon-clock',
        app: 'icon-app',
        time: 'icon-calendar'
      }
      return icons[type] || 'icon-lightbulb'
    },
    
    getMockInsights(): Insight[] {
      return [
        {
          id: 'mock-1',
          type: 'achievement',
          priority: 'high',
          title: 'Great Focus Session!',
          description: 'You maintained focus for 2.5 hours straight this morning.',
          timestamp: Date.now() - 3600000,
          score: 0.95
        },
        {
          id: 'mock-2',
          type: 'recommendation',
          priority: 'medium',
          title: 'Take Regular Breaks',
          description: 'Consider taking a 5-minute break every 25 minutes to maintain productivity.',
          timestamp: Date.now() - 7200000,
          score: 0.8,
          actionable: true
        },
        {
          id: 'mock-3',
          type: 'pattern',
          priority: 'low',
          title: 'Morning Productivity Peak',
          description: 'Your productivity is consistently highest between 9-11 AM.',
          timestamp: Date.now() - 10800000,
          score: 0.75
        },
        {
          id: 'mock-4',
          type: 'warning',
          priority: 'high',
          title: 'High Distraction Period',
          description: 'You had 12 distractions in the last hour. Consider using focus mode.',
          timestamp: Date.now() - 1800000,
          score: 0.3
        },
        {
          id: 'mock-5',
          type: 'recommendation',
          priority: 'medium',
          title: 'Optimize App Usage',
          description: 'Limit social media apps during work hours to improve focus.',
          timestamp: Date.now() - 5400000,
          score: 0.7,
          actionable: true
        }
      ]
    },
    
    getMockDashboardData(): DashboardData {
      return {
        today: {
          productivityScore: 0.78,
          focusScore: 0.82,
          activeTime: 6.5 * 60 * 60 * 1000, // 6.5 hours in milliseconds
          distractions: {
            count: 8
          }
        }
      }
    }
  }
}
</script>

<style scoped>
.productivity-insights {
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header h2 {
  margin: 0;
  color: #2c3e50;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.loading-state {
  text-align: center;
  padding: 3rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.insights-grid {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.metrics-section h3,
.ai-insights-section h3,
.recommendations-section h3,
.achievements-section h3 {
  margin-bottom: 1rem;
  color: #2c3e50;
  border-bottom: 2px solid #3498db;
  padding-bottom: 0.5rem;
}

.metrics-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.metric-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  text-align: center;
}

.metric-value {
  font-size: 2rem;
  font-weight: bold;
  color: #3498db;
  margin-bottom: 0.5rem;
}

.metric-label {
  font-size: 0.9rem;
  color: #7f8c8d;
  margin-bottom: 0.5rem;
}

.metric-trend {
  font-size: 0.8rem;
  font-weight: 500;
}

.metric-trend.improving { color: #27ae60; }
.metric-trend.declining { color: #e74c3c; }
.metric-trend.stable { color: #f39c12; }

.insights-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.insight-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  border-left: 4px solid #3498db;
}

.insight-card.high { border-left-color: #e74c3c; }
.insight-card.medium { border-left-color: #f39c12; }
.insight-card.low { border-left-color: #27ae60; }

.insight-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.insight-type {
  font-size: 0.8rem;
  color: #7f8c8d;
  text-transform: uppercase;
  font-weight: 500;
}

.insight-priority {
  font-size: 0.8rem;
  padding: 0.2rem 0.5rem;
  border-radius: 12px;
  background: #ecf0f1;
  color: #2c3e50;
}

.insight-title {
  margin: 0 0 0.5rem 0;
  color: #2c3e50;
}

.insight-description {
  margin: 0 0 1rem 0;
  color: #7f8c8d;
  line-height: 1.5;
}

.insight-actions {
  display: flex;
  gap: 0.5rem;
}

.recommendations-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.recommendation-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.recommendation-icon {
  font-size: 2rem;
  color: #3498db;
}

.recommendation-content {
  flex: 1;
}

.recommendation-content h4 {
  margin: 0 0 0.5rem 0;
  color: #2c3e50;
}

.recommendation-content p {
  margin: 0 0 0.5rem 0;
  color: #7f8c8d;
}

.recommendation-impact {
  font-size: 0.9rem;
  color: #7f8c8d;
}

.impact-level {
  font-weight: 500;
  color: #27ae60;
}

.achievements-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.achievement-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.achievement-badge {
  font-size: 2rem;
}

.achievement-content h4 {
  margin: 0 0 0.5rem 0;
  color: #2c3e50;
}

.achievement-content p {
  margin: 0 0 0.5rem 0;
  color: #7f8c8d;
  font-size: 0.9rem;
}

.achievement-date {
  font-size: 0.8rem;
  color: #bdc3c7;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.btn-primary {
  background: #3498db;
  color: white;
}

.btn-primary:hover {
  background: #2980b9;
}

.btn-secondary {
  background: #95a5a6;
  color: white;
}

.btn-secondary:hover {
  background: #7f8c8d;
}

.btn-success {
  background: #27ae60;
  color: white;
}

.btn-success:hover {
  background: #229954;
}

.btn-sm {
  padding: 0.3rem 0.6rem;
  font-size: 0.8rem;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>