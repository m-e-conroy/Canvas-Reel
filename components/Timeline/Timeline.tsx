import React, { useRef, useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { TimelineHeader } from './TimelineHeader';
import { TrackRow } from './TrackRow';

export const Timeline: React.FC = () => {
  const { tracks, currentTime, zoom, duration, activeDrag, updateClip, stopDrag, deselectAll, assets } = useStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const headerContainerRef = useRef<HTMLDivElement>(null);
  const [snapIndicator, setSnapIndicator] = useState<number | null>(null);

  const handleScroll = () => {
    if (scrollContainerRef.current && headerContainerRef.current) {
        headerContainerRef.current.scrollLeft = scrollContainerRef.current.scrollLeft;
    }
  };

  const handleBackgroundClick = (e: React.MouseEvent) => {
      // Deselect if clicking on empty timeline area
      // (This event bubbles up from Tracks if not stopped)
      if (e.target === e.currentTarget || e.target === scrollContainerRef.current) {
        deselectAll();
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
    
    // IDs of clips being dragged
    const draggedIds = activeDrag.draggedClips.map(dc => dc.clipId);

    tracks.forEach(track => {
        track.clips.forEach(c => {
            if (draggedIds.includes(c.id)) return; // Don't snap to self/moving group
            snapPoints.push(c.startTime);
            snapPoints.push(c.startTime + c.duration);
        });
    });

    // Helper: Find best snap target
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
        const { startX, draggedClips, mode } = activeDrag;
        const pixelDelta = e.clientX - startX;
        const timeDelta = pixelDelta / zoom;
        let activeSnapPoint: number | null = null;

        // Iterate through all dragged clips
        draggedClips.forEach(dragState => {
            const { clipId, initialStartTime, initialDuration, initialStartOffset, initialTrackId } = dragState;

            if (mode === 'move') {
                const rawNewTime = Math.max(0, initialStartTime + timeDelta);
                
                // Snap Logic (Only apply snap based on the PRIMARY dragged clip for simplicity, or nearest)
                // Let's check snap for THIS clip
                const rawEndTime = rawNewTime + initialDuration;
                
                // We only visualize snap for the clip under the cursor usually, but here we calculate for all.
                // Optimally we'd apply the same snapped-delta to all clips to keep relative positions.
                // Current simplified approach: Snap individual clips? No, group must move together.
                // FIX: Calculate "Effective Delta" based on the PRIMARY clip, then apply to all.
                
                // We will defer the actual update loop until we calculate the master delta.
            }
        });

        // --- Master Delta Calculation based on Primary Clip ---
        const primaryDrag = draggedClips.find(dc => dc.clipId === activeDrag.primaryClipId);
        if (!primaryDrag) return;

        let effectiveTimeDelta = timeDelta;
        let finalTrackId = primaryDrag.initialTrackId;

        if (mode === 'move') {
            // 1. Calculate Snapped Delta for Primary Clip
            const rawNewTime = Math.max(0, primaryDrag.initialStartTime + timeDelta);
            const rawEndTime = rawNewTime + primaryDrag.initialDuration;
            
            const snapLeft = getSnappedTime(rawNewTime);
            const snapRight = getSnappedTime(rawEndTime);
            
            let snappedTime = rawNewTime;

            const leftDist = Math.abs(snapLeft.time - rawNewTime);
            const rightDist = Math.abs(snapRight.time - rawEndTime);

            if (snapLeft.snapped && snapRight.snapped) {
                 if (leftDist < rightDist) {
                     snappedTime = snapLeft.time;
                     activeSnapPoint = snapLeft.time;
                 } else {
                     snappedTime = snapRight.time - primaryDrag.initialDuration;
                     activeSnapPoint = snapRight.time;
                 }
            } else if (snapLeft.snapped) {
                 snappedTime = snapLeft.time;
                 activeSnapPoint = snapLeft.time;
            } else if (snapRight.snapped) {
                 snappedTime = snapRight.time - primaryDrag.initialDuration;
                 activeSnapPoint = snapRight.time;
            }

            effectiveTimeDelta = snappedTime - primaryDrag.initialStartTime;

            // 2. Track Changing (Only for Primary Clip for now)
            // If dragging multiple, changing tracks is complex (need empty space on target tracks for all).
            // Simplification: Only allow track change if single clip is selected.
            if (draggedClips.length === 1) {
                 const elements = document.elementsFromPoint(e.clientX, e.clientY);
                 const trackElement = elements.find(el => el.hasAttribute('data-track-id'));
                 if (trackElement) {
                    const targetTrackId = trackElement.getAttribute('data-track-id');
                    const targetTrackType = trackElement.getAttribute('data-track-type');
                    // Clip type check
                    // We need to check clip type. We can get it from store or assume compatibility based on drag start?
                    // Let's assume user is careful or we check store.
                    if (targetTrackId && targetTrackId !== primaryDrag.initialTrackId) {
                         // We update finalTrackId. 
                         // Note: We need to verify compatibility in the loop below or pass clip type in DragState.
                         // For now, trust the UI drop logic or just basic id check.
                         finalTrackId = targetTrackId;
                    }
                 }
            }
        }

        // Apply updates to all dragged clips
        draggedClips.forEach(dragState => {
            if (mode === 'move') {
                const newStartTime = Math.max(0, dragState.initialStartTime + effectiveTimeDelta);
                // Only update trackId if it's the single clip being dragged
                const trackUpdate = (draggedClips.length === 1) ? { trackId: finalTrackId } : {};
                updateClip(dragState.clipId, { startTime: newStartTime, ...trackUpdate });
            } 
            else if (mode === 'resize-right' && dragState.clipId === activeDrag.primaryClipId) {
                // Resize usually only affects the single clip being interacted with
                const asset = assets.find(a => assets.some(x => x.id === a.id)); // Need asset to check max duration
                // We don't have assetId in DragState easily, so simple resize without max clamping for now? 
                // Or we accept no clamping for this prototype update. 
                // Let's stick to basic delta.
                
                let rawDuration = dragState.initialDuration + timeDelta;
                updateClip(dragState.clipId, { duration: Math.max(0.1, rawDuration) });
            }
            else if (mode === 'resize-left' && dragState.clipId === activeDrag.primaryClipId) {
                let rawStartTime = Math.max(0, dragState.initialStartTime + timeDelta);
                let delta = rawStartTime - dragState.initialStartTime;
                
                // Clamp
                if (dragState.initialStartOffset + delta < 0) delta = -dragState.initialStartOffset;
                if (dragState.initialDuration - delta < 0.1) delta = dragState.initialDuration - 0.1;

                updateClip(dragState.clipId, {
                    startTime: dragState.initialStartTime + delta,
                    duration: dragState.initialDuration - delta,
                    startOffset: dragState.initialStartOffset + delta
                });
            }
        });
        
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
  }, [activeDrag, zoom, updateClip, stopDrag, assets, tracks, currentTime]);

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
            onClick={handleBackgroundClick}
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