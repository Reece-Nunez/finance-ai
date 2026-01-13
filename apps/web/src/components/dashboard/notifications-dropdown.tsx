'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Bell,
  AlertTriangle,
  TrendingDown,
  RefreshCw,
  DollarSign,
  Check,
  Loader2,
  RotateCw,
  X,
  Trash2,
  ArrowLeftRight,
} from 'lucide-react'
import { SterlingIcon } from '@/components/ui/sterling-icon'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  read: boolean
  action_url?: string
  created_at: string
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'low_balance':
      return <AlertTriangle className="h-4 w-4 text-amber-500" />
    case 'overdraft':
      return <AlertTriangle className="h-4 w-4 text-red-600" />
    case 'budget_warning':
      return <TrendingDown className="h-4 w-4 text-red-500" />
    case 'recurring_payment':
      return <RefreshCw className="h-4 w-4 text-purple-500" />
    case 'ai_suggestion':
      return <SterlingIcon size="sm" />
    case 'unusual_spending':
      return <DollarSign className="h-4 w-4 text-orange-500" />
    case 'large_withdrawal':
      return <TrendingDown className="h-4 w-4 text-orange-500" />
    case 'large_deposit':
      return <DollarSign className="h-4 w-4 text-emerald-500" />
    case 'transfer_detection':
      return <ArrowLeftRight className="h-4 w-4 text-blue-500" />
    default:
      return <Bell className="h-4 w-4 text-muted-foreground" />
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'urgent':
      return 'border-l-4 border-l-red-500'
    case 'high':
      return 'border-l-4 border-l-amber-500'
    case 'normal':
      return 'border-l-4 border-l-blue-500'
    default:
      return 'border-l-4 border-l-gray-300'
  }
}

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export function NotificationsDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [open, setOpen] = useState(false)

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications')
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications)
        setUnreadCount(data.unreadCount)
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    // Poll for new notifications every minute
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const markAsRead = async (id: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read', notificationId: id }),
      })
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      })
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }

  const refreshNotifications = async () => {
    setRefreshing(true)
    try {
      // Generate new notifications
      await fetch('/api/notifications/generate', { method: 'POST' })
      // Then fetch updated list
      await fetchNotifications()
    } catch (error) {
      console.error('Failed to refresh notifications:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering the parent click handler
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', notificationId: id }),
      })
      const wasUnread = notifications.find(n => n.id === id)?.read === false
      setNotifications(prev => prev.filter(n => n.id !== id))
      if (wasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Failed to delete notification:', error)
    }
  }

  const clearAllNotifications = async () => {
    try {
      // Delete all notifications one by one (or we could add a bulk delete to API)
      await Promise.all(
        notifications.map(n =>
          fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', notificationId: n.id }),
          })
        )
      )
      setNotifications([])
      setUnreadCount(0)
    } catch (error) {
      console.error('Failed to clear notifications:', error)
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-medium text-white"
              aria-hidden="true"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 max-h-96 overflow-y-auto">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <h3 className="font-semibold">Notifications</h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={refreshNotifications}
              disabled={refreshing}
              aria-label="Refresh notifications"
            >
              <RotateCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-emerald-600"
                onClick={markAllAsRead}
              >
                <Check className="mr-1 h-3 w-3" />
                Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={clearAllNotifications}
                title="Clear all notifications"
              >
                <Trash2 className="mr-1 h-3 w-3" />
                Clear all
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8" role="status" aria-live="polite">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Loading notifications</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Bell className="h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">No notifications yet</p>
            <p className="text-xs text-muted-foreground">
              We&apos;ll notify you about important updates
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => (
              <button
                type="button"
                key={notification.id}
                className={`flex gap-3 p-3 transition-colors hover:bg-muted/50 cursor-pointer group relative text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${
                  !notification.read ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : ''
                } ${getPriorityColor(notification.priority)}`}
                onClick={() => {
                  if (!notification.read) markAsRead(notification.id)
                  if (notification.action_url) {
                    window.location.href = notification.action_url
                    setOpen(false)
                  }
                }}
                aria-label={`${notification.title}: ${notification.message}`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!notification.read ? 'font-medium' : ''}`}>
                    {notification.title}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {notification.message}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatTimeAgo(notification.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!notification.read && (
                    <div className="flex h-2 w-2 rounded-full bg-emerald-500" />
                  )}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => deleteNotification(notification.id, e)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') deleteNotification(notification.id, e) }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                    aria-label={`Delete notification: ${notification.title}`}
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-red-600" aria-hidden="true" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
