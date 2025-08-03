<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface TrackerConfig {
  screenshotInterval: number
  idleThreshold: number
  enableScreenshots: boolean
  enableWebTracking: boolean
  trackingEnabled: boolean
}

interface PrivacySettings {
  anonymizeWindowTitles: boolean
  anonymizeUrls: boolean
  excludedApps: string[]
  excludedDomains: string[]
  enableScreenshots: boolean
  screenshotBlurLevel: number
  dataRetentionDays: number
  exportDataOnDelete: boolean
}

interface NotificationSettings {
  enableProductivityInsights: boolean
  enableDistractionAlerts: boolean
  enableFocusReminders: boolean
  enableBreakReminders: boolean
  notificationStyle: 'gentle' | 'standard' | 'minimal'
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
  workHoursEnabled: boolean
  workHoursStart: string
  workHoursEnd: string
  productivityGoalAlerts: boolean
  weeklyReportEnabled: boolean
}

interface ProductivitySettings {
  dailyGoalHours: number
  weeklyGoalHours: number
  focusSessionDuration: number
  breakDuration: number
  longBreakDuration: number
  sessionsBeforeLongBreak: number
  autoStartFocusSessions: boolean
  enablePomodoroMode: boolean
  distractionThreshold: number
  contextSwitchThreshold: number
}

interface DataManagementSettings {
  autoCleanupEnabled: boolean
  cleanupIntervalDays: number
  backupEnabled: boolean
  backupLocation: string
  exportFormat: 'json' | 'csv'
  includeScreenshots: boolean
}

const config = ref<TrackerConfig>({
  screenshotInterval: 5,
  idleThreshold: 60,
  enableScreenshots: false,
  enableWebTracking: true,
  trackingEnabled: false
})

const privacySettings = ref<PrivacySettings>({
  anonymizeWindowTitles: false,
  anonymizeUrls: false,
  excludedApps: [],
  excludedDomains: [],
  enableScreenshots: false,
  screenshotBlurLevel: 0,
  dataRetentionDays: 365,
  exportDataOnDelete: false
})

const notificationSettings = ref<NotificationSettings>({
  enableProductivityInsights: true,
  enableDistractionAlerts: true,
  enableFocusReminders: true,
  enableBreakReminders: true,
  notificationStyle: 'gentle',
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  workHoursEnabled: false,
  workHoursStart: '09:00',
  workHoursEnd: '17:00',
  productivityGoalAlerts: true,
  weeklyReportEnabled: true
})

const productivitySettings = ref<ProductivitySettings>({
  dailyGoalHours: 8,
  weeklyGoalHours: 40,
  focusSessionDuration: 25,
  breakDuration: 5,
  longBreakDuration: 15,
  sessionsBeforeLongBreak: 4,
  autoStartFocusSessions: false,
  enablePomodoroMode: false,
  distractionThreshold: 15,
  contextSwitchThreshold: 20
})

const dataManagementSettings = ref<DataManagementSettings>({
  autoCleanupEnabled: false,
  cleanupIntervalDays: 90,
  backupEnabled: false,
  backupLocation: '',
  exportFormat: 'json',
  includeScreenshots: false
})

const loading = ref(true)
const saving = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error'>('success')
const dataPath = ref('')
const activeTab = ref('general')
const newExcludedApp = ref('')
const newExcludedDomain = ref('')

const screenshotIntervals = [
  { value: 1, label: '1 minute' },
  { value: 2, label: '2 minutes' },
  { value: 5, label: '5 minutes' },
  { value: 10, label: '10 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' }
]

const idleThresholds = [
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 120, label: '2 minutes' },
  { value: 300, label: '5 minutes' },
  { value: 600, label: '10 minutes' }
]

const loadConfig = async () => {
  try {
    loading.value = true
    if (!window.api || !window.api.tracker) {
      console.warn('Tracker API not available, using default config')
      // Use default config values
      config.value = {
        screenshotInterval: 5,
        idleThreshold: 60,
        enableScreenshots: false,
        enableWebTracking: true,
        trackingEnabled: false
      }
    } else {
      const currentConfig = await window.api.tracker.getConfig()
      config.value = { ...currentConfig }
      
      // Load privacy settings
      try {
        const privacy = await window.api.database.getPrivacySettings()
        if (privacy) {
          privacySettings.value = { ...privacySettings.value, ...privacy }
        }
      } catch (error) {
        console.warn('Failed to load privacy settings:', error)
      }
      
      // Load notification settings
      try {
        const notifications = await window.api.database.getUserPreference('notificationSettings')
        if (notifications) {
          notificationSettings.value = { ...notificationSettings.value, ...JSON.parse(notifications) }
        }
      } catch (error) {
        console.warn('Failed to load notification settings:', error)
      }
      
      // Load productivity settings
      try {
        const productivity = await window.api.database.getUserPreference('productivitySettings')
        if (productivity) {
          productivitySettings.value = { ...productivitySettings.value, ...JSON.parse(productivity) }
        }
      } catch (error) {
        console.warn('Failed to load productivity settings:', error)
      }
      
      // Load data management settings
      try {
        const dataManagement = await window.api.database.getUserPreference('dataManagementSettings')
        if (dataManagement) {
          dataManagementSettings.value = { ...dataManagementSettings.value, ...JSON.parse(dataManagement) }
        }
      } catch (error) {
        console.warn('Failed to load data management settings:', error)
      }
    }

    if (window.api && window.api.data) {
      const path = await window.api.data.getDataPath()
      dataPath.value = path
    } else {
      dataPath.value = 'Data path not available in demo mode'
    }
  } catch (error) {
    console.error('Failed to load config:', error)
    showMessage('Failed to load settings', 'error')
  } finally {
    loading.value = false
  }
}

const saveConfig = async () => {
  try {
    saving.value = true
    if (!window.api || !window.api.tracker) {
      console.warn('Tracker API not available, simulating save')
      showMessage('Settings saved successfully! (Demo Mode)', 'success')
    } else {
      const result = await window.api.tracker.updateConfig(config.value)

      if (result.success) {
        // Save privacy settings
        await window.api.database.savePrivacySettings(privacySettings.value)
        
        // Save notification settings
        await window.api.database.saveUserPreference('notificationSettings', notificationSettings.value, 'json')
        
        // Save productivity settings
        await window.api.database.saveUserPreference('productivitySettings', productivitySettings.value, 'json')
        
        // Save data management settings
        await window.api.database.saveUserPreference('dataManagementSettings', dataManagementSettings.value, 'json')
        
        showMessage('Settings saved successfully', 'success')
      } else {
        showMessage(result.error || 'Failed to save settings', 'error')
      }
    }
  } catch (error) {
    console.error('Failed to save config:', error)
    showMessage('Failed to save settings', 'error')
  } finally {
    saving.value = false
  }
}

const exportData = async (format: 'json' | 'csv') => {
  try {
    if (!window.api || !window.api.data) {
      console.warn('Data API not available, simulating export')
      showMessage(`Data export as ${format.toUpperCase()} simulated! (Demo Mode)`, 'success')
    } else {
      const result = await window.api.data.export(format)

      if (result.success) {
        showMessage(`Data exported as ${format.toUpperCase()}`, 'success')
      } else {
        showMessage(result.error || 'Export failed', 'error')
      }
    }
  } catch (error) {
    console.error('Failed to export data:', error)
    showMessage('Export failed', 'error')
  }
}

const showMessage = (text: string, type: 'success' | 'error') => {
  message.value = text
  messageType.value = type
  setTimeout(() => {
    message.value = ''
  }, 3000)
}

const openDataFolder = () => {
  if (!window.api || !window.api.shell) {
    console.warn('Shell API not available, cannot open folder')
    showMessage('Data folder access not available in demo mode', 'error')
    return
  }
  if (dataPath.value && dataPath.value !== 'Data path not available in demo mode') {
    window.api.shell.openPath(dataPath.value)
  } else {
    showMessage('Data path not available', 'error')
  }
}

const addExcludedApp = () => {
  if (newExcludedApp.value.trim() && !privacySettings.value.excludedApps.includes(newExcludedApp.value.trim())) {
    privacySettings.value.excludedApps.push(newExcludedApp.value.trim())
    newExcludedApp.value = ''
  }
}

const removeExcludedApp = (index: number) => {
  privacySettings.value.excludedApps.splice(index, 1)
}

const addExcludedDomain = () => {
  if (newExcludedDomain.value.trim() && !privacySettings.value.excludedDomains.includes(newExcludedDomain.value.trim())) {
    privacySettings.value.excludedDomains.push(newExcludedDomain.value.trim())
    newExcludedDomain.value = ''
  }
}

const removeExcludedDomain = (index: number) => {
  privacySettings.value.excludedDomains.splice(index, 1)
}

const selectBackupLocation = async () => {
  try {
    const result = await window.dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Backup Location'
    })
    if (!result.canceled && result.filePaths.length > 0) {
      dataManagementSettings.value.backupLocation = result.filePaths[0]
    }
  } catch (error) {
    console.error('Failed to select backup location:', error)
    showMessage('Failed to select backup location', 'error')
  }
}

const performBackup = async () => {
  try {
    if (!dataManagementSettings.value.backupLocation) {
      showMessage('Please select a backup location first', 'error')
      return
    }
    
    await window.api.database.backupDatabase(dataManagementSettings.value.backupLocation)
    showMessage('Backup completed successfully', 'success')
  } catch (error) {
    console.error('Failed to perform backup:', error)
    showMessage('Failed to perform backup', 'error')
  }
}

const cleanupOldData = async () => {
  if (confirm(`Are you sure you want to delete data older than ${dataManagementSettings.value.cleanupIntervalDays} days?`)) {
    try {
      const cutoffDate = new Date(Date.now() - (dataManagementSettings.value.cleanupIntervalDays * 24 * 60 * 60 * 1000))
      await window.api.database.cleanupOldData(cutoffDate)
      showMessage('Old data cleaned up successfully', 'success')
    } catch (error) {
      console.error('Failed to cleanup old data:', error)
      showMessage('Failed to cleanup old data', 'error')
    }
  }
}

const testNotification = () => {
  if (window.api && window.api.notification) {
    window.api.notification.show({
      title: 'Test Notification',
      body: 'This is a test notification to verify your settings.',
      type: notificationSettings.value.notificationStyle
    })
  } else {
    showMessage('Notification system not available', 'error')
  }
}

const resetSettings = async () => {
  if (confirm('Are you sure you want to reset all settings to default values?')) {
    config.value = {
      screenshotInterval: 5,
      idleThreshold: 60,
      enableScreenshots: false,
      enableWebTracking: true,
      trackingEnabled: false
    }
    
    privacySettings.value = {
      anonymizeWindowTitles: false,
      anonymizeUrls: false,
      excludedApps: [],
      excludedDomains: [],
      enableScreenshots: false,
      screenshotBlurLevel: 0,
      dataRetentionDays: 365,
      exportDataOnDelete: false
    }
    
    notificationSettings.value = {
      enableProductivityInsights: true,
      enableDistractionAlerts: true,
      enableFocusReminders: true,
      enableBreakReminders: true,
      notificationStyle: 'gentle',
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      workHoursEnabled: false,
      workHoursStart: '09:00',
      workHoursEnd: '17:00',
      productivityGoalAlerts: true,
      weeklyReportEnabled: true
    }
    
    productivitySettings.value = {
      dailyGoalHours: 8,
      weeklyGoalHours: 40,
      focusSessionDuration: 25,
      breakDuration: 5,
      longBreakDuration: 15,
      sessionsBeforeLongBreak: 4,
      autoStartFocusSessions: false,
      enablePomodoroMode: false,
      distractionThreshold: 15,
      contextSwitchThreshold: 20
    }
    
    dataManagementSettings.value = {
      autoCleanupEnabled: false,
      cleanupIntervalDays: 90,
      backupEnabled: false,
      backupLocation: '',
      exportFormat: 'json',
      includeScreenshots: false
    }
    
    await saveConfig()
  }
}

const tabs = [
  { id: 'general', label: 'General', icon: '⚙️' },
  { id: 'privacy', label: 'Privacy', icon: '🔒' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
  { id: 'productivity', label: 'Productivity', icon: '📊' },
  { id: 'data', label: 'Data Management', icon: '💾' }
]

const notificationStyles = [
  { value: 'gentle', label: 'Gentle (minimal interruption)' },
  { value: 'standard', label: 'Standard (normal notifications)' },
  { value: 'minimal', label: 'Minimal (essential only)' }
]

const exportFormats = [
  { value: 'json', label: 'JSON' },
  { value: 'csv', label: 'CSV' }
]

const blurLevels = [
  { value: 0, label: 'No blur' },
  { value: 1, label: 'Light blur' },
  { value: 2, label: 'Medium blur' },
  { value: 3, label: 'Heavy blur' }
]

const retentionOptions = [
  { value: 30, label: '30 days' },
  { value: 90, label: '3 months' },
  { value: 180, label: '6 months' },
  { value: 365, label: '1 year' },
  { value: 730, label: '2 years' },
  { value: -1, label: 'Never delete' }
]

onMounted(() => {
  loadConfig()
})
</script>

<template>
  <div class="settings-container">
    <div class="settings-header">
      <h1>Settings</h1>
      <p class="settings-description">
        Configure your activity tracking preferences, privacy settings, and productivity features.
      </p>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading settings...</p>
    </div>

    <div v-else class="settings-content">
      <!-- Message Display -->
      <div v-if="message" class="message" :class="messageType">
        {{ message }}
      </div>

      <!-- Tab Navigation -->
      <div class="tab-navigation">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          @click="activeTab = tab.id"
          :class="['tab-button', { active: activeTab === tab.id }]"
        >
          <span class="tab-icon">{{ tab.icon }}</span>
          {{ tab.label }}
        </button>
      </div>

      <!-- General Settings Tab -->
      <div v-if="activeTab === 'general'" class="tab-content">
        <div class="settings-section">
          <h2>Tracking Configuration</h2>
          
          <div class="setting-group">
            <label class="setting-label">
              <input 
                type="checkbox" 
                v-model="config.trackingEnabled"
                @change="saveConfig"
              >
              <span class="checkmark"></span>
              Enable Activity Tracking
            </label>
            <p class="setting-description">
              When enabled, the application will automatically track your active applications and time spent.
            </p>
          </div>

          <div class="setting-group">
            <label class="setting-label">
              <input 
                type="checkbox" 
                v-model="config.enableWebTracking"
                @change="saveConfig"
              >
              <span class="checkmark"></span>
              Enable Web Tracking
            </label>
            <p class="setting-description">
              Track website URLs and page titles when using web browsers.
            </p>
          </div>

          <div class="setting-group">
            <label for="idle-threshold">Idle Threshold</label>
            <select 
              id="idle-threshold" 
              v-model="config.idleThreshold" 
              @change="saveConfig"
              class="setting-select"
            >
              <option v-for="threshold in idleThresholds" :key="threshold.value" :value="threshold.value">
                {{ threshold.label }}
              </option>
            </select>
            <p class="setting-description">
              Time of inactivity before marking as idle.
            </p>
          </div>
        </div>

        <div class="settings-section">
          <h2>Screenshot Settings</h2>
          
          <div class="setting-group">
            <label class="setting-label">
              <input 
                type="checkbox" 
                v-model="config.enableScreenshots"
                @change="saveConfig"
              >
              <span class="checkmark"></span>
              Enable Screenshots
            </label>
            <p class="setting-description">
              Automatically capture screenshots at regular intervals. Screenshots are stored locally and never shared.
            </p>
          </div>

          <div v-if="config.enableScreenshots" class="setting-group">
            <label for="screenshot-interval">Screenshot Interval</label>
            <select 
              id="screenshot-interval" 
              v-model="config.screenshotInterval" 
              @change="saveConfig"
              class="setting-select"
            >
              <option v-for="interval in screenshotIntervals" :key="interval.value" :value="interval.value">
                {{ interval.label }}
              </option>
            </select>
            <p class="setting-description">
              How often to capture screenshots when enabled.
            </p>
          </div>
        </div>
      </div>

      <!-- Privacy Settings Tab -->
      <div v-if="activeTab === 'privacy'" class="tab-content">
        <div class="settings-section">
          <h2>Privacy Controls</h2>
          
          <div class="setting-group">
            <label class="setting-label">
              <input 
                type="checkbox" 
                v-model="privacySettings.anonymizeWindowTitles"
                @change="saveConfig"
              >
              <span class="checkmark"></span>
              Anonymize Window Titles
            </label>
            <p class="setting-description">
              Replace window titles with generic labels to protect sensitive information.
            </p>
          </div>

          <div class="setting-group">
            <label class="setting-label">
              <input 
                type="checkbox" 
                v-model="privacySettings.anonymizeUrls"
                @change="saveConfig"
              >
              <span class="checkmark"></span>
              Anonymize URLs
            </label>
            <p class="setting-description">
              Replace URLs with domain names only to protect browsing privacy.
            </p>
          </div>

          <div class="setting-group">
            <label for="screenshot-blur">Screenshot Blur Level</label>
            <select 
              id="screenshot-blur" 
              v-model="privacySettings.screenshotBlurLevel" 
              @change="saveConfig"
              class="setting-select"
            >
              <option v-for="level in blurLevels" :key="level.value" :value="level.value">
                {{ level.label }}
              </option>
            </select>
            <p class="setting-description">
              Apply blur to screenshots to protect sensitive content.
            </p>
          </div>

          <div class="setting-group">
            <label for="data-retention">Data Retention Period</label>
            <select 
              id="data-retention" 
              v-model="privacySettings.dataRetentionDays" 
              @change="saveConfig"
              class="setting-select"
            >
              <option v-for="option in retentionOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <p class="setting-description">
              Automatically delete data older than the specified period.
            </p>
          </div>
        </div>

        <div class="settings-section">
          <h2>Application Exclusions</h2>
          
          <div class="setting-group">
            <label>Excluded Applications</label>
            <div class="exclusion-input">
              <input 
                type="text" 
                v-model="newExcludedApp" 
                placeholder="Enter application name"
                @keyup.enter="addExcludedApp"
                class="setting-input"
              >
              <button @click="addExcludedApp" class="add-button">Add</button>
            </div>
            <div class="exclusion-list">
              <div v-for="(app, index) in privacySettings.excludedApps" :key="index" class="exclusion-item">
                <span>{{ app }}</span>
                <button @click="removeExcludedApp(index)" class="remove-button">×</button>
              </div>
            </div>
            <p class="setting-description">
              Applications in this list will not be tracked.
            </p>
          </div>

          <div class="setting-group">
            <label>Excluded Domains</label>
            <div class="exclusion-input">
              <input 
                type="text" 
                v-model="newExcludedDomain" 
                placeholder="Enter domain (e.g., example.com)"
                @keyup.enter="addExcludedDomain"
                class="setting-input"
              >
              <button @click="addExcludedDomain" class="add-button">Add</button>
            </div>
            <div class="exclusion-list">
              <div v-for="(domain, index) in privacySettings.excludedDomains" :key="index" class="exclusion-item">
                <span>{{ domain }}</span>
                <button @click="removeExcludedDomain(index)" class="remove-button">×</button>
              </div>
            </div>
            <p class="setting-description">
              Websites from these domains will not be tracked.
            </p>
          </div>
        </div>
      </div>

      <!-- Notifications Tab -->
      <div v-if="activeTab === 'notifications'" class="tab-content">
        <div class="settings-section">
          <h2>Notification Preferences</h2>
          
          <div class="setting-group">
            <label class="setting-label">
              <input 
                type="checkbox" 
                v-model="notificationSettings.enableProductivityInsights"
                @change="saveConfig"
              >
              <span class="checkmark"></span>
              Productivity Insights
            </label>
            <p class="setting-description">
              Receive notifications about productivity patterns and insights.
            </p>
          </div>

          <div class="setting-group">
            <label class="setting-label">
              <input 
                type="checkbox" 
                v-model="notificationSettings.enableDistractionAlerts"
                @change="saveConfig"
              >
              <span class="checkmark"></span>
              Distraction Alerts
            </label>
            <p class="setting-description">
              Get gentle reminders when spending too much time on distracting activities.
            </p>
          </div>

          <div class="setting-group">
            <label class="setting-label">
              <input 
                type="checkbox" 
                v-model="notificationSettings.enableFocusReminders"
                @change="saveConfig"
              >
              <span class="checkmark"></span>
              Focus Session Reminders
            </label>
            <p class="setting-description">
              Receive reminders to start focus sessions and maintain productivity.
            </p>
          </div>

          <div class="setting-group">
            <label class="setting-label">
              <input 
                type="checkbox" 
                v-model="notificationSettings.enableBreakReminders"
                @change="saveConfig"
              >
              <span class="checkmark"></span>
              Break Reminders
            </label>
            <p class="setting-description">
              Get reminders to take breaks during long work sessions.
            </p>
          </div>

          <div class="setting-group">
            <label for="notification-style">Notification Style</label>
            <select 
              id="notification-style" 
              v-model="notificationSettings.notificationStyle" 
              @change="saveConfig"
              class="setting-select"
            >
              <option v-for="style in notificationStyles" :key="style.value" :value="style.value">
                {{ style.label }}
              </option>
            </select>
            <p class="setting-description">
              Choose how intrusive notifications should be.
            </p>
          </div>

          <div class="setting-group">
            <button @click="testNotification" class="secondary-button">
              Test Notification
            </button>
            <p class="setting-description">
              Send a test notification to verify your settings.
            </p>
          </div>
        </div>

        <div class="settings-section">
          <h2>Quiet Hours & Work Schedule</h2>
          
          <div class="setting-group">
            <label class="setting-label">
              <input 
                type="checkbox" 
                v-model="notificationSettings.quietHoursEnabled"
                @change="saveConfig"
              >
              <span class="checkmark"></span>
              Enable Quiet Hours
            </label>
            <p class="setting-description">
              Disable notifications during specified hours.
            </p>
          </div>

          <div v-if="notificationSettings.quietHoursEnabled" class="time-range-group">
            <div class="time-input-group">
              <label for="quiet-start">Start Time</label>
              <input 
                id="quiet-start"
                type="time" 
                v-model="notificationSettings.quietHoursStart" 
                @change="saveConfig"
                class="setting-input"
              >
            </div>
            <div class="time-input-group">
              <label for="quiet-end">End Time</label>
              <input 
                id="quiet-end"
                type="time" 
                v-model="notificationSettings.quietHoursEnd" 
                @change="saveConfig"
                class="setting-input"
              >
            </div>
          </div>

          <div class="setting-group">
            <label class="setting-label">
              <input 
                type="checkbox" 
                v-model="notificationSettings.workHoursEnabled"
                @change="saveConfig"
              >
              <span class="checkmark"></span>
              Enable Work Hours
            </label>
            <p class="setting-description">
              Define your work hours for better productivity tracking.
            </p>
          </div>

          <div v-if="notificationSettings.workHoursEnabled" class="time-range-group">
            <div class="time-input-group">
              <label for="work-start">Start Time</label>
              <input 
                id="work-start"
                type="time" 
                v-model="notificationSettings.workHoursStart" 
                @change="saveConfig"
                class="setting-input"
              >
            </div>
            <div class="time-input-group">
              <label for="work-end">End Time</label>
              <input 
                id="work-end"
                type="time" 
                v-model="notificationSettings.workHoursEnd" 
                @change="saveConfig"
                class="setting-input"
              >
            </div>
          </div>
        </div>
      </div>

      <!-- Productivity Settings Tab -->
      <div v-if="activeTab === 'productivity'" class="tab-content">
        <div class="settings-section">
          <h2>Productivity Goals</h2>
          
          <div class="setting-group">
            <label for="daily-goal">Daily Goal (hours)</label>
            <input 
              id="daily-goal"
              type="number" 
              v-model="productivitySettings.dailyGoalHours" 
              @change="saveConfig"
              min="1" 
              max="16" 
              step="0.5"
              class="setting-input"
            >
            <p class="setting-description">
              Target number of productive hours per day.
            </p>
          </div>

          <div class="setting-group">
            <label for="weekly-goal">Weekly Goal (hours)</label>
            <input 
              id="weekly-goal"
              type="number" 
              v-model="productivitySettings.weeklyGoalHours" 
              @change="saveConfig"
              min="1" 
              max="80" 
              step="1"
              class="setting-input"
            >
            <p class="setting-description">
              Target number of productive hours per week.
            </p>
          </div>

          <div class="setting-group">
            <label class="setting-label">
              <input 
                type="checkbox" 
                v-model="notificationSettings.productivityGoalAlerts"
                @change="saveConfig"
              >
              <span class="checkmark"></span>
              Goal Achievement Alerts
            </label>
            <p class="setting-description">
              Receive notifications when you reach your productivity goals.
            </p>
          </div>
        </div>

        <div class="settings-section">
          <h2>Focus Sessions & Pomodoro</h2>
          
          <div class="setting-group">
            <label class="setting-label">
              <input 
                type="checkbox" 
                v-model="productivitySettings.enablePomodoroMode"
                @change="saveConfig"
              >
              <span class="checkmark"></span>
              Enable Pomodoro Mode
            </label>
            <p class="setting-description">
              Use the Pomodoro Technique for structured work sessions.
            </p>
          </div>

          <div class="setting-group">
            <label for="focus-duration">Focus Session Duration (minutes)</label>
            <input 
              id="focus-duration"
              type="number" 
              v-model="productivitySettings.focusSessionDuration" 
              @change="saveConfig"
              min="5" 
              max="120" 
              step="5"
              class="setting-input"
            >
            <p class="setting-description">
              Length of each focus session.
            </p>
          </div>

          <div class="setting-group">
            <label for="break-duration">Short Break Duration (minutes)</label>
            <input 
              id="break-duration"
              type="number" 
              v-model="productivitySettings.breakDuration" 
              @change="saveConfig"
              min="1" 
              max="30" 
              step="1"
              class="setting-input"
            >
            <p class="setting-description">
              Length of short breaks between focus sessions.
            </p>
          </div>

          <div class="setting-group">
            <label for="long-break-duration">Long Break Duration (minutes)</label>
            <input 
              id="long-break-duration"
              type="number" 
              v-model="productivitySettings.longBreakDuration" 
              @change="saveConfig"
              min="5" 
              max="60" 
              step="5"
              class="setting-input"
            >
            <p class="setting-description">
              Length of long breaks after several focus sessions.
            </p>
          </div>

          <div class="setting-group">
            <label for="sessions-before-long-break">Sessions Before Long Break</label>
            <input 
              id="sessions-before-long-break"
              type="number" 
              v-model="productivitySettings.sessionsBeforeLongBreak" 
              @change="saveConfig"
              min="2" 
              max="8" 
              step="1"
              class="setting-input"
            >
            <p class="setting-description">
              Number of focus sessions before taking a long break.
            </p>
          </div>
        </div>

        <div class="settings-section">
          <h2>Distraction Management</h2>
          
          <div class="setting-group">
            <label for="distraction-threshold">Distraction Threshold (minutes)</label>
            <input 
              id="distraction-threshold"
              type="number" 
              v-model="productivitySettings.distractionThreshold" 
              @change="saveConfig"
              min="1" 
              max="60" 
              step="1"
              class="setting-input"
            >
            <p class="setting-description">
              Time spent on distracting activities before showing an alert.
            </p>
          </div>

          <div class="setting-group">
            <label for="context-switch-threshold">Context Switch Threshold (per hour)</label>
            <input 
              id="context-switch-threshold"
              type="number" 
              v-model="productivitySettings.contextSwitchThreshold" 
              @change="saveConfig"
              min="5" 
              max="100" 
              step="5"
              class="setting-input"
            >
            <p class="setting-description">
              Number of application switches per hour before showing a warning.
            </p>
          </div>
        </div>
      </div>

      <!-- Data Management Tab -->
      <div v-if="activeTab === 'data'" class="tab-content">
        <div class="settings-section">
          <h2>Data Storage</h2>
          
          <div class="setting-group">
            <label>Data Location</label>
            <div class="data-path-display">
              <code>{{ dataPath }}</code>
              <button @click="openDataFolder" class="secondary-button">
                Open Folder
              </button>
            </div>
            <p class="setting-description">
              All your activity data is stored locally in this folder.
            </p>
          </div>

          <div class="setting-group">
            <label class="setting-label">
              <input 
                type="checkbox" 
                v-model="dataManagementSettings.autoCleanupEnabled"
                @change="saveConfig"
              >
              <span class="checkmark"></span>
              Enable Automatic Cleanup
            </label>
            <p class="setting-description">
              Automatically delete old data based on retention settings.
            </p>
          </div>

          <div v-if="dataManagementSettings.autoCleanupEnabled" class="setting-group">
            <label for="cleanup-interval">Cleanup Interval (days)</label>
            <input 
              id="cleanup-interval"
              type="number" 
              v-model="dataManagementSettings.cleanupIntervalDays" 
              @change="saveConfig"
              min="7" 
              max="365" 
              step="1"
              class="setting-input"
            >
            <p class="setting-description">
              Delete data older than this many days.
            </p>
          </div>

          <div class="setting-group">
            <button @click="cleanupOldData" class="warning-button">
              Clean Up Old Data Now
            </button>
            <p class="setting-description">
              Manually delete old data based on current retention settings.
            </p>
          </div>
        </div>

        <div class="settings-section">
          <h2>Backup & Export</h2>
          
          <div class="setting-group">
            <label class="setting-label">
              <input 
                type="checkbox" 
                v-model="dataManagementSettings.backupEnabled"
                @change="saveConfig"
              >
              <span class="checkmark"></span>
              Enable Automatic Backups
            </label>
            <p class="setting-description">
              Automatically backup your data to a specified location.
            </p>
          </div>

          <div v-if="dataManagementSettings.backupEnabled" class="setting-group">
            <label>Backup Location</label>
            <div class="backup-location">
              <input 
                type="text" 
                v-model="dataManagementSettings.backupLocation" 
                readonly
                placeholder="Select backup location"
                class="setting-input"
              >
              <button @click="selectBackupLocation" class="secondary-button">
                Browse
              </button>
            </div>
            <p class="setting-description">
              Choose where to store automatic backups.
            </p>
          </div>

          <div class="setting-group">
            <button @click="performBackup" class="secondary-button">
              Create Backup Now
            </button>
            <p class="setting-description">
              Manually create a backup of your current data.
            </p>
          </div>

          <div class="setting-group">
            <label for="export-format">Export Format</label>
            <select 
              id="export-format" 
              v-model="dataManagementSettings.exportFormat" 
              @change="saveConfig"
              class="setting-select"
            >
              <option v-for="format in exportFormats" :key="format.value" :value="format.value">
                {{ format.label }}
              </option>
            </select>
            <p class="setting-description">
              Default format for data exports.
            </p>
          </div>

          <div class="setting-group">
            <label class="setting-label">
              <input 
                type="checkbox" 
                v-model="dataManagementSettings.includeScreenshots"
                @change="saveConfig"
              >
              <span class="checkmark"></span>
              Include Screenshots in Exports
            </label>
            <p class="setting-description">
              Include screenshot files when exporting data.
            </p>
          </div>

          <div class="setting-group">
            <label>Export Data</label>
            <div class="export-buttons">
              <button @click="exportData('json')" class="secondary-button">
                Export as JSON
              </button>
              <button @click="exportData('csv')" class="secondary-button">
                Export as CSV
              </button>
            </div>
            <p class="setting-description">
              Export your activity data for backup or analysis in external tools.
            </p>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="settings-actions">
        <button class="reset-button" @click="resetSettings">
          Reset to Defaults
        </button>
        <button class="save-button" @click="saveConfig" :disabled="loading || saving">
          <span v-if="saving">Saving...</span>
          <span v-else>Save All Settings</span>
        </button>
      </div>
    </div>

    <!-- About Section -->
    <div class="about-section">
      <h2>About</h2>
      <div class="about-content">
        <div class="about-item">
          <strong>Version:</strong> 1.0.0
        </div>
        <div class="about-item">
          <strong>Built with:</strong> Electron, Vue 3, TypeScript
        </div>
        <div class="about-item">
          <strong>Privacy:</strong> All data stored locally, no cloud dependencies
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100vh;
}

.settings-header {
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.settings-header h1 {
  font-size: 2.5rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
}

.settings-description {
  color: var(--text-secondary);
  font-size: 1.1rem;
  margin: 0;
}

.loading-state {
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
  border: 3px solid var(--border-color);
  border-top: 3px solid var(--accent-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.message {
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  font-weight: 500;
}

.message.success {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.message.error {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

/* Tab Navigation */
.tab-navigation {
  display: flex;
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 0.5rem;
  margin-bottom: 2rem;
  gap: 0.25rem;
  overflow-x: auto;
}

.tab-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  white-space: nowrap;
  min-width: fit-content;
}

.tab-button:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.tab-button.active {
  background: var(--accent-color);
  color: white;
}

.tab-icon {
  font-size: 1.1rem;
}

/* Tab Content */
.tab-content {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.settings-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.settings-section h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 1.5rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-color);
}

.setting-group {
  margin-bottom: 1.5rem;
}

.setting-group:last-child {
  margin-bottom: 0;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
  cursor: pointer;
}

.setting-label input[type="checkbox"] {
  display: none;
}

.checkmark {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-color);
  border-radius: 4px;
  position: relative;
  transition: all 0.2s;
}

.setting-label input[type="checkbox"]:checked + .checkmark {
  background: var(--accent-color);
  border-color: var(--accent-color);
}

.setting-label input[type="checkbox"]:checked + .checkmark::after {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 12px;
  font-weight: bold;
}

.setting-description {
  color: var(--text-secondary);
  font-size: 0.875rem;
  line-height: 1.4;
  margin: 0.5rem 0 0 0;
}

.setting-select,
.setting-input {
  width: 100%;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0.75rem;
  color: var(--text-primary);
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.setting-select:focus,
.setting-input:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Exclusion Lists */
.exclusion-input {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.exclusion-input .setting-input {
  flex: 1;
  margin-top: 0;
}

.add-button {
  background: var(--accent-color);
  border: none;
  color: white;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.add-button:hover {
  background: #2563eb;
}

.exclusion-list {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.exclusion-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0.75rem;
}

.remove-button {
  background: #ef4444;
  border: none;
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: bold;
  transition: all 0.2s;
}

.remove-button:hover {
  background: #dc2626;
}

/* Time Range Groups */
.time-range-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 1rem;
}

.time-input-group {
  display: flex;
  flex-direction: column;
}

.time-input-group label {
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

/* Data Path Display */
.data-path-display {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 0.5rem;
}

.data-path-display code {
  flex: 1;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0.75rem;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  color: var(--text-secondary);
  word-break: break-all;
}

/* Backup Location */
.backup-location {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.backup-location .setting-input {
  flex: 1;
  margin-top: 0;
}

/* Export Buttons */
.export-buttons {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

/* Button Styles */
.secondary-button {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 0.75rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.secondary-button:hover {
  background: var(--bg-secondary);
  border-color: var(--accent-color);
}

.warning-button {
  background: #f59e0b;
  border: none;
  color: white;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.warning-button:hover {
  background: #d97706;
}

.save-button {
  background: var(--accent-color);
  border: none;
  color: white;
  padding: 0.75rem 2rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  font-size: 1rem;
  transition: all 0.2s;
}

.save-button:hover:not(:disabled) {
  background: #2563eb;
  transform: translateY(-1px);
}

.save-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.reset-button {
  background: transparent;
  border: 1px solid #ef4444;
  color: #ef4444;
  padding: 0.75rem 2rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  font-size: 1rem;
  transition: all 0.2s;
}

.reset-button:hover:not(:disabled) {
  background: #ef4444;
  color: white;
}

.reset-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Settings Actions */
.settings-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid var(--border-color);
}

/* About Section */
.about-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.5rem;
  margin-top: 2rem;
}

.about-section h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 1rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-color);
}

.about-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.about-item {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.about-item strong {
  color: var(--text-primary);
  font-weight: 600;
}

/* Responsive Design */
@media (max-width: 768px) {
  .settings-container {
    padding: 1rem;
  }
  
  .tab-navigation {
    flex-direction: column;
  }
  
  .tab-button {
    justify-content: center;
  }
  
  .time-range-group {
    grid-template-columns: 1fr;
  }
  
  .data-path-display,
  .backup-location,
  .exclusion-input {
    flex-direction: column;
  }
  
  .export-buttons {
    flex-direction: column;
  }
  
  .settings-actions {
    flex-direction: column;
  }
}
</style>
