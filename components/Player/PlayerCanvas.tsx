import React, { useRef, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { Asset, Clip, Track, Keyframe } from '../../types';

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
  const syncMedia = (time: number, playing: boolean, currentTracks: Track[], currentAssets: Asset[]) => {
      const assetStates = new Map<string, { shouldPlay: boolean, time: number, volume: number }>();
      
      currentAssets.forEach(a => assetStates.set(a.id, { shouldPlay: false, time: 0, volume: 0 }));

      currentTracks.forEach(track => {
          if (track.isHidden) return;
          track.clips.forEach(clip => {
             // Text clips don't have media to sync
             if (clip.type === 'text') return;

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

      assetStates.forEach((state, assetId) => {
          const media = mediaRefs.current.get(assetId);
          if (!media) return;

          if (media instanceof HTMLVideoElement || media instanceof HTMLAudioElement) {
              media.volume = state.volume;
              if (state.shouldPlay) {
                  const drift = Math.abs(media.currentTime - state.time);
                  if (media.paused || drift > 0.3) {
                      if (Number.isFinite(state.time)) {
                          media.currentTime = state.time;
                      }
                      if (media.paused) {
                          media.play().catch(e => console.warn("Autoplay blocked", e));
                      }
                  }
              } else {
                  if (!media.paused) media.pause();
                  if (!playing && Number.isFinite(state.time)) {
                      media.currentTime = state.time;
                  }
              }
          }
      });
  };

  const getInterpolatedValue = (clip: Clip, property: string, relativeTime: number, defaultValue: number): number => {
    const keyframes = clip.keyframes?.[property];
    
    // If no keyframes, use static value or default
    if (!keyframes || keyframes.length === 0) {
        // @ts-ignore - Dynamic property access
        const staticVal = clip[property] as number | undefined;
        return staticVal ?? defaultValue;
    }

    // Sort keyframes by time
    const sorted = [...keyframes].sort((a, b) => a.time - b.time);

    // Before first keyframe
    if (relativeTime <= sorted[0].time) return sorted[0].value;
    
    // After last keyframe
    if (relativeTime >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;

    // Interpolate
    const nextIndex = sorted.findIndex(k => k.time > relativeTime);
    const prev = sorted[nextIndex - 1];
    const next = sorted[nextIndex];
    
    const range = next.time - prev.time;
    if (range === 0) return prev.value;
    
    const ratio = (relativeTime - prev.time) / range;
    return prev.value + (next.value - prev.value) * ratio;
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

    // Visible Clips Logic
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
        // Calculate Transforms
        const relativeTime = time - clip.startTime;
        const opacity = getInterpolatedValue(clip, 'opacity', relativeTime, 1);
        const rotation = getInterpolatedValue(clip, 'rotation', relativeTime, 0);
        const scale = getInterpolatedValue(clip, 'scale', relativeTime, 1);
        const posX = getInterpolatedValue(clip, 'positionX', relativeTime, 0);
        const posY = getInterpolatedValue(clip, 'positionY', relativeTime, 0);

        if (opacity <= 0) return;

        ctx.save();
        ctx.globalAlpha = opacity;
        
        // Translate to Center + Offset
        ctx.translate(canvas.width/2 + posX, canvas.height/2 + posY);
        
        // Rotate
        ctx.rotate(rotation * Math.PI / 180);
        
        // Scale
        ctx.scale(scale, scale);

        // Flip
        const flipX = clip.flipHorizontal ? -1 : 1;
        const flipY = clip.flipVertical ? -1 : 1;
        ctx.scale(flipX, flipY);
        
        if (clip.type === 'text') {
             // Text Rendering
             const fontSize = clip.fontSize ?? 40;
             const fontFamily = clip.fontFamily ?? 'Inter';
             const isBold = clip.isBold ? 'bold ' : '';
             const isItalic = clip.isItalic ? 'italic ' : '';
             
             ctx.font = `${isItalic}${isBold}${fontSize}px ${fontFamily}`;
             ctx.textAlign = 'center';
             ctx.textBaseline = 'middle';
             
             if (clip.hasShadow) {
                 ctx.shadowColor = clip.shadowColor ?? '#000000';
                 ctx.shadowBlur = 4;
                 ctx.shadowOffsetX = 2;
                 ctx.shadowOffsetY = 2;
             }

             ctx.fillStyle = clip.textColor ?? '#ffffff';
             ctx.fillText(clip.text ?? 'Text', 0, 0);

        } else {
             // Media Rendering (Video/Image)
             const media = mediaRefs.current.get(clip.assetId);
             if (media) {
                 let w = 0, h = 0;
                 let drawMedia: HTMLVideoElement | HTMLImageElement | null = null;

                 if (clip.type === 'video' && media instanceof HTMLVideoElement) {
                      const aspectScale = Math.min(canvas.width / media.videoWidth, canvas.height / media.videoHeight);
                      w = media.videoWidth * aspectScale;
                      h = media.videoHeight * aspectScale;
                      drawMedia = media;
                 } else if (clip.type === 'image' && media instanceof HTMLImageElement) {
                      const aspectScale = Math.min(canvas.width / media.width, canvas.height / media.height);
                      w = media.width * aspectScale;
                      h = media.height * aspectScale;
                      drawMedia = media;
                 }

                 if (drawMedia) {
                      ctx.drawImage(drawMedia, -w/2, -h/2, w, h);
                 }
             }
        }

        ctx.restore();
    });
  };

  const animate = (time: number) => {
    if (lastTimeRef.current === undefined) lastTimeRef.current = time;
    const deltaTime = (time - lastTimeRef.current) / 1000;
    lastTimeRef.current = time;

    const { isPlaying: playing, tracks: currentTracks, assets: currentAssets } = stateRef.current;

    if (playing) {
        playbackTimeRef.current += deltaTime;
        setCurrentTime(playbackTimeRef.current);
    }
    const effectiveTime = playbackTimeRef.current;

    syncMedia(effectiveTime, playing, currentTracks, currentAssets);
    drawCanvas(effectiveTime, currentTracks);
    
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, []);

  useEffect(() => {
      if (!isPlaying) {
        lastTimeRef.current = undefined;
        syncMedia(playbackTimeRef.current, false, tracks, assets);
      } else {
        lastTimeRef.current = undefined;
      }
  }, [isPlaying]);

  return (
    <div ref={containerRef} className="flex-1 bg-black flex items-center justify-center overflow-hidden relative shadow-lg">
      <canvas ref={canvasRef} width={1280} height={720} className="max-w-full max-h-full aspect-video shadow-2xl bg-[#050505]" />
    </div>
  );
};