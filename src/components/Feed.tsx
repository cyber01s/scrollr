import React, { useEffect, useRef, useCallback } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import ProductCard from './ProductCard';
import { useFeedStore } from '../store/feed';
import { Product } from '../types/product';

export default function Feed() {
  const { cards, appendCards, setCurrentIndex, isSearchMode, searchResults } = useFeedStore();
  const observerTarget = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchFeed = async ({ pageParam = 0 }) => {
    const res = await fetch(`/api/feed?page=${pageParam}`);
    return res.json();
  };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isError,
    isLoading
  } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: fetchFeed,
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => 
      (lastPage && Array.isArray(lastPage) && lastPage.length > 0) ? allPages.length : undefined,
  });

  useEffect(() => {
    if (data) {
      const allProducts = data.pages.flat();
      if (allProducts.length > 0) {
        appendCards(allProducts);
      }
    }
  }, [data, appendCards]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const scrollY = containerRef.current.scrollTop;
    const index = Math.round(scrollY / window.innerHeight);
    setCurrentIndex(index);

    // Infinite scroll trigger: when we are 4 cards from the end
    if (index >= cards.length - 4 && !isFetchingNextPage && hasNextPage) {
      fetchNextPage();
    }
  }, [cards.length, isFetchingNextPage, hasNextPage, fetchNextPage, setCurrentIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  const displayCards = isSearchMode && searchResults.length > 0 ? searchResults : cards;

  if (isLoading && displayCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full bg-black text-center p-8">
        <div className="text-[14px] opacity-40 animate-pulse">Initializing Scrollr...</div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="snap-container scrollbar-hide no-scrollbar"
    >
      {displayCards.map((product, index) => (
        <ProductCard 
          key={product.id + index} 
          product={product} 
          index={index} 
        />
      ))}
      
      {/* Loading state indicator for infinite scroll (optional, user asked for seamless) */}
      <div ref={observerTarget} className="h-10 w-full" />
    </div>
  );
}
