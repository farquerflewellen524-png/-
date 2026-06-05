
import React, { useState, useEffect } from 'react';
import { Habit, HabitCategory } from '../types';

const FINANCE_QUOTES = [
  { text: "复利是世界的第八大奇迹。知之者赚，不知之者被赚。", author: "爱因斯坦", source: "《理财启蒙》" },
  { text: "不要把所有的鸡蛋放在一个篮子里。", author: "托宾", source: "《现代投资组合理论》" },
  { text: "穷人和中产阶级为钱而工作，富人让钱为他们工作。", author: "罗伯特·清崎", source: "《富爸爸穷爸爸》" },
  { text: "如果你没有找到一个当你睡觉时还能挣钱的方法，你将一直工作到死。", author: "巴菲特", source: "《滚雪球》" },
  { text: "买入一家伟大公司的股票，然后坐等时间发挥魔力。", author: "查理·芒格", source: "《穷查理宝典》" },
  { text: "投资的第一原则是不要亏钱，第二原则是记住第一原则。", author: "沃伦·巴菲特", source: "《价值投资》" }
];

const DAYS_SHORT = ['日', '一', '二', '三', '四', '五', '六'];

export const HabitTracker: React.FC = React.memo(() => {
  const [habits, setHabits] = useState<Habit[]>(() => {
    try {
      const saved = localStorage.getItem('med-habits');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse habits from localStorage", e);
    }
    return [
      { id: '1', name: '晨间查房交班', category: HabitCategory.PATIENT, completedDates: [], scheduledDays: [1,2,3,4,5], time: '08:00' },
      { id: '2', name: '晨起喝水', category: HabitCategory.LIFE, completedDates: [], scheduledDays: [0,1,2,3,4,5,6], time: '07:30' },
      { id: '3', name: '深蹲训练', category: HabitCategory.FITNESS, completedDates: [], scheduledDays: [1,3,5], time: '18:00' },
      { id: '4', name: '阅读文献', category: HabitCategory.RESEARCH, completedDates: [], scheduledDays: [1,2,3,4,5], time: '21:00' },
    ];
  });

  const [newHabitName, setNewHabitName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<HabitCategory>(HabitCategory.PATIENT);
  const [selectedDays, setSelectedDays] = useState<number[]>([0,1,2,3,4,5,6]);
  const [habitTime, setHabitTime] = useState('08:00');
  const [activeQuote, setActiveQuote] = useState(FINANCE_QUOTES[0]);

  useEffect(() => {
    const handler = setTimeout(() => {
      localStorage.setItem('med-habits', JSON.stringify(habits));
    }, 500);
    return () => clearTimeout(handler);
  }, [habits]);

  useEffect(() => {
    const randomQuote = FINANCE_QUOTES[Math.floor(Math.random() * FINANCE_QUOTES.length)];
    setActiveQuote(randomQuote);
  }, []); // Only on mount

  const addHabit = () => {
    if (!newHabitName.trim()) return;
    const newHabit: Habit = {
      id: Date.now().toString(),
      name: newHabitName,
      category: selectedCategory,
      completedDates: [],
      scheduledDays: selectedDays,
      time: habitTime
    };
    setHabits([...habits, newHabit]);
    setNewHabitName('');
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const toggleHabitCompletion = (id: string) => {
    const today = new Date().toISOString().split('T')[0];
    setHabits(habits.map(h => {
      if (h.id === id) {
        const isDone = h.completedDates.includes(today);
        return {
          ...h,
          completedDates: isDone 
            ? h.completedDates.filter(d => d !== today) 
            : [...h.completedDates, today]
        };
      }
      return h;
    }));
  };

  const deleteHabit = (id: string) => {
    setHabits(habits.filter(h => h.id !== id));
  };

  const getStreak = (completedDates: string[]) => {
    if (!completedDates.length) return 0;
    const sorted = [...completedDates].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    let streak = 0;
    let current = new Date();
    current.setHours(0, 0, 0, 0);
    
    // Check if today or yesterday was the last completion
    const lastDate = new Date(sorted[0]);
    lastDate.setHours(0, 0, 0, 0);
    
    const diff = (current.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diff > 1) return 0; // Streak broken

    for (let i = 0; i < sorted.length; i++) {
      const d = new Date(sorted[i]);
      d.setHours(0, 0, 0, 0);
      if (i === 0) {
        streak = 1;
      } else {
        const prev = new Date(sorted[i-1]);
        prev.setHours(0, 0, 0, 0);
        const dayDiff = (prev.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
        if (dayDiff === 1) streak++;
        else break;
      }
    }
    return streak;
  };

  const getCompletionRate = (habit: Habit) => {
    if (!habit.scheduledDays?.length) return 0;
    // Simple calculation: total completions / total days since first completion (or last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentCompletions = habit.completedDates.filter(d => new Date(d) >= thirtyDaysAgo).length;
    
    // Total scheduled days in last 30 days
    let scheduledCount = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      if (habit.scheduledDays.includes(d.getDay())) scheduledCount++;
    }
    
    return scheduledCount ? Math.round((recentCompletions / scheduledCount) * 100) : 0;
  };

  const getCategoryTheme = (cat: HabitCategory) => {
    switch (cat) {
      case HabitCategory.PATIENT: return { bg: "bg-rose-500", icon: "fa-user-md", label: "医路成长" };
      case HabitCategory.LIFE: return { bg: "bg-blue-500", icon: "fa-mug-hot", label: "生活美学" };
      case HabitCategory.FITNESS: return { bg: "bg-orange-500", icon: "fa-dumbbell", label: "周训练计划" };
      case HabitCategory.RESEARCH: return { bg: "bg-purple-500", icon: "fa-microscope", label: "科研先锋" };
      case HabitCategory.FINANCE: return { bg: "bg-emerald-600", icon: "fa-coins", label: "财富增值" };
      default: return { bg: "bg-slate-500", icon: "fa-check", label: "常规打卡" };
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 animate-fadeIn space-y-10">
      {/* Financial Wisdom Hero */}
      <section className="relative rounded-[2.5rem] overflow-hidden shadow-2xl bg-emerald-950 p-10 md:p-16 border-4 border-emerald-900/50">
        <div className="relative z-10 flex flex-col items-center text-center space-y-6">
          <div className="px-4 py-1.5 bg-emerald-500/20 backdrop-blur-md rounded-full text-[10px] font-black text-emerald-300 uppercase tracking-[0.3em] border border-emerald-500/30">
            Professional Financial Wisdom
          </div>
          <blockquote className="max-w-3xl">
            <p className="text-2xl md:text-4xl font-black text-white leading-tight italic tracking-tight">
              “{activeQuote.text}”
            </p>
            <footer className="mt-6 flex flex-col items-center">
              <span className="text-emerald-400 font-bold text-lg">{activeQuote.author}</span>
              <span className="text-emerald-600 text-sm mt-1">{activeQuote.source}</span>
            </footer>
          </blockquote>
        </div>
      </section>

      {/* Task Add Section with Scheduling */}
      <section className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 space-y-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 space-y-4">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">任务详情 & 时间</label>
             <div className="flex gap-2">
               <input 
                type="text" 
                value={newHabitName}
                onChange={(e) => setNewHabitName(e.target.value)}
                placeholder="习惯名称..."
                className="flex-1 bg-slate-50 border-none rounded-2xl px-6 py-4 focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-slate-700"
               />
               <input 
                type="time" 
                value={habitTime}
                onChange={(e) => setHabitTime(e.target.value)}
                className="bg-slate-50 border-none rounded-2xl px-4 py-4 font-black text-slate-600 focus:ring-4 focus:ring-indigo-500/10"
               />
             </div>
          </div>
          <div className="space-y-4">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">重复周期</label>
             <div className="flex gap-1.5">
               {DAYS_SHORT.map((day, idx) => (
                 <button
                   key={idx}
                   onClick={() => toggleDay(idx)}
                   className={`w-10 h-10 rounded-xl text-xs font-black transition-all border-2 ${selectedDays.includes(idx) ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-slate-50 border-transparent text-slate-400 hover:border-slate-200'}`}
                 >
                   {day}
                 </button>
               ))}
             </div>
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-4 items-center border-t border-slate-50 pt-6">
          <div className="flex flex-wrap gap-2 flex-1">
             {Object.values(HabitCategory).map(cat => (
               <button 
                 key={cat} 
                 onClick={() => setSelectedCategory(cat)}
                 className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${selectedCategory === cat ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
               >
                 {cat}
               </button>
             ))}
          </div>
          <button 
            onClick={addHabit}
            className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-12 py-4 rounded-2xl font-black transition-all shadow-xl shadow-indigo-100"
          >
            开启周期计划
          </button>
        </div>
      </section>

      {/* Grid of Specialized Zones */}
      <section className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
        {Object.values(HabitCategory).map(category => {
          const theme = getCategoryTheme(category);
          const items = habits.filter(h => h.category === category);
          
          return (
            <div key={category} className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-100 flex flex-col h-full overflow-hidden">
              <div className={`p-8 ${theme.bg} text-white`}>
                <div className="flex justify-between items-center">
                  <h4 className="text-2xl font-black flex items-center gap-3">
                    <i className={`fa-solid ${theme.icon}`}></i>
                    {theme.label}
                  </h4>
                  <span className="text-[10px] font-black bg-white/20 px-3 py-1 rounded-full uppercase">Weekly Schedule</span>
                </div>
              </div>

              <div className="p-6 space-y-4 flex-grow overflow-y-auto max-h-[500px]">
                {items.map(habit => {
                  const today = new Date().getDay();
                  const isScheduledToday = habit.scheduledDays?.includes(today);
                  const isDoneToday = habit.completedDates.includes(new Date().toISOString().split('T')[0]);
                  
                  return (
                    <div key={habit.id} className={`p-5 rounded-[1.5rem] border transition-all ${isScheduledToday ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50/50 border-transparent opacity-60'}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                           <button 
                             onClick={() => toggleHabitCompletion(habit.id)}
                             disabled={!isScheduledToday}
                             className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${isDoneToday ? 'bg-slate-900 border-slate-900 shadow-lg' : 'bg-white border-slate-200'}`}
                           >
                             {isDoneToday && <i className="fa-solid fa-check text-white text-xs"></i>}
                           </button>
                           <div>
                             <h5 className={`font-black text-sm tracking-tight ${isDoneToday ? 'line-through text-slate-300' : 'text-slate-800'}`}>
                               {habit.name}
                             </h5>
                             <div className="flex items-center gap-3 mt-0.5">
                               <span className="text-[10px] font-bold text-indigo-500"><i className="fa-solid fa-clock mr-1"></i>{habit.time || '08:00'}</span>
                               <span className="text-[10px] font-black text-orange-500 bg-orange-50 px-2 rounded flex items-center gap-1">
                                 <i className="fa-solid fa-fire"></i> {getStreak(habit.completedDates)}
                               </span>
                               <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 rounded">
                                 {getCompletionRate(habit)}%
                               </span>
                               {!isScheduledToday && <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-2 rounded">今日无休</span>}
                             </div>
                           </div>
                        </div>
                        <button onClick={() => deleteHabit(habit.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                          <i className="fa-solid fa-xmark text-sm"></i>
                        </button>
                      </div>

                      {/* Mini Weekly Visualization */}
                      <div className="flex justify-between gap-1 mt-4">
                        {DAYS_SHORT.map((day, idx) => (
                          <div 
                            key={idx} 
                            className={`flex-1 flex flex-col items-center gap-1 p-1 rounded-lg ${habit.scheduledDays?.includes(idx) ? 'bg-indigo-50/50' : ''}`}
                          >
                            <span className={`text-[8px] font-black ${habit.scheduledDays?.includes(idx) ? 'text-indigo-600' : 'text-slate-300'}`}>{day}</span>
                            <div className={`w-1.5 h-1.5 rounded-full ${habit.scheduledDays?.includes(idx) ? 'bg-indigo-300' : 'bg-slate-100'}`}></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                
                {items.length === 0 && (
                  <div className="py-20 text-center space-y-4">
                    <div className="w-16 h-16 bg-slate-50 rounded-3xl mx-auto flex items-center justify-center text-slate-200 text-2xl">
                      <i className="fa-solid fa-calendar-plus"></i>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">暂无排程计划</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
});
