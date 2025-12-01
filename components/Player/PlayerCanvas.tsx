
import React, { useRef, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { Asset, Clip, Track, Keyframe } from '../../types';

export const PlayerCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mediaRefs = useRef<Map<string, HTMLVideoElement | HTMLAudioElement | HTMLImageElement>>(new Map());
  
  const { tracks, assets, currentTime, isPlaying, setCurrentTime } = useStore();
  
  // Refs for animation loop state to avoid closure staleness
  const requestRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number | undefined>(undefined);
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
                     volume: (track.isMuted || clip.muted) ? 0 : 1 
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
             if (clip.visible === false) return; // Skip hidden clips
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
        
        // --- Transitions ---
        let transOffsetX = 0;
        let transOffsetY = 0;
        let transOpacity = 1;
        
        if (clip.transition && clip.transition.type !== 'none') {
            const tDur = clip.transition.duration;
            if (relativeTime < tDur) {
                const p = relativeTime / tDur;
                const ease = 1 - Math.pow(1 - p, 3); // Cubic ease out

                switch (clip.transition.type) {
                    case 'fade':
                        transOpacity = p;
                        break;
                    case 'slide-left': // Enters from right
                        transOffsetX = canvas.width * (1 - ease);
                        break;
                    case 'slide-right': // Enters from left
                        transOffsetX = -canvas.width * (1 - ease);
                        break;
                    case 'slide-up': // Enters from bottom
                        transOffsetY = canvas.height * (1 - ease);
                        break;
                    case 'slide-down': // Enters from top
                        transOffsetY = -canvas.height * (1 - ease);
                        break;
                }
            }
        }

        ctx.globalAlpha = opacity * transOpacity;
        
        // Translate to Center + Offset
        ctx.translate(canvas.width/2 + posX + transOffsetX, canvas.height/2 + posY + transOffsetY);
        
        // Rotate
        ctx.rotate(rotation * Math.PI / 180);
        
        // Scale
        ctx.scale(scale, scale);

        // Flip
        const flipX = clip.flipHorizontal ? -1 : 1;
        const flipY = clip.flipVertical ? -1 : 1;
        ctx.scale(flipX, flipY);

        // --- Wipe Clipping ---
        if (clip.transition && clip.transition.type.startsWith('wipe') && relativeTime < clip.transition.duration) {
            const p = relativeTime / clip.transition.duration;
            const ease = 1 - Math.pow(1 - p, 3);
            const w = 1280; 
            const h = 720;
            
            ctx.beginPath();
            switch (clip.transition.type) {
                case 'wipe-right': // Left to Right
                    ctx.rect(-w/2, -h/2, w * ease, h);
                    break;
                case 'wipe-left': // Right to Left
                    ctx.rect(w/2 - (w * ease), -h/2, w * ease, h);
                    break;
                case 'wipe-down': // Top to Bottom
                    ctx.rect(-w/2, -h/2, w, h * ease);
                    break;
                case 'wipe-up': // Bottom to Top
                    ctx.rect(-w/2, h/2 - (h * ease), w, h * ease);
                    break;
            }
            ctx.clip();
        }
        
        if (clip.type === 'text') {
             // Text Rendering
             const fontSize = getInterpolatedValue(clip, 'fontSize', relativeTime, 40);
             const fontFamily = clip.fontFamily ?? 'Inter';
             const isBold = clip.isBold ? 'bold ' : '';
             const isItalic = clip.isItalic ? 'italic ' : '';
             
             ctx.font = `${isItalic}${isBold}${fontSize}px ${fontFamily}`;
             ctx.textAlign = 'center';
             ctx.textBaseline = 'middle';
             
             if (clip.hasShadow) {
                 ctx.shadowColor = clip.shadowColor ?? '#000000';
                 ctx.shadowBlur = getInterpolatedValue(clip, 'shadowBlur', relativeTime, 4);
                 ctx.shadowOffsetX = getInterpolatedValue(clip, 'shadowOffsetX', relativeTime, 2);
                 ctx.shadowOffsetY = getInterpolatedValue(clip, 'shadowOffsetY', relativeTime, 2);
             } else {
                 ctx.shadowColor = 'transparent';
                 ctx.shadowBlur = 0;
                 ctx.shadowOffsetX = 0;
                 ctx.shadowOffsetY = 0;
             }

             // Filters do not typically apply to text in this engine (optional choice)
             // If we wanted to, we'd add ctx.filter here.
             
             ctx.fillStyle = clip.textColor ?? '#ffffff';
             ctx.fillText(clip.text ?? 'Text', 0, 0);

        } else {
             // Media Rendering (Video/Image)
             const media = mediaRefs.current.get(clip.assetId);
             if (media) {
                 // Apply Filters
                 const brightness = getInterpolatedValue(clip, 'brightness', relativeTime, 1);
                 const contrast = getInterpolatedValue(clip, 'contrast', relativeTime, 1);
                 const saturation = getInterpolatedValue(clip, 'saturation', relativeTime, 1);
                 const grayscale = getInterpolatedValue(clip, 'grayscale', relativeTime, 0);
                 const sepia = getInterpolatedValue(clip, 'sepia', relativeTime, 0);
                 const blur = getInterpolatedValue(clip, 'blur', relativeTime, 0);

                 // Apply CSS filter string
                 // Note: Check browser support or polyfill if needed, but standard in modern browsers.
                 if (ctx.filter !== undefined) {
                     ctx.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation}) grayscale(${grayscale}) sepia(${sepia}) blur(${blur}px)`;
                 }

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
                 
                 // Reset filter for next object
                 ctx.filter = 'none';
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
