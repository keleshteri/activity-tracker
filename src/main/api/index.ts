import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { v4 as uuidv4 } from 'uuid'
import { DatabaseManager } from '../database'
import { ExportManager } from '../export'
import {
  ActivityRecord,
  ProductivityMetrics,
  WorkSession,
  DashboardData,
  AppCategory,
  ProductivityInsight
} from '../types'

export interface APIConfig {
  port: number
  jwtSecret: string
  enableCors: boolean
  rateLimit: {
    windowMs: number
    max: number
  }
  webhooks: {
    enabled: boolean
    endpoints: WebhookEndpoint[]
  }
}

export interface WebhookEndpoint {
  id: string
  url: string
  events: WebhookEvent[]
  secret?: string
  active: boolean
  retryAttempts: number
  timeout: number
}

export type WebhookEvent = 
  | 'activity.created'
  | 'session.started'
  | 'session.ended'
  | 'productivity.threshold'
  | 'focus.session.completed'
  | 'break.reminder'
  | 'daily.summary'

export interface WebhookPayload {
  id: string
  event: WebhookEvent
  timestamp: number
  data: any
  signature?: string
}

export interface APIKey {
  id: string
  name: string
  key: string
  hashedKey: string
  permissions: APIPermission[]
  createdAt: number
  lastUsed?: number
  expiresAt?: number
  active: boolean
}

export type APIPermission = 
  | 'read:activities'
  | 'read:sessions'
  | 'read:metrics'
  | 'read:insights'
  | 'write:categories'
  | 'write:config'
  | 'admin:all'

export interface AuthenticatedRequest extends Request {
  apiKey?: APIKey
  user?: {
    id: string
    permissions: APIPermission[]
  }
}

export class IntegrationAPI {
  private app: express.Application
  private server: any
  private databaseManager: DatabaseManager
  private exportManager: ExportManager
  private config: APIConfig
  private apiKeys: Map<string, APIKey> = new Map()
  private webhookQueue: WebhookPayload[] = []
  private isProcessingWebhooks = false

  constructor(
    databaseManager: DatabaseManager,
    exportManager: ExportManager,
    config: APIConfig
  ) {
    this.databaseManager = databaseManager
    this.exportManager = exportManager
    this.config = config
    this.app = express()
    this.setupMiddleware()
    this.setupRoutes()
    this.loadAPIKeys()
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet())
    
    // CORS
    if (this.config.enableCors) {
      this.app.use(cors({
        origin: true,
        credentials: true
      }))
    }

    // Rate limiting
    const limiter = rateLimit({
      windowMs: this.config.rateLimit.windowMs,
      max: this.config.rateLimit.max,
      message: {
        error: 'Too many requests',
        retryAfter: this.config.rateLimit.windowMs / 1000
      }
    })
    this.app.use('/api/', limiter)

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }))
    this.app.use(express.urlencoded({ extended: true }))

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} ${req.method} ${req.path}`)
      next()
    })
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: Date.now() })
    })

    // API documentation
    this.app.get('/api/docs', (req, res) => {
      res.json(this.generateAPIDocumentation())
    })

    // Authentication routes
    this.app.post('/api/auth/keys', this.authenticateAdmin.bind(this), this.createAPIKey.bind(this))
    this.app.get('/api/auth/keys', this.authenticateAdmin.bind(this), this.listAPIKeys.bind(this))
    this.app.delete('/api/auth/keys/:keyId', this.authenticateAdmin.bind(this), this.revokeAPIKey.bind(this))

    // Data access routes (require authentication)
    this.app.get('/api/activities', this.authenticate.bind(this), this.getActivities.bind(this))
    this.app.get('/api/activities/export', this.authenticate.bind(this), this.exportActivities.bind(this))
    this.app.get('/api/sessions', this.authenticate.bind(this), this.getSessions.bind(this))
    this.app.get('/api/metrics', this.authenticate.bind(this), this.getMetrics.bind(this))
    this.app.get('/api/insights', this.authenticate.bind(this), this.getInsights.bind(this))
    this.app.get('/api/dashboard', this.authenticate.bind(this), this.getDashboard.bind(this))
    this.app.get('/api/categories', this.authenticate.bind(this), this.getCategories.bind(this))
    
    // Configuration routes
    this.app.get('/api/config', this.authenticate.bind(this), this.getConfig.bind(this))
    this.app.put('/api/config', this.authenticate.bind(this), this.updateConfig.bind(this))

    // Webhook management
    this.app.get('/api/webhooks', this.authenticateAdmin.bind(this), this.getWebhooks.bind(this))
    this.app.post('/api/webhooks', this.authenticateAdmin.bind(this), this.createWebhook.bind(this))
    this.app.put('/api/webhooks/:webhookId', this.authenticateAdmin.bind(this), this.updateWebhook.bind(this))
    this.app.delete('/api/webhooks/:webhookId', this.authenticateAdmin.bind(this), this.deleteWebhook.bind(this))
    this.app.post('/api/webhooks/:webhookId/test', this.authenticateAdmin.bind(this), this.testWebhook.bind(this))

    // Real-time data endpoints
    this.app.get('/api/realtime/current', this.authenticate.bind(this), this.getCurrentActivity.bind(this))
    this.app.get('/api/realtime/status', this.authenticate.bind(this), this.getSystemStatus.bind(this))

    // Error handling
    this.app.use(this.errorHandler.bind(this))
  }

  // Authentication middleware
  private async authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid authorization header' })
        return
      }

      const token = authHeader.substring(7)
      const apiKey = this.apiKeys.get(token)
      
      if (!apiKey || !apiKey.active) {
        res.status(401).json({ error: 'Invalid or inactive API key' })
        return
      }

      if (apiKey.expiresAt && apiKey.expiresAt < Date.now()) {
        res.status(401).json({ error: 'API key expired' })
        return
      }

      // Update last used timestamp
      apiKey.lastUsed = Date.now()
      
      req.apiKey = apiKey
      req.user = {
        id: apiKey.id,
        permissions: apiKey.permissions
      }

      next()
    } catch (error) {
      res.status(401).json({ error: 'Authentication failed' })
    }
  }

  private async authenticateAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    await this.authenticate(req, res, () => {
      if (!req.user?.permissions.includes('admin:all')) {
        res.status(403).json({ error: 'Admin privileges required' })
        return
      }
      next()
    })
  }

  private checkPermission(permission: APIPermission) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user?.permissions.includes(permission) && !req.user?.permissions.includes('admin:all')) {
        res.status(403).json({ error: `Permission required: ${permission}` })
        return
      }
      next()
    }
  }

  // API Key management
  private async createAPIKey(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { name, permissions, expiresIn } = req.body
      
      if (!name || !permissions || !Array.isArray(permissions)) {
        res.status(400).json({ error: 'Name and permissions are required' })
        return
      }

      const key = uuidv4()
      const hashedKey = await bcrypt.hash(key, 10)
      
      const apiKey: APIKey = {
        id: uuidv4(),
        name,
        key,
        hashedKey,
        permissions,
        createdAt: Date.now(),
        expiresAt: expiresIn ? Date.now() + expiresIn : undefined,
        active: true
      }

      this.apiKeys.set(key, apiKey)
      await this.saveAPIKeys()

      // Return key without the actual key value for security
      const { key: _, hashedKey: __, ...safeApiKey } = apiKey
      res.json({ 
        ...safeApiKey,
        key: key // Only return the key once during creation
      })
    } catch (error) {
      res.status(500).json({ error: 'Failed to create API key' })
    }
  }

  private async listAPIKeys(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const keys = Array.from(this.apiKeys.values()).map(({ key, hashedKey, ...apiKey }) => apiKey)
      res.json({ keys })
    } catch (error) {
      res.status(500).json({ error: 'Failed to list API keys' })
    }
  }

  private async revokeAPIKey(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { keyId } = req.params
      
      let found = false
      for (const [key, apiKey] of this.apiKeys.entries()) {
        if (apiKey.id === keyId) {
          this.apiKeys.delete(key)
          found = true
          break
        }
      }

      if (!found) {
        res.status(404).json({ error: 'API key not found' })
        return
      }

      await this.saveAPIKeys()
      res.json({ message: 'API key revoked successfully' })
    } catch (error) {
      res.status(500).json({ error: 'Failed to revoke API key' })
    }
  }

  // Data endpoints
  private async getActivities(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.permissions.includes('read:activities')) {
        res.status(403).json({ error: 'Permission required: read:activities' })
        return
      }

      const {
        startTime,
        endTime,
        appNames,
        categories,
        limit = 100,
        offset = 0
      } = req.query

      const activities = await this.databaseManager.getActivities({
        startTime: startTime ? parseInt(startTime as string) : undefined,
        endTime: endTime ? parseInt(endTime as string) : undefined,
        appNames: appNames ? (appNames as string).split(',') : undefined,
        categories: categories ? (categories as string).split(',') : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      })

      res.json({
        activities,
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          total: activities.length
        }
      })
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch activities' })
    }
  }

  private async exportActivities(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.permissions.includes('read:activities')) {
        res.status(403).json({ error: 'Permission required: read:activities' })
        return
      }

      const {
        format = 'json',
        startDate,
        endDate,
        appNames,
        categories,
        includeScreenshots = false
      } = req.query

      const filters = {
        format: format as 'json' | 'csv',
        startDate: startDate ? parseInt(startDate as string) : undefined,
        endDate: endDate ? parseInt(endDate as string) : undefined,
        appNames: appNames ? (appNames as string).split(',') : undefined,
        categories: categories ? (categories as string).split(',') : undefined,
        includeScreenshots: includeScreenshots === 'true'
      }

      let result
      if (format === 'csv') {
        result = await this.exportManager.exportToCSV(filters)
      } else {
        result = await this.exportManager.exportToJSON(filters)
      }

      if (!result.success) {
        res.status(500).json({ error: result.error })
        return
      }

      res.json({
        success: true,
        downloadUrl: `/api/downloads/${result.filePath?.split('/').pop()}`,
        recordCount: result.recordCount,
        fileSize: result.fileSize
      })
    } catch (error) {
      res.status(500).json({ error: 'Failed to export activities' })
    }
  }

  private async getSessions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.permissions.includes('read:sessions')) {
        res.status(403).json({ error: 'Permission required: read:sessions' })
        return
      }

      const { startTime, endTime, limit = 50, offset = 0 } = req.query

      const sessions = await this.databaseManager.getWorkSessions({
        startTime: startTime ? parseInt(startTime as string) : undefined,
        endTime: endTime ? parseInt(endTime as string) : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      })

      res.json({ sessions })
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch sessions' })
    }
  }

  private async getMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.permissions.includes('read:metrics')) {
        res.status(403).json({ error: 'Permission required: read:metrics' })
        return
      }

      const { startDate, endDate, granularity = 'day' } = req.query

      const metrics = await this.databaseManager.getProductivityMetrics({
        startDate: startDate as string,
        endDate: endDate as string,
        granularity: granularity as 'hour' | 'day' | 'week' | 'month'
      })

      res.json({ metrics })
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch metrics' })
    }
  }

  private async getInsights(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.permissions.includes('read:insights')) {
        res.status(403).json({ error: 'Permission required: read:insights' })
        return
      }

      const { startTime, endTime, type } = req.query

      const insights = await this.databaseManager.getInsights({
        startTime: startTime ? parseInt(startTime as string) : undefined,
        endTime: endTime ? parseInt(endTime as string) : undefined,
        type: type as string
      })

      res.json({ insights })
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch insights' })
    }
  }

  private async getDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const dashboard = await this.databaseManager.getDashboardData()
      res.json({ dashboard })
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch dashboard data' })
    }
  }

  private async getCategories(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const categories = await this.databaseManager.getAppCategories()
      res.json({ categories })
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch categories' })
    }
  }

  private async getConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const config = await this.databaseManager.getConfig()
      res.json({ config })
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch config' })
    }
  }

  private async updateConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.permissions.includes('write:config')) {
        res.status(403).json({ error: 'Permission required: write:config' })
        return
      }

      const { config } = req.body
      await this.databaseManager.updateConfig(config)
      res.json({ message: 'Config updated successfully' })
    } catch (error) {
      res.status(500).json({ error: 'Failed to update config' })
    }
  }

  private async getCurrentActivity(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentActivity = await this.databaseManager.getCurrentActivity()
      res.json({ currentActivity })
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch current activity' })
    }
  }

  private async getSystemStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const status = {
        isTracking: true, // Would get from tracker
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        timestamp: Date.now()
      }
      res.json({ status })
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch system status' })
    }
  }

  // Webhook management
  private async getWebhooks(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      res.json({ webhooks: this.config.webhooks.endpoints })
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch webhooks' })
    }
  }

  private async createWebhook(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { url, events, secret, retryAttempts = 3, timeout = 5000 } = req.body
      
      if (!url || !events || !Array.isArray(events)) {
        res.status(400).json({ error: 'URL and events are required' })
        return
      }

      const webhook: WebhookEndpoint = {
        id: uuidv4(),
        url,
        events,
        secret,
        active: true,
        retryAttempts,
        timeout
      }

      this.config.webhooks.endpoints.push(webhook)
      await this.saveConfig()

      res.json({ webhook })
    } catch (error) {
      res.status(500).json({ error: 'Failed to create webhook' })
    }
  }

  private async updateWebhook(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { webhookId } = req.params
      const updates = req.body

      const webhookIndex = this.config.webhooks.endpoints.findIndex(w => w.id === webhookId)
      if (webhookIndex === -1) {
        res.status(404).json({ error: 'Webhook not found' })
        return
      }

      this.config.webhooks.endpoints[webhookIndex] = {
        ...this.config.webhooks.endpoints[webhookIndex],
        ...updates
      }

      await this.saveConfig()
      res.json({ webhook: this.config.webhooks.endpoints[webhookIndex] })
    } catch (error) {
      res.status(500).json({ error: 'Failed to update webhook' })
    }
  }

  private async deleteWebhook(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { webhookId } = req.params
      
      const webhookIndex = this.config.webhooks.endpoints.findIndex(w => w.id === webhookId)
      if (webhookIndex === -1) {
        res.status(404).json({ error: 'Webhook not found' })
        return
      }

      this.config.webhooks.endpoints.splice(webhookIndex, 1)
      await this.saveConfig()

      res.json({ message: 'Webhook deleted successfully' })
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete webhook' })
    }
  }

  private async testWebhook(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { webhookId } = req.params
      
      const webhook = this.config.webhooks.endpoints.find(w => w.id === webhookId)
      if (!webhook) {
        res.status(404).json({ error: 'Webhook not found' })
        return
      }

      const testPayload: WebhookPayload = {
        id: uuidv4(),
        event: 'activity.created',
        timestamp: Date.now(),
        data: {
          test: true,
          message: 'This is a test webhook payload'
        }
      }

      const success = await this.sendWebhook(webhook, testPayload)
      res.json({ success, message: success ? 'Webhook test successful' : 'Webhook test failed' })
    } catch (error) {
      res.status(500).json({ error: 'Failed to test webhook' })
    }
  }

  // Webhook processing
  public async triggerWebhook(event: WebhookEvent, data: any): Promise<void> {
    if (!this.config.webhooks.enabled) return

    const payload: WebhookPayload = {
      id: uuidv4(),
      event,
      timestamp: Date.now(),
      data
    }

    this.webhookQueue.push(payload)
    this.processWebhookQueue()
  }

  private async processWebhookQueue(): Promise<void> {
    if (this.isProcessingWebhooks || this.webhookQueue.length === 0) return

    this.isProcessingWebhooks = true

    while (this.webhookQueue.length > 0) {
      const payload = this.webhookQueue.shift()!
      const relevantWebhooks = this.config.webhooks.endpoints.filter(
        webhook => webhook.active && webhook.events.includes(payload.event)
      )

      await Promise.all(
        relevantWebhooks.map(webhook => this.sendWebhook(webhook, payload))
      )
    }

    this.isProcessingWebhooks = false
  }

  private async sendWebhook(webhook: WebhookEndpoint, payload: WebhookPayload): Promise<boolean> {
    try {
      // Add signature if secret is provided
      if (webhook.secret) {
        const crypto = require('crypto')
        const signature = crypto
          .createHmac('sha256', webhook.secret)
          .update(JSON.stringify(payload))
          .digest('hex')
        payload.signature = `sha256=${signature}`
      }

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ActivityTracker-Webhook/1.0',
          ...(payload.signature && { 'X-Signature': payload.signature })
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(webhook.timeout)
      })

      return response.ok
    } catch (error) {
      console.error(`Webhook delivery failed for ${webhook.url}:`, error)
      return false
    }
  }

  // Utility methods
  private generateAPIDocumentation(): any {
    return {
      version: '1.0.0',
      title: 'Activity Tracker API',
      description: 'REST API for accessing productivity data and managing integrations',
      baseUrl: `http://localhost:${this.config.port}/api`,
      authentication: {
        type: 'Bearer Token',
        description: 'Use API key as Bearer token in Authorization header'
      },
      endpoints: {
        'GET /activities': {
          description: 'Retrieve activity records',
          permissions: ['read:activities'],
          parameters: {
            startTime: 'number (timestamp)',
            endTime: 'number (timestamp)',
            appNames: 'string (comma-separated)',
            categories: 'string (comma-separated)',
            limit: 'number (default: 100)',
            offset: 'number (default: 0)'
          }
        },
        'GET /sessions': {
          description: 'Retrieve work sessions',
          permissions: ['read:sessions']
        },
        'GET /metrics': {
          description: 'Retrieve productivity metrics',
          permissions: ['read:metrics']
        },
        'GET /insights': {
          description: 'Retrieve productivity insights',
          permissions: ['read:insights']
        },
        'POST /webhooks': {
          description: 'Create webhook endpoint',
          permissions: ['admin:all']
        }
      },
      webhooks: {
        events: [
          'activity.created',
          'session.started',
          'session.ended',
          'productivity.threshold',
          'focus.session.completed',
          'break.reminder',
          'daily.summary'
        ]
      }
    }
  }

  private errorHandler(error: any, req: Request, res: Response, next: NextFunction): void {
    console.error('API Error:', error)
    
    if (res.headersSent) {
      return next(error)
    }

    res.status(500).json({
      error: 'Internal server error',
      timestamp: Date.now(),
      path: req.path
    })
  }

  private async loadAPIKeys(): Promise<void> {
    try {
      const fs = require('fs')
      const path = require('path')
      const { app } = require('electron')
      
      const keysPath = path.join(app.getPath('userData'), 'api-keys.json')
      if (fs.existsSync(keysPath)) {
        const data = JSON.parse(fs.readFileSync(keysPath, 'utf8'))
        data.forEach((keyData: any) => {
          this.apiKeys.set(keyData.key, keyData)
        })
      }
    } catch (error) {
      console.error('Failed to load API keys:', error)
    }
  }

  private async saveAPIKeys(): Promise<void> {
    try {
      const fs = require('fs')
      const path = require('path')
      const { app } = require('electron')
      
      const keysPath = path.join(app.getPath('userData'), 'api-keys.json')
      const keysData = Array.from(this.apiKeys.values())
      fs.writeFileSync(keysPath, JSON.stringify(keysData, null, 2))
    } catch (error) {
      console.error('Failed to save API keys:', error)
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      const fs = require('fs')
      const path = require('path')
      const { app } = require('electron')
      
      const configPath = path.join(app.getPath('userData'), 'api-config.json')
      fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2))
    } catch (error) {
      console.error('Failed to save API config:', error)
    }
  }

  // Server management
  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, () => {
          console.log(`Integration API server started on port ${this.config.port}`)
          resolve()
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('Integration API server stopped')
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  public getPort(): number {
    return this.config.port
  }

  public isRunning(): boolean {
    return !!this.server && this.server.listening
  }
}

// Default configuration
export const defaultAPIConfig: APIConfig = {
  port: 3001,
  jwtSecret: 'your-secret-key-change-this',
  enableCors: true,
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // requests per window
  },
  webhooks: {
    enabled: true,
    endpoints: []
  }
}