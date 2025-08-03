// Platform abstraction layer exports
export * from './types'
export * from './base'
export * from './windows'
export * from './macos'
export * from './linux'
export * from './factory'

// Re-export commonly used items for convenience
export { getPlatformAdapter, platformUtils } from './factory'
export type { PlatformAdapter, WindowInfo, SystemInfo, NotificationOptions, PlatformCapabilities } from './types'