import { BasePlatformAdapter } from './base'
import { WindowInfo, NotificationOptions, PlatformCapabilities } from './types'
// const activeWin = require('active-win')
import { shell } from 'electron'
import notifier from 'node-notifier'
import * as os from 'os'

export class WindowsPlatformAdapter extends BasePlatformAdapter {
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
      // For Windows, we'll use PowerShell to get all visible windows
      const command = `
        Get-Process | Where-Object {$_.MainWindowTitle -ne ""} | 
        Select-Object Id, ProcessName, MainWindowTitle, 
        @{Name="WorkingSet";Expression={$_.WorkingSet64}} | 
        ConvertTo-Json
      `
      
      const result = await this.executeCommand(`powershell -Command "${command}"`)
      if (!result) return []

      const processes = JSON.parse(result)
      const processArray = Array.isArray(processes) ? processes : [processes]

      return processArray.map((proc: any, index: number) => ({
        id: proc.Id || index,
        title: proc.MainWindowTitle || '',
        owner: {
          name: proc.ProcessName || '',
          processId: proc.Id || 0,
          path: ''
        },
        bounds: {
          x: 0,
          y: 0,
          width: 0,
          height: 0
        },
        memoryUsage: proc.WorkingSet || 0
      }))
    } catch (error) {
      console.error('Failed to get all windows:', error)
      return []
    }
  }

  async showNotification(options: NotificationOptions): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        notifier.notify({
          title: options.title,
          message: options.body,
          icon: options.icon,
          sound: !options.silent,
          wait: false,
          type: 'info',
          appID: 'Activity Tracker'
        }, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })
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
      // Windows-specific optimizations
      
      // Set process priority to high for better window tracking
      await this.executeCommand('wmic process where processid="' + process.pid + '" CALL setpriority "high priority"')
      
      // Enable Windows 10/11 specific features
      if (this.isWindows10OrLater()) {
        // Enable Windows 10+ notification features
        process.env.ELECTRON_ENABLE_LOGGING = '1'
      }
      
      // Set Windows-specific app user model ID for proper taskbar grouping
      if (process.platform === 'win32') {
        const { app } = require('electron')
        app.setAppUserModelId('com.activitytracker.app')
      }
      
      console.log('Windows platform optimizations applied')
    } catch (error) {
      console.error('Failed to apply Windows optimizations:', error)
    }
  }

  getCapabilities(): PlatformCapabilities {
    return {
      supportsSystemTray: true,
      supportsMenuBar: false, // Windows uses system tray instead
      supportsNotifications: true,
      supportsGlobalShortcuts: true,
      supportsWindowTracking: true,
      supportsScreenshots: true,
      supportsAutoUpdater: true
    }
  }

  // Windows-specific helper methods
  private isWindows10OrLater(): boolean {
    const version = os.release()
    const majorVersion = parseInt(version.split('.')[0])
    return majorVersion >= 10
  }

  async getWindowsVersion(): Promise<string> {
    try {
      const result = await this.executeCommand('ver')
      return result
    } catch {
      return 'Unknown'
    }
  }

  async isRunningAsAdmin(): Promise<boolean> {
    try {
      const result = await this.executeCommand('net session 2>nul')
      return result.length > 0
    } catch {
      return false
    }
  }

  async getInstalledPrograms(): Promise<string[]> {
    try {
      const command = `
        Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | 
        Select-Object DisplayName | 
        Where-Object {$_.DisplayName -ne $null} | 
        ConvertTo-Json
      `
      
      const result = await this.executeCommand(`powershell -Command "${command}"`)
      if (!result) return []

      const programs = JSON.parse(result)
      const programArray = Array.isArray(programs) ? programs : [programs]
      
      return programArray.map((prog: any) => prog.DisplayName).filter(Boolean)
    } catch {
      return []
    }
  }
}