import { PlatformAdapter, WindowInfo, SystemInfo, NotificationOptions, PlatformCapabilities } from './types'
import * as os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'
import { nativeTheme } from 'electron'

const execAsync = promisify(exec)

export abstract class BasePlatformAdapter implements PlatformAdapter {
  protected platform: NodeJS.Platform
  
  constructor() {
    this.platform = process.platform
  }

  // Abstract methods that must be implemented by platform-specific adapters
  abstract getActiveWindow(): Promise<WindowInfo | null>
  abstract getAllWindows(): Promise<WindowInfo[]>
  abstract showNotification(options: NotificationOptions): Promise<void>
  abstract openFileManager(path: string): Promise<void>
  abstract showItemInFolder(path: string): Promise<void>
  abstract optimizeForPlatform(): Promise<void>

  // Common implementations
  async getWindowById(id: number): Promise<WindowInfo | null> {
    const windows = await this.getAllWindows()
    return windows.find(w => w.id === id) || null
  }

  async getSystemInfo(): Promise<SystemInfo> {
    const cpus = os.cpus()
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    
    return {
      platform: this.platform as 'win32' | 'darwin' | 'linux',
      arch: os.arch(),
      version: os.release(),
      hostname: os.hostname(),
      uptime: os.uptime(),
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem
      },
      cpu: {
        model: cpus[0]?.model || 'Unknown',
        cores: cpus.length,
        usage: await this.getCpuUsage()
      }
    }
  }

  getSystemTheme(): 'light' | 'dark' | 'auto' {
    try {
      return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    } catch {
      return 'auto'
    }
  }

  supportsNotifications(): boolean {
    return true // Most platforms support notifications
  }

  getCapabilities(): PlatformCapabilities {
    return {
      supportsSystemTray: true,
      supportsMenuBar: this.platform === 'darwin',
      supportsNotifications: this.supportsNotifications(),
      supportsGlobalShortcuts: true,
      supportsWindowTracking: true,
      supportsScreenshots: true,
      supportsAutoUpdater: true
    }
  }

  async cleanup(): Promise<void> {
    // Base cleanup - can be overridden by platform-specific implementations
  }

  // Helper methods
  protected async getCpuUsage(): Promise<number> {
    try {
      if (this.platform === 'win32') {
        const { stdout } = await execAsync('wmic cpu get loadpercentage /value')
        const match = stdout.match(/LoadPercentage=(\d+)/)
        return match ? parseInt(match[1]) : 0
      } else if (this.platform === 'darwin') {
        const { stdout } = await execAsync('top -l 1 -n 0 | grep "CPU usage"')
        const match = stdout.match(/(\d+\.\d+)% user/)
        return match ? parseFloat(match[1]) : 0
      } else {
        const { stdout } = await execAsync('top -bn1 | grep "Cpu(s)"')
        const match = stdout.match(/(\d+\.\d+)%us/)
        return match ? parseFloat(match[1]) : 0
      }
    } catch {
      return 0
    }
  }

  protected formatPath(filePath: string): string {
    return path.normalize(filePath)
  }

  protected async executeCommand(command: string): Promise<string> {
    try {
      const { stdout } = await execAsync(command)
      return stdout.trim()
    } catch (error) {
      console.error('Command execution failed:', error)
      return ''
    }
  }
}