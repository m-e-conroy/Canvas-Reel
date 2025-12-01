import React from 'react';
import { useStore } from '../../store/useStore';
import { X, Trash2, Sliders } from 'lucide-react';

export const Inspector: React.FC = () => {
  const { selectedClipId, getClip, updateClip, removeClip, setSelectedClipId } = useStore();
  
  const clip = selectedClipId ? getClip(selectedClipId) : null;

  if (!clip) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm p-8 text-center bg-[#1a1a1a] border-l border-gray-800">
        <Sliders className="w-12 h-12 mb-4 opacity-20" />
        <p>Select a clip to view properties</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#1a1a1a] border-l border-gray-800 overflow-y-auto">
      <div className="h-12 border-b border-gray-800 flex items-center justify-between px-4">
        <h2 className="font-semibold text-sm text-gray-200">Inspector</h2>
        <button onClick={() => setSelectedClipId(null)} className="text-gray-500 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-6">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Name</label>
          <input 
            type="text" 
            value={clip.name}
            onChange={(e) => updateClip(clip.id, { name: e.target.value })}
            className="w-full bg-black/30 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
            <h3 className="text-xs font-bold text-gray-400 mb-3 border-b border-gray-800 pb-1">Timing</h3>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Start (s)</label>
                    <input 
                        type="number" 
                        step="0.1"
                        value={clip.startTime.toFixed(2)}
                        onChange={(e) => updateClip(clip.id, { startTime: parseFloat(e.target.value) })}
                        className="w-full bg-black/30 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200"
                    />
                </div>
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Duration (s)</label>
                    <input 
                        type="number" 
                        step="0.1"
                        value={clip.duration.toFixed(2)}
                        disabled
                        className="w-full bg-black/30 border border-gray-800 rounded px-2 py-1 text-sm text-gray-500 cursor-not-allowed"
                    />
                </div>
            </div>
        </div>

        {clip.type === 'video' && (
             <div>
                <h3 className="text-xs font-bold text-gray-400 mb-3 border-b border-gray-800 pb-1">Transform</h3>
                <div className="space-y-3">
                     <div>
                        <label className="block text-xs text-gray-500 mb-1">Scale</label>
                        <div className="flex items-center gap-2">
                            <input 
                                type="range" 
                                min="0.1" 
                                max="3" 
                                step="0.1"
                                value={clip.scale || 1}
                                onChange={(e) => updateClip(clip.id, { scale: parseFloat(e.target.value) })}
                                className="flex-1"
                            />
                            <span className="text-xs text-gray-300 w-8 text-right">{clip.scale?.toFixed(1) || 1.0}x</span>
                        </div>
                     </div>
                </div>
             </div>
        )}

        <div className="pt-4 border-t border-gray-800">
            <button 
                onClick={() => removeClip(clip.id)}
                className="w-full flex items-center justify-center gap-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 py-2 rounded text-sm transition-colors border border-red-900/50"
            >
                <Trash2 className="w-4 h-4" />
                Delete Clip
            </button>
        </div>
      </div>
    </div>
  );
};