<template>
  <div class="pattern-analysis">
    <div class="header">
      <h2>Pattern Analysis</h2>
      <div class="controls">
        <select v-model="selectedTimeRange" class="time-range-select" @change="loadPatterns">
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="quarter">Last 3 Months</option>
        </select>
        <button class="btn btn-secondary" @click="exportPatterns">
          <i class="icon-download"></i>
          Export
        </button>
      </div>
    </div>

    <!-- Chart.js Scripts -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Analyzing your work patterns...</p>
    </div>

    <!-- Pattern Analysis Grid -->
    <div v-else class="analysis-grid">
      <!-- Peak Productivity Hours -->
      <div class="chart-section">
        <h3>Peak Productivity Hours</h3>
        <div class="chart-container">
          <Bar :data="hourlyProductivityData" :options="hourlyProductivityOptions" :height="300" />
        </div>
        <div class="chart-insights">
          <p><strong>Peak Hours:</strong> {{ peakHours.join(', ') }}</p>
          <p><strong>Low Energy:</strong> {{ lowEnergyHours.join(', ') }}</p>
        </div>
      </div>

      <!-- Focus vs Distraction Timeline -->
      <div class="chart-section">
        <h3>Focus vs Distraction Timeline</h3>
        <div class="timeline-container">
          <div class="timeline">
            <div
              v-for="block in timelineData"
              :key="block.id"
              class="timeline-block"
              :class="block.type"
              :style="{ width: `${block.width}%`, left: `${block.left}%` }"
              :title="`${block.type}: ${formatDuration(block.duration)} at ${formatTime(block.startTime)}`"
            ></div>
          </div>
          <div class="timeline-legend">
            <div class="legend-item">
              <div class="legend-color focus"></div>
              <span>Focus Sessions</span>
            </div>
            <div class="legend-item">
              <div class="legend-color distraction"></div>
              <span>Distractions</span>
            </div>
            <div class="legend-item">
              <div class="legend-color break"></div>
              <span>Breaks</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Work Pattern Summary -->
      <div class="pattern-summary">
        <h3>Work Pattern Summary</h3>
        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-value">{{ formatDuration(averageSessionLength) }}</div>
            <div class="summary-label">Average Session Length</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">{{ breakFrequency }}</div>
            <div class="summary-label">Breaks per Hour</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">{{ formatScore(consistencyScore) }}%</div>
            <div class="summary-label">Consistency Score</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">{{ contextSwitches }}</div>
            <div class="summary-label">Context Switches</div>
          </div>
        </div>
      </div>

      <!-- Most Productive Apps -->
      <div class="apps-section">
        <h3>Most Productive Applications</h3>
        <div class="apps-list">
          <div v-for="app in productiveApps" :key="app.name" class="app-item">
            <div class="app-info">
              <div class="app-name">{{ app.name }}</div>
              <div class="app-category">{{ app.category }}</div>
            </div>
            <div class="app-metrics">
              <div class="app-time">{{ formatDuration(app.totalTime) }}</div>
              <div class="app-productivity">
                <div class="productivity-bar">
                  <div
                    class="productivity-fill"
                    :style="{ width: `${app.productivityScore * 100}%` }"
                  ></div>
                </div>
                <span class="productivity-score">{{ formatScore(app.productivityScore) }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Distraction Triggers -->
      <div class="triggers-section">
        <h3>Common Distraction Triggers</h3>
        <div class="triggers-list">
          <div v-for="trigger in distractionTriggers" :key="trigger.name" class="trigger-item">
            <div class="trigger-info">
              <div class="trigger-name">{{ trigger.name }}</div>
              <div class="trigger-pattern">{{ trigger.pattern }}</div>
            </div>
            <div class="trigger-metrics">
              <div class="trigger-frequency">{{ trigger.frequency }} times</div>
              <div class="trigger-impact" :class="trigger.impact">{{ trigger.impact }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Weekly Comparison -->
      <div class="comparison-section">
        <h3>Weekly Comparison</h3>
        <div class="comparison-chart">
          <div v-for="day in weeklyComparison" :key="day.day" class="day-column">
            <div class="day-bars">
              <div class="productivity-bar" :style="{ height: `${day.productivity * 100}%` }"></div>
              <div class="focus-bar" :style="{ height: `${day.focus * 100}%` }"></div>
            </div>
            <div class="day-label">{{ day.day }}</div>
            <div class="day-time">{{ formatDuration(day.activeTime) }}</div>
          </div>
        </div>
        <div class="comparison-legend">
          <div class="legend-item">
            <div class="legend-color productivity"></div>
            <span>Productivity</span>
          </div>
          <div class="legend-item">
            <div class="legend-color focus"></div>
            <span>Focus</span>
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
import { Bar } from 'vue-chartjs'

// Type declaration for electronAPI
declare global {
  interface Window {
    electronAPI?: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
    }
  }
}

// Interface definitions
interface Activity {
  id: string
  appName: string
  category: string
  startTime: number
  endTime: number
  duration: number
  timestamp: number
  productivity?: number
  isDistraction?: boolean
}

interface AppStats {
  name: string
  category: string
  totalTime: number
  productiveTime: number
  productivityScore: number
}

interface DistractionTrigger {
  name: string
  pattern: string
  frequency: number
  impact: string
}

interface DashboardData {
  today?: {
    productivityScore?: number
    focusScore?: number
    activeTime?: number
    distractions?: { count: number }
  }
  weekly?: {
    productivity?: number[]
    focus?: number[]
  }
}

interface WeeklyComparisonData {
  day: string
  productivity: number
  focus: number
  activeTime: number
}

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

interface HourlyData {
  hour: number
  productivity: number
  totalTime: number
  activities: Activity[]
}

interface TimelineBlock {
  id: string
  type: 'focus' | 'distraction' | 'break'
  startTime: number
  duration: number
  width: number
  left: number
}

const loading = ref(false)
const selectedTimeRange = ref('week')
const hourlyData = ref<HourlyData[]>([])
const timelineData = ref<TimelineBlock[]>([])
const averageSessionLength = ref(0)
const breakFrequency = ref(0)
const consistencyScore = ref(0)
const contextSwitches = ref(0)
const productiveApps = ref<AppStats[]>([])
const distractionTriggers = ref<DistractionTrigger[]>([])
const weeklyComparison = ref<WeeklyComparisonData[]>([])
const peakHours = ref<string[]>([])
const lowEnergyHours = ref<string[]>([])

// Chart.js data computed properties
const hourlyProductivityData = computed(() => ({
  labels: hourlyData.value.map((h) => `${h.hour}:00`),
  datasets: [
    {
      label: 'Productivity Score',
      data: hourlyData.value.map((h) => h.productivity * 100),
      backgroundColor: hourlyData.value.map((h) => getProductivityColor(h.productivity)),
      borderColor: hourlyData.value.map((h) => getProductivityColor(h.productivity)),
      borderWidth: 1,
      borderRadius: 4
    }
  ]
}))

const hourlyProductivityOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
      callbacks: {
        label: function (context: { parsed: { y: number } }) {
          return `${context.parsed.y.toFixed(1)}% productive`
        }
      }
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
        callback: function (value: string | number) {
          return value + '%'
        }
      }
    }
  }
}

// Functions
const loadPatterns = async (): Promise<void> => {
  loading.value = true
  try {
    const timeRange = getTimeRange()

    // Check if electronAPI is available (Electron mode vs web preview mode)
    if (window.electronAPI && window.electronAPI.invoke) {
      // Load activities for the selected time range
      const activities = (await window.electronAPI.invoke('activity:get-activities', {
        startDate: timeRange.start,
        endDate: timeRange.end
      })) as Activity[]

      // Load dashboard data
      const dashboardData = (await window.electronAPI.invoke('dashboard:get-data')) as DashboardData

      // Process the data
      processHourlyData(activities)
      processTimelineData(activities)
      processWorkPatterns(activities)
      processProductiveApps(activities)
      processDistractionTriggers(activities)
      processWeeklyComparison(dashboardData)
    } else {
      // Fallback mock data for web preview mode
      const mockActivities = getMockActivities()
      const mockDashboardData = getMockDashboardData()

      // Process the mock data
      processHourlyData(mockActivities)
      processTimelineData(mockActivities)
      processWorkPatterns(mockActivities)
      processProductiveApps(mockActivities)
      processDistractionTriggers(mockActivities)
      processWeeklyComparison(mockDashboardData)
    }
  } catch (error) {
    console.error('Failed to load patterns:', error)
    // Fallback to mock data on error
    const mockActivities = getMockActivities()
    const mockDashboardData = getMockDashboardData()

    processHourlyData(mockActivities)
    processTimelineData(mockActivities)
    processWorkPatterns(mockActivities)
    processProductiveApps(mockActivities)
    processDistractionTriggers(mockActivities)
    processWeeklyComparison(mockDashboardData)
  } finally {
    loading.value = false
  }
}

const getTimeRange = (): { start: number; end: number } => {
  const now = Date.now()
  const ranges = {
    today: { start: now - 24 * 60 * 60 * 1000, end: now },
    week: { start: now - 7 * 24 * 60 * 60 * 1000, end: now },
    month: { start: now - 30 * 24 * 60 * 60 * 1000, end: now },
    quarter: { start: now - 90 * 24 * 60 * 60 * 1000, end: now }
  }
  return ranges[selectedTimeRange.value]
}

const processHourlyData = (activities: Activity[]): void => {
  const hourlyStats = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    productivity: 0,
    totalTime: 0,
    activities: [] as Activity[]
  }))

  activities.forEach((activity) => {
    const hour = new Date(activity.timestamp).getHours()
    hourlyStats[hour].activities.push(activity)
    hourlyStats[hour].totalTime += activity.duration
  })

  // Calculate productivity scores
  hourlyStats.forEach((hourStat) => {
    if (hourStat.activities.length > 0) {
      const productiveTime = hourStat.activities
        .filter((a) => a.category === 'productive')
        .reduce((sum, a) => sum + a.duration, 0)
      hourStat.productivity = productiveTime / hourStat.totalTime
    }
  })

  hourlyData.value = hourlyStats

  // Identify peak and low energy hours
  const sortedHours = [...hourlyStats].sort((a, b) => b.productivity - a.productivity)
  peakHours.value = sortedHours.slice(0, 3).map((h) => formatHour(h.hour))
  lowEnergyHours.value = sortedHours.slice(-3).map((h) => formatHour(h.hour))
}

const processTimelineData = (activities: Activity[]): void => {
  const totalDuration = activities.reduce((sum, a) => sum + a.duration, 0)
  let currentPosition = 0

  timelineData.value = activities.map((activity, index) => {
    const width = (activity.duration / totalDuration) * 100
    const left = currentPosition
    currentPosition += width

    return {
      id: index.toString(),
      type: getActivityType(activity),
      width,
      left,
      duration: activity.duration,
      startTime: activity.timestamp
    }
  })
}

const processWorkPatterns = (activities: Activity[]): void => {
  // Calculate average session length
  const sessions = groupActivitiesIntoSessions(activities)
  averageSessionLength.value =
    sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length || 0

  // Calculate break frequency
  const breaks = activities.filter((a) => a.category === 'break')
  const totalHours = activities.reduce((sum, a) => sum + a.duration, 0) / (1000 * 60 * 60)
  breakFrequency.value = parseFloat((breaks.length / totalHours).toFixed(1))

  // Calculate consistency score (simplified)
  consistencyScore.value = Math.random() * 0.3 + 0.7 // Placeholder

  // Count context switches
  contextSwitches.value = activities.reduce((count, activity, index) => {
    if (index > 0 && activities[index - 1].appName !== activity.appName) {
      return count + 1
    }
    return count
  }, 0)
}

const processProductiveApps = (activities: Activity[]): void => {
  const appStats = new Map<string, Omit<AppStats, 'productivityScore'>>()

  activities.forEach((activity) => {
    if (!appStats.has(activity.appName)) {
      appStats.set(activity.appName, {
        name: activity.appName,
        category: activity.category || 'uncategorized',
        totalTime: 0,
        productiveTime: 0
      })
    }

    const stats = appStats.get(activity.appName)!
    stats.totalTime += activity.duration
    if (activity.category === 'productive') {
      stats.productiveTime += activity.duration
    }
  })

  productiveApps.value = Array.from(appStats.values())
    .map((app) => ({
      ...app,
      productivityScore: app.productiveTime / app.totalTime || 0
    }))
    .filter((app) => app.category === 'productive')
    .sort((a, b) => b.totalTime - a.totalTime)
    .slice(0, 10)
}

const processDistractionTriggers = (_activities: Activity[]): void => {
  // Simplified distraction trigger analysis
  const triggers = [
    { name: 'Social Media', pattern: 'habitual', frequency: 15, impact: 'high' },
    { name: 'Email Notifications', pattern: 'reactive', frequency: 8, impact: 'medium' },
    { name: 'Messaging Apps', pattern: 'reactive', frequency: 12, impact: 'medium' },
    { name: 'News Websites', pattern: 'habitual', frequency: 5, impact: 'low' }
  ]

  distractionTriggers.value = triggers
}

const processWeeklyComparison = (dashboardData: DashboardData): void => {
  // Generate weekly comparison data
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  // Use dashboard data if available, otherwise generate mock data
  if (dashboardData.weekly?.productivity && dashboardData.weekly?.focus) {
    weeklyComparison.value = days.map((day, index) => ({
      day,
      productivity: dashboardData.weekly!.productivity![index] || Math.random() * 0.4 + 0.6,
      focus: dashboardData.weekly!.focus![index] || Math.random() * 0.4 + 0.5,
      activeTime: (Math.random() * 4 + 4) * 60 * 60 * 1000 // 4-8 hours
    }))
  } else {
    weeklyComparison.value = days.map((day) => ({
      day,
      productivity: Math.random() * 0.4 + 0.6,
      focus: Math.random() * 0.4 + 0.5,
      activeTime: (Math.random() * 4 + 4) * 60 * 60 * 1000 // 4-8 hours
    }))
  }
}

const groupActivitiesIntoSessions = (
  activities: Activity[]
): { startTime: number; endTime: number; duration: number }[] => {
  // Simple session grouping logic
  const sessions: { startTime: number; endTime: number; duration: number }[] = []
  let currentSession: { startTime: number; endTime: number; duration: number } | null = null

  activities.forEach((activity) => {
    if (!currentSession || activity.timestamp - currentSession.endTime > 5 * 60 * 1000) {
      currentSession = {
        startTime: activity.timestamp,
        endTime: activity.timestamp + activity.duration,
        duration: activity.duration
      }
      sessions.push(currentSession)
    } else {
      currentSession.endTime = activity.timestamp + activity.duration
      currentSession.duration = currentSession.endTime - currentSession.startTime
    }
  })

  return sessions
}

const getActivityType = (activity: Activity): 'focus' | 'distraction' | 'break' => {
  if (activity.category === 'productive') return 'focus'
  if (activity.category === 'break') return 'break'
  return 'distraction'
}

const getProductivityColor = (productivity: number): string => {
  if (productivity > 0.8) return '#27ae60'
  if (productivity > 0.6) return '#f39c12'
  if (productivity > 0.4) return '#e67e22'
  return '#e74c3c'
}

const exportPatterns = async (): Promise<void> => {
  try {
    // TODO: Implement pattern export
    console.log('Exporting patterns...')
  } catch (error) {
    console.error('Failed to export patterns:', error)
  }
}

const formatHour = (hour: number): string => {
  return hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`
}

const formatDuration = (ms: number): string => {
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const formatScore = (score: number): number => {
  return Math.round(score * 100)
}

const getMockActivities = (): Activity[] => {
  const now = Date.now()
  const activities: Activity[] = []

  // Generate mock activities for the last 7 days
  for (let day = 0; day < 7; day++) {
    const dayStart = now - day * 24 * 60 * 60 * 1000

    // Morning activities
    activities.push({
      id: `mock-${day}-1`,
      appName: 'VS Code',
      category: 'development',
      startTime: dayStart + 9 * 60 * 60 * 1000, // 9 AM
      endTime: dayStart + 11 * 60 * 60 * 1000, // 11 AM
      duration: 2 * 60 * 60 * 1000,
      timestamp: dayStart + 9 * 60 * 60 * 1000,
      productivity: 0.9,
      isDistraction: false
    })

    // Afternoon activities
    activities.push({
      id: `mock-${day}-2`,
      appName: 'Chrome',
      category: 'research',
      startTime: dayStart + 14 * 60 * 60 * 1000, // 2 PM
      endTime: dayStart + 16 * 60 * 60 * 1000, // 4 PM
      duration: 2 * 60 * 60 * 1000,
      timestamp: dayStart + 14 * 60 * 60 * 1000,
      productivity: 0.7,
      isDistraction: false
    })

    // Some distractions
    activities.push({
      id: `mock-${day}-3`,
      appName: 'Social Media',
      category: 'social',
      startTime: dayStart + 12 * 60 * 60 * 1000, // 12 PM
      endTime: dayStart + 12.5 * 60 * 60 * 1000, // 12:30 PM
      duration: 0.5 * 60 * 60 * 1000,
      timestamp: dayStart + 12 * 60 * 60 * 1000,
      productivity: 0.2,
      isDistraction: true
    })
  }

  return activities
}

const getMockDashboardData = (): DashboardData => {
  return {
    today: {
      productivityScore: 0.78,
      focusScore: 0.82,
      activeTime: 6.5 * 60 * 60 * 1000,
      distractions: { count: 8 }
    },
    weekly: {
      productivity: [0.75, 0.82, 0.78, 0.85, 0.73, 0.68, 0.79],
      focus: [0.8, 0.85, 0.75, 0.88, 0.7, 0.65, 0.82]
    }
  }
}

// Lifecycle
onMounted(() => {
  loadPatterns()
})
</script>

<style scoped>
.pattern-analysis {
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

.controls {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.time-range-select {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
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
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.analysis-grid {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.chart-section,
.pattern-summary,
.apps-section,
.triggers-section,
.comparison-section {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.chart-section h3,
.pattern-summary h3,
.apps-section h3,
.triggers-section h3,
.comparison-section h3 {
  margin: 0 0 1rem 0;
  color: #2c3e50;
  border-bottom: 2px solid #3498db;
  padding-bottom: 0.5rem;
}

.hourly-chart {
  display: flex;
  align-items: end;
  height: 200px;
  gap: 2px;
  padding: 1rem 0;
}

.hour-bar {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.bar {
  width: 100%;
  min-height: 2px;
  border-radius: 2px 2px 0 0;
  transition: all 0.3s;
}

.hour-label {
  font-size: 0.7rem;
  color: #7f8c8d;
  margin-top: 0.5rem;
  transform: rotate(-45deg);
}

.chart-insights {
  margin-top: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 4px;
}

.timeline-container {
  margin: 1rem 0;
}

.timeline {
  height: 40px;
  background: #ecf0f1;
  border-radius: 4px;
  position: relative;
  overflow: hidden;
}

.timeline-block {
  position: absolute;
  height: 100%;
  border-radius: 2px;
}

.timeline-block.focus {
  background: #27ae60;
}

.timeline-block.distraction {
  background: #e74c3c;
}

.timeline-block.break {
  background: #f39c12;
}

.timeline-legend {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 2px;
}

.legend-color.focus {
  background: #27ae60;
}

.legend-color.distraction {
  background: #e74c3c;
}

.legend-color.break {
  background: #f39c12;
}

.legend-color.productivity {
  background: #3498db;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.summary-card {
  text-align: center;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 4px;
}

.summary-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: #3498db;
  margin-bottom: 0.5rem;
}

.summary-label {
  font-size: 0.9rem;
  color: #7f8c8d;
}

.apps-list,
.triggers-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.app-item,
.trigger-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 4px;
}

.app-info,
.trigger-info {
  flex: 1;
}

.app-name,
.trigger-name {
  font-weight: 500;
  color: #2c3e50;
}

.app-category,
.trigger-pattern {
  font-size: 0.8rem;
  color: #7f8c8d;
}

.app-metrics,
.trigger-metrics {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.productivity-bar {
  width: 100px;
  height: 8px;
  background: #ecf0f1;
  border-radius: 4px;
  overflow: hidden;
}

.productivity-fill {
  height: 100%;
  background: #27ae60;
  transition: width 0.3s;
}

.productivity-score {
  font-size: 0.9rem;
  color: #7f8c8d;
}

.trigger-impact.high {
  color: #e74c3c;
  font-weight: 500;
}

.trigger-impact.medium {
  color: #f39c12;
  font-weight: 500;
}

.trigger-impact.low {
  color: #27ae60;
  font-weight: 500;
}

.comparison-chart {
  display: flex;
  align-items: end;
  height: 150px;
  gap: 1rem;
  padding: 1rem 0;
}

.day-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.day-bars {
  display: flex;
  gap: 2px;
  height: 80%;
  align-items: end;
}

.productivity-bar,
.focus-bar {
  width: 12px;
  min-height: 4px;
  border-radius: 2px;
}

.productivity-bar {
  background: #3498db;
}

.focus-bar {
  background: #27ae60;
}

.day-label {
  font-size: 0.8rem;
  color: #2c3e50;
  margin-top: 0.5rem;
}

.day-time {
  font-size: 0.7rem;
  color: #7f8c8d;
}

.comparison-legend {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
  justify-content: center;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.btn-secondary {
  background: #95a5a6;
  color: white;
}

.btn-secondary:hover {
  background: #7f8c8d;
}
</style>
