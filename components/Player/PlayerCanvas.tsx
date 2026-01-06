
import React, { useRef, useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { Asset, Clip, Track } from '../../types';
import JSZip from 'jszip';
import { Loader2 } from 'lucide-react';

export const PlayerCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hiddenMediaContainerRef = useRef<HTMLDivElement>(null);
  const mediaRefs = useRef<Map<string, HTMLVideoElement | HTMLAudioElement | HTMLImageElement>>(new Map());
  
  // Export State
  const [exportPhase, setExportPhase] = useState<'idle' | 'recording' | 'extracting'>('idle');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  
  const { tracks, assets, currentTime, isPlaying, setCurrentTime, setIsPlaying, exportConfig, updateExportProgress, finishExport } = useStore();
  
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
    if (!isPlaying && !exportConfig.isExporting) {
        playbackTimeRef.current = currentTime;
    }
  }, [currentTime, isPlaying, exportConfig.isExporting]);

  // Helper to maintain media elements
  useEffect(() => {
    // Clean up removed assets
    const currentIds = new Set(assets.map(a => a.id));
    mediaRefs.current.forEach((media, id) => {
        if (!currentIds.has(id)) {
            media.remove(); // Remove from DOM
            mediaRefs.current.delete(id);
        }
    });

    assets.forEach(asset => {
        if (!mediaRefs.current.has(asset.id)) {
            let media: HTMLVideoElement | HTMLAudioElement | HTMLImageElement;
            
            if (asset.type === 'video' || asset.type === 'audio') {
                media = document.createElement(asset.type);
                media.src = asset.src;
                (media as HTMLMediaElement).preload = 'auto';
                if (asset.type === 'video') {
                    (media as HTMLVideoElement).playsInline = true;
                    (media as HTMLVideoElement).muted = true; // Important for autoplay policy
                    // iOS/Safari compatibility
                    media.setAttribute('playsinline', 'true');
                    media.setAttribute('webkit-playsinline', 'true');
                }
            } else {
                media = new Image();
                media.src = asset.src;
            }

            // --- VISIBILITY HACK ---
            // Place it absolutely behind the canvas with slight opacity.
            media.style.position = 'absolute';
            media.style.top = '0';
            media.style.left = '0';
            media.style.width = '320px'; 
            media.style.height = '180px';
            media.style.opacity = '0.01'; 
            media.style.pointerEvents = 'none';
            media.style.zIndex = '0'; 

            if (hiddenMediaContainerRef.current) {
                hiddenMediaContainerRef.current.appendChild(media);
            }

            mediaRefs.current.set(asset.id, media);
        }
    });
  }, [assets]);

  // Sync Logic
  const syncMedia = (time: number, playing: boolean, currentTracks: Track[], currentAssets: Asset[]) => {
      const assetStates = new Map<string, { shouldPlay: boolean, time: number, volume: number, playbackRate: number }>();
      
      currentAssets.forEach(a => assetStates.set(a.id, { shouldPlay: false, time: 0, volume: 0, playbackRate: 1 }));

      currentTracks.forEach(track => {
          if (track.isHidden) return;
          track.clips.forEach(clip => {
             if (clip.type === 'text') return;

             if (time >= clip.startTime && time < clip.startTime + clip.duration) {
                 const clipOffset = time - clip.startTime;
                 const speed = clip.speed ?? 1;
                 const sourceTime = clip.startOffset + (clipOffset * speed);
                 
                 assetStates.set(clip.assetId, { 
                     shouldPlay: playing, 
                     time: sourceTime, 
                     volume: (track.isMuted || clip.muted) ? 0 : 1,
                     playbackRate: speed
                 });
             }
          });
      });

      assetStates.forEach((state, assetId) => {
          const media = mediaRefs.current.get(assetId);
          if (!media) return;

          if (media instanceof HTMLVideoElement || media instanceof HTMLAudioElement) {
              media.volume = state.volume;
              media.playbackRate = state.playbackRate;
              
              if (state.shouldPlay) {
                  const drift = Math.abs(media.currentTime - state.time);
                  const tolerance = 0.3 * Math.max(1, state.playbackRate);
                  
                  if (media.paused || drift > tolerance) {
                      if (Number.isFinite(state.time)) {
                          media.currentTime = state.time;
                      }
                      if (media.paused) {
                          media.play().catch(e => console.warn("Autoplay blocked", e));
                      }
                  }
              } else {
                  if (!media.paused) media.pause();
                  if (Math.abs(media.currentTime - state.time) > 0.05 && Number.isFinite(state.time)) {
                      media.currentTime = state.time;
                  }
              }
          }
      });
  };

  const getInterpolatedValue = (clip: Clip, property: string, relativeTime: number, defaultValue: number): number => {
    const keyframes = clip.keyframes?.[property];
    if (!keyframes || keyframes.length === 0) {
        // @ts-ignore
        const staticVal = clip[property] as number | undefined;
        return staticVal ?? defaultValue;
    }
    const sorted = [...keyframes].sort((a, b) => a.time - b.time);
    if (relativeTime <= sorted[0].time) return sorted[0].value;
    if (relativeTime >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;
    const nextIndex = sorted.findIndex(k => k.time > relativeTime);
    const prev = sorted[nextIndex - 1];
    const next = sorted[nextIndex];
    const range = next.time - prev.time;
    if (range === 0) return prev.value;
    const ratio = (relativeTime - prev.time) / range;
    return prev.value + (next.value - prev.value) * ratio;
  };

  const drawCanvas = (time: number, currentTracks: Track[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false }); // Optimize
    if (!ctx) return;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const visibleClips: { clip: Clip, track: Track }[] = [];
    [...currentTracks].reverse().forEach(track => {
        if (track.isHidden) return;
        track.clips.forEach(clip => {
             if (clip.visible === false) return;
             if (time >= clip.startTime && time < clip.startTime + clip.duration) {
                 visibleClips.push({ clip, track });
             }
        });
    });

    visibleClips.forEach(({ clip }) => {
        const relativeTime = time - clip.startTime;
        const opacity = getInterpolatedValue(clip, 'opacity', relativeTime, 1);
        if (opacity <= 0) return;
        
        const rotation = getInterpolatedValue(clip, 'rotation', relativeTime, 0);
        const scale = getInterpolatedValue(clip, 'scale', relativeTime, 1);
        const posX = getInterpolatedValue(clip, 'positionX', relativeTime, 0);
        const posY = getInterpolatedValue(clip, 'positionY', relativeTime, 0);

        ctx.save();
        
        let transOffsetX = 0, transOffsetY = 0, transOpacity = 1;
        if (clip.transition && clip.transition.type !== 'none') {
            const tDur = clip.transition.duration;
            if (relativeTime < tDur) {
                const p = relativeTime / tDur;
                const ease = 1 - Math.pow(1 - p, 3);
                switch (clip.transition.type) {
                    case 'fade': transOpacity = p; break;
                    case 'slide-left': transOffsetX = canvas.width * (1 - ease); break;
                    case 'slide-right': transOffsetX = -canvas.width * (1 - ease); break;
                    case 'slide-up': transOffsetY = canvas.height * (1 - ease); break;
                    case 'slide-down': transOffsetY = -canvas.height * (1 - ease); break;
                }
            }
        }

        ctx.globalAlpha = opacity * transOpacity;
        ctx.translate(canvas.width/2 + posX + transOffsetX, canvas.height/2 + posY + transOffsetY);
        ctx.rotate(rotation * Math.PI / 180);
        ctx.scale(scale, scale);
        
        const flipX = clip.flipHorizontal ? -1 : 1;
        const flipY = clip.flipVertical ? -1 : 1;
        ctx.scale(flipX, flipY);

        if (clip.transition && clip.transition.type.startsWith('wipe') && relativeTime < clip.transition.duration) {
             const p = relativeTime / clip.transition.duration;
             const ease = 1 - Math.pow(1 - p, 3);
             const w = 1280, h = 720;
             ctx.beginPath();
             if (clip.transition.type === 'wipe-right') ctx.rect(-w/2, -h/2, w * ease, h);
             else if (clip.transition.type === 'wipe-left') ctx.rect(w/2 - (w * ease), -h/2, w * ease, h);
             else if (clip.transition.type === 'wipe-down') ctx.rect(-w/2, -h/2, w, h * ease);
             else if (clip.transition.type === 'wipe-up') ctx.rect(-w/2, h/2 - (h * ease), w, h * ease);
             ctx.clip();
        }
        
        if (clip.type === 'text') {
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
             }
             ctx.fillStyle = clip.textColor ?? '#ffffff';
             ctx.fillText(clip.text ?? 'Text', 0, 0);
        } else {
             const media = mediaRefs.current.get(clip.assetId);
             if (media) {
                 const brightness = getInterpolatedValue(clip, 'brightness', relativeTime, 1);
                 const contrast = getInterpolatedValue(clip, 'contrast', relativeTime, 1);
                 const saturation = getInterpolatedValue(clip, 'saturation', relativeTime, 1);
                 const grayscale = getInterpolatedValue(clip, 'grayscale', relativeTime, 0);
                 const sepia = getInterpolatedValue(clip, 'sepia', relativeTime, 0);
                 const blur = getInterpolatedValue(clip, 'blur', relativeTime, 0);
                 if (ctx.filter !== undefined) {
                     ctx.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation}) grayscale(${grayscale}) sepia(${sepia}) blur(${blur}px)`;
                 }

                 let w = 0, h = 0;
                 let drawMedia: HTMLVideoElement | HTMLImageElement | null = null;
                 if (clip.type === 'video' && media instanceof HTMLVideoElement) {
                      // Ensure video has data
                      if (media.readyState >= 2) {
                        const aspectScale = Math.min(canvas.width / media.videoWidth, canvas.height / media.videoHeight);
                        w = media.videoWidth * aspectScale;
                        h = media.videoHeight * aspectScale;
                        drawMedia = media;
                      }
                 } else if (clip.type === 'image' && media instanceof HTMLImageElement) {
                      const aspectScale = Math.min(canvas.width / media.width, canvas.height / media.height);
                      w = media.width * aspectScale;
                      h = media.height * aspectScale;
                      drawMedia = media;
                 }
                 if (drawMedia) ctx.drawImage(drawMedia, -w/2, -h/2, w, h);
                 ctx.filter = 'none';
             }
        }
        ctx.restore();
    });
  };

  const animate = (time: number) => {
    // If we are in the 'extracting' phase of export, the loop is paused
    // so we can seek the recorded video manually.
    if (exportPhase === 'extracting') {
        requestRef.current = requestAnimationFrame(animate);
        return;
    }

    if (lastTimeRef.current === undefined) lastTimeRef.current = time;
    const deltaTime = (time - lastTimeRef.current) / 1000;
    lastTimeRef.current = time;
    const { isPlaying: playing, tracks: currentTracks, assets: currentAssets } = stateRef.current;
    
    if (playing) {
        playbackTimeRef.current += deltaTime;
        // In recording mode, we rely on this playbackTimeRef to drive the recording length
        setCurrentTime(playbackTimeRef.current);
    }
    
    syncMedia(playbackTimeRef.current, playing, currentTracks, currentAssets);
    drawCanvas(playbackTimeRef.current, currentTracks);
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [exportPhase]); // Re-bind if phase changes

  // --- EXPORT PHASE 1: RECORDING ---
  useEffect(() => {
    if (!exportConfig.isExporting) {
        setExportPhase('idle');
        return;
    }

    // Initialize Recording
    if (exportPhase === 'idle' && canvasRef.current) {
        console.log('[Export] Phase 1: initializing recording...');
        setExportPhase('recording');
        
        // Use a supported mime type
        const types = ["video/webm", "video/mp4"];
        const mimeType = types.find(t => MediaRecorder.isTypeSupported(t)) || "";
        
        if (!mimeType) {
            alert("MediaRecorder not supported in this browser.");
            finishExport();
            return;
        }

        const stream = canvasRef.current.captureStream(exportConfig.fps);
        const recorder = new MediaRecorder(stream, { 
            mimeType,
            videoBitsPerSecond: 5000000 // High bitrate for quality
        });
        
        recordedChunksRef.current = [];
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };

        mediaRecorderRef.current = recorder;

        // Reset Timeline to Start
        setCurrentTime(exportConfig.startTime);
        playbackTimeRef.current = exportConfig.startTime;
        
        // Start
        recorder.start();
        setIsPlaying(true);
    }
  }, [exportConfig.isExporting, exportPhase, exportConfig.fps, exportConfig.startTime]);

  // Monitor Recording Progress
  useEffect(() => {
    if (exportPhase === 'recording' && isPlaying) {
        // Calculate progress based on time
        const totalDuration = exportConfig.endTime - exportConfig.startTime;
        const currentProgress = currentTime - exportConfig.startTime;
        const percentage = Math.max(0, Math.min(99, (currentProgress / totalDuration) * 50)); // Phase 1 is 0-50%
        
        updateExportProgress(Math.round(percentage));

        // Check for finish
        if (currentTime >= exportConfig.endTime) {
            console.log('[Export] Phase 1 complete. Stopping recording.');
            setIsPlaying(false);
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
                setExportPhase('extracting');
            }
        }
    }
  }, [exportPhase, isPlaying, currentTime, exportConfig.endTime, exportConfig.startTime]);

  // --- EXPORT PHASE 2: EXTRACTION ---
  useEffect(() => {
      if (exportPhase === 'extracting') {
        const extractFrames = async () => {
             console.log('[Export] Phase 2: Extracting frames...');
             // Wait a tick for the last chunk to push
             await new Promise(r => setTimeout(r, 100));

             if (recordedChunksRef.current.length === 0) {
                 alert("Recording failed: No data captured.");
                 finishExport();
                 return;
             }

             const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
             const url = URL.createObjectURL(blob);
             const tempVideo = document.createElement('video');
             
             tempVideo.src = url;
             tempVideo.muted = true;
             tempVideo.playsInline = true;
             tempVideo.autoplay = false; // We will control seeking manually
             tempVideo.currentTime = 0; // Seek to start relative to the VIDEO file (not timeline)

             // Wait for metadata
             await new Promise((resolve, reject) => {
                 tempVideo.onloadeddata = () => resolve(true);
                 tempVideo.onerror = (e) => reject(e);
                 // Fallback
                 setTimeout(() => resolve(true), 2000); 
             });

             const zip = new JSZip();
             const { startTime, endTime, fps, format } = exportConfig;
             const totalFrames = Math.ceil((endTime - startTime) * fps);
             const step = 1 / fps;

             try {
                for (let i = 0; i < totalFrames; i++) {
                    const t = i * step; // Time relative to the start of the RECORDED video
                    
                    // Seek the intermediate video
                    tempVideo.currentTime = t;
                    
                    // Wait for seeked on the intermediate video
                    // This is much more reliable than seeking 5 different sources
                    await new Promise<void>(resolve => {
                        const h = () => { tempVideo.removeEventListener('seeked', h); resolve(); };
                        tempVideo.addEventListener('seeked', h);
                        // Manual timeout fallback
                        setTimeout(resolve, 500);
                    });

                    // Draw the intermediate video to the main canvas
                    const canvas = canvasRef.current;
                    if (canvas) {
                        const ctx = canvas.getContext('2d', { alpha: false });
                        if (ctx) {
                            ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
                            
                            // Capture Blob
                            const blob = await new Promise<Blob | null>(resolve => 
                                canvas.toBlob(resolve, format === 'png' ? 'image/png' : 'image/jpeg', 0.90)
                            );
                            
                            if (blob) {
                                const padIndex = i.toString().padStart(5, '0');
                                zip.file(`frame_${padIndex}.${format}`, blob);
                            }
                        }
                    }

                    // Progress 50-100%
                    const percentage = 50 + Math.round(((i + 1) / totalFrames) * 50);
                    updateExportProgress(Math.min(100, percentage));
                }
                
                // Cleanup
                URL.revokeObjectURL(url);
                tempVideo.remove();

                // Zip and Download
                const content = await zip.generateAsync({ type: 'blob' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(content);
                link.download = `frames_${Date.now()}.zip`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                console.log('[Export] Done.');

             } catch (e) {
                 console.error("Extraction failed", e);
                 alert("Export failed during extraction phase.");
             } finally {
                 finishExport();
                 setExportPhase('idle');
             }
        };

        extractFrames();
      }
  }, [exportPhase]);

  return (
    <div ref={containerRef} className="flex-1 bg-black flex items-center justify-center overflow-hidden relative shadow-lg">
      <canvas 
        ref={canvasRef} 
        width={1280} 
        height={720} 
        className="max-w-full max-h-full aspect-video shadow-2xl bg-[#050505] relative z-10" 
      />
      
      {/* Hidden Container */}
      <div 
        ref={hiddenMediaContainerRef} 
        className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
      /> 
      
      {exportConfig.isExporting && (
          <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center text-white backdrop-blur-sm">
              <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
              <h2 className="text-xl font-bold mb-2">
                  {exportPhase === 'recording' ? 'Phase 1: Compiling Composite...' : 'Phase 2: Extracting Frames...'}
              </h2>
              <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-100 ease-out" 
                    style={{ width: `${exportConfig.progress}%` }}
                  />
              </div>
              <p className="mt-2 text-sm text-gray-400 font-mono">{exportConfig.progress}%</p>
          </div>
      )}
    </div>
  );
};
