import { HistoryItem, ClinicalAnalysis, ResearchInsight } from '../types';

export const downloadHistoryItem = (item: HistoryItem | { type: 'clinical' | 'research', title: string, timestamp: string, data: ClinicalAnalysis | ResearchInsight }) => {
  let content = '';
  const dateStr = new Date(item.timestamp).toLocaleString('zh-CN');
  
  if (item.type === 'clinical') {
    const data = item.data as ClinicalAnalysis;
    content = `临床分析报告\n标题: ${item.title}\n时间: ${dateStr}\n\n` +
      `【拟诊诊断】\n${(data.diagnosis || []).map((d, i) => `${i + 1}. ${d}`).join('\n')}\n\n` +
      `【红色警示】\n${(data.omitted || []).map((o, i) => `${i + 1}. ${o}`).join('\n')}\n\n` +
      `【用药建议】\n${(data.medications || []).join(', ')}\n\n` +
      `【潜在并发症与风险】\n${(data.complications || []).map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\n` +
      `【诊疗方案】\n${data.plan || ''}\n\n` +
      `【后续任务】\n${(data.followUpTasks || []).map((t, i) => `- ${t}`).join('\n')}`;
  } else {
    const data = item.data as ResearchInsight;
    content = `科研洞察报告\n标题: ${item.title}\n时间: ${dateStr}\n\n` +
      `【相关文献】\n${(data.literatures || []).map((l, i) => `${i + 1}. ${l.title} (${l.journal}) - ${l.link}`).join('\n')}\n\n` +
      `【研究思路】\n${(data.ideas || []).map((id, i) => `${i + 1}. ${id}`).join('\n')}\n\n` +
      `【管理建议】\n${(data.managementTips || []).map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
  }

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${item.title.substring(0, 20)}_${new Date(item.timestamp).getTime()}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const downloadGuideline = (g: { title: string, url: string }) => {
  const content = `临床指南\n标题: ${g.title}\n链接: ${g.url}`;
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `指南_${g.title.substring(0, 20)}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
