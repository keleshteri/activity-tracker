<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import Dashboard from './components/Dashboard.vue'
import Settings from './components/Settings.vue'
import ActivityLog from './components/ActivityLog.vue'

const activeTab = ref('dashboard')
const isTracking = ref(false)
const currentApp = ref('')
const statusInterval = ref<NodeJS.Timeout | null>(null)

const tabs = [
  { id: 'dashboard', name: 'Dashboard', icon: '📊' },
  { id: 'activity', name: 'Activity Log', icon: '📝' },
  { id: 'settings', name: 'Settings', icon: '⚙️' }
]

const updateStatus = async () => {
  console.log('updateStatus called')
  try {
    if (!window.api || !window.api.tracker) {
      console.warn('Tracker API not available, using demo mode')
      isTracking.value = false
      currentApp.value = 'Activity Tracker (Demo Mode)'
      return
    }
    const status = await window.api.tracker.getStatus()
    console.log('Status received:', status)
    console.log('Current isTracking before update:', isTracking.value)
    isTracking.value = status.isTracking
    currentApp.value = status.currentApp || 'No active app'
    console.log('isTracking after update:', isTracking.value)
  } catch (err) {
    console.error('Failed to get status:', err)
  }
}

const toggleTracking = async () => {
  try {
    if (!window.api || !window.api.tracker) {
      console.warn('Tracker API not available, simulating toggle')
      isTracking.value = !isTracking.value
      currentApp.value = isTracking.value ? 'Visual Studio Code' : 'Activity Tracker (Demo Mode)'
      return
    }
    if (isTracking.value) {
      await window.api.tracker.stop()
    } else {
      await window.api.tracker.start()
    }
    await updateStatus()
  } catch (err) {
    console.error('Failed to toggle tracking:', err)
  }
}

onMounted(() => {
  console.log('App mounted, window.api available:', !!window.api)
  console.log('window.api.tracker available:', !!(window.api && window.api.tracker))
  updateStatus()
  statusInterval.value = setInterval(updateStatus, 2000)
})

onUnmounted(() => {
  if (statusInterval.value) {
    clearInterval(statusInterval.value)
  }
})
</script>

<template>
  <div class="app-container">
    <!-- Header -->
    <header class="app-header">
      <div class="header-left">
        <h1 class="app-title">Activity Tracker</h1>
        <div class="status-indicator" :class="{ active: isTracking }">
          <span class="status-dot"></span>
          {{ isTracking ? 'Tracking' : 'Stopped' }}
        </div>
      </div>
      <div class="header-right">
        <div class="current-app" v-if="isTracking">
          <span class="app-label">Current:</span>
          <span class="app-name">{{ currentApp }}</span>
        </div>
        <button 
          class="track-button" 
          :class="{ active: isTracking }"
          @click="toggleTracking"
        >
          {{ isTracking ? 'Stop Tracking' : 'Start Tracking' }}
        </button>
      </div>
    </header>

    <!-- Navigation -->
    <nav class="app-nav">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        class="nav-tab"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        <span class="tab-icon">{{ tab.icon }}</span>
        <span class="tab-name">{{ tab.name }}</span>
      </button>
    </nav>

    <!-- Main Content -->
    <main class="app-main">
      <Dashboard v-if="activeTab === 'dashboard'" />
      <ActivityLog v-if="activeTab === 'activity'" />
      <Settings v-if="activeTab === 'settings'" />
    </main>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--color-background);
  color: var(--color-text);
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: var(--color-background-soft);
  border-bottom: 1px solid var(--ev-c-gray-3);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.app-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  background: var(--ev-c-gray-3);
  font-size: 0.875rem;
  font-weight: 500;
}

.status-indicator.active {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ev-c-gray-1);
}

.status-indicator.active .status-dot {
  background: #22c55e;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.current-app {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.app-label {
  color: var(--ev-c-text-2);
}

.app-name {
  font-weight: 600;
  color: var(--ev-c-text-1);
}

.track-button {
  padding: 0.5rem 1rem;
  border: 1px solid var(--ev-c-gray-2);
  border-radius: 0.5rem;
  background: var(--ev-button-alt-bg);
  color: var(--ev-button-alt-text);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.track-button:hover {
  background: var(--ev-button-alt-hover-bg);
}

.track-button.active {
  background: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
  color: #ef4444;
}

.app-nav {
  display: flex;
  padding: 0 1.5rem;
  background: var(--color-background-soft);
  border-bottom: 1px solid var(--ev-c-gray-3);
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  color: var(--ev-c-text-2);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.nav-tab:hover {
  color: var(--ev-c-text-1);
  background: var(--color-background-mute);
}

.nav-tab.active {
  color: var(--ev-c-text-1);
  border-bottom-color: #6366f1;
}

.tab-icon {
  font-size: 1.125rem;
}

.tab-name {
  font-weight: 500;
}

.app-main {
  flex: 1;
  overflow: auto;
  padding: 1.5rem;
}
</style>
