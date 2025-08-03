import { app, shell, BrowserWindow, ipcMain, dialog, Notification } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

// Import our activity tracker components
import { DatabaseManager } from './database'
import { ActivityTracker } from './tracker'
import { FocusManager } from './focus-manager'
import { DistractionDetector } from './distraction-detector'
import { AppCategorizer } from './app-categorizer'
import { IntegrationManager } from './integration'
import { TrayManager } from './tray'
import { TrackerConfig, DashboardData } from './types'

// Import platform abstraction and auto-updater
import { getPlatformAdapter } from './platform'
import { getAutoUpdaterManager } from './updater'
import type { PlatformAdapter } from './platform'
import type { AutoUpdaterManager } from './updater'

// Set app name early for proper recognition
app.setName('Activity Tracking')

// Global instances
let mainWindow: BrowserWindow | null = null
let databaseManager: DatabaseManager
// let unifiedTrayManager: UnifiedTrayManager // Removed to avoid duplicate tray icons
let activityTracker: ActivityTracker
let focusManager: FocusManager
let distractionDetector: DistractionDetector
let appCategorizer: AppCategorizer
let integrationManager: IntegrationManager
let trayManager: TrayManager
let platformAdapter: PlatformAdapter
let autoUpdaterManager: AutoUpdaterManager

function createWindow(): void {
  // Create the browser window with platform-specific optimizations
  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    title: 'Activity Tracking',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  }

  // Apply platform-specific window options
  // if (platformUtils.isLinux()) {
  //   windowOptions.icon = icon
  // } else if (platformUtils.isMacOS()) {
  //   windowOptions.titleBarStyle = 'hiddenInset'
  //   windowOptions.trafficLightPosition = { x: 20, y: 20 }
  // } else if (platformUtils.isWindows()) {
  //   windowOptions.frame = true
  // }

  mainWindow = new BrowserWindow(windowOptions)

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    // Ensure the title is set correctly
    mainWindow?.setTitle('Activity Tracking')
    
    // Platform-specific window setup
    // if (platformUtils.isMacOS()) {
    //   // Set up macOS-specific window behavior
    //   mainWindow?.setVisibleOnAllWorkspaces(false)
    // }
  })

  // Handle window close event for platform-specific behavior
  mainWindow.on('close', (_event) => {
    // if (platformUtils.isMacOS()) {
    //   // On macOS, hide window instead of closing
    //   _event.preventDefault()
    //   mainWindow?.hide()
    // }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Setup IPC handlers for activity tracking
function setupIPC(): void {
  // Ping test
  ipcMain.on('ping', () => console.log('pong'))

  // Activity tracking controls
  ipcMain.handle('tracker:start', async () => {
    try {
      console.log('IPC tracker:start called - someone is starting the tracker!')
      await activityTracker.start()
      return { success: true }
    } catch (error) {
      console.error('Failed to start tracker:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('tracker:stop', () => {
    try {
      activityTracker.stop()
      return { success: true }
    } catch (error) {
      console.error('Failed to stop tracker:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('tracker:status', () => {
    const status = activityTracker.getStatus()
    console.log('IPC tracker:status called, returning:', status)
    return status
  })

  ipcMain.handle('tracker:config:get', () => {
    return activityTracker.getConfig()
  })

  ipcMain.handle('tracker:config:update', async (_, config: Partial<TrackerConfig>) => {
    try {
      await activityTracker.updateConfig(config)
      return { success: true }
    } catch (error) {
      console.error('Failed to update config:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Dashboard data
  ipcMain.handle('dashboard:get-data', async (): Promise<DashboardData> => {
    console.log('=== IPC dashboard:get-data called ===')
    try {
      console.log('Calling databaseManager.getDashboardData()')
      const data = await databaseManager.getDashboardData()
      console.log('Dashboard data retrieved successfully:')
      console.log('- Keys:', Object.keys(data))
      console.log('- Today data keys:', data.today ? Object.keys(data.today) : 'undefined')
      console.log('- Today totalTime:', data.today?.totalTime)
      console.log('- Data structure valid:', !!(data.today && data.thisWeek && data.insights))
      return data
    } catch (error) {
      console.error('Failed to get dashboard data:', error)
      throw error
    }
  })

  // Activity log data
  ipcMain.handle('activity:get-activities', async (_, filters?: any) => {
    try {
      return await databaseManager.getActivities(filters)
    } catch (error) {
      console.error('Failed to get activities:', error)
      throw error
    }
  })

  // Export data
  ipcMain.handle('data:export', async (_event, _format: 'json' | 'csv') => {
    // TODO: Implement data export functionality
    return { success: false, error: 'Export not implemented yet' }
  })

  // Productivity Insights
  ipcMain.handle('insights:get-productivity', async (_, limit?: number) => {
    try {
      return await databaseManager.getProductivityInsights(limit || 10)
    } catch (error) {
      console.error('Failed to get productivity insights:', error)
      throw error
    }
  })

  ipcMain.handle('insights:get-all', async (_, category?: string, limit?: number) => {
    try {
      return await databaseManager.getInsights(category, limit || 20)
    } catch (error) {
      console.error('Failed to get insights:', error)
      throw error
    }
  })

  ipcMain.handle('insights:generate', async (_, timeRange: { start: number, end: number }) => {
    try {
      // return await activityTracker.getProductivityInsights(timeRange)
      console.log('Insights generation temporarily disabled for timeRange:', timeRange)
      return { insights: [], summary: 'Insights generation temporarily disabled' }
    } catch (error) {
      console.error('Failed to generate insights:', error)
      throw error
    }
  })

  // Settings
  ipcMain.handle('app:get-data-path', () => {
    return app.getPath('userData')
  })

  // Shell operations
  ipcMain.handle('shell:open-path', async (_, path: string) => {
    try {
      await shell.openPath(path)
      return { success: true }
    } catch (error) {
      console.error('Failed to open path:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // App Categories Management
  ipcMain.handle('app-categories:get-all', async () => {
    try {
      return await databaseManager.getAppCategories()
    } catch (error) {
      console.error('Failed to get app categories:', error)
      throw error
    }
  })

  ipcMain.handle('app-categories:save', async (_, category) => {
    try {
      return await databaseManager.saveAppCategory(category)
    } catch (error) {
      console.error('Failed to save app category:', error)
      throw error
    }
  })

  ipcMain.handle('app-categories:delete', async (_, appName: string) => {
    try {
      return await databaseManager.deleteAppCategory(appName)
    } catch (error) {
      console.error('Failed to delete app category:', error)
      throw error
    }
  })

  ipcMain.handle('app-categories:get-suggestions', async () => {
      try {
        const uncategorizedApps = await appCategorizer.getUncategorizedApps()
        return await appCategorizer.getSuggestions(uncategorizedApps)
      } catch (error) {
        console.error('Failed to get categorization suggestions:', error)
        throw error
      }
    })

  ipcMain.handle('app-categories:apply-suggestions', async (_, suggestions) => {
      try {
        for (const suggestion of suggestions) {
          await databaseManager.saveAppCategory({
            appName: suggestion.appName,
            category: suggestion.suggestedCategory,
            productivityRating: suggestion.suggestedProductivityRating,
            isUserDefined: false,
            isManual: false,
            createdAt: Date.now(),
            updatedAt: Date.now()
          })
        }
        return { success: true }
      } catch (error) {
        console.error('Failed to apply categorization suggestions:', error)
        throw error
      }
    })

  // Distraction Management
  ipcMain.handle('distraction:get-settings', async () => {
      try {
        return distractionDetector.getSettings()
      } catch (error) {
        console.error('Failed to get distraction settings:', error)
        throw error
      }
    })

    ipcMain.handle('distraction:save-settings', async (_, settings) => {
      try {
        await distractionDetector.updateSettings(settings)
        return { success: true }
      } catch (error) {
        console.error('Failed to save distraction settings:', error)
        throw error
      }
    })

    ipcMain.handle('distraction:get-events', async (_, filters) => {
      try {
        return await distractionDetector.getDistractionEvents(filters)
      } catch (error) {
        console.error('Failed to get distraction events:', error)
        throw error
      }
    })

  // Focus Session Management
  ipcMain.handle('focus-session:start', async (_, sessionConfig) => {
      try {
        return await focusManager.startFocusSession(sessionConfig)
      } catch (error) {
        console.error('Failed to start focus session:', error)
        throw error
      }
    })

    ipcMain.handle('focus-session:stop', async () => {
      try {
        return await focusManager.stopFocusSession()
      } catch (error) {
        console.error('Failed to stop focus session:', error)
        throw error
      }
    })

    ipcMain.handle('focus-session:get-current', async () => {
      try {
        return focusManager.getCurrentSession()
      } catch (error) {
        console.error('Failed to get current focus session:', error)
        throw error
      }
    })

    ipcMain.handle('focus-session:get-history', async (_, filters) => {
      try {
        return await focusManager.getSessionHistory(filters?.limit || 20)
      } catch (error) {
        console.error('Failed to get focus session history:', error)
        throw error
      }
    })

    ipcMain.handle('focus-session:get-analytics', async () => {
      try {
        return await focusManager.getSessionAnalytics()
      } catch (error) {
        console.error('Failed to get focus session analytics:', error)
        throw error
      }
    })

    ipcMain.handle('focus-session:get-settings', async () => {
      try {
        return focusManager.getConfig()
      } catch (error) {
        console.error('Failed to get focus session settings:', error)
        throw error
      }
    })

    ipcMain.handle('focus-session:save-settings', async (_, settings) => {
      try {
        await focusManager.updateConfig(settings)
        return { success: true }
      } catch (error) {
        console.error('Failed to save focus session settings:', error)
        throw error
      }
    })

    ipcMain.handle('focus-session:pause', async () => {
      try {
        await focusManager.pauseFocusSession()
        return { success: true }
      } catch (error) {
        console.error('Failed to pause focus session:', error)
        throw error
      }
    })

    ipcMain.handle('focus-session:resume', async () => {
      try {
        await focusManager.resumeFocusSession()
        return { success: true }
      } catch (error) {
        console.error('Failed to resume focus session:', error)
        throw error
      }
    })

    ipcMain.handle('focus-session:record-interruption', async (_, interruption) => {
      try {
        return await focusManager.recordInterruption(interruption)
      } catch (error) {
        console.error('Failed to record interruption:', error)
        throw error
      }
    })

    // Database API handlers
    ipcMain.handle('database:save-user-preference', async (_, key: string, value: any, type?: string) => {
      try {
        await databaseManager.saveUserPreference(key, value, type as 'string' | 'number' | 'boolean' | 'json')
        return { success: true }
      } catch (error) {
        console.error('Failed to save user preference:', error)
        throw error
      }
    })

    ipcMain.handle('database:get-user-preference', async (_, key: string) => {
      try {
        return await databaseManager.getUserPreference(key)
      } catch (error) {
        console.error('Failed to get user preference:', error)
        throw error
      }
    })

    ipcMain.handle('database:get-all-user-preferences', async (_event) => {
      try {
        return await databaseManager.getAllUserPreferences()
      } catch (error) {
        console.error('Failed to get all user preferences:', error)
        throw error
      }
    })

    ipcMain.handle('database:save-privacy-settings', async (_, settings) => {
      try {
        await databaseManager.savePrivacySettings(settings)
        return { success: true }
      } catch (error) {
        console.error('Failed to save privacy settings:', error)
        throw error
      }
    })

    ipcMain.handle('database:get-privacy-settings', async (_event) => {
      try {
        return await databaseManager.getPrivacySettings()
      } catch (error) {
        console.error('Failed to get privacy settings:', error)
        throw error
      }
    })

    ipcMain.handle('database:save-distraction-settings', async (_, settings) => {
      try {
        await databaseManager.saveDistractionSettings(settings)
        return { success: true }
      } catch (error) {
        console.error('Failed to save distraction settings:', error)
        throw error
      }
    })

    ipcMain.handle('database:get-distraction-settings', async (_event) => {
      try {
        return await databaseManager.getDistractionSettings()
      } catch (error) {
        console.error('Failed to get distraction settings:', error)
        throw error
      }
    })

    // File system operations
    ipcMain.handle('file:select-backup-location', async () => {
      try {
        const result = await dialog.showOpenDialog(mainWindow!, {
          properties: ['openDirectory'],
          title: 'Select Backup Location'
        })
        return result.canceled ? null : result.filePaths[0]
      } catch (error) {
        console.error('Failed to select backup location:', error)
        throw error
      }
    })

    ipcMain.handle('file:perform-backup', async (_, backupPath: string) => {
      try {
        const fs = require('fs').promises
        const path = require('path')
        const dbPath = databaseManager.getDatabasePath()
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const backupFileName = `activity-tracker-backup-${timestamp}.db`
        const backupFilePath = path.join(backupPath, backupFileName)
        
        await fs.copyFile(dbPath, backupFilePath)
        return { success: true, backupPath: backupFilePath }
      } catch (error) {
        console.error('Failed to perform backup:', error)
        throw error
      }
    })

    ipcMain.handle('file:cleanup-old-data', async (_, retentionDays: number) => {
      try {
        await databaseManager.cleanupOldData(retentionDays)
        return { success: true }
      } catch (error) {
        console.error('Failed to cleanup old data:', error)
        throw error
      }
    })

    // Notification testing
    ipcMain.handle('notification:test', async (_, message: string) => {
      try {
        if (Notification.isSupported()) {
          new Notification({
            title: 'Activity Tracker',
            body: message || 'This is a test notification'
          }).show()
        }
        return { success: true }
      } catch (error) {
        console.error('Failed to show test notification:', error)
        throw error
      }
    })

    // Goal tracking handlers
    ipcMain.handle('goals:get-all', async () => {
      try {
        return await databaseManager.getAllGoals()
      } catch (error) {
        console.error('Failed to get goals:', error)
        throw error
      }
    })

    ipcMain.handle('goals:save', async (_, goal) => {
      try {
        await databaseManager.saveGoal(goal)
        return { success: true }
      } catch (error) {
        console.error('Failed to save goal:', error)
        throw error
      }
    })

    ipcMain.handle('goals:delete', async (_, goalId: string) => {
      try {
        await databaseManager.deleteGoal(goalId)
        return { success: true }
      } catch (error) {
        console.error('Failed to delete goal:', error)
        throw error
      }
    })

    ipcMain.handle('goals:get-progress', async (_, goalId: string) => {
      try {
        return await databaseManager.getGoalProgress(goalId)
      } catch (error) {
        console.error('Failed to get goal progress:', error)
        throw error
      }
    })

    // Webhook handlers
    ipcMain.handle('webhook:list', async () => {
      try {
        return integrationManager.getConfig().api.webhooks.endpoints
      } catch (error) {
        console.error('Failed to get webhooks:', error)
        throw error
      }
    })

    // Integration config handlers
    ipcMain.handle('integration:config:get', async () => {
      try {
        return integrationManager.getConfig()
      } catch (error) {
        console.error('Failed to get integration config:', error)
        throw error
      }
    })

    // Platform-specific handlers
    ipcMain.handle('platform:get-info', async () => {
      try {
        return await platformAdapter.getSystemInfo()
      } catch (error) {
        console.error('Failed to get platform info:', error)
        throw error
      }
    })

    ipcMain.handle('platform:get-capabilities', async () => {
      try {
        return await platformAdapter.getCapabilities()
      } catch (error) {
        console.error('Failed to get platform capabilities:', error)
        throw error
      }
    })

    ipcMain.handle('platform:get-theme', async () => {
      try {
        return await platformAdapter.getSystemTheme()
      } catch (error) {
        console.error('Failed to get system theme:', error)
        throw error
      }
    })

    ipcMain.handle('platform:show-notification', async (_, title: string, body: string, options?: any) => {
      try {
        await platformAdapter.showNotification({ title, body, ...options })
        return { success: true }
      } catch (error) {
        console.error('Failed to show platform notification:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    })

    ipcMain.handle('platform:open-file-manager', async (_, path?: string) => {
      try {
        await platformAdapter.openFileManager(path || '')
        return { success: true }
      } catch (error) {
        console.error('Failed to open file manager:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    })

    ipcMain.handle('platform:show-item-in-folder', async (_, filePath: string) => {
      try {
        await platformAdapter.showItemInFolder(filePath)
        return { success: true }
      } catch (error) {
        console.error('Failed to show item in folder:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    })

    // Auto-updater handlers
    ipcMain.handle('updater:check-for-updates', async () => {
      try {
        // return await autoUpdaterManager.checkForUpdates()
    throw new Error('Auto-updater temporarily disabled')
      } catch (error) {
        console.error('Failed to check for updates:', error)
        throw error
      }
    })

    ipcMain.handle('updater:download-update', async () => {
      try {
        // return await autoUpdaterManager.downloadUpdate()
    throw new Error('Auto-updater temporarily disabled')
      } catch (error) {
        console.error('Failed to download update:', error)
        throw error
      }
    })

    ipcMain.handle('updater:quit-and-install', async () => {
      try {
        // return await autoUpdaterManager.quitAndInstall()
    throw new Error('Auto-updater temporarily disabled')
      } catch (error) {
        console.error('Failed to quit and install:', error)
        throw error
      }
    })

    ipcMain.handle('updater:get-status', async () => {
      try {
        // return autoUpdaterManager.getStatus()
    throw new Error('Auto-updater temporarily disabled')
      } catch (error) {
        console.error('Failed to get updater status:', error)
        throw error
      }
    })

    // Tray-specific handlers
    ipcMain.handle('tray:show-notification', async (_, title: string, body: string, options?: any) => {
      try {
        await trayManager.showCustomNotification(title, body, options)
        return { success: true }
      } catch (error) {
        console.error('Failed to show tray notification:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    })

    ipcMain.handle('tray:get-capabilities', async () => {
      try {
        return trayManager.getPlatformCapabilities()
      } catch (error) {
        console.error('Failed to get tray capabilities:', error)
        throw error
      }
    })

    ipcMain.handle('tray:enable-menubar-mode', async () => {
      try {
        await trayManager.enableMenuBarMode()
        return { success: true }
      } catch (error) {
        console.error('Failed to enable menu bar mode:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    })

    ipcMain.handle('tray:disable-menubar-mode', async () => {
      try {
        await trayManager.disableMenuBarMode()
        return { success: true }
      } catch (error) {
        console.error('Failed to disable menu bar mode:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    })
}

// Initialize the application
async function initializeApp(): Promise<void> {
  try {
    // Initialize platform adapter first
    platformAdapter = getPlatformAdapter()
    await platformAdapter.optimizeForPlatform()
    console.log('Platform adapter initialized')

    // Initialize auto-updater
    autoUpdaterManager = getAutoUpdaterManager({
      checkForUpdatesOnStart: true,
      autoDownload: true,
      autoInstallOnAppQuit: false, // Let user decide
      checkInterval: 4 * 60 * 60 * 1000, // 4 hours
      allowPrerelease: false
    })
    await autoUpdaterManager.initialize()
    console.log('Auto-updater initialized')

    // Initialize database
    databaseManager = new DatabaseManager()
    await databaseManager.initialize()
    console.log('Database initialized successfully')

    // Note: UnifiedTrayManager removed to avoid duplicate tray icons
    // Using TrayManager instead which is more integrated with ActivityTracker

    // Initialize activity tracker
    activityTracker = new ActivityTracker(databaseManager)
    console.log('Activity tracker initialized')

    // Initialize focus manager
    focusManager = new FocusManager(databaseManager)
    
    // Initialize distraction detector
    distractionDetector = new DistractionDetector(databaseManager)
    await distractionDetector.initialize()
    
    // Initialize app categorizer
    appCategorizer = new AppCategorizer(databaseManager)
    
    // Initialize integration manager
    integrationManager = new IntegrationManager(databaseManager)
    await integrationManager.start()
    
    // Initialize tray manager with platform-specific features
    trayManager = new TrayManager(activityTracker)
    await trayManager.initialize()
    
    // Connect distraction detector to activity tracker
    // activityTracker.on('activity-recorded', (activity) => {
    //   distractionDetector.onActivityChange(activity)
    //   // Notify integration manager for webhooks
    //   integrationManager.notifyActivityCreated(activity)
    // })

    // Connect focus manager events
    // focusManager.on('session-started', (session) => {
    //   integrationManager.notifySessionStarted(session)
    // })
    
    // focusManager.on('session-ended', (session) => {
    //   integrationManager.notifySessionEnded(session)
    // })
    
    // Connect auto-updater events
    // autoUpdaterManager.on('update-available', async (updateInfo) => {
    //   console.log('Update available:', updateInfo)
    //   if (trayManager) {
    //     await trayManager.showCustomNotification(
    //       'Update Available',
    //       `Version ${updateInfo.version} is available for download`,
    //       false
    //     )
    //   }
    // })

    // autoUpdaterManager.on('update-downloaded', async (updateInfo) => {
    //   console.log('Update downloaded:', updateInfo)
    //   if (trayManager) {
    //     await trayManager.showCustomNotification(
    //       'Update Ready',
    //       `Version ${updateInfo.version} is ready to install`,
    //       true
    //     )
    //   }
    //   // Show install dialog
    //   await autoUpdaterManager.showInstallDialog(updateInfo)
    // })
    
    // Update tray status periodically
    // setInterval(() => {
    //   if (trayManager) {
    //     trayManager.updateStatus()
    //   }
    // }, 5000) // Update every 5 seconds

    // Setup IPC communication
    setupIPC()
    
    console.log('Application initialized successfully')
  } catch (error) {
    console.error('Failed to initialize app:', error)
    app.quit()
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app name and user model id for proper taskbar recognition
  app.setName('Activity Tracking')
  electronApp.setAppUserModelId('com.keleshteri.activity-tracker')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize our app components
  await initializeApp()

  // Create the main window
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  // Stop tracking when app is closing
  // if (activityTracker) {
  //   activityTracker.stop()
  // }

  // Stop integration manager
  // if (integrationManager) {
  //   integrationManager.stop()
  // }

  // Cleanup tray
  if (trayManager) {
    trayManager.cleanup()
  }

  // Cleanup auto-updater
  // cleanupAutoUpdater()

  // Cleanup platform adapter
  // if (platformAdapter) {
  //   platformAdapter.cleanup()
  // }

  // Close database connection
  if (databaseManager) {
    databaseManager.close()
  }

  // if (!platformUtils.isMacOS()) {
    app.quit()
  // }
})

// Handle app termination gracefully
app.on('before-quit', async () => {
  console.log('Application is quitting, cleaning up...')
  
  // if (activityTracker) {
  //   activityTracker.stop()
  // }
  // if (integrationManager) {
  //   integrationManager.stop()
  // }
  if (trayManager) {
    trayManager.cleanup()
  }
  
  // Cleanup auto-updater
  // cleanupAutoUpdater()
  
  // Cleanup platform adapter
  // if (platformAdapter) {
  //   await platformAdapter.cleanup()
  // }
  
  if (databaseManager) {
    databaseManager.close()
  }
  
  console.log('Application cleanup completed')
})
