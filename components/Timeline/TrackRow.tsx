import React from 'react';
import { Track } from '../../types';
import { useStore } from '../../store/useStore';
import { ClipItem } from './ClipItem';
import { Video, Mic, Eye, EyeOff, Volume2, VolumeX } from 'lucide-react';
import clsx from 'clsx';

interface TrackRowProps {
  track: Track;
}

export const TrackRow: React.FC<TrackRowProps> = React.memo(({ track }) => {
  const { zoom, duration, updateTrack } = useStore();

  const toggleMute = () => {
    updateTrack(track.id, { isMuted: !track.isMuted });
  };

  const toggleHidden = () => {
    updateTrack(track.id, { isHidden: !track.isHidden });
  };

  return (
    <div className={clsx("flex border-b border-gray-800 bg-[#151515]", track.isHidden && "opacity-60 grayscale")}>
      {/* Track Header - Sticky Left */}
      {/* z-40 ensures it stays above clips and the playhead line (z-30) */}
      <div className="w-64 shrink-0 bg-[#1a1a1a] border-r border-gray-800 p-3 flex flex-col justify-center gap-2 z-40 sticky left-0 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between text-gray-300">
            <div className="flex items-center gap-2">
                {track.type === 'video' ? <Video className="w-4 h-4 text-blue-400" /> : <Mic className="w-4 h-4 text-green-400" />}
                <span className="text-sm font-medium truncate">{track.name}</span>
            </div>
            <div className="flex gap-1">
                <button 
                  onClick={toggleHidden}
                  className={clsx(
                    "p-1 hover:bg-gray-700 rounded transition-colors",
                    track.isHidden ? "text-gray-500" : "text-gray-300 hover:text-white"
                  )}
                  title={track.isHidden ? "Show Track" : "Hide Track"}
                >
                    {track.isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button 
                  onClick={toggleMute}
                  className={clsx(
                    "p-1 hover:bg-gray-700 rounded transition-colors",
                    track.isMuted ? "text-red-400" : "text-gray-300 hover:text-white"
                  )}
                  title={track.isMuted ? "Unmute Track" : "Mute Track"}
                >
                    {track.isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
            </div>
        </div>
      </div>

      {/* Track Lane */}
      <div className="relative h-24 min-w-full" style={{ width: duration * zoom }}>
        {/* Grid lines background */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#222_1px,transparent_1px)] bg-[size:100px_100%] opacity-20 pointer-events-none" />
        
        {track.clips.map(clip => (
            <ClipItem key={clip.id} clip={clip} />
        ))}
      </div>
    </div>
  );
});