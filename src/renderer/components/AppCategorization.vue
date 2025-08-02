<template>
  <div class="app-categorization">
    <div class="header">
      <h2>Application Categorization</h2>
      <div class="actions">
        <button @click="refreshSuggestions" class="btn btn-secondary" :disabled="loading">
          <i class="icon-refresh"></i>
          Refresh Suggestions
        </button>
        <button @click="showBulkActions = !showBulkActions" class="btn btn-primary">
          <i class="icon-settings"></i>
          Bulk Actions
        </button>
      </div>
    </div>

    <!-- Stats Overview -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ stats.categorizedApps }}</div>
        <div class="stat-label">Categorized Apps</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.uncategorizedApps }}</div>
        <div class="stat-label">Uncategorized Apps</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.productivityBreakdown.productive }}</div>
        <div class="stat-label">Productive Apps</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.productivityBreakdown.distracting }}</div>
        <div class="stat-label">Distracting Apps</div>
      </div>
    </div>

    <!-- Bulk Actions Panel -->
    <div v-if="showBulkActions" class="bulk-actions-panel">
      <h3>Bulk Actions</h3>
      <div class="bulk-controls">
        <button @click="applyHighConfidenceSuggestions" class="btn btn-success" :disabled="loading">
          Apply High Confidence Suggestions ({{ highConfidenceSuggestions.length }})
        </button>
        <button @click="exportCategories" class="btn btn-secondary">
          Export Categories
        </button>
        <input type="file" ref="importFile" @change="importCategories" accept=".json" style="display: none">
        <button @click="$refs.importFile.click()" class="btn btn-secondary">
          Import Categories
        </button>
      </div>
    </div>

    <!-- Suggestions Section -->
    <div v-if="suggestions.length > 0" class="suggestions-section">
      <h3>Categorization Suggestions</h3>
      <div class="suggestions-list">
        <div v-for="suggestion in suggestions" :key="suggestion.appName" class="suggestion-card">
          <div class="app-info">
            <div class="app-name">{{ suggestion.appName }}</div>
            <div class="confidence-badge" :class="getConfidenceClass(suggestion.confidence)">
              {{ Math.round(suggestion.confidence * 100) }}% confidence
            </div>
          </div>
          <div class="suggestion-details">
            <div class="suggested-category">
              <label>Category:</label>
              <select v-model="suggestion.suggestedCategory" class="category-select">
                <option v-for="category in availableCategories" :key="category" :value="category">
                  {{ category }}
                </option>
              </select>
            </div>
            <div class="suggested-productivity">
              <label>Productivity:</label>
              <select v-model="suggestion.suggestedProductivity" class="productivity-select">
                <option value="productive">Productive</option>
                <option value="neutral">Neutral</option>
                <option value="distracting">Distracting</option>
              </select>
            </div>
          </div>
          <div class="suggestion-reason">{{ suggestion.reason }}</div>
          <div class="suggestion-actions">
            <button @click="applySuggestion(suggestion)" class="btn btn-sm btn-success">
              Apply
            </button>
            <button @click="dismissSuggestion(suggestion)" class="btn btn-sm btn-secondary">
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Existing Categories -->
    <div class="categories-section">
      <h3>Existing Categories</h3>
      <div class="categories-filter">
        <input v-model="searchTerm" placeholder="Search applications..." class="search-input">
        <select v-model="filterCategory" class="filter-select">
          <option value="">All Categories</option>
          <option v-for="category in availableCategories" :key="category" :value="category">
            {{ category }}
          </option>
        </select>
        <select v-model="filterProductivity" class="filter-select">
          <option value="">All Productivity Levels</option>
          <option value="productive">Productive</option>
          <option value="neutral">Neutral</option>
          <option value="distracting">Distracting</option>
        </select>
      </div>
      
      <div class="categories-list">
        <div v-for="category in filteredCategories" :key="category.appName" class="category-card">
          <div class="app-info">
            <div class="app-name">{{ category.appName }}</div>
            <div class="productivity-badge" :class="category.productivityRating">
              {{ category.productivityRating }}
            </div>
          </div>
          <div class="category-details">
            <div class="category-field">
              <label>Category:</label>
              <select v-model="category.category" @change="updateCategory(category)" class="category-select">
                <option v-for="cat in availableCategories" :key="cat" :value="cat">
                  {{ cat }}
                </option>
              </select>
            </div>
            <div class="productivity-field">
              <label>Productivity:</label>
              <select v-model="category.productivityRating" @change="updateCategory(category)" class="productivity-select">
                <option value="productive">Productive</option>
                <option value="neutral">Neutral</option>
                <option value="distracting">Distracting</option>
              </select>
            </div>
          </div>
          <div class="category-meta">
            <span class="user-defined" v-if="category.userDefined">User Defined</span>
            <span class="auto-categorized" v-else>Auto Categorized</span>
            <span class="updated-date">Updated: {{ formatDate(category.updatedAt) }}</span>
          </div>
          <div class="category-actions">
            <button @click="deleteCategory(category.appName)" class="btn btn-sm btn-danger">
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading Overlay -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <div class="loading-text">{{ loadingText }}</div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AppCategorization',
  data() {
    return {
      categories: [],
      suggestions: [],
      stats: {
        totalApps: 0,
        categorizedApps: 0,
        uncategorizedApps: 0,
        categoryBreakdown: {},
        productivityBreakdown: {
          productive: 0,
          neutral: 0,
          distracting: 0
        }
      },
      availableCategories: [
        'Development', 'Productivity', 'Communication', 'Entertainment',
        'Design', 'Browser', 'System', 'Uncategorized'
      ],
      searchTerm: '',
      filterCategory: '',
      filterProductivity: '',
      showBulkActions: false,
      loading: false,
      loadingText: 'Loading...'
    }
  },
  computed: {
    filteredCategories() {
      return this.categories.filter(category => {
        const matchesSearch = category.appName.toLowerCase().includes(this.searchTerm.toLowerCase())
        const matchesCategory = !this.filterCategory || category.category === this.filterCategory
        const matchesProductivity = !this.filterProductivity || category.productivityRating === this.filterProductivity
        return matchesSearch && matchesCategory && matchesProductivity
      })
    },
    highConfidenceSuggestions() {
      return this.suggestions.filter(s => s.confidence >= 0.8)
    }
  },
  async mounted() {
    await this.loadData()
  },
  methods: {
    async loadData() {
      this.loading = true
      this.loadingText = 'Loading categories and suggestions...'
      
      try {
        await Promise.all([
          this.loadCategories(),
          this.loadSuggestions(),
          this.loadStats()
        ])
      } catch (error) {
        console.error('Failed to load data:', error)
        this.$emit('error', 'Failed to load categorization data')
      } finally {
        this.loading = false
      }
    },
    
    async loadCategories() {
      const categories = await window.electronAPI.invoke('app-categories:get-all')
      this.categories = categories
    },
    
    async loadSuggestions() {
      const suggestions = await window.electronAPI.invoke('app-categories:get-suggestions')
      this.suggestions = suggestions
    },
    
    async loadStats() {
      // This would need to be implemented in the main process
      // For now, calculate from existing data
      this.stats.categorizedApps = this.categories.length
      this.stats.uncategorizedApps = this.suggestions.length
      this.stats.totalApps = this.stats.categorizedApps + this.stats.uncategorizedApps
      
      this.stats.productivityBreakdown = this.categories.reduce((acc, cat) => {
        acc[cat.productivityRating]++
        return acc
      }, { productive: 0, neutral: 0, distracting: 0 })
    },
    
    async refreshSuggestions() {
      this.loading = true
      this.loadingText = 'Refreshing suggestions...'
      
      try {
        await this.loadSuggestions()
        await this.loadStats()
      } catch (error) {
        console.error('Failed to refresh suggestions:', error)
        this.$emit('error', 'Failed to refresh suggestions')
      } finally {
        this.loading = false
      }
    },
    
    async applySuggestion(suggestion) {
      try {
        await window.electronAPI.invoke('app-categories:save', {
          appName: suggestion.appName,
          category: suggestion.suggestedCategory,
          productivityRating: suggestion.suggestedProductivity,
          userDefined: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        
        // Remove from suggestions and add to categories
        this.suggestions = this.suggestions.filter(s => s.appName !== suggestion.appName)
        await this.loadCategories()
        await this.loadStats()
        
        this.$emit('success', `Categorized ${suggestion.appName} as ${suggestion.suggestedCategory}`)
      } catch (error) {
        console.error('Failed to apply suggestion:', error)
        this.$emit('error', 'Failed to apply categorization')
      }
    },
    
    dismissSuggestion(suggestion) {
      this.suggestions = this.suggestions.filter(s => s.appName !== suggestion.appName)
    },
    
    async applyHighConfidenceSuggestions() {
      this.loading = true
      this.loadingText = `Applying ${this.highConfidenceSuggestions.length} suggestions...`
      
      let applied = 0
      for (const suggestion of this.highConfidenceSuggestions) {
        try {
          await this.applySuggestion(suggestion)
          applied++
        } catch (error) {
          console.error(`Failed to apply suggestion for ${suggestion.appName}:`, error)
        }
      }
      
      this.loading = false
      this.$emit('success', `Applied ${applied} categorization suggestions`)
    },
    
    async updateCategory(category) {
      try {
        await window.electronAPI.invoke('app-categories:save', {
          ...category,
          updatedAt: Date.now()
        })
        
        await this.loadStats()
        this.$emit('success', `Updated ${category.appName} categorization`)
      } catch (error) {
        console.error('Failed to update category:', error)
        this.$emit('error', 'Failed to update categorization')
      }
    },
    
    async deleteCategory(appName) {
      if (!confirm(`Are you sure you want to delete the categorization for ${appName}?`)) {
        return
      }
      
      try {
        await window.electronAPI.invoke('app-categories:delete', appName)
        this.categories = this.categories.filter(c => c.appName !== appName)
        await this.loadStats()
        
        this.$emit('success', `Deleted categorization for ${appName}`)
      } catch (error) {
        console.error('Failed to delete category:', error)
        this.$emit('error', 'Failed to delete categorization')
      }
    },
    
    async exportCategories() {
      try {
        const categories = await window.electronAPI.invoke('app-categories:get-all')
        const dataStr = JSON.stringify(categories, null, 2)
        const dataBlob = new Blob([dataStr], { type: 'application/json' })
        
        const link = document.createElement('a')
        link.href = URL.createObjectURL(dataBlob)
        link.download = `app-categories-${new Date().toISOString().split('T')[0]}.json`
        link.click()
        
        this.$emit('success', 'Categories exported successfully')
      } catch (error) {
        console.error('Failed to export categories:', error)
        this.$emit('error', 'Failed to export categories')
      }
    },
    
    async importCategories(event) {
      const file = event.target.files[0]
      if (!file) return
      
      try {
        const text = await file.text()
        const categories = JSON.parse(text)
        
        if (!Array.isArray(categories)) {
          throw new Error('Invalid file format')
        }
        
        this.loading = true
        this.loadingText = 'Importing categories...'
        
        let imported = 0
        for (const category of categories) {
          try {
            await window.electronAPI.invoke('app-categories:save', {
              ...category,
              updatedAt: Date.now()
            })
            imported++
          } catch (error) {
            console.error(`Failed to import category for ${category.appName}:`, error)
          }
        }
        
        await this.loadCategories()
        await this.loadStats()
        
        this.$emit('success', `Imported ${imported} categories`)
      } catch (error) {
        console.error('Failed to import categories:', error)
        this.$emit('error', 'Failed to import categories')
      } finally {
        this.loading = false
        event.target.value = ''
      }
    },
    
    getConfidenceClass(confidence) {
      if (confidence >= 0.8) return 'high-confidence'
      if (confidence >= 0.6) return 'medium-confidence'
      return 'low-confidence'
    },
    
    formatDate(timestamp) {
      return new Date(timestamp).toLocaleDateString()
    }
  }
}
</script>

<style scoped>
.app-categorization {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header h2 {
  margin: 0;
  color: #333;
}

.actions {
  display: flex;
  gap: 10px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 30px;
}

.stat-card {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  border: 1px solid #e9ecef;
}

.stat-value {
  font-size: 2em;
  font-weight: bold;
  color: #007bff;
  margin-bottom: 5px;
}

.stat-label {
  color: #6c757d;
  font-size: 0.9em;
}

.bulk-actions-panel {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 30px;
  border: 1px solid #e9ecef;
}

.bulk-controls {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.suggestions-section, .categories-section {
  margin-bottom: 30px;
}

.suggestions-section h3, .categories-section h3 {
  margin-bottom: 15px;
  color: #333;
}

.categories-filter {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.search-input, .filter-select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.search-input {
  flex: 1;
  min-width: 200px;
}

.suggestions-list, .categories-list {
  display: grid;
  gap: 15px;
}

.suggestion-card, .category-card {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.app-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.app-name {
  font-weight: bold;
  font-size: 1.1em;
  color: #333;
}

.confidence-badge, .productivity-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.8em;
  font-weight: bold;
}

.high-confidence {
  background: #d4edda;
  color: #155724;
}

.medium-confidence {
  background: #fff3cd;
  color: #856404;
}

.low-confidence {
  background: #f8d7da;
  color: #721c24;
}

.productive {
  background: #d4edda;
  color: #155724;
}

.neutral {
  background: #e2e3e5;
  color: #383d41;
}

.distracting {
  background: #f8d7da;
  color: #721c24;
}

.suggestion-details, .category-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-bottom: 15px;
}

.suggestion-details label, .category-details label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  color: #555;
}

.category-select, .productivity-select {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.suggestion-reason {
  color: #6c757d;
  font-style: italic;
  margin-bottom: 15px;
}

.category-meta {
  display: flex;
  gap: 15px;
  margin-bottom: 15px;
  font-size: 0.9em;
  color: #6c757d;
}

.user-defined {
  color: #007bff;
  font-weight: bold;
}

.auto-categorized {
  color: #6c757d;
}

.suggestion-actions, .category-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #545b62;
}

.btn-success {
  background: #28a745;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #1e7e34;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

.loading-text {
  color: white;
  font-size: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.icon-refresh::before {
  content: '🔄';
  margin-right: 5px;
}

.icon-settings::before {
  content: '⚙️';
  margin-right: 5px;
}
</style>