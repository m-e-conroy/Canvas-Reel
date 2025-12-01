import React, { useRef } from 'react';
import { useStore } from '../../store/useStore';
import { TimelineHeader } from './TimelineHeader';
import { TrackRow } from './TrackRow';

export const Timeline: React.FC = () => {
  const { tracks, currentTime, zoom, duration } = useStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const headerContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (scrollContainerRef.current && headerContainerRef.current) {
        headerContainerRef.current.scrollLeft = scrollContainerRef.current.scrollLeft;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#111] select-none">
        {/* Header Section - Fixed Height */}
        <div className="flex h-8 shrink-0 overflow-hidden bg-[#1a1a1a] border-b border-gray-800 z-20">
             {/* Left Column Spacer for Header */}
             <div className="w-64 bg-[#1a1a1a] border-r border-gray-800 h-full shrink-0 z-30 shadow-sm" />
             
             {/* Header Scroller - synced via ref */}
             <div 
                ref={headerContainerRef}
                className="flex-1 overflow-hidden relative"
             >
                 <TimelineHeader />
             </div>
        </div>

        {/* Tracks Section - Flex Grow */}
        <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-auto relative custom-scrollbar bg-[#111]"
        >
            <div className="min-w-max relative">
                
                {/* Playhead Line spanning tracks */}
                {/* Positioned at 16rem (sidebar width) + time * zoom */}
                {/* z-30 to be above clips (z-10) but below sticky headers (z-40) */}
                <div 
                    className="absolute top-0 bottom-0 w-px bg-red-500 z-30 pointer-events-none"
                    style={{ left: `calc(16rem + ${currentTime * zoom}px)` }}
                />

                <div className="flex flex-col min-w-full w-max">
                    {tracks.map(track => (
                        <TrackRow key={track.id} track={track} />
                    ))}
                    
                    {/* Empty space at bottom to allow scrolling past last track */}
                    <div className="h-32 bg-[#0f0f0f] w-full border-t border-gray-900/50" />
                </div>
            </div>
        </div>
    </div>
  );
};