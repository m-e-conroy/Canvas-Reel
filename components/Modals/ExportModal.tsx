
import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { X, Film, Images, Download } from 'lucide-react';
import clsx from 'clsx';

export const ExportModal: React.FC = () => {
  const { 
    isExportModalOpen, 
    setExportModalOpen, 
    duration, 
    selectedClipIds, 
    getClip, 
    startExport,
    exportConfig 
  } = useStore();

  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(duration);
  const [fps, setFps] = useState(30);
  const [format, setFormat] = useState<'png' | 'jpeg'>('png');

  // Auto-fill times based on selection when modal opens
  useEffect(() => {
    if (isExportModalOpen) {
        if (selectedClipIds.length === 1) {
            const clip = getClip(selectedClipIds[0]);
            if (clip) {
                setStartTime(clip.startTime);
                setEndTime(clip.startTime + clip.duration);
            }
        } else {
            setStartTime(0);
            setEndTime(duration);
        }
    }
  }, [isExportModalOpen, selectedClipIds, getClip, duration]);

  if (!isExportModalOpen) return null;

  const handleExport = () => {
    startExport({
        startTime,
        endTime,
        fps,
        format
    });
    // Modal stays open to show progress or closes?
    // Let's close it and show a global progress, or keep it open with progress bar.
    // For this implementation, let's keep it open but disabled while exporting, or close it and show overlay.
    // The PlayerCanvas handles the export logic. We'll close this modal and show an overlay in the editor or just close it.
    setExportModalOpen(false);
  };

  const frameCount = Math.floor((endTime - startTime) * fps);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-2xl w-[400px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#151515]">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Images className="w-4 h-4 text-blue-400" />
                Export Frames
            </h2>
            <button onClick={() => setExportModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
            </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Start Time (s)</label>
                    <input 
                        type="number" 
                        step="0.1"
                        min="0"
                        max={endTime}
                        value={startTime}
                        onChange={(e) => setStartTime(parseFloat(e.target.value))}
                        className="w-full bg-black/30 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">End Time (s)</label>
                    <input 
                        type="number" 
                        step="0.1"
                        min={startTime}
                        max={duration}
                        value={endTime}
                        onChange={(e) => setEndTime(parseFloat(e.target.value))}
                        className="w-full bg-black/30 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Frame Rate (FPS)</label>
                    <select
                        value={fps}
                        onChange={(e) => setFps(parseInt(e.target.value))}
                        className="w-full bg-black/30 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                    >
                        <option value="1">1 fps</option>
                        <option value="10">10 fps</option>
                        <option value="12">12 fps (Animation)</option>
                        <option value="24">24 fps (Cinema)</option>
                        <option value="30">30 fps (Video)</option>
                        <option value="60">60 fps (Smooth)</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Format</label>
                    <div className="flex bg-gray-900 rounded p-1 border border-gray-700">
                        <button 
                            onClick={() => setFormat('png')}
                            className={clsx("flex-1 text-xs rounded py-0.5", format === 'png' ? "bg-gray-700 text-white" : "text-gray-400")}
                        >
                            PNG
                        </button>
                        <button 
                            onClick={() => setFormat('jpeg')}
                            className={clsx("flex-1 text-xs rounded py-0.5", format === 'jpeg' ? "bg-gray-700 text-white" : "text-gray-400")}
                        >
                            JPEG
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-gray-800/50 rounded p-3 border border-gray-800 text-xs text-gray-400">
                <p>Total Frames: <span className="text-white font-mono">{frameCount > 0 ? frameCount : 0}</span></p>
                <p className="mt-1">Each frame will be exported as an image file and bundled into a ZIP archive.</p>
            </div>

            <button
                onClick={handleExport}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-md text-sm font-medium transition-all shadow-lg shadow-blue-900/20"
            >
                <Download className="w-4 h-4" />
                Export Frames
            </button>
        </div>
      </div>
    </div>
  );
};
