import React from 'react';
import { useStore } from '../../store/useStore';
import { Play, Pause, SkipBack, SkipForward, MonitorUp } from 'lucide-react';

export const PlayerControls: React.FC = () => {
  const { isPlaying, setIsPlaying, currentTime, setCurrentTime, duration } = useStore();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${ms.toString().padStart(2, '0')}`;
  };

  const handleExport = () => {
      // Mock Export
      alert("Export Feature Prototype:\n\nIn a production environment, this would initialize FFmpeg.wasm, load the blobs from IndexedDB, generate an FFmpeg command based on the Timeline tracks/clips, and render the output file.\n\nRequired headers: Cross-Origin-Embedder-Policy: require-corp");
  };

  return (
    <div className="h-14 bg-gray-900 border-t border-gray-800 flex items-center justify-between px-4">
      <div className="flex items-center gap-2 w-32">
        <span className="text-blue-400 font-mono text-lg font-medium">{formatTime(currentTime)}</span>
        <span className="text-gray-600 font-mono text-sm">/ {formatTime(duration)}</span>
      </div>

      <div className="flex items-center gap-4">
        <button 
            onClick={() => setCurrentTime(0)}
            className="text-gray-400 hover:text-white transition-colors"
        >
          <SkipBack className="w-5 h-5" />
        </button>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-colors shadow-lg shadow-blue-900/20"
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
        </button>
        <button 
             onClick={() => setCurrentTime(Math.min(duration, currentTime + 5))}
             className="text-gray-400 hover:text-white transition-colors"
        >
          <SkipForward className="w-5 h-5" />
        </button>
      </div>

      <div className="w-32 flex justify-end">
        <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-blue-400 text-xs font-bold uppercase rounded border border-gray-700 transition-colors"
        >
            <MonitorUp className="w-3 h-3" />
            Export
        </button>
      </div>
    </div>
  );
};