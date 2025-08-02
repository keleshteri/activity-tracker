import sqlite3 from 'sqlite3';
import { join } from 'path';
import { app } from 'electron';
import { ActivityRecord, ScreenshotRecord, DashboardData } from './types';

export class DatabaseManager {
  private db: sqlite3.Database | null = null;
  private dbPath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.dbPath = join(userDataPath, 'activity-tracker.db');
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        this.createTables().then(resolve).catch(reject);
      });
    });
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createScreenshotsTable = `
      CREATE TABLE IF NOT EXISTS screenshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        activity_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (activity_id) REFERENCES activities (id)
      )
    `;

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp);
      CREATE INDEX IF NOT EXISTS idx_activities_app_name ON activities(app_name);
      CREATE INDEX IF NOT EXISTS idx_screenshots_timestamp ON screenshots(timestamp);
    `;

    return new Promise((resolve, reject) => {
      this.db!.serialize(() => {
        this.db!.run(createActivitiesTable);
        this.db!.run(createScreenshotsTable);
        this.db!.run(createIndexes, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  async saveActivity(activity: ActivityRecord): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const stmt = this.db!.prepare(`
        INSERT INTO activities 
        (timestamp, app_name, window_title, duration, category, is_idle, url, cpu_usage)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        activity.timestamp,
        activity.appName,
        activity.windowTitle,
        activity.duration,
        activity.category || null,
        activity.isIdle ? 1 : 0,
        activity.url || null,
        activity.cpuUsage || null
      ], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });

      stmt.finalize();
    });
  }

  async saveScreenshot(screenshot: ScreenshotRecord): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const stmt = this.db!.prepare(`
        INSERT INTO screenshots (timestamp, file_path, activity_id)
        VALUES (?, ?, ?)
      `);

      stmt.run([
        screenshot.timestamp,
        screenshot.filePath,
        screenshot.activityId || null
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });

      stmt.finalize();
    });
  }

  async getDashboardData(): Promise<DashboardData> {
    if (!this.db) throw new Error('Database not initialized');

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const startOfWeek = new Date(today.getTime() - (today.getDay() * 24 * 60 * 60 * 1000)).getTime();

    // Get today's data
    const todayStats = await this.getTodayStats(startOfDay);
    const topApps = await this.getTopApps(startOfDay);
    
    // Get week's data
    const weekStats = await this.getWeekStats(startOfWeek);

    return {
      today: {
        totalTime: todayStats.totalTime,
        activeTime: todayStats.activeTime,
        idleTime: todayStats.idleTime,
        topApps,
        categories: [] // Implement categories later
      },
      thisWeek: {
        totalTime: weekStats.totalTime,
        dailyBreakdown: weekStats.dailyBreakdown
      }
    };
  }

  private async getTodayStats(startOfDay: number): Promise<{totalTime: number, activeTime: number, idleTime: number}> {
    return new Promise((resolve, reject) => {
      this.db!.all(`
        SELECT 
          SUM(duration) as total_time,
          SUM(CASE WHEN is_idle = 0 THEN duration ELSE 0 END) as active_time,
          SUM(CASE WHEN is_idle = 1 THEN duration ELSE 0 END) as idle_time
        FROM activities 
        WHERE timestamp >= ?
      `, [startOfDay], (err, rows: any[]) => {
        if (err) reject(err);
        else {
          const row = rows[0] || {};
          resolve({
            totalTime: row.total_time || 0,
            activeTime: row.active_time || 0,
            idleTime: row.idle_time || 0
          });
        }
      });
    });
  }

  private async getTopApps(startOfDay: number): Promise<Array<{name: string, time: number, percentage: number}>> {
    return new Promise((resolve, reject) => {
      this.db!.all(`
        SELECT 
          app_name as name,
          SUM(duration) as time
        FROM activities 
        WHERE timestamp >= ? AND is_idle = 0
        GROUP BY app_name
        ORDER BY time DESC
        LIMIT 10
      `, [startOfDay], (err, rows: any[]) => {
        if (err) reject(err);
        else {
          const total = rows.reduce((sum, row) => sum + row.time, 0);
          const apps = rows.map(row => ({
            name: row.name,
            time: row.time,
            percentage: total > 0 ? (row.time / total) * 100 : 0
          }));
          resolve(apps);
        }
      });
    });
  }

  private async getWeekStats(startOfWeek: number): Promise<{totalTime: number, dailyBreakdown: Array<{day: string, time: number}>}> {
    return new Promise((resolve, reject) => {
      this.db!.all(`
        SELECT 
          date(timestamp/1000, 'unixepoch', 'localtime') as day,
          SUM(duration) as time
        FROM activities 
        WHERE timestamp >= ?
        GROUP BY date(timestamp/1000, 'unixepoch', 'localtime')
        ORDER BY day
      `, [startOfWeek], (err, rows: any[]) => {
        if (err) reject(err);
        else {
          const totalTime = rows.reduce((sum, row) => sum + row.time, 0);
          resolve({
            totalTime,
            dailyBreakdown: rows
          });
        }
      });
    });
  }

  async getActivities(filters?: any): Promise<ActivityRecord[]> {
    if (!this.db) throw new Error('Database not initialized');

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
        created_at as createdAt
      FROM activities
    `;
    
    const conditions: string[] = [];
    const params: any[] = [];
    
    if (filters) {
      if (filters.search) {
        conditions.push('(app_name LIKE ? OR window_title LIKE ?)');
        params.push(`%${filters.search}%`, `%${filters.search}%`);
      }
      
      if (filters.appName) {
        conditions.push('app_name = ?');
        params.push(filters.appName);
      }
      
      if (filters.hideIdle) {
        conditions.push('is_idle = 0');
      }
      
      if (filters.startDate) {
        conditions.push('timestamp >= ?');
        params.push(filters.startDate);
      }
      
      if (filters.endDate) {
        conditions.push('timestamp <= ?');
        params.push(filters.endDate);
      }
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY timestamp DESC';
    
    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    return new Promise((resolve, reject) => {
      this.db!.all(query, params, (err, rows: any[]) => {
        if (err) reject(err);
        else {
          const activities = rows.map(row => ({
            id: row.id,
            timestamp: row.timestamp,
            appName: row.appName,
            windowTitle: row.windowTitle,
            duration: row.duration,
            category: row.category,
            isIdle: Boolean(row.isIdle),
            url: row.url,
            cpuUsage: row.cpuUsage,
            createdAt: row.createdAt
          }));
          resolve(activities);
        }
      });
    });
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}