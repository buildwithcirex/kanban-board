import { Bell, ListTodo, Settings, SquareKanban, type LucideIcon } from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
}

export const primaryNav: NavItem[] = [
  { to: '/', label: 'Boards', icon: SquareKanban },
  { to: '/my-tasks', label: 'My Tasks', icon: ListTodo },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export type RouteHandle = {
  title: string
}

export function isRouteHandle(value: unknown): value is RouteHandle {
  return (
    typeof value === 'object' &&
    value !== null &&
    'title' in value &&
    typeof (value as { title: unknown }).title === 'string'
  )
}
