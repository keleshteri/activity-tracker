<template>
  <div class="productivity-charts">
    <div class="charts-header">
      <h2>Productivity Analytics</h2>
      <div class="chart-controls">
        <select v-model="selectedTimeRange" @change="loadChartData" class="time-range-select">
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="quarter">Last 3 Months</option>
        </select>
        <button @click="exportCharts" class="btn btn-secondary">
          <i class="icon-download"></i>
          Export
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading productivity data...</p>
    </div>

    <!-- Charts Grid -->
    <div v-else class="charts-grid">
      <!-- Productivity Trend Chart -->
      <div class="chart-container">
        <div class="chart-header">
          <h3>Productivity Trend</h3>
          <div class="chart-info">
            <span class="trend-indicator" :class="productivityTrend">
              <i :class="getTrendIcon(productivityTrend)"></i>
              {{ formatTrendText(productivityTrend) }}
            </span>
          </div>
        </div>
        <div class="chart-wrapper">
          <Line
            :data="productivityTrendData"
            :options="productivityTrendOptions"
            :height="300"
          />
        </div>
      </div>

      <!-- Focus vs Distraction Timeline -->
      <div class="chart-container">
        <div class="chart-header">
          <h3>Focus vs Distraction Timeline</h3>
          <div class="timeline-stats">
            <span class="focus-time">Focus: {{ formatDuration(totalFocusTime) }}</span>
            <span class="distraction-time">Distractions: {{ formatDuration(totalDistractionTime) }}</span>
          </div>
        </div>
        <div class="chart-wrapper">
          <Bar
            :data="focusDistractionData"
            :options="focusDistractionOptions"
            :height="300"
          />
        </div>
      </div>

      <!-- Weekly Productivity Comparison -->
      <div class="chart-container full-width">
        <div class="chart-header">
          <h3>Weekly Productivity Comparison</h3>
          <div class="comparison-stats">
            <span class="avg-score">Avg Score: {{ averageProductivityScore.toFixed(1) }}%</span>
            <span class="best-day">Best Day: {{ bestProductivityDay }}</span>
          </div>
        </div>
        <div class="chart-wrapper">
          <Bar
            :data="weeklyComparisonData"
            :options="weeklyComparisonOptions"
            :height="400"
          />
        </div>
      </div>

      <!-- Peak Hours Heatmap -->
      <div class="chart-container">
        <div class="chart-header">
          <h3>Peak Productivity Hours</h3>
          <div class="peak-info">
            <span class="peak-hours">Peak: {{ peakHours.join(', ') }}</span>
          </div>
        </div>
        <div class="chart-wrapper">
          <Doughnut
            :data="peakHoursData"
            :options="peakHoursOptions"
            :height="300"
          />
        </div>
      </div>

      <!-- Monthly Trends -->
      <div class="chart-container">
        <div class="chart-header">
          <h3>Monthly Productivity Trends</h3>
          <div class="monthly-stats">
            <span class="monthly-avg">Monthly Avg: {{ monthlyAverage.toFixed(1) }}%</span>
            <span class="monthly-growth">Growth: {{ monthlyGrowth }}%</span>
          </div>
        </div>
        <div class="chart-wrapper">
          <Line
            :data="monthlyTrendsData"
            :options="monthlyTrendsOptions"
            :height="300"
          />
        </div>
      </div>
    </div>

    <!-- Insights Panel -->
    <div class="insights-panel">
      <h3>Chart Insights</h3>
      <div class="insights-list">
        <div v-for="insight in chartInsights" :key="insight.id" class="insight-item" :class="insight.type">
          <div class="insight-icon">
            <i :class="getInsightIcon(insight.type)"></i>
          </div>
          <div class="insight-content">
            <h4>{{ insight.title }}</h4>
            <p>{{ insight.description }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line, Bar, Doughnut } from 'vue-chartjs'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface ProductivityData {
  date: string
  productivityScore: number
  focusTime: number
  distractionTime: number
  activeTime: number
}

interface ChartInsight {
  id: string
  type: 'positive' | 'negative' | 'neutral' | 'warning'
  title: string
  description: string
}

const selectedTimeRange = ref('week')
const loading = ref(true)
const productivityData = ref<ProductivityData[]>([])
const chartInsights = ref<ChartInsight[]>([])

// Computed properties for chart data
const productivityTrendData = computed(() => ({
  labels: productivityData.value.map(d => formatDateLabel(d.date)),
  datasets: [
    {
      label: 'Productivity Score',
      data: productivityData.value.map(d => d.productivityScore),
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#6366f1',
      pointBorderColor: '#ffffff',
      pointBorderWidth: 2,
      pointRadius: 6,
      pointHoverRadius: 8
    }
  ]
}))

const focusDistractionData = computed(() => ({
  labels: productivityData.value.map(d => formatDateLabel(d.date)),
  datasets: [
    {
      label: 'Focus Time',
      data: productivityData.value.map(d => d.focusTime / 3600), // Convert to hours
      backgroundColor: '#10b981',
      borderColor: '#059669',
      borderWidth: 1
    },
    {
      label: 'Distraction Time',
      data: productivityData.value.map(d => d.distractionTime / 3600), // Convert to hours
      backgroundColor: '#ef4444',
      borderColor: '#dc2626',
      borderWidth: 1
    }
  ]
}))

const weeklyComparisonData = computed(() => {
  const weeklyData = groupDataByWeek(productivityData.value)
  return {
    labels: weeklyData.map(w => `Week ${w.week}`),
    datasets: [
      {
        label: 'Average Productivity',
        data: weeklyData.map(w => w.avgProductivity),
        backgroundColor: 'rgba(99, 102, 241, 0.8)',
        borderColor: '#6366f1',
        borderWidth: 2,
        borderRadius: 4
      },
      {
        label: 'Focus Hours',
        data: weeklyData.map(w => w.totalFocusHours),
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderColor: '#10b981',
        borderWidth: 2,
        borderRadius: 4
      }
    ]
  }
})

const peakHoursData = computed(() => {
  const hourlyProductivity = calculateHourlyProductivity(productivityData.value)
  const topHours = Object.entries(hourlyProductivity)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 6)
  
  return {
    labels: topHours.map(([hour]) => `${hour}:00`),
    datasets: [
      {
        data: topHours.map(([,productivity]) => productivity),
        backgroundColor: [
          '#6366f1',
          '#8b5cf6',
          '#06b6d4',
          '#10b981',
          '#f59e0b',
          '#ef4444'
        ],
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    ]
  }
})

const monthlyTrendsData = computed(() => {
  const monthlyData = groupDataByMonth(productivityData.value)
  return {
    labels: monthlyData.map(m => m.month),
    datasets: [
      {
        label: 'Monthly Average',
        data: monthlyData.map(m => m.avgProductivity),
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  }
})

// Chart options
const productivityTrendOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      titleColor: '#ffffff',
      bodyColor: '#ffffff',
      borderColor: '#6366f1',
      borderWidth: 1
    }
  },
  scales: {
    x: {
      grid: {
        display: false
      },
      ticks: {
        color: '#6b7280'
      }
    },
    y: {
      beginAtZero: true,
      max: 100,
      grid: {
        color: 'rgba(107, 114, 128, 0.1)'
      },
      ticks: {
        color: '#6b7280',
        callback: function(value: any) {
          return value + '%'
        }
      }
    }
  },
  interaction: {
    mode: 'nearest' as const,
    axis: 'x' as const,
    intersect: false
  }
}

const focusDistractionOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false
    }
  },
  scales: {
    x: {
      grid: {
        display: false
      }
    },
    y: {
      beginAtZero: true,
      ticks: {
        callback: function(value: any) {
          return value + 'h'
        }
      }
    }
  }
}

const weeklyComparisonOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const
    }
  },
  scales: {
    x: {
      grid: {
        display: false
      }
    },
    y: {
      beginAtZero: true
    }
  }
}

const peakHoursOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' as const
    }
  }
}

const monthlyTrendsOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    }
  },
  scales: {
    x: {
      grid: {
        display: false
      }
    },
    y: {
      beginAtZero: true,
      max: 100,
      ticks: {
        callback: function(value: any) {
          return value + '%'
        }
      }
    }
  }
}

// Computed stats
const productivityTrend = computed(() => {
  if (productivityData.value.length < 2) return 'neutral'
  const recent = productivityData.value.slice(-3)
  const older = productivityData.value.slice(-6, -3)
  const recentAvg = recent.reduce((sum, d) => sum + d.productivityScore, 0) / recent.length
  const olderAvg = older.reduce((sum, d) => sum + d.productivityScore, 0) / older.length
  
  if (recentAvg > olderAvg + 5) return 'positive'
  if (recentAvg < olderAvg - 5) return 'negative'
  return 'neutral'
})

const totalFocusTime = computed(() => 
  productivityData.value.reduce((sum, d) => sum + d.focusTime, 0)
)

const totalDistractionTime = computed(() => 
  productivityData.value.reduce((sum, d) => sum + d.distractionTime, 0)
)

const averageProductivityScore = computed(() => {
  if (productivityData.value.length === 0) return 0
  return productivityData.value.reduce((sum, d) => sum + d.productivityScore, 0) / productivityData.value.length
})

const bestProductivityDay = computed(() => {
  if (productivityData.value.length === 0) return 'N/A'
  const best = productivityData.value.reduce((max, d) => 
    d.productivityScore > max.productivityScore ? d : max
  )
  return formatDateLabel(best.date)
})

const peakHours = computed(() => {
  const hourlyProductivity = calculateHourlyProductivity(productivityData.value)
  return Object.entries(hourlyProductivity)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([hour]) => `${hour}:00`)
})

const monthlyAverage = computed(() => {
  const monthlyData = groupDataByMonth(productivityData.value)
  if (monthlyData.length === 0) return 0
  return monthlyData.reduce((sum, m) => sum + m.avgProductivity, 0) / monthlyData.length
})

const monthlyGrowth = computed(() => {
  const monthlyData = groupDataByMonth(productivityData.value)
  if (monthlyData.length < 2) return 0
  const latest = monthlyData[monthlyData.length - 1]
  const previous = monthlyData[monthlyData.length - 2]
  return ((latest.avgProductivity - previous.avgProductivity) / previous.avgProductivity * 100).toFixed(1)
})

// Helper functions
const formatDateLabel = (date: string): string => {
  const d = new Date(date)
  if (selectedTimeRange.value === 'today') {
    return d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

const formatTrendText = (trend: string): string => {
  switch (trend) {
    case 'positive': return 'Improving'
    case 'negative': return 'Declining'
    default: return 'Stable'
  }
}

const getTrendIcon = (trend: string): string => {
  switch (trend) {
    case 'positive': return 'icon-trend-up'
    case 'negative': return 'icon-trend-down'
    default: return 'icon-minus'
  }
}

const getInsightIcon = (type: string): string => {
  switch (type) {
    case 'positive': return 'icon-check-circle'
    case 'negative': return 'icon-alert-circle'
    case 'warning': return 'icon-alert-triangle'
    default: return 'icon-info'
  }
}

const groupDataByWeek = (data: ProductivityData[]) => {
  const weeks = new Map()
  data.forEach(d => {
    const date = new Date(d.date)
    const week = getWeekNumber(date)
    if (!weeks.has(week)) {
      weeks.set(week, { week, data: [] })
    }
    weeks.get(week).data.push(d)
  })
  
  return Array.from(weeks.values()).map(w => ({
    week: w.week,
    avgProductivity: w.data.reduce((sum: number, d: ProductivityData) => sum + d.productivityScore, 0) / w.data.length,
    totalFocusHours: w.data.reduce((sum: number, d: ProductivityData) => sum + d.focusTime, 0) / 3600
  }))
}

const groupDataByMonth = (data: ProductivityData[]) => {
  const months = new Map()
  data.forEach(d => {
    const date = new Date(d.date)
    const month = date.toLocaleDateString('en', { month: 'short', year: 'numeric' })
    if (!months.has(month)) {
      months.set(month, [])
    }
    months.get(month).push(d)
  })
  
  return Array.from(months.entries()).map(([month, data]) => ({
    month,
    avgProductivity: data.reduce((sum: number, d: ProductivityData) => sum + d.productivityScore, 0) / data.length
  }))
}

const calculateHourlyProductivity = (data: ProductivityData[]) => {
  const hourlyData = new Map()
  data.forEach(d => {
    const hour = new Date(d.date).getHours()
    if (!hourlyData.has(hour)) {
      hourlyData.set(hour, [])
    }
    hourlyData.get(hour).push(d.productivityScore)
  })
  
  const result: Record<number, number> = {}
  hourlyData.forEach((scores, hour) => {
    result[hour] = scores.reduce((sum: number, score: number) => sum + score, 0) / scores.length
  })
  
  return result
}

const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

const loadChartData = async () => {
  loading.value = true
  try {
    // Mock data for development - replace with actual API call
    const mockData: ProductivityData[] = generateMockData(selectedTimeRange.value)
    productivityData.value = mockData
    
    // Generate insights based on data
    chartInsights.value = generateChartInsights(mockData)
    
    // TODO: Replace with actual API call
    // const data = await window.electronAPI.invoke('analytics:getProductivityData', {
    //   timeRange: selectedTimeRange.value
    // })
    // productivityData.value = data
  } catch (error) {
    console.error('Failed to load chart data:', error)
  } finally {
    loading.value = false
  }
}

const generateMockData = (timeRange: string): ProductivityData[] => {
  const data: ProductivityData[] = []
  const now = new Date()
  let days = 7
  
  switch (timeRange) {
    case 'today':
      days = 1
      break
    case 'week':
      days = 7
      break
    case 'month':
      days = 30
      break
    case 'quarter':
      days = 90
      break
  }
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    
    data.push({
      date: date.toISOString().split('T')[0],
      productivityScore: Math.random() * 40 + 60, // 60-100%
      focusTime: Math.random() * 14400 + 7200, // 2-6 hours
      distractionTime: Math.random() * 3600 + 1800, // 30min-1.5h
      activeTime: Math.random() * 28800 + 14400 // 4-12 hours
    })
  }
  
  return data
}

const generateChartInsights = (data: ProductivityData[]): ChartInsight[] => {
  const insights: ChartInsight[] = []
  
  // Productivity trend insight
  const avgProductivity = data.reduce((sum, d) => sum + d.productivityScore, 0) / data.length
  if (avgProductivity > 80) {
    insights.push({
      id: '1',
      type: 'positive',
      title: 'Excellent Productivity',
      description: `Your average productivity score of ${avgProductivity.toFixed(1)}% is excellent!`
    })
  } else if (avgProductivity < 60) {
    insights.push({
      id: '2',
      type: 'warning',
      title: 'Room for Improvement',
      description: `Your productivity average is ${avgProductivity.toFixed(1)}%. Consider reviewing your work patterns.`
    })
  }
  
  // Focus time insight
  const avgFocusTime = data.reduce((sum, d) => sum + d.focusTime, 0) / data.length
  if (avgFocusTime > 4 * 3600) { // More than 4 hours
    insights.push({
      id: '3',
      type: 'positive',
      title: 'Great Focus Duration',
      description: `You're maintaining an average of ${formatDuration(avgFocusTime)} of focused work daily.`
    })
  }
  
  return insights
}

const exportCharts = async () => {
  try {
    // TODO: Implement chart export functionality
    console.log('Exporting charts...')
  } catch (error) {
    console.error('Failed to export charts:', error)
  }
}

onMounted(() => {
  loadChartData()
})
</script>

<style scoped>
.productivity-charts {
  max-width: 1400px;
  margin: 0 auto;
  padding: 1.5rem;
}

.charts-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--ev-c-gray-3);
}

.charts-header h2 {
  margin: 0;
  color: var(--ev-c-text-1);
  font-size: 1.75rem;
  font-weight: 600;
}

.chart-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.time-range-select {
  padding: 0.5rem 1rem;
  border: 1px solid var(--ev-c-gray-3);
  border-radius: 0.5rem;
  background: var(--color-background);
  color: var(--ev-c-text-1);
  font-size: 0.875rem;
}

.btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: var(--color-background-soft);
  color: var(--ev-c-text-1);
  border: 1px solid var(--ev-c-gray-3);
}

.btn-secondary:hover {
  background: var(--ev-c-gray-2);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  color: var(--ev-c-text-2);
}

.spinner {
  width: 2rem;
  height: 2rem;
  border: 2px solid var(--ev-c-gray-3);
  border-top: 2px solid var(--ev-c-brand);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
}

.chart-container {
  background: var(--color-background);
  border: 1px solid var(--ev-c-gray-3);
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.chart-container.full-width {
  grid-column: 1 / -1;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.chart-header h3 {
  margin: 0;
  color: var(--ev-c-text-1);
  font-size: 1.25rem;
  font-weight: 600;
}

.chart-info,
.timeline-stats,
.comparison-stats,
.peak-info,
.monthly-stats {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.875rem;
}

.trend-indicator {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  font-weight: 500;
}

.trend-indicator.positive {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
}

.trend-indicator.negative {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.trend-indicator.neutral {
  background: rgba(107, 114, 128, 0.1);
  color: #6b7280;
}

.focus-time {
  color: #10b981;
  font-weight: 500;
}

.distraction-time {
  color: #ef4444;
  font-weight: 500;
}

.chart-wrapper {
  position: relative;
  height: 300px;
}

.chart-container.full-width .chart-wrapper {
  height: 400px;
}

.insights-panel {
  background: var(--color-background);
  border: 1px solid var(--ev-c-gray-3);
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.insights-panel h3 {
  margin: 0 0 1rem 0;
  color: var(--ev-c-text-1);
  font-size: 1.25rem;
  font-weight: 600;
}

.insights-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.insight-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem;
  border-radius: 0.5rem;
  border-left: 4px solid;
}

.insight-item.positive {
  background: rgba(16, 185, 129, 0.05);
  border-left-color: #10b981;
}

.insight-item.negative {
  background: rgba(239, 68, 68, 0.05);
  border-left-color: #ef4444;
}

.insight-item.warning {
  background: rgba(245, 158, 11, 0.05);
  border-left-color: #f59e0b;
}

.insight-item.neutral {
  background: rgba(107, 114, 128, 0.05);
  border-left-color: #6b7280;
}

.insight-icon {
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
}

.insight-content h4 {
  margin: 0 0 0.5rem 0;
  color: var(--ev-c-text-1);
  font-size: 1rem;
  font-weight: 600;
}

.insight-content p {
  margin: 0;
  color: var(--ev-c-text-2);
  font-size: 0.875rem;
  line-height: 1.5;
}

/* Icon classes - replace with your actual icon system */
.icon-download::before { content: '⬇️'; }
.icon-trend-up::before { content: '📈'; }
.icon-trend-down::before { content: '📉'; }
.icon-minus::before { content: '➖'; }
.icon-check-circle::before { content: '✅'; }
.icon-alert-circle::before { content: '🔴'; }
.icon-alert-triangle::before { content: '⚠️'; }
.icon-info::before { content: 'ℹ️'; }
</style>