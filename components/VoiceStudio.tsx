
import React, { useState, useRef } from 'react';
import { Play, Square, Radio, User, Download, Mic2, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { prepareAudioScript, generateTTSFromScript } from '../services/geminiService';
import { Character, GeminiVoice } from '../types';

interface VoiceStudioProps {
  text: string;
  characters: Character[];
  chapterTitle?: string;
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const buffer = ctx.createBuffer(numChannels, dataInt16.length / numChannels, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < buffer.length; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}

const smartSplitScript = (script: string, maxLen: number = 1000): string[] => {
  if (!script) return [];
  // Chia theo các nhãn NARRATOR: hoặc CHAR: để không cắt ngang câu thoại
  const parts = script.split(/(?=(?:NARRATOR:|CHAR:))/g);
  const chunks: string[] = [];
  let currentChunk = "";

  parts.forEach(p => {
    if ((currentChunk + p).length > maxLen && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = p;
    } else {
      currentChunk += p;
    }
  });
  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
};

const VoiceStudio: React.FC<VoiceStudioProps> = ({ text, characters, chapterTitle }) => {
  const [status, setStatus] = useState<'idle' | 'cleaning' | 'generating' | 'playing' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [atmosphere, setAtmosphere] = useState('kịch tính, hào hùng');
  const [focusCharId, setFocusCharId] = useState<string>(characters[0]?.id || '');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const isCancelledRef = useRef<boolean>(false);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const audioBuffersRef = useRef<AudioBuffer[]>([]);

  const stopPlayback = () => {
    isCancelledRef.current = true;
    activeSourcesRef.current.forEach(s => { try { s.stop(); } catch (e) {} });
    activeSourcesRef.current.clear();
    setStatus('idle');
    nextStartTimeRef.current = 0;
  };

  const handlePlay = async () => {
    if (!text || status !== 'idle') return;
    
    isCancelledRef.current = false;
    setStatus('cleaning');
    setErrorMsg('');
    audioBuffersRef.current = [];
    activeSourcesRef.current.clear();

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();

    try {
      // BƯỚC 1: Biên tập toàn bộ nội dung (1 Request duy nhất)
      const cleanScript = await prepareAudioScript(text, chapterTitle || "Chương mới", atmosphere, 'Gia Đại Tài');
      
      if (isCancelledRef.current) return;
      setStatus('generating');

      // BƯỚC 2: Chia nhỏ kịch bản đã làm sạch
      const chunks = smartSplitScript(cleanScript);
      setProgress({ current: 0, total: chunks.length });

      nextStartTimeRef.current = audioContextRef.current.currentTime + 0.1;
      const focusChar = characters.find(c => c.id === focusCharId);
      const charVoice: GeminiVoice = focusChar?.voiceName || 'Zephyr';

      // BƯỚC 3: Lồng tiếng tuần tự (N Request TTS)
      for (let i = 0; i < chunks.length; i++) {
        if (isCancelledRef.current) break;
        setProgress(p => ({ ...p, current: i + 1 }));
        
        const base64Audio = await generateTTSFromScript(chunks[i], charVoice);

        if (isCancelledRef.current) break;
        const audioBuffer = await decodeAudioData(decode(base64Audio), audioContextRef.current, 24000, 1);
        
        if (isCancelledRef.current) break;
        audioBuffersRef.current.push(audioBuffer);
        
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        
        const playTime = Math.max(nextStartTimeRef.current, audioContextRef.current.currentTime + 0.05);
        source.start(playTime);
        nextStartTimeRef.current = playTime + audioBuffer.duration;
        
        activeSourcesRef.current.add(source);
        source.onended = () => {
          activeSourcesRef.current.delete(source);
          if (i === chunks.length - 1 && activeSourcesRef.current.size === 0 && !isCancelledRef.current) {
            setStatus('idle');
          }
        };

        if (!isCancelledRef.current) setStatus('playing');
        
        // Thêm khoảng nghỉ cực ngắn để tránh spam API liên tục
        await new Promise(r => setTimeout(r, 300));
      }
    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setErrorMsg(e.message?.includes("429") ? "Hệ thống đang bận (Hết hạn mức). Vui lòng thử lại sau 1 phút." : "Lỗi lồng tiếng AI.");
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  const handleDownload = () => {
    if (audioBuffersRef.current.length === 0) return;
    const totalLen = audioBuffersRef.current.reduce((a, b) => a + b.length, 0);
    const combined = new Float32Array(totalLen);
    let offset = 0;
    audioBuffersRef.current.forEach(b => { combined.set(b.getChannelData(0), offset); offset += b.length; });

    const buffer = new ArrayBuffer(44 + combined.length * 2);
    const view = new DataView(buffer);
    const writeStr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
    writeStr(0, 'RIFF'); view.setUint32(4, 36 + combined.length * 2, true); writeStr(8, 'WAVE');
    writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, 24000, true); view.setUint32(28, 48000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    writeStr(36, 'data'); view.setUint32(40, combined.length * 2, true);
    for (let i = 0; i < combined.length; i++) view.setInt16(44 + i * 2, combined[i] * 32767, true);

    const url = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
    const a = document.createElement('a'); a.href = url; a.download = `${chapterTitle || 'audio'}.wav`; a.click();
  };

  return (
    <div className="bg-vip-800/60 backdrop-blur-2xl border border-vip-500/40 rounded-3xl p-5 shadow-2xl relative overflow-hidden group">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-vip-gold/10 rounded-xl">
             <Radio size={22} className={`${status !== 'idle' ? 'text-vip-gold animate-pulse' : 'text-vip-300'}`} />
          </div>
          <div>
            <h3 className="font-serif font-bold text-white italic text-base tracking-tight">Thính Phòng Kịch Bản</h3>
            <p className="text-[9px] text-vip-300 uppercase font-black tracking-widest opacity-60">Professional Radio Play Engine</p>
          </div>
        </div>
        <div className="flex gap-2">
          {audioBuffersRef.current.length > 0 && status === 'idle' && (
            <button onClick={handleDownload} className="p-2.5 bg-vip-700/50 hover:bg-vip-gold hover:text-vip-900 rounded-xl transition-all shadow-lg">
              <Download size={18}/>
            </button>
          )}
          {status === 'idle' || status === 'error' ? (
            <button onClick={handlePlay} className={`${status === 'error' ? 'bg-red-500' : 'bg-vip-gold'} text-vip-900 px-6 py-2 rounded-xl font-black text-[11px] uppercase shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2`}>
              {status === 'error' ? <AlertCircle size={14}/> : <Play size={14} fill="currentColor"/>} {status === 'error' ? 'THỬ LẠI' : 'BẮT ĐẦU DIỄN ĐỌC'}
            </button>
          ) : (
            <button onClick={stopPlayback} className="bg-red-500 text-white px-6 py-2 rounded-xl font-black text-[11px] uppercase shadow-lg hover:bg-red-400 active:scale-95 transition-all flex items-center gap-2">
              <Square size={14} fill="currentColor"/> DỪNG LẠI
            </button>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
           <label className="text-[9px] font-black text-vip-gold/70 uppercase flex items-center gap-1.5 ml-1">
             <Sparkles size={11}/> Không khí sân khấu
           </label>
           <select 
            value={atmosphere} 
            onChange={(e) => setAtmosphere(e.target.value)} 
            disabled={status !== 'idle'}
            className="w-full bg-vip-950/80 border border-vip-700/60 rounded-xl p-2.5 text-[11px] text-zinc-100 focus:border-vip-gold/40 focus:outline-none transition-all disabled:opacity-50"
           >
            <option value="Hào hùng, kịch tính, âm thanh vang dội">Hào hùng & Kịch tính</option>
            <option value="Trữ tình, êm dịu, tiếng nhạc du dương">Trữ tình & Sâu lắng</option>
            <option value="U ám, rùng rợn, hơi thở dồn dập">U ám & Kinh dị</option>
            <option value="Huyền bí, kỳ ảo, không gian rộng lớn">Kỳ ảo & Tiên hiệp</option>
          </select>
        </div>
        <div className="space-y-1.5">
           <label className="text-[9px] font-black text-vip-gold/70 uppercase flex items-center gap-1.5 ml-1">
             <Mic2 size={11}/> Giọng thoại nhân vật
           </label>
           <select 
            value={focusCharId} 
            onChange={(e) => setFocusCharId(e.target.value)} 
            disabled={status !== 'idle' || characters.length === 0}
            className="w-full bg-vip-950/80 border border-vip-700/60 rounded-xl p-2.5 text-[11px] text-white focus:border-vip-gold/40 focus:outline-none transition-all disabled:opacity-50"
           >
             {characters.length === 0 && <option value="">Chưa có nhân vật</option>}
             {characters.map(c => <option key={c.id} value={c.id}>{c.name} ({c.voiceName})</option>)}
           </select>
        </div>
      </div>

      <div className="mt-5 relative">
        <div className="w-full bg-vip-950/80 h-1.5 rounded-full overflow-hidden border border-vip-700/20">
          <div 
            className={`h-full transition-all duration-700 shadow-[0_0_10px_rgba(251,191,36,0.5)] ${status === 'cleaning' ? 'bg-blue-400 animate-pulse w-full' : 'bg-gradient-to-r from-vip-gold to-orange-400'}`} 
            style={{ width: status === 'cleaning' ? '100%' : status === 'idle' ? '0%' : `${(progress.current / progress.total) * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2.5">
          <span className="text-[10px] text-vip-300 font-bold uppercase tracking-wider">
            {status === 'cleaning' ? (
              <span className="flex items-center gap-2"><Loader2 size={10} className="animate-spin" /> Đang biên tập kịch bản (1/1)...</span>
            ) : status === 'generating' ? (
              <span className="flex items-center gap-2"><Loader2 size={10} className="animate-spin" /> Đang lồng tiếng đoạn {progress.current}/{progress.total}...</span>
            ) : status === 'playing' ? (
              <span className="text-green-400">● Đang trình diễn ({progress.current}/{progress.total})</span>
            ) : status === 'error' ? (
              <span className="text-red-400 font-bold">{errorMsg}</span>
            ) : "Sẵn sàng lên sóng"}
          </span>
          <span className="text-[9px] text-zinc-500 italic">Engine: Gemini 2.5 Native Audio</span>
        </div>
      </div>
    </div>
  );
};

export default VoiceStudio;
