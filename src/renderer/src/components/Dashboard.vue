<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface DashboardData {
  today: {
    totalTime: number
    activeTime: number
    idleTime: number
    topApps: Array<{ name: string; time: number; percentage: number }>
    categories: Array<{ name: string; time: number }>
  }
  thisWeek: {
    totalTime: number
    dailyBreakdown: Array<{ day: string; time: number }>
  }
}

const dashboardData = ref<DashboardData | null>(null)
const loading = ref(true)
const error = ref('')
const refreshInterval = ref<NodeJS.Timeout | null>(null)

const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

const formatPercentage = (percentage: number): string => {
  return `${percentage.toFixed(1)}%`
}

const loadDashboardData = async () => {
  loading.value = true
  error.value = ''
  try {
    // Check if API is available
    if (!window.api || !window.api.dashboard) {
      console.warn('API not available, using mock data')
      // Use mock data for development
      dashboardData.value = {
        today: {
          totalTime: 28800, // 8 hours in seconds
          activeTime: 25200, // 7 hours
          idleTime: 3600, // 1 hour
          topApps: [
            { name: 'Visual Studio Code', time: 14400, percentage: 57.1 },
            { name: 'Chrome', time: 7200, percentage: 28.6 },
            { name: 'Slack', time: 3600, percentage: 14.3 }
          ],
          categories: [
            { name: 'Development', time: 14400 },
            { name: 'Web Browsing', time: 7200 },
            { name: 'Communication', time: 3600 }
          ]
        },
        thisWeek: {
          totalTime: 144000, // 40 hours
          dailyBreakdown: [
            { day: '2024-01-15', time: 28800 },
            { day: '2024-01-16', time: 25200 },
            { day: '2024-01-17', time: 30600 },
            { day: '2024-01-18', time: 27000 },
            { day: '2024-01-19', time: 32400 }
          ]
        }
      }
    } else {
      const data = await window.api.dashboard.getData()
      dashboardData.value = data
    }
  } catch (err) {
    console.error('Failed to load dashboard data:', err)
    error.value = 'Failed to load dashboard data'
  } finally {
    loading.value = false
  }
}

const getProgressWidth = (percentage: number): string => {
  return `${Math.min(percentage, 100)}%`
}

const getAppColor = (index: number): string => {
  const colors = [
    '#6366f1',
    '#8b5cf6',
    '#06b6d4',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#ec4899',
    '#84cc16'
  ]
  return colors[index % colors.length]
}

onMounted(() => {
  loadDashboardData()
  // Refresh data every 30 seconds
  refreshInterval.value = setInterval(loadDashboardData, 30000)
})

onUnmounted(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
})
</script>

<template>
  <div class="dashboard">
    <div class="dashboard-header">
      <h2 class="dashboard-title">Dashboard</h2>
      <button class="refresh-button" :disabled="loading" @click="loadDashboardData">
        <span class="refresh-icon" :class="{ spinning: loading }">🔄</span>
        Refresh
      </button>
    </div>

    <div v-if="loading && !dashboardData" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading dashboard data...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <div class="error-icon">⚠️</div>
      <p>{{ error }}</p>
      <button class="retry-button" @click="loadDashboardData">Retry</button>
    </div>

    <div v-else-if="dashboardData" class="dashboard-content">
      <!-- Today's Stats -->
      <section class="stats-section">
        <h3 class="section-title">Today's Activity</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">⏱️</div>
            <div class="stat-content">
              <div class="stat-value">{{ formatTime(dashboardData.today.totalTime) }}</div>
              <div class="stat-label">Total Time</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon">✅</div>
            <div class="stat-content">
              <div class="stat-value">{{ formatTime(dashboardData.today.activeTime) }}</div>
              <div class="stat-label">Active Time</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon">😴</div>
            <div class="stat-content">
              <div class="stat-value">{{ formatTime(dashboardData.today.idleTime) }}</div>
              <div class="stat-label">Idle Time</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon">📱</div>
            <div class="stat-content">
              <div class="stat-value">{{ dashboardData.today.topApps.length }}</div>
              <div class="stat-label">Apps Used</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Top Applications -->
      <section class="apps-section">
        <h3 class="section-title">Top Applications Today</h3>
        <div class="apps-list">
          <div
            v-for="(app, index) in dashboardData.today.topApps.slice(0, 8)"
            :key="app.name"
            class="app-item"
          >
            <div class="app-info">
              <div class="app-name">{{ app.name }}</div>
              <div class="app-time">{{ formatTime(app.time) }}</div>
            </div>
            <div class="app-progress">
              <div
                class="app-progress-bar"
                :style="{
                  width: getProgressWidth(app.percentage),
                  backgroundColor: getAppColor(index)
                }"
              ></div>
            </div>
            <div class="app-percentage">{{ formatPercentage(app.percentage) }}</div>
          </div>
        </div>

        <div v-if="dashboardData.today.topApps.length === 0" class="empty-state">
          <div class="empty-icon">📱</div>
          <p>No application data available yet</p>
          <p class="empty-subtitle">Start tracking to see your app usage</p>
        </div>
      </section>

      <!-- Weekly Overview -->
      <section class="weekly-section">
        <h3 class="section-title">This Week's Overview</h3>
        <div class="weekly-stats">
          <div class="weekly-total">
            <div class="weekly-time">{{ formatTime(dashboardData.thisWeek.totalTime) }}</div>
            <div class="weekly-label">Total This Week</div>
          </div>

          <div class="daily-breakdown">
            <div
              v-for="day in dashboardData.thisWeek.dailyBreakdown"
              :key="day.day"
              class="day-item"
            >
              <div class="day-name">
                {{ new Date(day.day).toLocaleDateString('en', { weekday: 'short' }) }}
              </div>
              <div class="day-bar">
                <div
                  class="day-progress"
                  :style="{
                    height: `${Math.max((day.time / Math.max(...dashboardData.thisWeek.dailyBreakdown.map((d) => d.time))) * 100, 5)}%`
                  }"
                ></div>
              </div>
              <div class="day-time">{{ formatTime(day.time) }}</div>
            </div>
          </div>
        </div>

        <div v-if="dashboardData.thisWeek.dailyBreakdown.length === 0" class="empty-state">
          <div class="empty-icon">📊</div>
          <p>No weekly data available yet</p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.dashboard-title {
  font-size: 2rem;
  font-weight: 700;
  margin: 0;
  color: var(--ev-c-text-1);
}

.refresh-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--ev-c-gray-2);
  border-radius: 0.5rem;
  background: var(--ev-button-alt-bg);
  color: var(--ev-button-alt-text);
  cursor: pointer;
  transition: all 0.2s;
}

.refresh-button:hover:not(:disabled) {
  background: var(--ev-button-alt-hover-bg);
}

.refresh-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.refresh-icon {
  font-size: 1rem;
  transition: transform 0.5s;
}

.refresh-icon.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--ev-c-gray-3);
  border-top: 3px solid #6366f1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

.error-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.retry-button {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--ev-c-gray-2);
  border-radius: 0.5rem;
  background: var(--ev-button-alt-bg);
  color: var(--ev-button-alt-text);
  cursor: pointer;
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--ev-c-text-1);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: var(--color-background-soft);
  border: 1px solid var(--ev-c-gray-3);
  border-radius: 0.75rem;
}

.stat-icon {
  font-size: 2rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--ev-c-text-1);
}

.stat-label {
  font-size: 0.875rem;
  color: var(--ev-c-text-2);
}

.apps-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.app-item {
  display: grid;
  grid-template-columns: 1fr 200px auto;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--color-background-soft);
  border: 1px solid var(--ev-c-gray-3);
  border-radius: 0.5rem;
}

.app-name {
  font-weight: 600;
  color: var(--ev-c-text-1);
}

.app-time {
  font-size: 0.875rem;
  color: var(--ev-c-text-2);
}

.app-progress {
  height: 8px;
  background: var(--ev-c-gray-3);
  border-radius: 4px;
  overflow: hidden;
}

.app-progress-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s;
}

.app-percentage {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ev-c-text-1);
  min-width: 50px;
  text-align: right;
}

.weekly-stats {
  display: flex;
  gap: 2rem;
  align-items: flex-end;
}

.weekly-total {
  text-align: center;
}

.weekly-time {
  font-size: 2rem;
  font-weight: 700;
  color: var(--ev-c-text-1);
}

.weekly-label {
  font-size: 0.875rem;
  color: var(--ev-c-text-2);
  margin-top: 0.5rem;
}

.daily-breakdown {
  display: flex;
  gap: 1rem;
  flex: 1;
}

.day-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

.day-name {
  font-size: 0.75rem;
  color: var(--ev-c-text-2);
  font-weight: 500;
}

.day-bar {
  height: 100px;
  width: 20px;
  background: var(--ev-c-gray-3);
  border-radius: 10px;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}

.day-progress {
  width: 100%;
  background: linear-gradient(to top, #6366f1, #8b5cf6);
  border-radius: 10px;
  min-height: 4px;
}

.day-time {
  font-size: 0.75rem;
  color: var(--ev-c-text-2);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem 2rem;
  text-align: center;
  color: var(--ev-c-text-2);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-subtitle {
  font-size: 0.875rem;
  margin-top: 0.5rem;
}
</style>
