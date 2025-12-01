import React, { useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import { db } from '../../services/db';
import { Upload, FileVideo, Music, Image as ImageIcon, Loader2, Sparkles, AlertCircle, Type, Plus } from 'lucide-react';
import { Asset } from '../../types';
import { GoogleGenAI } from "@google/genai";
import clsx from 'clsx';

export const AssetUploader: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addAsset, addClip, tracks } = useStore();
  
  const [mode, setMode] = useState<'upload' | 'generate' | 'text'>('upload');
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');

  // Generation State
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');

  // Text State
  const [textInput, setTextInput] = useState('New Text Layer');

  const processFile = async (file: File) => {
      const type = file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'image';
      const id = crypto.randomUUID();
      
      // Store in Dexie
      await db.assets.add({
        id,
        name: file.name,
        type,
        blob: file,
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
    // Find first video track (usually index 0 is top)
    const track = tracks.find(t => t.type === 'video');
    if (!track) {
        alert("No video track found to place text.");
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
           onClick={() => setMode('generate')}
           className={clsx("flex-1 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5", mode === 'generate' ? "bg-gradient-to-r from-blue-700 to-purple-700 text-white shadow-sm" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800")}
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
            <p className="text-[10px] text-gray-500">Text clips are added to the first video track.</p>
        </div>
      )}
    </div>
  );
};