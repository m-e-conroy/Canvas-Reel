import React, { useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { Play, Pause, SkipBack, SkipForward, MonitorUp } from 'lucide-react';

export const PlayerControls: React.FC = () => {
  const { isPlaying, setIsPlaying, currentTime, setCurrentTime, duration, splitClip, removeSelectedClips, selectedClipIds } = useStore();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${ms.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Split shortcut 'S'
      if (e.key.toLowerCase() === 's' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && (e.target as HTMLElement).tagName !== 'INPUT') {
         splitClip();
      }
      
      // Delete shortcut 'Delete' or 'Backspace'
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClipIds.length > 0 && (e.target as HTMLElement).tagName !== 'INPUT') {
          removeSelectedClips();
      }
      
      // Toggle Playback 'Space'
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault(); // Prevent scrolling
        setIsPlaying(!isPlaying);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [splitClip, isPlaying, setIsPlaying, selectedClipIds, removeSelectedClips]);

  const handleExport = () => {
      // Mock Export
      alert("Export Feature Prototype:\n\nIn a production environment, this would initialize FFmpeg.wasm, load the blobs from IndexedDB, generate an FFmpeg command based on the Timeline tracks/clips, and render the output file.\n\nRequired headers: Cross-Origin-Embedder-Policy: require-corp");
  };

  return (
    <div className="h-14 bg-gray-900 border-t border-gray-800 flex items-center justify-between px-4 overflow-hidden">
      {/* Left: Time */}
      <div className="flex flex-1 items-center gap-4 min-w-0">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-blue-400 font-mono text-lg font-medium w-[8ch]">{formatTime(currentTime)}</span>
          <span className="text-gray-600 font-mono text-sm">/ {formatTime(duration)}</span>
        </div>
      </div>

      {/* Center: Transport Controls */}
      <div className="flex items-center gap-6 justify-center shrink-0">
        <button 
            onClick={() => setCurrentTime(0)}
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-full"
            title="Jump to Start"
        >
          <SkipBack className="w-5 h-5" />
        </button>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-all shadow-lg shadow-blue-900/40 active:scale-95"
        >
          {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
        </button>
        <button 
             onClick={() => setCurrentTime(Math.min(duration, currentTime + 5))}
             className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-full"
             title="Jump Forward 5s"
        >
          <SkipForward className="w-5 h-5" />
        </button>
      </div>

      {/* Right: Export */}
      <div className="flex-1 flex justify-end min-w-0">
        <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-blue-400 text-xs font-bold uppercase rounded border border-gray-700 transition-colors whitespace-nowrap"
        >
            <MonitorUp className="w-4 h-4" />
            Export Video
        </button>
      </div>
    </div>
  );
};