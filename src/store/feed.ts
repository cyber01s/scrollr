import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product } from '../types/product';

interface FeedState {
  cards: Product[];
  currentIndex: number;
  likedIds: Set<string>;
  searchResults: Product[];
  isSearchMode: boolean;
  searchQuery: string;
  isLoading: boolean;
  
  // Actions
  setCards: (cards: Product[]) => void;
  appendCards: (cards: Product[]) => void;
  setCurrentIndex: (index: number) => void;
  toggleLike: (id: string) => void;
  setSearchMode: (isMode: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: Product[]) => void;
  setIsLoading: (loading: boolean) => void;
}

export const useFeedStore = create<FeedState>()(
  persist(
    (set) => ({
      cards: [],
      currentIndex: 0,
      likedIds: new Set<string>(),
      searchResults: [],
      isSearchMode: false,
      searchQuery: '',
      isLoading: false,

      setCards: (cards) => set({ cards }),
      appendCards: (newCards) => set((state) => ({ 
        cards: [...state.cards, ...newCards.filter(nc => !state.cards.find(c => c.id === nc.id))] 
      })),
      setCurrentIndex: (currentIndex) => set({ currentIndex }),
      toggleLike: (id) => set((state) => {
        const nextLikedIds = new Set(state.likedIds);
        if (nextLikedIds.has(id)) {
          nextLikedIds.delete(id);
        } else {
          nextLikedIds.add(id);
        }
        return { likedIds: nextLikedIds };
      }),
      setSearchMode: (isSearchMode) => set({ isSearchMode }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setSearchResults: (searchResults) => set({ searchResults }),
      setIsLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'scrollr-storage',
      partialize: (state) => ({ likedIds: Array.from(state.likedIds) }),
      merge: (persistedState: any, currentState) => ({
        ...currentState,
        likedIds: new Set(persistedState.likedIds || []),
      }),
    }
  )
);
