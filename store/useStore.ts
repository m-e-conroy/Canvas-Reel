import { create } from 'zustand';
import { Asset, Clip, Track } from '../types';

interface EditorState {
  // Data
  assets: Asset[];
  tracks: Track[];
  
  // Playback State
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  zoom: number; // Pixels per second
  
  // Selection
  selectedClipId: string | null;

  // Actions
  addAsset: (asset: Asset) => void;
  addTrack: (track: Track) => void;
  addClip: (clip: Clip) => void;
  updateClip: (id: string, updates: Partial<Clip>) => void;
  removeClip: (id: string) => void;
  setTracks: (tracks: Track[]) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setZoom: (zoom: number) => void;
  setSelectedClipId: (id: string | null) => void;
  
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

  addAsset: (asset) => set((state) => ({ assets: [...state.assets, asset] })),
  
  addTrack: (track) => set((state) => ({ tracks: [...state.tracks, track] })),
  
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
    const newTracks = state.tracks.map(t => ({
      ...t,
      clips: t.clips.map(c => c.id === id ? { ...c, ...updates } : c)
    }));
    return { tracks: newTracks };
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

  getClip: (id) => {
    const state = get();
    for (const track of state.tracks) {
      const clip = track.clips.find(c => c.id === id);
      if (clip) return clip;
    }
    return undefined;
  }
}));