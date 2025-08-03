import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron'
import { join } from 'path'
import { ActivityTracker } from '../tracker'
import { getPlatformAdapter, platformUtils } from '../platform'
import type { PlatformAdapter, NotificationOptions } from '../platform'

export class TrayManager {
  private tray: Tray | null = null
  private activityTracker: ActivityTracker
  private iconPath: string = ''
  private iconActivePath: string = ''
  private platformAdapter: PlatformAdapter
  private isMenuBarMode: boolean = false
  private lastNotificationTime: number = 0
  private notificationCooldown: number = 30000 // 30 seconds

  constructor(activityTracker: ActivityTracker) {
    this.activityTracker = activityTracker
    this.platformAdapter = getPlatformAdapter()
    
    // Set platform-specific icon paths
    this.setupPlatformSpecificIcons()
    
    // Enable menu bar mode on macOS if supported
    if (platformUtils.isMacOS() && this.platformAdapter.getCapabilities().supportsMenuBar) {
      this.isMenuBarMode = true
    }
  }

  public async initialize(): Promise<void> {
    try {
      // Apply platform-specific optimizations first
      await this.platformAdapter.optimizeForPlatform()
      
      // Create tray with platform-appropriate icon
      const icon = this.createPlatformIcon()
      
      if (icon.isEmpty()) {
        console.error('Failed to load tray icon from path:', this.iconPath)
        return
      }
      
      this.tray = new Tray(icon)
      this.setupPlatformSpecificTray()
      
      // Set up context menu
      this.updateContextMenu()
      
      // Listen for tracker status changes
      this.activityTracker.on('status-changed', (status) => {
        this.updateTrayIcon(status.isTracking)
        this.updateContextMenu()
        this.handleStatusChangeNotification(status.isTracking)
      })
      
      // Handle platform-specific tray events
      this.setupTrayEventHandlers()
      
      console.log(`Tray initialized successfully for ${platformUtils.getPlatformName()}`)
    } catch (error) {
      console.error('Failed to initialize tray:', error)
    }
  }

  private updateTrayIcon(isActive: boolean): void {
    if (!this.tray) return
    
    try {
      const iconPath = isActive ? this.iconActivePath : this.iconPath
      const icon = nativeImage.createFromPath(iconPath)
      icon.setTemplateImage(true)
      
      this.tray.setImage(icon)
      this.tray.setToolTip(isActive ? 'Activity Tracker - Running' : 'Activity Tracker - Stopped')
    } catch (error) {
      console.error('Failed to update tray icon:', error)
    }
  }

  private updateContextMenu(): void {
    if (!this.tray) return
    
    const status = this.activityTracker.getStatus()
    const isTracking = status.isTracking
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Activity Tracker',
        type: 'normal',
        enabled: false
      },
      {
        type: 'separator'
      },
      {
        label: isTracking ? 'Stop Tracking' : 'Start Tracking',
        type: 'normal',
        click: () => this.toggleTracking()
      },
      {
        label: 'Show Dashboard',
        type: 'normal',
        click: () => this.showMainWindow()
      },
      {
        type: 'separator'
      },
      {
        label: 'Status',
        type: 'submenu',
        submenu: [
          {
            label: `Tracking: ${isTracking ? 'Active' : 'Inactive'}`,
            type: 'normal',
            enabled: false
          },
          {
            label: `Session: ${this.formatDuration(status.sessionDuration)}`,
            type: 'normal',
            enabled: false
          },
          {
            label: `Today: ${this.formatDuration(status.todayDuration)}`,
            type: 'normal',
            enabled: false
          }
        ]
      },
      {
        type: 'separator'
      },
      {
        label: 'Quit',
        type: 'normal',
        click: () => {
          this.cleanup()
          app.quit()
        }
      }
    ])
    
    this.tray.setContextMenu(contextMenu)
  }

  private async toggleTracking(): Promise<void> {
    try {
      const status = this.activityTracker.getStatus()
      
      if (status.isTracking) {
        this.activityTracker.stop()
      } else {
        await this.activityTracker.start()
      }
      
      // Update menu after status change
      setTimeout(() => this.updateContextMenu(), 100)
    } catch (error) {
      console.error('Failed to toggle tracking from tray:', error)
    }
  }

  private showMainWindow(): void {
    try {
      const windows = BrowserWindow.getAllWindows()
      
      if (windows.length > 0) {
        const mainWindow = windows[0]
        
        if (mainWindow.isMinimized()) {
          mainWindow.restore()
        }
        
        mainWindow.show()
        mainWindow.focus()
        
        // Platform-specific window handling
        if (platformUtils.isMacOS()) {
          app.dock?.show()
        }
      }
    } catch (error) {
      console.error('Failed to show main window from tray:', error)
    }
  }

  private formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  public updateStatus(): void {
    this.updateContextMenu()
  }

  public cleanup(): void {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }

  public getTray(): Tray | null {
    return this.tray
  }

  // Platform-specific methods
  private setupPlatformSpecificIcons(): void {
    if (platformUtils.isWindows()) {
      // Use ICO format for better Windows tray compatibility
      this.iconPath = join(process.cwd(), 'build/icon.ico')
      this.iconActivePath = join(process.cwd(), 'build/icon-active.ico')
    } else if (platformUtils.isMacOS()) {
      // Use PNG with template image for macOS
      this.iconPath = join(process.cwd(), 'build/iconTemplate.png')
      this.iconActivePath = join(process.cwd(), 'build/iconTemplate-active.png')
    } else {
      // Use PNG for Linux
      this.iconPath = join(process.cwd(), 'build/icon.png')
      this.iconActivePath = join(process.cwd(), 'build/icon-active.png')
    }
  }

  private createPlatformIcon(): Electron.NativeImage {
    const icon = nativeImage.createFromPath(this.iconPath)
    
    if (platformUtils.isMacOS()) {
      icon.setTemplateImage(true) // For better macOS integration
    }
    
    return icon
  }

  private setupPlatformSpecificTray(): void {
    if (!this.tray) return
    
    if (platformUtils.isMacOS() && this.isMenuBarMode) {
      // macOS menu bar specific setup
      this.tray.setToolTip('Activity Tracker')
      // Hide dock icon for menu bar only mode
      app.dock?.hide()
    } else {
      // Standard system tray setup
      this.tray.setToolTip('Activity Tracker')
    }
  }

  private setupTrayEventHandlers(): void {
    if (!this.tray) return
    
    if (platformUtils.isWindows()) {
      // Windows-specific tray behavior
      this.tray.on('click', () => {
        this.showMainWindow()
      })
      
      this.tray.on('double-click', () => {
        this.toggleTracking()
      })
    } else if (platformUtils.isMacOS()) {
      // macOS-specific tray behavior
      this.tray.on('click', () => {
        // On macOS, clicking shows the context menu
        if (this.tray) {
          this.tray.popUpContextMenu()
        }
      })
      
      this.tray.on('right-click', () => {
        this.showMainWindow()
      })
    } else {
      // Linux-specific tray behavior
      this.tray.on('click', () => {
        this.showMainWindow()
      })
      
      this.tray.on('double-click', () => {
        this.toggleTracking()
      })
    }
  }

  private async handleStatusChangeNotification(isTracking: boolean): Promise<void> {
    const now = Date.now()
    
    // Respect notification cooldown
    if (now - this.lastNotificationTime < this.notificationCooldown) {
      return
    }
    
    this.lastNotificationTime = now
    
    const notificationOptions: NotificationOptions = {
      title: 'Activity Tracker',
      body: isTracking ? 'Tracking started' : 'Tracking stopped',
      icon: this.iconPath,
      silent: false,
      urgency: 'low'
    }
    
    try {
      await this.platformAdapter.showNotification(notificationOptions)
    } catch (error) {
      console.error('Failed to show status change notification:', error)
    }
  }

  public async showCustomNotification(title: string, body: string, urgent: boolean = false): Promise<void> {
    const notificationOptions: NotificationOptions = {
      title,
      body,
      icon: this.iconPath,
      silent: false,
      urgency: urgent ? 'critical' : 'normal'
    }
    
    try {
      await this.platformAdapter.showNotification(notificationOptions)
    } catch (error) {
      console.error('Failed to show custom notification:', error)
    }
  }

  public enableMenuBarMode(): void {
    if (platformUtils.isMacOS() && this.platformAdapter.getCapabilities().supportsMenuBar) {
      this.isMenuBarMode = true
      if (app.dock) {
        app.dock.hide()
      }
      console.log('Menu bar mode enabled')
    }
  }

  public disableMenuBarMode(): void {
    if (platformUtils.isMacOS()) {
      this.isMenuBarMode = false
      if (app.dock) {
        app.dock.show()
      }
      console.log('Menu bar mode disabled')
    }
  }

  public getPlatformCapabilities() {
    return this.platformAdapter.getCapabilities()
  }
}