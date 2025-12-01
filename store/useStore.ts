
import { create } from 'zustand';
import { Asset, Clip, Track } from '../types';

interface DraggedClipState {
  clipId: string;
  initialStartTime: number;
  initialTrackId: string;
  initialDuration: number;
  initialStartOffset: number;
}

interface DragSession {
  mode: 'move' | 'resize-left' | 'resize-right';
  startX: number;
  primaryClipId: string; // The specific clip being interacted with
  draggedClips: DraggedClipState[]; // All clips moving (selection or group)
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
  selectedClipIds: string[];
  activeDrag: DragSession | null;

  // Actions
  addAsset: (asset: Asset) => void;
  addTrack: (track: Track) => void;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  addClip: (clip: Clip) => void;
  updateClip: (id: string, updates: Partial<Clip>) => void;
  
  // Multi-Selection Actions
  selectClip: (id: string, toggle?: boolean, multi?: boolean) => void;
  deselectAll: () => void;
  
  // Editing Actions
  splitClip: () => void;
  removeClip: (id: string) => void;
  removeSelectedClips: () => void;
  duplicateSelectedClips: () => void;
  groupSelectedClips: () => void;
  ungroupSelectedClips: () => void;

  setTracks: (tracks: Track[]) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setZoom: (zoom: number) => void;
  
  // Drag Actions
  startDrag: (clipId: string, mode: DragSession['mode'], startX: number) => void;
  stopDrag: () => void;
  
  // Helpers
  getClip: (id: string) => Clip | undefined;
}

// Initial Mock Data
const initialTracks: Track[] = [
  { id: 'track-text', name: 'Text Overlay', type: 'text', clips: [] },
  { id: 'track-1', name: 'Video 1', type: 'video', clips: [] },
  { id: 'track-2', name: 'Video 2', type: 'video', clips: [] },
  { id: 'track-3', name: 'Audio 1', type: 'audio', clips: [] },
];

export const useStore = create<EditorState>((set, get) => ({
  assets: [],
  tracks: initialTracks,
  currentTime: 0,
  duration: 300, 
  isPlaying: false,
  zoom: 10, 
  selectedClipIds: [],
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

  selectClip: (id, toggle = false) => set((state) => {
    // 1. Find the clip and check for Group ID
    let groupIdsToSelect = [id];
    let clipGroup: string | undefined;
    
    // Helper to find clip
    for (const t of state.tracks) {
        const c = t.clips.find(clip => clip.id === id);
        if (c) {
            clipGroup = c.groupId;
            break;
        }
    }

    // If part of a group, select all group members
    if (clipGroup) {
        state.tracks.forEach(t => {
            t.clips.forEach(c => {
                if (c.groupId === clipGroup) {
                    if (!groupIdsToSelect.includes(c.id)) groupIdsToSelect.push(c.id);
                }
            });
        });
    }

    if (toggle) {
        // Toggle logic
        const current = new Set(state.selectedClipIds);
        const allSelected = groupIdsToSelect.every(gid => current.has(gid));
        
        if (allSelected) {
            groupIdsToSelect.forEach(gid => current.delete(gid));
        } else {
            groupIdsToSelect.forEach(gid => current.add(gid));
        }
        return { selectedClipIds: Array.from(current) };
    } else {
        // Exclusive select
        return { selectedClipIds: groupIdsToSelect };
    }
  }),

  deselectAll: () => set({ selectedClipIds: [] }),

  updateClip: (id, updates) => set((state) => {
    // If trackId is changing, we need to move the clip between arrays
    if (updates.trackId !== undefined) {
      const currentClip = get().getClip(id);
      if (!currentClip || currentClip.trackId === updates.trackId) {
        // Simple update
        const newTracks = state.tracks.map(t => ({
          ...t,
          clips: t.clips.map(c => c.id === id ? { ...c, ...updates } : c)
        }));
        return { tracks: newTracks };
      } 

      // Moving tracks
      let clipToMove: Clip | null = null;
      
      const tracksAfterRemove = state.tracks.map(t => {
        const found = t.clips.find(c => c.id === id);
        if (found) {
          clipToMove = found;
          return { ...t, clips: t.clips.filter(c => c.id !== id) };
        }
        return t;
      });

      if (!clipToMove) return {};

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
    const { selectedClipIds, currentTime } = state;
    if (selectedClipIds.length === 0) return {};

    let newTracks = [...state.tracks];
    let newSelection: string[] = [];

    // Process all selected clips
    selectedClipIds.forEach(clipId => {
        newTracks = newTracks.map(track => {
            const clipIndex = track.clips.findIndex(c => c.id === clipId);
            if (clipIndex === -1) return track;
      
            const clip = track.clips[clipIndex];
      
            // Validate cut point
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
              // Keep groupId if present, so split parts stay grouped? 
              // Usually split parts stay in the group.
              groupId: clip.groupId 
            };
      
            const updatedOriginalClip = {
              ...clip,
              duration: splitDelta
            };
      
            const newClips = [...track.clips];
            newClips[clipIndex] = updatedOriginalClip;
            newClips.splice(clipIndex + 1, 0, newClip);
            
            // We lose selection of original, but maybe select both?
            // Let's just deselect to avoid confusion or keep logic simple
            return { ...track, clips: newClips };
        });
    });

    return { tracks: newTracks, selectedClipIds: [] };
  }),

  removeClip: (id) => set((state) => {
    const newTracks = state.tracks.map(t => ({
      ...t,
      clips: t.clips.filter(c => c.id !== id)
    }));
    return { tracks: newTracks, selectedClipIds: state.selectedClipIds.filter(sid => sid !== id) };
  }),

  removeSelectedClips: () => set((state) => {
      const newTracks = state.tracks.map(t => ({
          ...t,
          clips: t.clips.filter(c => !state.selectedClipIds.includes(c.id))
      }));
      return { tracks: newTracks, selectedClipIds: [] };
  }),

  duplicateSelectedClips: () => set((state) => {
      const newTracks = [...state.tracks];
      const newSelection: string[] = [];

      state.selectedClipIds.forEach(id => {
          // Locate clip
          for (let i = 0; i < newTracks.length; i++) {
              const track = newTracks[i];
              const clip = track.clips.find(c => c.id === id);
              if (clip) {
                  const newClip: Clip = {
                      ...clip,
                      id: crypto.randomUUID(),
                      startTime: clip.startTime + clip.duration, // Place immediately after
                      groupId: undefined // Don't auto-group duplicates with original
                  };
                  // Add to track
                  track.clips.push(newClip);
                  newSelection.push(newClip.id);
                  break; 
              }
          }
      });
      
      // Update tracks and select the new copies
      return { tracks: newTracks, selectedClipIds: newSelection };
  }),

  groupSelectedClips: () => set((state) => {
      if (state.selectedClipIds.length < 2) return {};
      const newGroupId = crypto.randomUUID();
      
      const newTracks = state.tracks.map(t => ({
          ...t,
          clips: t.clips.map(c => state.selectedClipIds.includes(c.id) ? { ...c, groupId: newGroupId } : c)
      }));
      return { tracks: newTracks };
  }),

  ungroupSelectedClips: () => set((state) => {
      if (state.selectedClipIds.length === 0) return {};
      
      const newTracks = state.tracks.map(t => ({
          ...t,
          clips: t.clips.map(c => state.selectedClipIds.includes(c.id) ? { ...c, groupId: undefined } : c)
      }));
      return { tracks: newTracks };
  }),

  setTracks: (tracks) => set({ tracks }),
  setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setZoom: (zoom) => set({ zoom }),

  startDrag: (clipId, mode, startX) => set((state) => {
      // Logic: 
      // If clipId is in selectedClipIds, move ALL selected clips.
      // If clipId is NOT in selection, we probably should have selected it on mousedown, 
      // but if not, treat it as single drag (or auto-select it).
      // Assuming MouseDown handled selection:
      
      const isSelected = state.selectedClipIds.includes(clipId);
      const clipsToDragIds = isSelected ? state.selectedClipIds : [clipId];

      const draggedClips: DraggedClipState[] = [];

      state.tracks.forEach(track => {
          track.clips.forEach(clip => {
              if (clipsToDragIds.includes(clip.id)) {
                  draggedClips.push({
                      clipId: clip.id,
                      initialStartTime: clip.startTime,
                      initialTrackId: clip.trackId,
                      initialDuration: clip.duration,
                      initialStartOffset: clip.startOffset
                  });
              }
          });
      });

      return {
          activeDrag: {
              mode,
              startX,
              primaryClipId: clipId,
              draggedClips
          }
      };
  }),

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
