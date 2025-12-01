import React, { useMemo } from 'react';
import { Clip } from '../../types';
import { useStore } from '../../store/useStore';
import clsx from 'clsx';
import { Layers } from 'lucide-react';

interface ClipItemProps {
  clip: Clip;
}

export const ClipItem: React.FC<ClipItemProps> = React.memo(({ clip }) => {
  const { zoom, selectedClipId, setSelectedClipId, startDrag, activeDrag, tracks } = useStore();
  const isSelected = selectedClipId === clip.id;
  const isDragging = activeDrag?.clipId === clip.id;

  const handleMouseDown = (e: React.MouseEvent, mode: 'move' | 'resize-left' | 'resize-right') => {
    e.stopPropagation();
    e.preventDefault();
    
    setSelectedClipId(clip.id);
    
    startDrag({
        clipId: clip.id,
        mode,
        startX: e.clientX,
        initialStartTime: clip.startTime,
        initialDuration: clip.duration,
        initialStartOffset: clip.startOffset,
        initialTrackId: clip.trackId
    });
  };

  // Calculate Z-Index and Overlap status
  const { zIndex, isObscured } = useMemo(() => {
    const trackIndex = tracks.findIndex(t => t.id === clip.trackId);
    if (trackIndex === -1) return { zIndex: 0, isObscured: false };

    // Z-Index: Track 0 is Top (Highest Z)
    const zIndex = tracks.length - trackIndex;

    let isObscured = false;
    
    if (clip.type === 'video' || clip.type === 'image') {
        // Check higher priority tracks (lower index)
        for (let i = 0; i < trackIndex; i++) {
            const track = tracks[i];
            if (track.type === 'video' && !track.isHidden) {
               const hasOverlap = track.clips.some(c => {
                   const start = Math.max(c.startTime, clip.startTime);
                   const end = Math.min(c.startTime + c.duration, clip.startTime + clip.duration);
                   return start < end;
               });
               if (hasOverlap) {
                   isObscured = true;
                   break;
               }
            }
        }
    }
    
    return { zIndex, isObscured };
  }, [tracks, clip.trackId, clip.startTime, clip.duration, clip.type]);

  return (
    <div
      onMouseDown={(e) => handleMouseDown(e, 'move')}
      className={clsx(
        "absolute top-1 bottom-1 rounded overflow-hidden select-none border group transition-colors",
        clip.type === 'video' ? "bg-blue-900/50 border-blue-800" : 
        clip.type === 'audio' ? "bg-green-900/50 border-green-800" : "bg-purple-900/50 border-purple-800",
        (isSelected || isDragging) ? "ring-2 ring-white border-transparent z-10" : "hover:brightness-110",
        isDragging ? "cursor-grabbing" : "cursor-grab"
      )}
      style={{
        left: clip.startTime * zoom,
        width: clip.duration * zoom,
        zIndex: isDragging ? 50 : undefined
      }}
    >
      <div className="px-2 py-1 text-xs text-white/90 truncate font-medium relative z-10 pointer-events-none pr-12">
        {clip.name}
      </div>
      
      {/* Waveform/Thumbnails visualization placeholder */}
      <div className="absolute inset-0 opacity-20 bg-gradient-to-b from-transparent to-black/50 pointer-events-none" />

      {/* Z-Index / Obscured Indicator */}
      {(clip.type === 'video' || clip.type === 'image') && (
        <div className={clsx(
            "absolute top-1 right-1 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono z-20 pointer-events-none border backdrop-blur-sm transition-colors",
            isObscured ? "bg-red-900/60 border-red-500/50 text-red-200" : "bg-black/40 border-white/10 text-white/50"
        )}>
            {isObscured && <Layers className="w-2.5 h-2.5" />}
            <span>Z:{zIndex}</span>
        </div>
      )}

      {/* Resize Handles - Only visible/active when selected */}
      {isSelected && !isDragging && (
          <>
            {/* Left Handle */}
            <div 
                onMouseDown={(e) => handleMouseDown(e, 'resize-left')}
                className="absolute left-0 top-0 bottom-0 w-3 hover:w-4 flex items-center justify-center bg-white/10 hover:bg-white/30 cursor-w-resize z-20 group/handle transition-all"
            >
                <div className="w-1 h-4 bg-white/50 rounded-full group-hover/handle:bg-white" />
            </div>

            {/* Right Handle */}
            <div 
                onMouseDown={(e) => handleMouseDown(e, 'resize-right')}
                className="absolute right-0 top-0 bottom-0 w-3 hover:w-4 flex items-center justify-center bg-white/10 hover:bg-white/30 cursor-e-resize z-20 group/handle transition-all"
            >
                <div className="w-1 h-4 bg-white/50 rounded-full group-hover/handle:bg-white" />
            </div>
          </>
      )}
    </div>
  );
});