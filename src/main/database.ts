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
  ProductivityInsight,
  DatabaseMigration,
  MigrationState,
  EnhancedDashboardData,
  WorkPattern,
  ProductivityBlock,
  Insight,
  DistractionSettings,
  DistractionEvent
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
      this.db = new sqlite3.Database(this.dbPath, async (err) => {
        if (err) {
          reject(err)
          return
        }

        try {
          await this.createMigrationTables()
          await this.runMigrations()
          await this.createTables()
          resolve()
        } catch (error) {
          reject(error)
        }
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

    const createWorkPatternsTable = `
      CREATE TABLE IF NOT EXISTS work_patterns (
        id TEXT PRIMARY KEY,
        type TEXT CHECK(type IN ('daily', 'weekly', 'monthly')),
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        confidence REAL NOT NULL,
        frequency INTEGER NOT NULL,
        time_of_day_start INTEGER,
        time_of_day_end INTEGER,
        day_of_week TEXT, -- JSON array
        associated_apps TEXT, -- JSON array
        productivity_impact TEXT CHECK(productivity_impact IN ('positive', 'negative', 'neutral')),
        detected_at INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `

    const createProductivityBlocksTable = `
      CREATE TABLE IF NOT EXISTS productivity_blocks (
        id TEXT PRIMARY KEY,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        duration INTEGER NOT NULL,
        type TEXT CHECK(type IN ('deep_focus', 'shallow_work', 'break', 'distraction')),
        focus_score REAL NOT NULL,
        dominant_activity TEXT NOT NULL,
        interruptions INTEGER DEFAULT 0,
        context_switches INTEGER DEFAULT 0,
        productivity_rating TEXT CHECK(productivity_rating IN ('productive', 'neutral', 'distracting')),
        energy_level TEXT CHECK(energy_level IN ('high', 'medium', 'low')),
        quality_score INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `

    const createInsightsTable = `
      CREATE TABLE IF NOT EXISTS insights (
        id TEXT PRIMARY KEY,
        category TEXT CHECK(category IN ('productivity', 'focus', 'patterns', 'health', 'optimization')),
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        actionable BOOLEAN DEFAULT 1,
        priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'critical')),
        confidence REAL NOT NULL,
        impact TEXT CHECK(impact IN ('low', 'medium', 'high')),
        timeframe TEXT CHECK(timeframe IN ('immediate', 'short_term', 'long_term')),
        data TEXT, -- JSON data
        timestamp INTEGER NOT NULL,
        expires_at INTEGER,
        is_dismissed BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `

    const createUserPreferencesTable = `
      CREATE TABLE IF NOT EXISTS user_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        type TEXT CHECK(type IN ('string', 'number', 'boolean', 'json')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `

    const createDistractionSettingsTable = `
      CREATE TABLE IF NOT EXISTS distraction_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enabled BOOLEAN DEFAULT 1,
        threshold_minutes INTEGER DEFAULT 5,
        notification_type TEXT CHECK(notification_type IN ('gentle', 'standard', 'persistent')) DEFAULT 'gentle',
        notification_frequency INTEGER DEFAULT 15,
        quiet_hours_enabled BOOLEAN DEFAULT 0,
        quiet_hours_start TEXT,
        quiet_hours_end TEXT,
        excluded_apps TEXT,
        break_reminder_enabled BOOLEAN DEFAULT 1,
        break_reminder_interval INTEGER DEFAULT 30,
        focus_mode_enabled BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `

    const createDistractionEventsTable = `
      CREATE TABLE IF NOT EXISTS distraction_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        app_name TEXT NOT NULL,
        duration INTEGER NOT NULL,
        severity TEXT CHECK(severity IN ('low', 'medium', 'high')) DEFAULT 'medium',
        notification_sent BOOLEAN DEFAULT 0,
        user_acknowledged BOOLEAN DEFAULT 0,
        context TEXT,
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
      CREATE INDEX IF NOT EXISTS idx_work_patterns_type ON work_patterns(type);
      CREATE INDEX IF NOT EXISTS idx_work_patterns_detected_at ON work_patterns(detected_at);
      CREATE INDEX IF NOT EXISTS idx_productivity_blocks_start_time ON productivity_blocks(start_time);
      CREATE INDEX IF NOT EXISTS idx_productivity_blocks_type ON productivity_blocks(type);
      CREATE INDEX IF NOT EXISTS idx_insights_category ON insights(category);
      CREATE INDEX IF NOT EXISTS idx_insights_timestamp ON insights(timestamp);
      CREATE INDEX IF NOT EXISTS idx_user_preferences_key ON user_preferences(key);
      CREATE INDEX IF NOT EXISTS idx_distraction_events_timestamp ON distraction_events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_distraction_events_app_name ON distraction_events(app_name);
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
        this.db!.run(createWorkPatternsTable)
        this.db!.run(createProductivityBlocksTable)
        this.db!.run(createInsightsTable)
        this.db!.run(createUserPreferencesTable)
        this.db!.run(createDistractionSettingsTable)
        this.db!.run(createDistractionEventsTable)
        this.db!.run(createIndexes, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    })
  }

  private async createMigrationTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    const createMigrationsTable = `
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        applied_at INTEGER NOT NULL,
        checksum TEXT NOT NULL
      )
    `

    const createMigrationStateTable = `
      CREATE TABLE IF NOT EXISTS migration_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        current_version INTEGER NOT NULL DEFAULT 0,
        last_migration_at INTEGER NOT NULL DEFAULT 0
      )
    `

    return new Promise((resolve, reject) => {
      this.db!.serialize(() => {
        this.db!.run(createMigrationsTable)
        this.db!.run(createMigrationStateTable)
        
        // Initialize migration state if it doesn't exist
        this.db!.run(
          'INSERT OR IGNORE INTO migration_state (id, current_version, last_migration_at) VALUES (1, 0, 0)',
          (err) => {
            if (err) reject(err)
            else resolve()
          }
        )
      })
    })
  }

  private async runMigrations(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    const currentVersion = await this.getCurrentMigrationVersion()
    const migrations = this.getMigrations()

    for (const migration of migrations) {
      if (migration.version > currentVersion) {
        await this.applyMigration(migration)
      }
    }
  }

  private async getCurrentMigrationVersion(): Promise<number> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      this.db!.get(
        'SELECT current_version FROM migration_state WHERE id = 1',
        (err, row: any) => {
          if (err) reject(err)
          else resolve(row?.current_version || 0)
        }
      )
    })
  }

  private getMigrations(): DatabaseMigration[] {
    return [
      {
        version: 1,
        name: 'initial_enhanced_schema',
        description: 'Add enhanced productivity tracking fields to activities table',
        up: [
          'ALTER TABLE activities ADD COLUMN memory_usage REAL',
          'ALTER TABLE activities ADD COLUMN focus_score REAL',
          "ALTER TABLE activities ADD COLUMN productivity_rating TEXT CHECK(productivity_rating IN ('productive', 'neutral', 'distracting'))",
          'ALTER TABLE activities ADD COLUMN context_switches INTEGER DEFAULT 0',
          'ALTER TABLE activities ADD COLUMN keystrokes INTEGER DEFAULT 0',
          'ALTER TABLE activities ADD COLUMN mouse_clicks INTEGER DEFAULT 0'
        ],
        down: [
          'ALTER TABLE activities DROP COLUMN memory_usage',
          'ALTER TABLE activities DROP COLUMN focus_score',
          'ALTER TABLE activities DROP COLUMN productivity_rating',
          'ALTER TABLE activities DROP COLUMN context_switches',
          'ALTER TABLE activities DROP COLUMN keystrokes',
          'ALTER TABLE activities DROP COLUMN mouse_clicks'
        ],
        timestamp: Date.now()
      },
      {
        version: 2,
        name: 'analytics_tables',
        description: 'Add analytics and pattern detection tables',
        up: [
          // These tables are created in createTables method
          'SELECT 1' // Placeholder - actual table creation handled in createTables
        ],
        down: [
          'DROP TABLE IF EXISTS work_patterns',
          'DROP TABLE IF EXISTS productivity_blocks',
          'DROP TABLE IF EXISTS insights',
          'DROP TABLE IF EXISTS user_preferences'
        ],
        timestamp: Date.now()
      }
    ]
  }

  private async applyMigration(migration: DatabaseMigration): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      this.db!.serialize(() => {
        this.db!.run('BEGIN TRANSACTION')

        let completed = 0
        const total = migration.up.length

        if (total === 0) {
          this.completeMigration(migration, resolve, reject)
          return
        }

        migration.up.forEach((sql) => {
          this.db!.run(sql, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
              this.db!.run('ROLLBACK')
              reject(new Error(`Migration ${migration.version} failed: ${err.message}`))
              return
            }

            completed++
            if (completed === total) {
              this.completeMigration(migration, resolve, reject)
            }
          })
        })
      })
    })
  }

  private completeMigration(
    migration: DatabaseMigration,
    resolve: () => void,
    reject: (error: Error) => void
  ): void {
    if (!this.db) {
      reject(new Error('Database not initialized'))
      return
    }

    const checksum = this.calculateMigrationChecksum(migration)
    const now = Date.now()

    this.db.run(
      'INSERT INTO migrations (version, name, description, applied_at, checksum) VALUES (?, ?, ?, ?, ?)',
      [migration.version, migration.name, migration.description, now, checksum],
      (err) => {
        if (err) {
          this.db!.run('ROLLBACK')
          reject(err)
          return
        }

        this.db!.run(
          'UPDATE migration_state SET current_version = ?, last_migration_at = ? WHERE id = 1',
          [migration.version, now],
          (err) => {
            if (err) {
              this.db!.run('ROLLBACK')
              reject(err)
              return
            }

            this.db!.run('COMMIT', (err) => {
              if (err) reject(err)
              else {
                console.log(`Applied migration ${migration.version}: ${migration.name}`)
                resolve()
              }
            })
          }
        )
      }
    )
  }

  private calculateMigrationChecksum(migration: DatabaseMigration): string {
    const content = migration.up.join('') + migration.down.join('')
    // Simple checksum - in production, use a proper hash function
    return Buffer.from(content).toString('base64').slice(0, 32)
  }

  async getMigrationState(): Promise<MigrationState> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      this.db!.get(
        'SELECT current_version, last_migration_at FROM migration_state WHERE id = 1',
        (err, row: any) => {
          if (err) {
            reject(err)
            return
          }

          this.db!.all(
            'SELECT version FROM migrations ORDER BY version',
            (err, migrations: any[]) => {
              if (err) {
                reject(err)
                return
              }

              resolve({
                currentVersion: row?.current_version || 0,
                appliedMigrations: migrations.map(m => m.version),
                lastMigrationAt: row?.last_migration_at || 0
              })
            }
          )
        }
      )
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

  async deleteAppCategory(appName: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      this.db!.run(
        'DELETE FROM app_categories WHERE app_name = ?',
        [appName],
        (err) => {
          if (err) reject(err)
          else resolve()
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

  // Work Patterns Analytics
  async saveWorkPattern(pattern: WorkPattern): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const stmt = this.db!.prepare(`
        INSERT OR REPLACE INTO work_patterns 
        (id, type, name, description, confidence, frequency, time_of_day_start, time_of_day_end, 
         day_of_week, associated_apps, productivity_impact, detected_at, last_seen)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run(
        [
          pattern.id,
          pattern.type,
          pattern.name,
          pattern.description,
          pattern.confidence,
          pattern.frequency,
          pattern.timeOfDay?.start,
          pattern.timeOfDay?.end,
          JSON.stringify(pattern.dayOfWeek || []),
          JSON.stringify(pattern.associatedApps),
          pattern.productivityImpact,
          pattern.detectedAt,
          pattern.lastSeen
        ],
        function (err) {
          if (err) reject(err)
          else resolve()
        }
      )

      stmt.finalize()
    })
  }

  async getWorkPatterns(type?: string): Promise<WorkPattern[]> {
    if (!this.db) throw new Error('Database not initialized')

    let query = `
      SELECT id, type, name, description, confidence, frequency, 
             time_of_day_start, time_of_day_end, day_of_week, associated_apps,
             productivity_impact, detected_at, last_seen
      FROM work_patterns
    `
    const params: any[] = []

    if (type) {
      query += ' WHERE type = ?'
      params.push(type)
    }

    query += ' ORDER BY confidence DESC, last_seen DESC'

    return new Promise((resolve, reject) => {
      this.db!.all(query, params, (err, rows: any[]) => {
        if (err) reject(err)
        else {
          const patterns = rows.map((row) => ({
            id: row.id,
            type: row.type,
            name: row.name,
            description: row.description,
            confidence: row.confidence,
            frequency: row.frequency,
            timeOfDay: row.time_of_day_start && row.time_of_day_end ? {
              start: row.time_of_day_start,
              end: row.time_of_day_end
            } : undefined,
            dayOfWeek: JSON.parse(row.day_of_week || '[]'),
            associatedApps: JSON.parse(row.associated_apps || '[]'),
            productivityImpact: row.productivity_impact,
            detectedAt: row.detected_at,
            lastSeen: row.last_seen
          }))
          resolve(patterns)
        }
      })
    })
  }

  // Productivity Blocks Analytics
  async saveProductivityBlock(block: ProductivityBlock): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const stmt = this.db!.prepare(`
        INSERT OR REPLACE INTO productivity_blocks 
        (id, start_time, end_time, duration, type, focus_score, dominant_activity, 
         interruptions, context_switches, productivity_rating, energy_level, quality_score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run(
        [
          block.id,
          block.startTime,
          block.endTime,
          block.duration,
          block.type,
          block.focusScore,
          block.dominantActivity,
          block.interruptions,
          block.contextSwitches,
          block.productivityRating,
          block.energyLevel,
          block.qualityScore
        ],
        function (err) {
          if (err) reject(err)
          else resolve()
        }
      )

      stmt.finalize()
    })
  }

  async getProductivityBlocks(startTime?: number, endTime?: number): Promise<ProductivityBlock[]> {
    if (!this.db) throw new Error('Database not initialized')

    let query = `
      SELECT id, start_time, end_time, duration, type, focus_score, dominant_activity,
             interruptions, context_switches, productivity_rating, energy_level, quality_score
      FROM productivity_blocks
    `
    const params: any[] = []
    const conditions: string[] = []

    if (startTime) {
      conditions.push('start_time >= ?')
      params.push(startTime)
    }

    if (endTime) {
      conditions.push('end_time <= ?')
      params.push(endTime)
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }

    query += ' ORDER BY start_time DESC'

    return new Promise((resolve, reject) => {
      this.db!.all(query, params, (err, rows: any[]) => {
        if (err) reject(err)
        else {
          const blocks = rows.map((row) => ({
            id: row.id,
            startTime: row.start_time,
            endTime: row.end_time,
            duration: row.duration,
            type: row.type,
            focusScore: row.focus_score,
            dominantActivity: row.dominant_activity,
            interruptions: row.interruptions,
            contextSwitches: row.context_switches,
            productivityRating: row.productivity_rating,
            energyLevel: row.energy_level,
            qualityScore: row.quality_score
          }))
          resolve(blocks)
        }
      })
    })
  }

  // Enhanced Insights
  async saveInsight(insight: Insight): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const stmt = this.db!.prepare(`
        INSERT OR REPLACE INTO insights 
        (id, category, type, title, description, actionable, priority, confidence, 
         impact, timeframe, data, timestamp, expires_at, is_dismissed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run(
        [
          insight.id,
          insight.category,
          insight.type,
          insight.title,
          insight.description,
          insight.actionable,
          insight.priority,
          insight.confidence,
          insight.impact,
          insight.timeframe,
          JSON.stringify(insight.data),
          insight.timestamp,
          insight.expiresAt,
          insight.isDismissed
        ],
        function (err) {
          if (err) reject(err)
          else resolve()
        }
      )

      stmt.finalize()
    })
  }

  async getInsights(category?: string, limit: number = 20): Promise<Insight[]> {
    if (!this.db) throw new Error('Database not initialized')

    let query = `
      SELECT id, category, type, title, description, actionable, priority, confidence,
             impact, timeframe, data, timestamp, expires_at, is_dismissed
      FROM insights
      WHERE is_dismissed = 0
    `
    const params: any[] = []

    if (category) {
      query += ' AND category = ?'
      params.push(category)
    }

    query += ' AND (expires_at IS NULL OR expires_at > ?)'
    params.push(Date.now())

    query += ' ORDER BY priority DESC, confidence DESC, timestamp DESC LIMIT ?'
    params.push(limit)

    return new Promise((resolve, reject) => {
      this.db!.all(query, params, (err, rows: any[]) => {
        if (err) reject(err)
        else {
          const insights = rows.map((row) => ({
            id: row.id,
            category: row.category,
            type: row.type,
            title: row.title,
            description: row.description,
            actionable: Boolean(row.actionable),
            priority: row.priority,
            confidence: row.confidence,
            impact: row.impact,
            timeframe: row.timeframe,
            data: JSON.parse(row.data || '{}'),
            timestamp: row.timestamp,
            expiresAt: row.expires_at,
            isDismissed: Boolean(row.is_dismissed)
          }))
          resolve(insights)
        }
      })
    })
  }

  // User Preferences
  async saveUserPreference(key: string, value: any, type: 'string' | 'number' | 'boolean' | 'json' = 'string'): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    const serializedValue = type === 'json' ? JSON.stringify(value) : String(value)

    return new Promise((resolve, reject) => {
      const stmt = this.db!.prepare(`
        INSERT OR REPLACE INTO user_preferences (key, value, type, updated_at)
        VALUES (?, ?, ?, ?)
      `)

      stmt.run([key, serializedValue, type, Date.now()], function (err) {
        if (err) reject(err)
        else resolve()
      })

      stmt.finalize()
    })
  }

  async getUserPreference(key: string): Promise<any> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      this.db!.get(
        'SELECT value, type FROM user_preferences WHERE key = ?',
        [key],
        (err, row: any) => {
          if (err) reject(err)
          else if (!row) resolve(null)
          else {
            let value = row.value
            switch (row.type) {
              case 'number':
                value = Number(value)
                break
              case 'boolean':
                value = value === 'true'
                break
              case 'json':
                value = JSON.parse(value)
                break
            }
            resolve(value)
          }
        }
      )
    })
  }

  async getAllUserPreferences(): Promise<Record<string, any>> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      this.db!.all(
        'SELECT key, value, type FROM user_preferences',
        (err, rows: any[]) => {
          if (err) reject(err)
          else {
            const preferences: Record<string, any> = {}
            rows.forEach((row) => {
              let value = row.value
              switch (row.type) {
                case 'number':
                  value = Number(value)
                  break
                case 'boolean':
                  value = value === 'true'
                  break
                case 'json':
                  value = JSON.parse(value)
                  break
              }
              preferences[row.key] = value
            })
            resolve(preferences)
          }
        }
      )
    })
  }

  // Enhanced Dashboard Data
  async getEnhancedDashboardData(): Promise<EnhancedDashboardData> {
    const basicData = await this.getDashboardData()
    const patterns = await this.getWorkPatterns()
    const now = Date.now()
    const startOfDay = new Date().setHours(0, 0, 0, 0)
    const productivityBlocks = await this.getProductivityBlocks(startOfDay, now)
    const recommendations = await this.getInsights('optimization', 5)

    // Calculate weekly comparison
    const currentWeekStart = startOfDay - (6 * 24 * 60 * 60 * 1000)
    const previousWeekStart = currentWeekStart - (7 * 24 * 60 * 60 * 1000)
    const previousWeekEnd = currentWeekStart

    const currentWeekBlocks = await this.getProductivityBlocks(currentWeekStart, now)
    const previousWeekBlocks = await this.getProductivityBlocks(previousWeekStart, previousWeekEnd)

    const currentWeekTime = currentWeekBlocks.reduce((sum, block) => sum + block.duration, 0)
    const previousWeekTime = previousWeekBlocks.reduce((sum, block) => sum + block.duration, 0)
    const percentageChange = previousWeekTime > 0 ? ((currentWeekTime - previousWeekTime) / previousWeekTime) * 100 : 0

    return {
      ...basicData,
      patterns,
      productivityBlocks,
      recommendations,
      weeklyComparison: {
        currentWeek: currentWeekTime,
        previousWeek: previousWeekTime,
        percentageChange
      },
      monthlyTrends: {
        productivityTrend: 'stable', // TODO: Implement trend calculation
        focusTrend: 'stable',
        distractionTrend: 'stable'
      }
    }
  }

  // Distraction Management
  async saveDistractionSettings(settings: DistractionSettings): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const stmt = this.db!.prepare(`
        INSERT OR REPLACE INTO distraction_settings 
        (id, enable_distraction_detection, distraction_threshold, context_switch_threshold, 
         enable_notifications, notification_style, quiet_hours_enabled, quiet_hours_start, 
         quiet_hours_end, blocked_apps, allowed_break_apps, focus_session_reminders, 
         break_reminders, created_at, updated_at)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      const now = Date.now()
      stmt.run(
        [
          settings.enableDistractionDetection ? 1 : 0,
          settings.distractionThreshold,
          settings.contextSwitchThreshold,
          settings.enableNotifications ? 1 : 0,
          settings.notificationStyle,
          settings.quietHours.enabled ? 1 : 0,
          settings.quietHours.start,
          settings.quietHours.end,
          JSON.stringify(settings.blockedApps),
          JSON.stringify(settings.allowedBreakApps),
          settings.focusSessionReminders ? 1 : 0,
          settings.breakReminders ? 1 : 0,
          settings.createdAt || now,
          now
        ],
        (err) => {
          if (err) reject(err)
          else resolve()
        }
      )

      stmt.finalize()
    })
  }

  async getDistractionSettings(): Promise<DistractionSettings | null> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      this.db!.get(
        `
        SELECT * FROM distraction_settings WHERE id = 1
      `,
        (err, row: any) => {
          if (err) reject(err)
          else if (!row) {
            // Return default settings if none exist
            resolve({
              enableDistractionDetection: true,
              distractionThreshold: 15,
              contextSwitchThreshold: 20,
              enableNotifications: true,
              notificationStyle: 'gentle',
              quietHours: {
                enabled: false,
                start: '22:00',
                end: '08:00'
              },
              blockedApps: [],
              allowedBreakApps: [],
              focusSessionReminders: true,
              breakReminders: true,
              createdAt: Date.now(),
              updatedAt: Date.now()
            })
          } else {
            resolve({
              id: row.id,
              enableDistractionDetection: Boolean(row.enable_distraction_detection),
              distractionThreshold: row.distraction_threshold,
              contextSwitchThreshold: row.context_switch_threshold,
              enableNotifications: Boolean(row.enable_notifications),
              notificationStyle: row.notification_style,
              quietHours: {
                enabled: Boolean(row.quiet_hours_enabled),
                start: row.quiet_hours_start,
                end: row.quiet_hours_end
              },
              blockedApps: JSON.parse(row.blocked_apps || '[]'),
              allowedBreakApps: JSON.parse(row.allowed_break_apps || '[]'),
              focusSessionReminders: Boolean(row.focus_session_reminders),
              breakReminders: Boolean(row.break_reminders),
              createdAt: row.created_at,
              updatedAt: row.updated_at
            })
          }
        }
      )
    })
  }

  async saveDistractionEvent(event: DistractionEvent): Promise<number> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const stmt = this.db!.prepare(`
        INSERT INTO distraction_events 
        (timestamp, type, app_name, duration, severity, context_switches, was_notified, user_response)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run(
        [
          event.timestamp,
          event.type,
          event.appName,
          event.duration,
          event.severity,
          event.contextSwitches,
          event.wasNotified ? 1 : 0,
          event.userResponse || null
        ],
        function (err) {
          if (err) reject(err)
          else resolve(this.lastID)
        }
      )

      stmt.finalize()
    })
  }

  async getDistractionEvents(filters?: any): Promise<DistractionEvent[]> {
    if (!this.db) throw new Error('Database not initialized')

    let query = 'SELECT * FROM distraction_events'
    const params: any[] = []
    const conditions: string[] = []

    if (filters?.startTime) {
      conditions.push('timestamp >= ?')
      params.push(filters.startTime)
    }

    if (filters?.endTime) {
      conditions.push('timestamp <= ?')
      params.push(filters.endTime)
    }

    if (filters?.type) {
      conditions.push('type = ?')
      params.push(filters.type)
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
          const events = rows.map((row) => ({
            id: row.id,
            timestamp: row.timestamp,
            type: row.type,
            appName: row.app_name,
            duration: row.duration,
            severity: row.severity,
            contextSwitches: row.context_switches,
            wasNotified: Boolean(row.was_notified),
            userResponse: row.user_response
          }))
          resolve(events)
        }
      })
    })
  }

  async getFocusSessions(filters?: any): Promise<FocusSession[]> {
    if (!this.db) throw new Error('Database not initialized')

    let query = 'SELECT * FROM focus_sessions'
    const params: any[] = []
    const conditions: string[] = []

    if (filters?.startTime) {
      conditions.push('start_time >= ?')
      params.push(filters.startTime)
    }

    if (filters?.endTime) {
      conditions.push('end_time <= ?')
      params.push(filters.endTime)
    }

    if (filters?.appName) {
      conditions.push('app_name = ?')
      params.push(filters.appName)
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }

    query += ' ORDER BY start_time DESC'

    if (filters?.limit) {
      query += ' LIMIT ?'
      params.push(filters.limit)
    }

    return new Promise((resolve, reject) => {
      this.db!.all(query, params, (err, rows: any[]) => {
        if (err) reject(err)
        else {
          const sessions = rows.map((row) => ({
            id: row.id,
            startTime: row.start_time,
            endTime: row.end_time,
            duration: row.duration,
            appName: row.app_name,
            category: row.category,
            interruptions: row.interruptions,
            focusScore: row.focus_score,
            keystrokes: row.keystrokes,
            mouseClicks: row.mouse_clicks
          }))
          resolve(sessions)
        }
      })
    })
  }

  getDatabasePath(): string {
    return this.dbPath
  }

  async cleanupOldData(retentionDays: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    const cutoffTimestamp = Date.now() - (retentionDays * 24 * 60 * 60 * 1000)

    return new Promise((resolve, reject) => {
      this.db!.serialize(() => {
        // Clean up old activities
        this.db!.run(
          'DELETE FROM activities WHERE timestamp < ?',
          [cutoffTimestamp],
          (err) => {
            if (err) {
              console.error('Failed to cleanup old activities:', err)
            }
          }
        )

        // Clean up old screenshots
        this.db!.run(
          'DELETE FROM screenshots WHERE timestamp < ?',
          [cutoffTimestamp],
          (err) => {
            if (err) {
              console.error('Failed to cleanup old screenshots:', err)
            }
          }
        )

        // Clean up old distraction events
        this.db!.run(
          'DELETE FROM distraction_events WHERE timestamp < ?',
          [cutoffTimestamp],
          (err) => {
            if (err) {
              console.error('Failed to cleanup old distraction events:', err)
            }
          }
        )

        // Clean up expired insights
        this.db!.run(
          'DELETE FROM insights WHERE expires_at IS NOT NULL AND expires_at < ?',
          [Date.now()],
          (err) => {
            if (err) {
              console.error('Failed to cleanup expired insights:', err)
              reject(err)
            } else {
              resolve()
            }
          }
        )
      })
    })
  }

  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}
