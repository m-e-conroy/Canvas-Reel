import React, { useRef, useEffect } from 'react';
import { useStore } from '../../store/useStore';

export const TimelineHeader: React.FC = () => {
  const { zoom, currentTime, duration, setCurrentTime } = useStore();
  const rulerRef = useRef<HTMLDivElement>(null);

  const handleScrub = (e: React.MouseEvent) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = Math.max(0, x / zoom);
    setCurrentTime(time);
  };

  // Generate ruler markers
  const markers = [];
  const majorInterval = 5; // seconds
  const width = duration * zoom;

  for (let i = 0; i <= duration; i += 1) {
    if (i % majorInterval === 0) {
      markers.push(
        <div key={i} className="absolute top-0 bottom-0 border-l border-gray-600" style={{ left: i * zoom }}>
          <span className="text-[10px] text-gray-500 ml-1 block mt-1 select-none">{i}s</span>
        </div>
      );
    } else {
      markers.push(
        <div key={i} className="absolute bottom-0 h-2 border-l border-gray-700" style={{ left: i * zoom }} />
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
      {markers}
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