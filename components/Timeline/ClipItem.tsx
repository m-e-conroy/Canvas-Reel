import React, { useState } from 'react';
import { Clip } from '../../types';
import { useStore } from '../../store/useStore';
import clsx from 'clsx';

interface ClipItemProps {
  clip: Clip;
}

export const ClipItem: React.FC<ClipItemProps> = React.memo(({ clip }) => {
  const { zoom, selectedClipId, setSelectedClipId, updateClip } = useStore();
  const isSelected = selectedClipId === clip.id;
  
  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [initialStartTime, setInitialStartTime] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedClipId(clip.id);
    setIsDragging(true);
    setDragStartX(e.clientX);
    setInitialStartTime(clip.startTime);
  };

  React.useEffect(() => {
      if (!isDragging) return;

      const onMouseMove = (e: MouseEvent) => {
          const deltaX = e.clientX - dragStartX;
          const deltaTime = deltaX / zoom;
          const newTime = Math.max(0, initialStartTime + deltaTime);
          updateClip(clip.id, { startTime: newTime });
      };

      const onMouseUp = () => {
          setIsDragging(false);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      return () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
      };
  }, [isDragging, dragStartX, initialStartTime, zoom, clip.id, updateClip]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className={clsx(
        "absolute top-1 bottom-1 rounded overflow-hidden cursor-move select-none border group",
        clip.type === 'video' ? "bg-blue-900/50 border-blue-800" : 
        clip.type === 'audio' ? "bg-green-900/50 border-green-800" : "bg-purple-900/50 border-purple-800",
        isSelected ? "ring-2 ring-white border-transparent z-10" : "hover:brightness-110"
      )}
      style={{
        left: clip.startTime * zoom,
        width: clip.duration * zoom,
      }}
    >
      <div className="px-2 py-1 text-xs text-white/90 truncate font-medium relative z-10">
        {clip.name}
      </div>
      
      {/* Waveform/Thumbnails visualization placeholder */}
      <div className="absolute inset-0 opacity-20 bg-gradient-to-b from-transparent to-black/50 pointer-events-none" />

      {/* Resize Handles (Visual only for now, logic similar to drag) */}
      {isSelected && (
          <>
            <div className="absolute left-0 top-0 bottom-0 w-2 bg-white/20 cursor-ew-resize hover:bg-white/40" />
            <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/20 cursor-ew-resize hover:bg-white/40" />
          </>
      )}
    </div>
  );
});