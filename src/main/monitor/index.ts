import * as si from 'systeminformation'
import { ActivityRecord, SystemMetrics } from '../types'
import { DatabaseManager } from '../database'

export interface ResourceMonitor {
  getMemoryUsage(): Promise<number>
  getSystemMetrics(): Promise<SystemMetrics>
  correlateResourcesWithProductivity(activity: ActivityRecord, metrics: SystemMetrics): ResourceCorrelation
  detectResourceIntensiveApps(activities: ActivityRecord[]): ResourceIntensiveApp[]
  monitorSystemPerformance(): Promise<void>
}

export interface ResourceCorrelation {
  memoryImpact: 'low' | 'medium' | 'high'
  cpuImpact: 'low' | 'medium' | 'high'
  performanceScore: number
  resourceEfficiency: number
  recommendations: string[]
}

export interface ResourceIntensiveApp {
  appName: string
  avgCpuUsage: number
  avgMemoryUsage: number
  totalDuration: number
  impactScore: number
  category: 'light' | 'moderate' | 'heavy' | 'extreme'
}

export class SystemResourceMonitor implements ResourceMonitor {
  private monitoringInterval: NodeJS.Timeout | null = null
  private readonly MONITORING_INTERVAL = 30000 // 30 seconds


  constructor(private db: DatabaseManager) {}

  async getMemoryUsage(): Promise<number> {
    try {
      const memory = await si.mem()
      return ((memory.used / memory.total) * 100)
    } catch (error) {
      console.warn('Failed to get memory usage:', error)
      return 0
    }
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      const [cpu, memory, disk, network] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        si.networkStats()
      ])

      const diskUsage = disk.length > 0 ? (disk[0].used / disk[0].size) * 100 : 0
      const networkRx = network.length > 0 ? network[0].rx_sec || 0 : 0
      const networkTx = network.length > 0 ? network[0].tx_sec || 0 : 0

      const metrics: SystemMetrics = {
        timestamp: Date.now(),
        cpuUsage: cpu.currentLoad,
        memoryUsage: (memory.used / memory.total) * 100,
        diskUsage,
        networkActivity: networkRx + networkTx
      }

      return metrics
    } catch (error) {
      console.error('Failed to get system metrics:', error)
      return this.getDefaultMetrics()
    }
  }

  correlateResourcesWithProductivity(activity: ActivityRecord, metrics: SystemMetrics): ResourceCorrelation {
    const memoryImpact = this.classifyMemoryImpact(metrics.memoryUsage)
    const cpuImpact = this.classifyCpuImpact(activity.cpuUsage || 0)
    
    // Calculate performance score based on resource efficiency
    const performanceScore = this.calculatePerformanceScore(activity, metrics)
    
    // Calculate resource efficiency (productivity per resource unit)
    const resourceEfficiency = this.calculateResourceEfficiency(activity, metrics)
    
    const recommendations = this.generateResourceRecommendations(activity, metrics)

    return {
      memoryImpact,
      cpuImpact,
      performanceScore,
      resourceEfficiency,
      recommendations
    }
  }

  detectResourceIntensiveApps(activities: ActivityRecord[]): ResourceIntensiveApp[] {
    const appMetrics = new Map<string, {
      totalCpu: number,
      totalMemory: number,
      totalDuration: number,
      count: number
    }>()

    // Aggregate metrics by app
    activities.forEach(activity => {
      const current = appMetrics.get(activity.appName) || {
        totalCpu: 0,
        totalMemory: 0,
        totalDuration: 0,
        count: 0
      }

      appMetrics.set(activity.appName, {
        totalCpu: current.totalCpu + (activity.cpuUsage || 0),
        totalMemory: current.totalMemory + (activity.memoryUsage || 0),
        totalDuration: current.totalDuration + activity.duration,
        count: current.count + 1
      })
    })

    // Convert to ResourceIntensiveApp array
    const intensiveApps: ResourceIntensiveApp[] = []
    
    appMetrics.forEach((metrics, appName) => {
      const avgCpuUsage = metrics.count > 0 ? metrics.totalCpu / metrics.count : 0
      const avgMemoryUsage = metrics.count > 0 ? metrics.totalMemory / metrics.count : 0
      
      const impactScore = this.calculateImpactScore(avgCpuUsage, avgMemoryUsage, metrics.totalDuration)
      const category = this.categorizeResourceUsage(avgCpuUsage, avgMemoryUsage)

      intensiveApps.push({
        appName,
        avgCpuUsage,
        avgMemoryUsage,
        totalDuration: metrics.totalDuration,
        impactScore,
        category
      })
    })

    // Sort by impact score (highest first)
    return intensiveApps.sort((a, b) => b.impactScore - a.impactScore)
  }

  async monitorSystemPerformance(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        const metrics = await this.getSystemMetrics()
        await this.db.saveSystemMetrics(metrics)
        
        // Check for performance issues
        this.checkPerformanceThresholds(metrics)
      } catch (error) {
        console.error('Error during system monitoring:', error)
      }
    }, this.MONITORING_INTERVAL)
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
  }



  private getDefaultMetrics(): SystemMetrics {
    return {
      timestamp: Date.now(),
      cpuUsage: 0,
      memoryUsage: 0,
      diskUsage: 0,
      networkActivity: 0
    }
  }

  private classifyMemoryImpact(memoryUsage: number): 'low' | 'medium' | 'high' {
    if (memoryUsage < 50) return 'low'
    if (memoryUsage < 80) return 'medium'
    return 'high'
  }

  private classifyCpuImpact(cpuUsage: number): 'low' | 'medium' | 'high' {
    if (cpuUsage < 30) return 'low'
    if (cpuUsage < 70) return 'medium'
    return 'high'
  }

  private calculatePerformanceScore(activity: ActivityRecord, metrics: SystemMetrics): number {
    // Base score starts at 1.0 (perfect)
    let score = 1.0

    // Penalize high resource usage
    if (metrics.memoryUsage > 80) score -= 0.3
    else if (metrics.memoryUsage > 60) score -= 0.1

    if ((activity.cpuUsage || 0) > 80) score -= 0.3
    else if ((activity.cpuUsage || 0) > 60) score -= 0.1

    // Penalize high disk usage
    if (metrics.diskUsage > 90) score -= 0.2

    // Bonus for efficient resource usage with good productivity
    if (activity.duration > 300000 && (activity.cpuUsage || 0) < 50 && metrics.memoryUsage < 60) {
      score += 0.1
    }

    return Math.max(0, Math.min(1, score))
  }

  private calculateResourceEfficiency(activity: ActivityRecord, metrics: SystemMetrics): number {
    const resourceUsage = ((activity.cpuUsage || 0) + metrics.memoryUsage) / 2
    const timeEfficiency = activity.duration / 1000 // Convert to seconds
    
    // Efficiency = productivity per resource unit per time
    if (resourceUsage === 0) return 1
    
    return Math.min(1, timeEfficiency / (resourceUsage * 100))
  }

  private generateResourceRecommendations(activity: ActivityRecord, metrics: SystemMetrics): string[] {
    const recommendations: string[] = []

    if (metrics.memoryUsage > 85) {
      recommendations.push('High memory usage detected. Consider closing unused applications.')
    }

    if ((activity.cpuUsage || 0) > 80) {
      recommendations.push(`${activity.appName} is using high CPU. Consider optimizing or updating the application.`)
    }

    if (metrics.diskUsage > 90) {
      recommendations.push('Disk space is running low. Consider cleaning up files or expanding storage.')
    }



    if (recommendations.length === 0) {
      recommendations.push('System performance is optimal.')
    }

    return recommendations
  }

  private calculateImpactScore(avgCpuUsage: number, avgMemoryUsage: number, totalDuration: number): number {
    // Weight factors
    const cpuWeight = 0.4
    const memoryWeight = 0.4
    const durationWeight = 0.2

    // Normalize duration (convert to hours and cap at 8 hours)
    const durationHours = Math.min(totalDuration / 3600000, 8) / 8

    return (avgCpuUsage / 100) * cpuWeight + 
           (avgMemoryUsage / 100) * memoryWeight + 
           durationHours * durationWeight
  }

  private categorizeResourceUsage(avgCpuUsage: number, avgMemoryUsage: number): 'light' | 'moderate' | 'heavy' | 'extreme' {
    const combinedUsage = (avgCpuUsage + avgMemoryUsage) / 2

    if (combinedUsage < 25) return 'light'
    if (combinedUsage < 50) return 'moderate'
    if (combinedUsage < 75) return 'heavy'
    return 'extreme'
  }

  private checkPerformanceThresholds(metrics: SystemMetrics): void {
    if (metrics.cpuUsage > 80) {
      console.warn('High CPU usage detected:', metrics.cpuUsage + '%')
    }
    
    if (metrics.memoryUsage > 85) {
      console.warn('High memory usage detected:', metrics.memoryUsage + '%')
    }
  }
}