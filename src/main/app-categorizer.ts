import { DatabaseManager } from './database'
import { AppCategory, AppCategorizationSuggestion } from './types'

export class AppCategorizer {
  private db: DatabaseManager
  private knownApps: Map<string, { category: string; productivity: 'productive' | 'neutral' | 'distracting' }> = new Map()

  constructor(database: DatabaseManager) {
    this.db = database
    this.initializeKnownApps()
  }

  private initializeKnownApps(): void {
    // Development Tools - Productive
    const developmentTools = [
      'Visual Studio Code', 'IntelliJ IDEA', 'WebStorm', 'PyCharm', 'Eclipse', 'Sublime Text',
      'Atom', 'Vim', 'Emacs', 'Notepad++', 'Android Studio', 'Xcode', 'Unity',
      'Git', 'GitHub Desktop', 'SourceTree', 'GitKraken', 'Terminal', 'Command Prompt',
      'PowerShell', 'iTerm2', 'Hyper', 'Windows Terminal', 'Docker Desktop',
      'Postman', 'Insomnia', 'Figma', 'Sketch', 'Adobe XD', 'Photoshop', 'Illustrator'
    ]

    developmentTools.forEach(app => {
      this.knownApps.set(app.toLowerCase(), { category: 'Development', productivity: 'productive' })
    })

    // Productivity Tools - Productive
    const productivityTools = [
      'Microsoft Word', 'Microsoft Excel', 'Microsoft PowerPoint', 'Microsoft Outlook',
      'Google Docs', 'Google Sheets', 'Google Slides', 'Gmail', 'Notion', 'Obsidian',
      'Evernote', 'OneNote', 'Trello', 'Asana', 'Jira', 'Confluence', 'Slack',
      'Microsoft Teams', 'Zoom', 'Skype', 'Discord', 'Todoist', 'Any.do',
      'Calendar', 'Outlook Calendar', 'Google Calendar', 'Fantastical'
    ]

    productivityTools.forEach(app => {
      this.knownApps.set(app.toLowerCase(), { category: 'Productivity', productivity: 'productive' })
    })

    // Communication - Neutral
    const communicationTools = [
      'WhatsApp', 'Telegram', 'Signal', 'Messenger', 'WeChat', 'Line',
      'Viber', 'Snapchat', 'Instagram', 'Twitter', 'LinkedIn', 'Facebook'
    ]

    communicationTools.forEach(app => {
      this.knownApps.set(app.toLowerCase(), { category: 'Communication', productivity: 'neutral' })
    })

    // Entertainment - Distracting
    const entertainmentApps = [
      'Netflix', 'YouTube', 'Twitch', 'Spotify', 'Apple Music', 'Amazon Music',
      'VLC Media Player', 'iTunes', 'Steam', 'Epic Games Launcher', 'Origin',
      'Battle.net', 'Uplay', 'GOG Galaxy', 'Xbox', 'PlayStation', 'TikTok',
      'Reddit', 'Pinterest', 'Tumblr', '9GAG', 'Imgur'
    ]

    entertainmentApps.forEach(app => {
      this.knownApps.set(app.toLowerCase(), { category: 'Entertainment', productivity: 'distracting' })
    })

    // System Tools - Neutral
    const systemTools = [
      'File Explorer', 'Finder', 'Task Manager', 'Activity Monitor', 'System Preferences',
      'Control Panel', 'Settings', 'Registry Editor', 'Disk Utility', 'Calculator',
      'Notepad', 'TextEdit', 'Preview', 'Windows Media Player', 'QuickTime Player'
    ]

    systemTools.forEach(app => {
      this.knownApps.set(app.toLowerCase(), { category: 'System', productivity: 'neutral' })
    })

    // Browsers - Neutral (depends on usage)
    const browsers = [
      'Google Chrome', 'Mozilla Firefox', 'Safari', 'Microsoft Edge', 'Opera',
      'Brave', 'Vivaldi', 'Internet Explorer'
    ]

    browsers.forEach(app => {
      this.knownApps.set(app.toLowerCase(), { category: 'Browser', productivity: 'neutral' })
    })

    // Design Tools - Productive
    const designTools = [
      'Adobe Creative Suite', 'Adobe Photoshop', 'Adobe Illustrator', 'Adobe InDesign',
      'Adobe After Effects', 'Adobe Premiere Pro', 'Figma', 'Sketch', 'Canva',
      'GIMP', 'Inkscape', 'Blender', 'Maya', '3ds Max', 'Cinema 4D'
    ]

    designTools.forEach(app => {
      this.knownApps.set(app.toLowerCase(), { category: 'Design', productivity: 'productive' })
    })
  }

  async getSuggestions(appNames: string[]): Promise<AppCategorizationSuggestion[]> {
    const suggestions: AppCategorizationSuggestion[] = []
    const existingCategories = await this.db.getAppCategories()
    const categorizedApps = new Set(existingCategories.map(cat => cat.appName.toLowerCase()))

    for (const appName of appNames) {
      const lowerAppName = appName.toLowerCase()
      
      // Skip if already categorized
      if (categorizedApps.has(lowerAppName)) {
        continue
      }

      const suggestion = this.generateSuggestion(appName)
      if (suggestion) {
        suggestions.push(suggestion)
      }
    }

    return suggestions
  }

  private generateSuggestion(appName: string): AppCategorizationSuggestion | null {
    const lowerAppName = appName.toLowerCase()
    
    // Check exact match first
    const exactMatch = this.knownApps.get(lowerAppName)
    if (exactMatch) {
      return {
        appName,
        suggestedCategory: exactMatch.category,
        suggestedProductivityRating: exactMatch.productivity,
        confidence: 0.95,
        reason: 'Known application',
        isCommonApp: true
      }
    }

    // Check partial matches
    for (const [knownApp, info] of this.knownApps.entries()) {
      if (lowerAppName.includes(knownApp) || knownApp.includes(lowerAppName)) {
        return {
          appName,
          suggestedCategory: info.category,
          suggestedProductivityRating: info.productivity,
          confidence: 0.7,
          reason: `Similar to ${knownApp}`,
          isCommonApp: true
        }
      }
    }

    // Pattern-based suggestions
    const patternSuggestion = this.getPatternBasedSuggestion(appName)
    if (patternSuggestion) {
      return patternSuggestion
    }

    // Default suggestion for unknown apps
    return {
      appName,
      suggestedCategory: 'Uncategorized',
      suggestedProductivityRating: 'neutral',
      confidence: 0.3,
      reason: 'Unknown application - manual review recommended',
      isCommonApp: false
    }
  }

  private getPatternBasedSuggestion(appName: string): AppCategorizationSuggestion | null {
    const lowerAppName = appName.toLowerCase()

    // Development patterns
    const devPatterns = [
      'code', 'studio', 'ide', 'editor', 'git', 'terminal', 'console', 'compiler',
      'debugger', 'profiler', 'docker', 'kubernetes', 'npm', 'yarn', 'maven',
      'gradle', 'webpack', 'babel', 'eslint', 'prettier'
    ]

    if (devPatterns.some(pattern => lowerAppName.includes(pattern))) {
      return {
        appName,
        suggestedCategory: 'Development',
        suggestedProductivityRating: 'productive',
        confidence: 0.8,
        reason: 'Contains development-related keywords',
        isCommonApp: false
      }
    }

    // Game patterns
    const gamePatterns = [
      'game', 'play', 'steam', 'launcher', 'gaming', 'arcade', 'puzzle',
      'strategy', 'action', 'adventure', 'simulation', 'sports'
    ]

    if (gamePatterns.some(pattern => lowerAppName.includes(pattern))) {
      return {
        appName,
        suggestedCategory: 'Entertainment',
        suggestedProductivityRating: 'distracting',
        confidence: 0.8,
        reason: 'Contains gaming-related keywords',
        isCommonApp: false
      }
    }

    // Media patterns
    const mediaPatterns = [
      'player', 'music', 'video', 'audio', 'media', 'streaming', 'podcast',
      'radio', 'tv', 'movie', 'film', 'photo', 'image'
    ]

    if (mediaPatterns.some(pattern => lowerAppName.includes(pattern))) {
      return {
        appName,
        suggestedCategory: 'Entertainment',
        suggestedProductivityRating: 'distracting',
        confidence: 0.7,
        reason: 'Contains media-related keywords',
        isCommonApp: false
      }
    }

    // Office/Productivity patterns
    const officePatterns = [
      'office', 'word', 'excel', 'powerpoint', 'outlook', 'calendar', 'mail',
      'document', 'spreadsheet', 'presentation', 'note', 'task', 'todo',
      'project', 'plan', 'organize'
    ]

    if (officePatterns.some(pattern => lowerAppName.includes(pattern))) {
      return {
        appName,
        suggestedCategory: 'Productivity',
        suggestedProductivityRating: 'productive',
        confidence: 0.8,
        reason: 'Contains productivity-related keywords',
        isCommonApp: false
      }
    }

    // Communication patterns
    const commPatterns = [
      'chat', 'message', 'messenger', 'call', 'video', 'conference', 'meeting',
      'zoom', 'teams', 'slack', 'discord', 'telegram', 'whatsapp'
    ]

    if (commPatterns.some(pattern => lowerAppName.includes(pattern))) {
      return {
        appName,
        suggestedCategory: 'Communication',
        suggestedProductivityRating: 'neutral',
        confidence: 0.7,
        reason: 'Contains communication-related keywords',
        isCommonApp: false
      }
    }

    // Browser patterns
    const browserPatterns = [
      'browser', 'chrome', 'firefox', 'safari', 'edge', 'opera', 'internet'
    ]

    if (browserPatterns.some(pattern => lowerAppName.includes(pattern))) {
      return {
        appName,
        suggestedCategory: 'Browser',
        suggestedProductivityRating: 'neutral',
        confidence: 0.9,
        reason: 'Browser application',
        isCommonApp: true
      }
    }

    return null
  }

  async categorizeApp(appName: string, category: string, productivity: 'productive' | 'neutral' | 'distracting', userDefined: boolean = true): Promise<void> {
    const appCategory: AppCategory = {
      appName,
      category,
      productivityRating: productivity,
      isUserDefined: userDefined,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    await this.db.saveAppCategory(appCategory)
  }

  async bulkCategorize(suggestions: AppCategorizationSuggestion[], autoApply: boolean = false): Promise<{ applied: number; skipped: number }> {
    let applied = 0
    let skipped = 0

    for (const suggestion of suggestions) {
      if (autoApply || suggestion.confidence >= 0.8) {
        try {
          await this.categorizeApp(
            suggestion.appName,
            suggestion.suggestedCategory,
            suggestion.suggestedProductivityRating,
            false // Auto-categorized
          )
          applied++
        } catch (error) {
          console.error(`Failed to categorize ${suggestion.appName}:`, error)
          skipped++
        }
      } else {
        skipped++
      }
    }

    return { applied, skipped }
  }

  async getUncategorizedApps(recentActivityHours: number = 24): Promise<string[]> {
    const cutoffTime = Date.now() - (recentActivityHours * 60 * 60 * 1000)
    const activities = await this.db.getActivities({ startTime: cutoffTime })
    const categorizedApps = await this.db.getAppCategories()
    
    const categorizedAppNames = new Set(categorizedApps.map(cat => cat.appName))
    const recentAppNames = new Set(activities.map(activity => activity.appName))
    
    return Array.from(recentAppNames).filter(appName => !categorizedAppNames.has(appName))
  }

  async getCategorizationStats(): Promise<{
    totalApps: number
    categorizedApps: number
    uncategorizedApps: number
    categoryBreakdown: Record<string, number>
    productivityBreakdown: Record<string, number>
  }> {
    const categories = await this.db.getAppCategories()
    const recentApps = await this.getUncategorizedApps()
    
    const categoryBreakdown: Record<string, number> = {}
    const productivityBreakdown: Record<string, number> = {
      productive: 0,
      neutral: 0,
      distracting: 0
    }

    categories.forEach(cat => {
      categoryBreakdown[cat.category] = (categoryBreakdown[cat.category] || 0) + 1
      productivityBreakdown[cat.productivityRating]++
    })

    return {
      totalApps: categories.length + recentApps.length,
      categorizedApps: categories.length,
      uncategorizedApps: recentApps.length,
      categoryBreakdown,
      productivityBreakdown
    }
  }

  async updateAppCategory(appName: string, updates: Partial<AppCategory>): Promise<void> {
    const existing = await this.db.getAppCategories()
    const current = existing.find(cat => cat.appName === appName)
    
    if (!current) {
      throw new Error(`App category not found: ${appName}`)
    }

    const updated: AppCategory = {
      ...current,
      ...updates,
      updatedAt: Date.now()
    }

    await this.db.saveAppCategory(updated)
  }

  async deleteAppCategory(appName: string): Promise<void> {
    await this.db.deleteAppCategory(appName)
  }

  async exportCategories(): Promise<AppCategory[]> {
    return this.db.getAppCategories()
  }

  async importCategories(categories: AppCategory[], overwrite: boolean = false): Promise<{ imported: number; skipped: number; errors: number }> {
    let imported = 0
    let skipped = 0
    let errors = 0

    const existing = await this.db.getAppCategories()
    const existingApps = new Set(existing.map(cat => cat.appName))

    for (const category of categories) {
      try {
        if (!overwrite && existingApps.has(category.appName)) {
          skipped++
          continue
        }

        await this.db.saveAppCategory({
          ...category,
          updatedAt: Date.now()
        })
        imported++
      } catch (error) {
        console.error(`Failed to import category for ${category.appName}:`, error)
        errors++
      }
    }

    return { imported, skipped, errors }
  }
}