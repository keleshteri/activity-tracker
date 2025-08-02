<template>
  <div class="distraction-management">
    <div class="header">
      <h2>Distraction Management</h2>
      <div class="actions">
        <button @click="refreshData" class="btn btn-secondary" :disabled="loading">
          <i class="icon-refresh"></i>
          Refresh
        </button>
        <button @click="testNotification" class="btn btn-primary">
          <i class="icon-test"></i>
          Test Notification
        </button>
      </div>
    </div>

    <!-- Settings Section -->
    <div class="settings-section">
      <h3>Distraction Settings</h3>
      <div class="settings-card">
        <div class="setting-group">
          <label class="setting-label">
            <input
              type="checkbox"
              v-model="settings.enabled"
              @change="saveSettings"
              class="setting-checkbox"
            />
            Enable Distraction Detection
          </label>
          <p class="setting-description">
            Monitor application usage and detect when you're using distracting applications
          </p>
        </div>

        <div class="setting-group" v-if="settings.enabled">
          <label class="setting-label">Distraction Threshold (minutes)</label>
          <input
            type="number"
            v-model.number="settings.thresholdMinutes"
            @change="saveSettings"
            min="1"
            max="60"
            class="setting-input"
          />
          <p class="setting-description">
            How long you can use a distracting app before getting a notification
          </p>
        </div>

        <div class="setting-group" v-if="settings.enabled">
          <label class="setting-label">Notification Type</label>
          <select v-model="settings.notificationType" @change="saveSettings" class="setting-select">
            <option value="gentle">Gentle Reminder</option>
            <option value="persistent">Persistent Alert</option>
            <option value="blocking">Blocking Warning</option>
          </select>
          <p class="setting-description">Choose how you want to be notified about distractions</p>
        </div>

        <div class="setting-group" v-if="settings.enabled">
          <label class="setting-label">Break Reminder Interval (minutes)</label>
          <input
            type="number"
            v-model.number="settings.breakReminderInterval"
            @change="saveSettings"
            min="15"
            max="120"
            class="setting-input"
          />
          <p class="setting-description">
            How often to remind you to take breaks during focused work
          </p>
        </div>

        <div class="setting-group" v-if="settings.enabled">
          <label class="setting-label">
            <input
              type="checkbox"
              v-model="settings.quietHoursEnabled"
              @change="saveSettings"
              class="setting-checkbox"
            />
            Enable Quiet Hours
          </label>
          <p class="setting-description">Disable notifications during specified hours</p>
        </div>

        <div class="quiet-hours-config" v-if="settings.enabled && settings.quietHoursEnabled">
          <div class="time-range">
            <div class="time-input-group">
              <label>Start Time</label>
              <input
                type="time"
                v-model="settings.quietHoursStart"
                @change="saveSettings"
                class="time-input"
              />
            </div>
            <div class="time-input-group">
              <label>End Time</label>
              <input
                type="time"
                v-model="settings.quietHoursEnd"
                @change="saveSettings"
                class="time-input"
              />
            </div>
          </div>
        </div>

        <div class="setting-group" v-if="settings.enabled">
          <label class="setting-label">Productivity Goal (hours per day)</label>
          <input
            type="number"
            v-model.number="settings.productivityGoal"
            @change="saveSettings"
            min="1"
            max="16"
            step="0.5"
            class="setting-input"
          />
          <p class="setting-description">Daily goal for productive application usage</p>
        </div>
      </div>
    </div>

    <!-- Statistics Section -->
    <div class="stats-section">
      <h3>Today's Distraction Statistics</h3>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ todayStats.totalDistractions }}</div>
          <div class="stat-label">Total Distractions</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ formatDuration(todayStats.totalDistractionTime) }}</div>
          <div class="stat-label">Time on Distracting Apps</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ formatDuration(todayStats.longestDistraction) }}</div>
          <div class="stat-label">Longest Distraction</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ todayStats.productivityScore }}%</div>
          <div class="stat-label">Productivity Score</div>
        </div>
      </div>
    </div>

    <!-- Recent Distractions -->
    <div class="events-section">
      <h3>Recent Distraction Events</h3>
      <div class="events-filter">
        <select v-model="eventsFilter" @change="loadEvents" class="filter-select">
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
        <select v-model="severityFilter" @change="filterEvents" class="filter-select">
          <option value="">All Severities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      <div class="events-list">
        <div v-if="filteredEvents.length === 0" class="no-events">
          <p>No distraction events found for the selected period.</p>
        </div>
        <div v-for="event in filteredEvents" :key="event.id" class="event-card">
          <div class="event-header">
            <div class="event-app">{{ event.appName }}</div>
            <div class="event-severity" :class="event.severity">
              {{ event.severity.toUpperCase() }}
            </div>
            <div class="event-time">{{ formatEventTime(event.timestamp) }}</div>
          </div>
          <div class="event-details">
            <div class="event-duration">Duration: {{ formatDuration(event.duration) }}</div>
            <div class="event-category" v-if="event.category">Category: {{ event.category }}</div>
          </div>
          <div class="event-actions">
            <button @click="categorizeApp(event.appName)" class="btn btn-sm btn-secondary">
              Categorize App
            </button>
            <button @click="addToWhitelist(event.appName)" class="btn btn-sm btn-primary">
              Add to Whitelist
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Focus Session Timer -->
    <div class="focus-session-section">
      <h3>Focus Session Timer</h3>
      <div class="focus-timer-card">
        <div class="timer-display">
          <div class="time-remaining">{{ formatTime(focusTimer.timeRemaining) }}</div>
          <div class="session-type">
            {{ focusTimer.sessionType === 'focus' ? 'Focus Session' : 'Break Time' }}
          </div>
        </div>

        <div class="timer-controls">
          <button
            v-if="!focusTimer.isActive"
            @click="startFocusSession"
            class="btn btn-primary timer-btn"
          >
            <i class="icon-play"></i>
            Start Focus Session
          </button>

          <button
            v-if="focusTimer.isActive && !focusTimer.isPaused"
            @click="pauseFocusSession"
            class="btn btn-secondary timer-btn"
          >
            <i class="icon-pause"></i>
            Pause
          </button>

          <button
            v-if="focusTimer.isActive && focusTimer.isPaused"
            @click="resumeFocusSession"
            class="btn btn-primary timer-btn"
          >
            <i class="icon-play"></i>
            Resume
          </button>

          <button
            v-if="focusTimer.isActive"
            @click="stopFocusSession"
            class="btn btn-danger timer-btn"
          >
            <i class="icon-stop"></i>
            Stop
          </button>
        </div>

        <div class="timer-settings">
          <div class="setting-row">
            <label>Session Duration:</label>
            <select
              v-model="focusTimer.duration"
              :disabled="focusTimer.isActive"
              class="duration-select"
            >
              <option value="1500000">25 minutes (Pomodoro)</option>
              <option value="3000000">50 minutes</option>
              <option value="5400000">90 minutes</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div class="setting-row" v-if="focusTimer.duration === 'custom'">
            <label>Custom Duration (minutes):</label>
            <input
              type="number"
              v-model.number="focusTimer.customDuration"
              min="5"
              max="180"
              class="duration-input"
            />
          </div>

          <div class="setting-row">
            <label>
              <input
                type="checkbox"
                v-model="focusTimer.pomodoroMode"
                :disabled="focusTimer.isActive"
              />
              Enable Pomodoro Mode (automatic breaks)
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- Distraction Patterns -->
    <div class="patterns-section">
      <h3>Distraction Patterns</h3>
      <div class="patterns-grid">
        <div class="pattern-card">
          <h4>Most Distracting Apps</h4>
          <div class="pattern-list">
            <div v-for="app in topDistractingApps" :key="app.name" class="pattern-item">
              <span class="app-name">{{ app.name }}</span>
              <span class="app-time">{{ formatDuration(app.totalTime) }}</span>
            </div>
          </div>
        </div>

        <div class="pattern-card">
          <h4>Peak Distraction Hours</h4>
          <div class="pattern-list">
            <div v-for="hour in peakDistractionHours" :key="hour.hour" class="pattern-item">
              <span class="hour-label">{{ formatHour(hour.hour) }}</span>
              <span class="hour-count">{{ hour.count }} events</span>
            </div>
          </div>
        </div>

        <div class="pattern-card">
          <h4>Weekly Trends</h4>
          <div class="pattern-list">
            <div v-for="day in weeklyTrends" :key="day.day" class="pattern-item">
              <span class="day-name">{{ day.day }}</span>
              <span class="day-score">{{ day.productivityScore }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading Overlay -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <div class="loading-text">{{ loadingText }}</div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DistractionManagement',
  data() {
    return {
      settings: {
        enabled: false,
        thresholdMinutes: 5,
        notificationType: 'gentle',
        breakReminderInterval: 30,
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        productivityGoal: 6
      },
      events: [],
      filteredEvents: [],
      todayStats: {
        totalDistractions: 0,
        totalDistractionTime: 0,
        longestDistraction: 0,
        productivityScore: 0
      },
      topDistractingApps: [],
      peakDistractionHours: [],
      weeklyTrends: [],
      eventsFilter: 'today',
      severityFilter: '',
      loading: false,
      loadingText: 'Loading...',
      focusTimer: {
        isActive: false,
        isPaused: false,
        timeRemaining: 1500000, // 25 minutes in milliseconds
        duration: '1500000',
        customDuration: 25,
        sessionType: 'focus',
        pomodoroMode: true,
        timer: null
      }
    }
  },
  async mounted() {
    await this.loadData()
  },
  methods: {
    async loadData() {
      this.loading = true
      this.loadingText = 'Loading distraction data...'

      try {
        await Promise.all([
          this.loadSettings(),
          this.loadEvents(),
          this.loadStatistics(),
          this.loadPatterns()
        ])
      } catch (error) {
        console.error('Failed to load data:', error)
        this.$emit('error', 'Failed to load distraction management data')
      } finally {
        this.loading = false
      }
    },

    async loadSettings() {
      try {
        const settings = await window.electronAPI.invoke('distraction:get-settings')
        if (settings) {
          this.settings = { ...this.settings, ...settings }
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
      }
    },

    async saveSettings() {
      try {
        await window.electronAPI.invoke('distraction:save-settings', this.settings)
        this.$emit('success', 'Distraction settings saved successfully')
      } catch (error) {
        console.error('Failed to save settings:', error)
        this.$emit('error', 'Failed to save distraction settings')
      }
    },

    async loadEvents() {
      try {
        const timeRange = this.getTimeRange()
        const events = await window.electronAPI.invoke('distraction:get-events', timeRange)
        this.events = events
        this.filterEvents()
      } catch (error) {
        console.error('Failed to load events:', error)
      }
    },

    filterEvents() {
      this.filteredEvents = this.events.filter((event) => {
        return !this.severityFilter || event.severity === this.severityFilter
      })
    },

    async loadStatistics() {
      // Calculate statistics from events
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const todayEvents = this.events.filter((event) => new Date(event.timestamp) >= today)

      this.todayStats = {
        totalDistractions: todayEvents.length,
        totalDistractionTime: todayEvents.reduce((sum, event) => sum + event.duration, 0),
        longestDistraction: Math.max(...todayEvents.map((event) => event.duration), 0),
        productivityScore: this.calculateProductivityScore(todayEvents)
      }
    },

    async loadPatterns() {
      // Calculate patterns from events
      this.calculateTopDistractingApps()
      this.calculatePeakHours()
      this.calculateWeeklyTrends()
    },

    calculateTopDistractingApps() {
      const appTimes = {}
      this.events.forEach((event) => {
        if (!appTimes[event.appName]) {
          appTimes[event.appName] = 0
        }
        appTimes[event.appName] += event.duration
      })

      this.topDistractingApps = Object.entries(appTimes)
        .map(([name, totalTime]) => ({ name, totalTime }))
        .sort((a, b) => b.totalTime - a.totalTime)
        .slice(0, 5)
    },

    calculatePeakHours() {
      const hourCounts = {}
      this.events.forEach((event) => {
        const hour = new Date(event.timestamp).getHours()
        hourCounts[hour] = (hourCounts[hour] || 0) + 1
      })

      this.peakDistractionHours = Object.entries(hourCounts)
        .map(([hour, count]) => ({ hour: parseInt(hour), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    },

    calculateWeeklyTrends() {
      const dayNames = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday'
      ]
      const dayStats = {}

      // Initialize all days
      dayNames.forEach((day) => {
        dayStats[day] = { events: 0, totalTime: 0 }
      })

      // Calculate stats for each day
      this.events.forEach((event) => {
        const dayName = dayNames[new Date(event.timestamp).getDay()]
        dayStats[dayName].events++
        dayStats[dayName].totalTime += event.duration
      })

      this.weeklyTrends = dayNames.map((day) => ({
        day,
        productivityScore: this.calculateDayProductivityScore(dayStats[day])
      }))
    },

    calculateProductivityScore(events) {
      if (events.length === 0) return 100

      const totalTime = events.reduce((sum, event) => sum + event.duration, 0)
      const highSeverityTime = events
        .filter((event) => event.severity === 'high')
        .reduce((sum, event) => sum + event.duration, 0)

      const distractionRatio = totalTime > 0 ? highSeverityTime / totalTime : 0
      return Math.max(0, Math.round(100 - distractionRatio * 100))
    },

    calculateDayProductivityScore(dayStats) {
      if (dayStats.events === 0) return 100

      // Simple calculation based on number of events and total time
      const eventPenalty = Math.min(dayStats.events * 2, 50)
      const timePenalty = Math.min((dayStats.totalTime / 60000) * 5, 50) // Convert ms to minutes

      return Math.max(0, Math.round(100 - eventPenalty - timePenalty))
    },

    getTimeRange() {
      const now = new Date()
      let startTime

      switch (this.eventsFilter) {
        case 'today':
          startTime = new Date(now)
          startTime.setHours(0, 0, 0, 0)
          break
        case 'week':
          startTime = new Date(now)
          startTime.setDate(now.getDate() - 7)
          break
        case 'month':
          startTime = new Date(now)
          startTime.setMonth(now.getMonth() - 1)
          break
        default:
          startTime = new Date(now)
          startTime.setHours(0, 0, 0, 0)
      }

      return {
        startTime: startTime.getTime(),
        endTime: now.getTime()
      }
    },

    async refreshData() {
      await this.loadData()
    },

    async testNotification() {
      try {
        // This would trigger a test notification from the main process
        await window.electronAPI.invoke('distraction:test-notification')
        this.$emit('success', 'Test notification sent')
      } catch (error) {
        console.error('Failed to send test notification:', error)
        this.$emit('error', 'Failed to send test notification')
      }
    },

    async categorizeApp(appName) {
      this.$emit('navigate-to-categorization', appName)
    },

    async addToWhitelist(appName) {
      // This would add the app to a whitelist to prevent future distraction alerts
      try {
        await window.electronAPI.invoke('app-categories:save', {
          appName,
          category: 'Productivity',
          productivityRating: 'productive',
          userDefined: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        })

        this.$emit('success', `${appName} added to productive apps`)
        await this.loadEvents()
      } catch (error) {
        console.error('Failed to add to whitelist:', error)
        this.$emit('error', 'Failed to add app to whitelist')
      }
    },

    formatDuration(milliseconds) {
      if (!milliseconds) return '0m'

      const minutes = Math.floor(milliseconds / 60000)
      const hours = Math.floor(minutes / 60)

      if (hours > 0) {
        const remainingMinutes = minutes % 60
        return `${hours}h ${remainingMinutes}m`
      }

      return `${minutes}m`
    },

    formatEventTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    },

    formatHour(hour) {
      return new Date(2000, 0, 1, hour).toLocaleTimeString([], {
        hour: 'numeric',
        hour12: true
      })
    },

    // Focus Timer Methods
    startFocusSession() {
      const duration =
        this.focusTimer.duration === 'custom'
          ? this.focusTimer.customDuration * 60000
          : parseInt(this.focusTimer.duration)

      this.focusTimer.timeRemaining = duration
      this.focusTimer.isActive = true
      this.focusTimer.isPaused = false
      this.focusTimer.sessionType = 'focus'

      this.startTimer()

      // Notify about focus session start
      if (window.electronAPI) {
        window.electronAPI.invoke('focus-session:start', {
          duration,
          type: this.focusTimer.pomodoroMode ? 'pomodoro' : 'custom'
        })
      }
    },

    pauseFocusSession() {
      this.focusTimer.isPaused = true
      this.stopTimer()

      if (window.electronAPI) {
        window.electronAPI.invoke('focus-session:pause')
      }
    },

    resumeFocusSession() {
      this.focusTimer.isPaused = false
      this.startTimer()

      if (window.electronAPI) {
        window.electronAPI.invoke('focus-session:resume')
      }
    },

    stopFocusSession() {
      this.focusTimer.isActive = false
      this.focusTimer.isPaused = false
      this.stopTimer()

      if (window.electronAPI) {
        window.electronAPI.invoke('focus-session:stop')
      }

      // Reset timer
      const duration =
        this.focusTimer.duration === 'custom'
          ? this.focusTimer.customDuration * 60000
          : parseInt(this.focusTimer.duration)
      this.focusTimer.timeRemaining = duration
    },

    startTimer() {
      if (this.focusTimer.timer) {
        clearInterval(this.focusTimer.timer)
      }

      this.focusTimer.timer = setInterval(() => {
        if (this.focusTimer.timeRemaining > 0) {
          this.focusTimer.timeRemaining -= 1000
        } else {
          this.onTimerComplete()
        }
      }, 1000)
    },

    stopTimer() {
      if (this.focusTimer.timer) {
        clearInterval(this.focusTimer.timer)
        this.focusTimer.timer = null
      }
    },

    onTimerComplete() {
      this.stopTimer()

      if (this.focusTimer.sessionType === 'focus') {
        // Focus session completed
        if (this.focusTimer.pomodoroMode) {
          // Start break
          this.focusTimer.sessionType = 'break'
          this.focusTimer.timeRemaining = 300000 // 5 minutes break
          this.startTimer()

          // Show notification
          this.showNotification('Focus session completed! Time for a break.', 'success')
        } else {
          // End session
          this.focusTimer.isActive = false
          this.showNotification('Focus session completed!', 'success')
        }
      } else {
        // Break completed
        this.focusTimer.isActive = false
        this.focusTimer.sessionType = 'focus'
        this.showNotification('Break time is over! Ready for another focus session?', 'info')
      }

      if (window.electronAPI) {
        window.electronAPI.invoke('focus-session:complete', {
          type: this.focusTimer.sessionType
        })
      }
    },

    formatTime(milliseconds) {
      const totalSeconds = Math.floor(milliseconds / 1000)
      const minutes = Math.floor(totalSeconds / 60)
      const seconds = totalSeconds % 60

      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    },

    showNotification(message, type = 'info') {
      // Simple notification - could be enhanced with a proper notification system
      console.log(`${type.toUpperCase()}: ${message}`)

      if (window.electronAPI) {
        window.electronAPI.invoke('notification:show', {
          title: 'Focus Session',
          body: message,
          type
        })
      }
    }
  },

  beforeUnmount() {
    // Clean up timer when component is destroyed
    if (this.focusTimer.timer) {
      clearInterval(this.focusTimer.timer)
    }
  }
}
</script>

<style scoped>
.distraction-management {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header h2 {
  margin: 0;
  color: #333;
}

.actions {
  display: flex;
  gap: 10px;
}

.settings-section,
.stats-section,
.events-section,
.patterns-section {
  margin-bottom: 30px;
}

.settings-section h3,
.stats-section h3,
.events-section h3,
.patterns-section h3 {
  margin-bottom: 15px;
  color: #333;
}

.settings-card {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 20px;
}

.setting-group {
  margin-bottom: 20px;
}

.setting-label {
  display: block;
  font-weight: bold;
  color: #333;
  margin-bottom: 8px;
}

.setting-checkbox {
  margin-right: 8px;
}

.setting-input,
.setting-select {
  width: 100%;
  max-width: 200px;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.setting-description {
  margin: 5px 0 0 0;
  color: #6c757d;
  font-size: 0.9em;
}

.quiet-hours-config {
  margin-left: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 4px;
}

.time-range {
  display: flex;
  gap: 20px;
}

.time-input-group {
  display: flex;
  flex-direction: column;
}

.time-input-group label {
  margin-bottom: 5px;
  font-size: 0.9em;
  color: #555;
}

.time-input {
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.stat-card {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  border: 1px solid #e9ecef;
}

.stat-value {
  font-size: 2em;
  font-weight: bold;
  color: #007bff;
  margin-bottom: 5px;
}

.stat-label {
  color: #6c757d;
  font-size: 0.9em;
}

.events-filter {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.filter-select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.events-list {
  display: grid;
  gap: 15px;
}

.no-events {
  text-align: center;
  padding: 40px;
  color: #6c757d;
}

.event-card {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 15px;
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.event-app {
  font-weight: bold;
  color: #333;
}

.event-severity {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.8em;
  font-weight: bold;
}

.event-severity.low {
  background: #d4edda;
  color: #155724;
}

.event-severity.medium {
  background: #fff3cd;
  color: #856404;
}

.event-severity.high {
  background: #f8d7da;
  color: #721c24;
}

.event-time {
  color: #6c757d;
  font-size: 0.9em;
}

.event-details {
  display: flex;
  gap: 20px;
  margin-bottom: 10px;
  color: #6c757d;
  font-size: 0.9em;
}

.event-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.patterns-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.pattern-card {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 20px;
}

.pattern-card h4 {
  margin: 0 0 15px 0;
  color: #333;
}

.pattern-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pattern-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f1f1f1;
}

.pattern-item:last-child {
  border-bottom: none;
}

.app-name,
.hour-label,
.day-name {
  font-weight: 500;
  color: #333;
}

.app-time,
.hour-count,
.day-score {
  color: #6c757d;
  font-size: 0.9em;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #545b62;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

.loading-text {
  color: white;
  font-size: 16px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.icon-refresh::before {
  content: '🔄';
  margin-right: 5px;
}

.icon-test::before {
  content: '🔔';
  margin-right: 5px;
}
</style>
