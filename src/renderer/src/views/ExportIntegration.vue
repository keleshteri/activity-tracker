<template>
  <div class="export-integration-page">
    <div class="page-header">
      <h1>Data Export & Integration</h1>
      <p>Export your productivity data, manage backups, and configure integrations with external tools.</p>
    </div>

    <div class="content-grid">
      <!-- Export Section -->
      <div class="section-card">
        <div class="section-header">
          <h2>Data Export</h2>
          <p>Export your activity data in various formats</p>
        </div>
        
        <div class="export-options">
          <div class="export-format">
            <label>Export Format:</label>
            <div class="radio-group">
              <label class="radio-option">
                <input type="radio" v-model="exportFormat" value="json" />
                <span>JSON</span>
              </label>
              <label class="radio-option">
                <input type="radio" v-model="exportFormat" value="csv" />
                <span>CSV</span>
              </label>
            </div>
          </div>

          <div class="date-range">
            <label>Date Range:</label>
            <div class="date-inputs">
              <input 
                type="date" 
                v-model="exportFilters.startDate" 
                placeholder="Start Date"
              />
              <span>to</span>
              <input 
                type="date" 
                v-model="exportFilters.endDate" 
                placeholder="End Date"
              />
            </div>
          </div>

          <div class="data-types">
            <label>Data Types:</label>
            <div class="checkbox-group">
              <label class="checkbox-option" v-for="type in dataTypes" :key="type.value">
                <input 
                  type="checkbox" 
                  v-model="exportFilters.dataTypes" 
                  :value="type.value"
                />
                <span>{{ type.label }}</span>
              </label>
            </div>
          </div>

          <div class="export-options-row">
            <label class="checkbox-option">
              <input type="checkbox" v-model="exportFilters.includeScreenshots" />
              <span>Include Screenshots</span>
            </label>
            <label class="checkbox-option">
              <input type="checkbox" v-model="exportFilters.includePersonalData" />
              <span>Include Personal Data</span>
            </label>
          </div>

          <div class="action-buttons">
            <button 
              class="btn btn-primary" 
              @click="exportData" 
              :disabled="isExporting"
            >
              <i class="icon-download"></i>
              {{ isExporting ? 'Exporting...' : 'Export Data' }}
            </button>
            <button class="btn btn-secondary" @click="openExportFolder">
              <i class="icon-folder"></i>
              Open Export Folder
            </button>
          </div>
        </div>
      </div>

      <!-- Productivity Reports Section -->
      <div class="section-card">
        <div class="section-header">
          <h2>Productivity Reports</h2>
          <p>Generate comprehensive productivity analysis reports</p>
        </div>
        
        <div class="report-options">
          <div class="report-period">
            <label>Report Period:</label>
            <select v-model="reportPeriod.type">
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
              <option value="quarter">Quarterly</option>
              <option value="year">Yearly</option>
            </select>
          </div>

          <div class="report-format">
            <label>Report Format:</label>
            <div class="radio-group">
              <label class="radio-option">
                <input type="radio" v-model="reportFormat" value="html" />
                <span>HTML</span>
              </label>
              <label class="radio-option">
                <input type="radio" v-model="reportFormat" value="json" />
                <span>JSON</span>
              </label>
            </div>
          </div>

          <div class="action-buttons">
            <button 
              class="btn btn-primary" 
              @click="generateReport" 
              :disabled="isGeneratingReport"
            >
              <i class="icon-chart"></i>
              {{ isGeneratingReport ? 'Generating...' : 'Generate Report' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Backup & Restore Section -->
      <div class="section-card">
        <div class="section-header">
          <h2>Backup & Restore</h2>
          <p>Create backups of your data and restore from previous backups</p>
        </div>
        
        <div class="backup-options">
          <div class="backup-settings">
            <label class="checkbox-option">
              <input type="checkbox" v-model="backupOptions.includeScreenshots" />
              <span>Include Screenshots</span>
            </label>
            <label class="checkbox-option">
              <input type="checkbox" v-model="backupOptions.compress" />
              <span>Compress Backup</span>
            </label>
            <label class="checkbox-option">
              <input type="checkbox" v-model="backupOptions.encrypt" />
              <span>Encrypt Backup</span>
            </label>
          </div>

          <div class="backup-password" v-if="backupOptions.encrypt">
            <label>Backup Password:</label>
            <input 
              type="password" 
              v-model="backupOptions.password" 
              placeholder="Enter encryption password"
            />
          </div>

          <div class="action-buttons">
            <button 
              class="btn btn-primary" 
              @click="createBackup" 
              :disabled="isCreatingBackup"
            >
              <i class="icon-backup"></i>
              {{ isCreatingBackup ? 'Creating Backup...' : 'Create Backup' }}
            </button>
            <button class="btn btn-secondary" @click="selectBackupFile">
              <i class="icon-restore"></i>
              Restore from Backup
            </button>
            <button class="btn btn-secondary" @click="openBackupFolder">
              <i class="icon-folder"></i>
              Open Backup Folder
            </button>
          </div>
        </div>

        <!-- Auto Backup Schedule -->
        <div class="auto-backup-section">
          <h3>Automatic Backup Schedule</h3>
          <div class="schedule-options">
            <label class="checkbox-option">
              <input type="checkbox" v-model="autoBackupConfig.enabled" />
              <span>Enable Automatic Backups</span>
            </label>
            
            <div v-if="autoBackupConfig.enabled" class="schedule-settings">
              <div class="schedule-frequency">
                <label>Frequency:</label>
                <select v-model="autoBackupConfig.frequency">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              
              <div class="schedule-time">
                <label>Time:</label>
                <input type="time" v-model="autoBackupConfig.time" />
              </div>
              
              <div class="retention-days">
                <label>Keep backups for:</label>
                <input type="number" v-model="autoBackupConfig.retentionDays" min="1" max="365" />
                <span>days</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- API Integration Section -->
      <div class="section-card">
        <div class="section-header">
          <h2>API Integration</h2>
          <p>Configure API access for external tools and applications</p>
        </div>
        
        <div class="api-status">
          <div class="status-indicator">
            <span class="status-dot" :class="{ active: apiStatus.running }"></span>
            <span>API Server: {{ apiStatus.running ? 'Running' : 'Stopped' }}</span>
            <span v-if="apiStatus.running" class="port-info">Port: {{ apiStatus.port }}</span>
          </div>
          
          <div class="api-controls">
            <button 
              class="btn" 
              :class="apiStatus.running ? 'btn-danger' : 'btn-success'"
              @click="toggleAPI"
            >
              {{ apiStatus.running ? 'Stop API' : 'Start API' }}
            </button>
          </div>
        </div>

        <div class="api-documentation" v-if="apiStatus.running">
          <p>API Base URL: <code>http://localhost:{{ apiStatus.port }}/api</code></p>
          <p>Documentation: <a href="#" @click="openAPIDocumentation">View API Documentation</a></p>
        </div>
      </div>

      <!-- Webhooks Section -->
      <div class="section-card">
        <div class="section-header">
          <h2>Webhooks</h2>
          <p>Configure webhook endpoints for real-time notifications</p>
        </div>
        
        <div class="webhooks-list">
          <div v-if="webhooks.length === 0" class="empty-state">
            <p>No webhooks configured</p>
          </div>
          
          <div v-for="webhook in webhooks" :key="webhook.id" class="webhook-item">
            <div class="webhook-info">
              <div class="webhook-url">{{ webhook.url }}</div>
              <div class="webhook-events">Events: {{ webhook.events.join(', ') }}</div>
              <div class="webhook-status">
                <span class="status-dot" :class="{ active: webhook.active }"></span>
                {{ webhook.active ? 'Active' : 'Inactive' }}
              </div>
            </div>
            <div class="webhook-actions">
              <button class="btn btn-sm btn-secondary" @click="testWebhook(webhook.id)">
                Test
              </button>
              <button class="btn btn-sm btn-secondary" @click="editWebhook(webhook)">
                Edit
              </button>
              <button class="btn btn-sm btn-danger" @click="deleteWebhook(webhook.id)">
                Delete
              </button>
            </div>
          </div>
        </div>

        <div class="webhook-actions">
          <button class="btn btn-primary" @click="showWebhookModal = true">
            <i class="icon-plus"></i>
            Add Webhook
          </button>
        </div>
      </div>
    </div>

    <!-- Webhook Modal -->
    <div v-if="showWebhookModal" class="modal-overlay" @click="closeWebhookModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>{{ editingWebhook ? 'Edit Webhook' : 'Add Webhook' }}</h3>
          <button class="modal-close" @click="closeWebhookModal">&times;</button>
        </div>
        
        <div class="modal-body">
          <div class="form-group">
            <label>Webhook URL:</label>
            <input 
              type="url" 
              v-model="webhookForm.url" 
              placeholder="https://your-app.com/webhook"
              required
            />
          </div>
          
          <div class="form-group">
            <label>Events:</label>
            <div class="checkbox-group">
              <label class="checkbox-option" v-for="event in availableEvents" :key="event.value">
                <input 
                  type="checkbox" 
                  v-model="webhookForm.events" 
                  :value="event.value"
                />
                <span>{{ event.label }}</span>
              </label>
            </div>
          </div>
          
          <div class="form-group">
            <label>Secret (optional):</label>
            <input 
              type="password" 
              v-model="webhookForm.secret" 
              placeholder="Webhook secret for signature verification"
            />
          </div>
          
          <div class="form-group">
            <label>Timeout (ms):</label>
            <input 
              type="number" 
              v-model="webhookForm.timeout" 
              min="1000" 
              max="30000" 
              placeholder="5000"
            />
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeWebhookModal">Cancel</button>
          <button class="btn btn-primary" @click="saveWebhook">Save</button>
        </div>
      </div>
    </div>

    <!-- Progress Modal -->
    <div v-if="showProgressModal" class="modal-overlay">
      <div class="modal progress-modal">
        <div class="modal-body">
          <div class="progress-content">
            <div class="spinner"></div>
            <h3>{{ progressMessage }}</h3>
            <p v-if="progressDetails">{{ progressDetails }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useNotification } from '../composables/useNotification'

const { showNotification } = useNotification()

// Export state
const exportFormat = ref('json')
const isExporting = ref(false)
const exportFilters = reactive({
  startDate: '',
  endDate: '',
  dataTypes: ['activities', 'sessions', 'metrics'],
  includeScreenshots: false,
  includePersonalData: true
})

const dataTypes = [
  { value: 'activities', label: 'Activity Records' },
  { value: 'sessions', label: 'Work Sessions' },
  { value: 'metrics', label: 'Productivity Metrics' },
  { value: 'categories', label: 'App Categories' },
  { value: 'patterns', label: 'Work Patterns' },
  { value: 'insights', label: 'Productivity Insights' },
  { value: 'screenshots', label: 'Screenshots' },
  { value: 'config', label: 'Configuration' }
]

// Report state
const reportFormat = ref('html')
const isGeneratingReport = ref(false)
const reportPeriod = reactive({
  type: 'month',
  start: Date.now() - 30 * 24 * 60 * 60 * 1000,
  end: Date.now()
})

// Backup state
const isCreatingBackup = ref(false)
const backupOptions = reactive({
  includeScreenshots: true,
  compress: true,
  encrypt: false,
  password: ''
})

const autoBackupConfig = reactive({
  enabled: false,
  frequency: 'weekly',
  time: '02:00',
  retentionDays: 90
})

// API state
const apiStatus = reactive({
  running: false,
  port: 3001
})

// Webhooks state
interface Webhook {
  id: string
  url: string
  events: string[]
  secret?: string
  timeout?: number
  active?: boolean
}

const webhooks = ref<Webhook[]>([])
const showWebhookModal = ref(false)
const editingWebhook = ref<Webhook | null>(null)
const webhookForm = reactive({
  url: '',
  events: [] as string[],
  secret: '',
  timeout: 5000
})

const availableEvents = [
  { value: 'activity.created', label: 'Activity Created' },
  { value: 'session.started', label: 'Session Started' },
  { value: 'session.ended', label: 'Session Ended' },
  { value: 'productivity.threshold', label: 'Productivity Threshold' },
  { value: 'focus.session.completed', label: 'Focus Session Completed' },
  { value: 'break.reminder', label: 'Break Reminder' },
  { value: 'daily.summary', label: 'Daily Summary' }
]

// Progress modal state
const showProgressModal = ref(false)
const progressMessage = ref('')
const progressDetails = ref('')

// Methods
const exportData = async () => {
  try {
    if (!window.electronAPI) {
      showNotification('API not available', 'error')
      return
    }
    
    isExporting.value = true
    showProgressModal.value = true
    progressMessage.value = 'Exporting data...'
    
    const filters = {
      ...exportFilters,
      format: exportFormat.value,
      startDate: exportFilters.startDate ? new Date(exportFilters.startDate).getTime() : undefined,
      endDate: exportFilters.endDate ? new Date(exportFilters.endDate).getTime() : undefined
    }
    
    let result
    if (exportFormat.value === 'csv') {
      result = await window.electronAPI.exportCSV(filters)
    } else {
      result = await window.electronAPI.exportJSON(filters)
    }
    
    if (result.success) {
      showNotification('Export completed successfully', 'success')
      progressDetails.value = `Exported ${result.recordCount} records (${(result.fileSize / 1024).toFixed(1)} KB)`
    } else {
      showNotification(`Export failed: ${result.error}`, 'error')
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    showNotification(`Export failed: ${errorMessage}`, 'error')
  } finally {
    isExporting.value = false
    setTimeout(() => {
      showProgressModal.value = false
    }, 2000)
  }
}

const generateReport = async () => {
  try {
    if (!window.electronAPI) {
      showNotification('API not available', 'error')
      return
    }
    
    isGeneratingReport.value = true
    showProgressModal.value = true
    progressMessage.value = 'Generating productivity report...'
    
    const result = await window.electronAPI.generateProductivityReport(
      reportFormat.value,
      reportPeriod
    )
    
    if (result.success) {
      showNotification('Report generated successfully', 'success')
    } else {
      showNotification(`Report generation failed: ${result.error}`, 'error')
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    showNotification(`Report generation failed: ${errorMessage}`, 'error')
  } finally {
    isGeneratingReport.value = false
    setTimeout(() => {
      showProgressModal.value = false
    }, 2000)
  }
}

const createBackup = async () => {
  try {
    if (!window.electronAPI) {
      showNotification('API not available', 'error')
      return
    }
    
    isCreatingBackup.value = true
    showProgressModal.value = true
    progressMessage.value = 'Creating backup...'
    
    const result = await window.electronAPI.createBackup(backupOptions)
    
    if (result.success) {
      showNotification('Backup created successfully', 'success')
      if (result.backupSize !== undefined) {
        progressDetails.value = `Backup size: ${(result.backupSize / 1024 / 1024).toFixed(1)} MB`
      }
    } else {
      showNotification(`Backup failed: ${result.error}`, 'error')
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    showNotification(`Backup failed: ${errorMessage}`, 'error')
  } finally {
    isCreatingBackup.value = false
    setTimeout(() => {
      showProgressModal.value = false
    }, 2000)
  }
}

const selectBackupFile = async () => {
  try {
    if (!window.electronAPI) {
      showNotification('API not available', 'error')
      return
    }
    
    const result = await window.electronAPI.selectBackupFile()
    if (!result.canceled && result.filePaths.length > 0) {
      const backupPath = result.filePaths[0]
      
      showProgressModal.value = true
      progressMessage.value = 'Restoring from backup...'
      
      const restoreResult = await window.electronAPI.restoreBackup(backupPath, {
        overwriteExisting: true,
        validateData: true
      })
      
      if (restoreResult.success) {
        showNotification(`Restore completed: ${restoreResult.recordsImported} records imported`, 'success')
      } else {
        showNotification(`Restore failed: ${restoreResult.error}`, 'error')
      }
      
      setTimeout(() => {
        showProgressModal.value = false
      }, 2000)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    showNotification(`Restore failed: ${errorMessage}`, 'error')
    showProgressModal.value = false
  }
}

const openExportFolder = async () => {
  if (!window.electronAPI) {
    showNotification('API not available', 'error')
    return
  }
  await window.electronAPI.openExportFolder()
}

const openBackupFolder = async () => {
  if (!window.electronAPI) {
    showNotification('API not available', 'error')
    return
  }
  await window.electronAPI.openBackupFolder()
}

const toggleAPI = async () => {
  try {
    if (!window.electronAPI) {
      showNotification('API not available', 'error')
      return
    }
    
    if (apiStatus.running) {
      await window.electronAPI.stopAPI()
      apiStatus.running = false
      showNotification('API server stopped', 'info')
    } else {
      const result = await window.electronAPI.startAPI()
      if (result.success) {
        apiStatus.running = true
        if (result.port !== undefined) {
          apiStatus.port = result.port
        }
        showNotification(`API server started on port ${result.port}`, 'success')
      } else {
        showNotification(`Failed to start API: ${result.error}`, 'error')
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    showNotification(`API operation failed: ${errorMessage}`, 'error')
  }
}

const openAPIDocumentation = () => {
  window.open(`http://localhost:${apiStatus.port}/api/docs`, '_blank')
}

const loadWebhooks = async () => {
  try {
    if (!window.electronAPI) {
      showNotification('API not available', 'error')
      return
    }
    
    webhooks.value = await window.electronAPI.listWebhooks()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Failed to load webhooks:', errorMessage)
  }
}

const testWebhook = async (webhookId: string) => {
  try {
    if (!window.electronAPI) {
      showNotification('API not available', 'error')
      return
    }
    
    const result = await window.electronAPI.testWebhook(webhookId)
    if (result.success) {
      showNotification('Webhook test successful', 'success')
    } else {
      showNotification('Webhook test failed', 'error')
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    showNotification(`Webhook test failed: ${errorMessage}`, 'error')
  }
}

const editWebhook = (webhook: any) => {
  editingWebhook.value = webhook
  webhookForm.url = webhook.url
  webhookForm.events = [...webhook.events]
  webhookForm.secret = webhook.secret || ''
  webhookForm.timeout = webhook.timeout || 5000
  showWebhookModal.value = true
}

const deleteWebhook = async (webhookId: string) => {
  if (confirm('Are you sure you want to delete this webhook?')) {
    try {
      if (!window.electronAPI) {
        showNotification('API not available', 'error')
        return
      }
      
      const result = await window.electronAPI.deleteWebhook(webhookId)
      if (result.success) {
        showNotification('Webhook deleted successfully', 'success')
        await loadWebhooks()
      } else {
        showNotification(`Failed to delete webhook: ${result.error}`, 'error')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showNotification(`Failed to delete webhook: ${errorMessage}`, 'error')
    }
  }
}

const saveWebhook = async () => {
  try {
    if (!webhookForm.url || webhookForm.events.length === 0) {
      showNotification('Please fill in all required fields', 'error')
      return
    }
    
    if (!window.electronAPI) {
      showNotification('API not available', 'error')
      return
    }
    
    let result
    if (editingWebhook.value) {
      result = await window.electronAPI.updateWebhook(editingWebhook.value.id, webhookForm)
    } else {
      result = await window.electronAPI.createWebhook(webhookForm)
    }
    
    if (result.success) {
      showNotification(
        editingWebhook.value ? 'Webhook updated successfully' : 'Webhook created successfully',
        'success'
      )
      closeWebhookModal()
      await loadWebhooks()
    } else {
      showNotification(`Failed to save webhook: ${result.error}`, 'error')
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    showNotification(`Failed to save webhook: ${errorMessage}`, 'error')
  }
}

const closeWebhookModal = () => {
  showWebhookModal.value = false
  editingWebhook.value = null
  webhookForm.url = ''
  webhookForm.events = []
  webhookForm.secret = ''
  webhookForm.timeout = 5000
}

const loadAPIStatus = async () => {
  try {
    if (!window.electronAPI) {
      console.warn('API not available')
      return
    }
    const status = await window.electronAPI.getAPIStatus()
    apiStatus.running = status.running
    apiStatus.port = status.port
  } catch (error) {
    console.error('Failed to load API status:', error)
  }
}

const loadIntegrationConfig = async () => {
  try {
    if (!window.electronAPI) {
      console.warn('API not available')
      return
    }
    const config = await window.electronAPI.getIntegrationConfig()
    if (config.autoExport) {
      autoBackupConfig.enabled = config.autoExport.enabled
      autoBackupConfig.frequency = config.autoExport.frequency
      autoBackupConfig.retentionDays = config.autoExport.retentionDays
    }
    if (config.backupSchedule) {
      autoBackupConfig.enabled = config.backupSchedule.enabled
      autoBackupConfig.frequency = config.backupSchedule.frequency
      autoBackupConfig.time = config.backupSchedule.time
      autoBackupConfig.retentionDays = config.backupSchedule.retentionDays
    }
  } catch (error) {
    console.error('Failed to load integration config:', error)
  }
}

// Initialize
onMounted(async () => {
  await loadAPIStatus()
  await loadWebhooks()
  await loadIntegrationConfig()
  
  // Set default date range (last 30 days)
  const endDate = new Date()
  const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)
  exportFilters.startDate = startDate.toISOString().split('T')[0]
  exportFilters.endDate = endDate.toISOString().split('T')[0]
})
</script>

<style scoped>
.export-integration-page {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 30px;
}

.page-header h1 {
  margin: 0 0 10px 0;
  color: #2c3e50;
}

.page-header p {
  margin: 0;
  color: #7f8c8d;
  font-size: 16px;
}

.content-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 20px;
}

.section-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  border: 1px solid #e1e8ed;
}

.section-header {
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #e1e8ed;
}

.section-header h2 {
  margin: 0 0 5px 0;
  color: #2c3e50;
  font-size: 18px;
}

.section-header p {
  margin: 0;
  color: #7f8c8d;
  font-size: 14px;
}

.export-options,
.report-options,
.backup-options {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.export-format,
.report-period,
.report-format,
.date-range,
.data-types {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.export-format label,
.report-period label,
.report-format label,
.date-range label,
.data-types label {
  font-weight: 500;
  color: #2c3e50;
}

.radio-group,
.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
}

.radio-option,
.checkbox-option {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
}

.date-inputs {
  display: flex;
  align-items: center;
  gap: 10px;
}

.date-inputs input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.export-options-row {
  display: flex;
  gap: 20px;
}

.action-buttons {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: background-color 0.2s;
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

.btn-danger {
  background: #e74c3c;
  color: white;
}

.btn-danger:hover {
  background: #c0392b;
}

.btn-sm {
  padding: 5px 10px;
  font-size: 12px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.auto-backup-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e1e8ed;
}

.auto-backup-section h3 {
  margin: 0 0 15px 0;
  color: #2c3e50;
  font-size: 16px;
}

.schedule-settings {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
  margin-top: 15px;
}

.schedule-frequency,
.schedule-time,
.retention-days {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.schedule-frequency select,
.schedule-time input,
.retention-days input {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.api-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e74c3c;
}

.status-dot.active {
  background: #27ae60;
}

.port-info {
  color: #7f8c8d;
  font-size: 14px;
}

.api-documentation {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 4px;
  margin-top: 15px;
}

.api-documentation code {
  background: #e9ecef;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
}

.webhooks-list {
  margin-bottom: 15px;
}

.empty-state {
  text-align: center;
  color: #7f8c8d;
  padding: 20px;
}

.webhook-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border: 1px solid #e1e8ed;
  border-radius: 4px;
  margin-bottom: 10px;
}

.webhook-info {
  flex: 1;
}

.webhook-url {
  font-weight: 500;
  color: #2c3e50;
  margin-bottom: 5px;
}

.webhook-events {
  font-size: 12px;
  color: #7f8c8d;
  margin-bottom: 5px;
}

.webhook-status {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
}

.webhook-actions {
  display: flex;
  gap: 5px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e1e8ed;
}

.modal-header h3 {
  margin: 0;
  color: #2c3e50;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #7f8c8d;
}

.modal-body {
  padding: 20px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 20px;
  border-top: 1px solid #e1e8ed;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: #2c3e50;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-sizing: border-box;
}

.progress-modal {
  max-width: 400px;
}

.progress-content {
  text-align: center;
  padding: 20px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.progress-content h3 {
  margin: 0 0 10px 0;
  color: #2c3e50;
}

.progress-content p {
  margin: 0;
  color: #7f8c8d;
  font-size: 14px;
}
</style>