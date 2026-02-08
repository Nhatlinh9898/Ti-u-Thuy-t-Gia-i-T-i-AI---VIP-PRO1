
import React from 'react';
import { NovelNode } from '../types';
import { ChevronRight, ChevronDown, FileText, Book, Folder, FolderOpen, Zap } from 'lucide-react';

interface TreeNavigationProps {
  node: NovelNode;
  selectedId: string;
  onSelect: (node: NovelNode) => void;
  onToggle: (node: NovelNode) => void;
}

const TreeNavigation: React.FC<TreeNavigationProps> = ({ node, selectedId, onSelect, onToggle }) => {
  const isSelected = node.id === selectedId;
  const hasChildren = node.children && node.children.length > 0;
  const hasMetadata = !!node.metadata?.objective;

  const getIcon = () => {
    if (node.type === 'novel') return <Book size={16} className="text-vip-gold" />;
    if (node.type === 'beat') return <Zap size={12} className="text-yellow-400" />;
    if (node.type === 'section') return <FileText size={14} className="text-blue-400" />;
    return node.isExpanded ? <FolderOpen size={14} className="text-vip-300" /> : <Folder size={14} className="text-vip-300" />;
  };

  return (
    <div className="select-none">
      <div 
        className={`
          flex items-center gap-1 py-1.5 px-2 cursor-pointer transition-all rounded-lg border-l-2 mb-0.5
          ${isSelected 
            ? 'bg-vip-700/50 border-vip-gold text-white shadow-lg' 
            : 'border-transparent text-gray-500 hover:bg-vip-800/30 hover:text-gray-300'}
        `}
        style={{ paddingLeft: `${(node.type === 'novel' ? 0 : 1) * 12 + 8}px` }}
        onClick={() => onSelect(node)}
      >
        <div 
          className="p-1 hover:text-white transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(node);
          }}
        >
          {hasChildren ? (
             node.isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
          ) : <span className="w-3 block"></span>}
        </div>
        
        <div className="relative">
          {getIcon()}
          {hasMetadata && (
            <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-vip-gold rounded-full border border-vip-900 shadow-[0_0_5px_rgba(251,191,36,0.8)]"></div>
          )}
        </div>
        
        <span className={`text-xs truncate ml-1 ${node.type === 'novel' ? 'font-bold font-serif uppercase tracking-widest' : ''}`}>
          {node.title}
        </span>
      </div>

      {node.isExpanded && hasChildren && (
        <div className="ml-3 border-l border-vip-700/20 pl-1">
          {node.children.map(child => (
            <TreeNavigation 
              key={child.id} 
              node={child} 
              selectedId={selectedId} 
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TreeNavigation;
