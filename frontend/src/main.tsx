import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import './index.css'

import AppShell from './components/layout/AppShell'
import ChatPage from './pages/ChatPage'
import ProjectsPage from './pages/ProjectsPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import TalentPage from './pages/TalentPage'
import TalentListsPage from './pages/TalentListsPage'
import TalentListDetailPage from './pages/TalentListDetailPage'
import ResearchPage from './pages/ResearchPage'
import SettingsPage from './pages/SettingsPage'
import ErrorBoundary from './components/ErrorBoundary'
import { reportError } from './lib/api/errors'

// Catch unhandled JS errors and promise rejections — these don't go through React,
// so ErrorBoundary won't catch them. Forward them to eagle.log via the backend.
window.addEventListener('error', (e) => {
  reportError({ message: e.message, source: `${e.filename}:${e.lineno}`, stack: e.error?.stack, context: 'window.onerror' })
})
window.addEventListener('unhandledrejection', (e) => {
  const err = e.reason instanceof Error ? e.reason : new Error(String(e.reason))
  reportError({ message: err.message, stack: err.stack, context: 'unhandledrejection' })
})

// Tauri's dragDropEnabled=false delegates drag-drop to the webview. We block the
// browser default (navigating away to the dropped file) globally so that
// drops outside our explicit drop zones simply do nothing instead of replacing
// the app with a PDF viewer.
window.addEventListener('dragover', (e) => e.preventDefault())
window.addEventListener('drop', (e) => e.preventDefault())

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <ChatPage /> },
      { path: '/projects', element: <ProjectsPage /> },
      { path: '/projects/:id', element: <ProjectDetailPage /> },
      { path: '/talent', element: <TalentPage /> },
      { path: '/talent-lists', element: <TalentListsPage /> },
      { path: '/talent-lists/:id', element: <TalentListDetailPage /> },
      { path: '/research', element: <ResearchPage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary context="App">
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </ErrorBoundary>
  </StrictMode>
)
