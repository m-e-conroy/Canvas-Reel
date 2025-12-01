
import React, { useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { Copy, Trash2, Link, Unlink, Eye, EyeOff, Volume2, VolumeX, Plus, FilePlus } from 'lucide-react';

export const ContextMenu: React.FC = () => {
  const { 
    contextMenu, 
    closeContextMenu, 
    duplicateSelectedClips, 
    removeSelectedClips, 
    groupSelectedClips, 
    ungroupSelectedClips,
    updateClip,
    getClip,
    selectedClipIds,
    addClipFromAsset,
    removeAsset,
    saveClipAsAsset
  } = useStore();
  
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [closeContextMenu]);

  if (!contextMenu) return null;

  const handleAction = (action: () => void) => {
    action();
    closeContextMenu();
  };

  // --- Clip Menu ---
  if (contextMenu.type === 'clip') {
    const clip = getClip(contextMenu.targetId);
    const isMultiSelect = selectedClipIds.length > 1;
    
    return (
      <div 
        ref={menuRef}
        className="fixed z-50 bg-[#1a1a1a] border border-gray-700 rounded shadow-2xl w-48 py-1 overflow-hidden"
        style={{ left: contextMenu.x, top: contextMenu.y }}
      >
        <div className="px-3 py-1.5 text-xs text-gray-500 font-semibold border-b border-gray-800 mb-1">
            {isMultiSelect ? `${selectedClipIds.length} Clips Selected` : clip?.name || 'Clip Options'}
        </div>
        
        <button 
          onClick={() => handleAction(duplicateSelectedClips)}
          className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-blue-600 flex items-center gap-2"
        >
          <Copy className="w-4 h-4" /> Duplicate
        </button>

        {isMultiSelect ? (
            <>
                <button 
                    onClick={() => handleAction(groupSelectedClips)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-blue-600 flex items-center gap-2"
                >
                    <Link className="w-4 h-4" /> Group
                </button>
                <button 
                    onClick={() => handleAction(ungroupSelectedClips)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-blue-600 flex items-center gap-2"
                >
                    <Unlink className="w-4 h-4" /> Ungroup
                </button>
            </>
        ) : (
             clip && (
                <>
                    <button 
                        onClick={() => handleAction(() => updateClip(clip.id, { muted: !clip.muted }))}
                        className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-blue-600 flex items-center gap-2"
                    >
                        {clip.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        {clip.muted ? "Unmute" : "Mute"}
                    </button>
                    <button 
                        onClick={() => handleAction(() => updateClip(clip.id, { visible: clip.visible === false ? true : false }))}
                        className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-blue-600 flex items-center gap-2"
                    >
                        {clip.visible === false ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        {clip.visible === false ? "Show" : "Hide"}
                    </button>
                    {/* Save as Asset Button */}
                    {clip.type !== 'text' && (
                        <button 
                            onClick={() => handleAction(() => saveClipAsAsset(clip.id))}
                            className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-blue-600 flex items-center gap-2 border-t border-gray-700 mt-1 pt-2"
                        >
                            <FilePlus className="w-4 h-4" /> Save as Asset
                        </button>
                    )}
                </>
             )
        )}

        <div className="h-px bg-gray-700 my-1" />
        
        <button 
          onClick={() => handleAction(removeSelectedClips)}
          className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-900/50 flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" /> Delete
        </button>
      </div>
    );
  }

  // --- Asset Menu ---
  if (contextMenu.type === 'asset') {
      return (
        <div 
            ref={menuRef}
            className="fixed z-50 bg-[#1a1a1a] border border-gray-700 rounded shadow-2xl w-48 py-1 overflow-hidden"
            style={{ left: contextMenu.x, top: contextMenu.y }}
        >
            <button 
                onClick={() => handleAction(() => addClipFromAsset(contextMenu.targetId))}
                className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-blue-600 flex items-center gap-2"
            >
                <Plus className="w-4 h-4" /> Add to Timeline
            </button>
             <div className="h-px bg-gray-700 my-1" />
            <button 
                onClick={() => handleAction(() => removeAsset(contextMenu.targetId))}
                className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-900/50 flex items-center gap-2"
            >
                <Trash2 className="w-4 h-4" /> Delete Asset
            </button>
        </div>
      );
  }

  return null;
};
