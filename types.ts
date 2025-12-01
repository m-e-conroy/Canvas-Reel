
export interface Asset {
  id: string;
  name: string;
  type: 'video' | 'image' | 'audio';
  src: string; // Object URL
  thumbnail?: string; // Object URL for preview
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

export type TransitionType = 
  | 'none' 
  | 'fade' 
  | 'slide-left' // Enters from right, moving left
  | 'slide-right' // Enters from left, moving right
  | 'slide-up' // Enters from bottom, moving up
  | 'slide-down' // Enters from top, moving down
  | 'wipe-left' // Reveals right to left
  | 'wipe-right' // Reveals left to right
  | 'wipe-up' // Reveals bottom to top
  | 'wipe-down'; // Reveals top to bottom

export interface Transition {
  type: TransitionType;
  duration: number;
}

export interface Clip {
  id: string;
  assetId: string;
  trackId: string;
  startOffset: number; // Offset into the source media (trim start)
  startTime: number; // Start time on the timeline
  duration: number; // Duration of the clip on the timeline
  name: string;
  type: 'video' | 'audio' | 'image' | 'text';
  color?: string; // Hex code for custom clip color
  groupId?: string; // ID for grouping multiple clips together
  
  // Visibility & Audio
  muted?: boolean;
  visible?: boolean;

  // Transform properties
  positionX?: number;
  positionY?: number;
  scale?: number;
  rotation?: number; // Degrees
  opacity?: number; // 0-1
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  
  // Transitions
  transition?: Transition;

  // Keyframes
  keyframes?: Record<string, Keyframe[]>; // e.g. { "scale": [...], "opacity": [...] }

  // Masking
  mask?: {
    isEnabled: boolean;
    type: 'circle' | 'rectangle';
    centerX: number; // 0-1 relative to clip width
    centerY: number; // 0-1 relative to clip height
    size: number; // 0-1 relative to clip smallest dimension
    feather: number; // 0-100 blur amount
  };

  // Text Properties
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  textColor?: string;
  isBold?: boolean;
  isItalic?: boolean;
  
  // Shadow Properties
  hasShadow?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
}

export interface Track {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'text';
  clips: Clip[];
  isMuted?: boolean;
  isHidden?: boolean;
}

export interface Marker {
  id: string;
  time: number;
  label: string;
  color: string;
  notes?: string;
}

export interface ProjectState {
  duration: number; // Total timeline duration
  currentTime: number; // Current playhead position in seconds
  isPlaying: boolean;
  zoom: number; // Pixels per second
  selectedClipIds: string[];
}
