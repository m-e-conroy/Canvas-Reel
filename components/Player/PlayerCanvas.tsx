import React, { useRef, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { Asset, Clip, Track } from '../../types';

export const PlayerCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mediaRefs = useRef<Map<string, HTMLVideoElement | HTMLAudioElement | HTMLImageElement>>(new Map());
  
  const { tracks, assets, currentTime, isPlaying, setCurrentTime } = useStore();
  
  // Refs for animation loop state to avoid closure staleness
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>();
  const playbackTimeRef = useRef<number>(currentTime);
  const stateRef = useRef({ tracks, assets, isPlaying });

  // Update state ref whenever these change
  useEffect(() => {
    stateRef.current = { tracks, assets, isPlaying };
  }, [tracks, assets, isPlaying]);

  // Sync playbackTimeRef when not playing to allow scrubbing
  useEffect(() => {
    if (!isPlaying) {
        playbackTimeRef.current = currentTime;
    }
  }, [currentTime, isPlaying]);

  // Helper to maintain media elements
  useEffect(() => {
    assets.forEach(asset => {
        if (!mediaRefs.current.has(asset.id)) {
            if (asset.type === 'video' || asset.type === 'audio') {
                const media = document.createElement(asset.type);
                media.src = asset.src;
                media.preload = 'auto';
                media.muted = false; // Enable audio
                media.volume = 1.0;
                media.playsInline = true;
                mediaRefs.current.set(asset.id, media);
            } else if (asset.type === 'image') {
                const img = new Image();
                img.src = asset.src;
                mediaRefs.current.set(asset.id, img);
            }
        }
    });
  }, [assets]);

  // Sync Logic: Decides what each media element should be doing
  // This function reads from the refs or arguments, not hook state directly
  const syncMedia = (time: number, playing: boolean, currentTracks: Track[], currentAssets: Asset[]) => {
      // 1. Calculate desired state for each asset
      const assetStates = new Map<string, { shouldPlay: boolean, time: number, volume: number }>();
      
      // Default all to paused/inactive
      currentAssets.forEach(a => assetStates.set(a.id, { shouldPlay: false, time: 0, volume: 0 }));

      // Determine active clips
      currentTracks.forEach(track => {
          if (track.isHidden) return;
          
          track.clips.forEach(clip => {
             if (time >= clip.startTime && time < clip.startTime + clip.duration) {
                 const clipOffset = time - clip.startTime;
                 const sourceTime = clip.startOffset + clipOffset;
                 
                 assetStates.set(clip.assetId, { 
                     shouldPlay: playing, 
                     time: sourceTime, 
                     volume: track.isMuted ? 0 : 1 
                 });
             }
          });
      });

      // 2. Apply state to DOM elements
      assetStates.forEach((state, assetId) => {
          const media = mediaRefs.current.get(assetId);
          if (!media) return;

          if (media instanceof HTMLVideoElement || media instanceof HTMLAudioElement) {
              // Volume
              media.volume = state.volume;

              // Play/Pause & Seek
              if (state.shouldPlay) {
                  // If we need to play, check if we need to seek first
                  const drift = Math.abs(media.currentTime - state.time);
                  
                  // If drift is large (>0.3s) or media is paused, we sync. 
                  // Otherwise we let it play naturally to preserve audio smoothness.
                  if (media.paused || drift > 0.3) {
                      if (Number.isFinite(state.time)) {
                          media.currentTime = state.time;
                      }
                      if (media.paused) {
                          media.play().catch(e => {
                              // Auto-play policies might block this
                              console.warn("Autoplay blocked", e);
                          });
                      }
                  }
              } else {
                  if (!media.paused) {
                      media.pause();
                  }
                  // If paused, we can sync exact time for scrubbing
                  if (!playing && Number.isFinite(state.time)) {
                      media.currentTime = state.time;
                  }
              }
          }
      });
  };

  // Rendering Loop (Visuals)
  const drawCanvas = (time: number, currentTracks: Track[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render visible clips (Bottom to Top)
    // Create a z-index sorted list
    const visibleClips: { clip: Clip, track: Track }[] = [];
    [...currentTracks].reverse().forEach(track => {
        if (track.isHidden) return;
        track.clips.forEach(clip => {
             if (time >= clip.startTime && time < clip.startTime + clip.duration) {
                 visibleClips.push({ clip, track });
             }
        });
    });

    visibleClips.forEach(({ clip }) => {
        const media = mediaRefs.current.get(clip.assetId);
        if (!media) return;

        if (clip.type === 'video' && media instanceof HTMLVideoElement) {
            // Video Draw
            const scale = Math.min(canvas.width / media.videoWidth, canvas.height / media.videoHeight);
            const w = media.videoWidth * scale;
            const h = media.videoHeight * scale;
            const x = (canvas.width - w) / 2;
            const y = (canvas.height - h) / 2;

            const clipScale = clip.scale || 1;
            
            ctx.save();
            ctx.translate(canvas.width/2, canvas.height/2);
            ctx.scale(clipScale, clipScale);
            ctx.translate(-canvas.width/2, -canvas.height/2);
            
            ctx.drawImage(media, x, y, w, h);
            ctx.restore();

        } else if (clip.type === 'image' && media instanceof HTMLImageElement) {
            // Image Draw
            const scale = Math.min(canvas.width / media.width, canvas.height / media.height);
            const w = media.width * scale;
            const h = media.height * scale;
            const x = (canvas.width - w) / 2;
            const y = (canvas.height - h) / 2;

            const clipScale = clip.scale || 1;

            ctx.save();
            ctx.translate(canvas.width/2, canvas.height/2);
            ctx.scale(clipScale, clipScale);
            ctx.translate(-canvas.width/2, -canvas.height/2);

            ctx.drawImage(media, x, y, w, h);
            ctx.restore();
        }
    });
  };

  // Main Loop
  const animate = (time: number) => {
    // Determine delta time
    if (lastTimeRef.current === undefined) {
        lastTimeRef.current = time;
    }
    const deltaTime = (time - lastTimeRef.current) / 1000;
    lastTimeRef.current = time;

    // Get fresh state from refs
    const { isPlaying: playing, tracks: currentTracks, assets: currentAssets } = stateRef.current;

    // Update logical time if playing
    if (playing) {
        playbackTimeRef.current += deltaTime;
        // Sync React state (UI)
        setCurrentTime(playbackTimeRef.current);
    }

    const effectiveTime = playbackTimeRef.current;

    // Sync Engine
    syncMedia(effectiveTime, playing, currentTracks, currentAssets);
    
    // Draw
    drawCanvas(effectiveTime, currentTracks);
    
    // Loop
    requestRef.current = requestAnimationFrame(animate);
  };

  // Effect: Manage Loop Start/Stop
  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []); // Run once on mount

  // Effect: Handle Pause cleanup
  // When pausing, we want to make sure we sync one last time to 'pause' the videos
  useEffect(() => {
      if (!isPlaying) {
        // Reset lastTimeRef so next play doesn't jump
        lastTimeRef.current = undefined;
        syncMedia(playbackTimeRef.current, false, tracks, assets);
      } else {
        lastTimeRef.current = undefined; // Reset for resume
      }
  }, [isPlaying]);

  return (
    <div ref={containerRef} className="flex-1 bg-black flex items-center justify-center overflow-hidden relative shadow-lg">
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        className="max-w-full max-h-full aspect-video shadow-2xl bg-[#050505]"
      />
    </div>
  );
};