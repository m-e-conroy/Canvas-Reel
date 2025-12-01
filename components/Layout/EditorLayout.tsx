import React from 'react';
import { AssetList } from '../AssetLibrary/AssetList';
import { AssetUploader } from '../AssetLibrary/AssetUploader';
import { PlayerCanvas } from '../Player/PlayerCanvas';
import { PlayerControls } from '../Player/PlayerControls';
import { Timeline } from '../Timeline/Timeline';
import { Inspector } from '../Inspector/Inspector';

export const EditorLayout: React.FC = () => {
  return (
    <div className="flex flex-col h-screen w-full bg-[#0f0f0f] text-gray-200 overflow-hidden">
      {/* Top Section: Assets & Player & Inspector */}
      <div className="flex flex-1 min-h-0">
        
        {/* Left Sidebar: Assets */}
        <div className="w-80 flex flex-col border-r border-gray-800 bg-[#121212]">
          <div className="h-10 border-b border-gray-800 flex items-center px-4 font-semibold text-sm tracking-wide">
            BrowserNLE
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
        <div className="h-8 bg-[#151515] border-b border-gray-800 flex items-center px-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-2">Timeline</span>
        </div>
        <div className="flex-1 relative min-h-0">
            <Timeline />
        </div>
      </div>
    </div>
  );
};