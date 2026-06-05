
import React, { useState, useRef, useEffect } from 'react';
import { analyzeCase, answerClinicalFollowUp } from '../services/localInsightService';
import { ClinicalAnalysis, HistoryItem } from '../types';
import { useHistory } from '../hooks/useHistory';
import { HistorySection } from './HistorySection';
import { downloadHistoryItem, downloadGuideline } from '../lib/downloadUtils';

export const ClinicalSystem: React.FC = React.memo(() => {
  const { history, addHistoryItem } = useHistory();
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState(() => localStorage.getItem('med-clinical-desc') || '');
  const [image, setImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ClinicalAnalysis | null>(() => {
    try {
      const saved = localStorage.getItem('med-clinical-analysis');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("Failed to parse clinical analysis from localStorage", e);
      return null;
    }
  });
  
  // Follow-up interaction states
  const [followUpQuery, setFollowUpQuery] = useState('');
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'assistant', text: string}[]>(() => {
    try {
      const saved = localStorage.getItem('med-clinical-chat');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse clinical chat from localStorage", e);
      return [];
    }
  });
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [calcInputs, setCalcInputs] = useState<Record<string, string>>({});
  const [calcResult, setCalcResult] = useState<string | null>(null);

  const calculators = {
    BMI: {
      name: 'BMI 计算器',
      inputs: ['体重 (kg)', '身高 (cm)'],
      calculate: (vals: Record<string, string>) => {
        const w = parseFloat(vals['体重 (kg)']);
        const h = parseFloat(vals['身高 (cm)']) / 100;
        if (!w || !h) return '请输入有效数值';
        const bmi = (w / (h * h)).toFixed(1);
        let cat = '';
        if (parseFloat(bmi) < 18.5) cat = '偏瘦';
        else if (parseFloat(bmi) < 24) cat = '正常';
        else if (parseFloat(bmi) < 28) cat = '超重';
        else cat = '肥胖';
        return `BMI: ${bmi} (${cat})`;
      }
    },
    GFR: {
      name: 'eGFR (CKD-EPI)',
      inputs: ['肌酐 (μmol/L)', '年龄', '性别 (男/女)'],
      calculate: (vals: Record<string, string>) => {
        const scr = parseFloat(vals['肌酐 (μmol/L)']) / 88.4; // to mg/dL
        const age = parseFloat(vals['年龄']);
        const isFemale = vals['性别 (男/女)'] === '女';
        if (!scr || !age) return '请输入有效数值';
        
        const k = isFemale ? 0.7 : 0.9;
        const a = isFemale ? -0.329 : -0.411;
        const femaleFactor = isFemale ? 1.018 : 1;
        
        const egfr = 141 * Math.min(scr/k, 1)**a * Math.max(scr/k, 1)**-1.209 * 0.993**age * femaleFactor;
        return `eGFR: ${egfr.toFixed(1)} ml/min/1.73m²`;
      }
    }
  };

  const handleCalc = (toolKey: string) => {
    const tool = calculators[toolKey as keyof typeof calculators];
    if (tool) {
      setCalcResult(tool.calculate(calcInputs));
    }
  };

  // Persist state to localStorage with debouncing
  useEffect(() => {
    const handler = setTimeout(() => {
      localStorage.setItem('med-clinical-desc', description);
    }, 1000);
    return () => clearTimeout(handler);
  }, [description]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (analysis) {
        localStorage.setItem('med-clinical-analysis', JSON.stringify(analysis));
      } else {
        localStorage.removeItem('med-clinical-analysis');
      }
    }, 1000);
    return () => clearTimeout(handler);
  }, [analysis]);

  useEffect(() => {
    const handler = setTimeout(() => {
      localStorage.setItem('med-clinical-chat', JSON.stringify(chatHistory));
    }, 1000);
    return () => clearTimeout(handler);
  }, [chatHistory]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!description && !image) return;
    setLoading(true);
    // Reset chat and stored analysis when a brand new case starts
    setChatHistory([]);
    try {
      const result = await analyzeCase(description, image?.split(',')[1]);
      setAnalysis(result);
      
      // Add to history
      addHistoryItem({
        type: 'clinical',
        title: description.substring(0, 30) || '影像分析记录',
        data: result
      });
    } catch (error: any) {
      console.error(error);
      // Use the specific error message if available, otherwise fallback to generic
      const errorMsg = error.message || "分析失败，请检查网络连接或稍后重试。";
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectHistory = (item: HistoryItem) => {
    setAnalysis(item.data as ClinicalAnalysis);
    setChatHistory([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFollowUp = async () => {
    if (!followUpQuery.trim() || !analysis) return;
    
    const userMessage = followUpQuery;
    setFollowUpQuery('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsFollowUpLoading(true);

    try {
      const reply = await answerClinicalFollowUp(analysis, userMessage);

      setChatHistory(prev => [...prev, { role: 'assistant', text: reply }]);
    } catch (error) {
      console.error(error);
      setChatHistory(prev => [...prev, { role: 'assistant', text: '抱歉，处理您的请求时出错。' }]);
    } finally {
      setIsFollowUpLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-12 animate-fadeIn pb-24">
      <section className="relative py-16 px-8 rounded-[3rem] bg-slate-900 overflow-hidden shadow-2xl">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(99, 102, 241, 0.15) 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500 rounded-full blur-[120px]"></div>
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-600 rounded-full blur-[120px]"></div>
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="space-y-6 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/10 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              <span className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.2em]">Next-Gen Clinical Engine</span>
            </div>
            <h2 className="text-5xl md:text-7xl font-black text-white leading-none tracking-tighter">
              智能规培<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-400">决策工作站</span>
            </h2>
            <p className="text-slate-400 text-lg max-w-xl">
              深度整合循证医学知识库。输入病例数据，AI 将立即调取全球最新指南、药典与临床量表，直接生成诊断、治疗、用药、鉴别诊断与风险参考。
            </p>
          </div>
          
          <div className="flex flex-col gap-4 w-full md:w-auto">
            <div className="p-8 bg-white/5 border border-white/10 backdrop-blur-xl rounded-[2.5rem] flex items-center gap-6 group hover:bg-white/10 transition-all cursor-default">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-microchip text-2xl"></i>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Processing Unit</div>
                <div className="text-2xl font-black text-white">AI 4.0 Omni</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100">
            <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3">
              <i className="fa-solid fa-calculator text-indigo-600"></i>
              临床速查工具
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {Object.entries(calculators).map(([key, tool]) => (
                <button
                  key={key}
                  onClick={() => {
                    setActiveTool(key);
                    setCalcInputs({});
                    setCalcResult(null);
                  }}
                  className={`p-4 rounded-2xl border-2 transition-all text-left flex items-center justify-between ${activeTool === key ? 'border-indigo-600 bg-indigo-50' : 'border-slate-50 bg-slate-50 hover:border-slate-200'}`}
                >
                  <span className="font-bold text-slate-700">{tool.name}</span>
                  <i className="fa-solid fa-chevron-right text-[10px] text-slate-400"></i>
                </button>
              ))}
            </div>

            {activeTool && (
              <div className="mt-8 p-6 bg-slate-900 rounded-3xl text-white space-y-4 animate-fadeIn">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black uppercase tracking-widest text-indigo-400">{calculators[activeTool as keyof typeof calculators].name}</span>
                  <button onClick={() => setActiveTool(null)} className="text-slate-500 hover:text-white"><i className="fa-solid fa-times"></i></button>
                </div>
                <div className="space-y-3">
                  {calculators[activeTool as keyof typeof calculators].inputs.map(input => (
                    <div key={input}>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">{input}</label>
                      <input
                        type="text"
                        value={calcInputs[input] || ''}
                        onChange={(e) => setCalcInputs(prev => ({ ...prev, [input]: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => handleCalc(activeTool)}
                  className="w-full py-3 bg-indigo-600 rounded-xl font-black text-sm hover:bg-indigo-700 transition-all"
                >
                  计算结果
                </button>
                {calcResult && (
                  <div className="pt-4 border-t border-white/10 text-center">
                    <div className="text-2xl font-black text-indigo-400">{calcResult}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-8 bg-white rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-8 md:p-12">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                  病例多模态输入
                </h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Input Terminal v1.0</span>
              </div>
              <div className="relative">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full h-64 bg-slate-50 border-2 border-slate-50 rounded-[2rem] p-8 text-slate-700 text-lg focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 focus:outline-none transition-all placeholder:text-slate-300"
                  placeholder="在此处输入病人的主诉、体征及辅助检查结果。例如：'患者男，55岁，胸痛2小时，伴大汗淋漓...'"
                />
                <div className="absolute bottom-6 right-8 flex items-center gap-4">
                  <span className={`text-[10px] font-black ${description.length > 2000 ? 'text-orange-500' : 'text-slate-400'}`}>
                    {description.length} / 3000 字
                  </span>
                  {description && (
                    <button 
                      onClick={() => setDescription('')}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                      title="清空输入"
                    >
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-3 cursor-pointer bg-slate-900 hover:bg-black text-white px-6 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-slate-200 group">
                  <i className="fa-solid fa-file-image group-hover:rotate-12 transition-transform"></i>
                  上传化验单/心电图
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
                {image && (
                  <div className="relative group/img">
                    <img src={image} className="h-14 w-14 object-cover rounded-xl border border-slate-200" alt="Preview" />
                    <button onClick={() => setImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow-lg opacity-0 group-hover/img:opacity-100 transition-all">
                      <i className="fa-solid fa-times"></i>
                    </button>
                  </div>
                )}
                <button 
                  onClick={handleAnalyze}
                  disabled={loading}
                  className="ml-auto flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white px-10 py-4 rounded-2xl font-black text-lg transition-all shadow-xl shadow-indigo-100 disabled:opacity-50"
                >
                  {loading ? (
                    <><i className="fa-solid fa-spinner-third animate-spin"></i> 正在构建诊疗模型...</>
                  ) : (
                    <><i className="fa-solid fa-sparkles"></i> 启动智慧引擎</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {analysis && (
          <div className="lg:col-span-12 space-y-8 animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 space-y-8">
                <div className="bg-slate-950 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-10 opacity-10">
                    <i className="fa-solid fa-stethoscope text-[120px]"></i>
                  </div>
                  <div className="flex items-center justify-between mb-10">
                    <h3 className="text-2xl font-black flex items-center gap-4">
                      <span className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-indigo-400">
                        <i className="fa-solid fa-brain-circuit"></i>
                      </span>
                      诊断推演与鉴别
                    </h3>
                    <button 
                      onClick={() => downloadHistoryItem({
                        type: 'clinical',
                        title: description.substring(0, 30) || '影像分析记录',
                        timestamp: new Date().toISOString(),
                        data: analysis
                      })}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-indigo-400 text-xs font-bold transition-all"
                    >
                      <i className="fa-solid fa-download"></i> 下载报告
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block">拟诊诊断 (Likely Diagnosis)</label>
                      <div className="space-y-3">
                        {(analysis.diagnosis || []).map((d, i) => (
                          <div key={i} className="group p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all flex items-start gap-4">
                            <span className="text-indigo-400 font-black text-sm pt-0.5">0{i+1}</span>
                            <span className="font-bold text-slate-200">{d}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] block">红色警示/漏诊鉴别 (Critical Warnings)</label>
                      <div className="space-y-3">
                        {(analysis.omitted || []).map((o, i) => (
                          <div key={i} className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-200 text-sm font-medium leading-relaxed">
                            <i className="fa-solid fa-triangle-exclamation mr-2 text-rose-500"></i>
                            {o}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-[3rem] p-10 shadow-xl shadow-slate-200/50 border border-slate-100">
                  <h3 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-4">
                    <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <i className="fa-solid fa-scroll-old"></i>
                    </span>
                    诊断与治疗参考方案
                  </h3>
                  <div className="bg-slate-50 rounded-[2rem] p-8 prose prose-slate max-w-none text-slate-700 font-medium leading-loose whitespace-pre-wrap border border-slate-100">
                    {analysis.plan}
                  </div>
                </div>

                <div className="bg-white rounded-[3rem] p-10 shadow-xl shadow-slate-200/50 border border-slate-100">
                  <h3 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-4">
                    <span className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                      <i className="fa-solid fa-shield-virus"></i>
                    </span>
                    潜在并发症与风险预警
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(analysis.complications || []).map((c, i) => (
                      <div key={i} className="p-5 bg-orange-50/50 border border-orange-100 rounded-2xl flex items-start gap-4 group hover:bg-orange-50 transition-all">
                        <div className="w-6 h-6 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center text-[10px] font-black group-hover:bg-orange-600 group-hover:text-white transition-colors">
                          {i + 1}
                        </div>
                        <span className="text-sm font-bold text-slate-700">{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 space-y-8">
                <div className="bg-indigo-600 rounded-[3rem] p-8 text-white shadow-xl shadow-indigo-200 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-110 transition-transform">
                    <i className="fa-solid fa-capsules text-6xl"></i>
                  </div>
                  <h3 className="text-xl font-black mb-6">治疗与用药方案</h3>
                  <div className="space-y-3">
                    {(analysis.medications || []).map((m, i) => (
                      <div key={i} className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                        <span className="text-sm font-bold">{m}</span>
                      </div>
                    ))}
                  </div>
                  <button className="w-full mt-6 py-3 bg-white/20 hover:bg-white/30 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">查看交互禁忌</button>
                </div>

                <div className="bg-white rounded-[3rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
                  <h3 className="text-xl font-black text-slate-800 mb-8">指南与结构化量表</h3>
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">权威指南推荐</label>
                      {(analysis.guidelines || []).map((g, i) => (
                        <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-300 hover:bg-white transition-all group">
                          <div className="text-xs font-bold text-slate-600 mb-3 line-clamp-2">{g.title}</div>
                          <div className="flex gap-2">
                            <a 
                              href={g.url} 
                              target="_blank" 
                              rel="noreferrer"
                              className="flex-1 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1"
                            >
                              <i className="fa-solid fa-eye"></i> 浏览
                            </a>
                            <button 
                              onClick={() => downloadGuideline(g)}
                              className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-800 text-slate-500 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1"
                            >
                              <i className="fa-solid fa-download"></i> 下载
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">评估量表(Scales)</label>
                      {(analysis.scales || []).map((s, i) => (
                        <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="text-xs font-black text-slate-800 mb-2">{s.name}</div>
                          <div className="flex flex-wrap gap-1">
                            {(s.items || []).slice(0, 4).map((item, j) => (
                              <span key={j} className="text-[8px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-100">{item}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-[3rem] p-8 text-white">
                  <h3 className="text-xl font-black mb-6 flex items-center justify-between">
                    执行闭环
                    <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold">Today</span>
                  </h3>
                  <div className="space-y-3">
                    {(analysis.followUpTasks || []).map((task, i) => (
                      <label key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer group">
                        <div className="relative">
                          <input type="checkbox" className="peer w-6 h-6 rounded-lg bg-slate-800 border-slate-700 text-indigo-500 focus:ring-0 opacity-0 absolute inset-0 cursor-pointer z-10" />
                          <div className="w-6 h-6 rounded-lg border-2 border-slate-700 peer-checked:bg-indigo-500 peer-checked:border-indigo-500 transition-all flex items-center justify-center">
                            <i className="fa-solid fa-check text-[10px] text-white opacity-0 peer-checked:opacity-100"></i>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-slate-400 group-hover:text-white transition-colors">{task}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-2xl border-4 border-indigo-50">
              <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
                  <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-xl">
                    <i className="fa-solid fa-comments-medical"></i>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800">诊疗深度对话</h3>
                    <p className="text-slate-500 text-sm font-medium">针对以上诊断与治疗参考，您可以继续提出个性化需求或疑问</p>
                  </div>
                </div>

                <div className="space-y-6 max-h-[500px] overflow-y-auto px-4 py-2 scrollbar-thin scrollbar-thumb-slate-200">
                  {chatHistory.length === 0 && (
                    <div className="text-center py-10">
                      <div className="text-slate-300 mb-4 italic">可以问我：'如果患者有过敏史，药物该如何调整？' 或 '请详细说明该指南的排除标准'</div>
                    </div>
                  )}
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-5 rounded-[2rem] ${
                        msg.role === 'user' 
                          ? 'bg-indigo-600 text-white rounded-tr-none shadow-lg' 
                          : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200'
                      }`}>
                        <div className="text-xs font-black uppercase tracking-widest opacity-50 mb-2">
                          {msg.role === 'user' ? '我的提问' : '专家回复'}
                        </div>
                        <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                <div className="relative pt-4">
                  <div className="flex gap-3 bg-slate-50 p-2 rounded-[2.5rem] border-2 border-slate-100 focus-within:border-indigo-500 transition-all shadow-inner">
                    <input 
                      type="text" 
                      value={followUpQuery}
                      onChange={(e) => setFollowUpQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleFollowUp()}
                      placeholder="进一步调整方案或提问..."
                      className="flex-1 bg-transparent border-none px-6 py-4 focus:ring-0 text-slate-700 font-bold"
                    />
                    <button 
                      onClick={handleFollowUp}
                      disabled={isFollowUpLoading || !followUpQuery.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-95 disabled:opacity-50"
                    >
                      {isFollowUpLoading ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-paper-plane"></i>}
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    {['调整药物剂量', '增加随访频率', '解释诊断依据', '并发症预防'].map(tag => (
                      <button 
                        key={tag}
                        onClick={() => setFollowUpQuery(tag)}
                        className="text-[10px] font-black text-slate-400 bg-white border border-slate-100 px-3 py-1 rounded-full hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
      {/* History Section */}
      <HistorySection 
        history={history} 
        onSelect={handleSelectHistory} 
        type="clinical" 
      />
    </div>
  );
});
