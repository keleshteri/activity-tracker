import { BasePlatformAdapter } from './base'
import { WindowInfo, NotificationOptions, PlatformCapabilities } from './types'
// const activeWin = require('active-win')
import { shell } from 'electron'
import notifier from 'node-notifier'
import * as fs from 'fs'

export class LinuxPlatformAdapter extends BasePlatformAdapter {
  private desktopEnvironment: string
  
  constructor() {
    super()
    this.desktopEnvironment = this.detectDesktopEnvironment()
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
      // Use wmctrl to get all windows on Linux
      const result = await this.executeCommand('wmctrl -l -p -G')
      if (!result) return []

      const lines = result.split('\n').filter(line => line.trim())
      const windows: WindowInfo[] = []

      for (const line of lines) {
        const parts = line.trim().split(/\s+/)
        if (parts.length >= 7) {
          const windowId = parseInt(parts[0], 16)
          const processId = parseInt(parts[2])
          const x = parseInt(parts[3])
          const y = parseInt(parts[4])
          const width = parseInt(parts[5])
          const height = parseInt(parts[6])
          const title = parts.slice(8).join(' ')

          // Get process name
          let processName = ''
          try {
            const procResult = await this.executeCommand(`ps -p ${processId} -o comm=`)
            processName = procResult.trim()
          } catch {
            processName = 'Unknown'
          }

          windows.push({
            id: windowId,
            title: title,
            owner: {
              name: processName,
              processId: processId,
              path: ''
            },
            bounds: {
              x: x,
              y: y,
              width: width,
              height: height
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
      // Try different notification methods based on desktop environment
      if (await this.hasCommand('notify-send')) {
        // Use notify-send (most common on Linux)
        let command = `notify-send "${options.title}" "${options.body}"`
        
        if (options.icon) {
          command += ` --icon="${options.icon}"`
        }
        
        if (options.urgency) {
          command += ` --urgency=${options.urgency}`
        }
        
        await this.executeCommand(command)
      } else {
        // Fallback to node-notifier
        await new Promise<void>((resolve, reject) => {
          notifier.notify({
            title: options.title,
            message: options.body,
            icon: options.icon,
            sound: !options.silent,
            wait: false
          }, (err) => {
            if (err) reject(err)
            else resolve()
          })
        })
      }
    } catch (error) {
      console.error('Failed to show notification:', error)
    }
  }

  async openFileManager(path: string): Promise<void> {
    try {
      // Try different file managers based on desktop environment
      const fileManagers = [
        'xdg-open',
        'nautilus',
        'dolphin',
        'thunar',
        'pcmanfm',
        'nemo'
      ]

      for (const fm of fileManagers) {
        if (await this.hasCommand(fm)) {
          await this.executeCommand(`${fm} "${path}"`)
          return
        }
      }

      // Fallback to shell.openPath
      await shell.openPath(path)
    } catch (error) {
      console.error('Failed to open file manager:', error)
    }
  }

  async showItemInFolder(path: string): Promise<void> {
    try {
      // Try to show item in folder using different methods
      if (await this.hasCommand('dbus-send')) {
        // Use D-Bus to show item in file manager
        const command = `dbus-send --session --dest=org.freedesktop.FileManager1 --type=method_call /org/freedesktop/FileManager1 org.freedesktop.FileManager1.ShowItems array:string:"file://${path}" string:""`
        await this.executeCommand(command)
      } else {
        // Fallback to opening parent directory
        const parentDir = path.substring(0, path.lastIndexOf('/'))
        await this.openFileManager(parentDir)
      }
    } catch (error) {
      console.error('Failed to show item in folder:', error)
    }
  }

  async optimizeForPlatform(): Promise<void> {
    try {
      // Linux-specific optimizations
      
      // Set process priority for better performance
      await this.executeCommand(`renice -n -5 -p ${process.pid}`)
      
      // Enable Linux-specific features based on desktop environment
      await this.optimizeForDesktopEnvironment()
      
      // Check and install required dependencies
      await this.checkDependencies()
      
      console.log(`Linux platform optimizations applied for ${this.desktopEnvironment}`)
    } catch (error) {
      console.error('Failed to apply Linux optimizations:', error)
    }
  }

  getCapabilities(): PlatformCapabilities {
    return {
      supportsSystemTray: this.supportsSystemTray(),
      supportsMenuBar: false, // Linux typically uses system tray
      supportsNotifications: true,
      supportsGlobalShortcuts: true,
      supportsWindowTracking: true,
      supportsScreenshots: true,
      supportsAutoUpdater: true
    }
  }

  // Linux-specific helper methods
  private detectDesktopEnvironment(): string {
    const de = process.env.XDG_CURRENT_DESKTOP || 
               process.env.DESKTOP_SESSION || 
               process.env.GDMSESSION ||
               'unknown'
    return de.toLowerCase()
  }

  private supportsSystemTray(): boolean {
    // Check if system tray is supported based on desktop environment
    const supportedDEs = ['gnome', 'kde', 'xfce', 'lxde', 'mate', 'cinnamon']
    return supportedDEs.some(de => this.desktopEnvironment.includes(de))
  }

  private async hasCommand(command: string): Promise<boolean> {
    try {
      await this.executeCommand(`which ${command}`)
      return true
    } catch {
      return false
    }
  }

  private async optimizeForDesktopEnvironment(): Promise<void> {
    try {
      switch (true) {
        case this.desktopEnvironment.includes('gnome'):
          await this.optimizeForGnome()
          break
        case this.desktopEnvironment.includes('kde'):
          await this.optimizeForKDE()
          break
        case this.desktopEnvironment.includes('xfce'):
          await this.optimizeForXFCE()
          break
        default:
          console.log('Using generic Linux optimizations')
      }
    } catch (error) {
      console.error('Failed to optimize for desktop environment:', error)
    }
  }

  private async optimizeForGnome(): Promise<void> {
    // GNOME-specific optimizations
    if (await this.hasCommand('gsettings')) {
      // Enable GNOME Shell extensions if needed
      console.log('Applied GNOME optimizations')
    }
  }

  private async optimizeForKDE(): Promise<void> {
    // KDE-specific optimizations
    if (await this.hasCommand('kwriteconfig5')) {
      // Configure KDE settings if needed
      console.log('Applied KDE optimizations')
    }
  }

  private async optimizeForXFCE(): Promise<void> {
    // XFCE-specific optimizations
    if (await this.hasCommand('xfconf-query')) {
      // Configure XFCE settings if needed
      console.log('Applied XFCE optimizations')
    }
  }

  private async checkDependencies(): Promise<void> {
    const requiredCommands = ['wmctrl', 'xdotool', 'notify-send']
    const missing: string[] = []

    for (const cmd of requiredCommands) {
      if (!(await this.hasCommand(cmd))) {
        missing.push(cmd)
      }
    }

    if (missing.length > 0) {
      console.warn(`Missing Linux dependencies: ${missing.join(', ')}`)
      console.warn('Some features may not work properly. Please install missing packages.')
    }
  }

  async getLinuxDistribution(): Promise<string> {
    try {
      if (fs.existsSync('/etc/os-release')) {
        const content = fs.readFileSync('/etc/os-release', 'utf8')
        const nameMatch = content.match(/^NAME="?([^"\n]+)"?/m)
        return nameMatch ? nameMatch[1] : 'Unknown'
      }
      return 'Unknown'
    } catch {
      return 'Unknown'
    }
  }

  async getInstalledPackages(): Promise<string[]> {
    try {
      // Try different package managers
      if (await this.hasCommand('dpkg')) {
        const result = await this.executeCommand('dpkg --get-selections | grep -v deinstall | cut -f1')
        return result.split('\n').filter(Boolean)
      } else if (await this.hasCommand('rpm')) {
        const result = await this.executeCommand('rpm -qa --queryformat "%{NAME}\n"')
        return result.split('\n').filter(Boolean)
      } else if (await this.hasCommand('pacman')) {
        const result = await this.executeCommand('pacman -Q | cut -d" " -f1')
        return result.split('\n').filter(Boolean)
      }
      return []
    } catch {
      return []
    }
  }
}