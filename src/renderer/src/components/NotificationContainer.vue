<template>
  <div class="notification-container">
    <transition-group name="notification" tag="div">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        :class="[
          'notification',
          `notification--${notification.type}`
        ]"
        @click="removeNotification(notification.id)"
      >
        <div class="notification__icon">
          <i :class="getIconClass(notification.type)"></i>
        </div>
        <div class="notification__content">
          <p class="notification__message">{{ notification.message }}</p>
        </div>
        <button 
          class="notification__close"
          @click.stop="removeNotification(notification.id)"
          aria-label="Close notification"
        >
          &times;
        </button>
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { useNotification } from '../composables/useNotification'

const { notifications, removeNotification } = useNotification()

const getIconClass = (type: string) => {
  switch (type) {
    case 'success':
      return 'icon-check-circle'
    case 'error':
      return 'icon-x-circle'
    case 'warning':
      return 'icon-alert-triangle'
    case 'info':
    default:
      return 'icon-info-circle'
  }
}
</script>

<style scoped>
.notification-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  max-width: 400px;
  width: 100%;
}

.notification {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  margin-bottom: 12px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-left: 4px solid #3498db;
  cursor: pointer;
  transition: all 0.3s ease;
  max-width: 100%;
  word-wrap: break-word;
}

.notification:hover {
  transform: translateX(-4px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.notification--success {
  border-left-color: #27ae60;
}

.notification--success .notification__icon {
  color: #27ae60;
}

.notification--error {
  border-left-color: #e74c3c;
}

.notification--error .notification__icon {
  color: #e74c3c;
}

.notification--warning {
  border-left-color: #f39c12;
}

.notification--warning .notification__icon {
  color: #f39c12;
}

.notification--info {
  border-left-color: #3498db;
}

.notification--info .notification__icon {
  color: #3498db;
}

.notification__icon {
  flex-shrink: 0;
  font-size: 20px;
  margin-top: 2px;
}

.notification__content {
  flex: 1;
  min-width: 0;
}

.notification__message {
  margin: 0;
  color: #2c3e50;
  font-size: 14px;
  line-height: 1.4;
  word-wrap: break-word;
}

.notification__close {
  flex-shrink: 0;
  background: none;
  border: none;
  font-size: 20px;
  color: #7f8c8d;
  cursor: pointer;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.notification__close:hover {
  background: #ecf0f1;
  color: #2c3e50;
}

/* Transition animations */
.notification-enter-active {
  transition: all 0.3s ease;
}

.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.notification-move {
  transition: transform 0.3s ease;
}

/* Icon classes (using simple text-based icons for compatibility) */
.icon-check-circle::before {
  content: '✓';
}

.icon-x-circle::before {
  content: '✗';
}

.icon-alert-triangle::before {
  content: '⚠';
}

.icon-info-circle::before {
  content: 'ℹ';
}

/* Responsive design */
@media (max-width: 480px) {
  .notification-container {
    top: 10px;
    right: 10px;
    left: 10px;
    max-width: none;
  }
  
  .notification {
    padding: 12px;
    margin-bottom: 8px;
  }
  
  .notification__message {
    font-size: 13px;
  }
}
</style>