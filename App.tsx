
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppTab } from './types';
import { HabitTracker } from './components/HabitTracker';
import { ClinicalSystem } from './components/ClinicalSystem';
import { ResearchAssistant } from './components/ResearchAssistant';

interface TabConfig {
  id: AppTab;
  label: string;
  icon: string;
}

const TAB_COMPONENTS: Record<AppTab, React.ReactNode> = {
  [AppTab.HABITS]: <HabitTracker />,
  [AppTab.CLINICAL]: <ClinicalSystem />,
  [AppTab.RESEARCH]: <ResearchAssistant />,
};

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("App Crash Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 bg-red-500/20 rounded-3xl flex items-center justify-center text-red-500 mb-6">
            <i className="fa-solid fa-triangle-exclamation text-4xl"></i>
          </div>
          <h1 className="text-2xl font-black text-white mb-4">应用运行遇到错误</h1>
          <p className="text-slate-400 max-w-md mb-8">
            可能是由于本地存储的数据损坏导致的。您可以尝试清除浏览器缓存或点击下方按钮重置应用。
          </p>
          <button 
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20"
          >
            重置并重新加载
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(() => {
    const saved = localStorage.getItem('med-active-tab');
    return (saved as AppTab) || AppTab.CLINICAL;
  });
  
  const [tabs, setTabs] = useState<TabConfig[]>([
    { id: AppTab.HABITS, label: '习惯养成', icon: 'fa-calendar-check' },
    { id: AppTab.CLINICAL, label: '规培助手', icon: 'fa-user-doctor' },
    { id: AppTab.RESEARCH, label: '科研辅助', icon: 'fa-microscope' },
  ]);

  useEffect(() => {
    localStorage.setItem('med-active-tab', activeTab);
  }, [activeTab]);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    setTabs(prevTabs => {
      const newTabs = [...prevTabs];
      const draggedItem = newTabs[draggedIndex];
      newTabs.splice(draggedIndex, 1);
      newTabs.splice(index, 0, draggedItem);
      return newTabs;
    });
    setDraggedIndex(index);
  }, [draggedIndex]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
  }, []);

  const handleDownloadData = useCallback(() => {
    try {
      const data = {
        habits: JSON.parse(localStorage.getItem('med-habits') || '[]'),
        clinical: {
          analysis: JSON.parse(localStorage.getItem('med-clinical-analysis') || 'null'),
          chat: JSON.parse(localStorage.getItem('med-clinical-chat') || '[]')
        },
        research: {
          insight: JSON.parse(localStorage.getItem('med-research-insight') || 'null'),
          topic: localStorage.getItem('med-research-topic') || ''
        },
        timestamp: new Date().toISOString(),
        version: "1.1.0"
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `MedQuest_Pro_Full_Data_${new Date().toLocaleDateString()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to export data", e);
      alert("导出数据失败，存储的数据可能已损坏。");
    }
  }, []);

  const ActiveComponent = useMemo(() => TAB_COMPONENTS[activeTab], [activeTab]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen pb-20 md:pb-0 md:pt-16 bg-slate-50">
      {/* Top Navbar for Desktop */}
      <header className="hidden md:flex fixed top-0 w-full bg-white/80 backdrop-blur-xl border-b border-slate-200 z-50 h-16 items-center px-8 justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <i className="fa-solid fa-briefcase-medical text-xl"></i>
          </div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight">MedQuest <span className="text-indigo-600">Pro</span></h1>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={handleDownloadData}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-black transition-all shadow-md active:scale-95"
          >
            <i className="fa-solid fa-download"></i>
            导出全部数据
          </button>
          
          <div className="h-6 w-px bg-slate-200 mx-2"></div>

          <div className="flex items-center gap-2 mr-4 px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <i className="fa-solid fa-grip-lines"></i> 拖动标签可排序
          </div>
          <nav className="flex gap-2">
            {tabs.map((tab, index) => (
              <div
                key={tab.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`cursor-move transition-opacity ${draggedIndex === index ? 'opacity-50' : 'opacity-100'}`}
              >
                <TabButton 
                  active={activeTab === tab.id} 
                  onClick={() => setActiveTab(tab.id)}
                  icon={tab.icon}
                  label={tab.label}
                />
              </div>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-4 md:pt-8 px-2 max-w-[1600px] mx-auto">
        <div key={activeTab} className="animate-fadeIn">
          {ActiveComponent}
        </div>
      </main>

      {/* Bottom Navbar for Mobile */}
      <nav className="md:hidden fixed bottom-0 w-full bg-white border-t border-slate-200 grid grid-cols-4 h-16 z-50">
        {tabs.map((tab) => (
          <MobileTabButton 
            key={tab.id}
            active={activeTab === tab.id} 
            onClick={() => setActiveTab(tab.id)}
            icon={tab.icon}
            label={tab.label.substring(0, 2)}
          />
        ))}
        <button 
          onClick={handleDownloadData}
          className="flex flex-col items-center justify-center gap-1 text-slate-400"
        >
          <i className="fa-solid fa-download text-lg"></i>
          <span className="text-[10px] font-black uppercase tracking-wider">导出</span>
        </button>
      </nav>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        [draggable] {
          user-select: none;
        }
      `}} />
    </div>
    </ErrorBoundary>
  );
};

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}

const TabButton: React.FC<TabButtonProps> = React.memo(({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all duration-300 font-bold text-sm border-2 ${
      active 
        ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' 
        : 'text-slate-500 bg-white border-transparent hover:border-slate-200 hover:text-slate-800'
    }`}
  >
    <i className={`fa-solid ${icon}`}></i>
    {label}
  </button>
));

const MobileTabButton: React.FC<TabButtonProps> = React.memo(({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center justify-center gap-1 transition-colors ${
      active ? 'text-indigo-600' : 'text-slate-400'
    }`}
  >
    <i className={`fa-solid ${icon} text-lg`}></i>
    <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
  </button>
));

export default App;
