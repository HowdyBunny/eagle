import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import './index.css'

import AppShell from './components/layout/AppShell'
import ChatPage from './pages/ChatPage'
import ProjectsPage from './pages/ProjectsPage'
import TalentPage from './pages/TalentPage'
import ResearchPage from './pages/ResearchPage'
import SettingsPage from './pages/SettingsPage'

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <ChatPage /> },
      { path: '/projects', element: <ProjectsPage /> },
      { path: '/talent', element: <TalentPage /> },
      { path: '/research', element: <ResearchPage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>
  </StrictMode>
)
