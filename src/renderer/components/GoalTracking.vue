<template>
  <div class="goal-tracking">
    <div class="header">
      <h2>Goal Tracking</h2>
      <div class="controls">
        <button @click="showGoalModal = true" class="btn btn-primary">
          <i class="icon-plus"></i>
          Add Goal
        </button>
        <button @click="exportGoals" class="btn btn-secondary">
          <i class="icon-download"></i>
          Export
        </button>
      </div>
    </div>

    <!-- Goal Overview Cards -->
    <div class="goals-overview">
      <div class="overview-card" :class="{ 'on-track': dailyProgress >= 0.8, 'behind': dailyProgress < 0.5 }">
        <div class="card-header">
          <h3>Today's Progress</h3>
          <div class="progress-percentage">{{ Math.round(dailyProgress * 100) }}%</div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${dailyProgress * 100}%` }"></div>
        </div>
        <div class="card-details">
          <span>{{ formatDuration(todayActiveTime) }} / {{ formatDuration(dailyGoal.activeTime) }}</span>
        </div>
      </div>

      <div class="overview-card" :class="{ 'on-track': weeklyProgress >= 0.8, 'behind': weeklyProgress < 0.5 }">
        <div class="card-header">
          <h3>Weekly Progress</h3>
          <div class="progress-percentage">{{ Math.round(weeklyProgress * 100) }}%</div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${weeklyProgress * 100}%` }"></div>
        </div>
        <div class="card-details">
          <span>{{ completedDays }} / 7 days completed</span>
        </div>
      </div>

      <div class="overview-card" :class="{ 'on-track': streakDays >= 7, 'behind': streakDays < 3 }">
        <div class="card-header">
          <h3>Current Streak</h3>
          <div class="progress-percentage">{{ streakDays }}</div>
        </div>
        <div class="streak-visual">
          <div v-for="day in 7" :key="day" class="streak-day" :class="{ active: day <= streakDays }"></div>
        </div>
        <div class="card-details">
          <span>{{ streakDays }} consecutive days</span>
        </div>
      </div>
    </div>

    <!-- Active Goals List -->
    <div class="goals-section">
      <h3>Active Goals</h3>
      <div class="goals-list">
        <div v-for="goal in activeGoals" :key="goal.id" class="goal-item" :class="goal.status">
          <div class="goal-header">
            <div class="goal-info">
              <h4>{{ goal.title }}</h4>
              <p class="goal-description">{{ goal.description }}</p>
              <div class="goal-meta">
                <span class="goal-type">{{ goal.type }}</span>
                <span class="goal-deadline">Due: {{ formatDate(goal.deadline) }}</span>
              </div>
            </div>
            <div class="goal-actions">
              <button @click="editGoal(goal)" class="btn btn-small btn-secondary">
                <i class="icon-edit"></i>
              </button>
              <button @click="deleteGoal(goal.id)" class="btn btn-small btn-danger">
                <i class="icon-trash"></i>
              </button>
            </div>
          </div>
          
          <div class="goal-progress">
            <div class="progress-info">
              <span class="current-value">{{ formatGoalValue(goal.currentValue, goal.type) }}</span>
              <span class="target-value">/ {{ formatGoalValue(goal.targetValue, goal.type) }}</span>
              <span class="progress-percent">({{ Math.round((goal.currentValue / goal.targetValue) * 100) }}%)</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" 
                   :style="{ width: `${Math.min((goal.currentValue / goal.targetValue) * 100, 100)}%` }"
                   :class="getProgressClass(goal.currentValue / goal.targetValue)"></div>
            </div>
          </div>
          
          <div class="goal-insights">
            <div class="insight-item">
              <span class="insight-label">Daily Average:</span>
              <span class="insight-value">{{ formatGoalValue(goal.dailyAverage, goal.type) }}</span>
            </div>
            <div class="insight-item">
              <span class="insight-label">Days Remaining:</span>
              <span class="insight-value">{{ getDaysRemaining(goal.deadline) }}</span>
            </div>
            <div class="insight-item">
              <span class="insight-label">Required Daily:</span>
              <span class="insight-value">{{ formatGoalValue(goal.requiredDaily, goal.type) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Goal History -->
    <div class="history-section">
      <h3>Goal History</h3>
      <div class="history-filters">
        <select v-model="historyFilter" class="filter-select">
          <option value="all">All Goals</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="archived">Archived</option>
        </select>
      </div>
      <div class="history-list">
        <div v-for="goal in filteredHistory" :key="goal.id" class="history-item" :class="goal.status">
          <div class="history-info">
            <h4>{{ goal.title }}</h4>
            <p>{{ goal.description }}</p>
            <div class="history-meta">
              <span class="completion-date">{{ formatDate(goal.completedAt || goal.deadline) }}</span>
              <span class="final-progress">{{ Math.round((goal.finalValue / goal.targetValue) * 100) }}% achieved</span>
            </div>
          </div>
          <div class="history-status">
            <div class="status-badge" :class="goal.status">{{ goal.status }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Goal Creation/Edit Modal -->
    <div v-if="showGoalModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ editingGoal ? 'Edit Goal' : 'Create New Goal' }}</h3>
          <button @click="closeModal" class="btn btn-small btn-secondary">
            <i class="icon-close"></i>
          </button>
        </div>
        
        <form @submit.prevent="saveGoal" class="goal-form">
          <div class="form-group">
            <label for="goalTitle">Goal Title</label>
            <input 
              id="goalTitle"
              v-model="goalForm.title" 
              type="text" 
              required 
              placeholder="e.g., Increase daily focus time"
            >
          </div>
          
          <div class="form-group">
            <label for="goalDescription">Description</label>
            <textarea 
              id="goalDescription"
              v-model="goalForm.description" 
              placeholder="Describe your goal and why it's important"
            ></textarea>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label for="goalType">Goal Type</label>
              <select id="goalType" v-model="goalForm.type" required>
                <option value="activeTime">Daily Active Time</option>
                <option value="focusTime">Focus Session Time</option>
                <option value="productivityScore">Productivity Score</option>
                <option value="distractionLimit">Distraction Limit</option>
                <option value="streakDays">Consistency Streak</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="goalTarget">Target Value</label>
              <input 
                id="goalTarget"
                v-model.number="goalForm.targetValue" 
                type="number" 
                required 
                :placeholder="getTargetPlaceholder(goalForm.type)"
              >
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label for="goalDeadline">Deadline</label>
              <input 
                id="goalDeadline"
                v-model="goalForm.deadline" 
                type="date" 
                required
              >
            </div>
            
            <div class="form-group">
              <label for="goalPriority">Priority</label>
              <select id="goalPriority" v-model="goalForm.priority">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          
          <div class="form-actions">
            <button type="button" @click="closeModal" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary">{{ editingGoal ? 'Update' : 'Create' }} Goal</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'GoalTracking',
  data() {
    return {
      showGoalModal: false,
      editingGoal: null,
      historyFilter: 'all',
      dailyProgress: 0.75,
      weeklyProgress: 0.68,
      streakDays: 5,
      completedDays: 4,
      todayActiveTime: 6 * 60 * 60 * 1000, // 6 hours
      dailyGoal: {
        activeTime: 8 * 60 * 60 * 1000 // 8 hours
      },
      goalForm: {
        title: '',
        description: '',
        type: 'activeTime',
        targetValue: 0,
        deadline: '',
        priority: 'medium'
      },
      activeGoals: [
        {
          id: 1,
          title: 'Daily Focus Time',
          description: 'Maintain 6+ hours of focused work daily',
          type: 'focusTime',
          currentValue: 4.5 * 60 * 60 * 1000,
          targetValue: 6 * 60 * 60 * 1000,
          deadline: Date.now() + (30 * 24 * 60 * 60 * 1000),
          status: 'on-track',
          dailyAverage: 4.2 * 60 * 60 * 1000,
          requiredDaily: 5.8 * 60 * 60 * 1000
        },
        {
          id: 2,
          title: 'Productivity Score',
          description: 'Achieve 85% average productivity score',
          type: 'productivityScore',
          currentValue: 78,
          targetValue: 85,
          deadline: Date.now() + (14 * 24 * 60 * 60 * 1000),
          status: 'behind',
          dailyAverage: 76,
          requiredDaily: 82
        },
        {
          id: 3,
          title: 'Distraction Control',
          description: 'Limit distractions to under 20 per day',
          type: 'distractionLimit',
          currentValue: 15,
          targetValue: 20,
          deadline: Date.now() + (7 * 24 * 60 * 60 * 1000),
          status: 'on-track',
          dailyAverage: 18,
          requiredDaily: 19
        }
      ],
      goalHistory: [
        {
          id: 4,
          title: 'Weekly Active Time',
          description: 'Complete 40 hours of active work per week',
          type: 'activeTime',
          targetValue: 40 * 60 * 60 * 1000,
          finalValue: 42 * 60 * 60 * 1000,
          deadline: Date.now() - (7 * 24 * 60 * 60 * 1000),
          completedAt: Date.now() - (5 * 24 * 60 * 60 * 1000),
          status: 'completed'
        },
        {
          id: 5,
          title: 'Focus Streak',
          description: 'Maintain 14-day focus streak',
          type: 'streakDays',
          targetValue: 14,
          finalValue: 10,
          deadline: Date.now() - (14 * 24 * 60 * 60 * 1000),
          status: 'failed'
        }
      ]
    }
  },
  computed: {
    filteredHistory() {
      if (this.historyFilter === 'all') {
        return this.goalHistory
      }
      return this.goalHistory.filter(goal => goal.status === this.historyFilter)
    }
  },
  async mounted() {
    await this.loadGoalData()
  },
  methods: {
    async loadGoalData() {
      try {
        // Load dashboard data to get current progress
        const dashboardData = await window.electronAPI.invoke('dashboard:get-data')
        
        // Update progress based on real data
        if (dashboardData) {
          this.todayActiveTime = dashboardData.todayStats?.activeTime || 0
          this.dailyProgress = Math.min(this.todayActiveTime / this.dailyGoal.activeTime, 1)
        }
        
        // TODO: Load actual goals from database
        // const goals = await window.electronAPI.invoke('goals:get-active')
        // this.activeGoals = goals
        
      } catch (error) {
        console.error('Failed to load goal data:', error)
      }
    },
    
    editGoal(goal) {
      this.editingGoal = goal
      this.goalForm = {
        title: goal.title,
        description: goal.description,
        type: goal.type,
        targetValue: goal.targetValue,
        deadline: new Date(goal.deadline).toISOString().split('T')[0],
        priority: goal.priority || 'medium'
      }
      this.showGoalModal = true
    },
    
    async saveGoal() {
      try {
        const goalData = {
          ...this.goalForm,
          deadline: new Date(this.goalForm.deadline).getTime(),
          currentValue: 0,
          status: 'active',
          createdAt: Date.now()
        }
        
        if (this.editingGoal) {
          // Update existing goal
          const index = this.activeGoals.findIndex(g => g.id === this.editingGoal.id)
          if (index !== -1) {
            this.activeGoals[index] = { ...this.activeGoals[index], ...goalData }
          }
        } else {
          // Create new goal
          goalData.id = Date.now()
          this.activeGoals.push(goalData)
        }
        
        // TODO: Save to database
        // await window.electronAPI.invoke('goals:save', goalData)
        
        this.closeModal()
      } catch (error) {
        console.error('Failed to save goal:', error)
      }
    },
    
    async deleteGoal(goalId) {
      if (confirm('Are you sure you want to delete this goal?')) {
        try {
          this.activeGoals = this.activeGoals.filter(g => g.id !== goalId)
          
          // TODO: Delete from database
          // await window.electronAPI.invoke('goals:delete', goalId)
          
        } catch (error) {
          console.error('Failed to delete goal:', error)
        }
      }
    },
    
    async exportGoals() {
      try {
        // TODO: Implement goal export
        console.log('Exporting goals...')
      } catch (error) {
        console.error('Failed to export goals:', error)
      }
    },
    
    closeModal() {
      this.showGoalModal = false
      this.editingGoal = null
      this.goalForm = {
        title: '',
        description: '',
        type: 'activeTime',
        targetValue: 0,
        deadline: '',
        priority: 'medium'
      }
    },
    
    getProgressClass(progress) {
      if (progress >= 0.8) return 'excellent'
      if (progress >= 0.6) return 'good'
      if (progress >= 0.4) return 'fair'
      return 'poor'
    },
    
    getTargetPlaceholder(type) {
      const placeholders = {
        activeTime: 'Hours (e.g., 8)',
        focusTime: 'Hours (e.g., 6)',
        productivityScore: 'Percentage (e.g., 85)',
        distractionLimit: 'Count (e.g., 15)',
        streakDays: 'Days (e.g., 30)'
      }
      return placeholders[type] || 'Enter target value'
    },
    
    formatGoalValue(value, type) {
      switch (type) {
        case 'activeTime':
        case 'focusTime':
          return this.formatDuration(value)
        case 'productivityScore':
          return `${Math.round(value)}%`
        case 'distractionLimit':
          return `${value} distractions`
        case 'streakDays':
          return `${value} days`
        default:
          return value
      }
    },
    
    formatDuration(ms) {
      const hours = Math.floor(ms / (1000 * 60 * 60))
      const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
      if (hours > 0) {
        return `${hours}h ${minutes}m`
      }
      return `${minutes}m`
    },
    
    formatDate(timestamp) {
      return new Date(timestamp).toLocaleDateString()
    },
    
    getDaysRemaining(deadline) {
      const days = Math.ceil((deadline - Date.now()) / (24 * 60 * 60 * 1000))
      return Math.max(0, days)
    }
  }
}
</script>

<style scoped>
.goal-tracking {
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header h2 {
  margin: 0;
  color: #2c3e50;
}

.controls {
  display: flex;
  gap: 1rem;
}

.goals-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.overview-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  border-left: 4px solid #bdc3c7;
}

.overview-card.on-track {
  border-left-color: #27ae60;
}

.overview-card.behind {
  border-left-color: #e74c3c;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.card-header h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 1.1rem;
}

.progress-percentage {
  font-size: 1.5rem;
  font-weight: bold;
  color: #3498db;
}

.progress-bar {
  height: 8px;
  background: #ecf0f1;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: #3498db;
  transition: width 0.3s;
}

.progress-fill.excellent {
  background: #27ae60;
}

.progress-fill.good {
  background: #2ecc71;
}

.progress-fill.fair {
  background: #f39c12;
}

.progress-fill.poor {
  background: #e74c3c;
}

.card-details {
  font-size: 0.9rem;
  color: #7f8c8d;
}

.streak-visual {
  display: flex;
  gap: 4px;
  margin: 0.5rem 0;
}

.streak-day {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ecf0f1;
}

.streak-day.active {
  background: #27ae60;
}

.goals-section,
.history-section {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 2rem;
}

.goals-section h3,
.history-section h3 {
  margin: 0 0 1.5rem 0;
  color: #2c3e50;
  border-bottom: 2px solid #3498db;
  padding-bottom: 0.5rem;
}

.goals-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.goal-item {
  border: 1px solid #ecf0f1;
  border-radius: 8px;
  padding: 1.5rem;
  background: #fafafa;
}

.goal-item.on-track {
  border-left: 4px solid #27ae60;
}

.goal-item.behind {
  border-left: 4px solid #e74c3c;
}

.goal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.goal-info h4 {
  margin: 0 0 0.5rem 0;
  color: #2c3e50;
}

.goal-description {
  margin: 0 0 0.5rem 0;
  color: #7f8c8d;
  font-size: 0.9rem;
}

.goal-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.8rem;
}

.goal-type {
  background: #3498db;
  color: white;
  padding: 0.2rem 0.5rem;
  border-radius: 12px;
}

.goal-deadline {
  color: #7f8c8d;
}

.goal-actions {
  display: flex;
  gap: 0.5rem;
}

.goal-progress {
  margin-bottom: 1rem;
}

.progress-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.current-value {
  font-weight: bold;
  color: #2c3e50;
}

.target-value {
  color: #7f8c8d;
}

.progress-percent {
  color: #3498db;
  font-weight: 500;
}

.goal-insights {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  padding: 1rem;
  background: white;
  border-radius: 4px;
}

.insight-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.insight-label {
  font-size: 0.8rem;
  color: #7f8c8d;
}

.insight-value {
  font-weight: 500;
  color: #2c3e50;
}

.history-filters {
  margin-bottom: 1rem;
}

.filter-select {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 4px;
  border-left: 4px solid #bdc3c7;
}

.history-item.completed {
  border-left-color: #27ae60;
}

.history-item.failed {
  border-left-color: #e74c3c;
}

.history-info h4 {
  margin: 0 0 0.5rem 0;
  color: #2c3e50;
}

.history-info p {
  margin: 0 0 0.5rem 0;
  color: #7f8c8d;
  font-size: 0.9rem;
}

.history-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.8rem;
  color: #7f8c8d;
}

.status-badge {
  padding: 0.3rem 0.8rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
  text-transform: capitalize;
}

.status-badge.completed {
  background: #d5f4e6;
  color: #27ae60;
}

.status-badge.failed {
  background: #ffeaea;
  color: #e74c3c;
}

.status-badge.archived {
  background: #f8f9fa;
  color: #7f8c8d;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.modal-header h3 {
  margin: 0;
  color: #2c3e50;
}

.goal-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group label {
  font-weight: 500;
  color: #2c3e50;
}

.form-group input,
.form-group select,
.form-group textarea {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
}

.form-group textarea {
  resize: vertical;
  min-height: 80px;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-small {
  padding: 0.5rem;
  font-size: 0.8rem;
}

.btn-primary {
  background: #3498db;
  color: white;
}

.btn-primary:hover {
  background: #2980b9;
}

.btn-secondary {
  background: #95a5a6;
  color: white;
}

.btn-secondary:hover {
  background: #7f8c8d;
}

.btn-danger {
  background: #e74c3c;
  color: white;
}

.btn-danger:hover {
  background: #c0392b;
}
</style>