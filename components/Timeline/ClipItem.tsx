import React, { useState, useEffect } from 'react';
import { Clip } from '../../types';
import { useStore } from '../../store/useStore';
import clsx from 'clsx';

interface ClipItemProps {
  clip: Clip;
}

type DragMode = 'move' | 'resize-left' | 'resize-right' | null;

export const ClipItem: React.FC<ClipItemProps> = React.memo(({ clip }) => {
  const { zoom, selectedClipId, setSelectedClipId, updateClip, assets } = useStore();
  const isSelected = selectedClipId === clip.id;
  
  // Find the source asset to know max duration limits
  const asset = assets.find(a => a.id === clip.assetId);
  const maxSourceDuration = asset ? asset.duration : Infinity;

  // Dragging state
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [dragStartX, setDragStartX] = useState(0);
  
  // Snapshot of state at start of drag
  const [initialState, setInitialState] = useState({ 
      startTime: 0, 
      duration: 0, 
      startOffset: 0 
  });

  const handleMouseDown = (e: React.MouseEvent, mode: DragMode) => {
    e.stopPropagation();
    setSelectedClipId(clip.id);
    setDragMode(mode);
    setDragStartX(e.clientX);
    setInitialState({
        startTime: clip.startTime,
        duration: clip.duration,
        startOffset: clip.startOffset
    });
  };

  useEffect(() => {
      if (!dragMode) return;

      const onMouseMove = (e: MouseEvent) => {
          const pixelDelta = e.clientX - dragStartX;
          const timeDelta = pixelDelta / zoom;

          if (dragMode === 'move') {
              const newTime = Math.max(0, initialState.startTime + timeDelta);
              updateClip(clip.id, { startTime: newTime });
          } 
          else if (dragMode === 'resize-right') {
              // Calculate raw new duration
              let newDuration = initialState.duration + timeDelta;
              
              // 1. Minimum duration check (e.g. 0.1s)
              newDuration = Math.max(0.1, newDuration);
              
              // 2. Maximum source duration check
              // The end of the clip (startOffset + duration) cannot exceed the source media length
              const maxAvailableDuration = maxSourceDuration - initialState.startOffset;
              newDuration = Math.min(newDuration, maxAvailableDuration);

              updateClip(clip.id, { duration: newDuration });
          } 
          else if (dragMode === 'resize-left') {
              // Moving left handle changes StartTime, Duration, AND StartOffset
              // If we drag right (positive delta): StartTime increases, Duration decreases, Offset increases
              
              let effectiveDelta = timeDelta;

              // 1. Check max extension left (StartOffset cannot be < 0)
              // If dragging left (negative delta), we can't go further back than startOffset 0
              if (initialState.startOffset + effectiveDelta < 0) {
                  effectiveDelta = -initialState.startOffset;
              }

              // 2. Check max compression right (Duration cannot be < 0.1)
              if (initialState.duration - effectiveDelta < 0.1) {
                  effectiveDelta = initialState.duration - 0.1;
              }

              const newStartTime = Math.max(0, initialState.startTime + effectiveDelta);
              // Recalculate delta based on the clamped startTime (in case we hit timeline 0)
              const clampedDelta = newStartTime - initialState.startTime;

              updateClip(clip.id, {
                  startTime: newStartTime,
                  duration: initialState.duration - clampedDelta,
                  startOffset: initialState.startOffset + clampedDelta
              });
          }
      };

      const onMouseUp = () => {
          setDragMode(null);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      return () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
      };
  }, [dragMode, dragStartX, initialState, zoom, clip.id, updateClip, maxSourceDuration]);

  return (
    <div
      onMouseDown={(e) => handleMouseDown(e, 'move')}
      className={clsx(
        "absolute top-1 bottom-1 rounded overflow-hidden select-none border group transition-colors",
        clip.type === 'video' ? "bg-blue-900/50 border-blue-800" : 
        clip.type === 'audio' ? "bg-green-900/50 border-green-800" : "bg-purple-900/50 border-purple-800",
        isSelected ? "ring-2 ring-white border-transparent z-10" : "hover:brightness-110",
        dragMode === 'move' ? "cursor-grabbing" : "cursor-grab"
      )}
      style={{
        left: clip.startTime * zoom,
        width: clip.duration * zoom,
      }}
    >
      <div className="px-2 py-1 text-xs text-white/90 truncate font-medium relative z-10 pointer-events-none">
        {clip.name}
      </div>
      
      {/* Waveform/Thumbnails visualization placeholder */}
      <div className="absolute inset-0 opacity-20 bg-gradient-to-b from-transparent to-black/50 pointer-events-none" />

      {/* Resize Handles - Only visible/active when selected */}
      {isSelected && (
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