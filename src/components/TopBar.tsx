import React from 'react';
import { Search } from 'lucide-react';
import { useFeedStore } from '../store/feed';
import { motion } from 'framer-motion';

export default function TopBar() {
  const setSearchMode = useFeedStore((state) => state.setSearchMode);

  return (
    <div className="fixed top-0 left-0 w-full h-[52px] flex items-center justify-between px-5 z-40 safe-top">
      <motion.div 
        className="text-[12px] font-light tracking-[0.15em] text-white uppercase"
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        SCROLLR
      </motion.div>
      
      <motion.button 
        onClick={() => setSearchMode(true)}
        className="p-2"
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        <Search className="w-5 h-5 text-white" />
      </motion.button>
    </div>
  );
}
