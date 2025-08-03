import { PlatformAdapter } from './types'
import { WindowsPlatformAdapter } from './windows'
import { MacOSPlatformAdapter } from './macos'
import { LinuxPlatformAdapter } from './linux'

export class PlatformFactory {
  private static instance: PlatformAdapter | null = null

  static createPlatformAdapter(): PlatformAdapter {
    if (this.instance) {
      return this.instance
    }

    switch (process.platform) {
      case 'win32':
        this.instance = new WindowsPlatformAdapter()
        break
      case 'darwin':
        this.instance = new MacOSPlatformAdapter()
        break
      case 'linux':
        this.instance = new LinuxPlatformAdapter()
        break
      default:
        throw new Error(`Unsupported platform: ${process.platform}`)
    }

    return this.instance
  }

  static getPlatformAdapter(): PlatformAdapter {
    if (!this.instance) {
      return this.createPlatformAdapter()
    }
    return this.instance
  }

  static async cleanup(): Promise<void> {
    if (this.instance) {
      await this.instance.cleanup()
      this.instance = null
    }
  }

  static getSupportedPlatforms(): string[] {
    return ['win32', 'darwin', 'linux']
  }

  static isSupported(platform?: string): boolean {
    const targetPlatform = platform || process.platform
    return this.getSupportedPlatforms().includes(targetPlatform)
  }

  static getPlatformName(platform?: string): string {
    const targetPlatform = platform || process.platform
    switch (targetPlatform) {
      case 'win32':
        return 'Windows'
      case 'darwin':
        return 'macOS'
      case 'linux':
        return 'Linux'
      default:
        return 'Unknown'
    }
  }
}

// Export singleton instance getter
export const getPlatformAdapter = (): PlatformAdapter => {
  return PlatformFactory.getPlatformAdapter()
}

// Export platform-specific utilities
export const platformUtils = {
  isWindows: () => process.platform === 'win32',
  isMacOS: () => process.platform === 'darwin',
  isLinux: () => process.platform === 'linux',
  getPlatformName: () => PlatformFactory.getPlatformName(),
  isSupported: () => PlatformFactory.isSupported()
}