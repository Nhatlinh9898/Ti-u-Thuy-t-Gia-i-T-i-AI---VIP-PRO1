
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AIActionType, NovelNode, Character, WritingStyle, ComicPanel, GeminiVoice } from "../types";

// Hàm bổ trợ để tự động thử lại khi gặp lỗi Rate Limit (429)
async function callWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && (error.message?.includes("429") || error.message?.includes("quota"))) {
      console.warn(`Rate limit hit. Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export const architectNovelStructure = async (
  targetNode: NovelNode,
  action: AIActionType,
  premise: string,
  setting: string,
  characters: Character[]
): Promise<any[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = "gemini-3-pro-preview";
  const prompt = `Ý tưởng: "${premise}". Bối cảnh: ${setting}. Nhân vật: ${characters.map(c => c.name).join(', ')}. Hãy thiết kế ${action === AIActionType.GENERATE_FULL_STRUCTURE ? 'toàn bộ' : `chi tiết cho: ${targetNode.title}`}.`;

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: { 
        systemInstruction: "Bạn là Siêu Trí Tuệ Kiến Trúc Văn Học.",
        responseMimeType: "application/json", 
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              metadata: {
                type: Type.OBJECT,
                properties: {
                  objective: { type: Type.STRING },
                  conflict: { type: Type.STRING },
                  pacing: { type: Type.STRING }
                }
              },
              children: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { type: Type.STRING, title: Type.STRING, summary: Type.STRING } } }
            }
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  });
};

export const generateComicScript = async (
  chapterContent: string,
  characters: Character[]
): Promise<ComicPanel[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Chuyển thể chương truyện này thành kịch bản truyện tranh Webtoon. Nội dung: ${chapterContent}. Nhân vật: ${characters.map(c => c.name).join(', ')}.`;

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        systemInstruction: "Bạn là chuyên gia Storyboard truyện tranh chuyên nghiệp.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING },
              dialogue: { type: Type.STRING },
              visualPrompt: { type: Type.STRING }
            }
          }
        }
      }
    });

    const parsed = JSON.parse(response.text || "[]");
    return parsed.map((p: any, idx: number) => ({
      id: `panel-${Date.now()}-${idx}`,
      ...p
    }));
  });
};

export const generatePanelImage = async (prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ parts: [{ text: `High-quality comic panel art, webtoon style, detailed: ${prompt}` }] }],
    });
    const part = response.candidates[0].content.parts.find(p => p.inlineData);
    return part ? `data:image/png;base64,${part.inlineData.data}` : "";
  });
};

export const generateSceneImage = async (prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ parts: [{ text: `Cinematic concept art for novel: ${prompt}. Digital painting, 4k.` }] }],
    });
    const part = response.candidates[0].content.parts.find(p => p.inlineData);
    return part ? `data:image/png;base64,${part.inlineData.data}` : "";
  });
};

export const generateCinematicVideo = async (
  storyContext: string, 
  imageBase64?: string,
  moodPrompt?: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const backgroundDescription = moodPrompt || "a mystical library";
  const videoPrompt = `Cinematic video: A character sitting in ${backgroundDescription} while elements of this story manifest: ${storyContext}.`;

  let operation = await callWithRetry(async () => ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: videoPrompt,
    image: imageBase64 ? {
      imageBytes: imageBase64.split(',')[1],
      mimeType: 'image/png'
    } : undefined,
    config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
  }));

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("Failed to generate video");
  
  const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  const blob = await videoResponse.blob();
  return URL.createObjectURL(blob);
};

/**
 * Xuất bản kịch bản âm thanh duy nhất cho toàn bộ văn bản.
 * Giúp tiết kiệm số lần gọi API làm sạch văn bản.
 */
export const prepareAudioScript = async (
  text: string,
  chapterTitle: string,
  atmosphere: string,
  mcName: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const cleaningPrompt = `Bạn là biên tập viên kịch bản Radio. Hãy chuyển đổi văn bản truyện sau thành một kịch bản đọc mượt mà cho toàn chương "${chapterTitle}".
  Quy tắc:
  - Lời dẫn: NARRATOR: [Nội dung]
  - Lời thoại: CHAR: [Nội dung]
  - XÓA BỎ "hắn nói", "cô đáp".
  - Thêm lời dẫn đầu của MC ${mcName} chào mừng đến với chương "${chapterTitle}".
  - Thêm lời kết của MC ${mcName} chúc ngủ ngon ở cuối.
  - Không khí: ${atmosphere}.

  Văn bản: ${text}`;

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: cleaningPrompt,
      config: {
        systemInstruction: "Bạn là chuyên gia chuyển thể kịch bản truyền thanh chuyên nghiệp.",
      }
    });
    return response.text || text;
  });
};

/**
 * Chỉ thực hiện lồng tiếng từ kịch bản ĐÃ ĐƯỢC làm sạch.
 */
export const generateTTSFromScript = async (
  cleanScriptChunk: string,
  charVoice: GeminiVoice
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: cleanScriptChunk }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              {
                speaker: 'NARRATOR',
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
              },
              {
                speaker: 'CHAR',
                voiceConfig: { prebuiltVoiceConfig: { voiceName: charVoice } }
              }
            ]
          }
        }
      },
    });

    const audioPart = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioPart) throw new Error("Model returned no audio.");
    return audioPart;
  });
};

export const generateNovelContent = async (
  node: NovelNode,
  premise: string,
  setting: string,
  characters: Character[]
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Viết chương: ${node.title}. Ý tưởng: ${premise}. Bối cảnh: ${setting}. Nhân vật: ${characters.map(c => `${c.name} (${c.role})`).join(', ')}.`,
      config: { thinkingConfig: { thinkingBudget: 8000 } }
    });
    return response.text || "";
  });
};
