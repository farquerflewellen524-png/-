import { useState, useCallback, useEffect } from 'react';
import { HistoryItem } from '../types';

export const useHistory = () => {
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('med-usage-history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse history", e);
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('med-usage-history', JSON.stringify(history));
  }, [history]);

  const addHistoryItem = useCallback((item: Omit<HistoryItem, 'id' | 'timestamp'>) => {
    const newItem: HistoryItem = {
      ...item,
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
    };

    setHistory(prev => {
      const filtered = prev.filter(h => h.title !== item.title || h.type !== item.type);
      const newHistory = [newItem, ...filtered].slice(0, 3);
      return newHistory;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return { history, addHistoryItem, clearHistory };
};
