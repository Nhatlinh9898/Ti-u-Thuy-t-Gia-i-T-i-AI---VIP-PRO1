
import React, { useState, useCallback, useEffect } from 'react';
import { NovelNode, AIActionType, SavedNovel, Character, WritingStyle, BackgroundMood, GeminiVoice } from './types';
import { architectNovelStructure, generateNovelContent, generateSceneImage, generateCinematicVideo } from './services/geminiService';
import TreeNavigation from './components/TreeNavigation';
import Library from './components/Library';
import VoiceStudio from './components/VoiceStudio';
import ComicStudio from './components/ComicStudio';
import { 
  Plus, Save, Feather, ListTree, Sparkles, ChevronLeft, GitBranch, Zap, Layers, PenTool, 
  Volume2, Users, Globe, Image as ImageIcon, Loader2, Wand2, Download, Video, FileText, Play,
  Moon, Sun, Wind, Coffee, Ghost, Flame, Layout, Mic2
} from 'lucide-react';

const STORAGE_KEY = 'novel_gia_dai_tai_v4';

const AVAILABLE_VOICES: { id: GeminiVoice; name: string; desc: string }[] = [
  { id: 'Kore', name: 'Kore (Nam)', desc: 'Giọng nam trung, rõ ràng, đĩnh đạc.' },
  { id: 'Charon', name: 'Charon (Nam)', desc: 'Giọng nam trầm, quyền lực, bí ẩn.' },
  { id: 'Puck', name: 'Puck (Nữ)', desc: 'Giọng nữ trẻ trung, năng động, tươi sáng.' },
  { id: 'Zephyr', name: 'Zephyr (Nữ)', desc: 'Giọng nữ nhẹ nhàng, truyền cảm, ấm áp.' },
  { id: 'Fenrir', name: 'Fenrir (Cường độ)', desc: 'Giọng gằn, mạnh mẽ, phù hợp vai phản diện.' }
];

const BACKGROUND_MOODS: BackgroundMood[] = [
  { id: 'mystic', name: 'Thư viện Cổ kính', description: 'Nến lung linh, kệ sách gỗ cao ngút, bụi vàng bay trong không trung.', visualPrompt: 'a grand mystical library with thousands of floating candles and old leather books, cinematic lighting', icon: 'Book' },
  { id: 'cyber', name: 'Tương lai (Cyber)', description: 'Màn hình holographic, ánh sáng neon tím, công nghệ siêu thực.', visualPrompt: 'a high-tech cyberpunk study room with neon holographic displays and metallic furniture', icon: 'Zap' },
  { id: 'zen', name: 'Trà đạo Yên tĩnh', description: 'Vườn tre bên ngoài, trà nóng bốc khói, không gian thiền định.', visualPrompt: 'a peaceful zen tea room with bamboo forest outside, soft natural light and minimal wood design', icon: 'Wind' },
  { id: 'horror', name: 'U linh Huyền bí', description: 'Sương mù lạnh lẽo, bóng tối bao phủ, sách cũ bốc cháy xanh.', visualPrompt: 'a dark gothic room with cold mist, ghostly blue candlelight and creepy shadows', icon: 'Ghost' },
  { id: 'celestial', name: 'Ngân hà Tinh tú', description: 'Ngồi giữa những vì sao, các chòm sao xoay quanh trang sách.', visualPrompt: 'an ethereal chamber floating in the galaxy, constellations swirling around the reader', icon: 'Moon' }
];

const createNewTree = (title: string = 'Tiểu Thuyết Mới'): NovelNode => ({
  id: `root-${Date.now()}`,
  type: 'novel',
  title,
  content: '',
  summary: 'Khung xương của một tác phẩm vĩ đại.',
  isExpanded: true,
  children: []
});

const App: React.FC = () => {
  const [novels, setNovels] = useState<SavedNovel[]>([]);
  const [currentNovelId, setCurrentNovelId] = useState<string | null>(null);
  const [tree, setTree] = useState<NovelNode>(createNewTree());
  const [setting, setSetting] = useState('');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [view, setView] = useState<'editor' | 'library'>('library');
  const [activeTab, setActiveTab] = useState<'architect' | 'writer' | 'studio' | 'comic' | 'export'>('architect');
  const [isBusy, setIsBusy] = useState(false);
  const [premise, setPremise] = useState('');
  const [visuals, setVisuals] = useState<Record<string, string>>({});
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [selectedMoodId, setSelectedMoodId] = useState<string>('mystic');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setNovels(JSON.parse(saved));
  }, []);

  const saveToLibrary = useCallback(() => {
    if (!currentNovelId) return;
    const updated = novels.map(n => n.id === currentNovelId ? { ...n, tree, setting, characters, lastUpdated: new Date().toISOString() } : n);
    setNovels(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, [currentNovelId, tree, setting, characters, novels]);

  const findNode = (root: NovelNode, id: string): NovelNode | null => {
    if (root.id === id) return root;
    for (const child of (root.children || [])) {
      const found = findNode(child, id);
      if (found) return found;
    }
    return null;
  };

  const selectedNode = findNode(tree, selectedId);

  const updateNode = (id: string, updates: Partial<NovelNode>) => {
    const updateRecursive = (node: NovelNode): NovelNode => {
      if (node.id === id) return { ...node, ...updates };
      return { ...node, children: (node.children || []).map(updateRecursive) };
    };
    setTree(updateRecursive(tree));
  };

  const handleExportText = () => {
    const collectContent = (node: NovelNode): string => {
      let text = `\n\n# ${node.title.toUpperCase()}\n\n${node.content || ''}`;
      if (node.children) node.children.forEach(c => text += collectContent(c));
      return text;
    };
    const fullText = `# ${tree.title}\n\nÝ tưởng: ${premise}\nBối cảnh: ${setting}\n${collectContent(tree)}`;
    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tree.title}.txt`;
    a.click();
  };

  const handleGenerateVideo = async () => {
    if (!selectedNode) return;
    const hasKey = await (window as any).aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await (window as any).aistudio.openSelectKey();
      return;
    }
    setIsBusy(true);
    setVideoUrl(null);
    try {
      const storyCtx = `${selectedNode.title}: ${selectedNode.summary || premise}`;
      const mood = BACKGROUND_MOODS.find(m => m.id === selectedMoodId);
      const url = await generateCinematicVideo(storyCtx, visuals[selectedId], mood?.visualPrompt);
      setVideoUrl(url);
    } catch (e: any) {
      if (e.message?.includes("entity was not found")) {
        await (window as any).aistudio.openSelectKey();
      } else {
        alert("Lỗi tạo video: " + e.message);
      }
    } finally { setIsBusy(false); }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-vip-900 text-gray-100 font-sans">
      <header className="h-16 bg-vip-900 border-b border-vip-700/50 flex items-center px-6 justify-between shadow-xl z-30">
        <div className="flex items-center gap-4">
          {view === 'editor' && <button onClick={() => setView('library')} className="p-2 hover:bg-vip-800 rounded-lg text-vip-300 transition-colors"><ChevronLeft size={20}/></button>}
          <div className="flex items-center gap-2 text-vip-gold">
            <Layers size={24} className="animate-pulse" />
            <h1 className="font-serif font-bold text-lg uppercase tracking-widest hidden md:block">Sovereign Studio</h1>
          </div>
        </div>

        {view === 'editor' && (
          <div className="flex items-center gap-3">
            <nav className="flex bg-vip-950/50 p-1 rounded-xl border border-vip-700/30">
               {[
                 { id: 'architect', label: 'Kiến trúc', icon: GitBranch },
                 { id: 'writer', label: 'Sáng tác', icon: PenTool },
                 { id: 'studio', label: 'Nhân vật', icon: Users },
                 { id: 'comic', label: 'Comic', icon: Layout },
                 { id: 'export', label: 'Xuất bản', icon: Download }
               ].map(tab => (
                 <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-vip-gold text-vip-900 shadow-lg' : 'text-vip-300 hover:text-white'}`}
                 >
                   <tab.icon size={12}/> {tab.label}
                 </button>
               ))}
            </nav>
            <button onClick={saveToLibrary} className="px-4 py-2 bg-vip-500 hover:bg-vip-400 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"><Save size={14} /></button>
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {view === 'library' ? (
          <Library novels={novels} onSelect={(n) => { setCurrentNovelId(n.id); setTree(n.tree); setSetting(n.setting); setCharacters(n.characters); setView('editor'); setSelectedId(n.tree.id); }} onCreate={() => { setNovels([{ id: `n-${Date.now()}`, title: 'Tác Phẩm Mới', lastUpdated: new Date().toISOString(), coverColor: 'bg-vip-500', tree: createNewTree(), setting: '', characters: [] }, ...novels]); }} onDelete={(id) => setNovels(novels.filter(n => n.id !== id))} />
        ) : (
          <>
            <aside className="w-64 bg-vip-900 border-r border-vip-700/30 hidden md:flex flex-col">
              <div className="p-4 border-b border-vip-800 font-black text-[10px] text-vip-300 uppercase flex items-center justify-between">
                <span><ListTree size={14} className="inline mr-2" /> Phân cấp</span>
                <button onClick={() => updateNode(selectedId, { children: [...(selectedNode?.children || []), { id: `manual-${Date.now()}`, type: 'chapter', title: 'Mục mới', content: '', summary: '', children: [] }] })} className="text-vip-gold hover:scale-110 transition-transform"><Plus size={14}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 scrollbar-thin"><TreeNavigation node={tree} selectedId={selectedId} onSelect={(n) => setSelectedId(n.id)} onToggle={(n) => updateNode(n.id, { isExpanded: !n.isExpanded })} /></div>
            </aside>

            <main className="flex-1 overflow-y-auto bg-[#0a060f] scrollbar-thin">
              {activeTab === 'architect' && (
                <div className="max-w-4xl mx-auto p-8 space-y-8">
                  <div className="bg-vip-800/20 border border-vip-500/40 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative">
                    <h2 className="text-4xl font-serif font-bold text-vip-gold mb-4 italic">Kiến Trúc Sư AI</h2>
                    <textarea 
                      value={premise} 
                      onChange={(e) => setPremise(e.target.value)} 
                      className="w-full bg-vip-950/80 border border-vip-700/60 rounded-2xl p-6 text-zinc-50 h-40 font-serif italic mb-6 placeholder:text-vip-700 focus:border-vip-gold/50 focus:outline-none transition-all" 
                      placeholder="Mô tả ý tưởng cốt lõi của tác phẩm tại đây..."
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <button disabled={isBusy || !premise} onClick={() => architectNovelStructure(selectedNode!, AIActionType.GENERATE_FULL_STRUCTURE, premise, setting, characters).then(d => updateNode(selectedId, { children: d, isExpanded: true }))} className="bg-vip-gold text-vip-900 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:brightness-110 transition-all disabled:opacity-50">KIẾN TRÚC TOÀN BỘ</button>
                      <button disabled={isBusy || !premise || !selectedId} onClick={() => architectNovelStructure(selectedNode!, AIActionType.ARCHITECT_DEEPEN, premise, setting, characters).then(d => updateNode(selectedId, { children: [...(selectedNode?.children || []), ...d], isExpanded: true }))} className="bg-vip-800 text-vip-gold border border-vip-gold/30 py-4 rounded-2xl font-black text-[10px] uppercase hover:bg-vip-700 transition-all disabled:opacity-50">ĐÀO SÂU PHÂN ĐOẠN</button>
                    </div>
                  </div>
                  {selectedNode && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="bg-vip-950/40 p-8 rounded-3xl border border-vip-700/30 space-y-4">
                        <input className="bg-transparent text-2xl font-bold font-serif text-white w-full border-b border-transparent focus:border-vip-gold/20 focus:outline-none" value={selectedNode.title} onChange={(e) => updateNode(selectedId, { title: e.target.value })} />
                        <textarea className="bg-vip-800/30 w-full text-sm text-zinc-100 p-4 rounded-xl min-h-[120px] border border-vip-700/20 focus:border-vip-gold/30 focus:outline-none transition-all" value={selectedNode.summary} onChange={(e) => updateNode(selectedId, { summary: e.target.value })} placeholder="Tóm tắt nội dung phân đoạn..." />
                      </div>
                      <div className="aspect-video bg-vip-950 rounded-3xl border border-vip-700/30 overflow-hidden relative group shadow-inner">
                        {visuals[selectedId] ? <img src={visuals[selectedId]} className="w-full h-full object-cover" /> : <div className="w-full h-full flex flex-col items-center justify-center text-vip-800"><ImageIcon size={48} className="opacity-20" /></div>}
                        <button onClick={async () => { setIsBusy(true); const img = await generateSceneImage(selectedNode.summary); setVisuals(v => ({...v, [selectedId]: img})); setIsBusy(false); }} className="absolute bottom-4 right-4 bg-vip-900/90 p-3 rounded-xl text-vip-gold text-[10px] font-black uppercase hover:bg-vip-gold hover:text-vip-900 transition-all shadow-xl">PHÁC HỌA VISUAL</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'writer' && (
                <div className="h-full flex flex-col">
                  <div className="flex-1 p-8 overflow-y-auto">
                    <div className="max-w-3xl mx-auto space-y-8">
                      <div className="flex items-center justify-between border-b border-vip-700/40 pb-6">
                        <h3 className="text-3xl font-serif font-bold text-white italic tracking-tighter">Chương: <span className="text-vip-gold">{selectedNode?.title}</span></h3>
                        <button onClick={async () => { setIsBusy(true); const res = await generateNovelContent(selectedNode!, premise, setting, characters); updateNode(selectedId, { content: (selectedNode?.content || '') + '\n\n' + res }); setIsBusy(false); }} className="bg-vip-gold text-vip-900 px-6 py-3 rounded-2xl font-black text-[10px] uppercase flex items-center gap-2 shadow-lg active:scale-95 transition-all">
                           {isBusy ? <Loader2 className="animate-spin" size={14}/> : <Wand2 size={14}/>} VIẾT TIẾP
                        </button>
                      </div>
                      <textarea 
                        className="w-full bg-transparent text-zinc-50 text-xl leading-[1.9] font-serif focus:outline-none min-h-[700px] pb-64 placeholder:text-vip-800" 
                        value={selectedNode?.content || ''} 
                        onChange={(e) => updateNode(selectedId, { content: e.target.value })} 
                        placeholder="Bắt đầu chương truyện vĩ đại của bạn tại đây..."
                      />
                    </div>
                  </div>
                  <div className="bg-vip-900/95 backdrop-blur-2xl border-t border-vip-700/60 p-6 fixed bottom-0 left-0 right-0 md:left-64 z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
                    <VoiceStudio text={selectedNode?.content || ''} characters={characters} chapterTitle={selectedNode?.title} />
                  </div>
                </div>
              )}

              {activeTab === 'studio' && (
                <div className="max-w-6xl mx-auto p-12 space-y-12 pb-32">
                   <div className="flex items-center justify-between mb-8 border-b border-vip-700/30 pb-4">
                      <h2 className="text-4xl font-serif font-bold text-vip-gold italic">Xưởng Nhân Vật</h2>
                      <button onClick={() => setCharacters([...characters, { id: `c-${Date.now()}`, name: 'Nhân vật mới', role: 'supporting', description: '', personality: '', goal: '', voiceName: 'Kore' }])} className="bg-vip-700 hover:bg-vip-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95"><Plus size={20}/> TẠO MỚI</button>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {characters.map(char => (
                        <div key={char.id} className="bg-vip-800/20 border border-vip-700/40 rounded-3xl p-6 hover:border-vip-gold/20 transition-all shadow-xl group space-y-4">
                           <div>
                             <input 
                              className="bg-transparent text-xl font-bold text-zinc-50 w-full mb-1 border-b border-transparent focus:border-vip-gold/30 focus:outline-none transition-all" 
                              value={char.name} 
                              placeholder="Tên nhân vật"
                              onChange={(e) => setCharacters(characters.map(c => c.id === char.id ? {...c, name: e.target.value} : c))} 
                             />
                             <p className="text-[10px] text-vip-gold uppercase font-black tracking-tighter opacity-70 group-hover:opacity-100 transition-opacity">{char.role}</p>
                           </div>

                           <div className="space-y-2">
                             <label className="text-[9px] font-black text-vip-300 uppercase flex items-center gap-2"><Mic2 size={12}/> Giọng lồng tiếng</label>
                             <select 
                                value={char.voiceName || 'Kore'} 
                                onChange={(e) => setCharacters(characters.map(c => c.id === char.id ? {...c, voiceName: e.target.value as GeminiVoice} : c))}
                                className="w-full bg-vip-950/80 border border-vip-700/60 rounded-xl p-2.5 text-xs text-white focus:border-vip-gold/40 focus:outline-none transition-all"
                             >
                               {AVAILABLE_VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                             </select>
                             <p className="text-[9px] text-zinc-400 italic px-1">{AVAILABLE_VOICES.find(v => v.id === (char.voiceName || 'Kore'))?.desc}</p>
                           </div>

                           <textarea 
                            className="bg-vip-900/30 w-full text-xs text-zinc-300 italic h-24 p-3 rounded-xl border border-vip-700/20 focus:border-vip-gold/30 focus:outline-none transition-all placeholder:text-vip-800" 
                            value={char.description} 
                            placeholder="Mô tả ngoại hình, tính cách, mục tiêu nhân vật..."
                            onChange={(e) => setCharacters(characters.map(c => c.id === char.id ? {...c, description: e.target.value} : c))} 
                           />
                        </div>
                      ))}
                   </div>
                </div>
              )}

              {activeTab === 'comic' && (
                <ComicStudio 
                  content={selectedNode?.content || ''} 
                  characters={characters} 
                  title={selectedNode?.title || 'Chương mới'} 
                />
              )}

              {activeTab === 'export' && (
                <div className="max-w-5xl mx-auto p-12 space-y-12 pb-32">
                   <div className="border-b border-vip-700/30 pb-6">
                    <h2 className="text-4xl font-serif font-bold text-vip-gold italic">Trung Tâm Xuất Bản</h2>
                    <p className="text-sm text-zinc-300 mt-2">Biến con chữ thành những trải nghiệm đa giác quan.</p>
                   </div>
                   
                   <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                      {/* Export Text */}
                      <div className="lg:col-span-5 bg-vip-800/30 border border-vip-700/50 rounded-[2rem] p-8 space-y-4 hover:border-vip-gold/50 transition-all h-full shadow-xl">
                        <div className="p-4 bg-vip-gold/10 text-vip-gold w-fit rounded-2xl"><FileText size={32}/></div>
                        <h3 className="text-2xl font-serif font-bold text-white">Bản Thảo Hoàn Chỉnh</h3>
                        <p className="text-sm text-zinc-300">Gộp toàn bộ các chương và phân đoạn thành một file văn bản duy nhất để in ấn hoặc chỉnh sửa ngoài.</p>
                        <button onClick={handleExportText} className="w-full bg-vip-gold text-vip-900 py-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-lg">
                          <Download size={16}/> TẢI BẢN THẢO (.TXT)
                        </button>
                      </div>

                      {/* Export Cinema (Video) */}
                      <div className="lg:col-span-7 bg-vip-800/30 border border-vip-700/50 rounded-[2rem] p-8 space-y-8 hover:border-indigo-500/50 transition-all shadow-xl">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="p-4 bg-indigo-500/10 text-indigo-400 w-fit rounded-2xl"><Video size={32}/></div>
                            <div>
                              <h3 className="text-2xl font-serif font-bold text-white">Cinema Reading</h3>
                              <p className="text-xs text-indigo-300 italic">Quay phim cảnh nhân vật đang đọc truyện</p>
                            </div>
                          </div>
                        </div>

                        {/* Mood Selection Container */}
                        <div className="space-y-4">
                          <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest block">1. Chọn Bối Cảnh (Atmosphere)</label>
                          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
                            {BACKGROUND_MOODS.map(mood => (
                              <button 
                                key={mood.id}
                                onClick={() => setSelectedMoodId(mood.id)}
                                className={`flex-shrink-0 w-32 p-4 rounded-2xl border transition-all text-center space-y-2 ${selectedMoodId === mood.id ? 'bg-indigo-600/30 border-indigo-400 shadow-lg shadow-indigo-500/20' : 'bg-vip-900 border-vip-700/50 hover:border-indigo-500/30'}`}
                              >
                                <div className={`mx-auto p-2 rounded-xl ${selectedMoodId === mood.id ? 'text-white' : 'text-indigo-400 opacity-50'}`}>
                                  {mood.icon === 'Book' && <ListTree size={20}/>}
                                  {mood.icon === 'Zap' && <Zap size={20}/>}
                                  {mood.icon === 'Wind' && <Wind size={20}/>}
                                  {mood.icon === 'Ghost' && <Ghost size={20}/>}
                                  {mood.icon === 'Moon' && <Moon size={20}/>}
                                </div>
                                <span className={`text-[10px] font-bold block ${selectedMoodId === mood.id ? 'text-white' : 'text-zinc-400'}`}>{mood.name}</span>
                              </button>
                            ))}
                          </div>
                          <p className="text-[10px] text-zinc-300 italic bg-vip-950/40 p-3 rounded-lg border border-vip-700/20">
                             {BACKGROUND_MOODS.find(m => m.id === selectedMoodId)?.description}
                          </p>
                        </div>

                        <div className="space-y-4">
                          <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest block">2. Xem trước & Khởi tạo</label>
                          {videoUrl ? (
                            <div className="relative rounded-2xl overflow-hidden border border-vip-700/60 shadow-2xl group/vid">
                              <video src={videoUrl} controls className="w-full aspect-video" />
                              <div className="absolute top-2 right-2 bg-vip-900/90 px-2 py-1 rounded text-[8px] font-bold uppercase tracking-tighter text-indigo-300">VEO 3.1 AI</div>
                            </div>
                          ) : (
                            <div className="aspect-video bg-vip-950 rounded-2xl border border-dashed border-vip-700/50 flex flex-col items-center justify-center text-vip-700 group-hover:border-indigo-500/30 transition-all shadow-inner">
                               {isBusy ? (
                                 <div className="flex flex-col items-center gap-3">
                                   <Loader2 className="animate-spin text-indigo-400" size={32} />
                                   <span className="text-[10px] font-black uppercase tracking-widest animate-pulse text-indigo-300">Đang quay phim bối cảnh...</span>
                                 </div>
                               ) : (
                                 <div className="flex flex-col items-center gap-2 text-center px-8">
                                   <Play size={24} className="opacity-20 mb-2" />
                                   <span className="text-[10px] font-black uppercase tracking-widest opacity-40 text-zinc-400">Video sẽ thể hiện một người đang ngồi đọc "{selectedNode?.title}" trong bối cảnh {BACKGROUND_MOODS.find(m => m.id === selectedMoodId)?.name}</span>
                                 </div>
                               )}
                            </div>
                          )}
                        </div>

                        <button disabled={isBusy || !selectedId} onClick={handleGenerateVideo} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg active:scale-95 transition-all">
                          {isBusy ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>} KHỞI TẠO VIDEO CINEMA
                        </button>
                        <p className="text-[9px] text-zinc-500 text-center italic">* Sử dụng làm reference background cho trailer hoặc audio book của bạn.</p>
                      </div>
                   </div>
                </div>
              )}
            </main>
          </>
        )}
      </div>
    </div>
  );
};

export default App;
