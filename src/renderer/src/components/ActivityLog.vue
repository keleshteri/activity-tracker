<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

interface ActivityRecord {
  id: number
  timestamp: number
  appName: string
  windowTitle: string
  duration: number
  category?: string
  isIdle: boolean
  url?: string
  cpuUsage?: number
}

const activities = ref<ActivityRecord[]>([])
const loading = ref(true)
const error = ref('')
const searchQuery = ref('')
const selectedApp = ref('')
const showIdleActivities = ref(false)
const sortBy = ref<'timestamp' | 'duration' | 'appName'>('timestamp')
const sortOrder = ref<'asc' | 'desc'>('desc')
const currentPage = ref(1)
const itemsPerPage = 50

// Mock data for demonstration - in real app this would come from the database
const mockActivities: ActivityRecord[] = [
  {
    id: 1,
    timestamp: Date.now() - 3600000,
    appName: 'Visual Studio Code',
    windowTitle: 'activity-tracker - App.vue',
    duration: 1800,
    isIdle: false,
    cpuUsage: 15.2
  },
  {
    id: 2,
    timestamp: Date.now() - 7200000,
    appName: 'Google Chrome',
    windowTitle: 'Vue.js Documentation',
    duration: 900,
    isIdle: false,
    url: 'https://vuejs.org/guide/',
    cpuUsage: 8.5
  },
  {
    id: 3,
    timestamp: Date.now() - 10800000,
    appName: 'Slack',
    windowTitle: 'Team Chat - Development',
    duration: 300,
    isIdle: false,
    cpuUsage: 5.1
  },
  {
    id: 4,
    timestamp: Date.now() - 14400000,
    appName: 'System Idle',
    windowTitle: 'Idle',
    duration: 600,
    isIdle: true,
    cpuUsage: 0.1
  }
]

const uniqueApps = computed(() => {
  const apps = [...new Set(activities.value.map((a) => a.appName))]
  return apps.sort()
})

const filteredActivities = computed(() => {
  let filtered = activities.value

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(
      (activity) =>
        activity.appName.toLowerCase().includes(query) ||
        activity.windowTitle.toLowerCase().includes(query) ||
        (activity.url && activity.url.toLowerCase().includes(query))
    )
  }

  // Filter by selected app
  if (selectedApp.value) {
    filtered = filtered.filter((activity) => activity.appName === selectedApp.value)
  }

  // Filter idle activities
  if (!showIdleActivities.value) {
    filtered = filtered.filter((activity) => !activity.isIdle)
  }

  // Sort activities
  filtered.sort((a, b) => {
    let aValue: any, bValue: any

    switch (sortBy.value) {
      case 'timestamp':
        aValue = a.timestamp
        bValue = b.timestamp
        break
      case 'duration':
        aValue = a.duration
        bValue = b.duration
        break
      case 'appName':
        aValue = a.appName.toLowerCase()
        bValue = b.appName.toLowerCase()
        break
      default:
        return 0
    }

    if (sortOrder.value === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
    }
  })

  return filtered
})

const paginatedActivities = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredActivities.value.slice(start, end)
})

const totalPages = computed(() => {
  return Math.ceil(filteredActivities.value.length / itemsPerPage)
})

const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`
  }
  return `${secs}s`
}

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - timestamp
  const diffHours = diffMs / (1000 * 60 * 60)

  if (diffHours < 24) {
    return date.toLocaleTimeString()
  } else {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  }
}

const getAppIcon = (appName: string): string => {
  const iconMap: Record<string, string> = {
    'Visual Studio Code': '💻',
    'Google Chrome': '🌐',
    Firefox: '🦊',
    Safari: '🧭',
    Slack: '💬',
    Discord: '🎮',
    Spotify: '🎵',
    'System Idle': '😴',
    Terminal: '⚡',
    Finder: '📁',
    Explorer: '📁'
  }

  return iconMap[appName] || '📱'
}

const changeSortBy = (field: 'timestamp' | 'duration' | 'appName') => {
  if (sortBy.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = field
    sortOrder.value = 'desc'
  }
}

const clearFilters = () => {
  searchQuery.value = ''
  selectedApp.value = ''
  showIdleActivities.value = false
  currentPage.value = 1
}

const loadActivities = async () => {
  try {
    loading.value = true
    error.value = ''

    if (!window.api || !window.api.activity) {
      console.warn('Activities API not available, using mock data')
      // Simulate loading delay
      await new Promise((resolve) => setTimeout(resolve, 500))
      activities.value = mockActivities
    } else {
      const data = await window.api.activity.getActivities()
      activities.value = data || []
    }
  } catch (err) {
    console.error('Failed to load activities:', err)
    error.value = 'Failed to load activity data'
  } finally {
    loading.value = false
  }
}

const goToPage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

onMounted(() => {
  loadActivities()
})
</script>

<template>
  <div class="activity-log">
    <div class="log-header">
      <h2 class="log-title">Activity Log</h2>
      <button class="refresh-button" :disabled="loading" @click="loadActivities">
        <span class="refresh-icon" :class="{ spinning: loading }">🔄</span>
        Refresh
      </button>
    </div>

    <!-- Filters -->
    <div class="filters">
      <div class="filter-row">
        <div class="search-box">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search activities..."
            class="search-input"
          />
        </div>

        <select v-model="selectedApp" class="app-filter">
          <option value="">All Applications</option>
          <option v-for="app in uniqueApps" :key="app" :value="app">
            {{ app }}
          </option>
        </select>

        <label class="idle-toggle">
          <input v-model="showIdleActivities" type="checkbox" />
          <span class="checkmark"></span>
          Show Idle
        </label>

        <button class="clear-filters" @click="clearFilters">Clear Filters</button>
      </div>

      <div class="results-info">
        Showing {{ paginatedActivities.length }} of {{ filteredActivities.length }} activities
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading activities...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <div class="error-icon">⚠️</div>
      <p>{{ error }}</p>
      <button class="retry-button" @click="loadActivities">Retry</button>
    </div>

    <div v-else class="log-content">
      <!-- Activity Table -->
      <div class="activity-table">
        <div class="table-header">
          <div class="header-cell app-col">
            <button
              class="sort-button"
              :class="{ active: sortBy === 'appName' }"
              @click="changeSortBy('appName')"
            >
              Application
              <span v-if="sortBy === 'appName'" class="sort-arrow">
                {{ sortOrder === 'asc' ? '↑' : '↓' }}
              </span>
            </button>
          </div>
          <div class="header-cell title-col">Window Title</div>
          <div class="header-cell time-col">
            <button
              class="sort-button"
              :class="{ active: sortBy === 'timestamp' }"
              @click="changeSortBy('timestamp')"
            >
              Time
              <span v-if="sortBy === 'timestamp'" class="sort-arrow">
                {{ sortOrder === 'asc' ? '↑' : '↓' }}
              </span>
            </button>
          </div>
          <div class="header-cell duration-col">
            <button
              class="sort-button"
              :class="{ active: sortBy === 'duration' }"
              @click="changeSortBy('duration')"
            >
              Duration
              <span v-if="sortBy === 'duration'" class="sort-arrow">
                {{ sortOrder === 'asc' ? '↑' : '↓' }}
              </span>
            </button>
          </div>
          <div class="header-cell cpu-col">CPU</div>
        </div>

        <div class="table-body">
          <div
            v-for="activity in paginatedActivities"
            :key="activity.id"
            class="activity-row"
            :class="{ idle: activity.isIdle }"
          >
            <div class="cell app-col">
              <div class="app-info">
                <span class="app-icon">{{ getAppIcon(activity.appName) }}</span>
                <span class="app-name">{{ activity.appName }}</span>
              </div>
            </div>

            <div class="cell title-col">
              <div class="window-title">{{ activity.windowTitle }}</div>
              <div v-if="activity.url" class="url">{{ activity.url }}</div>
            </div>

            <div class="cell time-col">
              {{ formatTimestamp(activity.timestamp) }}
            </div>

            <div class="cell duration-col">
              <span class="duration">{{ formatTime(activity.duration) }}</span>
            </div>

            <div class="cell cpu-col">
              <span v-if="activity.cpuUsage !== undefined" class="cpu-usage">
                {{ activity.cpuUsage.toFixed(1) }}%
              </span>
              <span v-else class="cpu-na">-</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="filteredActivities.length === 0" class="empty-state">
        <div class="empty-icon">📝</div>
        <h3>No activities found</h3>
        <p v-if="searchQuery || selectedApp">Try adjusting your filters</p>
        <p v-else>Start tracking to see your activities here</p>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="pagination">
        <button
          class="page-button"
          :disabled="currentPage === 1"
          @click="goToPage(currentPage - 1)"
        >
          Previous
        </button>

        <div class="page-numbers">
          <button
            v-for="page in Math.min(totalPages, 5)"
            :key="page"
            class="page-number"
            :class="{ active: page === currentPage }"
            @click="goToPage(page)"
          >
            {{ page }}
          </button>

          <span v-if="totalPages > 5" class="page-ellipsis">...</span>

          <button
            v-if="totalPages > 5"
            class="page-number"
            :class="{ active: totalPages === currentPage }"
            @click="goToPage(totalPages)"
          >
            {{ totalPages }}
          </button>
        </div>

        <button
          class="page-button"
          :disabled="currentPage === totalPages"
          @click="goToPage(currentPage + 1)"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.activity-log {
  max-width: 1200px;
  margin: 0 auto;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.log-title {
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

.refresh-icon {
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

.filters {
  background: var(--color-background-soft);
  border: 1px solid var(--ev-c-gray-3);
  border-radius: 0.75rem;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.filter-row {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.search-box {
  flex: 1;
  min-width: 200px;
}

.search-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--ev-c-gray-2);
  border-radius: 0.375rem;
  background: var(--color-background);
  color: var(--ev-c-text-1);
}

.app-filter {
  padding: 0.5rem;
  border: 1px solid var(--ev-c-gray-2);
  border-radius: 0.375rem;
  background: var(--color-background);
  color: var(--ev-c-text-1);
  min-width: 150px;
}

.idle-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
}

.idle-toggle input {
  margin: 0;
}

.clear-filters {
  padding: 0.5rem 1rem;
  border: 1px solid var(--ev-c-gray-2);
  border-radius: 0.375rem;
  background: var(--ev-button-alt-bg);
  color: var(--ev-button-alt-text);
  cursor: pointer;
}

.results-info {
  font-size: 0.875rem;
  color: var(--ev-c-text-2);
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
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

.activity-table {
  background: var(--color-background-soft);
  border: 1px solid var(--ev-c-gray-3);
  border-radius: 0.75rem;
  overflow: hidden;
}

.table-header {
  display: grid;
  grid-template-columns: 200px 1fr 150px 100px 80px;
  background: var(--color-background-mute);
  border-bottom: 1px solid var(--ev-c-gray-3);
}

.header-cell {
  padding: 1rem;
  font-weight: 600;
  color: var(--ev-c-text-1);
}

.sort-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-weight: inherit;
  padding: 0;
}

.sort-button:hover {
  color: #6366f1;
}

.sort-button.active {
  color: #6366f1;
}

.sort-arrow {
  font-size: 0.875rem;
}

.table-body {
  max-height: 600px;
  overflow-y: auto;
}

.activity-row {
  display: grid;
  grid-template-columns: 200px 1fr 150px 100px 80px;
  border-bottom: 1px solid var(--ev-c-gray-3);
  transition: background-color 0.2s;
}

.activity-row:hover {
  background: var(--color-background-mute);
}

.activity-row.idle {
  opacity: 0.6;
}

.cell {
  padding: 1rem;
  display: flex;
  align-items: center;
}

.app-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.app-icon {
  font-size: 1.25rem;
}

.app-name {
  font-weight: 500;
  color: var(--ev-c-text-1);
}

.window-title {
  color: var(--ev-c-text-1);
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.url {
  font-size: 0.75rem;
  color: var(--ev-c-text-2);
  word-break: break-all;
}

.duration {
  font-weight: 600;
  color: var(--ev-c-text-1);
}

.cpu-usage {
  font-weight: 500;
  color: var(--ev-c-text-1);
}

.cpu-na {
  color: var(--ev-c-text-2);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4rem 2rem;
  text-align: center;
  color: var(--ev-c-text-2);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-state h3 {
  margin: 0 0 0.5rem 0;
  color: var(--ev-c-text-1);
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  margin-top: 2rem;
}

.page-button,
.page-number {
  padding: 0.5rem 1rem;
  border: 1px solid var(--ev-c-gray-2);
  border-radius: 0.375rem;
  background: var(--ev-button-alt-bg);
  color: var(--ev-button-alt-text);
  cursor: pointer;
  transition: all 0.2s;
}

.page-button:hover:not(:disabled),
.page-number:hover {
  background: var(--ev-button-alt-hover-bg);
}

.page-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-number.active {
  background: #6366f1;
  border-color: #6366f1;
  color: white;
}

.page-numbers {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.page-ellipsis {
  padding: 0.5rem;
  color: var(--ev-c-text-2);
}
</style>
