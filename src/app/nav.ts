import { Bell, ListTodo, Settings, SquareKanban, Users, type LucideIcon } from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  /** Shown instead of `label` in the mobile tab bar, where five items leave ~72px each. */
  shortLabel?: string
  icon: LucideIcon
}

export const primaryNav: NavItem[] = [
  { to: '/', label: 'Boards', icon: SquareKanban },
  { to: '/teams', label: 'Teams', icon: Users },
  { to: '/my-tasks', label: 'My Tasks', shortLabel: 'Tasks', icon: ListTodo },
  { to: '/notifications', label: 'Notifications', shortLabel: 'Inbox', icon: Bell },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export type RouteHandle = {
  title: string
  /** Renders without a session. Only for pages that reveal nothing private (e.g. 404). */
  public?: boolean
}

export function isRouteHandle(value: unknown): value is RouteHandle {
  return (
    typeof value === 'object' &&
    value !== null &&
    'title' in value &&
    typeof (value as { title: unknown }).title === 'string'
  )
}
