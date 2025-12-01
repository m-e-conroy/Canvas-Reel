import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { Clip, Keyframe } from '../../types';
import { X, Trash2, Sliders, Diamond, Plus, RotateCw, Move, Palette, Ban, Layers, Type, Bold, Italic, Hash, FlipHorizontal, FlipVertical } from 'lucide-react';
import clsx from 'clsx';

// ... PropertyControl component ...
interface PropertyControlProps {
  label: string;
  property: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  clip: Clip;
  currentTime: number;
  updateClip: (id: string, updates: Partial<Clip>) => void;
}

const PropertyControl: React.FC<PropertyControlProps> = ({ 
    label, property, value, min = 0, max = 100, step = 1, unit = '', clip, currentTime, updateClip 
}) => {
    const relativeTime = Math.max(0, Math.min(currentTime - clip.startTime, clip.duration));
    const keyframes = clip.keyframes?.[property] || [];
    const hasKeyframes = keyframes.length > 0;

    let displayValue = value;
    if (hasKeyframes) {
        const sorted = [...keyframes].sort((a,b) => a.time - b.time);
        if (relativeTime <= sorted[0].time) displayValue = sorted[0].value;
        else if (relativeTime >= sorted[sorted.length-1].time) displayValue = sorted[sorted.length-1].value;
        else {
             const nextIdx = sorted.findIndex(k => k.time > relativeTime);
             const prev = sorted[nextIdx - 1];
             const next = sorted[nextIdx];
             const r = (relativeTime - prev.time) / (next.time - prev.time);
             displayValue = prev.value + (next.value - prev.value) * r;
        }
    } else {
        // @ts-ignore
        displayValue = clip[property] ?? value; 
    }

    const handleAddKeyframe = () => {
        const newKeyframe: Keyframe = {
            id: crypto.randomUUID(),
            time: relativeTime,
            value: displayValue,
            easing: 'linear'
        };
        const filtered = keyframes.filter(k => Math.abs(k.time - relativeTime) > 0.05);
        const newKeyframes = [...filtered, newKeyframe].sort((a,b) => a.time - b.time);
        updateClip(clip.id, {
            keyframes: { ...clip.keyframes, [property]: newKeyframes }
        });
    };

    const handleValueChange = (newValue: number) => {
        if (hasKeyframes) {
             const newKeyframe: Keyframe = {
                id: crypto.randomUUID(),
                time: relativeTime,
                value: newValue,
                easing: 'linear'
            };
            const filtered = keyframes.filter(k => Math.abs(k.time - relativeTime) > 0.05);
            const newKeyframes = [...filtered, newKeyframe].sort((a,b) => a.time - b.time);
             updateClip(clip.id, {
                keyframes: { ...clip.keyframes, [property]: newKeyframes }
            });
        } else {
            updateClip(clip.id, { [property]: newValue });
        }
    };

    const handleKeyframeDrag = (e: React.MouseEvent, kfId: string) => {
        e.stopPropagation();
        const startX = e.clientX;
        const startKf = keyframes.find(k => k.id === kfId);
        if(!startKf) return;
        const startTime = startKf.time;
        const width = 240; 
        
        const onMove = (mv: MouseEvent) => {
            const deltaX = mv.clientX - startX;
            const deltaT = (deltaX / width) * clip.duration;
            let newTime = Math.max(0, Math.min(clip.duration, startTime + deltaT));
            
            const updated = keyframes.map(k => k.id === kfId ? { ...k, time: newTime } : k);
            updateClip(clip.id, {
                keyframes: { ...clip.keyframes, [property]: updated }
            });
        };
        
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            const currentKfs = (useStore.getState().getClip(clip.id)?.keyframes?.[property] || []);
            const sorted = [...currentKfs].sort((a,b) => a.time - b.time);
             updateClip(clip.id, {
                keyframes: { ...clip.keyframes, [property]: sorted }
            });
        };
        
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    const removeKeyframe = (e: React.MouseEvent, kfId: string) => {
        e.stopPropagation(); 
        e.preventDefault(); 
        const updated = keyframes.filter(k => k.id !== kfId);
        updateClip(clip.id, {
            keyframes: { ...clip.keyframes, [property]: updated }
        });
    };

    return (
        <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500 font-medium">{label}</label>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-blue-400 font-mono w-12 text-right">
                        {displayValue.toFixed(1)}{unit}
                    </span>
                    <button 
                        onClick={handleAddKeyframe}
                        className={clsx(
                            "p-1 rounded hover:bg-gray-700 transition-colors",
                             hasKeyframes ? "text-yellow-500" : "text-gray-400"
                        )}
                        title="Add Keyframe"
                    >
                        <Diamond className={clsx("w-3 h-3 fill-current", hasKeyframes && "animate-pulse")} />
                    </button>
                </div>
            </div>
            
            <input 
                type="range"
                min={min}
                max={max}
                step={step}
                value={displayValue}
                onChange={(e) => handleValueChange(parseFloat(e.target.value))}
                className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer mb-2 accent-blue-600"
            />

            <div className="h-4 bg-gray-900 rounded border border-gray-800 relative w-full overflow-hidden">
                <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                    style={{ left: `${(relativeTime / clip.duration) * 100}%` }}
                />
                {keyframes.map(kf => (
                    <div
                        key={kf.id}
                        onMouseDown={(e) => handleKeyframeDrag(e, kf.id)}
                        onContextMenu={(e) => removeKeyframe(e, kf.id)}
                        className="absolute top-0.5 w-2.5 h-2.5 bg-yellow-500 rotate-45 -ml-1.25 cursor-ew-resize hover:bg-yellow-400 hover:scale-125 transition-transform z-20 border border-black/50"
                        style={{ left: `${(kf.time / clip.duration) * 100}%` }}
                    />
                ))}
            </div>
        </div>
    );
};

const CLIP_COLORS = [
    '#3b82f6', '#22c55e', '#ef4444', '#eab308', 
    '#a855f7', '#ec4899', '#f97316', '#6b7280', 
];

const FONTS = ['Inter', 'Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana'];

export const Inspector: React.FC = () => {
  const { selectedClipIds, getClip, updateClip, removeSelectedClips, deselectAll, currentTime } = useStore();
  
  if (selectedClipIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm p-8 text-center bg-[#1a1a1a] border-l border-gray-800">
        <Sliders className="w-12 h-12 mb-4 opacity-20" />
        <p>Select a clip to view properties</p>
      </div>
    );
  }

  if (selectedClipIds.length > 1) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm p-8 text-center bg-[#1a1a1a] border-l border-gray-800">
        <Layers className="w-12 h-12 mb-4 opacity-20" />
        <p className="font-medium text-gray-200">{selectedClipIds.length} clips selected</p>
        <p className="mt-2 text-xs text-gray-600">Multi-editing properties is not supported in this prototype.</p>
        <button onClick={deselectAll} className="mt-4 text-xs text-blue-400 hover:text-blue-300 underline">
            Clear Selection
        </button>
      </div>
    );
  }

  const clip = getClip(selectedClipIds[0]);
  if (!clip) return null;

  return (
    <div className="h-full bg-[#1a1a1a] border-l border-gray-800 overflow-y-auto custom-scrollbar">
      <div className="h-12 border-b border-gray-800 flex items-center justify-between px-4 bg-[#151515]">
        <h2 className="font-semibold text-sm text-gray-200">Inspector</h2>
        <button onClick={deselectAll} className="text-gray-500 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-6">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Name</label>
          <input 
            type="text" 
            value={clip.name}
            onChange={(e) => updateClip(clip.id, { name: e.target.value })}
            className="w-full bg-black/30 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition-colors mb-3"
          />
          
          {/* Color Palette */}
          <div className="flex items-center gap-2">
             <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                 <Palette className="w-3 h-3" />
             </label>
             <div className="flex gap-1.5 flex-wrap">
                 {CLIP_COLORS.map(color => (
                     <button
                        key={color}
                        onClick={() => updateClip(clip.id, { color })}
                        style={{ backgroundColor: color }}
                        className={clsx(
                            "w-5 h-5 rounded-full border border-gray-600 transition-transform hover:scale-110",
                            clip.color === color && "ring-2 ring-white border-transparent"
                        )}
                        title={color}
                     />
                 ))}
                 <button
                    onClick={() => updateClip(clip.id, { color: undefined })}
                    className="w-5 h-5 rounded-full border border-gray-700 bg-transparent flex items-center justify-center text-gray-500 hover:text-gray-300 hover:border-gray-500 transition-colors"
                    title="Reset Color"
                 >
                     <Ban className="w-3 h-3" />
                 </button>
             </div>
          </div>
        </div>

        {/* --- Text Specific Controls --- */}
        {clip.type === 'text' && (
            <div>
                <h3 className="text-xs font-bold text-gray-400 mb-3 border-b border-gray-800 pb-1">Text Style</h3>
                
                <textarea
                    value={clip.text || ''}
                    onChange={(e) => updateClip(clip.id, { text: e.target.value })}
                    className="w-full h-20 bg-black/30 border border-gray-700 rounded p-2 text-sm text-white mb-3 resize-none focus:border-blue-500 focus:outline-none"
                    placeholder="Enter text..."
                />

                <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Font Family</label>
                        <select
                            value={clip.fontFamily || 'Inter'}
                            onChange={(e) => updateClip(clip.id, { fontFamily: e.target.value })}
                            className="w-full bg-black/30 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none"
                        >
                            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Color</label>
                        <div className="flex gap-2">
                            <input
                                type="color"
                                value={clip.textColor || '#ffffff'}
                                onChange={(e) => updateClip(clip.id, { textColor: e.target.value })}
                                className="h-6 w-full bg-transparent cursor-pointer rounded overflow-hidden"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 mb-3">
                    <button
                        onClick={() => updateClip(clip.id, { isBold: !clip.isBold })}
                        className={clsx("flex-1 py-1.5 border rounded text-xs transition-colors", clip.isBold ? "bg-blue-900/30 border-blue-500 text-blue-200" : "border-gray-700 text-gray-400 hover:bg-gray-800")}
                    >
                        <Bold className="w-3 h-3 mx-auto" />
                    </button>
                    <button
                        onClick={() => updateClip(clip.id, { isItalic: !clip.isItalic })}
                        className={clsx("flex-1 py-1.5 border rounded text-xs transition-colors", clip.isItalic ? "bg-blue-900/30 border-blue-500 text-blue-200" : "border-gray-700 text-gray-400 hover:bg-gray-800")}
                    >
                        <Italic className="w-3 h-3 mx-auto" />
                    </button>
                    <button
                        onClick={() => updateClip(clip.id, { hasShadow: !clip.hasShadow })}
                        className={clsx("flex-1 py-1.5 border rounded text-xs transition-colors", clip.hasShadow ? "bg-blue-900/30 border-blue-500 text-blue-200" : "border-gray-700 text-gray-400 hover:bg-gray-800")}
                    >
                        <Hash className="w-3 h-3 mx-auto" />
                    </button>
                </div>

                {clip.hasShadow && (
                     <div className="mb-3">
                        <label className="block text-xs text-gray-500 mb-1">Shadow Color</label>
                        <input
                            type="color"
                            value={clip.shadowColor || '#000000'}
                            onChange={(e) => updateClip(clip.id, { shadowColor: e.target.value })}
                            className="h-6 w-full bg-transparent cursor-pointer rounded overflow-hidden"
                        />
                     </div>
                )}
                
                <PropertyControl 
                    label="Font Size" property="fontSize" 
                    value={clip.fontSize ?? 40} min={10} max={200} step={1} unit="px"
                    clip={clip} currentTime={currentTime} updateClip={updateClip} 
                />
            </div>
        )}

        {/* --- Timing --- */}
        <div>
            <h3 className="text-xs font-bold text-gray-400 mb-3 border-b border-gray-800 pb-1">Timing</h3>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Start (s)</label>
                    <input 
                        type="number" 
                        step="0.1"
                        value={clip.startTime.toFixed(2)}
                        onChange={(e) => updateClip(clip.id, { startTime: parseFloat(e.target.value) })}
                        className="w-full bg-black/30 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                    />
                </div>
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Duration (s)</label>
                    <input 
                        type="number" 
                        step="0.1"
                        value={clip.duration.toFixed(2)}
                        disabled
                        className="w-full bg-black/30 border border-gray-800 rounded px-2 py-1 text-sm text-gray-500 cursor-not-allowed"
                    />
                </div>
            </div>
        </div>

        {/* --- Transform --- */}
        <div>
            <div className="flex items-center justify-between border-b border-gray-800 pb-1 mb-3">
                <h3 className="text-xs font-bold text-gray-400">Transform & Keyframes</h3>
            </div>
            
            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => updateClip(clip.id, { flipHorizontal: !clip.flipHorizontal })}
                    className={clsx("flex-1 py-1.5 border rounded text-xs transition-colors flex items-center justify-center gap-1", clip.flipHorizontal ? "bg-blue-900/30 border-blue-500 text-blue-200" : "border-gray-700 text-gray-400 hover:bg-gray-800")}
                    title="Flip Horizontally"
                >
                    <FlipHorizontal className="w-3.5 h-3.5" /> Flip H
                </button>
                <button
                    onClick={() => updateClip(clip.id, { flipVertical: !clip.flipVertical })}
                    className={clsx("flex-1 py-1.5 border rounded text-xs transition-colors flex items-center justify-center gap-1", clip.flipVertical ? "bg-blue-900/30 border-blue-500 text-blue-200" : "border-gray-700 text-gray-400 hover:bg-gray-800")}
                    title="Flip Vertically"
                >
                    <FlipVertical className="w-3.5 h-3.5" /> Flip V
                </button>
            </div>

            <PropertyControl 
                label="Opacity" property="opacity" 
                value={clip.opacity ?? 1} min={0} max={1} step={0.01} 
                clip={clip} currentTime={currentTime} updateClip={updateClip} 
            />
            
            <PropertyControl 
                label="Scale" property="scale" 
                value={clip.scale ?? 1} min={0} max={3} step={0.01} unit="x"
                clip={clip} currentTime={currentTime} updateClip={updateClip} 
            />
            
            <PropertyControl 
                label="Rotation" property="rotation" 
                value={clip.rotation ?? 0} min={-360} max={360} step={1} unit="°"
                clip={clip} currentTime={currentTime} updateClip={updateClip} 
            />

            <PropertyControl 
                label="Position X" property="positionX" 
                value={clip.positionX ?? 0} min={-1000} max={1000} step={10} unit="px"
                clip={clip} currentTime={currentTime} updateClip={updateClip} 
            />

            <PropertyControl 
                label="Position Y" property="positionY" 
                value={clip.positionY ?? 0} min={-600} max={600} step={10} unit="px"
                clip={clip} currentTime={currentTime} updateClip={updateClip} 
            />
        </div>

        <div className="pt-4 border-t border-gray-800">
            <button 
                onClick={removeSelectedClips}
                className="w-full flex items-center justify-center gap-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 py-2.5 rounded text-sm transition-colors border border-red-900/30"
            >
                <Trash2 className="w-4 h-4" />
                Delete Selected
            </button>
        </div>
      </div>
    </div>
  );
};