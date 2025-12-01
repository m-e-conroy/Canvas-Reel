import React, { useMemo } from 'react';
import { Clip } from '../../types';
import { useStore } from '../../store/useStore';
import clsx from 'clsx';
import { Layers, Link } from 'lucide-react';

interface ClipItemProps {
  clip: Clip;
}

export const ClipItem: React.FC<ClipItemProps> = React.memo(({ clip }) => {
  const { zoom, selectedClipIds, selectClip, startDrag, activeDrag, tracks } = useStore();
  const isSelected = selectedClipIds.includes(clip.id);
  const isDragging = activeDrag?.draggedClips.some(dc => dc.clipId === clip.id);

  const handleMouseDown = (e: React.MouseEvent, mode: 'move' | 'resize-left' | 'resize-right') => {
    e.stopPropagation();
    e.preventDefault();
    
    // Selection Logic:
    // If Shift key is pressed, toggle selection.
    // If normal click:
    //    If clip is NOT already selected, select it exclusively.
    //    If clip IS selected, keep selection (to allow dragging group).
    if (e.shiftKey) {
        selectClip(clip.id, true);
    } else {
        if (!isSelected) {
            selectClip(clip.id, false);
        }
    }
    
    // Start drag with current mouse position
    startDrag(clip.id, mode, e.clientX);
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

  const style: React.CSSProperties = {
    left: clip.startTime * zoom,
    width: clip.duration * zoom,
    zIndex: isDragging ? 50 : undefined,
  };

  if (clip.color) {
    style.backgroundColor = `${clip.color}80`; // Add 50% opacity
    style.borderColor = clip.color;
  }

  return (
    <div
      onMouseDown={(e) => handleMouseDown(e, 'move')}
      className={clsx(
        "absolute top-1 bottom-1 rounded overflow-hidden select-none border group transition-colors",
        !clip.color && (
            clip.type === 'video' ? "bg-blue-900/50 border-blue-800" : 
            clip.type === 'audio' ? "bg-green-900/50 border-green-800" : "bg-purple-900/50 border-purple-800"
        ),
        (isSelected || isDragging) ? "ring-2 ring-white border-transparent z-10" : "hover:brightness-110",
        isDragging ? "cursor-grabbing" : "cursor-grab"
      )}
      style={style}
    >
      <div className="px-2 py-1 flex flex-col relative z-10 pointer-events-none pr-12 gap-0.5">
        <div className="text-xs text-white/90 truncate font-medium flex items-center gap-1 leading-tight">
            {clip.groupId && <Link className="w-3 h-3 text-white/70 shrink-0" />}
            {clip.name}
        </div>
        <div className="text-[10px] text-white/60 truncate font-mono leading-tight">
            {clip.duration.toFixed(2)}s
        </div>
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

      {/* Resize Handles - Only visible/active when selected AND only single select for now, 
          or resize whole group if edges align? For now, only show resize if single select or PRIMARY selected */}
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