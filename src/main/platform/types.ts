// Platform abstraction layer types
export interface WindowInfo {
  id: number
  title: string
  owner: {
    name: string
    processId: number
    bundleId?: string
    path?: string
  }
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  memoryUsage?: number
  url?: string
}

export interface SystemInfo {
  platform: 'win32' | 'darwin' | 'linux'
  arch: string
  version: string
  hostname: string
  uptime: number
  memory: {
    total: number
    free: number
    used: number
  }
  cpu: {
    model: string
    cores: number
    usage: number
  }
  battery?: {
    level: number
    charging: boolean
  }
}

export interface NotificationOptions {
  title: string
  body: string
  icon?: string
  silent?: boolean
  urgency?: 'low' | 'normal' | 'critical'
  actions?: Array<{
    type: string
    text: string
  }>
  timeoutType?: 'default' | 'never'
  sound?: string
}

export interface PlatformCapabilities {
  supportsSystemTray: boolean
  supportsMenuBar: boolean
  supportsNotifications: boolean
  supportsGlobalShortcuts: boolean
  supportsWindowTracking: boolean
  supportsScreenshots: boolean
  supportsAutoUpdater: boolean
}

export interface PlatformAdapter {
  // Window management
  getActiveWindow(): Promise<WindowInfo | null>
  getAllWindows(): Promise<WindowInfo[]>
  getWindowById(id: number): Promise<WindowInfo | null>
  
  // System information
  getSystemInfo(): Promise<SystemInfo>
  getSystemTheme(): 'light' | 'dark' | 'auto'
  
  // Notifications
  showNotification(options: NotificationOptions): Promise<void>
  supportsNotifications(): boolean
  
  // File system
  openFileManager(path: string): Promise<void>
  showItemInFolder(path: string): Promise<void>
  
  // Platform capabilities
  getCapabilities(): PlatformCapabilities
  
  // Platform-specific optimizations
  optimizeForPlatform(): Promise<void>
  
  // Cleanup
  cleanup(): Promise<void>
}

export interface TrayOptions {
  icon: string
  tooltip: string
  menu?: any[]
  onClick?: () => void
  onDoubleClick?: () => void
  onRightClick?: () => void
}

export interface MenuBarOptions {
  icon: string
  tooltip: string
  menu?: any[]
  showDockIcon?: boolean
}