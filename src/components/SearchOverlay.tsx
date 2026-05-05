import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { useFeedStore } from '../store/feed';
import { MOTION } from '../lib/motion';
import { Product } from '../types/product';

const categories = ['Audio', 'Tech', 'Gaming', 'Cameras', 'Home', 'Fitness', 'Outdoor'];

export default function SearchOverlay() {
  const { isSearchMode, setSearchMode, setSearchResults, cards } = useFeedStore();
  const [query, setQuery] = useState('');
  const [localResults, setLocalResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSearchMode]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query) {
        setIsSearching(true);
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
          const data = await res.json();
          setLocalResults(data);
        } catch (e) {
          console.error(e);
        } finally {
          setIsSearching(false);
        }
      } else {
        setLocalResults([]);
      }
    }, 280);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handleSelect = (product: Product) => {
    setSearchResults([product]); // Insert at top or jump to
    setSearchMode(false);
  };

  return (
    <AnimatePresence>
      {isSearchMode && (
        <motion.div 
          className="fixed inset-0 z-50 flex flex-col pt-4 safe-top"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div 
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={() => setSearchMode(false)}
          />

          {/* Search Content */}
          <div className="relative z-10 w-full px-4">
            <motion.div 
              className="w-full h-11 bg-white/10 border border-white/25 rounded-pill flex items-center px-4"
              initial={{ y: -60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -60, opacity: 0 }}
              transition={MOTION.spring}
            >
              <Search className="w-5 h-5 text-white/40 mr-3" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="search products..."
                className="flex-1 bg-transparent border-none outline-none text-[15px] font-light placeholder:text-white/40"
              />
              {query && (
                <button onClick={() => setQuery('')}>
                  <X className="w-4 h-4 text-white/60" />
                </button>
              )}
            </motion.div>

            {/* Category Pills */}
            <motion.div 
              className="flex gap-2 overflow-x-auto py-4 scrollbar-hide no-scrollbar"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {categories.map((cat) => (
                <button
                  key={cat}
                  className="px-4 py-1.5 rounded-pill text-[12px] font-normal transition-colors border border-white/10 whitespace-nowrap bg-transparent text-white/50 active:bg-white active:text-black"
                  onClick={() => setQuery(cat)}
                >
                  {cat}
                </button>
              ))}
            </motion.div>

            {/* Results List */}
            <div className="mt-4 flex flex-col gap-2 max-h-[60vh] overflow-y-auto overflow-x-hidden no-scrollbar">
              {isSearching ? (
                // Skeletons
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="w-full h-[52px] flex items-center gap-3 animate-pulse opacity-20">
                    <div className="w-10 h-10 bg-white rounded-card" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-white w-1/2 rounded" />
                      <div className="h-2 bg-white w-1/4 rounded" />
                    </div>
                  </div>
                ))
              ) : localResults.length > 0 ? (
                localResults.map((product, i) => (
                  <motion.button
                    key={product.id + i}
                    className="w-full h-[52px] flex items-center gap-3 text-left"
                    initial={{ x: -10, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => handleSelect(product)}
                  >
                    <img src={product.imageUrl} className="w-10 h-10 object-cover rounded-card" alt="" />
                    <div className="flex-1 truncate">
                      <div className="text-[14px] font-light truncate">{product.name}</div>
                      <div className="text-[11px] opacity-45">{product.category}</div>
                    </div>
                    <div className="text-[13px] font-normal">${product.price}</div>
                  </motion.button>
                ))
              ) : query && (
                <div className="py-8 text-center text-[13px] opacity-40">
                  nothing found for '{query}'
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
