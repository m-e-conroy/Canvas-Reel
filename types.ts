export interface Asset {
  id: string;
  name: string;
  type: 'video' | 'image' | 'audio';
  src: string; // Object URL
  duration: number; // in seconds
  width?: number;
  height?: number;
}

export interface Keyframe {
  id: string;
  time: number; // Relative to clip start (seconds)
  value: number;
  easing?: 'linear'; 
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
  color?: string; // Hex code for custom clip color
  groupId?: string; // ID for grouping multiple clips together
  
  // Transform properties
  positionX?: number;
  positionY?: number;
  scale?: number;
  rotation?: number; // Degrees
  opacity?: number; // 0-1
  
  // Keyframes
  keyframes?: Record<string, Keyframe[]>; // e.g. { "scale": [...], "opacity": [...] }
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
  selectedClipIds: string[];
}