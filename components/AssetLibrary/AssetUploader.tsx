import React, { useRef } from 'react';
import { useStore } from '../../store/useStore';
import { db } from '../../services/db';
import { Upload, FileVideo, Music, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Asset } from '../../types';

export const AssetUploader: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addAsset = useStore((state) => state.addAsset);
  const [loading, setLoading] = React.useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setLoading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const type = file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'image';
      const id = crypto.randomUUID();
      
      // Store in Dexie
      await db.assets.add({
        id,
        name: file.name,
        type,
        blob: file,
        createdAt: Date.now()
      });

      // Create Object URL for preview
      const url = URL.createObjectURL(file);
      
      // Get duration for video/audio
      let duration = 5; // Default for images
      let width = 0;
      let height = 0;

      if (type === 'video' || type === 'audio') {
        const media = document.createElement(type === 'video' ? 'video' : 'audio');
        media.src = url;
        await new Promise((resolve) => {
          media.onloadedmetadata = () => {
            duration = media.duration;
            if (type === 'video') {
              width = (media as HTMLVideoElement).videoWidth;
              height = (media as HTMLVideoElement).videoHeight;
            }
            resolve(true);
          };
        });
      }

      const newAsset: Asset = {
        id,
        name: file.name,
        type: type as 'video' | 'audio' | 'image',
        src: url,
        duration,
        width,
        height
      };

      addAsset(newAsset);
    }
    
    setLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-4 border-b border-gray-800">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        multiple
        accept="video/*,audio/*,image/*"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded text-sm font-medium transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        Import Media
      </button>
    </div>
  );
};