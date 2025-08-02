import sqlite3 from 'sqlite3'
import { join } from 'path'
import { app } from 'electron'
import {
  ActivityRecord,
  ScreenshotRecord,
  DashboardData,
  WorkSession,
  AppCategory,
  ProductivityMetrics,
  BreakPattern,
  FocusSession,
  PrivacySettings,
  SystemMetrics,
  ProductivityInsight
} from './types'

export class DatabaseManager {
  private db: sqlite3.Database | null = null
  private dbPath: string

  constructor() {
    const userDataPath = app.getPath('userData')
    this.dbPath = join(userDataPath, 'activity-tracker.db')
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err)
          return
        }

        this.createTables().then(resolve).catch(reject)
      })
    })
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    const createActivitiesTable = `
      CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        app_name TEXT NOT NULL,
        window_title TEXT,
        duration INTEGER DEFAULT 1,
        category TEXT,
        is_idle BOOLEAN DEFAULT 0,
        url TEXT,
        cpu_usage REAL,
        memory_usage REAL,
        focus_score REAL,
        productivity_rating TEXT CHECK(productivity_rating IN ('productive', 'neutral', 'distracting')),
        context_switches INTEGER DEFAULT 0,
        keystrokes INTEGER DEFAULT 0,
        mouse_clicks INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `

    // Migration queries to add new columns to existing activities table
    const migrationQueries = [
      'ALTER TABLE activities ADD COLUMN memory_usage REAL',
      'ALTER TABLE activities ADD COLUMN focus_score REAL',
      "ALTER TABLE activities ADD COLUMN productivity_rating TEXT CHECK(productivity_rating IN ('productive', 'neutral', 'distracting'))",
      'ALTER TABLE activities ADD COLUMN context_switches INTEGER DEFAULT 0',
      'ALTER TABLE activities ADD COLUMN keystrokes INTEGER DEFAULT 0',
      'ALTER TABLE activities ADD COLUMN mouse_clicks INTEGER DEFAULT 0'
    ]

    const createScreenshotsTable = `
      CREATE TABLE IF NOT EXISTS screenshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        activity_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (activity_id) REFERENCES activities (id)
      )
    `

    const createWorkSessionsTable = `
      CREATE TABLE IF NOT EXISTS work_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        duration INTEGER NOT NULL,
        focus_score REAL NOT NULL,
        productivity_rating TEXT CHECK(productivity_rating IN ('productive', 'neutral', 'distracting')),
        context_switches INTEGER DEFAULT 0,
        break_duration INTEGER DEFAULT 0,
        dominant_app TEXT,
        dominant_category TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `

    const createAppCategoriesTable = `
      CREATE TABLE IF NOT EXISTS app_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_name TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        productivity_rating TEXT CHECK(productivity_rating IN ('productive', 'neutral', 'distracting')),
        is_user_defined BOOLEAN DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `

    const createProductivityMetricsTable = `
      CREATE TABLE IF NOT EXISTS productivity_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        total_active_time INTEGER NOT NULL,
        productive_time INTEGER DEFAULT 0,
        neutral_time INTEGER DEFAULT 0,
        distracting_time INTEGER DEFAULT 0,
        focus_score REAL DEFAULT 0,
        context_switches INTEGER DEFAULT 0,
        peak_productivity_hour INTEGER,
        break_frequency INTEGER DEFAULT 0,
        average_session_duration INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `

    const createBreakPatternsTable = `
      CREATE TABLE IF NOT EXISTS break_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        duration INTEGER NOT NULL,
        type TEXT CHECK(type IN ('micro', 'short', 'long')),
        before_activity TEXT,
        after_activity TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `

    const createFocusSessionsTable = `
      CREATE TABLE IF NOT EXISTS focus_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        duration INTEGER NOT NULL,
        app_name TEXT NOT NULL,
        category TEXT,
        interruptions INTEGER DEFAULT 0,
        focus_score REAL NOT NULL,
        keystrokes INTEGER DEFAULT 0,
        mouse_clicks INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `

    const createPrivacySettingsTable = `
      CREATE TABLE IF NOT EXISTS privacy_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        anonymize_window_titles BOOLEAN DEFAULT 0,
        anonymize_urls BOOLEAN DEFAULT 0,
        excluded_apps TEXT, -- JSON array
        excluded_domains TEXT, -- JSON array
        enable_screenshots BOOLEAN DEFAULT 0,
        screenshot_blur_level INTEGER DEFAULT 0,
        data_retention_days INTEGER DEFAULT 90,
        export_data_on_delete BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `

    const createSystemMetricsTable = `
      CREATE TABLE IF NOT EXISTS system_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        cpu_usage REAL NOT NULL,
        memory_usage REAL NOT NULL,
        disk_usage REAL,
        network_activity REAL,
        battery_level REAL,
        is_charging BOOLEAN,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `

    const createProductivityInsightsTable = `
      CREATE TABLE IF NOT EXISTS productivity_insights (
        id TEXT PRIMARY KEY,
        type TEXT CHECK(type IN ('peak_hours', 'distraction_pattern', 'focus_improvement', 'break_suggestion', 'app_recommendation')),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        actionable BOOLEAN DEFAULT 1,
        priority TEXT CHECK(priority IN ('low', 'medium', 'high')),
        timestamp INTEGER NOT NULL,
        is_dismissed BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp);
      CREATE INDEX IF NOT EXISTS idx_activities_app_name ON activities(app_name);
      CREATE INDEX IF NOT EXISTS idx_activities_productivity ON activities(productivity_rating);
      CREATE INDEX IF NOT EXISTS idx_screenshots_timestamp ON screenshots(timestamp);
      CREATE INDEX IF NOT EXISTS idx_work_sessions_start_time ON work_sessions(start_time);
      CREATE INDEX IF NOT EXISTS idx_productivity_metrics_date ON productivity_metrics(date);
      CREATE INDEX IF NOT EXISTS idx_break_patterns_timestamp ON break_patterns(timestamp);
      CREATE INDEX IF NOT EXISTS idx_focus_sessions_start_time ON focus_sessions(start_time);
      CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp);
      CREATE INDEX IF NOT EXISTS idx_insights_type ON productivity_insights(type);
      CREATE INDEX IF NOT EXISTS idx_insights_priority ON productivity_insights(priority);
    `

    return new Promise((resolve, reject) => {
      this.db!.serialize(() => {
        this.db!.run(createActivitiesTable)

        // Run migration queries to add new columns (ignore errors if columns already exist)
        migrationQueries.forEach((query) => {
          this.db!.run(query, (err) => {
            // Ignore "duplicate column name" errors as they indicate the column already exists
            if (err && !err.message.includes('duplicate column name')) {
              console.warn('Migration warning:', err.message)
            }
          })
        })

        this.db!.run(createScreenshotsTable)
        this.db!.run(createWorkSessionsTable)
        this.db!.run(createAppCategoriesTable)
        this.db!.run(createProductivityMetricsTable)
        this.db!.run(createBreakPatternsTable)
        this.db!.run(createFocusSessionsTable)
        this.db!.run(createPrivacySettingsTable)
        this.db!.run(createSystemMetricsTable)
        this.db!.run(createProductivityInsightsTable)
        this.db!.run(createIndexes, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    })
  }

  async saveActivity(activity: ActivityRecord): Promise<number> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const stmt = this.db!.prepare(`
        INSERT INTO activities 
        (timestamp, app_name, window_title, duration, category, is_idle, url, cpu_usage, 
         memory_usage, focus_score, productivity_rating, context_switches, keystrokes, mouse_clicks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run(
        [
          activity.timestamp,
          activity.appName,
          activity.windowTitle,
          activity.duration,
          activity.category || null,
          activity.isIdle ? 1 : 0,
          activity.url || null,
          activity.cpuUsage || null,
          activity.memoryUsage || null,
          activity.focusScore || null,
          activity.productivityRating || null,
          activity.contextSwitches || 0,
          activity.keystrokes || 0,
          activity.mouseClicks || 0
        ],
        function (err) {
          if (err) reject(err)
          else resolve(this.lastID)
        }
      )

      stmt.finalize()
    })
  }

  async saveScreenshot(screenshot: ScreenshotRecord): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const stmt = this.db!.prepare(`
        INSERT INTO screenshots (timestamp, file_path, activity_id)
        VALUES (?, ?, ?)
      `)

      stmt.run(
        [screenshot.timestamp, screenshot.filePath, screenshot.activityId || null],
        (err) => {
          if (err) reject(err)
          else resolve()
        }
      )

      stmt.finalize()
    })
  }

  async getDashboardData(): Promise<DashboardData> {
    if (!this.db) throw new Error('Database not initialized')

    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    const startOfWeek = new Date(today.getTime() - today.getDay() * 24 * 60 * 60 * 1000).getTime()

    // Get today's enhanced data
    const todayStats = await this.getEnhancedTodayStats(startOfDay)
    const topApps = await this.getEnhancedTopApps(startOfDay)
    const categories = await this.getCategoryStats(startOfDay)
    const peakHours = await this.getPeakProductivityHours(startOfDay)

    // Get week's enhanced data
    const weekStats = await this.getEnhancedWeekStats(startOfWeek)

    // Get productivity insights
    const insights = await this.getProductivityInsights(5)

    return {
      today: {
        totalTime: todayStats.totalTime,
        activeTime: todayStats.activeTime,
        idleTime: todayStats.idleTime,
        productiveTime: todayStats.productiveTime,
        distractingTime: todayStats.distractingTime,
        focusScore: todayStats.focusScore,
        contextSwitches: todayStats.contextSwitches,
        topApps,
        categories,
        peakHours
      },
      thisWeek: {
        totalTime: weekStats.totalTime,
        productiveTime: weekStats.productiveTime,
        dailyBreakdown: weekStats.dailyBreakdown,
        weeklyTrend: weekStats.weeklyTrend
      },
      insights
    }
  }

  private async getEnhancedTodayStats(startOfDay: number): Promise<{
    totalTime: number
    activeTime: number
    idleTime: number
    productiveTime: number
    distractingTime: number
    focusScore: number
    contextSwitches: number
  }> {
    return new Promise((resolve, reject) => {
      this.db!.all(
        `
        SELECT 
          SUM(duration) as total_time,
          SUM(CASE WHEN is_idle = 0 THEN duration ELSE 0 END) as active_time,
          SUM(CASE WHEN is_idle = 1 THEN duration ELSE 0 END) as idle_time,
          SUM(CASE WHEN productivity_rating = 'productive' THEN duration ELSE 0 END) as productive_time,
          SUM(CASE WHEN productivity_rating = 'distracting' THEN duration ELSE 0 END) as distracting_time,
          AVG(CASE WHEN focus_score IS NOT NULL THEN focus_score ELSE 0 END) as avg_focus_score,
          SUM(CASE WHEN context_switches IS NOT NULL THEN context_switches ELSE 0 END) as total_context_switches
        FROM activities 
        WHERE timestamp >= ?
      `,
        [startOfDay],
        (err, rows: any[]) => {
          if (err) reject(err)
          else {
            const row = rows[0] || {}
            resolve({
              totalTime: row.total_time || 0,
              activeTime: row.active_time || 0,
              idleTime: row.idle_time || 0,
              productiveTime: row.productive_time || 0,
              distractingTime: row.distracting_time || 0,
              focusScore: row.avg_focus_score || 0,
              contextSwitches: row.total_context_switches || 0
            })
          }
        }
      )
    })
  }

  private async getEnhancedTopApps(startOfDay: number): Promise<
    Array<{
      name: string
      time: number
      percentage: number
      productivity: 'productive' | 'neutral' | 'distracting'
    }>
  > {
    return new Promise((resolve, reject) => {
      this.db!.all(
        `
        SELECT 
          a.app_name as name,
          SUM(a.duration) as time,
          COALESCE(ac.productivity_rating, 'neutral') as productivity
        FROM activities a
        LEFT JOIN app_categories ac ON a.app_name = ac.app_name
        WHERE a.timestamp >= ? AND a.is_idle = 0
        GROUP BY a.app_name, ac.productivity_rating
        ORDER BY time DESC
        LIMIT 10
      `,
        [startOfDay],
        (err, rows: any[]) => {
          if (err) reject(err)
          else {
            const total = rows.reduce((sum, row) => sum + row.time, 0)
            const apps = rows.map((row) => ({
              name: row.name,
              time: row.time,
              percentage: total > 0 ? (row.time / total) * 100 : 0,
              productivity: row.productivity as 'productive' | 'neutral' | 'distracting'
            }))
            resolve(apps)
          }
        }
      )
    })
  }

  private async getCategoryStats(startOfDay: number): Promise<
    Array<{
      name: string
      time: number
      productivity: 'productive' | 'neutral' | 'distracting'
    }>
  > {
    return new Promise((resolve, reject) => {
      this.db!.all(
        `
        SELECT 
          COALESCE(ac.category, 'Uncategorized') as name,
          SUM(a.duration) as time,
          COALESCE(ac.productivity_rating, 'neutral') as productivity
        FROM activities a
        LEFT JOIN app_categories ac ON a.app_name = ac.app_name
        WHERE a.timestamp >= ? AND a.is_idle = 0
        GROUP BY ac.category, ac.productivity_rating
        ORDER BY time DESC
      `,
        [startOfDay],
        (err, rows: any[]) => {
          if (err) reject(err)
          else {
            const categories = rows.map((row) => ({
              name: row.name,
              time: row.time,
              productivity: row.productivity as 'productive' | 'neutral' | 'distracting'
            }))
            resolve(categories)
          }
        }
      )
    })
  }

  private async getPeakProductivityHours(startOfDay: number): Promise<
    Array<{
      hour: number
      productivity: number
    }>
  > {
    return new Promise((resolve, reject) => {
      this.db!.all(
        `
        SELECT 
          CAST(strftime('%H', datetime(timestamp/1000, 'unixepoch', 'localtime')) AS INTEGER) as hour,
          AVG(CASE 
            WHEN productivity_rating = 'productive' THEN 1.0
            WHEN productivity_rating = 'neutral' THEN 0.5
            WHEN productivity_rating = 'distracting' THEN 0.0
            ELSE 0.5
          END) as productivity
        FROM activities 
        WHERE timestamp >= ? AND is_idle = 0
        GROUP BY hour
        ORDER BY hour
      `,
        [startOfDay],
        (err, rows: any[]) => {
          if (err) reject(err)
          else {
            const peakHours = rows.map((row) => ({
              hour: row.hour,
              productivity: row.productivity
            }))
            resolve(peakHours)
          }
        }
      )
    })
  }

  private async getEnhancedWeekStats(startOfWeek: number): Promise<{
    totalTime: number
    productiveTime: number
    dailyBreakdown: Array<{ day: string; time: number; productivity: number }>
    weeklyTrend: 'improving' | 'declining' | 'stable'
  }> {
    return new Promise((resolve, reject) => {
      this.db!.all(
        `
        SELECT 
          date(timestamp/1000, 'unixepoch', 'localtime') as day,
          SUM(duration) as time,
          SUM(CASE WHEN productivity_rating = 'productive' THEN duration ELSE 0 END) as productive_time,
          AVG(CASE 
            WHEN productivity_rating = 'productive' THEN 1.0
            WHEN productivity_rating = 'neutral' THEN 0.5
            WHEN productivity_rating = 'distracting' THEN 0.0
            ELSE 0.5
          END) as productivity
        FROM activities 
        WHERE timestamp >= ?
        GROUP BY date(timestamp/1000, 'unixepoch', 'localtime')
        ORDER BY day
      `,
        [startOfWeek],
        (err, rows: any[]) => {
          if (err) reject(err)
          else {
            const totalTime = rows.reduce((sum, row) => sum + row.time, 0)
            const totalProductiveTime = rows.reduce(
              (sum, row) => sum + (row.productive_time || 0),
              0
            )

            // Calculate weekly trend
            let weeklyTrend: 'improving' | 'declining' | 'stable' = 'stable'
            if (rows.length >= 2) {
              const firstHalf = rows.slice(0, Math.ceil(rows.length / 2))
              const secondHalf = rows.slice(Math.ceil(rows.length / 2))
              const firstHalfAvg =
                firstHalf.reduce((sum, row) => sum + (row.productivity || 0), 0) / firstHalf.length
              const secondHalfAvg =
                secondHalf.reduce((sum, row) => sum + (row.productivity || 0), 0) /
                secondHalf.length

              if (secondHalfAvg > firstHalfAvg + 0.1) {
                weeklyTrend = 'improving'
              } else if (secondHalfAvg < firstHalfAvg - 0.1) {
                weeklyTrend = 'declining'
              }
            }

            resolve({
              totalTime,
              productiveTime: totalProductiveTime,
              dailyBreakdown: rows.map((row) => ({
                day: row.day,
                time: row.time,
                productivity: row.productivity || 0
              })),
              weeklyTrend
            })
          }
        }
      )
    })
  }

  async getActivities(filters?: any): Promise<ActivityRecord[]> {
    if (!this.db) throw new Error('Database not initialized')

    let query = `
      SELECT 
        id,
        timestamp,
        app_name as appName,
        window_title as windowTitle,
        duration,
        category,
        is_idle as isIdle,
        url,
        cpu_usage as cpuUsage,
        memory_usage as memoryUsage,
        focus_score as focusScore,
        productivity_rating as productivityRating,
        context_switches as contextSwitches,
        keystrokes,
        mouse_clicks as mouseClicks,
        created_at as createdAt
      FROM activities
    `

    const conditions: string[] = []
    const params: any[] = []

    if (filters) {
      if (filters.search) {
        conditions.push('(app_name LIKE ? OR window_title LIKE ?)')
        params.push(`%${filters.search}%`, `%${filters.search}%`)
      }

      if (filters.appName) {
        conditions.push('app_name = ?')
        params.push(filters.appName)
      }

      if (filters.hideIdle) {
        conditions.push('is_idle = 0')
      }

      if (filters.productivityRating) {
        conditions.push('productivity_rating = ?')
        params.push(filters.productivityRating)
      }

      if (filters.startDate) {
        conditions.push('timestamp >= ?')
        params.push(filters.startDate)
      }

      if (filters.endDate) {
        conditions.push('timestamp <= ?')
        params.push(filters.endDate)
      }
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }

    query += ' ORDER BY timestamp DESC'

    if (filters?.limit) {
      query += ' LIMIT ?'
      params.push(filters.limit)
    }

    return new Promise((resolve, reject) => {
      this.db!.all(query, params, (err, rows: any[]) => {
        if (err) reject(err)
        else {
          const activities = rows.map((row) => ({
            id: row.id,
            timestamp: row.timestamp,
            appName: row.appName,
            windowTitle: row.windowTitle,
            duration: row.duration,
            category: row.category,
            isIdle: Boolean(row.isIdle),
            url: row.url,
            cpuUsage: row.cpuUsage,
            memoryUsage: row.memoryUsage,
            focusScore: row.focusScore,
            productivityRating: row.productivityRating,
            contextSwitches: row.contextSwitches,
            keystrokes: row.keystrokes,
            mouseClicks: row.mouseClicks
          }))
          resolve(activities)
        }
      })
    })
  }

  // Work Sessions
  async saveWorkSession(session: WorkSession): Promise<number> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const stmt = this.db!.prepare(`
        INSERT INTO work_sessions 
        (start_time, end_time, duration, focus_score, productivity_rating, context_switches, 
         break_duration, dominant_app, dominant_category)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run(
        [
          session.startTime,
          session.endTime,
          session.duration,
          session.focusScore,
          session.productivityRating,
          session.contextSwitches,
          session.breakDuration,
          session.dominantApp,
          session.dominantCategory
        ],
        function (err) {
          if (err) reject(err)
          else resolve(this.lastID)
        }
      )

      stmt.finalize()
    })
  }

  // App Categories
  async saveAppCategory(category: AppCategory): Promise<number> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const stmt = this.db!.prepare(`
        INSERT OR REPLACE INTO app_categories 
        (app_name, category, productivity_rating, is_user_defined, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)

      const now = Date.now()
      stmt.run(
        [
          category.appName,
          category.category,
          category.productivityRating,
          category.isUserDefined ? 1 : 0,
          category.createdAt || now,
          now
        ],
        function (err) {
          if (err) reject(err)
          else resolve(this.lastID)
        }
      )

      stmt.finalize()
    })
  }

  async getAppCategories(): Promise<AppCategory[]> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      this.db!.all(
        `
        SELECT id, app_name, category, productivity_rating, is_user_defined, created_at, updated_at
        FROM app_categories
        ORDER BY app_name
      `,
        (err, rows: any[]) => {
          if (err) reject(err)
          else {
            const categories = rows.map((row) => ({
              id: row.id,
              appName: row.app_name,
              category: row.category,
              productivityRating: row.productivity_rating,
              isUserDefined: Boolean(row.is_user_defined),
              createdAt: row.created_at,
              updatedAt: row.updated_at
            }))
            resolve(categories)
          }
        }
      )
    })
  }

  // Productivity Metrics
  async saveProductivityMetrics(metrics: ProductivityMetrics): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const stmt = this.db!.prepare(`
        INSERT OR REPLACE INTO productivity_metrics 
        (date, total_active_time, productive_time, neutral_time, distracting_time, 
         focus_score, context_switches, peak_productivity_hour, break_frequency, average_session_duration)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run(
        [
          metrics.date,
          metrics.totalActiveTime,
          metrics.productiveTime,
          metrics.neutralTime,
          metrics.distractingTime,
          metrics.focusScore,
          metrics.contextSwitches,
          metrics.peakProductivityHour,
          metrics.breakFrequency,
          metrics.averageSessionDuration
        ],
        (err) => {
          if (err) reject(err)
          else resolve()
        }
      )

      stmt.finalize()
    })
  }

  // Break Patterns
  async saveBreakPattern(breakPattern: BreakPattern): Promise<number> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const stmt = this.db!.prepare(`
        INSERT INTO break_patterns 
        (timestamp, duration, type, before_activity, after_activity)
        VALUES (?, ?, ?, ?, ?)
      `)

      stmt.run(
        [
          breakPattern.timestamp,
          breakPattern.duration,
          breakPattern.type,
          breakPattern.beforeActivity,
          breakPattern.afterActivity
        ],
        function (err) {
          if (err) reject(err)
          else resolve(this.lastID)
        }
      )

      stmt.finalize()
    })
  }

  // Focus Sessions
  async saveFocusSession(session: FocusSession): Promise<number> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const stmt = this.db!.prepare(`
        INSERT INTO focus_sessions 
        (start_time, end_time, duration, app_name, category, interruptions, 
         focus_score, keystrokes, mouse_clicks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run(
        [
          session.startTime,
          session.endTime,
          session.duration,
          session.appName,
          session.category,
          session.interruptions,
          session.focusScore,
          session.keystrokes,
          session.mouseClicks
        ],
        function (err) {
          if (err) reject(err)
          else resolve(this.lastID)
        }
      )

      stmt.finalize()
    })
  }

  // Privacy Settings
  async savePrivacySettings(settings: PrivacySettings): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const stmt = this.db!.prepare(`
        INSERT OR REPLACE INTO privacy_settings 
        (id, anonymize_window_titles, anonymize_urls, excluded_apps, excluded_domains, 
         enable_screenshots, screenshot_blur_level, data_retention_days, export_data_on_delete, updated_at)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `)

      stmt.run(
        [
          settings.anonymizeWindowTitles ? 1 : 0,
          settings.anonymizeUrls ? 1 : 0,
          JSON.stringify(settings.excludedApps),
          JSON.stringify(settings.excludedDomains),
          settings.enableScreenshots ? 1 : 0,
          settings.screenshotBlurLevel,
          settings.dataRetentionDays,
          settings.exportDataOnDelete ? 1 : 0
        ],
        (err) => {
          if (err) reject(err)
          else resolve()
        }
      )

      stmt.finalize()
    })
  }

  async getPrivacySettings(): Promise<PrivacySettings | null> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      this.db!.get(
        `
        SELECT * FROM privacy_settings WHERE id = 1
      `,
        (err, row: any) => {
          if (err) reject(err)
          else if (!row) resolve(null)
          else {
            resolve({
              id: row.id,
              anonymizeWindowTitles: Boolean(row.anonymize_window_titles),
              anonymizeUrls: Boolean(row.anonymize_urls),
              excludedApps: JSON.parse(row.excluded_apps || '[]'),
              excludedDomains: JSON.parse(row.excluded_domains || '[]'),
              enableScreenshots: Boolean(row.enable_screenshots),
              screenshotBlurLevel: row.screenshot_blur_level,
              dataRetentionDays: row.data_retention_days,
              exportDataOnDelete: Boolean(row.export_data_on_delete)
            })
          }
        }
      )
    })
  }

  // System Metrics
  async saveSystemMetrics(metrics: SystemMetrics): Promise<number> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const stmt = this.db!.prepare(`
        INSERT INTO system_metrics 
        (timestamp, cpu_usage, memory_usage, disk_usage, network_activity, battery_level, is_charging)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run(
        [
          metrics.timestamp,
          metrics.cpuUsage,
          metrics.memoryUsage,
          metrics.diskUsage,
          metrics.networkActivity,
          metrics.batteryLevel,
          metrics.isCharging ? 1 : 0
        ],
        function (err) {
          if (err) reject(err)
          else resolve(this.lastID)
        }
      )

      stmt.finalize()
    })
  }

  // Productivity Insights
  async saveProductivityInsight(insight: ProductivityInsight): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const stmt = this.db!.prepare(`
        INSERT OR REPLACE INTO productivity_insights 
        (id, type, title, description, actionable, priority, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run(
        [
          insight.id,
          insight.type,
          insight.title,
          insight.description,
          insight.actionable ? 1 : 0,
          insight.priority,
          insight.timestamp
        ],
        (err) => {
          if (err) reject(err)
          else resolve()
        }
      )

      stmt.finalize()
    })
  }

  async getProductivityInsights(limit: number = 10): Promise<ProductivityInsight[]> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      this.db!.all(
        `
        SELECT * FROM productivity_insights 
        WHERE is_dismissed = 0
        ORDER BY priority DESC, timestamp DESC
        LIMIT ?
      `,
        [limit],
        (err, rows: any[]) => {
          if (err) reject(err)
          else {
            const insights = rows.map((row) => ({
              id: row.id,
              type: row.type,
              title: row.title,
              description: row.description,
              actionable: Boolean(row.actionable),
              priority: row.priority,
              timestamp: row.timestamp
            }))
            resolve(insights)
          }
        }
      )
    })
  }

  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}
