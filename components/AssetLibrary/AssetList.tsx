import React from 'react';
import { useStore } from '../../store/useStore';
import { FileVideo, Music, Image as ImageIcon, Plus } from 'lucide-react';
import clsx from 'clsx';

export const AssetList: React.FC = () => {
  const assets = useStore((state) => state.assets);
  const addClip = useStore((state) => state.addClip);
  const tracks = useStore((state) => state.tracks);

  const handleAddToTimeline = (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;

    // Find compatible track
    const compatibleTrack = tracks.find(t => t.type === asset.type);
    if (!compatibleTrack) {
        alert("No compatible track found (Video -> Video Track, Audio -> Audio Track)");
        return;
    }

    // Determine start time (end of last clip on track or 0)
    let startTime = 0;
    if (compatibleTrack.clips.length > 0) {
        const lastClip = compatibleTrack.clips.reduce((prev, current) => 
            (prev.startTime + prev.duration > current.startTime + current.duration) ? prev : current
        );
        startTime = lastClip.startTime + lastClip.duration;
    }

    addClip({
        id: crypto.randomUUID(),
        assetId: asset.id,
        trackId: compatibleTrack.id,
        startOffset: 0,
        startTime: startTime,
        duration: asset.duration,
        name: asset.name,
        type: asset.type,
        scale: 1,
        positionX: 0,
        positionY: 0
    });
  };

  const handleDragStart = (e: React.DragEvent, assetId: string) => {
    e.dataTransfer.setData('assetId', assetId);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Project Assets</h3>
      {assets.length === 0 && (
        <div className="text-center text-gray-600 text-sm py-8">
          No media imported.
        </div>
      )}
      {assets.map((asset) => (
        <div 
            key={asset.id} 
            draggable
            onDragStart={(e) => handleDragStart(e, asset.id)}
            className="group relative flex items-start gap-3 p-3 bg-gray-800/50 rounded hover:bg-gray-800 transition-colors border border-transparent hover:border-gray-700 cursor-grab active:cursor-grabbing"
        >
          <div className="w-10 h-10 bg-gray-900 rounded flex items-center justify-center shrink-0 pointer-events-none">
            {asset.type === 'video' && <FileVideo className="w-5 h-5 text-blue-400" />}
            {asset.type === 'audio' && <Music className="w-5 h-5 text-green-400" />}
            {asset.type === 'image' && <ImageIcon className="w-5 h-5 text-purple-400" />}
          </div>
          <div className="flex-1 min-w-0 pointer-events-none">
            <p className="text-sm font-medium text-gray-200 truncate">{asset.name}</p>
            <p className="text-xs text-gray-500">{formatTime(asset.duration)}</p>
          </div>
          <button 
            onClick={() => handleAddToTimeline(asset.id)}
            className="absolute right-2 top-2 p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            title="Add to Timeline"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}