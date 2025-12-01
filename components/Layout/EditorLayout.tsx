
import React from 'react';
import { AssetList } from '../AssetLibrary/AssetList';
import { AssetUploader } from '../AssetLibrary/AssetUploader';
import { PlayerCanvas } from '../Player/PlayerCanvas';
import { PlayerControls } from '../Player/PlayerControls';
import { Timeline } from '../Timeline/Timeline';
import { Inspector } from '../Inspector/Inspector';
import { Film, MonitorPlay, Scissors, Trash2, ZoomIn, ZoomOut, Copy, Group, Ungroup, Link, Unlink, Flag } from 'lucide-react';
import { useStore } from '../../store/useStore';

export const EditorLayout: React.FC = () => {
  const { 
    splitClip, 
    removeSelectedClips, 
    duplicateSelectedClips,
    groupSelectedClips,
    ungroupSelectedClips,
    addMarker,
    currentTime,
    selectedClipIds, 
    zoom, 
    setZoom 
  } = useStore();

  const handleZoomIn = () => setZoom(Math.min(200, zoom * 1.2));
  const handleZoomOut = () => setZoom(Math.max(1, zoom / 1.2));
  
  const handleAddMarker = () => {
      addMarker({
          id: crypto.randomUUID(),
          time: currentTime,
          label: 'Marker',
          color: '#eab308'
      });
  };

  const hasSelection = selectedClipIds.length > 0;
  const hasMultiple = selectedClipIds.length > 1;

  return (
    <div className="flex flex-col h-screen w-full bg-[#0f0f0f] text-gray-200 overflow-hidden">
      {/* Top Section: Assets & Player & Inspector */}
      <div className="flex flex-1 min-h-0">
        
        {/* Left Sidebar: Assets */}
        <div className="w-80 flex flex-col border-r border-gray-800 bg-[#121212]">
          <div className="h-10 border-b border-gray-800 flex items-center px-4 gap-2.5 bg-[#151515]">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-600 to-blue-700 rounded flex items-center justify-center shadow-lg shadow-blue-900/20 border border-blue-500/30">
               <Film className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-sm tracking-wide text-gray-100">
              Canvas<span className="text-blue-500">Reel</span>
            </span>
          </div>
          <AssetUploader />
          <AssetList />
        </div>

        {/* Center: Player */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#000]">
          <PlayerCanvas />
          <PlayerControls />
        </div>

        {/* Right Sidebar: Inspector */}
        <div className="w-72 bg-[#121212]">
          <Inspector />
        </div>
      </div>

      {/* Bottom Section: Timeline */}
      <div className="h-[40vh] border-t border-gray-800 flex flex-col min-h-[200px]">
        {/* Timeline Toolbar */}
        <div className="h-10 bg-[#151515] border-b border-gray-800 flex items-center justify-between px-3 shrink-0">
            <div className="flex items-center gap-4">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Timeline</span>
                
                <div className="h-4 w-px bg-gray-700" />
                
                {/* Edit Tools */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={splitClip}
                        disabled={!hasSelection}
                        title="Split Clip (S)"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <Scissors className="w-3.5 h-3.5" />
                    </button>
                    
                    <button
                        onClick={duplicateSelectedClips}
                        disabled={!hasSelection}
                        title="Duplicate Clip"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <Copy className="w-3.5 h-3.5" />
                    </button>
                    
                    <div className="h-4 w-px bg-gray-700 mx-1" />

                    <button
                        onClick={groupSelectedClips}
                        disabled={!hasMultiple}
                        title="Group Clips"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <Link className="w-3.5 h-3.5" />
                    </button>

                    <button
                        onClick={ungroupSelectedClips}
                        disabled={!hasSelection}
                        title="Ungroup Clips"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <Unlink className="w-3.5 h-3.5" />
                    </button>

                     <div className="h-4 w-px bg-gray-700 mx-1" />

                    <button
                        onClick={removeSelectedClips}
                        disabled={!hasSelection}
                        title="Delete Clip (Del)"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-gray-300 hover:text-red-400 hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Right Side Tools */}
            <div className="flex items-center gap-2">
                 <button 
                    onClick={handleAddMarker}
                    title="Add Marker (M)"
                    className="p-1.5 text-yellow-500 hover:text-yellow-400 hover:bg-gray-700 rounded transition-colors"
                >
                    <Flag className="w-4 h-4" />
                </button>
                
                <div className="h-4 w-px bg-gray-700 mx-1" />

                <button 
                    onClick={handleZoomOut}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                >
                    <ZoomOut className="w-4 h-4" />
                </button>
                <div className="w-20 px-2 text-center text-xs text-gray-500 font-mono select-none">
                    {Math.round(zoom)}px/s
                </div>
                <button 
                    onClick={handleZoomIn}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                >
                    <ZoomIn className="w-4 h-4" />
                </button>
            </div>
        </div>
        
        <div className="flex-1 relative min-h-0">
            <Timeline />
        </div>
      </div>
    </div>
  );
};
