<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface TrackerConfig {
  screenshotInterval: number
  idleThreshold: number
  enableScreenshots: boolean
  enableWebTracking: boolean
  trackingEnabled: boolean
}

const config = ref<TrackerConfig>({
  screenshotInterval: 5,
  idleThreshold: 60,
  enableScreenshots: false,
  enableWebTracking: true,
  trackingEnabled: false
})

const loading = ref(true)
const saving = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error'>('success')
const dataPath = ref('')

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
  if (!window.electron || !window.electron.shell) {
    console.warn('Shell API not available, cannot open folder')
    showMessage('Data folder access not available in demo mode', 'error')
    return
  }
  if (dataPath.value && dataPath.value !== 'Data path not available in demo mode') {
    window.electron.shell.openPath(dataPath.value)
  } else {
    showMessage('Data path not available', 'error')
  }
}

const resetSettings = () => {
  config.value = {
    screenshotInterval: 5,
    idleThreshold: 60,
    enableScreenshots: false,
    enableWebTracking: true,
    trackingEnabled: false
  }
}

onMounted(() => {
  loadConfig()
})
</script>

<template>
  <div class="settings">
    <div class="settings-header">
      <h2 class="settings-title">Settings</h2>
      <div class="settings-actions">
        <button class="reset-button" @click="resetSettings" :disabled="loading">
          Reset to Defaults
        </button>
        <button class="save-button" @click="saveConfig" :disabled="loading || saving">
          <span v-if="saving">Saving...</span>
          <span v-else>Save Settings</span>
        </button>
      </div>
    </div>

    <div v-if="message" class="message" :class="messageType">
      {{ message }}
    </div>

    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading settings...</p>
    </div>

    <div v-else class="settings-content">
      <!-- Tracking Settings -->
      <section class="settings-section">
        <h3 class="section-title">Tracking Settings</h3>

        <div class="setting-item">
          <div class="setting-info">
            <label class="setting-label">Enable Web Tracking</label>
            <p class="setting-description">Track URLs and web activity in supported browsers</p>
          </div>
          <div class="setting-control">
            <label class="toggle-switch">
              <input type="checkbox" v-model="config.enableWebTracking" />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <label class="setting-label">Idle Threshold</label>
            <p class="setting-description">Time of inactivity before marking as idle</p>
          </div>
          <div class="setting-control">
            <select v-model="config.idleThreshold" class="setting-select">
              <option
                v-for="threshold in idleThresholds"
                :key="threshold.value"
                :value="threshold.value"
              >
                {{ threshold.label }}
              </option>
            </select>
          </div>
        </div>
      </section>

      <!-- Screenshot Settings -->
      <section class="settings-section">
        <h3 class="section-title">Screenshot Settings</h3>

        <div class="setting-item">
          <div class="setting-info">
            <label class="setting-label">Enable Screenshots</label>
            <p class="setting-description">
              Automatically capture screenshots at regular intervals
            </p>
            <div class="setting-warning">⚠️ Screenshots may contain sensitive information</div>
          </div>
          <div class="setting-control">
            <label class="toggle-switch">
              <input type="checkbox" v-model="config.enableScreenshots" />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div class="setting-item" :class="{ disabled: !config.enableScreenshots }">
          <div class="setting-info">
            <label class="setting-label">Screenshot Interval</label>
            <p class="setting-description">How often to capture screenshots</p>
          </div>
          <div class="setting-control">
            <select
              v-model="config.screenshotInterval"
              class="setting-select"
              :disabled="!config.enableScreenshots"
            >
              <option
                v-for="interval in screenshotIntervals"
                :key="interval.value"
                :value="interval.value"
              >
                {{ interval.label }}
              </option>
            </select>
          </div>
        </div>
      </section>

      <!-- Data Management -->
      <section class="settings-section">
        <h3 class="section-title">Data Management</h3>

        <div class="setting-item">
          <div class="setting-info">
            <label class="setting-label">Data Location</label>
            <p class="setting-description">Where your activity data is stored</p>
            <code class="data-path">{{ dataPath }}</code>
          </div>
          <div class="setting-control">
            <button class="secondary-button" @click="openDataFolder">Open Folder</button>
          </div>
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <label class="setting-label">Export Data</label>
            <p class="setting-description">Export your activity data for backup or analysis</p>
          </div>
          <div class="setting-control">
            <div class="button-group">
              <button class="secondary-button" @click="exportData('json')">Export JSON</button>
              <button class="secondary-button" @click="exportData('csv')">Export CSV</button>
            </div>
          </div>
        </div>
      </section>

      <!-- Privacy & Security -->
      <section class="settings-section">
        <h3 class="section-title">Privacy & Security</h3>

        <div class="privacy-notice">
          <div class="privacy-icon">🔒</div>
          <div class="privacy-content">
            <h4>Your Privacy Matters</h4>
            <ul>
              <li>All data is stored locally on your device</li>
              <li>No data is sent to external servers</li>
              <li>Screenshots are optional and stored locally</li>
              <li>You can delete your data at any time</li>
            </ul>
          </div>
        </div>
      </section>

      <!-- About -->
      <section class="settings-section">
        <h3 class="section-title">About</h3>

        <div class="about-info">
          <div class="about-item">
            <span class="about-label">Version:</span>
            <span class="about-value">1.0.0</span>
          </div>
          <div class="about-item">
            <span class="about-label">Built with:</span>
            <span class="about-value">Electron + Vue 3 + TypeScript</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.settings {
  max-width: 800px;
  margin: 0 auto;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.settings-title {
  font-size: 2rem;
  font-weight: 700;
  margin: 0;
  color: var(--ev-c-text-1);
}

.settings-actions {
  display: flex;
  gap: 1rem;
}

.reset-button,
.save-button,
.secondary-button {
  padding: 0.5rem 1rem;
  border: 1px solid var(--ev-c-gray-2);
  border-radius: 0.5rem;
  background: var(--ev-button-alt-bg);
  color: var(--ev-button-alt-text);
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.reset-button:hover,
.secondary-button:hover {
  background: var(--ev-button-alt-hover-bg);
}

.save-button {
  background: #6366f1;
  border-color: #6366f1;
  color: white;
}

.save-button:hover:not(:disabled) {
  background: #5855eb;
}

.save-button:disabled,
.reset-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.message {
  padding: 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
  font-weight: 500;
}

.message.success {
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: #22c55e;
}

.message.error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.loading-state {
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

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.settings-section {
  background: var(--color-background-soft);
  border: 1px solid var(--ev-c-gray-3);
  border-radius: 0.75rem;
  padding: 1.5rem;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  color: var(--ev-c-text-1);
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 2rem;
  padding: 1rem 0;
  border-bottom: 1px solid var(--ev-c-gray-3);
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item.disabled {
  opacity: 0.5;
}

.setting-info {
  flex: 1;
}

.setting-label {
  font-weight: 600;
  color: var(--ev-c-text-1);
  display: block;
  margin-bottom: 0.25rem;
}

.setting-description {
  font-size: 0.875rem;
  color: var(--ev-c-text-2);
  margin: 0;
  line-height: 1.4;
}

.setting-warning {
  font-size: 0.75rem;
  color: #f59e0b;
  margin-top: 0.5rem;
  padding: 0.25rem 0.5rem;
  background: rgba(245, 158, 11, 0.1);
  border-radius: 0.25rem;
  display: inline-block;
}

.setting-control {
  display: flex;
  align-items: center;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--ev-c-gray-3);
  transition: 0.3s;
  border-radius: 24px;
}

.toggle-slider:before {
  position: absolute;
  content: '';
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .toggle-slider {
  background-color: #6366f1;
}

input:checked + .toggle-slider:before {
  transform: translateX(26px);
}

.setting-select {
  padding: 0.5rem;
  border: 1px solid var(--ev-c-gray-2);
  border-radius: 0.375rem;
  background: var(--color-background);
  color: var(--ev-c-text-1);
  min-width: 150px;
}

.setting-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.data-path {
  display: block;
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: var(--color-background-mute);
  border-radius: 0.25rem;
  font-size: 0.75rem;
  color: var(--ev-c-text-2);
  word-break: break-all;
}

.button-group {
  display: flex;
  gap: 0.5rem;
}

.privacy-notice {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: rgba(34, 197, 94, 0.05);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 0.5rem;
}

.privacy-icon {
  font-size: 1.5rem;
}

.privacy-content h4 {
  margin: 0 0 0.5rem 0;
  color: var(--ev-c-text-1);
}

.privacy-content ul {
  margin: 0;
  padding-left: 1rem;
  color: var(--ev-c-text-2);
  font-size: 0.875rem;
}

.privacy-content li {
  margin-bottom: 0.25rem;
}

.about-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.about-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.about-label {
  color: var(--ev-c-text-2);
  font-weight: 500;
}

.about-value {
  color: var(--ev-c-text-1);
  font-weight: 600;
}
</style>
