import React from 'react';
import { SavedNovel } from '../types';
import { Book, Plus, Trash2, Edit3, Clock, ChevronRight } from 'lucide-react';

interface LibraryProps {
  novels: SavedNovel[];
  onSelect: (novel: SavedNovel) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

const Library: React.FC<LibraryProps> = ({ novels, onSelect, onCreate, onDelete }) => {
  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-12 bg-vip-900/50">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h2 className="text-4xl font-serif font-bold text-vip-gold mb-2">Thư Viện Tác Phẩm</h2>
            <p className="text-gray-400">Nơi lưu giữ những tinh hoa sáng tạo của bạn</p>
          </div>
          <button 
            onClick={onCreate}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-vip-500 to-indigo-600 hover:from-vip-400 hover:to-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-vip-500/20 group"
          >
            <Plus size={20} className="group-hover:rotate-90 transition-transform" />
            SÁNG TÁC MỚI
          </button>
        </div>

        {novels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-vip-700/50 rounded-3xl bg-vip-800/10">
            <Book size={64} className="text-vip-700 mb-4 opacity-50" />
            <p className="text-vip-300 font-medium">Bạn chưa có tác phẩm nào trong thư viện.</p>
            <button 
              onClick={onCreate}
              className="mt-4 text-vip-gold hover:underline font-bold"
            >
              Bắt đầu hành trình ngay!
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {novels.map((novel) => (
              <div 
                key={novel.id}
                className="group relative bg-vip-800/30 border border-vip-700/50 rounded-2xl overflow-hidden hover:border-vip-gold/50 transition-all hover:shadow-2xl hover:shadow-vip-gold/5 hover:-translate-y-1"
              >
                {/* Book Spine Highlight */}
                <div className={`absolute top-0 left-0 w-2 h-full ${novel.coverColor || 'bg-vip-500'}`} />
                
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-vip-900/50 rounded-lg text-vip-gold">
                      <Book size={24} />
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if(confirm('Bạn có chắc muốn xóa tác phẩm này?')) onDelete(novel.id);
                      }}
                      className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <h3 className="text-xl font-serif font-bold text-white mb-2 line-clamp-2 group-hover:text-vip-gold transition-colors">
                    {novel.title}
                  </h3>
                  
                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-6">
                    <Clock size={12} />
                    <span>Cập nhật: {new Date(novel.lastUpdated).toLocaleDateString('vi-VN')}</span>
                  </div>

                  <button 
                    onClick={() => onSelect(novel)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-vip-700/50 hover:bg-vip-gold hover:text-vip-900 rounded-xl text-sm font-bold text-vip-300 transition-all"
                  >
                    <Edit3 size={16} /> VIẾT TIẾP <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Library;
