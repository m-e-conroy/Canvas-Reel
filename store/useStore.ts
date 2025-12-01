import { create } from 'zustand';
import { Asset, Clip, Track } from '../types';

interface DragSession {
  clipId: string;
  mode: 'move' | 'resize-left' | 'resize-right';
  startX: number;
  initialStartTime: number;
  initialDuration: number;
  initialStartOffset: number;
  initialTrackId: string;
}

interface EditorState {
  // Data
  assets: Asset[];
  tracks: Track[];
  
  // Playback State
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  zoom: number; // Pixels per second
  
  // Selection & Interaction
  selectedClipId: string | null;
  activeDrag: DragSession | null;

  // Actions
  addAsset: (asset: Asset) => void;
  addTrack: (track: Track) => void;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  addClip: (clip: Clip) => void;
  updateClip: (id: string, updates: Partial<Clip>) => void;
  splitClip: () => void;
  removeClip: (id: string) => void;
  setTracks: (tracks: Track[]) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setZoom: (zoom: number) => void;
  setSelectedClipId: (id: string | null) => void;
  
  // Drag Actions
  startDrag: (session: DragSession) => void;
  stopDrag: () => void;
  
  // Helpers
  getClip: (id: string) => Clip | undefined;
}

// Initial Mock Data
const initialTracks: Track[] = [
  { id: 'track-1', name: 'Video 1', type: 'video', clips: [] },
  { id: 'track-2', name: 'Video 2', type: 'video', clips: [] },
  { id: 'track-3', name: 'Audio 1', type: 'audio', clips: [] },
];

export const useStore = create<EditorState>((set, get) => ({
  assets: [],
  tracks: initialTracks,
  currentTime: 0,
  duration: 300, // 5 minutes default
  isPlaying: false,
  zoom: 10, // 10px per second default
  selectedClipId: null,
  activeDrag: null,

  addAsset: (asset) => set((state) => ({ assets: [...state.assets, asset] })),
  
  addTrack: (track) => set((state) => ({ tracks: [...state.tracks, track] })),
  
  updateTrack: (id, updates) => set((state) => ({
    tracks: state.tracks.map(t => t.id === id ? { ...t, ...updates } : t)
  })),

  addClip: (clip) => set((state) => {
    const newTracks = state.tracks.map(t => {
      if (t.id === clip.trackId) {
        return { ...t, clips: [...t.clips, clip] };
      }
      return t;
    });
    return { tracks: newTracks };
  }),

  updateClip: (id, updates) => set((state) => {
    // If trackId is changing, we need to move the clip between arrays
    if (updates.trackId !== undefined) {
      const currentClip = get().getClip(id);
      if (!currentClip || currentClip.trackId === updates.trackId) {
        // Simple update if trackId isn't changing or clip invalid
        const newTracks = state.tracks.map(t => ({
          ...t,
          clips: t.clips.map(c => c.id === id ? { ...c, ...updates } : c)
        }));
        return { tracks: newTracks };
      } 

      // Moving tracks
      let clipToMove: Clip | null = null;
      
      // 1. Remove from old track
      const tracksAfterRemove = state.tracks.map(t => {
        const found = t.clips.find(c => c.id === id);
        if (found) {
          clipToMove = found;
          return { ...t, clips: t.clips.filter(c => c.id !== id) };
        }
        return t;
      });

      if (!clipToMove) return {}; // Should not happen

      // 2. Add to new track with updates
      const updatedClip = { ...clipToMove, ...updates } as Clip;
      
      const tracksAfterAdd = tracksAfterRemove.map(t => {
        if (t.id === updates.trackId) {
          return { ...t, clips: [...t.clips, updatedClip] };
        }
        return t;
      });

      return { tracks: tracksAfterAdd };
    }

    // Standard in-place update
    const newTracks = state.tracks.map(t => ({
      ...t,
      clips: t.clips.map(c => c.id === id ? { ...c, ...updates } : c)
    }));
    return { tracks: newTracks };
  }),

  splitClip: () => set((state) => {
    const { selectedClipId, currentTime } = state;
    if (!selectedClipId) return {};

    const newTracks = state.tracks.map(track => {
      const clipIndex = track.clips.findIndex(c => c.id === selectedClipId);
      if (clipIndex === -1) return track;

      const clip = track.clips[clipIndex];

      if (currentTime <= clip.startTime + 0.1 || currentTime >= clip.startTime + clip.duration - 0.1) {
        return track;
      }

      const splitDelta = currentTime - clip.startTime;

      const newClip: Clip = {
        ...clip,
        id: crypto.randomUUID(),
        startTime: currentTime,
        startOffset: clip.startOffset + splitDelta,
        duration: clip.duration - splitDelta,
        name: clip.name
      };

      const updatedOriginalClip = {
        ...clip,
        duration: splitDelta
      };

      const newClips = [...track.clips];
      newClips[clipIndex] = updatedOriginalClip;
      newClips.splice(clipIndex + 1, 0, newClip);

      return { ...track, clips: newClips };
    });

    return { tracks: newTracks, selectedClipId: null };
  }),

  removeClip: (id) => set((state) => {
    const newTracks = state.tracks.map(t => ({
      ...t,
      clips: t.clips.filter(c => c.id !== id)
    }));
    return { tracks: newTracks, selectedClipId: state.selectedClipId === id ? null : state.selectedClipId };
  }),

  setTracks: (tracks) => set({ tracks }),
  setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setZoom: (zoom) => set({ zoom }),
  setSelectedClipId: (id) => set({ selectedClipId: id }),

  startDrag: (session) => set({ activeDrag: session }),
  stopDrag: () => set({ activeDrag: null }),

  getClip: (id) => {
    const state = get();
    for (const track of state.tracks) {
      const clip = track.clips.find(c => c.id === id);
      if (clip) return clip;
    }
    return undefined;
  }
}));