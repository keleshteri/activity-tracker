import { Tray, Menu, nativeImage, app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { platform } from 'os'

export interface TrayStatus {
  isTracking: boolean
  currentActivity: string | null
  sessionTime: number
}

export class UnifiedTrayManager {
  private tray: Tray | null = null
  private iconPath: string = ''
  private iconActivePath: string = ''
  private isMenuBarMode: boolean = false
  private currentStatus: TrayStatus = {
    isTracking: false,
    currentActivity: null,
    sessionTime: 0
  }

  constructor() {
    this.setupPlatformSpecificIcons()
    
    // Enable menu bar mode on macOS
    if (this.isMacOS()) {
      this.isMenuBarMode = true
    }
  }

  public async initialize(): Promise<void> {
    try {
      // Create tray with platform-appropriate icon
      const icon = this.createPlatformIcon()
      
      if (icon.isEmpty()) {
        console.warn('Failed to load tray icon, creating fallback')
        // Create a simple fallback icon
        const fallbackIcon = nativeImage.createEmpty()
        this.tray = new Tray(fallbackIcon)
      } else {
        this.tray = new Tray(icon)
      }
      
      this.setupPlatformSpecificTray()
      this.updateContextMenu()
      this.setupTrayEventHandlers()
      
      console.log(`Unified tray manager initialized successfully (${this.isMenuBarMode ? 'Menu Bar' : 'System Tray'} mode)`)
    } catch (error) {
      console.error('Failed to initialize unified tray manager:', error)
    }
  }

  private setupPlatformSpecificIcons(): void {
    const resourcesPath = join(__dirname, '../../resources')
    
    if (this.isMacOS()) {
      // macOS prefers template images for menu bar
      this.iconPath = join(resourcesPath, 'icon.png')
      this.iconActivePath = join(resourcesPath, 'icon.png')
    } else if (this.isWindows()) {
      // Windows system tray
      this.iconPath = join(resourcesPath, 'icon.png')
      this.iconActivePath = join(resourcesPath, 'icon.png')
    } else {
      // Linux system tray
      this.iconPath = join(resourcesPath, 'icon.png')
      this.iconActivePath = join(resourcesPath, 'icon.png')
    }
  }

  private createPlatformIcon(): Electron.NativeImage {
    const icon = nativeImage.createFromPath(this.iconPath)
    
    if (this.isMacOS() && this.isMenuBarMode) {
      // macOS menu bar icons should be template images
      icon.setTemplateImage(true)
    }
    
    return icon
  }

  private setupPlatformSpecificTray(): void {
    if (!this.tray) return

    if (this.isMacOS()) {
      // macOS menu bar specific setup
      this.tray.setToolTip('Activity Tracker')
      // Don't show dock icon when in menu bar mode
      if (this.isMenuBarMode) {
        app.dock?.hide()
      }
    } else if (this.isWindows()) {
      // Windows system tray specific setup
      this.tray.setToolTip('Activity Tracker - Click to open')
    } else {
      // Linux system tray specific setup
      this.tray.setToolTip('Activity Tracker')
    }
  }

  private setupTrayEventHandlers(): void {
    if (!this.tray) return

    // Platform-specific click behavior
    if (this.isMacOS()) {
      // macOS: right-click shows menu, left-click shows window
      this.tray.on('click', () => {
        this.showMainWindow()
      })
      this.tray.on('right-click', () => {
        // Context menu is automatically shown on right-click
      })
    } else {
      // Windows/Linux: click shows window, right-click shows menu
      this.tray.on('click', () => {
        this.showMainWindow()
      })
    }
  }

  private updateContextMenu(): void {
    if (!this.tray) return

    const menuTemplate: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'Activity Tracker',
        type: 'normal',
        enabled: false
      },
      {
        type: 'separator'
      },
      {
        label: 'Show Window',
        click: () => this.showMainWindow()
      }
    ]

    // Add tracking controls section
    menuTemplate.push(
      {
        type: 'separator'
      },
      {
        label: this.currentStatus.isTracking ? 'Stop Tracking' : 'Start Tracking',
        click: () => this.toggleTracking(),
        enabled: false // Temporarily disabled
      },
      {
        label: `Status: ${this.currentStatus.isTracking ? 'Active' : 'Inactive'}`,
        enabled: false
      }
    )

    // Add current activity if available
    if (this.currentStatus.currentActivity) {
      menuTemplate.push({
        label: `Current: ${this.currentStatus.currentActivity}`,
        enabled: false
      })
    }

    // Add session time
    if (this.currentStatus.sessionTime > 0) {
      menuTemplate.push({
        label: `Session: ${this.formatDuration(this.currentStatus.sessionTime)}`,
        enabled: false
      })
    }

    // Add quick settings section
    menuTemplate.push(
      {
        type: 'separator'
      },
      {
        label: 'Quick Settings',
        submenu: [
          {
            label: 'Privacy Mode',
            type: 'checkbox',
            checked: false,
            enabled: false // Temporarily disabled
          },
          {
            label: 'Screenshots',
            type: 'checkbox',
            checked: false,
            enabled: false // Temporarily disabled
          },
          {
            type: 'separator'
          },
          {
            label: 'Open Settings',
            click: () => this.showMainWindow()
          }
        ]
      }
    )

    // Platform-specific menu items
    if (this.isMacOS()) {
      menuTemplate.push(
        {
          type: 'separator'
        },
        {
          label: 'About Activity Tracker',
          click: () => {
            shell.openExternal('https://github.com/your-repo/activity-tracker')
          }
        }
      )
    }

    // Add quit option
    menuTemplate.push(
      {
        type: 'separator'
      },
      {
        label: this.isMacOS() ? 'Quit Activity Tracker' : 'Exit',
        click: () => {
          app.quit()
        }
      }
    )

    const contextMenu = Menu.buildFromTemplate(menuTemplate)
    this.tray.setContextMenu(contextMenu)
  }

  private showMainWindow(): void {
    const windows = BrowserWindow.getAllWindows()
    if (windows.length > 0) {
      const mainWindow = windows[0]
      
      if (this.isMacOS()) {
        // macOS specific window management
        if (!mainWindow.isVisible()) {
          mainWindow.show()
        }
        if (mainWindow.isMinimized()) {
          mainWindow.restore()
        }
        mainWindow.focus()
        
        // Show dock icon when window is visible
        if (this.isMenuBarMode) {
          app.dock?.show()
        }
      } else {
        // Windows/Linux window management
        if (mainWindow.isMinimized()) {
          mainWindow.restore()
        }
        mainWindow.focus()
        mainWindow.show()
      }
    }
  }

  private toggleTracking(): void {
    // This will be implemented when ActivityTracker is re-enabled
    console.log('Toggle tracking - temporarily disabled')
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

  public updateStatus(status?: Partial<TrayStatus>): void {
    if (status) {
      this.currentStatus = { ...this.currentStatus, ...status }
    }
    
    // Update tray icon based on status
    this.updateTrayIcon(this.currentStatus.isTracking)
    
    // Update context menu
    this.updateContextMenu()
  }

  private updateTrayIcon(isActive: boolean): void {
    if (!this.tray) return

    try {
      const iconPath = isActive ? this.iconActivePath : this.iconPath
      const icon = nativeImage.createFromPath(iconPath)
      
      if (this.isMacOS() && this.isMenuBarMode) {
        icon.setTemplateImage(true)
      }
      
      this.tray.setImage(icon)
      
      // Update tooltip with current status
      const tooltip = `Activity Tracker - ${isActive ? 'Tracking' : 'Inactive'}`
      this.tray.setToolTip(tooltip)
    } catch (error) {
      console.error('Failed to update tray icon:', error)
    }
  }

  public cleanup(): void {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
      
      // Restore dock icon on macOS if hidden
      if (this.isMacOS() && this.isMenuBarMode) {
        app.dock?.show()
      }
      
      console.log('Unified tray manager cleaned up')
    }
  }

  public getTray(): Tray | null {
    return this.tray
  }

  public enableMenuBarMode(): void {
    if (this.isMacOS()) {
      this.isMenuBarMode = true
      app.dock?.hide()
      console.log('Menu bar mode enabled')
    }
  }

  public disableMenuBarMode(): void {
    if (this.isMacOS()) {
      this.isMenuBarMode = false
      app.dock?.show()
      console.log('Menu bar mode disabled')
    }
  }

  // Platform detection helpers
  private isMacOS(): boolean {
    return platform() === 'darwin'
  }

  private isWindows(): boolean {
    return platform() === 'win32'
  }



  public getPlatformInfo() {
    return {
      platform: platform(),
      isMenuBarMode: this.isMenuBarMode,
      supportsMenuBar: this.isMacOS(),
      supportsSystemTray: true
    }
  }
}