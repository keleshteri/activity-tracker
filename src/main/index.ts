import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// Import our activity tracker components
import { DatabaseManager } from './database'
import { ActivityTracker } from './tracker'
import { TrackerConfig, DashboardData } from './types'

// Set app name early for proper recognition
app.setName('Activity Tracking')

// Global instances
let mainWindow: BrowserWindow | null = null
let database: DatabaseManager
let tracker: ActivityTracker

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    title: 'Activity Tracking',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    // Ensure the title is set correctly
    mainWindow?.setTitle('Activity Tracking')
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
      await tracker.start()
      return { success: true }
    } catch (error) {
      console.error('Failed to start tracker:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('tracker:stop', () => {
    try {
      tracker.stop()
      return { success: true }
    } catch (error) {
      console.error('Failed to stop tracker:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('tracker:status', () => {
    const status = tracker.getStatus()
    console.log('IPC tracker:status called, returning:', status)
    return status
  })

  ipcMain.handle('tracker:config:get', () => {
    return tracker.getConfig()
  })

  ipcMain.handle('tracker:config:update', async (_, config: Partial<TrackerConfig>) => {
    try {
      await tracker.updateConfig(config)
      return { success: true }
    } catch (error) {
      console.error('Failed to update config:', error)
      return { success: false, error: error.message }
    }
  })

  // Dashboard data
  ipcMain.handle('dashboard:get-data', async (): Promise<DashboardData> => {
    try {
      return await database.getDashboardData()
    } catch (error) {
      console.error('Failed to get dashboard data:', error)
      throw error
    }
  })

  // Activity log data
  ipcMain.handle('activity:get-activities', async (_, filters?: any) => {
    try {
      return await database.getActivities(filters)
    } catch (error) {
      console.error('Failed to get activities:', error)
      throw error
    }
  })

  // Export data
  ipcMain.handle('data:export', async (_, format: 'json' | 'csv') => {
    // TODO: Implement data export functionality
    return { success: false, error: 'Export not implemented yet' }
  })

  // Settings
  ipcMain.handle('app:get-data-path', () => {
    return app.getPath('userData')
  })
}

// Initialize the application
async function initializeApp(): Promise<void> {
  try {
    // Initialize database
    database = new DatabaseManager()
    await database.initialize()
    console.log('Database initialized successfully')

    // Initialize activity tracker
    tracker = new ActivityTracker(database)
    console.log('Activity tracker initialized successfully')

    // Setup IPC communication
    setupIPC()
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
  if (tracker) {
    tracker.stop()
  }

  // Close database connection
  if (database) {
    database.close()
  }

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Handle app termination gracefully
app.on('before-quit', () => {
  if (tracker) {
    tracker.stop()
  }
  if (database) {
    database.close()
  }
})
