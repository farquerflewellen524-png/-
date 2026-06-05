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

interface ClinicalTemplate {
  match: RegExp;
  diagnosis: string[];
  omitted: string[];
  medications: string[];
  complications: string[];
  guidelines: { title: string; url: string }[];
  scales: { name: string; items: string[] }[];
  plan: string;
  followUpTasks: string[];
}

const clinicalTemplates: ClinicalTemplate[] = [
  {
    match: /(胸痛|胸闷|心梗|心肌梗死|ST段|肌钙蛋白|冠心病|ACS|急性冠脉)/i,
    diagnosis: ['急性冠脉综合征需优先排查', '急性心肌梗死或不稳定型心绞痛待鉴别', '主动脉夹层、肺栓塞等致命性胸痛需排除'],
    omitted: ['立即复查 12 导联心电图及动态变化', '完善肌钙蛋白/心肌酶、血常规、凝血、肾功能', '评估主动脉夹层、肺栓塞、气胸和消化道病因', '核对出血风险、抗栓禁忌证及既往支架/卒中史'],
    medications: ['阿司匹林负荷量后维持（无禁忌时）', 'P2Y12 受体抑制剂需结合再灌注策略使用', '抗凝、硝酸酯、他汀等按 ACS 路径评估', '镇痛、吸氧仅在低氧或剧痛时按规范处理'],
    complications: ['恶性心律失常和心源性休克', '心力衰竭、机械并发症', '再梗死或支架血栓', '抗栓相关出血'],
    guidelines: [
      { title: 'ESC Acute Coronary Syndromes Guidelines', url: 'https://www.escardio.org/Guidelines' },
      { title: 'AHA/ACC Acute Coronary Syndrome Guideline Hub', url: 'https://www.heart.org/en/professional/quality-improvement/acute-coronary-syndrome' },
    ],
    scales: [
      { name: 'GRACE 风险评分', items: ['年龄', '心率/血压', '肌酐', 'ST 段改变'] },
      { name: 'TIMI 风险评分', items: ['危险因素', '心电图改变', '心肌标志物', '近期阿司匹林使用'] },
    ],
    plan: '围绕胸痛病例先按急性胸痛绿色通道处理：监测生命体征、复查心电图和肌钙蛋白，排除夹层/肺栓塞等危重鉴别；无禁忌时按 ACS 规范启动抗栓、调脂和症状控制，并尽早请心内科评估再灌注/介入策略。',
    followUpTasks: ['0/1-3 小时复查肌钙蛋白和心电图', '持续心电监护并记录胸痛变化', '复核抗栓禁忌证和出血评分', '跟进心超/冠脉 CTA 或造影安排', '交接再灌注时间节点'],
  },
  {
    match: /(发热|咳嗽|咳痰|肺炎|气促|呼吸困难|感染|白细胞|CRP|PCT)/i,
    diagnosis: ['社区获得性肺炎或下呼吸道感染', '病毒性呼吸道感染合并细菌感染待排', '脓毒症或重症肺炎风险需评估'],
    omitted: ['完善血常规、CRP/PCT、肝肾功能和乳酸', '留取痰培养/血培养后再优化抗感染方案', '胸片或胸部 CT 明确感染范围及并发症', '评估氧合、基础肺病、误吸和免疫抑制状态'],
    medications: ['经验性抗菌药需覆盖常见 CAP 病原并结合本地耐药', '发热/咳痰可给予退热、祛痰和补液支持', '低氧时氧疗，必要时升级呼吸支持', '根据培养、肝肾功能和疗效及时降阶梯/调整'],
    complications: ['低氧呼吸衰竭', '脓毒症或感染性休克', '胸腔积液/脓胸', '基础疾病急性加重'],
    guidelines: [
      { title: 'IDSA/ATS Community-Acquired Pneumonia Guidelines', url: 'https://www.idsociety.org/practice-guideline/community-acquired-pneumonia-cap-in-adults/' },
      { title: 'NICE Pneumonia Guideline', url: 'https://www.nice.org.uk/guidance/ng138' },
    ],
    scales: [
      { name: 'CURB-65', items: ['意识状态', '尿素氮', '呼吸频率', '血压/年龄'] },
      { name: 'qSOFA', items: ['呼吸频率', '收缩压', '意识改变'] },
    ],
    plan: '根据发热/咳嗽等感染信息，先评估氧合和脓毒症风险，完善炎症指标、病原学和胸部影像；采样后按 CAP 或院内感染风险选择经验性抗感染，并根据培养、影像和 48-72 小时疗效动态调整。',
    followUpTasks: ['记录体温、呼吸频率和血氧趋势', '追踪血/痰培养及药敏', '48-72 小时评估抗感染疗效', '复查炎症指标和影像必要性', '评估停氧、降阶梯和出院标准'],
  },
  {
    match: /(腹痛|恶心|呕吐|腹泻|阑尾|胆囊|胰腺|黄疸|黑便|便血)/i,
    diagnosis: ['急腹症病因待查', '胃肠炎、胆胰疾病或阑尾炎需鉴别', '消化道出血或肠梗阻风险需排除'],
    omitted: ['明确腹痛部位、性质、迁移痛、排便排气和月经/妊娠史', '完善血常规、肝胆胰酶、电解质、尿检/妊娠试验', '根据体征选择腹部超声、CT 或立位腹平片', '评估腹膜刺激征、休克和外科急诊指征'],
    medications: ['补液、纠正电解质紊乱并禁食/胃肠减压视情况', '止痛止吐不应延误外科评估', '疑感染或胆胰源性并发症时按规范抗感染', '疑出血时抑酸、备血并评估内镜时机'],
    complications: ['穿孔、腹膜炎或脓毒症', '脱水和电解质紊乱', '消化道大出血', '胆胰疾病进展为器官功能损害'],
    guidelines: [
      { title: 'WSES Emergency Surgery Guidelines', url: 'https://www.wses.org.uk/guidelines' },
      { title: 'ACG Clinical Guidelines', url: 'https://gi.org/clinical-guidelines/' },
    ],
    scales: [
      { name: '腹膜炎/急腹症复评', items: ['压痛反跳痛', '体温', '白细胞/CRP', '影像进展'] },
      { name: 'NEWS2 早期预警', items: ['呼吸', '血氧', '血压', '意识'] },
    ],
    plan: '围绕腹痛病例先识别休克、腹膜炎、出血和梗阻等急诊风险，完善实验室和腹部影像；在补液、止痛、禁食等支持基础上尽早请外科/消化科会诊，治疗方案随病因和动态复查调整。',
    followUpTasks: ['每 2-4 小时复评腹部体征', '追踪血常规、肝胆胰酶和电解质', '确认影像结果及外科会诊意见', '记录出入量、排便排气和疼痛评分', '明确进食、抗感染或内镜/手术节点'],
  },
  {
    match: /(头痛|头晕|偏瘫|言语|意识|抽搐|卒中|脑梗|脑出血|癫痫)/i,
    diagnosis: ['急性脑卒中需优先排查', '颅内出血、脑梗死或短暂性脑缺血发作待鉴别', '癫痫、感染或代谢性脑病需评估'],
    omitted: ['记录最后正常时间和 NIHSS', '急查头颅 CT/CTA 或 MRI 排除出血和大血管闭塞', '完善血糖、电解质、凝血、心电图和感染指标', '核对溶栓/取栓适应证、禁忌证及抗凝用药史'],
    medications: ['缺血性卒中在时间窗内评估静脉溶栓/机械取栓', '非溶栓患者抗血小板和他汀需按卒中路径', '控制血压、血糖、体温并防误吸', '抽搐时按规范止惊并查明诱因'],
    complications: ['脑水肿和颅高压', '出血转化或再出血', '误吸肺炎和深静脉血栓', '吞咽障碍与营养风险'],
    guidelines: [
      { title: 'AHA/ASA Stroke Guidelines', url: 'https://www.stroke.org/en/professionals/stroke-resource-library/prevention-and-treatment-of-stroke' },
      { title: 'ESO Stroke Guidelines', url: 'https://eso-stroke.org/guidelines/' },
    ],
    scales: [
      { name: 'NIHSS', items: ['意识', '凝视/视野', '肢体运动', '语言/忽视'] },
      { name: 'GCS', items: ['睁眼反应', '语言反应', '运动反应'] },
    ],
    plan: '根据神经系统症状立即启动卒中/意识障碍流程：明确发病时间，快速影像排除出血和大血管闭塞，评估溶栓/取栓；同步处理血压、血糖、气道和吞咽安全，并请神经内科急会诊。',
    followUpTasks: ['记录发病时间和 NIHSS 动态', '跟进急诊影像与血管评估', '复核溶栓/取栓禁忌证', '监测血压、血糖、吞咽和意识', '制定二级预防和康复评估'],
  },
];

const getMatchedClinicalTemplate = (description: string) => {
  const normalized = description.trim();
  return clinicalTemplates.find(template => template.match.test(normalized));
};

const contextualizeItems = (items: string[], caseSummary: string) =>
  items.map(item => `${item}（结合病例：${caseSummary}）`);

const getLocalClinicalAnalysis = (description: string, imageBase64?: string): ClinicalAnalysis => {
  const caseSummary = truncate(description || (imageBase64 ? '已上传影像资料' : '未提供病例描述'), 80);
  const matchedTemplate = getMatchedClinicalTemplate(description);

  if (matchedTemplate) {
    return {
      diagnosis: contextualizeItems(matchedTemplate.diagnosis, caseSummary).slice(0, 3),
      omitted: contextualizeItems(matchedTemplate.omitted, caseSummary).slice(0, 4),
      medications: contextualizeItems(matchedTemplate.medications, caseSummary).slice(0, 4),
      complications: contextualizeItems(matchedTemplate.complications, caseSummary).slice(0, 4),
      guidelines: matchedTemplate.guidelines.slice(0, 2),
      scales: matchedTemplate.scales.slice(0, 2),
      plan: `${matchedTemplate.plan} 病例摘要：${caseSummary}`,
      followUpTasks: contextualizeItems(matchedTemplate.followUpTasks, caseSummary).slice(0, 5),
    };
  }

  return {
    diagnosis: [
      `围绕“${caseSummary}”形成主要临床诊断假设`,
      `根据“${caseSummary}”优先排查常见病与急危重症`,
      `若资料不足，需补充信息后由上级医师确认“${caseSummary}”相关诊断`,
    ],
    omitted: [
      `补充与“${caseSummary}”直接相关的现病史、诱因、持续时间和伴随症状`,
      `完善“${caseSummary}”相关体格检查、生命体征、过敏史、既往史与用药史`,
      `根据“${caseSummary}”选择血常规、生化、凝血、感染指标、尿检或影像检查`,
      `列出“${caseSummary}”的鉴别诊断，并记录支持/反对依据`,
    ],
    medications: [
      `暂不直接处方；需先结合“${caseSummary}”明确诊断、禁忌证和肝肾功能`,
      `可围绕“${caseSummary}”给予必要的对症支持治疗并观察疗效`,
      `若提示感染、缺血、疼痛或过敏等方向，应按对应专科路径选择药物`,
      `所有用药需核对过敏史、妊娠状态、相互作用和本院规范`,
    ],
    complications: [
      `“${caseSummary}”相关病情进展或漏诊风险`,
      `“${caseSummary}”相关器官功能恶化、感染、出血或血栓风险`,
      `对症或经验治疗可能带来的药物不良反应风险`,
      `延迟复评导致诊疗窗口延误风险`,
    ],
    guidelines: [
      { title: `围绕“${caseSummary}”检索国家卫健委/本院临床路径`, url: 'https://www.nhc.gov.cn/' },
      { title: `围绕“${caseSummary}”检索 BMJ Best Practice 或专科指南`, url: 'https://bestpractice.bmj.com/' },
    ],
    scales: [
      { name: `“${caseSummary}”病情严重程度复评`, items: ['生命体征', '疼痛/症状评分', '关键实验室指标', '影像或专科体征'] },
      { name: `“${caseSummary}”急危重症预警`, items: ['意识状态', '血压/心率', '血氧/呼吸', '尿量/灌注'] },
    ],
    plan: `针对用户提供的病例信息“${caseSummary}”，先确认生命体征和急危重症风险，再补充病史、查体和针对性检查；根据结果形成主要诊断与鉴别诊断，按本院规范和上级医师意见制定用药及处置，并动态复评风险。`,
    followUpTasks: [
      `复核“${caseSummary}”相关病史、体征和检查结果`,
      `列出“${caseSummary}”主要诊断及鉴别依据`,
      `向上级医师汇报“${caseSummary}”处置优先级`,
      `观察“${caseSummary}”症状变化和治疗反应`,
      `整理“${caseSummary}”后续复查、随访和宣教计划`,
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
字段要求：diagnosis 最多 3 项；omitted、medications、complications 各最多 4 项；guidelines 最多 2 项且包含 title 和 url；scales 最多 2 项且每项 items 最多 4 项；plan 250 字以内；followUpTasks 最多 5 项。所有字段都必须紧扣用户提供的病例信息，明确说明诊断依据、用药前提、鉴别诊断检查和风险来源；不得输出与病例无关的通用模板。内容必须专业、精炼，并提醒遵循医院规范和上级医师意见。`,
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
    instructions: '你是资深医学带教老师。必须基于既有病例分析和用户追问回答，围绕该病例的诊断、指南、用药、鉴别诊断、风险和随访展开；不得输出与病例无关的泛泛建议。回答需简洁、审慎、符合临床安全原则，避免替代医嘱。',
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
