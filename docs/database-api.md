# Database API Documentation

## Overview

The `DatabaseManager` class provides a comprehensive API for interacting with the Activity Tracker database. This document outlines all available methods, their parameters, return types, and usage examples.

## DatabaseManager Class

### Initialization

```typescript
const dbManager = new DatabaseManager()
await dbManager.initialize()
```

## Core Activity Methods

### saveActivity(record: ActivityRecord): Promise<void>
Saves a new activity record to the database.

**Parameters:**
- `record`: ActivityRecord object containing activity data

**Example:**
```typescript
const activity: ActivityRecord = {
  timestamp: Date.now(),
  appName: 'Visual Studio Code',
  windowTitle: 'database.ts - Activity Tracker',
  duration: 30000,
  idleTime: 0,
  category: 'development',
  productivityScore: 0.9,
  memoryUsage: 512000,
  focusScore: 0.8,
  productivityRating: 4,
  contextSwitches: 2,
  keystrokes: 150,
  mouseClicks: 25
}

await dbManager.saveActivity(activity)
```

### getActivities(options): Promise<ActivityRecord[]>
Retrieves activity records with optional filtering.

**Parameters:**
- `startTime?`: number - Start timestamp filter
- `endTime?`: number - End timestamp filter
- `appName?`: string - Filter by application name
- `category?`: string - Filter by category
- `limit?`: number - Maximum records to return (default: 1000)

**Example:**
```typescript
// Get today's activities
const startOfDay = new Date().setHours(0, 0, 0, 0)
const activities = await dbManager.getActivities({
  startTime: startOfDay,
  endTime: Date.now(),
  limit: 100
})

// Get activities for specific app
const codeActivities = await dbManager.getActivities({
  appName: 'Visual Studio Code'
})
```

## Work Session Methods

### saveWorkSession(session: WorkSession): Promise<void>
Saves a work session record.

**Example:**
```typescript
const session: WorkSession = {
  id: 'session_' + Date.now(),
  startTime: Date.now() - 3600000, // 1 hour ago
  endTime: Date.now(),
  duration: 3600000,
  breakTime: 300000, // 5 minutes
  productivityScore: 0.85,
  focusScore: 0.9,
  interruptions: 3,
  dominantActivity: 'coding',
  sessionType: 'work'
}

await dbManager.saveWorkSession(session)
```

## Work Pattern Analytics

### saveWorkPattern(pattern: WorkPattern): Promise<void>
Saves a detected work pattern.

**Example:**
```typescript
const pattern: WorkPattern = {
  id: 'pattern_morning_coding',
  type: 'routine',
  name: 'Morning Coding Session',
  description: 'High productivity coding in the morning',
  confidence: 0.92,
  frequency: 'daily',
  timeOfDay: { start: '09:00', end: '11:00' },
  dayOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
  associatedApps: ['Visual Studio Code', 'Terminal'],
  productivityImpact: 0.8,
  detectedAt: Date.now(),
  lastSeen: Date.now()
}

await dbManager.saveWorkPattern(pattern)
```

### getWorkPatterns(type?: string): Promise<WorkPattern[]>
Retrieves work patterns, optionally filtered by type.

**Example:**
```typescript
// Get all patterns
const allPatterns = await dbManager.getWorkPatterns()

// Get only routine patterns
const routines = await dbManager.getWorkPatterns('routine')
```

## Productivity Block Methods

### saveProductivityBlock(block: ProductivityBlock): Promise<void>
Saves a productivity block analysis.

**Example:**
```typescript
const block: ProductivityBlock = {
  id: 'block_' + Date.now(),
  startTime: Date.now() - 1800000, // 30 minutes ago
  endTime: Date.now(),
  duration: 1800000,
  type: 'focus',
  focusScore: 0.95,
  dominantActivity: 'coding',
  interruptions: 1,
  contextSwitches: 3,
  productivityRating: 5,
  energyLevel: 'high',
  qualityScore: 0.9
}

await dbManager.saveProductivityBlock(block)
```

### getProductivityBlocks(startTime?: number, endTime?: number): Promise<ProductivityBlock[]>
Retrieves productivity blocks within a time range.

**Example:**
```typescript
// Get today's productivity blocks
const startOfDay = new Date().setHours(0, 0, 0, 0)
const blocks = await dbManager.getProductivityBlocks(startOfDay, Date.now())

// Get last week's blocks
const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
const weeklyBlocks = await dbManager.getProductivityBlocks(weekAgo, Date.now())
```

## Insights and Recommendations

### saveInsight(insight: Insight): Promise<void>
Saves an AI-generated insight or recommendation.

**Example:**
```typescript
const insight: Insight = {
  id: 'insight_' + Date.now(),
  category: 'optimization',
  type: 'focus_improvement',
  title: 'Reduce Context Switching',
  description: 'You switch between applications 15% more than optimal during focus sessions.',
  actionable: true,
  priority: 3,
  confidence: 0.87,
  impact: 'medium',
  timeframe: 'this_week',
  data: {
    currentSwitches: 23,
    optimalSwitches: 20,
    improvementPotential: '15%'
  },
  timestamp: Date.now(),
  expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 1 week
  isDismissed: false
}

await dbManager.saveInsight(insight)
```

### getInsights(category?: string, limit?: number): Promise<Insight[]>
Retrieves active insights, optionally filtered by category.

**Example:**
```typescript
// Get all active insights
const insights = await dbManager.getInsights()

// Get optimization insights only
const optimizations = await dbManager.getInsights('optimization', 5)
```

## User Preferences

### saveUserPreference(key: string, value: any, type?: string): Promise<void>
Saves a user preference setting.

**Example:**
```typescript
// Save string preference
await dbManager.saveUserPreference('theme', 'dark', 'string')

// Save number preference
await dbManager.saveUserPreference('trackingInterval', 30, 'number')

// Save boolean preference
await dbManager.saveUserPreference('enableScreenshots', false, 'boolean')

// Save JSON preference
await dbManager.saveUserPreference('dashboardLayout', {
  widgets: ['productivity', 'apps', 'insights'],
  columns: 3
}, 'json')
```

### getUserPreference(key: string): Promise<any>
Retrieves a specific user preference.

**Example:**
```typescript
const theme = await dbManager.getUserPreference('theme')
const interval = await dbManager.getUserPreference('trackingInterval')
const layout = await dbManager.getUserPreference('dashboardLayout')
```

### getAllUserPreferences(): Promise<Record<string, any>>
Retrieves all user preferences as a key-value object.

**Example:**
```typescript
const allPrefs = await dbManager.getAllUserPreferences()
console.log(allPrefs.theme) // 'dark'
console.log(allPrefs.trackingInterval) // 30
```

## Dashboard and Analytics

### getDashboardData(): Promise<DashboardData>
Retrieves basic dashboard data including today's stats and top applications.

**Example:**
```typescript
const dashboard = await dbManager.getDashboardData()
console.log(dashboard.todayStats.totalTime)
console.log(dashboard.topApps)
```

### getEnhancedDashboardData(): Promise<EnhancedDashboardData>
Retrieves comprehensive dashboard data with patterns, blocks, and trends.

**Example:**
```typescript
const enhanced = await dbManager.getEnhancedDashboardData()
console.log(enhanced.patterns) // Work patterns
console.log(enhanced.productivityBlocks) // Today's blocks
console.log(enhanced.recommendations) // AI insights
console.log(enhanced.weeklyComparison) // Week-over-week comparison
```

## Screenshot Management

### saveScreenshot(record: ScreenshotRecord): Promise<void>
Saves screenshot metadata.

**Example:**
```typescript
const screenshot: ScreenshotRecord = {
  timestamp: Date.now(),
  filePath: '/screenshots/2024-01-15_14-30-00.png',
  appName: 'Visual Studio Code',
  windowTitle: 'database.ts',
  fileSize: 1024000
}

await dbManager.saveScreenshot(screenshot)
```

## Application Categories

### saveAppCategory(category: AppCategory): Promise<void>
Saves application category configuration.

**Example:**
```typescript
const category: AppCategory = {
  appName: 'Visual Studio Code',
  category: 'development',
  productivityWeight: 0.9,
  isWorkRelated: true,
  customRules: {
    timeOfDay: 'work_hours',
    projectContext: 'coding'
  },
  createdAt: Date.now(),
  updatedAt: Date.now()
}

await dbManager.saveAppCategory(category)
```

### getAppCategories(): Promise<AppCategory[]>
Retrieves all application categories.

**Example:**
```typescript
const categories = await dbManager.getAppCategories()
const devApps = categories.filter(cat => cat.category === 'development')
```

## Migration System

### getCurrentMigrationVersion(): Promise<number>
Returns the current database schema version.

**Example:**
```typescript
const version = await dbManager.getCurrentMigrationVersion()
console.log(`Database version: ${version}`)
```

## Database Lifecycle

### initialize(): Promise<void>
Initializes the database, creates tables, and runs migrations.

**Example:**
```typescript
const dbManager = new DatabaseManager()
try {
  await dbManager.initialize()
  console.log('Database initialized successfully')
} catch (error) {
  console.error('Database initialization failed:', error)
}
```

### close(): void
Closes the database connection.

**Example:**
```typescript
dbManager.close()
```

## Error Handling

All async methods can throw errors. Always use try-catch blocks:

```typescript
try {
  await dbManager.saveActivity(activity)
} catch (error) {
  console.error('Failed to save activity:', error)
  // Handle error appropriately
}
```

## Performance Tips

1. **Batch Operations**: For multiple records, consider using transactions
2. **Limit Results**: Always use appropriate limits for large datasets
3. **Index Usage**: Queries on timestamp, app_name, and category are optimized
4. **Connection Management**: Reuse the same DatabaseManager instance

## Common Query Patterns

### Daily Productivity Summary
```typescript
const startOfDay = new Date().setHours(0, 0, 0, 0)
const activities = await dbManager.getActivities({
  startTime: startOfDay,
  endTime: Date.now()
})

const totalTime = activities.reduce((sum, act) => sum + act.duration, 0)
const avgProductivity = activities.reduce((sum, act) => sum + act.productivityScore, 0) / activities.length
```

### Weekly Trend Analysis
```typescript
const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
const weeklyBlocks = await dbManager.getProductivityBlocks(weekAgo, Date.now())

const dailyProductivity = weeklyBlocks.reduce((acc, block) => {
  const day = new Date(block.startTime).toDateString()
  if (!acc[day]) acc[day] = []
  acc[day].push(block.focusScore)
  return acc
}, {})
```

### Application Usage Analysis
```typescript
const activities = await dbManager.getActivities({ limit: 1000 })
const appUsage = activities.reduce((acc, act) => {
  if (!acc[act.appName]) {
    acc[act.appName] = { time: 0, productivity: 0, count: 0 }
  }
  acc[act.appName].time += act.duration
  acc[act.appName].productivity += act.productivityScore
  acc[act.appName].count += 1
  return acc
}, {})

// Calculate averages
Object.keys(appUsage).forEach(app => {
  appUsage[app].avgProductivity = appUsage[app].productivity / appUsage[app].count
})
```