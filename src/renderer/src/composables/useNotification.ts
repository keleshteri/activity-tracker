import { ref } from 'vue'

export interface Notification {
  id: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration?: number
  persistent?: boolean
}

const notifications = ref<Notification[]>([])
let notificationId = 0

export function useNotification() {
  const showNotification = (
    message: string,
    type: Notification['type'] = 'info',
    duration: number = 5000,
    persistent: boolean = false
  ) => {
    const id = `notification-${++notificationId}`
    const notification: Notification = {
      id,
      message,
      type,
      duration,
      persistent
    }

    notifications.value.push(notification)

    // Auto-remove notification after duration (unless persistent)
    if (!persistent && duration > 0) {
      setTimeout(() => {
        removeNotification(id)
      }, duration)
    }

    return id
  }

  const removeNotification = (id: string) => {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index > -1) {
      notifications.value.splice(index, 1)
    }
  }

  const clearAllNotifications = () => {
    notifications.value = []
  }

  const getNotifications = () => notifications.value

  return {
    notifications,
    showNotification,
    removeNotification,
    clearAllNotifications,
    getNotifications
  }
}