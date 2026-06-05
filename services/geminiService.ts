
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const translateText = async (text: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `请将以下学术内容翻译成专业且地道的中文。如果已经是中文，则保持不变。仅输出翻译结果，不要有任何解释。\n\n内容: "${text}"`,
  });
  return response.text?.trim() || text;
};

export const analyzeCase = async (description: string, imageBase64?: string) => {
  const ai = getAI();
  const systemInstruction = `你是一个资深的临床医学专家。请根据用户提供的病例描述（可能包含文字或图片内容），输出结构化的临床分析。
  所有内容必须高度针对病例，保持专业、严谨的同时请务必【精炼简洁】，避免冗余输出导致截断。
  内容要求及数量限制：
  1. 可能的诊断（diagnosis）：最多提供 3 个最可能的诊断。
  2. 可能忽略的鉴别诊断或检查（omitted）：最多提供 4 个关键项。
  3. 建议用药（medications）：最多提供 4 种核心药物或基本用法。
  4. 患者有可能出现的并发症及风险（complications）：最多提供 4 项最关键的高危风险。
  5. 相关临床指南链接（guidelines）：最多提供 2 个最权威的、针对该病的主要治疗指南（填入正确的 title 和可用、合理的 URL）。
  6. 适合该病人的病情评估量表（scales）：最多提供 2 个针对本病最核心的专业评估量表。每个量表的检测/评估条目（items）最多 4 个。绝对不要提供通用心理、非针对性的社会学及一般生活质量量表！保证针对医学指标或病情分级。
  7. 诊疗方案模型（plan）：请用精炼的语言概括完整的方案，字数控制在 250 字以内。
  8. 后续任务打卡计划（followUpTasks）：最多 5 个切实可行的核心复查、随访、换药计划。
  
  请务必严格按照要求的 JSON 格式输出，各字段条目数量绝对不能超限，确保 JSON 能够完整生成且闭合。`;

  const userParts: any[] = [{ text: `病例描述: ${description}` }];
  if (imageBase64) {
    userParts.unshift({
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageBase64,
      }
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: imageBase64 ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview',
      contents: { parts: userParts },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        maxOutputTokens: 4096, // Increased to handle very long medical plans
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            diagnosis: { type: Type.ARRAY, items: { type: Type.STRING } },
            omitted: { type: Type.ARRAY, items: { type: Type.STRING } },
            medications: { type: Type.ARRAY, items: { type: Type.STRING } },
            complications: { type: Type.ARRAY, items: { type: Type.STRING } },
            guidelines: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  url: { type: Type.STRING }
                }
              }
            },
            scales: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  items: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
              }
            },
            plan: { type: Type.STRING },
            followUpTasks: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    let text = response.text?.trim();
    if (!text) throw new Error("AI 返回内容为空");

    // Robust JSON extraction: strip markdown code blocks if AI accidentally includes them
    if (text.includes('```')) {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) text = match[1];
    }

    try {
      return JSON.parse(text);
    } catch (parseError) {
      console.error("JSON Parse Error. Raw text:", text);
      // Check if truncated
      if (response.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
        throw new Error("病例分析内容过长，超出了系统单次处理上限，请尝试分段输入。");
      }
      throw new Error("AI 输出格式异常，请尝试重新生成。");
    }
  } catch (error) {
    console.error("AI Analysis Error:", error);
    throw error;
  }
};

export const getResearchHelp = async (topic: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `针对研究方向 "${topic}"，请提供：1. 10篇最新的高质量参考文献推荐（含标题、期刊和搜索链接）；2. 创新的科研点子；3. 科研管理与进度控制的建议。请确保信息真实可靠，使用Google搜索辅助。`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          literatures: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                journal: { type: Type.STRING },
                link: { type: Type.STRING }
              }
            }
          },
          ideas: { type: Type.ARRAY, items: { type: Type.STRING } },
          managementTips: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
      }
    }
  });
  return JSON.parse(response.text || '{}');
};
