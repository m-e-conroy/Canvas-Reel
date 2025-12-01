
import React, { useState } from 'react';
import { Track } from '../../types';
import { useStore } from '../../store/useStore';
import { ClipItem } from './ClipItem';
import { Video, Mic, Eye, EyeOff, Volume2, VolumeX, Type } from 'lucide-react';
import clsx from 'clsx';

interface TrackRowProps {
  track: Track;
}

export const TrackRow: React.FC<TrackRowProps> = React.memo(({ track }) => {
  const { zoom, duration, updateTrack, addClip, assets } = useStore();
  const [isDragOver, setIsDragOver] = useState(false);

  const toggleMute = () => {
    updateTrack(track.id, { isMuted: !track.isMuted });
  };

  const toggleHidden = () => {
    updateTrack(track.id, { isHidden: !track.isHidden });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const assetId = e.dataTransfer.getData('assetId');
    if (!assetId) return;

    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;

    const isCompatible = 
        (track.type === 'video' && (asset.type === 'video' || asset.type === 'image')) ||
        (track.type === 'audio' && asset.type === 'audio');

    if (!isCompatible) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const startTime = Math.max(0, offsetX / zoom);

    addClip({
        id: crypto.randomUUID(),
        assetId: asset.id,
        trackId: track.id,
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

  return (
    <div 
      className={clsx("flex border-b border-gray-800 bg-[#151515]", track.isHidden && "opacity-60 grayscale")}
      data-track-id={track.id}
      data-track-type={track.type}
    >
      {/* Track Header - Sticky Left */}
      <div className="w-64 shrink-0 bg-[#1a1a1a] border-r border-gray-800 p-3 flex flex-col justify-center gap-2 z-40 sticky left-0 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between text-gray-300">
            <div className="flex items-center gap-2">
                {track.type === 'video' && <Video className="w-4 h-4 text-blue-400" />}
                {track.type === 'audio' && <Mic className="w-4 h-4 text-green-400" />}
                {track.type === 'text' && <Type className="w-4 h-4 text-purple-400" />}
                <span className="text-sm font-medium truncate">{track.name}</span>
            </div>
            <div className="flex gap-1">
                <button 
                  onClick={toggleHidden}
                  className={clsx(
                    "p-1 hover:bg-gray-700 rounded transition-colors",
                    track.isHidden ? "text-gray-500" : "text-gray-300 hover:text-white"
                  )}
                  title={track.isHidden ? "Show Track" : "Hide Track"}
                >
                    {track.isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button 
                  onClick={toggleMute}
                  className={clsx(
                    "p-1 hover:bg-gray-700 rounded transition-colors",
                    track.isMuted ? "text-red-400" : "text-gray-300 hover:text-white"
                  )}
                  title={track.isMuted ? "Unmute Track" : "Mute Track"}
                >
                    {track.isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
            </div>
        </div>
      </div>

      {/* Track Lane */}
      <div 
        className={clsx(
            "relative h-24 min-w-full transition-colors duration-200",
            isDragOver ? "bg-gray-800/80 ring-2 ring-inset ring-blue-500/50" : ""
        )}
        style={{ width: duration * zoom }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#222_1px,transparent_1px)] bg-[size:100px_100%] opacity-20 pointer-events-none" />
        
        {track.clips.map(clip => (
            <ClipItem key={clip.id} clip={clip} />
        ))}
      </div>
    </div>
  );
});
