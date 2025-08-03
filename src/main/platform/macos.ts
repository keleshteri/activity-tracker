import { BasePlatformAdapter } from './base'
import { WindowInfo, NotificationOptions, PlatformCapabilities } from './types'
// const activeWin = require('active-win')
import { shell, Notification } from 'electron'
import * as path from 'path'

export class MacOSPlatformAdapter extends BasePlatformAdapter {
  constructor() {
    super()
  }

  async getActiveWindow(): Promise<WindowInfo | null> {
    try {
      // TODO: Re-enable after fixing active-win import issue
      // const activeWindow = await activeWin()
      // if (!activeWindow) return null

      // return {
      //   id: activeWindow.id,
      //   title: activeWindow.title,
      //   owner: {
      //     name: activeWindow.owner.name,
      //     processId: activeWindow.owner.processId,
      //     bundleId: activeWindow.owner.bundleId,
      //     path: activeWindow.owner.path
      //   },
      //   bounds: {
      //     x: activeWindow.bounds.x,
      //     y: activeWindow.bounds.y,
      //     width: activeWindow.bounds.width,
      //     height: activeWindow.bounds.height
      //   },
      //   memoryUsage: activeWindow.memoryUsage,
      //   url: activeWindow.url
      // }
      
      // Temporary fallback
      return null
    } catch (error) {
      console.error('Failed to get active window:', error)
      return null
    }
  }

  async getAllWindows(): Promise<WindowInfo[]> {
    try {
      // Use AppleScript to get all visible windows on macOS
      const script = `
        tell application "System Events"
          set windowList to {}
          repeat with proc in (every process whose visible is true)
            try
              repeat with win in (every window of proc)
                set windowInfo to {name of proc, name of win, id of win}
                set end of windowList to windowInfo
              end repeat
            end try
          end repeat
          return windowList
        end tell
      `
      
      const result = await this.executeCommand(`osascript -e '${script}'`)
      if (!result) return []

      // Parse the AppleScript result
      const lines = result.split(', ')
      const windows: WindowInfo[] = []
      
      for (let i = 0; i < lines.length; i += 3) {
        if (i + 2 < lines.length) {
          windows.push({
            id: parseInt(lines[i + 2]) || i / 3,
            title: lines[i + 1] || '',
            owner: {
              name: lines[i] || '',
              processId: 0,
              bundleId: '',
              path: ''
            },
            bounds: {
              x: 0,
              y: 0,
              width: 0,
              height: 0
            }
          })
        }
      }
      
      return windows
    } catch (error) {
      console.error('Failed to get all windows:', error)
      return []
    }
  }

  async showNotification(options: NotificationOptions): Promise<void> {
    try {
      // Use Electron's native notification on macOS for better integration
      if (Notification.isSupported()) {
        const notification = new Notification({
          title: options.title,
          body: options.body,
          icon: options.icon,
          silent: options.silent || false
        })
        
        notification.show()
      } else {
        // Fallback to terminal-notifier or osascript
        const script = `display notification "${options.body}" with title "${options.title}"`
        await this.executeCommand(`osascript -e '${script}'`)
      }
    } catch (error) {
      console.error('Failed to show notification:', error)
    }
  }

  async openFileManager(path: string): Promise<void> {
    try {
      await shell.openPath(path)
    } catch (error) {
      console.error('Failed to open file manager:', error)
    }
  }

  async showItemInFolder(path: string): Promise<void> {
    try {
      shell.showItemInFolder(path)
    } catch (error) {
      console.error('Failed to show item in folder:', error)
    }
  }

  async optimizeForPlatform(): Promise<void> {
    try {
      // macOS-specific optimizations
      
      // Enable macOS-specific features
      const { app } = require('electron')
      
      // Set dock icon behavior
      if (app.dock) {
        app.dock.setIcon(path.join(__dirname, '../../resources/icon.png'))
      }
      
      // Enable macOS native fullscreen
      app.setAboutPanelOptions({
        applicationName: 'Activity Tracker',
        applicationVersion: app.getVersion(),
        copyright: 'Copyright © 2024'
      })
      
      // Request accessibility permissions for better window tracking
      await this.requestAccessibilityPermissions()
      
      // Enable macOS-specific window management
      await this.enableWindowManagement()
      
      console.log('macOS platform optimizations applied')
    } catch (error) {
      console.error('Failed to apply macOS optimizations:', error)
    }
  }

  getCapabilities(): PlatformCapabilities {
    return {
      supportsSystemTray: true,
      supportsMenuBar: true, // macOS supports menu bar apps
      supportsNotifications: true,
      supportsGlobalShortcuts: true,
      supportsWindowTracking: true,
      supportsScreenshots: true,
      supportsAutoUpdater: true
    }
  }

  // macOS-specific helper methods
  private async requestAccessibilityPermissions(): Promise<boolean> {
    try {
      const script = `
        tell application "System Events"
          try
            set frontApp to name of first application process whose frontmost is true
            return true
          on error
            return false
          end try
        end tell
      `
      
      const result = await this.executeCommand(`osascript -e '${script}'`)
      return result.trim() === 'true'
    } catch {
      return false
    }
  }

  private async enableWindowManagement(): Promise<void> {
    try {
      // Enable window management features specific to macOS
      const script = `
        tell application "System Events"
          set UI elements enabled to true
        end tell
      `
      
      await this.executeCommand(`osascript -e '${script}'`)
    } catch (error) {
      console.error('Failed to enable window management:', error)
    }
  }

  async getMacOSVersion(): Promise<string> {
    try {
      const result = await this.executeCommand('sw_vers -productVersion')
      return result
    } catch {
      return 'Unknown'
    }
  }

  async getInstalledApplications(): Promise<string[]> {
    try {
      const result = await this.executeCommand('ls /Applications')
      return result.split('\n').filter(app => app.endsWith('.app')).map(app => app.replace('.app', ''))
    } catch {
      return []
    }
  }

  async isDarkMode(): Promise<boolean> {
    try {
      const result = await this.executeCommand('defaults read -g AppleInterfaceStyle')
      return result.trim() === 'Dark'
    } catch {
      return false
    }
  }

  async enableMenuBarMode(): Promise<void> {
    try {
      const { app } = require('electron')
      
      // Hide dock icon and show only in menu bar
      if (app.dock) {
        app.dock.hide()
      }
      
      // Set LSUIElement to true for menu bar only app
      app.setLoginItemSettings({
        openAtLogin: false,
        openAsHidden: true
      })
      
      console.log('Menu bar mode enabled')
    } catch (error) {
      console.error('Failed to enable menu bar mode:', error)
    }
  }
}