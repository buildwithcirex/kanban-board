import type { RouteObject } from 'react-router'
import { BoardsPage } from '@/features/boards/BoardsPage'
import { MyTasksPage } from '@/features/my-tasks/MyTasksPage'
import { NotificationsPage } from '@/features/notifications/NotificationsPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { TeamPage } from '@/features/teams/TeamPage'
import { TeamsPage } from '@/features/teams/TeamsPage'
import { BoardPage } from '@/features/boards/BoardPage'
import { AppShell } from './AppShell'
import type { RouteHandle } from './nav'
import { NotFoundPage } from './NotFoundPage'
import { RouteErrorPage } from './RouteErrorPage'

const handle = (title: string, options?: { public?: boolean }): RouteHandle => ({
  title,
  ...options,
})

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
      { path: 'teams', element: <TeamsPage />, handle: handle('Teams') },
      { path: 't/:teamId', element: <TeamPage />, handle: handle('Team') },
      { path: 't/:teamId/b/:boardId', element: <BoardPage />, handle: handle('Board') },
      { path: '*', element: <NotFoundPage />, handle: handle('Not found', { public: true }) },
    ],
  },
]
