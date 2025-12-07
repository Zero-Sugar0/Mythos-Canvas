import React, { useState, useEffect } from 'react';
import { editImage, generateImage, generateImageVariations, editImageVariations } from '../services/geminiService';
import { ImageHistoryItem } from '../types';

type StudioMode = 'CREATE' | 'EDIT';

interface Props {
    initialImage?: ImageHistoryItem | null;
}

const SUGGESTIONS = {
  CREATE: [
    { label: "Cyberpunk City", prompt: "A futuristic cyberpunk city with neon lights, rain-slicked streets, towering skyscrapers, cinematic lighting, highly detailed, 8k resolution." },
    { label: "Fantasy Landscape", prompt: "Epic fantasy landscape, floating islands, waterfalls, ancient ruins, magical atmosphere, vibrant colors, digital art style." },
    { label: "Studio Portrait", prompt: "Professional studio portrait of a futuristic astronaut, soft lighting, sharp focus, detailed texture, bokeh background." },
    { label: "Oil Painting", prompt: "Oil painting style, thick impasto brushstrokes, textured canvas, vibrant sunset over the ocean, impressionist style." },
    { label: "3D Isometric", prompt: "Isometric 3D render of a cozy magical library, low poly style, soft lighting, pastel colors, blender 3d." },
    { label: "Noir Detective", prompt: "Black and white noir style, detective standing in the rain, dramatic shadows, cinematic composition, mystery atmosphere." }
  ],
  EDIT: [
    { label: "Cyberpunk Filter", prompt: "Make it look like a cyberpunk scene with neon lights and glitch effects." },
    { label: "Watercolor", prompt: "Transform into a watercolor painting style." },
    { label: "Pencil Sketch", prompt: "Convert to a detailed pencil sketch." },
    { label: "Remove Background", prompt: "Remove the background and replace it with a white studio backdrop." },
    { label: "Add Snow", prompt: "Add heavy snowfall and winter atmosphere." },
    { label: "Golden Hour", prompt: "Change the lighting to a warm golden hour sunset." }
  ]
};

const ASPECT_RATIOS = [
    { label: 'Square (1:1)', value: '1:1', icon: 'crop_square' },
    { label: 'Landscape (16:9)', value: '16:9', icon: 'crop_16_9' },
    { label: 'Portrait (9:16)', value: '9:16', icon: 'crop_portrait' },
    { label: 'Standard (4:3)', value: '4:3', icon: 'crop_landscape' }, 
    { label: 'Tall (3:4)', value: '3:4', icon: 'crop_portrait' } 
];

export const ImageStudio: React.FC<Props> = ({ initialImage }) => {
  const [mode, setMode] = useState<StudioMode>('CREATE');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [variations, setVariations] = useState<string[]>([]);
  const [variationCount, setVariationCount] = useState<1 | 4>(1);
  const [gallery, setGallery] = useState<ImageHistoryItem[]>([]);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  
  // Advanced Editing State
  const [adjustments, setAdjustments] = useState({ brightness: 100, contrast: 100, saturation: 100 });

  // Delete Confirmation State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Zoom & Pan State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem('mythos_image_history');
    if (saved) {
      try {
        setGallery(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse image history", e);
      }
    }
  }, []);

  // Handle Initial Image from Library (props)
  useEffect(() => {
      if (initialImage) {
          loadFromGallery(initialImage);
      }
  }, [initialImage]);

  // Reset zoom on new image
  useEffect(() => {
      setZoom(1);
      setPan({ x: 0, y: 0 });
  }, [resultImage]);

  const resetAdjustments = () => setAdjustments({ brightness: 100, contrast: 100, saturation: 100 });

  // Reset adjustments when a new file is selected
  useEffect(() => {
      resetAdjustments();
  }, [selectedFile, previewUrl]);

  const saveToGallery = (imageData: string, usedPrompt: string, usedMode: StudioMode) => {
      // Check if duplicate (simple check)
      if (gallery.some(g => g.imageData === imageData)) return;

      const newItem: ImageHistoryItem = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          prompt: usedPrompt,
          imageData: imageData,
          mode: usedMode,
          aspectRatio: aspectRatio
      };
      
      const newGallery = [newItem, ...gallery];
      // Limit to 20 images to prevent localStorage quota issues
      if (newGallery.length > 20) newGallery.pop();
      
      setGallery(newGallery);
      try {
        localStorage.setItem('mythos_image_history', JSON.stringify(newGallery));
      } catch (e) {
        console.error("Storage full", e);
      }
  };

  const confirmDelete = () => {
      if (!deleteId) return;
      const newGallery = gallery.filter(g => g.id !== deleteId);
      setGallery(newGallery);
      localStorage.setItem('mythos_image_history', JSON.stringify(newGallery));
      setDeleteId(null);
  };

  const requestDelete = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setDeleteId(id);
  };

  const loadFromGallery = (item: ImageHistoryItem) => {
      // Standard Load: Show as result
      setResultImage(item.imageData);
      setPrompt(item.prompt);
      setMode(item.mode);
      setVariations([]);
      if (item.aspectRatio) setAspectRatio(item.aspectRatio);
      
      // If we are loading an EDIT mode item, we likely want to continue editing it (chaining).
      // Or if the user wants to refine the previous output.
      if (item.mode === 'EDIT') {
          setPreviewUrl(item.imageData);
          setSelectedFile(null);
      }

      window.scrollTo(0, 0);
  };
  
  const handleRefine = (e: React.MouseEvent, item: ImageHistoryItem) => {
      e.stopPropagation();
      // Refine/Remix Flow
      setMode('EDIT');
      setPrompt(item.prompt);
      setPreviewUrl(item.imageData);
      setSelectedFile(null); // Clear file as we are using base64
      if (item.aspectRatio) setAspectRatio(item.aspectRatio);
      resetAdjustments();
      // Scroll to input
      window.scrollTo(0, 0);
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target?.result as string);
      reader.readAsDataURL(file);
      setResultImage(null);
      setVariations([]);
    }
  };

  // Generate a processed base64 string including CSS filters if applied
  const getProcessedImage = async (): Promise<string> => {
      if (!previewUrl) return "";
      
      // If default adjustments, return original
      if (adjustments.brightness === 100 && adjustments.contrast === 100 && adjustments.saturation === 100) {
          return previewUrl;
      }

      return new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = "Anonymous";
          img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                  // Apply filters
                  ctx.filter = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturation}%)`;
                  ctx.drawImage(img, 0, 0, img.width, img.height);
                  // Return base64
                  resolve(canvas.toDataURL(selectedFile?.type || 'image/png'));
              } else {
                  resolve(previewUrl);
              }
          };
          img.onerror = () => resolve(previewUrl);
          img.src = previewUrl;
      });
  };

  const handleAction = async () => {
    if (!prompt) return;
    if (mode === 'EDIT' && !previewUrl) return;
    
    setIsGenerating(true);
    setResultImage(null);
    setVariations([]);
    
    try {
      let results: string[] = [];
      
      if (mode === 'CREATE') {
        if (variationCount > 1) {
            results = await generateImageVariations(prompt, aspectRatio, variationCount);
        } else {
            const single = await generateImage(prompt, aspectRatio);
            results = [single];
        }
      } else {
        // Prepare image (File or Base64 from Canvas)
        const imageToProcess = await getProcessedImage();

        if (variationCount > 1) {
            results = await editImageVariations(imageToProcess, prompt, aspectRatio, variationCount);
        } else {
            const single = await editImage(imageToProcess, prompt, aspectRatio);
            results = [single];
        }
      }

      setResultImage(results[0]);
      if (results.length > 1) {
          setVariations(results);
      }
      // Auto-save the first result
      saveToGallery(results[0], prompt, mode);
    } catch (error) {
      alert(`Failed to ${mode === 'CREATE' ? 'generate' : 'process'} image. Please try again.`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Zoom/Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
        e.preventDefault();
        setIsDragging(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
        e.preventDefault();
        setPan({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const adjustZoom = (delta: number) => {
      setZoom(prev => {
          const newZoom = Math.max(1, Math.min(5, prev + delta));
          if (newZoom === 1) setPan({ x: 0, y: 0 });
          return newZoom;
      });
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 animate-fade-in relative">
      
      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-brand-800 border border-brand-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl transform scale-100 transition-all">
             <div className="text-center mb-4">
               <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                 <span className="material-symbols-outlined text-red-500 text-2xl">delete_forever</span>
               </div>
               <h3 className="text-xl font-bold text-white mb-2">Delete Image?</h3>
               <p className="text-sm text-gray-400">This action cannot be undone. The image will be permanently removed from your library.</p>
             </div>
             <div className="flex gap-3">
               <button 
                 onClick={() => setDeleteId(null)}
                 className="flex-1 py-3 rounded-xl bg-brand-700 text-white font-medium hover:bg-brand-600 transition-colors"
               >
                 Cancel
               </button>
               <button 
                 onClick={confirmDelete}
                 className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors shadow-lg hover:shadow-red-500/30"
               >
                 Delete
               </button>
             </div>
          </div>
        </div>
      )}

      <div className="text-center mb-6 md:mb-8">
        <h2 className="text-2xl md:text-3xl font-serif text-white mb-2 flex items-center justify-center gap-2 md:gap-3">
            <span className="material-symbols-outlined text-brand-gold text-3xl md:text-4xl">palette</span>
            Canvas Studio
        </h2>
        <p className="text-sm md:text-base text-gray-400">Powered by advanced vision AI. Create new worlds or transform existing ones.</p>
      </div>

      {/* Mode Toggle */}
      <div className="flex justify-center mb-6 md:mb-8">
        <div className="bg-brand-800 p-1 rounded-full border border-brand-700 flex">
            <button 
                onClick={() => { setMode('CREATE'); setResultImage(null); setVariations([]); }}
                className={`px-4 py-2 md:px-6 md:py-2 rounded-full text-xs md:text-sm font-bold transition-all flex items-center gap-1 md:gap-2 ${mode === 'CREATE' ? 'bg-brand-accent text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
                <span className="material-symbols-outlined text-base md:text-sm">brush</span> Create
            </button>
            <button 
                onClick={() => { setMode('EDIT'); setResultImage(null); setVariations([]); }}
                className={`px-4 py-2 md:px-6 md:py-2 rounded-full text-xs md:text-sm font-bold transition-all flex items-center gap-1 md:gap-2 ${mode === 'EDIT' ? 'bg-brand-gold text-brand-900 shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
                <span className="material-symbols-outlined text-base md:text-sm">auto_fix_high</span> Edit
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mb-8 md:mb-12">
        {/* Input Section */}
        <div className="bg-brand-800 p-4 md:p-6 rounded-2xl border border-brand-700 h-fit">
            <h3 className="text-lg md:text-xl font-medium text-white mb-4">
                {mode === 'CREATE' ? 'Describe your vision' : 'Source & Instruction'}
            </h3>
            
            {mode === 'EDIT' && (
                <div className="mb-6 space-y-4">
                    {/* Image Preview & Upload */}
                    <div className="border-2 border-dashed border-brand-700 rounded-xl h-48 md:h-64 flex flex-col items-center justify-center bg-brand-900/50 hover:border-brand-accent transition-colors relative overflow-hidden group">
                        {previewUrl ? (
                            <img 
                                src={previewUrl} 
                                alt="Preview" 
                                className="h-full w-full object-contain"
                                style={{
                                    filter: `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturation}%)`
                                }} 
                            />
                        ) : (
                            <div className="text-center p-6 pointer-events-none">
                                <span className="material-symbols-outlined text-4xl text-gray-500 mb-2">upload_file</span>
                                <p className="text-xs md:text-sm text-gray-400">Click to upload or drag & drop</p>
                            </div>
                        )}
                        <input 
                            type="file" 
                            accept="image/*"
                            onChange={handleFileSelect}
                            className="absolute inset-0 opacity-0 cursor-pointer" 
                        />
                    </div>

                    {/* Advanced Adjustments Sliders */}
                    {previewUrl && (
                        <div className="bg-brand-900/50 p-4 rounded-xl border border-brand-700/50">
                            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-3 flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">tune</span> Adjustment Tools
                            </p>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-gray-400 text-sm">light_mode</span>
                                    <input 
                                        type="range" min="50" max="150" value={adjustments.brightness} 
                                        onChange={(e) => setAdjustments({...adjustments, brightness: Number(e.target.value)})}
                                        className="w-full accent-brand-accent h-1 bg-brand-700 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-gray-400 text-sm">contrast</span>
                                    <input 
                                        type="range" min="50" max="150" value={adjustments.contrast} 
                                        onChange={(e) => setAdjustments({...adjustments, contrast: Number(e.target.value)})}
                                        className="w-full accent-brand-accent h-1 bg-brand-700 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-gray-400 text-sm">invert_colors</span>
                                    <input 
                                        type="range" min="0" max="200" value={adjustments.saturation} 
                                        onChange={(e) => setAdjustments({...adjustments, saturation: Number(e.target.value)})}
                                        className="w-full accent-brand-accent h-1 bg-brand-700 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                                <div className="flex justify-end">
                                    <button onClick={resetAdjustments} className="text-[10px] text-brand-gold hover:underline">Reset</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div>
                <label className="block text-xs md:text-sm text-gray-400 mb-2">
                    {mode === 'CREATE' ? 'Generation Prompt' : 'Editing Instruction'}
                </label>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={mode === 'CREATE' ? "A futuristic cyberpunk city with neon lights..." : "Add a retro filter, Remove background..."}
                    className="w-full bg-brand-900 border border-brand-700 rounded-lg px-3 py-3 md:px-4 text-white text-sm md:text-base focus:outline-none focus:border-brand-accent resize-none h-24 md:h-32"
                />
                
                {/* Suggestions Section */}
                <div className="mt-4 mb-4">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">lightbulb</span> 
                        {mode === 'CREATE' ? 'Creative Ideas' : 'Edit Suggestions'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {SUGGESTIONS[mode].map((s) => (
                            <button
                                key={s.label}
                                onClick={() => setPrompt(s.prompt)}
                                className="text-[10px] md:text-[11px] bg-brand-900/50 hover:bg-brand-700 border border-brand-700/50 hover:border-brand-accent/50 text-gray-400 hover:text-white px-2 py-1 md:px-3 md:py-1.5 rounded-lg transition-all"
                                title={s.prompt}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Settings Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Aspect Ratio Selector */}
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2 flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">aspect_ratio</span> 
                            Aspect Ratio
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                            {ASPECT_RATIOS.slice(0, 3).map((ratio) => (
                                <button
                                    key={ratio.value}
                                    onClick={() => setAspectRatio(ratio.value)}
                                    className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${aspectRatio === ratio.value ? 'bg-brand-700 border-brand-accent text-white' : 'bg-brand-900/50 border-brand-700 text-gray-400 hover:border-gray-500 hover:text-gray-300'}`}
                                >
                                    <span className="material-symbols-outlined text-base md:text-lg mb-1">{ratio.icon}</span>
                                    <span className="text-[10px] font-bold">{ratio.value}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Variation Count */}
                    <div>
                         <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2 flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">filter_none</span> 
                            Variations
                        </p>
                        <div className="flex bg-brand-900/50 p-1 rounded-lg border border-brand-700 h-[66px]">
                             <button 
                                onClick={() => setVariationCount(1)}
                                className={`flex-1 rounded-md flex flex-col items-center justify-center text-[10px] font-bold gap-1 transition-all ${variationCount === 1 ? 'bg-brand-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
                             >
                                 <span className="material-symbols-outlined text-lg">image</span>
                                 1 Image
                             </button>
                             <button 
                                onClick={() => setVariationCount(4)}
                                className={`flex-1 rounded-md flex flex-col items-center justify-center text-[10px] font-bold gap-1 transition-all ${variationCount === 4 ? 'bg-brand-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
                             >
                                 <span className="material-symbols-outlined text-lg">grid_view</span>
                                 4 Variations
                             </button>
                        </div>
                    </div>
                </div>
                
                <button
                    onClick={handleAction}
                    disabled={(!prompt || (mode === 'EDIT' && !previewUrl) || isGenerating)}
                    className="w-full mt-2 bg-brand-accent hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-3 md:px-6 md:py-4 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-lg text-sm md:text-base active:scale-95 transform duration-150"
                >
                    {isGenerating ? (
                        <>
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            {variationCount > 1 ? `Generating ${variationCount} Variations...` : 'Processing...'}
                        </>
                    ) : (
                        <>
                            <span className="material-symbols-outlined">{mode === 'CREATE' ? 'auto_awesome' : 'auto_fix_high'}</span>
                            {mode === 'CREATE' ? 'Generate Art' : 'Transform Image'}
                        </>
                    )}
                </button>
            </div>
        </div>

        {/* Output Section */}
        <div className="bg-brand-800 p-4 md:p-6 rounded-2xl border border-brand-700 flex flex-col min-h-[300px] md:min-h-[500px]">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg md:text-xl font-medium text-white">Canvas Result</h3>
                <div className="flex gap-2">
                    {resultImage && (
                         <button 
                            onClick={() => {
                                setMode('EDIT');
                                setPreviewUrl(resultImage);
                                setSelectedFile(null);
                                window.scrollTo(0,0);
                            }}
                            className="text-xs flex items-center gap-1 text-gray-400 hover:text-white transition-colors bg-brand-700 px-3 py-1.5 rounded-lg border border-brand-600"
                            title="Use as input for editing"
                         >
                             <span className="material-symbols-outlined text-sm">auto_fix_high</span> Refine
                         </button>
                    )}
                    {resultImage && (
                        <button 
                            onClick={() => saveToGallery(resultImage!, prompt, mode)}
                            className="text-xs flex items-center gap-1 text-gray-400 hover:text-brand-gold transition-colors active:scale-90 bg-brand-900/50 px-3 py-1.5 rounded-lg border border-brand-700"
                            title="Save to Gallery"
                        >
                            <span className="material-symbols-outlined text-sm">bookmark_add</span> Save
                        </button>
                    )}
                </div>
            </div>
            
            {/* Main Preview with Zoom/Pan */}
            <div 
                className="flex-1 bg-black/40 rounded-xl flex items-center justify-center border border-brand-700 overflow-hidden relative group mb-4 select-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                {resultImage ? (
                    <>
                        <img 
                            src={resultImage} 
                            alt="Generated" 
                            className={`max-w-full max-h-[400px] object-contain shadow-2xl ${isDragging ? 'duration-0' : 'duration-200 ease-out transition-transform'}`}
                            style={{ 
                                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                                cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
                            }}
                            draggable={false}
                        />
                        
                        {/* Zoom Controls Overlay */}
                        <div className="absolute bottom-4 left-4 flex gap-1 bg-black/60 backdrop-blur-md rounded-lg p-1 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-xl">
                            <button 
                                onClick={(e) => { e.stopPropagation(); adjustZoom(-0.5); }}
                                className="w-7 h-7 flex items-center justify-center hover:bg-white/20 rounded-md text-white disabled:opacity-30 transition-colors"
                                disabled={zoom <= 1}
                                title="Zoom Out"
                            >
                                <span className="material-symbols-outlined text-lg">remove</span>
                            </button>
                            <span className="text-[10px] text-white font-mono flex items-center px-1 min-w-[3.5ch] justify-center">
                                {Math.round(zoom * 100)}%
                            </span>
                            <button 
                                onClick={(e) => { e.stopPropagation(); adjustZoom(0.5); }}
                                className="w-7 h-7 flex items-center justify-center hover:bg-white/20 rounded-md text-white disabled:opacity-30 transition-colors"
                                disabled={zoom >= 5}
                                title="Zoom In"
                            >
                                <span className="material-symbols-outlined text-lg">add</span>
                            </button>
                            <div className="w-px bg-white/20 mx-1 my-1"></div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setZoom(1); setPan({x:0,y:0}); }}
                                className="w-7 h-7 flex items-center justify-center hover:bg-white/20 rounded-md text-white transition-colors"
                                title="Reset Zoom"
                            >
                                <span className="material-symbols-outlined text-lg">restart_alt</span>
                            </button>
                        </div>

                        <a 
                            href={resultImage} 
                            download={`mythos_canvas_${Date.now()}.png`}
                            className="absolute bottom-4 right-4 bg-brand-900/90 text-white p-3 rounded-full hover:bg-black transition-colors backdrop-blur-sm border border-brand-700 shadow-lg active:scale-90 transform z-10"
                            title="Download"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <span className="material-symbols-outlined">download</span>
                        </a>
                    </>
                ) : isGenerating ? (
                    <div className="text-center">
                         <div className="w-12 h-12 md:w-16 md:h-16 border-4 border-brand-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                         <p className="text-brand-accent animate-pulse font-serif text-base md:text-lg">
                             {mode === 'CREATE' ? 'Painting pixels...' : 'Applying magic...'}
                         </p>
                    </div>
                ) : (
                    <div className="text-center text-gray-600">
                        <span className="material-symbols-outlined text-5xl md:text-6xl mb-2 opacity-20">image</span>
                        <p className="italic text-sm">Your creation will appear here</p>
                    </div>
                )}
            </div>

            {/* Variations Strip */}
            {variations.length > 0 && (
                <div className="animate-fade-in">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">Variations</p>
                    <div className="grid grid-cols-4 gap-2">
                        {variations.map((v, idx) => (
                            <div 
                                key={idx} 
                                onClick={() => setResultImage(v)}
                                className={`aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all relative group ${resultImage === v ? 'border-brand-accent ring-2 ring-brand-accent/30' : 'border-transparent hover:border-gray-500'}`}
                            >
                                <img src={v} alt={`Variation ${idx+1}`} className="w-full h-full object-cover" />
                                {resultImage === v && (
                                    <div className="absolute inset-0 bg-brand-accent/20 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-white drop-shadow-md">check_circle</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* Gallery Section */}
      <div className="border-t border-brand-700 pt-6 md:pt-8">
          <h3 className="text-lg md:text-xl font-serif text-white mb-4 md:mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-brand-gold">collections</span>
              Recent Creations
          </h3>
          {gallery.length === 0 ? (
              <p className="text-gray-500 italic text-sm">No images generated yet.</p>
          ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                  {gallery.map((item) => (
                      <div 
                          key={item.id} 
                          className="group relative bg-brand-800 rounded-lg border border-brand-700 overflow-hidden aspect-square hover:border-brand-accent transition-all cursor-pointer"
                          onClick={() => loadFromGallery(item)}
                      >
                          <img src={item.imageData} alt={item.prompt} className="w-full h-full object-cover opacity-80 md:opacity-70 group-hover:opacity-100 transition-opacity" />
                          
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 md:p-3">
                               <p className="text-white text-xs truncate mb-1 font-bold">{item.mode === 'CREATE' ? 'Generated' : 'Edited'}</p>
                               <p className="text-gray-300 text-[10px] line-clamp-2 leading-tight hidden md:block">{item.prompt}</p>
                          </div>

                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button 
                                onClick={(e) => handleRefine(e, item)}
                                className="bg-brand-gold text-brand-900 p-1.5 rounded-full shadow-lg hover:bg-white transition-colors"
                                title="Refine/Edit"
                             >
                                 <span className="material-symbols-outlined text-xs font-bold">auto_fix_high</span>
                             </button>
                             <button 
                                onClick={(e) => requestDelete(e, item.id)}
                                className="bg-black/50 hover:bg-red-500/80 text-white p-1.5 rounded-full backdrop-blur-sm transition-colors"
                                title="Delete"
                             >
                                 <span className="material-symbols-outlined text-xs">delete</span>
                             </button>
                          </div>
                      </div>
                  ))}
              </div>
          )}
      </div>
    </div>
  );
};