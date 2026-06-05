import { ClinicalAnalysis, ResearchInsight } from "../types";

const GPT_ENABLED = import.meta.env.VITE_ENABLE_GPT === 'true';
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';
const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-5.2';

const delay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

const truncate = (value: string, max = 120) => {
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized;
};

const gptAvailable = () => GPT_ENABLED && Boolean(OPENAI_API_KEY);

const extractResponseText = (payload: any) => {
  if (typeof payload?.output_text === 'string') return payload.output_text;

  const contentText = payload?.output
    ?.flatMap((item: any) => item?.content || [])
    ?.map((content: any) => content?.text || '')
    ?.join('')
    ?.trim();

  if (contentText) return contentText;
  throw new Error('GPT 未返回可读取内容。');
};

const createResponse = async (body: Record<string, unknown>) => {
  if (!gptAvailable()) {
    throw new Error('未开启 GPT 使用权限，请配置 VITE_ENABLE_GPT=true 和 VITE_OPENAI_API_KEY。');
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      ...body,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || 'GPT 请求失败，请检查权限、额度或网络。');
  }

  return extractResponseText(payload);
};

const parseJsonResponse = <T,>(text: string, fallback: T): T => {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  try {
    return JSON.parse(cleaned) as T;
  } catch (error) {
    console.error('Failed to parse GPT JSON response:', error, text);
    return fallback;
  }
};

const getLocalClinicalAnalysis = (description: string, imageBase64?: string): ClinicalAnalysis => {
  const caseSummary = truncate(description || (imageBase64 ? '已上传影像资料' : '未提供病例描述'), 80);

  return {
    diagnosis: [
      '需结合病史、体格检查与辅助检查进一步明确诊断',
      '根据主诉优先排查常见病与急危重症',
      '必要时请上级医师或专科会诊',
    ],
    omitted: [
      `补充关键病史：${caseSummary}`,
      '完善生命体征、过敏史、既往史与用药史',
      '根据病情补充血常规、生化、凝血、感染指标或影像检查',
      '记录鉴别诊断依据并动态复评',
    ],
    medications: [
      '暂不生成具体处方，请以医院诊疗规范和医嘱为准',
      '如需用药，先核对禁忌证、肝肾功能、妊娠状态与相互作用',
      '优先进行对症支持治疗并严密观察疗效和不良反应',
    ],
    complications: [
      '病情进展或漏诊风险',
      '药物不良反应与相互作用风险',
      '感染、出血、血栓或器官功能恶化风险需按病种评估',
    ],
    guidelines: [
      { title: '国家卫生健康委临床路径与指南资源', url: 'https://www.nhc.gov.cn/' },
      { title: 'BMJ Best Practice', url: 'https://bestpractice.bmj.com/' },
    ],
    scales: [
      { name: '生命体征与病情严重程度复评', items: ['体温', '心率', '血压', '血氧饱和度'] },
      { name: '专科量表待诊断明确后选择', items: ['主诉相关指标', '危险因素', '器官功能', '治疗反应'] },
    ],
    plan: '本地示例结果仅用于整理规培思路：先确认急危重症风险，补充病史和体检，按主诉完善检查，形成鉴别诊断，结合上级医师意见制定诊疗方案，并动态记录疗效与风险。',
    followUpTasks: [
      '复核病史、体征和检查结果',
      '列出主要鉴别诊断及支持/反对依据',
      '向上级医师汇报并确认处置优先级',
      '观察病情变化并记录随访节点',
      '整理学习笔记和临床问题清单',
    ],
  };
};

const getLocalResearchInsight = (topic: string): ResearchInsight => {
  const keyword = truncate(topic || '医学研究主题', 80);

  return {
    literatures: [
      {
        title: `${keyword}：请在 PubMed、Web of Science 或指南数据库中检索最新证据`,
        journal: '本地检索提示',
        link: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(topic || 'medical research')}`,
      },
      {
        title: '建议优先筛选系统综述、随机对照研究、真实世界研究和最新指南',
        journal: '证据等级建议',
        link: 'https://www.cochranelibrary.com/',
      },
    ],
    ideas: [
      `围绕“${keyword}”构建 PICO 问题，明确人群、干预/暴露、对照和结局`,
      '设计小样本预实验或回顾性队列，先验证数据可获得性与变量质量',
      '结合临床痛点选择可量化结局，提前规划统计方案和伦理材料',
    ],
    managementTips: [
      '建立文献矩阵：记录研究类型、样本量、主要结局、偏倚风险和可借鉴方法',
      '按周拆分任务：检索、筛选、数据提取、统计分析、图表和写作',
      '所有在线检索与引用需由研究者手动核验，避免使用未经确认的文献条目',
    ],
  };
};

export const translateText = async (text: string) => {
  if (!gptAvailable()) {
    await delay(150);
    return text;
  }

  return createResponse({
    instructions: '你是医学学术翻译助手。请将用户内容翻译成专业且地道的中文；如果已经是中文，则保持不变。只输出翻译结果。',
    input: text,
    max_output_tokens: 1000,
  });
};

export const analyzeCase = async (description: string, imageBase64?: string): Promise<ClinicalAnalysis> => {
  const fallback = getLocalClinicalAnalysis(description, imageBase64);

  if (!gptAvailable()) {
    await delay();
    return fallback;
  }

  const inputContent: Record<string, string>[] = [
    { type: 'input_text', text: `病例描述：${description || '未提供文字描述'}` },
  ];

  if (imageBase64) {
    inputContent.push({
      type: 'input_image',
      image_url: `data:image/jpeg;base64,${imageBase64}`,
    });
  }

  const text = await createResponse({
    instructions: `你是资深临床医学专家。根据病例描述输出严格 JSON，不要输出 Markdown。
字段要求：diagnosis 最多 3 项；omitted、medications、complications 各最多 4 项；guidelines 最多 2 项且包含 title 和 url；scales 最多 2 项且每项 items 最多 4 项；plan 250 字以内；followUpTasks 最多 5 项。内容必须专业、精炼，并提醒遵循医院规范和上级医师意见。`,
    input: [{ role: 'user', content: inputContent }],
    max_output_tokens: 4096,
  });

  return parseJsonResponse<ClinicalAnalysis>(text, fallback);
};

export const answerClinicalFollowUp = async (analysis: ClinicalAnalysis, userMessage: string) => {
  const localReply = [
    '下面是本地整理建议：',
    `你的问题：${userMessage}`,
    `当前诊疗方案要点：${analysis.plan}`,
    '建议结合最新检查结果、科室规范和上级医师意见进一步确认。',
  ].join('\n');

  if (!gptAvailable()) {
    await delay(200);
    return localReply;
  }

  return createResponse({
    instructions: '你是资深医学带教老师。基于既有病例分析回答规培生追问，必须简洁、审慎、符合临床安全原则，避免替代医嘱。',
    input: `既有分析：${JSON.stringify(analysis)}\n\n用户追问：${userMessage}`,
    max_output_tokens: 1200,
  });
};

export const getResearchHelp = async (topic: string): Promise<ResearchInsight> => {
  const fallback = getLocalResearchInsight(topic);

  if (!gptAvailable()) {
    await delay();
    return fallback;
  }

  const text = await createResponse({
    instructions: `你是医学科研助手。请围绕用户研究主题输出严格 JSON，不要输出 Markdown。
字段要求：literatures 为 10 篇高质量参考方向或可检索文献线索，每项包含 title、journal、link；ideas 为 3-5 个创新点；managementTips 为 3-5 条项目管理建议。所有在线检索链接需使用可访问的检索入口或期刊主页。`,
    input: `研究主题：${topic}`,
    max_output_tokens: 4096,
  });

  return parseJsonResponse<ResearchInsight>(text, fallback);
};
