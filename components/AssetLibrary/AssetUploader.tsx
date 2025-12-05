
import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { db } from '../../services/db';
import { Upload, FileVideo, Music, Image as ImageIcon, Loader2, Sparkles, AlertCircle, Type, Plus, Globe, Search, Download, Key } from 'lucide-react';
import { Asset } from '../../types';
import { GoogleGenAI } from "@google/genai";
import clsx from 'clsx';

export const AssetUploader: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addAsset, addClip, tracks } = useStore();
  
  const [mode, setMode] = useState<'upload' | 'generate' | 'text' | 'stock'>('upload');
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');

  // Generation State
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');

  // Text State
  const [textInput, setTextInput] = useState('New Text Layer');

  // Stock State
  const [stockQuery, setStockQuery] = useState('');
  const [stockType, setStockType] = useState<'image' | 'video'>('image');
  const [stockResults, setStockResults] = useState<any[]>([]);
  const [pexelsKey, setPexelsKey] = useState(() => localStorage.getItem('canvasreel_pexels_key') || '');
  const [showKeyInput, setShowKeyInput] = useState(!localStorage.getItem('canvasreel_pexels_key'));

  const savePexelsKey = (key: string) => {
      setPexelsKey(key);
      localStorage.setItem('canvasreel_pexels_key', key);
      setShowKeyInput(false);
  };

  const generateThumbnail = async (file: File, type: string): Promise<Blob | undefined> => {
      if (type === 'audio') return undefined;

      return new Promise((resolve) => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          // Thumbnail size
          canvas.width = 128;
          canvas.height = 128;
          
          if (!ctx) {
              resolve(undefined);
              return;
          }

          if (type === 'video') {
              const video = document.createElement('video');
              video.src = URL.createObjectURL(file);
              video.currentTime = 1.0; // Seek to 1s or start
              video.muted = true;
              video.playsInline = true;
              video.onloadeddata = () => {
                   if (video.duration < 1) video.currentTime = 0;
              };
              video.onseeked = () => {
                  // Draw scaled
                  const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
                  const x = (canvas.width / 2) - (video.videoWidth / 2) * scale;
                  const y = (canvas.height / 2) - (video.videoHeight / 2) * scale;
                  
                  ctx.drawImage(video, x, y, video.videoWidth * scale, video.videoHeight * scale);
                  canvas.toBlob((blob) => {
                      URL.revokeObjectURL(video.src);
                      resolve(blob || undefined);
                  }, 'image/jpeg', 0.7);
              };
              video.onerror = () => {
                   URL.revokeObjectURL(video.src);
                   resolve(undefined);
              };
          } else if (type === 'image') {
              const img = new Image();
              img.src = URL.createObjectURL(file);
              img.onload = () => {
                  const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
                  const x = (canvas.width / 2) - (img.width / 2) * scale;
                  const y = (canvas.height / 2) - (img.height / 2) * scale;
                  
                  ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                  canvas.toBlob((blob) => {
                      URL.revokeObjectURL(img.src);
                      resolve(blob || undefined);
                  }, 'image/jpeg', 0.7);
              };
              img.onerror = () => {
                  URL.revokeObjectURL(img.src);
                  resolve(undefined);
              }
          } else {
              resolve(undefined);
          }
      });
  };

  const processFile = async (file: File) => {
      const type = file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'image';
      const id = crypto.randomUUID();
      
      // Generate Thumbnail
      const thumbnailBlob = await generateThumbnail(file, type);
      const thumbnailSrc = thumbnailBlob ? URL.createObjectURL(thumbnailBlob) : undefined;

      // Store in Dexie
      await db.assets.add({
        id,
        name: file.name,
        type,
        blob: file,
        thumbnailBlob: thumbnailBlob,
        createdAt: Date.now()
      });

      // Create Object URL for preview
      const url = URL.createObjectURL(file);
      
      // Get duration for video/audio
      let duration = 5; // Default for images
      let width = 0;
      let height = 0;

      if (type === 'video' || type === 'audio') {
        const media = document.createElement(type === 'video' ? 'video' : 'audio');
        media.src = url;
        await new Promise((resolve) => {
          media.onloadedmetadata = () => {
            duration = media.duration;
            if (type === 'video') {
              width = (media as HTMLVideoElement).videoWidth;
              height = (media as HTMLVideoElement).videoHeight;
            }
            resolve(true);
          };
          media.onerror = () => resolve(true);
        });
      }

      const newAsset: Asset = {
        id,
        name: file.name,
        type: type as 'video' | 'audio' | 'image',
        src: url,
        thumbnail: thumbnailSrc,
        duration,
        width,
        height
      };

      addAsset(newAsset);
      return newAsset;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setLoading(true);
    setStatusText('Importing...');
    
    try {
        for (let i = 0; i < files.length; i++) {
            await processFile(files[i]);
        }
    } catch (e) {
        console.error(e);
    }
    
    setLoading(false);
    setStatusText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGenerate = async () => {
      if (!prompt.trim()) return;

      try {
        if (window.aistudio && await window.aistudio.hasSelectedApiKey() === false) {
            await window.aistudio.openSelectKey();
        }

        setLoading(true);
        setStatusText('Initializing Veo...');

        // Create client just before call
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        setStatusText('Generating video (this takes a moment)...');
        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: aspectRatio
            }
        });

        // Polling loop
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            operation = await ai.operations.getVideosOperation({operation: operation});
            setStatusText('Rendering video...');
        }

        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!videoUri) throw new Error('Generation failed: No video URI returned.');

        setStatusText('Downloading media...');
        const res = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
        if (!res.ok) throw new Error('Failed to download generated video.');
        
        const blob = await res.blob();
        const file = new File([blob], `veo_${Date.now()}.mp4`, { type: 'video/mp4' });

        setStatusText('Processing asset...');
        const asset = await processFile(file);

        // Auto-add to timeline
        setStatusText('Adding to track...');
        const videoTrack = tracks.find(t => t.type === 'video');
        if (videoTrack) {
             let startTime = 0;
            if (videoTrack.clips.length > 0) {
                const lastClip = videoTrack.clips.reduce((prev, current) => 
                    (prev.startTime + prev.duration > current.startTime + current.duration) ? prev : current
                );
                startTime = lastClip.startTime + lastClip.duration;
            }

             addClip({
                id: crypto.randomUUID(),
                assetId: asset.id,
                trackId: videoTrack.id,
                startOffset: 0,
                startTime: startTime,
                duration: asset.duration,
                name: asset.name,
                type: 'video',
                scale: 1,
                positionX: 0,
                positionY: 0
             });
        }

        setPrompt('');
        setStatusText('Success!');
        setTimeout(() => setStatusText(''), 2000);

      } catch (e: any) {
          console.error(e);
          // Handle specific API Key/Entity Not Found error
          if (e.message && (e.message.includes('Requested entity was not found') || e.message.includes('404'))) {
             alert("The selected billing project or API key was not found. Please select a valid project again.");
             if (window.aistudio) {
                 try {
                     await window.aistudio.openSelectKey();
                 } catch (err) {
                     console.error(err);
                 }
             }
          } else {
             alert('Error generating video: ' + (e.message || 'Unknown error'));
          }
      } finally {
          setLoading(false);
          setStatusText('');
      }
  };

  const handleAddText = () => {
    // Find text track
    const track = tracks.find(t => t.type === 'text');
    if (!track) {
        alert("No Text track found.");
        return;
    }

    addClip({
        id: crypto.randomUUID(),
        assetId: 'text-placeholder', // Text clips don't need real asset
        trackId: track.id,
        startOffset: 0,
        startTime: 0, // Add to start
        duration: 5,
        name: 'Text Layer',
        type: 'text',
        text: textInput,
        fontSize: 60,
        fontFamily: 'Inter',
        textColor: '#ffffff',
        isBold: true,
        hasShadow: true,
        scale: 1,
        positionX: 0,
        positionY: 0
    });
    
    setTextInput('');
    setMode('upload'); // Switch back to view list or stay? Stay for now.
  };

  const handleStockSearch = async () => {
      if (!stockQuery.trim()) return;
      if (!pexelsKey) {
          setShowKeyInput(true);
          return;
      }

      setLoading(true);
      setStatusText('Searching Pexels...');
      setStockResults([]);

      try {
          const baseUrl = stockType === 'video' ? 'https://api.pexels.com/videos/search' : 'https://api.pexels.com/v1/search';
          const res = await fetch(`${baseUrl}?query=${encodeURIComponent(stockQuery)}&per_page=12&orientation=landscape`, {
              headers: {
                  Authorization: pexelsKey
              }
          });
          
          if (res.status === 401) {
              alert("Invalid API Key");
              setShowKeyInput(true);
              setLoading(false);
              return;
          }

          const data = await res.json();
          if (stockType === 'video') {
              setStockResults(data.videos || []);
          } else {
              setStockResults(data.photos || []);
          }

      } catch (e) {
          console.error(e);
          alert("Failed to search stock library.");
      } finally {
          setLoading(false);
          setStatusText('');
      }
  };

  const handleImportStock = async (item: any) => {
      setLoading(true);
      setStatusText('Downloading media...');
      try {
          let srcUrl = '';
          let fileName = '';

          if (stockType === 'video') {
              // Get highest res mp4 that isn't massive, or just first one
              const videoFile = item.video_files.find((v: any) => v.height === 720) || item.video_files[0];
              srcUrl = videoFile.link;
              fileName = `pexels_${item.id}.mp4`;
          } else {
              srcUrl = item.src?.large2x || item.src?.large;
              fileName = `pexels_${item.id}.jpg`;
          }

          if (!srcUrl) {
            throw new Error("Media source not found");
          }

          const res = await fetch(srcUrl);
          const blob = await res.blob();
          const file = new File([blob], fileName, { type: stockType === 'video' ? 'video/mp4' : 'image/jpeg' });
          
          await processFile(file);
          alert("Imported successfully!");
      } catch (e) {
          console.error(e);
          alert("Failed to download media.");
      } finally {
          setLoading(false);
          setStatusText('');
      }
  };

  return (
    <div className="p-4 border-b border-gray-800 flex flex-col gap-4 bg-[#121212]">
      {/* Tabs */}
      <div className="flex bg-gray-900 p-1 rounded-lg select-none">
        <button 
           onClick={() => setMode('upload')}
           className={clsx("flex-1 py-1.5 text-xs font-medium rounded-md transition-colors", mode === 'upload' ? "bg-gray-700 text-white shadow-sm" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800")}
        >
            Import
        </button>
        <button 
           onClick={() => setMode('stock')}
           className={clsx("flex-1 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5", mode === 'stock' ? "bg-blue-900/40 text-blue-100 shadow-sm" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800")}
        >
            <Globe className="w-3 h-3" />
            Stock
        </button>
        <button 
           onClick={() => setMode('generate')}
           className={clsx("flex-1 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5", mode === 'generate' ? "bg-purple-900/40 text-purple-100 shadow-sm" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800")}
        >
            <Sparkles className="w-3 h-3" />
            AI Video
        </button>
        <button 
           onClick={() => setMode('text')}
           className={clsx("flex-1 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5", mode === 'text' ? "bg-gray-700 text-white shadow-sm" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800")}
        >
            <Type className="w-3 h-3" />
            Text
        </button>
      </div>

      {mode === 'upload' && (
        <>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                multiple
                accept="video/*,audio/*,image/*"
            />
            <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 py-6 px-4 rounded-lg text-sm font-medium transition-all border-dashed hover:border-gray-500 disabled:opacity-50"
            >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                <span className="flex flex-col items-center gap-1">
                    <span>{loading ? statusText : "Click to Upload Media"}</span>
                    {!loading && <span className="text-[10px] text-gray-500 font-normal">Supports Video, Audio, Images</span>}
                </span>
            </button>
        </>
      )}

      {mode === 'generate' && (
        <div className="space-y-3 animate-in fade-in duration-300">
             <textarea 
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Describe your video..."
                className="w-full h-24 bg-black/40 border border-gray-700 rounded-md p-3 text-sm text-white resize-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder:text-gray-600"
             />
             
             <div className="flex gap-2">
                <button 
                    onClick={() => setAspectRatio('16:9')} 
                    className={clsx("flex-1 py-1.5 border rounded text-xs font-medium transition-colors", aspectRatio === '16:9' ? "bg-blue-900/30 border-blue-500 text-blue-200" : "border-gray-700 text-gray-400 hover:bg-gray-800")}
                >
                    16:9 Landscape
                </button>
                <button 
                    onClick={() => setAspectRatio('9:16')} 
                    className={clsx("flex-1 py-1.5 border rounded text-xs font-medium transition-colors", aspectRatio === '9:16' ? "bg-blue-900/30 border-blue-500 text-blue-200" : "border-gray-700 text-gray-400 hover:bg-gray-800")}
                >
                    9:16 Portrait
                </button>
             </div>

             <button 
                onClick={handleGenerate}
                disabled={loading || !prompt}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white py-2.5 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
             >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {loading ? 'Processing...' : 'Generate with Veo'}
             </button>
             
             {loading && (
                 <div className="flex items-center justify-center gap-2 text-xs text-blue-400 mt-1">
                     <Loader2 className="w-3 h-3 animate-spin" />
                     <span>{statusText}</span>
                 </div>
             )}
        </div>
      )}

      {mode === 'text' && (
        <div className="space-y-3 animate-in fade-in duration-300">
            <input 
                type="text"
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                placeholder="Enter text..."
                className="w-full bg-black/40 border border-gray-700 rounded-md p-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
            <button 
                onClick={handleAddText}
                disabled={!textInput}
                className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded-md text-sm font-medium disabled:opacity-50 transition-colors border border-gray-700"
            >
                <Plus className="w-4 h-4" />
                Add Text Layer
            </button>
            <p className="text-[10px] text-gray-500">Text clips are added to the dedicated Text track.</p>
        </div>
      )}

      {mode === 'stock' && (
          <div className="space-y-3 animate-in fade-in duration-300">
              {showKeyInput && (
                  <div className="bg-gray-800/50 p-2 rounded border border-gray-700 mb-2">
                      <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] text-gray-400">Pexels API Key</label>
                          <a href="https://www.pexels.com/api/" target="_blank" rel="noreferrer" className="text-[10px] text-blue-400 hover:underline">Get Key</a>
                      </div>
                      <div className="flex gap-2">
                        <input 
                            type="password"
                            value={pexelsKey}
                            onChange={(e) => setPexelsKey(e.target.value)}
                            placeholder="Enter key..."
                            className="flex-1 bg-black/40 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
                        />
                        <button onClick={() => savePexelsKey(pexelsKey)} className="bg-gray-700 hover:bg-gray-600 px-2 rounded text-white text-xs">Save</button>
                      </div>
                  </div>
              )}

              <div className="flex gap-2">
                <div className="flex bg-gray-900 rounded p-0.5 flex-1 border border-gray-700">
                     <button onClick={() => { setStockType('image'); setStockResults([]); }} className={clsx("flex-1 text-[10px] rounded py-1", stockType === 'image' ? "bg-gray-700 text-white" : "text-gray-400")}>Photos</button>
                     <button onClick={() => { setStockType('video'); setStockResults([]); }} className={clsx("flex-1 text-[10px] rounded py-1", stockType === 'video' ? "bg-gray-700 text-white" : "text-gray-400")}>Videos</button>
                </div>
                <button onClick={() => setShowKeyInput(!showKeyInput)} className="p-1.5 text-gray-400 hover:text-white bg-gray-800 rounded border border-gray-700"><Key className="w-3.5 h-3.5" /></button>
              </div>

              <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input 
                        type="text"
                        value={stockQuery}
                        onChange={(e) => setStockQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleStockSearch()}
                        placeholder={`Search ${stockType}s...`}
                        className="w-full bg-black/40 border border-gray-700 rounded-md py-1.5 pl-8 pr-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                    />
                    <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2.5" />
                  </div>
                  <button onClick={handleStockSearch} className="bg-blue-600 hover:bg-blue-500 text-white px-3 rounded-md text-sm font-medium"><Search className="w-4 h-4" /></button>
              </div>

              {loading && <div className="text-center py-4 text-gray-500"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-1" />{statusText}</div>}

              {!loading && stockResults.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-1">
                      {stockResults.map((item: any) => (
                          <div key={item.id} className="group relative aspect-video bg-gray-800 rounded overflow-hidden border border-gray-700">
                              <img 
                                src={stockType === 'video' ? item.image : item.src?.medium} 
                                alt="" 
                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                              />
                              <button 
                                onClick={() => handleImportStock(item)}
                                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                  <Download className="w-5 h-5 text-white drop-shadow-md" />
                              </button>
                              {stockType === 'video' && <div className="absolute bottom-1 right-1 text-[8px] bg-black/60 text-white px-1 rounded">{item.duration}s</div>}
                          </div>
                      ))}
                  </div>
              )}
          </div>
      )}
    </div>
  );
};
