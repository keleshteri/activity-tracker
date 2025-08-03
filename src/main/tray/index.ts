import { Tray, Menu, nativeImage, app } from 'electron'
import { join } from 'path'
import { ActivityTracker } from '../tracker'

export class TrayManager {
  private tray: Tray | null = null
  private activityTracker: ActivityTracker
  private iconPath: string
  private iconActivePath: string

  constructor(activityTracker: ActivityTracker) {
    this.activityTracker = activityTracker
    
    // Set icon paths - use ICO format for better Windows tray compatibility
    this.iconPath = join(process.cwd(), 'build/icon.ico')
    this.iconActivePath = join(process.cwd(), 'build/icon.ico') // Using same icon for now
  }

  public initialize(): void {
    try {
      // Create tray with default icon
      const icon = nativeImage.createFromPath(this.iconPath)
      
      if (icon.isEmpty()) {
        console.error('Failed to load tray icon from path:', this.iconPath)
        return
      }
      
      icon.setTemplateImage(true) // For better macOS integration
      this.tray = new Tray(icon)
      this.tray.setToolTip('Activity Tracker')
      
      // Set up context menu
      this.updateContextMenu()
      
      // Listen for tracker status changes
      this.activityTracker.on('status-changed', (status) => {
        this.updateTrayIcon(status.isTracking)
        this.updateContextMenu()
      })
      
      // Handle tray click events
      this.tray.on('click', () => {
        this.showMainWindow()
      })
      
      this.tray.on('double-click', () => {
        this.toggleTracking()
      })
      
      console.log('Tray initialized successfully')
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
      const { BrowserWindow } = require('electron')
      const windows = BrowserWindow.getAllWindows()
      
      if (windows.length > 0) {
        const mainWindow = windows[0]
        
        if (mainWindow.isMinimized()) {
          mainWindow.restore()
        }
        
        mainWindow.show()
        mainWindow.focus()
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
}