import { ipcMain, app, dialog } from 'electron'
import { DatabaseManager } from '../database'
import { ExportManager, ExportFilters, AutoExportConfig } from '../export'
import { IntegrationAPI, APIConfig, defaultAPIConfig } from '../api'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'

export interface IntegrationConfig {
  api: APIConfig
  autoExport: AutoExportConfig
  backupSchedule: {
    enabled: boolean
    frequency: 'daily' | 'weekly' | 'monthly'
    time: string // HH:MM format
    retentionDays: number
    includeScreenshots: boolean
    compress: boolean
    encrypt: boolean
  }
}

export class IntegrationManager {

  private exportManager: ExportManager
  private api: IntegrationAPI
  private config: IntegrationConfig
  private configPath: string
  private backupScheduleJob: any

  constructor(databaseManager: DatabaseManager) {
    this.exportManager = new ExportManager(databaseManager)
    this.configPath = join(app.getPath('userData'), 'integration-config.json')
    this.config = this.loadConfig()
    this.api = new IntegrationAPI(databaseManager, this.exportManager, this.config.api)
    
    this.setupIPC()
    this.setupSchedules()
  }

  private loadConfig(): IntegrationConfig {
    try {
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, 'utf8')
        return JSON.parse(data)
      }
    } catch (error) {
      console.error('Failed to load integration config:', error)
    }

    // Return default config
    return {
      api: defaultAPIConfig,
      autoExport: {
        enabled: false,
        frequency: 'weekly',
        format: 'json',
        includeScreenshots: false,
        exportPath: join(app.getPath('userData'), 'exports'),
        retentionDays: 30
      },
      backupSchedule: {
        enabled: false,
        frequency: 'weekly',
        time: '02:00',
        retentionDays: 90,
        includeScreenshots: true,
        compress: true,
        encrypt: false
      }
    }
  }

  private saveConfig(): void {
    try {
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2))
    } catch (error) {
      console.error('Failed to save integration config:', error)
    }
  }

  private setupIPC(): void {
    // Export functionality
    ipcMain.handle('export:json', async (_event, filters: ExportFilters) => {
      try {
        return await this.exportManager.exportToJSON(filters)
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    ipcMain.handle('export:csv', async (_event, filters: ExportFilters) => {
      try {
        return await this.exportManager.exportToCSV(filters)
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    ipcMain.handle('export:productivity-report', async (_event, format: 'pdf' | 'html' | 'json', period: any) => {
      try {
        return await this.exportManager.generateProductivityReport(format, period)
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    ipcMain.handle('export:select-file', async () => {
      try {
        const result = await dialog.showSaveDialog({
          title: 'Export Data',
          defaultPath: `activity-export-${new Date().toISOString().split('T')[0]}.json`,
          filters: [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'CSV Files', extensions: ['csv'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        })
        return result
      } catch (error) {
        return { canceled: true }
      }
    })

    // Backup functionality
    ipcMain.handle('backup:create', async (_event, options: any) => {
      try {
        return await this.exportManager.createBackup(options)
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now()
        }
      }
    })

    ipcMain.handle('backup:restore', async (_event, backupPath: string, options: any) => {
      try {
        return await this.exportManager.restoreBackup(backupPath, options)
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    ipcMain.handle('backup:select-file', async () => {
      try {
        const result = await dialog.showOpenDialog({
          title: 'Select Backup File',
          filters: [
            { name: 'Backup Files', extensions: ['zip', 'enc'] },
            { name: 'All Files', extensions: ['*'] }
          ],
          properties: ['openFile']
        })
        return result
      } catch (error) {
        return { canceled: true }
      }
    })

    ipcMain.handle('backup:select-directory', async () => {
      try {
        const result = await dialog.showOpenDialog({
          title: 'Select Backup Directory',
          properties: ['openDirectory']
        })
        return result
      } catch (error) {
        return { canceled: true }
      }
    })

    // Configuration management
    ipcMain.handle('integration:get-config', () => {
      return this.config
    })

    ipcMain.handle('integration:update-config', (_event, newConfig: Partial<IntegrationConfig>) => {
      try {
        this.config = { ...this.config, ...newConfig }
        this.saveConfig()
        
        // Update schedules if needed
        this.setupSchedules()
        
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    // API management
    ipcMain.handle('api:start', async () => {
      try {
        if (!this.api.isRunning()) {
          await this.api.start()
        }
        return { success: true, port: this.api.getPort() }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    ipcMain.handle('api:stop', async () => {
      try {
        await this.api.stop()
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    ipcMain.handle('api:status', () => {
      return {
        running: this.api.isRunning(),
        port: this.api.getPort()
      }
    })

    ipcMain.handle('api:create-key', async (_event, _keyData: any) => {
      try {
        // This would typically be handled through the API itself
        // For now, return a placeholder response
        return {
          success: true,
          message: 'API key creation should be done through the API endpoint'
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    // Webhook management
    ipcMain.handle('webhooks:list', () => {
      return this.config.api.webhooks.endpoints
    })

    ipcMain.handle('webhooks:create', (_event, webhook: any) => {
      try {
        const newWebhook = {
          id: require('uuid').v4(),
          ...webhook,
          active: true
        }
        
        this.config.api.webhooks.endpoints.push(newWebhook)
        this.saveConfig()
        
        return { success: true, webhook: newWebhook }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    ipcMain.handle('webhooks:update', (_event, webhookId: string, updates: any) => {
      try {
        const index = this.config.api.webhooks.endpoints.findIndex(w => w.id === webhookId)
        if (index === -1) {
          return { success: false, error: 'Webhook not found' }
        }
        
        this.config.api.webhooks.endpoints[index] = {
          ...this.config.api.webhooks.endpoints[index],
          ...updates
        }
        
        this.saveConfig()
        return { success: true, webhook: this.config.api.webhooks.endpoints[index] }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    ipcMain.handle('webhooks:delete', (_event, webhookId: string) => {
      try {
        const index = this.config.api.webhooks.endpoints.findIndex(w => w.id === webhookId)
        if (index === -1) {
          return { success: false, error: 'Webhook not found' }
        }
        
        this.config.api.webhooks.endpoints.splice(index, 1)
        this.saveConfig()
        
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    ipcMain.handle('webhooks:test', async (_event, webhookId: string) => {
      try {
        const webhook = this.config.api.webhooks.endpoints.find(w => w.id === webhookId)
        if (!webhook) {
          return { success: false, error: 'Webhook not found' }
        }
        
        // Trigger a test webhook
        await this.api.triggerWebhook('activity.created', {
          test: true,
          message: 'Test webhook from Activity Tracker',
          timestamp: Date.now()
        })
        
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    // Auto-export management
    ipcMain.handle('auto-export:enable', (_event, config: AutoExportConfig) => {
      try {
        this.config.autoExport = config
        this.saveConfig()
        this.exportManager.scheduleAutoExport(config)
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    ipcMain.handle('auto-export:disable', () => {
      try {
        this.config.autoExport.enabled = false
        this.saveConfig()
        // Cancel scheduled exports (would need to track job references)
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    // File operations
    ipcMain.handle('file:open-export-folder', async () => {
      try {
        const { shell } = require('electron')
        const exportPath = join(app.getPath('userData'), 'exports')
        await shell.openPath(exportPath)
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    ipcMain.handle('file:open-backup-folder', async () => {
      try {
        const { shell } = require('electron')
        const backupPath = join(app.getPath('userData'), 'backups')
        await shell.openPath(backupPath)
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })
  }

  private setupSchedules(): void {
    // Setup auto-export schedule
    if (this.config.autoExport.enabled) {
      this.exportManager.scheduleAutoExport(this.config.autoExport)
    }

    // Setup backup schedule
    if (this.config.backupSchedule.enabled) {
      this.scheduleBackups()
    }
  }

  private scheduleBackups(): void {
    const schedule = require('node-schedule')
    
    // Cancel existing job if any
    if (this.backupScheduleJob) {
      this.backupScheduleJob.cancel()
    }

    let cronPattern: string
    const [hour, minute] = this.config.backupSchedule.time.split(':').map(Number)

    switch (this.config.backupSchedule.frequency) {
      case 'daily':
        cronPattern = `${minute} ${hour} * * *`
        break
      case 'weekly':
        cronPattern = `${minute} ${hour} * * 0` // Sunday
        break
      case 'monthly':
        cronPattern = `${minute} ${hour} 1 * *` // 1st of month
        break
      default:
        return
    }

    this.backupScheduleJob = schedule.scheduleJob(cronPattern, async () => {
      try {
        console.log('Starting scheduled backup...')
        
        const result = await this.exportManager.createBackup({
          includeScreenshots: this.config.backupSchedule.includeScreenshots,
          compress: this.config.backupSchedule.compress,
          encrypt: this.config.backupSchedule.encrypt
        })

        if (result.success) {
          console.log('Scheduled backup completed successfully')
          
          // Trigger webhook for backup completion
          await this.api.triggerWebhook('daily.summary', {
            type: 'backup_completed',
            backupPath: result.backupPath,
            backupSize: result.backupSize,
            timestamp: result.timestamp
          })
        } else {
          console.error('Scheduled backup failed:', result.error)
        }

        // Cleanup old backups
        this.cleanupOldBackups()
      } catch (error) {
        console.error('Scheduled backup error:', error)
      }
    })
  }

  private cleanupOldBackups(): void {
    try {
      const fs = require('fs')
      const path = require('path')
      const backupPath = join(app.getPath('userData'), 'backups')
      const cutoffTime = Date.now() - (this.config.backupSchedule.retentionDays * 24 * 60 * 60 * 1000)

      if (!existsSync(backupPath)) return

      const files = fs.readdirSync(backupPath)
      files.forEach((file: string) => {
        const filePath = path.join(backupPath, file)
        const stats = fs.statSync(filePath)
        
        if (stats.mtime.getTime() < cutoffTime) {
          if (stats.isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true })
          } else {
            fs.unlinkSync(filePath)
          }
          console.log(`Cleaned up old backup: ${file}`)
        }
      })
    } catch (error) {
      console.error('Failed to cleanup old backups:', error)
    }
  }

  // Public methods for triggering webhooks from other parts of the application
  public async notifyActivityCreated(activity: any): Promise<void> {
    await this.api.triggerWebhook('activity.created', activity)
  }

  public async notifySessionStarted(session: any): Promise<void> {
    await this.api.triggerWebhook('session.started', session)
  }

  public async notifySessionEnded(session: any): Promise<void> {
    await this.api.triggerWebhook('session.ended', session)
  }

  public async notifyProductivityThreshold(data: any): Promise<void> {
    await this.api.triggerWebhook('productivity.threshold', data)
  }

  public async notifyFocusSessionCompleted(session: any): Promise<void> {
    await this.api.triggerWebhook('focus.session.completed', session)
  }

  public async notifyBreakReminder(data: any): Promise<void> {
    await this.api.triggerWebhook('break.reminder', data)
  }

  public async notifyDailySummary(summary: any): Promise<void> {
    await this.api.triggerWebhook('daily.summary', summary)
  }

  // Lifecycle methods
  public async start(): Promise<void> {
    try {
      // Start API server if configured
      if (this.config.api.port && this.config.api.port > 0) {
        await this.api.start()
        console.log(`Integration API started on port ${this.config.api.port}`)
      }
      
      // Setup schedules
      this.setupSchedules()
      
      console.log('Integration manager started successfully')
    } catch (error) {
      console.error('Failed to start integration manager:', error)
      throw error
    }
  }

  public async stop(): Promise<void> {
    try {
      // Stop API server
      await this.api.stop()
      
      // Cancel scheduled jobs
      if (this.backupScheduleJob) {
        this.backupScheduleJob.cancel()
      }
      
      console.log('Integration manager stopped successfully')
    } catch (error) {
      console.error('Failed to stop integration manager:', error)
    }
  }

  public getConfig(): IntegrationConfig {
    return this.config
  }

  public getExportManager(): ExportManager {
    return this.exportManager
  }

  public getAPI(): IntegrationAPI {
    return this.api
  }
}