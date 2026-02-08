
import React, { useState } from 'react';
import { ComicPanel, Character } from '../types';
import { generateComicScript, generatePanelImage } from '../services/geminiService';
import { Wand2, Image as ImageIcon, MessageSquare, Loader2, Sparkles, Download, Layout } from 'lucide-react';

interface ComicStudioProps {
  content: string;
  characters: Character[];
  title: string;
}

const ComicStudio: React.FC<ComicStudioProps> = ({ content, characters, title }) => {
  const [panels, setPanels] = useState<ComicPanel[]>([]);
  const [isBusy, setIsBusy] = useState(false);

  const handleCreateScript = async () => {
    if (!content) return;
    setIsBusy(true);
    try {
      const script = await generateComicScript(content, characters);
      setPanels(script);
    } catch (e) {
      alert("Lỗi tạo kịch bản: " + e);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDrawPanel = async (id: string) => {
    const panel = panels.find(p => p.id === id);
    if (!panel) return;
    
    setPanels(prev => prev.map(p => p.id === id ? { ...p, isLoading: true } : p));
    try {
      const img = await generatePanelImage(panel.visualPrompt);
      setPanels(prev => prev.map(p => p.id === id ? { ...p, imageUrl: img, isLoading: false } : p));
    } catch (e) {
      setPanels(prev => prev.map(p => p.id === id ? { ...p, isLoading: false } : p));
    }
  };

  const handleDrawAll = async () => {
    for (const panel of panels) {
      if (!panel.imageUrl) await handleDrawPanel(panel.id);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-12 pb-32">
      <div className="flex items-center justify-between border-b border-vip-700/30 pb-6">
        <div>
          <h2 className="text-4xl font-serif font-bold text-vip-gold italic">Comic Studio</h2>
          <p className="text-sm text-zinc-300 mt-2">Chuyển thể chương "{title}" thành truyện tranh Webtoon.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={handleCreateScript} 
            disabled={isBusy || !content}
            className="bg-vip-700 hover:bg-vip-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95 disabled:opacity-50"
          >
            {isBusy ? <Loader2 className="animate-spin" size={20}/> : <Layout size={20}/>}
            PHÂN TÍCH KỊCH BẢN
          </button>
          {panels.length > 0 && (
            <button 
              onClick={handleDrawAll}
              className="bg-vip-gold text-vip-900 px-6 py-3 rounded-2xl font-black text-[10px] uppercase flex items-center gap-2 shadow-lg active:scale-95 transition-all"
            >
              <Sparkles size={16}/> VẼ TOÀN BỘ
            </button>
          )}
        </div>
      </div>

      <div className="space-y-12">
        {panels.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-vip-700/30 rounded-[3rem] text-vip-700 opacity-50">
             <Layout size={64} className="mb-4" />
             <p className="font-serif italic text-lg text-center px-20">Hãy nhấn "Phân tích kịch bản" để AI bắt đầu chia khung hình và phác thảo Storyboard cho chương truyện của bạn.</p>
          </div>
        ) : (
          panels.map((panel, idx) => (
            <div key={panel.id} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start group">
              {/* Visual Display */}
              <div className="lg:col-span-7 relative aspect-[3/4] bg-vip-950 rounded-3xl overflow-hidden border border-vip-700/50 shadow-2xl">
                 {panel.imageUrl ? (
                   <img src={panel.imageUrl} className="w-full h-full object-cover" />
                 ) : (
                   <div className="w-full h-full flex flex-col items-center justify-center">
                     {panel.isLoading ? (
                       <div className="flex flex-col items-center gap-4">
                         <Loader2 className="animate-spin text-vip-gold" size={48} />
                         <span className="text-[10px] font-black uppercase tracking-widest text-vip-gold animate-pulse">Đang vẽ khung hình {idx + 1}...</span>
                       </div>
                     ) : (
                       <button onClick={() => handleDrawPanel(panel.id)} className="group/draw flex flex-col items-center gap-4 hover:scale-110 transition-all">
                         <ImageIcon size={48} className="text-vip-800 group-hover/draw:text-vip-gold transition-colors" />
                         <span className="text-[10px] font-black uppercase text-vip-800">Nhấn để vẽ khung hình</span>
                       </button>
                     )}
                   </div>
                 )}
                 <div className="absolute top-4 left-4 bg-vip-900/80 backdrop-blur-md px-4 py-2 rounded-xl text-vip-gold font-serif font-bold italic shadow-xl">
                    #{idx + 1}
                 </div>
              </div>

              {/* Script Data */}
              <div className="lg:col-span-5 space-y-6 pt-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-vip-gold uppercase tracking-widest flex items-center gap-2">
                    <Sparkles size={12}/> Mô tả khung hình
                  </label>
                  <div className="bg-vip-800/30 p-4 rounded-2xl border border-vip-700/20 text-zinc-100 text-sm leading-relaxed italic">
                    {panel.description}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                    <MessageSquare size={12}/> Lời thoại / Dẫn chuyện
                  </label>
                  <textarea 
                    className="w-full bg-vip-950/80 border border-vip-700/50 p-4 rounded-2xl text-zinc-50 font-serif text-lg italic focus:border-indigo-500/50 focus:outline-none transition-all"
                    value={panel.dialogue}
                    onChange={(e) => {
                      const newPanels = [...panels];
                      newPanels[idx].dialogue = e.target.value;
                      setPanels(newPanels);
                    }}
                  />
                </div>

                <div className="space-y-2 opacity-40 group-hover:opacity-100 transition-opacity">
                   <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Visual Prompt (AI Reference)</label>
                   <p className="text-[10px] text-zinc-400 italic font-mono">{panel.visualPrompt}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ComicStudio;
