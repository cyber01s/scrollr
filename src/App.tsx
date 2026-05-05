/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Feed from './components/Feed';
import TopBar from './components/TopBar';
import SearchOverlay from './components/SearchOverlay';
import { motion, AnimatePresence } from 'framer-motion';
import { useFeedStore } from './store/feed';

const queryClient = new QueryClient();

export default function App() {
  const isSearchMode = useFeedStore((state) => state.isSearchMode);

  return (
    <QueryClientProvider client={queryClient}>
      <main 
        className="fixed inset-0 bg-black overflow-hidden select-none"
        style={{ touchAction: 'none' }}
      >
        <TopBar />
        
        <motion.div
          animate={{ 
            scale: isSearchMode ? 0.96 : 1,
            filter: isSearchMode ? 'blur(8px)' : 'blur(0px)'
          }}
          transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1.0] }}
          className="w-full h-full"
        >
          <Feed />
        </motion.div>

        <SearchOverlay />
        
        {/* PWA Manifest link added dynamically if needed, but we focus on UI */}
      </main>
    </QueryClientProvider>
  );
}
