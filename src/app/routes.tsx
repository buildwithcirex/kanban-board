import type { RouteObject } from 'react-router'
import { BoardsPage } from '@/features/boards/BoardsPage'
import { MyTasksPage } from '@/features/my-tasks/MyTasksPage'
import { NotificationsPage } from '@/features/notifications/NotificationsPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { AppShell } from './AppShell'
import type { RouteHandle } from './nav'
import { NotFoundPage } from './NotFoundPage'
import { RouteErrorPage } from './RouteErrorPage'

const handle = (title: string): RouteHandle => ({ title })

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <BoardsPage />, handle: handle('Boards') },
      { path: 'my-tasks', element: <MyTasksPage />, handle: handle('My Tasks') },
      { path: 'notifications', element: <NotificationsPage />, handle: handle('Notifications') },
      { path: 'settings', element: <SettingsPage />, handle: handle('Settings') },
      { path: '*', element: <NotFoundPage />, handle: handle('Not found') },
    ],
  },
]
