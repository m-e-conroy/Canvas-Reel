
import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { Flag } from 'lucide-react';
import clsx from 'clsx';

export const TimelineHeader: React.FC = () => {
  const { zoom, currentTime, duration, setCurrentTime, markers, updateMarker, selectedMarkerId, selectMarker } = useStore();
  const rulerRef = useRef<HTMLDivElement>(null);

  // Drag state for markers
  const [draggingMarkerId, setDraggingMarkerId] = useState<string | null>(null);

  const handleScrub = (e: React.MouseEvent) => {
    if (draggingMarkerId) return; // Don't scrub if dragging marker
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = Math.max(0, x / zoom);
    setCurrentTime(time);
  };

  const handleMarkerMouseDown = (e: React.MouseEvent, markerId: string) => {
      e.stopPropagation();
      if (e.button !== 0) return; // Only drag on Left Click
      
      selectMarker(markerId);
      setDraggingMarkerId(markerId);
  };

  // Marker Drag Effect
  useEffect(() => {
      if (!draggingMarkerId) return;

      const handleMouseMove = (e: MouseEvent) => {
          if (!rulerRef.current) return;
          const rect = rulerRef.current.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const time = Math.max(0, x / zoom);
          updateMarker(draggingMarkerId, { time });
      };

      const handleMouseUp = () => {
          setDraggingMarkerId(null);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [draggingMarkerId, zoom, updateMarker]);

  // Generate ruler markers
  const rulerMarks = [];
  const majorInterval = 5; // seconds
  const width = duration * zoom;

  for (let i = 0; i <= duration; i += 1) {
    if (i % majorInterval === 0) {
      rulerMarks.push(
        <div key={i} className="absolute top-0 bottom-0 border-l border-gray-600 pointer-events-none" style={{ left: i * zoom }}>
          <span className="text-[10px] text-gray-500 ml-1 block mt-1 select-none">{i}s</span>
        </div>
      );
    } else {
      rulerMarks.push(
        <div key={i} className="absolute bottom-0 h-2 border-l border-gray-700 pointer-events-none" style={{ left: i * zoom }} />
      );
    }
  }

  return (
    <div 
        ref={rulerRef}
        className="h-full bg-[#1a1a1a] border-b border-gray-800 relative cursor-pointer"
        style={{ width: `${width}px` }}
        onMouseDown={(e) => {
            if (e.buttons === 1) handleScrub(e);
        }}
        onMouseMove={(e) => {
            if (e.buttons === 1) handleScrub(e);
        }}
    >
      {rulerMarks}
      
      {/* Markers */}
      {markers.map(marker => {
          const isSelected = selectedMarkerId === marker.id;
          return (
            <div
                key={marker.id}
                onMouseDown={(e) => handleMarkerMouseDown(e, marker.id)}
                className={clsx(
                    "absolute top-0 bottom-0 w-6 flex flex-col items-center group z-20 cursor-grab active:cursor-grabbing transition-colors",
                    isSelected ? "z-30" : "hover:bg-white/5"
                )}
                style={{ left: marker.time * zoom, transform: 'translateX(-50%)' }}
                title={`${marker.label} (${marker.time.toFixed(1)}s)`}
            >
                <Flag 
                    className={clsx(
                        "w-3 h-3 fill-current drop-shadow-md mt-0.5 transition-transform",
                        isSelected ? "text-white scale-125" : "text-yellow-500 group-hover:scale-110",
                        marker.color && !isSelected ? `text-[${marker.color}]` : ""
                    )} 
                    style={{ color: isSelected ? '#ffffff' : marker.color }}
                />
                <div 
                    className={clsx("flex-1 w-px", isSelected ? "bg-white" : "bg-yellow-500/50")} 
                    style={{ backgroundColor: isSelected ? '#ffffff' : marker.color }}
                />
            </div>
          );
      })}

      {/* Playhead Indicator in Header */}
      <div 
        className="absolute top-0 bottom-0 w-px bg-red-500 z-10 pointer-events-none"
        style={{ left: currentTime * zoom }}
      >
        <div className="absolute -top-0 -translate-x-1/2 w-3 h-3 bg-red-500 rotate-45 transform origin-center" />
      </div>
    </div>
  );
};
