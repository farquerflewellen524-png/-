import React from 'react';
import { HistoryItem, ClinicalAnalysis, ResearchInsight } from '../types';
import { downloadHistoryItem } from '../lib/downloadUtils';

interface HistorySectionProps {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  type: 'clinical' | 'research';
}

export const HistorySection: React.FC<HistorySectionProps> = ({ history, onSelect, type }) => {
  const filteredHistory = history.filter(item => item.type === type);

  if (filteredHistory.length === 0) return null;

  return (
    <div className="mt-12 space-y-6">
      <div className="flex items-center justify-between px-4">
        <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
          <i className="fa-solid fa-clock-rotate-left text-indigo-500"></i>
          最近使用记录
        </h3>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent 3 Records</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredHistory.map((item) => (
          <div
            key={item.id}
            className="bg-white p-5 rounded-[1.5rem] border border-slate-100 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-100/50 transition-all text-left group"
          >
            <div className="flex flex-col h-full">
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                {new Date(item.timestamp).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
              <h4 className="font-bold text-slate-800 text-sm line-clamp-2 group-hover:text-indigo-600 transition-colors mb-4">
                {item.title}
              </h4>
              <div className="mt-auto flex items-center gap-2">
                <button
                  onClick={() => onSelect(item)}
                  className="flex-1 py-2.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-eye"></i> 浏览
                </button>
                <button
                  onClick={() => downloadHistoryItem(item)}
                  className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-800 text-slate-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-download"></i> 下载
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
