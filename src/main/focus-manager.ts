import { EventEmitter } from 'events'
import { DatabaseManager } from './database'
import { FocusSession, FocusSessionConfig, ActiveFocusSession, DistractionEvent } from './types'

export class FocusManager extends EventEmitter {
  private db: DatabaseManager
  private activeFocusSession: ActiveFocusSession | null = null
  private focusTimer: NodeJS.Timeout | null = null
  private breakTimer: NodeJS.Timeout | null = null
  private pomodoroConfig: FocusSessionConfig = {
    duration: 25, // 25 minutes
    type: 'pomodoro',
    breakDuration: 5, // 5 minutes
    longBreakDuration: 15, // 15 minutes
    sessionsUntilLongBreak: 4,
    autoStartBreaks: false,
    autoStartFocus: false,
    enableSounds: true,
    enableNotifications: true,
    strictMode: false
  }
  private completedSessions: number = 0

  constructor(database: DatabaseManager) {
    super()
    this.db = database
  }

  async startFocusSession(config?: Partial<FocusSessionConfig>): Promise<ActiveFocusSession> {
    if (this.activeFocusSession) {
      throw new Error('Focus session already active')
    }

    // Update config if provided
    if (config) {
      this.pomodoroConfig = { ...this.pomodoroConfig, ...config }
    }

    const startTime = Date.now()
    this.activeFocusSession = {
      id: `focus_${startTime}`,
      startTime,
      duration: this.pomodoroConfig.duration * 60 * 1000,
      type: 'focus',
      isActive: true,
      timeRemaining: this.pomodoroConfig.duration * 60 * 1000,
      interruptions: 0,
      config: this.pomodoroConfig,
      plannedEndTime: startTime + (this.pomodoroConfig.duration * 60 * 1000),
      currentPhase: 'focus',
      phaseStartTime: startTime,
      sessionsCompleted: 0,
      isPaused: false,
      totalPausedTime: 0,
      focusScore: 0,
      status: 'running'
    }

    // Start the focus timer
    this.focusTimer = setTimeout(() => {
      this.completeFocusSession()
    }, this.pomodoroConfig.duration * 60 * 1000)

    // Update time remaining every second
    this.startTimeTracking()

    this.emit('focus-session-started', this.activeFocusSession)
    return this.activeFocusSession
  }

  async stopFocusSession(): Promise<FocusSession | null> {
    if (!this.activeFocusSession) {
      return null
    }

    const session = await this.completeFocusSession(true)
    return session
  }

  async pauseFocusSession(): Promise<void> {
    if (!this.activeFocusSession || !this.activeFocusSession.isActive) {
      throw new Error('No active focus session to pause')
    }

    if (this.focusTimer) {
      clearTimeout(this.focusTimer)
      this.focusTimer = null
    }

    this.activeFocusSession.isActive = false
    this.activeFocusSession.pausedAt = Date.now()
    
    this.emit('focus-session-paused', this.activeFocusSession)
  }

  async resumeFocusSession(): Promise<void> {
    if (!this.activeFocusSession || this.activeFocusSession.isActive) {
      throw new Error('No paused focus session to resume')
    }

    this.activeFocusSession.isActive = true
    this.activeFocusSession.pausedAt = undefined

    // Restart timer with remaining time
    this.focusTimer = setTimeout(() => {
      this.completeFocusSession()
    }, this.activeFocusSession.timeRemaining)

    this.startTimeTracking()
    this.emit('focus-session-resumed', this.activeFocusSession)
  }

  async recordInterruption(appName: string): Promise<void> {
    if (!this.activeFocusSession) {
      return
    }

    this.activeFocusSession.interruptions++

    // Save distraction event
    const distractionEvent: DistractionEvent = {
      timestamp: Date.now(),
      type: 'focus_loss',
      appName,
      duration: 0, // Will be calculated when interruption ends
      severity: 'medium',
      contextSwitches: 1,
      wasNotified: false,
      userResponse: undefined
    }

    await this.db.saveDistractionEvent(distractionEvent)
    this.emit('focus-session-interrupted', {
      session: this.activeFocusSession,
      interruption: distractionEvent
    })
  }

  async startBreak(type: 'short' | 'long' = 'short'): Promise<ActiveFocusSession> {
    if (this.activeFocusSession) {
      throw new Error('Cannot start break while focus session is active')
    }

    const duration = type === 'short' 
      ? this.pomodoroConfig.breakDuration 
      : this.pomodoroConfig.longBreakDuration

    const startTime = Date.now()
    this.activeFocusSession = {
      id: `break_${startTime}`,
      config: this.pomodoroConfig,
      startTime,
      plannedEndTime: startTime + ((duration || this.pomodoroConfig.breakDuration || 5) * 60 * 1000),
      currentPhase: 'break',
      phaseStartTime: startTime,
      sessionsCompleted: this.completedSessions,
      isPaused: false,
      totalPausedTime: 0,
      interruptions: 0,
      focusScore: 0,
      duration: (duration || this.pomodoroConfig.breakDuration || 5) * 60 * 1000,
      timeRemaining: (duration || this.pomodoroConfig.breakDuration || 5) * 60 * 1000,
      status: 'break',
      type: 'break',
      isActive: true
    }

    this.breakTimer = setTimeout(() => {
      this.completeBreak()
    }, duration)

    this.startTimeTracking()
    this.emit('break-started', this.activeFocusSession)
    return this.activeFocusSession
  }

  async stopBreak(): Promise<void> {
    if (!this.activeFocusSession || this.activeFocusSession.type !== 'break') {
      return
    }

    this.completeBreak(true)
  }

  getCurrentSession(): ActiveFocusSession | null {
    return this.activeFocusSession
  }

  getConfig(): FocusSessionConfig {
    return { ...this.pomodoroConfig }
  }

  async updateConfig(config: Partial<FocusSessionConfig>): Promise<void> {
    this.pomodoroConfig = { ...this.pomodoroConfig, ...config }
    this.emit('config-updated', this.pomodoroConfig)
  }

  private async completeFocusSession(manual: boolean = false): Promise<FocusSession> {
    if (!this.activeFocusSession) {
      throw new Error('No active focus session')
    }

    const endTime = Date.now()
    const actualDuration = endTime - this.activeFocusSession.startTime
    const completionRate = manual 
      ? actualDuration / this.activeFocusSession.duration
      : 1.0

    // Calculate focus score based on completion rate and interruptions
    const focusScore = this.calculateFocusScore(completionRate, this.activeFocusSession.interruptions)

    const focusSession: FocusSession = {
      startTime: this.activeFocusSession.startTime,
      endTime,
      duration: actualDuration,
      appName: 'Focus Timer',
      category: 'productivity',
      interruptions: this.activeFocusSession.interruptions,
      focusScore,
      keystrokes: 0,
      mouseClicks: 0
    }

    // Save to database
    await this.db.saveFocusSession(focusSession)

    // Clear timers
    if (this.focusTimer) {
      clearTimeout(this.focusTimer)
      this.focusTimer = null
    }

    this.completedSessions++
    this.activeFocusSession = null

    this.emit('focus-session-completed', focusSession)

    // Auto-start break if enabled
    if (this.pomodoroConfig.autoStartBreaks && !manual) {
      const breakType = this.completedSessions % (this.pomodoroConfig.sessionsUntilLongBreak || 4) === 0 
        ? 'long' 
        : 'short'
      setTimeout(() => this.startBreak(breakType), 1000)
    }

    return focusSession
  }

  private completeBreak(manual: boolean = false): void {
    if (!this.activeFocusSession || this.activeFocusSession.type !== 'break') {
      return
    }

    if (this.breakTimer) {
      clearTimeout(this.breakTimer)
      this.breakTimer = null
    }

    const breakSession = { ...this.activeFocusSession }
    this.activeFocusSession = null

    this.emit('break-completed', breakSession)

    // Auto-start next focus session if enabled
    if (this.pomodoroConfig.autoStartFocus && !manual) {
      setTimeout(() => this.startFocusSession(), 1000)
    }
  }

  private startTimeTracking(): void {
    const updateInterval = setInterval(() => {
      if (!this.activeFocusSession || !this.activeFocusSession.isActive) {
        clearInterval(updateInterval)
        return
      }

      const elapsed = Date.now() - this.activeFocusSession.startTime
      this.activeFocusSession.timeRemaining = Math.max(0, this.activeFocusSession.duration - elapsed)

      this.emit('time-update', {
        timeRemaining: this.activeFocusSession.timeRemaining,
        elapsed,
        session: this.activeFocusSession
      })

      if (this.activeFocusSession.timeRemaining <= 0) {
        clearInterval(updateInterval)
      }
    }, 1000)
  }

  private calculateFocusScore(completionRate: number, interruptions: number): number {
    // Base score from completion rate (0-70 points)
    let score = completionRate * 70

    // Deduct points for interruptions (up to 30 points)
    const interruptionPenalty = Math.min(interruptions * 5, 30)
    score -= interruptionPenalty

    // Bonus for completing without interruptions (up to 30 points)
    if (interruptions === 0 && completionRate >= 1.0) {
      score += 30
    }

    return Math.max(0, Math.min(100, score))
  }

  async getSessionHistory(limit: number = 20): Promise<FocusSession[]> {
    return this.db.getFocusSessions({ limit })
  }

  async getSessionAnalytics(): Promise<any> {
    const sessions = await this.db.getFocusSessions({ limit: 100 })
    
    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        averageFocusScore: 0,
        totalFocusTime: 0,
        averageSessionLength: 0,
        totalInterruptions: 0,
        completionRate: 0
      }
    }

    const totalSessions = sessions.length
    const totalFocusTime = sessions.reduce((sum, s) => sum + s.duration, 0)
    const totalInterruptions = sessions.reduce((sum, s) => sum + s.interruptions, 0)
    const averageFocusScore = sessions.reduce((sum, s) => sum + s.focusScore, 0) / totalSessions
    const averageSessionLength = totalFocusTime / totalSessions
    
    // Calculate completion rate (sessions that lasted their full intended duration)
    const completedSessions = sessions.filter(s => s.duration >= (25 * 60 * 1000 * 0.9)).length
    const completionRate = (completedSessions / totalSessions) * 100

    return {
      totalSessions,
      averageFocusScore: Math.round(averageFocusScore * 100) / 100,
      totalFocusTime,
      averageSessionLength: Math.round(averageSessionLength),
      totalInterruptions,
      completionRate: Math.round(completionRate * 100) / 100
    }
  }

  destroy(): void {
    if (this.focusTimer) {
      clearTimeout(this.focusTimer)
    }
    if (this.breakTimer) {
      clearTimeout(this.breakTimer)
    }
    this.removeAllListeners()
  }
}