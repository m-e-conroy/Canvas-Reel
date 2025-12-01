import React, { useRef, useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { TimelineHeader } from './TimelineHeader';
import { TrackRow } from './TrackRow';

export const Timeline: React.FC = () => {
  const { tracks, currentTime, zoom, duration, activeDrag, updateClip, stopDrag, getClip, assets } = useStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const headerContainerRef = useRef<HTMLDivElement>(null);
  const [snapIndicator, setSnapIndicator] = useState<number | null>(null);

  const handleScroll = () => {
    if (scrollContainerRef.current && headerContainerRef.current) {
        headerContainerRef.current.scrollLeft = scrollContainerRef.current.scrollLeft;
    }
  };

  // Global Drag Handler
  useEffect(() => {
    if (!activeDrag) {
        setSnapIndicator(null);
        return;
    }

    // 1. Pre-calculate Snap Points (Timestamps in seconds)
    //    Include: 0, Playhead, and Start/End of all OTHER clips
    const snapPoints: number[] = [0, currentTime];
    const SNAP_THRESHOLD_PX = 15; // Distance in pixels to trigger snap

    tracks.forEach(track => {
        track.clips.forEach(c => {
            if (c.id === activeDrag.clipId) return; // Don't snap to self
            snapPoints.push(c.startTime);
            snapPoints.push(c.startTime + c.duration);
        });
    });

    // Helper: Find best snap target or return original value
    const getSnappedTime = (proposedTime: number): { time: number; snapped: boolean } => {
        let bestTime = proposedTime;
        let minDist = SNAP_THRESHOLD_PX / zoom; // Convert px threshold to seconds
        let isSnapped = false;

        for (const point of snapPoints) {
            const dist = Math.abs(point - proposedTime);
            if (dist < minDist) {
                minDist = dist;
                bestTime = point;
                isSnapped = true;
            }
        }
        return { time: bestTime, snapped: isSnapped };
    };

    const handleMouseMove = (e: MouseEvent) => {
        const { clipId, mode, startX, initialStartTime, initialDuration, initialStartOffset, initialTrackId } = activeDrag;
        const clip = getClip(clipId);
        if (!clip) return;

        const pixelDelta = e.clientX - startX;
        const timeDelta = pixelDelta / zoom;

        let activeSnapPoint: number | null = null;

        if (mode === 'move') {
            const rawNewTime = Math.max(0, initialStartTime + timeDelta);
            const rawEndTime = rawNewTime + initialDuration;

            // Check Snap for Left Edge
            const snapLeft = getSnappedTime(rawNewTime);
            
            // Check Snap for Right Edge
            const snapRight = getSnappedTime(rawEndTime);

            let finalStartTime = rawNewTime;

            // Determine which snap is stronger (closer)
            const leftDist = Math.abs(snapLeft.time - rawNewTime);
            const rightDist = Math.abs(snapRight.time - rawEndTime);

            // Prioritize closest snap
            if (snapLeft.snapped && snapRight.snapped) {
                if (leftDist < rightDist) {
                    finalStartTime = snapLeft.time;
                    activeSnapPoint = snapLeft.time;
                } else {
                    finalStartTime = snapRight.time - initialDuration;
                    activeSnapPoint = snapRight.time;
                }
            } else if (snapLeft.snapped) {
                finalStartTime = snapLeft.time;
                activeSnapPoint = snapLeft.time;
            } else if (snapRight.snapped) {
                finalStartTime = snapRight.time - initialDuration;
                activeSnapPoint = snapRight.time;
            }

            // Check for Track Change
            let newTrackId = clip.trackId;
            const elements = document.elementsFromPoint(e.clientX, e.clientY);
            const trackElement = elements.find(el => el.hasAttribute('data-track-id'));
            
            if (trackElement) {
                const targetTrackId = trackElement.getAttribute('data-track-id');
                const targetTrackType = trackElement.getAttribute('data-track-type');
                
                // Compatibility Check
                const isCompatible = 
                    (targetTrackType === 'video' && (clip.type === 'video' || clip.type === 'image')) ||
                    (targetTrackType === 'audio' && clip.type === 'audio');

                if (targetTrackId && targetTrackId !== clip.trackId && isCompatible) {
                    newTrackId = targetTrackId;
                }
            }

            updateClip(clipId, { startTime: finalStartTime, trackId: newTrackId });
        } 
        else if (mode === 'resize-right') {
            const asset = assets.find(a => a.id === clip.assetId);
            const maxSourceDuration = asset ? asset.duration : Infinity;
            
            let rawDuration = initialDuration + timeDelta;
            let rawEndTime = initialStartTime + rawDuration;

            // Snap the END time
            const snapResult = getSnappedTime(rawEndTime);
            if (snapResult.snapped) {
                rawEndTime = snapResult.time;
                rawDuration = rawEndTime - initialStartTime;
                activeSnapPoint = snapResult.time;
            }

            // Clamp constraints
            let newDuration = Math.max(0.1, rawDuration);
            const maxAvailableDuration = maxSourceDuration - initialStartOffset;
            newDuration = Math.min(newDuration, maxAvailableDuration);

            updateClip(clipId, { duration: newDuration });
        } 
        else if (mode === 'resize-left') {
            // Calculate raw start time based on mouse delta
            let rawStartTime = initialStartTime + timeDelta;
            
            // Snap the START time
            const snapResult = getSnappedTime(rawStartTime);
            if (snapResult.snapped) {
                rawStartTime = snapResult.time;
                activeSnapPoint = snapResult.time;
            }

            // Recalculate delta based on snapped time
            const effectiveDelta = rawStartTime - initialStartTime;

            // Clamping Logic
            let finalDelta = effectiveDelta;

            // 1. Cannot start before beginning of file (offset < 0)
            if (initialStartOffset + finalDelta < 0) {
                finalDelta = -initialStartOffset;
            }
            
            // 2. Cannot make duration too short
            if (initialDuration - finalDelta < 0.1) {
                finalDelta = initialDuration - 0.1;
            }

            const newStartTime = Math.max(0, initialStartTime + finalDelta);
            const clampedDelta = newStartTime - initialStartTime;

            updateClip(clipId, {
                startTime: newStartTime,
                duration: initialDuration - clampedDelta,
                startOffset: initialStartOffset + clampedDelta
            });
        }
        
        setSnapIndicator(activeSnapPoint);
    };

    const handleMouseUp = () => {
        stopDrag();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeDrag, zoom, updateClip, stopDrag, getClip, assets, tracks, currentTime]);

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
                <div 
                    className="absolute top-0 bottom-0 w-px bg-red-500 z-30 pointer-events-none"
                    style={{ left: `calc(16rem + ${currentTime * zoom}px)` }}
                />

                {/* Snap Indicator Line */}
                {snapIndicator !== null && (
                    <div 
                        className="absolute top-0 bottom-0 w-px bg-purple-500 z-50 pointer-events-none shadow-[0_0_8px_rgba(168,85,247,0.8)]"
                        style={{ left: `calc(16rem + ${snapIndicator * zoom}px)` }}
                    >
                         <div className="absolute top-0 -translate-x-1/2 text-[10px] bg-purple-600 text-white px-1 rounded-sm font-mono">
                            {snapIndicator.toFixed(2)}s
                         </div>
                    </div>
                )}

                <div className="flex flex-col min-w-full w-max pb-32">
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