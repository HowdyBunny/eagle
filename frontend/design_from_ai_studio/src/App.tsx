/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { TalentPool } from './views/TalentPool';
import { Projects } from './views/Projects';
import { Research } from './views/Research';
import { Chat } from './views/Chat';
import { Settings } from './views/Settings';
import { motion, AnimatePresence } from 'motion/react';
import { ViewType } from './types';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>('research');

  return (
    <div className="flex h-screen w-full bg-surface text-on-surface font-sans overflow-hidden">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
      <main className="flex-1 flex flex-col min-w-0 bg-surface relative">
        <TopBar currentView={currentView} />
        <div className="flex-1 overflow-y-auto relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="min-h-full flex flex-col"
            >
              {currentView === 'chat' && <Chat />}
              {currentView === 'projects' && <Projects />}
              {currentView === 'talent' && <TalentPool />}
              {currentView === 'research' && <Research />}
              {currentView === 'settings' && <Settings />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
