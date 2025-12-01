export interface Asset {
  id: string;
  name: string;
  type: 'video' | 'image' | 'audio';
  src: string; // Object URL
  duration: number; // in seconds
  width?: number;
  height?: number;
}

export interface Clip {
  id: string;
  assetId: string;
  trackId: string;
  startOffset: number; // Offset into the source media (trim start)
  startTime: number; // Start time on the timeline
  duration: number; // Duration of the clip on the timeline
  name: string;
  type: 'video' | 'audio' | 'image';
  // Transform properties
  positionX?: number;
  positionY?: number;
  scale?: number;
}

export interface Track {
  id: string;
  name: string;
  type: 'video' | 'audio';
  clips: Clip[];
  isMuted?: boolean;
  isHidden?: boolean;
}

export interface ProjectState {
  duration: number; // Total timeline duration
  currentTime: number; // Current playhead position in seconds
  isPlaying: boolean;
  zoom: number; // Pixels per second
  selectedClipId: string | null;
}