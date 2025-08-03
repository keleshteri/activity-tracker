import { autoUpdater } from 'electron-updater'
import { dialog } from 'electron'
import { EventEmitter } from 'events'
import * as path from 'path'
import { getPlatformAdapter } from '../platform'

export interface UpdateInfo {
  version: string
  releaseDate: string
  releaseNotes?: string
  downloadUrl?: string
  size?: number
}

export interface UpdateProgress {
  bytesPerSecond: number
  percent: number
  transferred: number
  total: number
}

export interface UpdaterConfig {
  checkForUpdatesOnStart: boolean
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  checkInterval: number // in milliseconds
  allowPrerelease: boolean
  allowDowngrade: boolean
}

export class AutoUpdaterManager extends EventEmitter {
  private config: UpdaterConfig
  private checkTimer: NodeJS.Timeout | null = null
  private isChecking: boolean = false
  private lastCheckTime: number = 0
  private platformAdapter = getPlatformAdapter()

  constructor(config?: Partial<UpdaterConfig>) {
    super()
    
    this.config = {
      checkForUpdatesOnStart: true,
      autoDownload: true,
      autoInstallOnAppQuit: true,
      checkInterval: 4 * 60 * 60 * 1000, // 4 hours
      allowPrerelease: false,
      allowDowngrade: false,
      ...config
    }
    
    this.setupAutoUpdater()
  }

  private setupAutoUpdater(): void {
    // Configure auto-updater
    autoUpdater.autoDownload = this.config.autoDownload
    autoUpdater.autoInstallOnAppQuit = this.config.autoInstallOnAppQuit
    autoUpdater.allowPrerelease = this.config.allowPrerelease
    autoUpdater.allowDowngrade = this.config.allowDowngrade
    
    // Set update server URL based on platform
    this.configurePlatformSpecificUpdater()
    
    // Setup event listeners
    this.setupEventListeners()
    
    console.log('Auto-updater configured:', this.config)
  }

  private configurePlatformSpecificUpdater(): void {
    // Configure platform-specific update settings
    if (process.platform === 'win32') {
      // Windows-specific configuration
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'keleshteri',
        repo: 'activity-tracker',
        private: false
      })
    } else if (process.platform === 'darwin') {
      // macOS-specific configuration
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'keleshteri',
        repo: 'activity-tracker',
        private: false
      })
    } else if (process.platform === 'linux') {
      // Linux-specific configuration
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'keleshteri',
        repo: 'activity-tracker',
        private: false
      })
    }
  }

  private setupEventListeners(): void {
    autoUpdater.on('checking-for-update', () => {
      console.log('Checking for updates...')
      this.isChecking = true
      this.emit('checking-for-update')
    })

    autoUpdater.on('update-available', (info) => {
      console.log('Update available:', info)
      this.isChecking = false
      this.emit('update-available', this.formatUpdateInfo(info))
      this.showUpdateAvailableNotification(info)
    })

    autoUpdater.on('update-not-available', (info) => {
      console.log('Update not available:', info)
      this.isChecking = false
      this.emit('update-not-available', this.formatUpdateInfo(info))
    })

    autoUpdater.on('error', (error) => {
      console.error('Auto-updater error:', error)
      this.isChecking = false
      this.emit('error', error)
      this.showUpdateErrorNotification(error)
    })

    autoUpdater.on('download-progress', (progress) => {
      console.log(`Download progress: ${progress.percent}%`)
      this.emit('download-progress', progress as UpdateProgress)
    })

    autoUpdater.on('update-downloaded', (info) => {
      console.log('Update downloaded:', info)
      this.emit('update-downloaded', this.formatUpdateInfo(info))
      this.showUpdateReadyNotification(info)
    })
  }

  public async initialize(): Promise<void> {
    try {
      // Check if auto-updater is supported on this platform
      if (!this.platformAdapter.getCapabilities().supportsAutoUpdater) {
        console.warn('Auto-updater not supported on this platform')
        return
      }

      // Check for updates on startup if enabled
      if (this.config.checkForUpdatesOnStart) {
        // Delay initial check to allow app to fully load
        setTimeout(() => {
          this.checkForUpdates()
        }, 5000)
      }

      // Setup periodic update checks
      this.startPeriodicChecks()

      console.log('Auto-updater initialized successfully')
    } catch (error) {
      console.error('Failed to initialize auto-updater:', error)
    }
  }

  public async checkForUpdates(): Promise<void> {
    if (this.isChecking) {
      console.log('Update check already in progress')
      return
    }

    try {
      this.lastCheckTime = Date.now()
      await autoUpdater.checkForUpdatesAndNotify()
    } catch (error) {
      console.error('Failed to check for updates:', error)
      this.emit('error', error)
    }
  }

  public async downloadUpdate(): Promise<void> {
    try {
      await autoUpdater.downloadUpdate()
    } catch (error) {
      console.error('Failed to download update:', error)
      this.emit('error', error)
    }
  }

  public quitAndInstall(): void {
    try {
      autoUpdater.quitAndInstall()
    } catch (error) {
      console.error('Failed to quit and install:', error)
      this.emit('error', error)
    }
  }

  public async showUpdateDialog(updateInfo: UpdateInfo): Promise<boolean> {
    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: `A new version (${updateInfo.version}) is available!`,
      detail: updateInfo.releaseNotes || 'Would you like to download and install it?',
      buttons: ['Download Now', 'Later', 'Skip This Version'],
      defaultId: 0,
      cancelId: 1
    })

    switch (result.response) {
      case 0: // Download Now
        if (!this.config.autoDownload) {
          await this.downloadUpdate()
        }
        return true
      case 1: // Later
        return false
      case 2: // Skip This Version
        this.skipVersion(updateInfo.version)
        return false
      default:
        return false
    }
  }

  public async showInstallDialog(updateInfo: UpdateInfo): Promise<boolean> {
    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: `Update to version ${updateInfo.version} has been downloaded.`,
      detail: 'The application will restart to apply the update.',
      buttons: ['Restart Now', 'Restart Later'],
      defaultId: 0,
      cancelId: 1
    })

    if (result.response === 0) {
      this.quitAndInstall()
      return true
    }

    return false
  }

  private startPeriodicChecks(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
    }

    this.checkTimer = setInterval(() => {
      this.checkForUpdates()
    }, this.config.checkInterval)
  }

  private stopPeriodicChecks(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = null
    }
  }

  private formatUpdateInfo(info: any): UpdateInfo {
    return {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
      downloadUrl: info.downloadUrl,
      size: info.size
    }
  }

  private async showUpdateAvailableNotification(info: any): Promise<void> {
    try {
      await this.platformAdapter.showNotification({
        title: 'Update Available',
        body: `Version ${info.version} is available for download`,
        icon: path.join(__dirname, '../../resources/icon.png'),
        urgency: 'normal'
      })
    } catch (error) {
      console.error('Failed to show update notification:', error)
    }
  }

  private async showUpdateReadyNotification(info: any): Promise<void> {
    try {
      await this.platformAdapter.showNotification({
        title: 'Update Ready',
        body: `Version ${info.version} is ready to install`,
        icon: path.join(__dirname, '../../resources/icon.png'),
        urgency: 'normal'
      })
    } catch (error) {
      console.error('Failed to show update ready notification:', error)
    }
  }

  private async showUpdateErrorNotification(_error: Error): Promise<void> {
    try {
      await this.platformAdapter.showNotification({
        title: 'Update Error',
        body: 'Failed to check for updates. Please try again later.',
        icon: path.join(__dirname, '../../resources/icon.png'),
        urgency: 'low'
      })
    } catch (notificationError) {
      console.error('Failed to show update error notification:', notificationError)
    }
  }

  private skipVersion(version: string): void {
    // Store skipped version in user preferences
    // This would typically be stored in a config file or user settings
    console.log(`Skipping version ${version}`)
  }

  public getConfig(): UpdaterConfig {
    return { ...this.config }
  }

  public updateConfig(newConfig: Partial<UpdaterConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    // Apply new configuration
    autoUpdater.autoDownload = this.config.autoDownload
    autoUpdater.autoInstallOnAppQuit = this.config.autoInstallOnAppQuit
    autoUpdater.allowPrerelease = this.config.allowPrerelease
    autoUpdater.allowDowngrade = this.config.allowDowngrade
    
    // Restart periodic checks with new interval
    this.startPeriodicChecks()
    
    console.log('Auto-updater configuration updated:', this.config)
  }

  public getLastCheckTime(): number {
    return this.lastCheckTime
  }

  public isCheckingForUpdates(): boolean {
    return this.isChecking
  }

  public cleanup(): void {
    this.stopPeriodicChecks()
    this.removeAllListeners()
    console.log('Auto-updater cleaned up')
  }
}

// Export singleton instance
let autoUpdaterManager: AutoUpdaterManager | null = null

export const getAutoUpdaterManager = (config?: Partial<UpdaterConfig>): AutoUpdaterManager => {
  if (!autoUpdaterManager) {
    autoUpdaterManager = new AutoUpdaterManager(config)
  }
  return autoUpdaterManager
}

export const cleanupAutoUpdater = (): void => {
  if (autoUpdaterManager) {
    autoUpdaterManager.cleanup()
    autoUpdaterManager = null
  }
}