# Activity Tracker Database Schema Documentation

## Overview

The Activity Tracker application uses SQLite database to store user activity data, productivity metrics, and analytics. The database schema is designed to support comprehensive activity tracking, pattern recognition, and productivity insights.

## Database Migration System

The application implements a robust migration system to handle schema updates while preserving existing data:

- **migrations** table: Tracks applied migrations with checksums
- **migration_state** table: Stores current database version
- **Current Version**: 2

## Core Tables

### 1. activities
**Purpose**: Primary table storing all user activity records

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Unique activity record identifier |
| timestamp | INTEGER | Unix timestamp when activity was recorded |
| app_name | TEXT | Name of the active application |
| window_title | TEXT | Title of the active window |
| duration | INTEGER | Duration of activity in milliseconds |
| idle_time | INTEGER | Idle time before this activity |
| category | TEXT | Application category (productivity, entertainment, etc.) |
| productivity_score | REAL | Calculated productivity score (0-1) |
| memory_usage | INTEGER | Memory usage of the application |
| focus_score | REAL | Focus score based on activity patterns |
| productivity_rating | INTEGER | User or system productivity rating (1-5) |
| context_switches | INTEGER | Number of context switches during activity |
| keystrokes | INTEGER | Number of keystrokes recorded |
| mouse_clicks | INTEGER | Number of mouse clicks recorded |

**Use Cases**:
- Track user activity across applications
- Calculate productivity metrics
- Generate time-based reports
- Analyze application usage patterns

**Indexes**:
- `idx_activities_timestamp`: Fast time-based queries
- `idx_activities_app_name`: Application-specific analytics
- `idx_activities_category`: Category-based filtering

### 2. screenshots
**Purpose**: Store screenshot metadata for visual activity tracking

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Unique screenshot identifier |
| timestamp | INTEGER | When screenshot was taken |
| file_path | TEXT | Path to screenshot file |
| app_name | TEXT | Active application when screenshot taken |
| window_title | TEXT | Active window title |
| file_size | INTEGER | Screenshot file size in bytes |

**Use Cases**:
- Visual activity verification
- Compliance and monitoring
- Activity context reconstruction

**Indexes**:
- `idx_screenshots_timestamp`: Time-based screenshot retrieval

### 3. work_sessions
**Purpose**: Track distinct work sessions and breaks

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Unique session identifier |
| start_time | INTEGER | Session start timestamp |
| end_time | INTEGER | Session end timestamp |
| duration | INTEGER | Total session duration |
| break_time | INTEGER | Total break time during session |
| productivity_score | REAL | Overall session productivity |
| focus_score | REAL | Session focus rating |
| interruptions | INTEGER | Number of interruptions |
| dominant_activity | TEXT | Most frequent activity type |
| session_type | TEXT | Type of session (work, break, etc.) |

**Use Cases**:
- Session-based productivity analysis
- Break pattern optimization
- Work-life balance tracking

**Indexes**:
- `idx_work_sessions_start_time`: Session timeline queries

## Analytics Tables

### 4. work_patterns
**Purpose**: Store detected work patterns and habits

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | Unique pattern identifier |
| type | TEXT | Pattern type (routine, habit, anomaly) |
| name | TEXT | Human-readable pattern name |
| description | TEXT | Detailed pattern description |
| confidence | REAL | Pattern detection confidence (0-1) |
| frequency | TEXT | How often pattern occurs |
| time_of_day_start | TEXT | Typical start time |
| time_of_day_end | TEXT | Typical end time |
| day_of_week | TEXT | JSON array of applicable days |
| associated_apps | TEXT | JSON array of related applications |
| productivity_impact | REAL | Impact on productivity (-1 to 1) |
| detected_at | INTEGER | When pattern was first detected |
| last_seen | INTEGER | Most recent pattern occurrence |

**Use Cases**:
- Identify productive work patterns
- Detect productivity blockers
- Personalized recommendations
- Habit formation tracking

**Indexes**:
- `idx_work_patterns_type`: Pattern type filtering
- `idx_work_patterns_confidence`: High-confidence patterns

### 5. productivity_blocks
**Purpose**: Time-based productivity analysis blocks

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | Unique block identifier |
| start_time | INTEGER | Block start timestamp |
| end_time | INTEGER | Block end timestamp |
| duration | INTEGER | Block duration in milliseconds |
| type | TEXT | Block type (focus, distraction, break) |
| focus_score | REAL | Focus level during block (0-1) |
| dominant_activity | TEXT | Primary activity during block |
| interruptions | INTEGER | Number of interruptions |
| context_switches | INTEGER | Application context switches |
| productivity_rating | INTEGER | Productivity rating (1-5) |
| energy_level | TEXT | Energy level (low, medium, high) |
| quality_score | REAL | Overall block quality (0-1) |

**Use Cases**:
- Detailed productivity timeline
- Focus session optimization
- Distraction pattern analysis
- Energy level correlation

**Indexes**:
- `idx_productivity_blocks_start_time`: Time-based analysis
- `idx_productivity_blocks_type`: Block type filtering

### 6. insights
**Purpose**: AI-generated productivity insights and recommendations

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | Unique insight identifier |
| category | TEXT | Insight category (optimization, warning, etc.) |
| type | TEXT | Specific insight type |
| title | TEXT | Insight title |
| description | TEXT | Detailed insight description |
| actionable | INTEGER | Whether insight has actionable steps |
| priority | INTEGER | Insight priority (1-5) |
| confidence | REAL | Confidence in insight accuracy (0-1) |
| impact | TEXT | Expected impact level |
| timeframe | TEXT | Relevant timeframe |
| data | TEXT | JSON data supporting insight |
| timestamp | INTEGER | When insight was generated |
| expires_at | INTEGER | When insight expires |
| is_dismissed | INTEGER | Whether user dismissed insight |

**Use Cases**:
- Personalized productivity recommendations
- Automated coaching
- Performance optimization
- Behavioral insights

**Indexes**:
- `idx_insights_category`: Category-based filtering
- `idx_insights_priority`: High-priority insights
- `idx_insights_timestamp`: Recent insights

## Configuration Tables

### 7. app_categories
**Purpose**: Application categorization for productivity analysis

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Unique category identifier |
| app_name | TEXT | Application name |
| category | TEXT | Productivity category |
| productivity_weight | REAL | Productivity weight (-1 to 1) |
| is_work_related | INTEGER | Whether app is work-related |
| custom_rules | TEXT | JSON custom categorization rules |
| created_at | INTEGER | Category creation timestamp |
| updated_at | INTEGER | Last update timestamp |

**Use Cases**:
- Automatic activity categorization
- Productivity scoring
- Custom workflow definitions

### 8. user_preferences
**Purpose**: Store user configuration and preferences

| Column | Type | Description |
|--------|------|-------------|
| key | TEXT PRIMARY KEY | Preference key |
| value | TEXT | Preference value (serialized) |
| type | TEXT | Value type (string, number, boolean, json) |
| updated_at | INTEGER | Last update timestamp |

**Use Cases**:
- Application configuration
- User customization
- Feature toggles
- Personalization settings

## Legacy/Additional Tables

### 9. productivity_metrics
**Purpose**: Historical productivity metrics storage

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Unique metric identifier |
| date | TEXT | Date in YYYY-MM-DD format |
| total_time | INTEGER | Total tracked time |
| productive_time | INTEGER | Time spent on productive activities |
| distraction_time | INTEGER | Time spent on distractions |
| focus_sessions | INTEGER | Number of focus sessions |
| break_sessions | INTEGER | Number of breaks |
| productivity_score | REAL | Daily productivity score |
| top_apps | TEXT | JSON array of most used apps |
| created_at | INTEGER | Record creation timestamp |

### 10. break_patterns
**Purpose**: Break behavior analysis

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Unique pattern identifier |
| user_id | TEXT | User identifier |
| break_type | TEXT | Type of break |
| average_duration | INTEGER | Average break duration |
| frequency | INTEGER | Break frequency per day |
| optimal_timing | TEXT | Optimal break timing |
| effectiveness_score | REAL | Break effectiveness rating |
| created_at | INTEGER | Pattern creation timestamp |
| updated_at | INTEGER | Last update timestamp |

### 11. focus_sessions
**Purpose**: Deep work session tracking

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Unique session identifier |
| start_time | INTEGER | Session start timestamp |
| end_time | INTEGER | Session end timestamp |
| duration | INTEGER | Session duration |
| quality_score | REAL | Session quality rating |
| interruptions | INTEGER | Number of interruptions |
| apps_used | TEXT | JSON array of applications used |
| productivity_rating | INTEGER | User productivity rating |
| notes | TEXT | Optional session notes |
| created_at | INTEGER | Record creation timestamp |

### 12. privacy_settings
**Purpose**: Privacy and data handling preferences

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Unique setting identifier |
| setting_key | TEXT | Privacy setting key |
| setting_value | TEXT | Setting value |
| description | TEXT | Setting description |
| is_enabled | INTEGER | Whether setting is enabled |
| created_at | INTEGER | Setting creation timestamp |
| updated_at | INTEGER | Last update timestamp |

### 13. system_metrics
**Purpose**: System performance and resource usage

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Unique metric identifier |
| timestamp | INTEGER | Measurement timestamp |
| cpu_usage | REAL | CPU usage percentage |
| memory_usage | REAL | Memory usage percentage |
| disk_usage | REAL | Disk usage percentage |
| network_activity | INTEGER | Network activity level |
| battery_level | INTEGER | Battery percentage (laptops) |
| screen_time | INTEGER | Active screen time |
| created_at | INTEGER | Record creation timestamp |

### 14. productivity_insights
**Purpose**: Legacy insights table (superseded by insights)

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Unique insight identifier |
| insight_type | TEXT | Type of insight |
| title | TEXT | Insight title |
| description | TEXT | Insight description |
| data | TEXT | JSON insight data |
| priority | INTEGER | Insight priority |
| created_at | INTEGER | Creation timestamp |
| expires_at | INTEGER | Expiration timestamp |
| is_read | INTEGER | Whether insight was read |

## Migration Tables

### 15. migrations
**Purpose**: Track applied database migrations

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | Migration identifier |
| name | TEXT | Migration name |
| checksum | TEXT | Migration content checksum |
| applied_at | INTEGER | When migration was applied |

### 16. migration_state
**Purpose**: Store current database version

| Column | Type | Description |
|--------|------|-------------|
| version | INTEGER PRIMARY KEY | Database version number |
| updated_at | INTEGER | Last update timestamp |

## Relationships and Data Flow

### Primary Data Flow
1. **activities** ← Core activity tracking
2. **work_sessions** ← Aggregated from activities
3. **productivity_blocks** ← Analyzed from activities and sessions
4. **work_patterns** ← Detected from historical data
5. **insights** ← Generated from patterns and blocks

### Key Relationships
- Activities feed into work sessions and productivity blocks
- Work patterns are derived from activity history
- Insights are generated from patterns and productivity data
- App categories influence productivity scoring
- User preferences control behavior and analysis

## Query Patterns

### Common Analytics Queries
```sql
-- Daily productivity summary
SELECT 
  DATE(timestamp/1000, 'unixepoch') as date,
  SUM(duration) as total_time,
  AVG(productivity_score) as avg_productivity
FROM activities 
WHERE timestamp >= ? AND timestamp <= ?
GROUP BY date;

-- Top productive applications
SELECT 
  app_name,
  SUM(duration) as total_time,
  AVG(productivity_score) as avg_productivity
FROM activities 
WHERE productivity_score > 0.7
GROUP BY app_name
ORDER BY total_time DESC;

-- Focus session analysis
SELECT 
  type,
  AVG(duration) as avg_duration,
  AVG(focus_score) as avg_focus,
  COUNT(*) as session_count
FROM productivity_blocks
WHERE type = 'focus'
GROUP BY type;
```

## Performance Considerations

- All timestamp columns are indexed for fast time-based queries
- JSON columns are used for flexible data storage
- Composite indexes support common query patterns
- Regular cleanup of expired insights and old data

## Data Retention

- Activities: Indefinite (core data)
- Screenshots: Configurable (privacy settings)
- Insights: Auto-expire based on timeframe
- Metrics: Aggregated and archived monthly

## Security and Privacy

- Local SQLite database (no cloud storage)
- Configurable data collection via privacy_settings
- Optional screenshot capture
- User-controlled data retention periods