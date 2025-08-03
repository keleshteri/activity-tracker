import { join } from 'path'
import { writeFileSync, readFileSync, existsSync, mkdirSync, createReadStream, createWriteStream } from 'fs'
import { app, dialog } from 'electron'
import archiver from 'archiver'
import * as unzipper from 'unzipper'
import * as crypto from 'crypto'
import { DatabaseManager } from '../database'
import {
  ActivityRecord,
  DashboardData,
  WorkSession,
  ProductivityMetrics,
  AppCategory,
  WorkPattern,
  ProductivityInsight,
  FocusSession,
  BreakPattern,
  TrackerConfig
} from '../types'

export interface ExportFilters {
  startDate?: number
  endDate?: number
  appNames?: string[]
  categories?: string[]
  includeScreenshots?: boolean
  includePersonalData?: boolean
  format?: 'json' | 'csv'
  dataTypes?: ExportDataType[]
}

export type ExportDataType = 
  | 'activities' 
  | 'sessions' 
  | 'metrics' 
  | 'categories' 
  | 'patterns' 
  | 'insights' 
  | 'screenshots'
  | 'config'

export interface ExportResult {
  success: boolean
  filePath?: string
  error?: string
  recordCount?: number
  fileSize?: number
}

export interface BackupResult {
  success: boolean
  backupPath?: string
  error?: string
  backupSize?: number
  timestamp: number
}

export interface ImportResult {
  success: boolean
  error?: string
  recordsImported?: number
  conflictsResolved?: number
}

export interface AutoExportConfig {
  enabled: boolean
  frequency: 'daily' | 'weekly' | 'monthly'
  format: 'json' | 'csv'
  includeScreenshots: boolean
  exportPath: string
  retentionDays: number
}

export interface ProductivityReport {
  period: {
    start: number
    end: number
    type: 'day' | 'week' | 'month' | 'quarter' | 'year'
  }
  summary: {
    totalActiveTime: number
    productiveTime: number
    focusScore: number
    topApps: Array<{ name: string; time: number; productivity: string }>
    achievements: string[]
    improvements: string[]
  }
  analytics: {
    dailyBreakdown: Array<{ date: string; time: number; productivity: number }>
    hourlyPatterns: Array<{ hour: number; productivity: number }>
    categoryBreakdown: Array<{ category: string; time: number; percentage: number }>
    trends: {
      productivity: 'improving' | 'declining' | 'stable'
      focus: 'improving' | 'declining' | 'stable'
      consistency: 'improving' | 'declining' | 'stable'
    }
  }
  insights: ProductivityInsight[]
  recommendations: string[]
}

export class ExportManager {
  private databaseManager: DatabaseManager
  private exportPath: string
  private backupPath: string

  constructor(databaseManager: DatabaseManager) {
    this.databaseManager = databaseManager
    this.exportPath = join(app.getPath('userData'), 'exports')
    this.backupPath = join(app.getPath('userData'), 'backups')
    
    // Ensure directories exist
    if (!existsSync(this.exportPath)) {
      mkdirSync(this.exportPath, { recursive: true })
    }
    if (!existsSync(this.backupPath)) {
      mkdirSync(this.backupPath, { recursive: true })
    }
  }

  /**
   * Export data to JSON format
   */
  async exportToJSON(filters: ExportFilters = {}): Promise<ExportResult> {
    try {
      const data = await this.gatherExportData(filters)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `activity-export-${timestamp}.json`
      const filePath = join(this.exportPath, filename)

      const exportData = {
        metadata: {
          exportedAt: Date.now(),
          version: '1.0.0',
          filters,
          recordCount: this.countRecords(data)
        },
        data
      }

      writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf8')
      const stats = require('fs').statSync(filePath)

      return {
        success: true,
        filePath,
        recordCount: exportData.metadata.recordCount,
        fileSize: stats.size
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Export data to CSV format
   */
  async exportToCSV(filters: ExportFilters = {}): Promise<ExportResult> {
    try {
      const data = await this.gatherExportData(filters)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `activity-export-${timestamp}.csv`
      const filePath = join(this.exportPath, filename)

      let csvContent = ''
      let recordCount = 0

      // Export activities as main CSV
      if (data.activities && data.activities.length > 0) {
        csvContent += this.convertActivitiesToCSV(data.activities)
        recordCount += data.activities.length
      }

      writeFileSync(filePath, csvContent, 'utf8')
      const stats = require('fs').statSync(filePath)

      return {
        success: true,
        filePath,
        recordCount,
        fileSize: stats.size
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Generate comprehensive productivity report
   */
  async generateProductivityReport(format: 'pdf' | 'html' | 'json', period: {
    start: number
    end: number
    type: 'day' | 'week' | 'month' | 'quarter' | 'year'
  }): Promise<ExportResult> {
    try {
      const report = await this.buildProductivityReport(period)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `productivity-report-${period.type}-${timestamp}.${format}`
      const filePath = join(this.exportPath, filename)

      if (format === 'json') {
        writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf8')
      } else if (format === 'html') {
        const htmlContent = this.generateHTMLReport(report)
        writeFileSync(filePath, htmlContent, 'utf8')
      }
      // PDF generation would require additional library like puppeteer

      const stats = require('fs').statSync(filePath)

      return {
        success: true,
        filePath,
        fileSize: stats.size
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Create complete database backup
   */
  async createBackup(options: {
    includeScreenshots?: boolean
    compress?: boolean
    encrypt?: boolean
    password?: string
  } = {}): Promise<BackupResult> {
    try {
      const timestamp = Date.now()
      const dateStr = new Date(timestamp).toISOString().replace(/[:.]/g, '-')
      const backupName = `backup-${dateStr}`
      const backupDir = join(this.backupPath, backupName)
      
      if (!existsSync(backupDir)) {
        mkdirSync(backupDir, { recursive: true })
      }

      // Export all data
      const fullExport = await this.gatherExportData({
        includeScreenshots: options.includeScreenshots,
        includePersonalData: true,
        dataTypes: ['activities', 'sessions', 'metrics', 'categories', 'patterns', 'insights', 'config']
      })

      // Save database export
      const dbExportPath = join(backupDir, 'database.json')
      writeFileSync(dbExportPath, JSON.stringify(fullExport, null, 2), 'utf8')

      // Copy configuration files
      const configPath = join(app.getPath('userData'), 'config.json')
      if (existsSync(configPath)) {
        const configBackupPath = join(backupDir, 'config.json')
        const configData = readFileSync(configPath, 'utf8')
        writeFileSync(configBackupPath, configData, 'utf8')
      }

      // Copy screenshots if requested
      if (options.includeScreenshots) {
        const screenshotsDir = join(app.getPath('userData'), 'screenshots')
        if (existsSync(screenshotsDir)) {
          const backupScreenshotsDir = join(backupDir, 'screenshots')
          mkdirSync(backupScreenshotsDir, { recursive: true })
          // Copy screenshot files (implementation would copy files)
        }
      }

      let finalBackupPath = backupDir
      let backupSize = this.getDirectorySize(backupDir)

      // Compress if requested
      if (options.compress) {
        const zipPath = `${backupDir}.zip`
        await this.compressDirectory(backupDir, zipPath)
        finalBackupPath = zipPath
        backupSize = require('fs').statSync(zipPath).size
        
        // Clean up uncompressed directory
        require('fs').rmSync(backupDir, { recursive: true, force: true })
      }

      // Encrypt if requested
      if (options.encrypt && options.password) {
        const encryptedPath = `${finalBackupPath}.enc`
        await this.encryptFile(finalBackupPath, encryptedPath, options.password)
        require('fs').unlinkSync(finalBackupPath)
        finalBackupPath = encryptedPath
        backupSize = require('fs').statSync(encryptedPath).size
      }

      return {
        success: true,
        backupPath: finalBackupPath,
        backupSize,
        timestamp
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Restore from backup
   */
  async restoreBackup(backupPath: string, options: {
    password?: string
    overwriteExisting?: boolean
    validateData?: boolean
  } = {}): Promise<ImportResult> {
    try {
      let workingPath = backupPath
      
      // Decrypt if needed
      if (backupPath.endsWith('.enc')) {
        if (!options.password) {
          throw new Error('Password required for encrypted backup')
        }
        const decryptedPath = backupPath.replace('.enc', '')
        await this.decryptFile(backupPath, decryptedPath, options.password)
        workingPath = decryptedPath
      }

      // Extract if compressed
      if (workingPath.endsWith('.zip')) {
        const extractPath = workingPath.replace('.zip', '')
        await this.extractArchive(workingPath, extractPath)
        workingPath = extractPath
      }

      // Read backup data
      const dbBackupPath = join(workingPath, 'database.json')
      if (!existsSync(dbBackupPath)) {
        throw new Error('Invalid backup: database.json not found')
      }

      const backupData = JSON.parse(readFileSync(dbBackupPath, 'utf8'))
      
      // Validate data if requested
      if (options.validateData) {
        this.validateBackupData(backupData)
      }

      // Import data
      let recordsImported = 0
      let conflictsResolved = 0

      if (backupData.activities) {
        for (const activity of backupData.activities) {
          try {
            await this.databaseManager.saveActivity(activity)
            recordsImported++
          } catch (error) {
            if (options.overwriteExisting) {
              // Handle conflict resolution
              conflictsResolved++
            }
          }
        }
      }

      // Import other data types similarly...

      return {
        success: true,
        recordsImported,
        conflictsResolved
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Schedule automatic exports
   */
  scheduleAutoExport(config: AutoExportConfig): void {
    if (!config.enabled) return

    const schedule = require('node-schedule')
    let cronPattern: string

    switch (config.frequency) {
      case 'daily':
        cronPattern = '0 2 * * *' // 2 AM daily
        break
      case 'weekly':
        cronPattern = '0 2 * * 0' // 2 AM every Sunday
        break
      case 'monthly':
        cronPattern = '0 2 1 * *' // 2 AM on 1st of month
        break
      default:
        return
    }

    schedule.scheduleJob(cronPattern, async () => {
      try {
        const filters: ExportFilters = {
          format: config.format,
          includeScreenshots: config.includeScreenshots
        }

        if (config.format === 'json') {
          await this.exportToJSON(filters)
        } else {
          await this.exportToCSV(filters)
        }

        // Clean up old exports based on retention policy
        this.cleanupOldExports(config.retentionDays)
      } catch (error) {
        console.error('Auto export failed:', error)
      }
    })
  }

  // Private helper methods
  private async gatherExportData(filters: ExportFilters): Promise<any> {
    const data: any = {}
    const dataTypes = filters.dataTypes || ['activities', 'sessions', 'metrics', 'categories']

    if (dataTypes.includes('activities')) {
      data.activities = await this.databaseManager.getActivities({
        startTime: filters.startDate,
        endTime: filters.endDate,
        appNames: filters.appNames
      })
    }

    if (dataTypes.includes('sessions')) {
      data.sessions = await this.databaseManager.getWorkSessions({
        startTime: filters.startDate,
        endTime: filters.endDate
      })
    }

    if (dataTypes.includes('metrics')) {
      data.metrics = await this.databaseManager.getProductivityMetrics({
        startDate: filters.startDate ? new Date(filters.startDate).toISOString().split('T')[0] : undefined,
        endDate: filters.endDate ? new Date(filters.endDate).toISOString().split('T')[0] : undefined
      })
    }

    if (dataTypes.includes('categories')) {
      data.categories = await this.databaseManager.getAppCategories()
    }

    if (dataTypes.includes('patterns')) {
      data.patterns = await this.databaseManager.getWorkPatterns()
    }

    if (dataTypes.includes('insights')) {
      data.insights = await this.databaseManager.getInsights({
        startTime: filters.startDate,
        endTime: filters.endDate
      })
    }

    return data
  }

  private countRecords(data: any): number {
    let count = 0
    Object.values(data).forEach((value: any) => {
      if (Array.isArray(value)) {
        count += value.length
      }
    })
    return count
  }

  private convertActivitiesToCSV(activities: ActivityRecord[]): string {
    const headers = [
      'timestamp', 'appName', 'windowTitle', 'duration', 'category',
      'isIdle', 'url', 'cpuUsage', 'memoryUsage', 'focusScore',
      'productivityRating', 'contextSwitches', 'keystrokes', 'mouseClicks'
    ]

    let csv = headers.join(',') + '\n'

    activities.forEach(activity => {
      const row = headers.map(header => {
        const value = (activity as any)[header]
        if (value === undefined || value === null) return ''
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value.toString()
      })
      csv += row.join(',') + '\n'
    })

    return csv
  }

  private async buildProductivityReport(period: {
    start: number
    end: number
    type: 'day' | 'week' | 'month' | 'quarter' | 'year'
  }): Promise<ProductivityReport> {
    const activities = await this.databaseManager.getActivities({
      startTime: period.start,
      endTime: period.end
    })

    const sessions = await this.databaseManager.getWorkSessions({
      startTime: period.start,
      endTime: period.end
    })

    const insights = await this.databaseManager.getInsights({
      startTime: period.start,
      endTime: period.end
    })

    // Calculate summary metrics
    const totalActiveTime = activities.reduce((sum, a) => sum + (a.isIdle ? 0 : a.duration), 0)
    const productiveTime = activities
      .filter(a => a.productivityRating === 'productive')
      .reduce((sum, a) => sum + a.duration, 0)
    
    const focusScore = activities.length > 0 
      ? activities.reduce((sum, a) => sum + (a.focusScore || 0), 0) / activities.length
      : 0

    // Build report
    return {
      period,
      summary: {
        totalActiveTime,
        productiveTime,
        focusScore,
        topApps: this.calculateTopApps(activities),
        achievements: [], // Would be calculated based on metrics
        improvements: [] // Would be generated based on trends
      },
      analytics: {
        dailyBreakdown: this.calculateDailyBreakdown(activities),
        hourlyPatterns: this.calculateHourlyPatterns(activities),
        categoryBreakdown: this.calculateCategoryBreakdown(activities),
        trends: {
          productivity: 'stable', // Would be calculated from historical data
          focus: 'stable',
          consistency: 'stable'
        }
      },
      insights,
      recommendations: this.generateRecommendations(activities, sessions)
    }
  }

  private calculateTopApps(activities: ActivityRecord[]): Array<{ name: string; time: number; productivity: string }> {
    const appTimes = new Map<string, { time: number; productivity: string }>()
    
    activities.forEach(activity => {
      const existing = appTimes.get(activity.appName) || { time: 0, productivity: 'neutral' }
      existing.time += activity.duration
      existing.productivity = activity.productivityRating || 'neutral'
      appTimes.set(activity.appName, existing)
    })

    return Array.from(appTimes.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.time - a.time)
      .slice(0, 10)
  }

  private calculateDailyBreakdown(activities: ActivityRecord[]): Array<{ date: string; time: number; productivity: number }> {
    const dailyData = new Map<string, { time: number; productivitySum: number; count: number }>()
    
    activities.forEach(activity => {
      const date = new Date(activity.timestamp).toISOString().split('T')[0]
      const existing = dailyData.get(date) || { time: 0, productivitySum: 0, count: 0 }
      
      existing.time += activity.duration
      existing.productivitySum += this.getProductivityScore(activity.productivityRating)
      existing.count += 1
      
      dailyData.set(date, existing)
    })

    return Array.from(dailyData.entries())
      .map(([date, data]) => ({
        date,
        time: data.time,
        productivity: data.count > 0 ? data.productivitySum / data.count : 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  private calculateHourlyPatterns(activities: ActivityRecord[]): Array<{ hour: number; productivity: number }> {
    const hourlyData = new Map<number, { productivitySum: number; count: number }>()
    
    activities.forEach(activity => {
      const hour = new Date(activity.timestamp).getHours()
      const existing = hourlyData.get(hour) || { productivitySum: 0, count: 0 }
      
      existing.productivitySum += this.getProductivityScore(activity.productivityRating)
      existing.count += 1
      
      hourlyData.set(hour, existing)
    })

    const result = []
    for (let hour = 0; hour < 24; hour++) {
      const data = hourlyData.get(hour) || { productivitySum: 0, count: 0 }
      result.push({
        hour,
        productivity: data.count > 0 ? data.productivitySum / data.count : 0
      })
    }

    return result
  }

  private calculateCategoryBreakdown(activities: ActivityRecord[]): Array<{ category: string; time: number; percentage: number }> {
    const categoryTimes = new Map<string, number>()
    let totalTime = 0
    
    activities.forEach(activity => {
      const category = activity.category || 'Uncategorized'
      categoryTimes.set(category, (categoryTimes.get(category) || 0) + activity.duration)
      totalTime += activity.duration
    })

    return Array.from(categoryTimes.entries())
      .map(([category, time]) => ({
        category,
        time,
        percentage: totalTime > 0 ? (time / totalTime) * 100 : 0
      }))
      .sort((a, b) => b.time - a.time)
  }

  private generateRecommendations(activities: ActivityRecord[], sessions: WorkSession[]): string[] {
    const recommendations: string[] = []
    
    // Analyze patterns and generate recommendations
    const avgSessionLength = sessions.length > 0 
      ? sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length
      : 0

    if (avgSessionLength < 30 * 60 * 1000) { // Less than 30 minutes
      recommendations.push('Consider longer focus sessions to improve deep work productivity')
    }

    const distractingTime = activities
      .filter(a => a.productivityRating === 'distracting')
      .reduce((sum, a) => sum + a.duration, 0)
    
    const totalTime = activities.reduce((sum, a) => sum + a.duration, 0)
    
    if (totalTime > 0 && (distractingTime / totalTime) > 0.2) {
      recommendations.push('Reduce time spent on distracting applications to boost productivity')
    }

    return recommendations
  }

  private getProductivityScore(rating?: string): number {
    switch (rating) {
      case 'productive': return 1
      case 'neutral': return 0.5
      case 'distracting': return 0
      default: return 0.5
    }
  }

  private generateHTMLReport(report: ProductivityReport): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Productivity Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 8px; }
        .section { margin: 20px 0; }
        .metric { display: inline-block; margin: 10px; padding: 15px; background: #e9f4ff; border-radius: 5px; }
        .chart { margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Productivity Report</h1>
        <p>Period: ${new Date(report.period.start).toLocaleDateString()} - ${new Date(report.period.end).toLocaleDateString()}</p>
    </div>
    
    <div class="section">
        <h2>Summary</h2>
        <div class="metric">
            <strong>Total Active Time:</strong> ${Math.round(report.summary.totalActiveTime / 1000 / 60)} minutes
        </div>
        <div class="metric">
            <strong>Productive Time:</strong> ${Math.round(report.summary.productiveTime / 1000 / 60)} minutes
        </div>
        <div class="metric">
            <strong>Focus Score:</strong> ${(report.summary.focusScore * 100).toFixed(1)}%
        </div>
    </div>
    
    <div class="section">
        <h2>Top Applications</h2>
        <table>
            <tr><th>Application</th><th>Time (minutes)</th><th>Productivity</th></tr>
            ${report.summary.topApps.map(app => 
              `<tr><td>${app.name}</td><td>${Math.round(app.time / 1000 / 60)}</td><td>${app.productivity}</td></tr>`
            ).join('')}
        </table>
    </div>
    
    <div class="section">
        <h2>Recommendations</h2>
        <ul>
            ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
</body>
</html>
    `
  }

  private async compressDirectory(sourceDir: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(outputPath)
      const archive = archiver('zip', { zlib: { level: 9 } })
      
      output.on('close', resolve)
      archive.on('error', reject)
      
      archive.pipe(output)
      archive.directory(sourceDir, false)
      archive.finalize()
    })
  }

  private async extractArchive(archivePath: string, outputDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      createReadStream(archivePath)
        .pipe(unzipper.Extract({ path: outputDir }))
        .on('close', resolve)
        .on('error', reject)
    })
  }

  private async encryptFile(inputPath: string, outputPath: string, password: string): Promise<void> {
    const algorithm = 'aes-256-cbc'
    const key = crypto.scryptSync(password, 'salt', 32)
    const iv = crypto.randomBytes(16)
    
    const cipher = crypto.createCipher(algorithm, key)
    const input = createReadStream(inputPath)
    const output = createWriteStream(outputPath)
    
    return new Promise((resolve, reject) => {
      output.write(iv)
      input.pipe(cipher).pipe(output)
      output.on('finish', resolve)
      output.on('error', reject)
    })
  }

  private async decryptFile(inputPath: string, outputPath: string, password: string): Promise<void> {
    const algorithm = 'aes-256-cbc'
    const key = crypto.scryptSync(password, 'salt', 32)
    
    const input = createReadStream(inputPath)
    const output = createWriteStream(outputPath)
    
    return new Promise((resolve, reject) => {
      let iv: Buffer
      let decipher: crypto.Decipher
      
      input.once('readable', () => {
        iv = input.read(16)
        decipher = crypto.createDecipher(algorithm, key)
        input.pipe(decipher).pipe(output)
      })
      
      output.on('finish', resolve)
      output.on('error', reject)
    })
  }

  private getDirectorySize(dirPath: string): number {
    const fs = require('fs')
    const path = require('path')
    let size = 0
    
    const files = fs.readdirSync(dirPath)
    files.forEach((file: string) => {
      const filePath = path.join(dirPath, file)
      const stats = fs.statSync(filePath)
      if (stats.isDirectory()) {
        size += this.getDirectorySize(filePath)
      } else {
        size += stats.size
      }
    })
    
    return size
  }

  private validateBackupData(data: any): void {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid backup data format')
    }
    
    // Add validation logic for data structure
    const requiredFields = ['activities']
    for (const field of requiredFields) {
      if (!data[field]) {
        throw new Error(`Missing required field: ${field}`)
      }
    }
  }

  private cleanupOldExports(retentionDays: number): void {
    const fs = require('fs')
    const path = require('path')
    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000)
    
    try {
      const files = fs.readdirSync(this.exportPath)
      files.forEach((file: string) => {
        const filePath = path.join(this.exportPath, file)
        const stats = fs.statSync(filePath)
        if (stats.mtime.getTime() < cutoffTime) {
          fs.unlinkSync(filePath)
        }
      })
    } catch (error) {
      console.error('Failed to cleanup old exports:', error)
    }
  }
}