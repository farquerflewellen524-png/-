
import React, { useState, useEffect } from 'react';
import { getResearchHelp, translateText } from '../services/localInsightService';
import { ResearchInsight, HistoryItem } from '../types';
import { useHistory } from '../hooks/useHistory';
import { HistorySection } from './HistorySection';
import { downloadHistoryItem } from '../lib/downloadUtils';

const TRENDING_PAPERS = [
  {
    title: "Artificial Intelligence in Medicine: Current Trends and Future Directions",
    journal: "The Lancet Digital Health",
    link: "https://www.thelancet.com/journals/landig/home",
    tag: "AI & Medicine",
    desc: "A comprehensive review of how large language models and computer vision are reshaping clinical diagnostics."
  },
  {
    title: "Advances in CRISPR-Cas9 Gene Editing for Human Disease",
    journal: "Nature Medicine",
    link: "https://www.nature.com/nm/",
    tag: "Gene Editing",
    desc: "New breakthroughs in in-vivo gene editing for treating hereditary blindness and blood disorders."
  },
  {
    title: "The Gut Microbiome and Its Role in Personalized Nutrition",
    journal: "Cell Host & Microbe",
    link: "https://www.cell.com/cell-host-microbe/home",
    tag: "Microbiome",
    desc: "How individual microbial signatures dictate metabolic responses to dietary interventions."
  },
  {
    title: "Universal Cancer Screening via Liquid Biopsy: Reality or Dream?",
    journal: "Journal of Clinical Oncology",
    link: "https://ascopubs.org/journal/jco",
    tag: "Oncology",
    desc: "An update on multi-cancer early detection (MCED) tests using cell-free DNA methylation patterns."
  }
];

export const ResearchAssistant: React.FC = React.memo(() => {
  const { history, addHistoryItem } = useHistory();
  const [topic, setTopic] = useState(() => localStorage.getItem('med-research-topic') || '');
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<ResearchInsight | null>(() => {
    try {
      const saved = localStorage.getItem('med-research-insight');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("Failed to parse research insight from localStorage", e);
      return null;
    }
  });
  const [translatingIdx, setTranslatingIdx] = useState<number | null>(null);
  const [trendingTranslations, setTrendingTranslations] = useState<Record<number, {title: string, desc: string}>>(() => {
    try {
      const saved = localStorage.getItem('med-research-trending-trans');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error("Failed to parse trending translations from localStorage", e);
      return {};
    }
  });
  const [isTranslatingTrending, setIsTranslatingTrending] = useState<number | null>(null);

  // Persist state to localStorage with debouncing
  useEffect(() => {
    const handler = setTimeout(() => {
      localStorage.setItem('med-research-topic', topic);
    }, 1000);
    return () => clearTimeout(handler);
  }, [topic]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (insight) {
        localStorage.setItem('med-research-insight', JSON.stringify(insight));
      } else {
        localStorage.removeItem('med-research-insight');
      }
    }, 1000);
    return () => clearTimeout(handler);
  }, [insight]);

  useEffect(() => {
    const handler = setTimeout(() => {
      localStorage.setItem('med-research-trending-trans', JSON.stringify(trendingTranslations));
    }, 1000);
    return () => clearTimeout(handler);
  }, [trendingTranslations]);

  const fetchInsight = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    try {
      const data = await getResearchHelp(topic);
      setInsight(data);
      
      // Add to history
      addHistoryItem({
        type: 'research',
        title: topic.substring(0, 30),
        data: data
      });
    } catch (error) {
      console.error(error);
      alert("获取科研建议失败。");
    } finally {
      setLoading(false);
    }
  };

  const handleTranslateTrending = async (index: number) => {
    if (trendingTranslations[index]) return;
    setIsTranslatingTrending(index);
    try {
      const paper = TRENDING_PAPERS[index];
      const [tTitle, tDesc] = await Promise.all([
        translateText(paper.title),
        translateText(paper.desc)
      ]);
      setTrendingTranslations(prev => ({
        ...prev,
        [index]: { title: tTitle, desc: tDesc }
      }));
    } catch (error) {
      console.error(error);
    } finally {
      setIsTranslatingTrending(null);
    }
  };

  const handleTranslate = async (index: number) => {
    if (!insight) return;
    setTranslatingIdx(index);
    try {
      const lit = insight.literatures[index];
      const translatedTitle = await translateText(lit.title);
      const translatedJournal = await translateText(lit.journal);
      
      const newLiteratures = [...insight.literatures];
      newLiteratures[index] = {
        ...lit,
        title: translatedTitle,
        journal: translatedJournal
      };
      setInsight({ ...insight, literatures: newLiteratures });
    } catch (error) {
      console.error(error);
    } finally {
      setTranslatingIdx(null);
    }
  };

  const handleSelectHistory = (item: HistoryItem) => {
    setInsight(item.data as ResearchInsight);
    setTopic(item.title);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-8 animate-fadeIn">
      <div className="bg-gradient-to-br from-purple-700 to-indigo-800 rounded-3xl p-10 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute -bottom-10 -right-10 opacity-20 rotate-12">
          <i className="fa-solid fa-vials text-[200px]"></i>
        </div>
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
              <i className="fa-solid fa-flask-vial text-2xl"></i>
            </div>
            <h2 className="text-3xl font-black tracking-tight">科研学术中心</h2>
          </div>
          <p className="text-indigo-100 text-lg max-w-xl">从灵感爆发到文献管理，AI 伴您探索医学边界，让科研产出更具效率。</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
        <div className="max-w-3xl mx-auto">
          <h3 className="text-center text-slate-800 font-bold mb-6">您目前在关注哪个领域的研究？</h3>
          <div className="relative group">
            <input 
              type="text"
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-8 py-5 text-lg focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 focus:outline-none transition-all pr-40"
              placeholder="例如：外泌体在肺癌耐药中的作用机制..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            <button 
              onClick={fetchInsight}
              disabled={loading}
              className="absolute right-2 top-2 bottom-2 bg-purple-600 hover:bg-purple-700 text-white px-8 rounded-xl font-black transition-all flex items-center gap-2 disabled:bg-slate-300"
            >
              {loading ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-sparkles"></i>}
              智能灵感
            </button>
          </div>
          <div className="flex justify-center gap-4 mt-6 text-xs text-slate-400 font-medium">
            <span>推荐方向：</span>
            {['单细胞测序', '肠道菌群', 'AI医学影像'].map(t => (
              <button key={t} onClick={() => {setTopic(t);}} className="hover:text-purple-600 underline decoration-purple-200">{t}</button>
            ))}
          </div>
        </div>
      </div>

      {!insight && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fadeIn">
          <div className="md:col-span-2 lg:col-span-3 space-y-6">
            <div className="flex items-center justify-between px-4">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-fire-flame-curved text-orange-500"></i>
                当前医学研究热点
              </h3>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Trends</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TRENDING_PAPERS.map((paper, i) => (
                <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 hover:border-purple-300 hover:shadow-xl hover:shadow-purple-100/50 transition-all group cursor-pointer relative">
                  <div className="flex flex-col h-full">
                    <div className="flex justify-between items-center mb-4">
                      <span className="inline-block px-3 py-1 bg-purple-50 text-purple-600 text-[10px] font-black rounded-full">#{paper.tag}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleTranslateTrending(i); }}
                        className="text-[10px] font-bold text-indigo-500 hover:underline flex items-center gap-1"
                      >
                        {isTranslatingTrending === i ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-language"></i>}
                        {trendingTranslations[i] ? '已翻译' : '翻译'}
                      </button>
                    </div>
                    <h4 className="font-bold text-slate-800 group-hover:text-purple-700 transition-colors mb-2 line-clamp-2">
                      {trendingTranslations[i]?.title || paper.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 mb-4 line-clamp-3 leading-relaxed">
                      {trendingTranslations[i]?.desc || paper.desc}
                    </p>
                    <p className="text-[10px] text-slate-400 font-black italic mt-auto pt-4 border-t border-slate-50">{paper.journal}</p>
                    <a href={paper.link} target="_blank" rel="noreferrer" className="mt-4 flex items-center justify-between text-[10px] font-black text-slate-400 group-hover:text-purple-600 uppercase tracking-widest">
                      查看原文 <i className="fa-solid fa-arrow-right-long transition-transform group-hover:translate-x-1"></i>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="space-y-6">
             <div className="px-4">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <i className="fa-solid fa-compass text-blue-500"></i>
                  科研向导
                </h3>
             </div>
             <div className="bg-slate-900 rounded-[2rem] p-6 text-white space-y-6">
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Quick Start</div>
                  <p className="text-sm font-medium leading-relaxed">不知道从哪开始？尝试输入您的科室或关注的疾病，AI将为您生成10篇精选文献与3个创新点。</p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-4">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-xs"><i className="fa-solid fa-bolt"></i></div>
                      <span className="text-xs font-black">今日科研产出建议</span>
                   </div>
                   <ul className="text-[10px] space-y-2 text-slate-400 font-medium">
                      <li>• 查阅 3 篇领域内高分综述</li>
                      <li>• 更新您的 Zotero 文献库</li>
                      <li>• 记录 1 个实验设计的潜在 Bug</li>
                   </ul>
                </div>
             </div>
          </div>
        </div>
      )}

      {insight && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fadeIn">
          <div className="lg:col-span-7 space-y-8">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <i className="fa-solid fa-lightbulb text-9xl"></i>
              </div>
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                  <i className="fa-solid fa-wand-magic-sparkles text-amber-500"></i>
                  科研创新点 (Ideas)
                </h3>
                <button 
                  onClick={() => downloadHistoryItem({
                    type: 'research',
                    title: topic.substring(0, 30),
                    timestamp: new Date().toISOString(),
                    data: insight
                  })}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-600 text-xs font-bold transition-all"
                >
                  <i className="fa-solid fa-download"></i> 下载报告
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {insight.ideas.map((idea, i) => (
                  <div key={i} className="p-6 bg-amber-50/50 rounded-2xl border border-amber-100 group hover:scale-[1.01] transition-transform">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 flex-shrink-0 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center font-black group-hover:bg-amber-500 group-hover:text-white transition-colors">
                        {i + 1}
                      </div>
                      <p className="text-slate-700 text-sm font-medium leading-relaxed">{idea}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 rounded-3xl p-8 text-white">
              <h3 className="text-2xl font-black mb-8 flex items-center gap-3">
                <i className="fa-solid fa-tasks text-emerald-400"></i>
                项目管理建议
              </h3>
              <div className="space-y-4">
                {insight.managementTips.map((tip, i) => (
                  <div key={i} className="flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                    <i className="fa-solid fa-check-circle text-emerald-400 mt-1"></i>
                    <p className="text-sm text-slate-300 leading-relaxed">{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-8">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 sticky top-24">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <i className="fa-solid fa-book-bookmark text-blue-500"></i>
                  文献推荐 ({insight.literatures.length}篇)
                </h3>
                <button 
                  onClick={() => {
                    setInsight(null);
                    localStorage.removeItem('med-research-insight');
                  }} 
                  className="text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest"
                >
                  返回热点
                </button>
              </div>
              <div className="space-y-6 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
                {insight.literatures.map((lit, i) => (
                  <div key={i} className="group relative">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black w-4 h-4 bg-slate-100 flex items-center justify-center rounded text-slate-400">{i+1}</span>
                        <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest line-clamp-1">{lit.journal}</div>
                      </div>
                      <button 
                        onClick={() => handleTranslate(i)}
                        disabled={translatingIdx === i}
                        className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded transition-all"
                      >
                        {translatingIdx === i ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-language"></i>}
                        翻译
                      </button>
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 leading-snug group-hover:text-purple-600 transition-colors">{lit.title}</h4>
                    <div className="mt-3 flex gap-2">
                      <a 
                        href={`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(lit.title)}`}
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-[10px] font-bold bg-slate-100 px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-900 hover:text-white transition-all flex items-center gap-1"
                      >
                        <i className="fa-solid fa-search"></i> PubMed
                      </a>
                      <a 
                        href={lit.link} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-[10px] font-bold bg-purple-50 px-3 py-1.5 rounded-lg text-purple-600 hover:bg-purple-600 hover:text-white transition-all flex items-center gap-1"
                      >
                        <i className="fa-solid fa-link"></i> 原文
                      </a>
                    </div>
                    {i < insight.literatures.length - 1 && <div className="mt-6 border-b border-slate-100"></div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* History Section */}
      <HistorySection 
        history={history} 
        onSelect={handleSelectHistory} 
        type="research" 
      />

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}} />
    </div>
  );
});
