import React, { useState, useEffect } from 'react';
import { editImage, generateImage } from '../services/geminiService';
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

export const ImageStudio: React.FC<Props> = ({ initialImage }) => {
  const [mode, setMode] = useState<StudioMode>('CREATE');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [gallery, setGallery] = useState<ImageHistoryItem[]>([]);

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

  // Handle Initial Image from Library
  useEffect(() => {
      if (initialImage) {
          setResultImage(initialImage.imageData);
          setPrompt(initialImage.prompt);
          setMode(initialImage.mode);
          // Scroll to top
          window.scrollTo(0, 0);
      }
  }, [initialImage]);

  const saveToGallery = (imageData: string, usedPrompt: string, usedMode: StudioMode) => {
      const newItem: ImageHistoryItem = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          prompt: usedPrompt,
          imageData: imageData,
          mode: usedMode
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

  const deleteFromGallery = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const newGallery = gallery.filter(g => g.id !== id);
      setGallery(newGallery);
      localStorage.setItem('mythos_image_history', JSON.stringify(newGallery));
  };

  const loadFromGallery = (item: ImageHistoryItem) => {
      if (mode === 'EDIT') {
          // If in edit mode, use this image as the source
          setPreviewUrl(item.imageData);
          // Need to convert base64 to File object if we want to submit it to the API again
          // But for now, just visual preview. The API service expects a File. 
          // We can convert base64 to blob to file.
          fetch(item.imageData)
            .then(res => res.blob())
            .then(blob => {
                const file = new File([blob], "loaded_image.png", { type: "image/png" });
                setSelectedFile(file);
            });
      } else {
          // If in create mode, just show it as a result
          setResultImage(item.imageData);
          setPrompt(item.prompt);
      }
      window.scrollTo(0, 0);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target?.result as string);
      reader.readAsDataURL(file);
      setResultImage(null);
    }
  };

  const handleAction = async () => {
    if (!prompt) return;
    if (mode === 'EDIT' && !selectedFile) return;
    
    setIsGenerating(true);
    setResultImage(null);
    
    try {
      let result;
      if (mode === 'CREATE') {
        result = await generateImage(prompt);
      } else {
        result = await editImage(selectedFile!, prompt);
      }
      setResultImage(result);
      saveToGallery(result, prompt, mode);
    } catch (error) {
      alert(`Failed to ${mode === 'CREATE' ? 'generate' : 'process'} image. Please try again.`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 animate-fade-in">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-serif text-white mb-2 flex items-center justify-center gap-3">
            <span className="material-symbols-outlined text-brand-gold text-4xl">image_edit_auto</span>
            Canvas Studio
        </h2>
        <p className="text-gray-400">Powered by advanced vision AI. Create new worlds or transform existing ones.</p>
      </div>

      {/* Mode Toggle */}
      <div className="flex justify-center mb-8">
        <div className="bg-brand-800 p-1 rounded-full border border-brand-700 flex">
            <button 
                onClick={() => { setMode('CREATE'); setResultImage(null); }}
                className={`px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${mode === 'CREATE' ? 'bg-brand-accent text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
                <span className="material-symbols-outlined text-sm">brush</span> Create New
            </button>
            <button 
                onClick={() => { setMode('EDIT'); setResultImage(null); }}
                className={`px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${mode === 'EDIT' ? 'bg-brand-gold text-brand-900 shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
                <span className="material-symbols-outlined text-sm">auto_fix_high</span> Edit Image
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* Input Section */}
        <div className="bg-brand-800 p-6 rounded-2xl border border-brand-700 h-fit">
            <h3 className="text-xl font-medium text-white mb-4">
                {mode === 'CREATE' ? 'Describe your vision' : 'Source & Instruction'}
            </h3>
            
            {mode === 'EDIT' && (
                <div className="border-2 border-dashed border-brand-700 rounded-xl h-64 flex flex-col items-center justify-center bg-brand-900/50 hover:border-brand-accent transition-colors relative overflow-hidden group mb-6">
                    {previewUrl ? (
                        <img src={previewUrl} alt="Preview" className="h-full w-full object-contain" />
                    ) : (
                        <div className="text-center p-6 pointer-events-none">
                            <span className="material-symbols-outlined text-4xl text-gray-500 mb-2">upload_file</span>
                            <p className="text-sm text-gray-400">Click to upload or drag & drop</p>
                        </div>
                    )}
                    <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                    />
                </div>
            )}

            <div>
                <label className="block text-sm text-gray-400 mb-2">
                    {mode === 'CREATE' ? 'Generation Prompt' : 'Editing Instruction'}
                </label>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={mode === 'CREATE' ? "A futuristic cyberpunk city with neon lights..." : "Add a retro filter, Remove background..."}
                    className="w-full bg-brand-900 border border-brand-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-accent resize-none h-32"
                />
                
                {/* Suggestions Section */}
                <div className="mt-4 mb-2">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">lightbulb</span> 
                        {mode === 'CREATE' ? 'Creative Ideas' : 'Edit Suggestions'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {SUGGESTIONS[mode].map((s) => (
                            <button
                                key={s.label}
                                onClick={() => setPrompt(s.prompt)}
                                className="text-[11px] bg-brand-900/50 hover:bg-brand-700 border border-brand-700/50 hover:border-brand-accent/50 text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition-all"
                                title={s.prompt}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>
                
                <button
                    onClick={handleAction}
                    disabled={(!prompt || (mode === 'EDIT' && !selectedFile) || isGenerating)}
                    className="w-full mt-4 bg-brand-accent hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-4 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-lg"
                >
                    {isGenerating ? (
                        <>
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            Processing...
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
        <div className="bg-brand-800 p-6 rounded-2xl border border-brand-700 flex flex-col min-h-[500px]">
            <h3 className="text-xl font-medium text-white mb-4">Canvas Result</h3>
            <div className="flex-1 bg-black/40 rounded-xl flex items-center justify-center border border-brand-700 overflow-hidden relative group">
                {resultImage ? (
                    <img src={resultImage} alt="Generated" className="max-w-full max-h-full object-contain shadow-2xl" />
                ) : isGenerating ? (
                    <div className="text-center">
                         <div className="w-16 h-16 border-4 border-brand-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                         <p className="text-brand-accent animate-pulse font-serif text-lg">
                             {mode === 'CREATE' ? 'Painting pixels...' : 'Applying magic...'}
                         </p>
                    </div>
                ) : (
                    <div className="text-center text-gray-600">
                        <span className="material-symbols-outlined text-6xl mb-2 opacity-20">image</span>
                        <p className="italic">Your creation will appear here</p>
                    </div>
                )}
                
                {resultImage && (
                    <a 
                        href={resultImage} 
                        download={`mythos_canvas_${Date.now()}.png`}
                        className="absolute bottom-4 right-4 bg-brand-900/90 text-white p-3 rounded-full hover:bg-black transition-colors backdrop-blur-sm border border-brand-700 shadow-lg"
                        title="Download"
                    >
                        <span className="material-symbols-outlined">download</span>
                    </a>
                )}
            </div>
        </div>
      </div>

      {/* Gallery Section */}
      <div className="border-t border-brand-700 pt-8">
          <h3 className="text-xl font-serif text-white mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-brand-gold">collections</span>
              Recent Creations
          </h3>
          {gallery.length === 0 ? (
              <p className="text-gray-500 italic text-sm">No images generated yet.</p>
          ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {gallery.map((item) => (
                      <div 
                          key={item.id} 
                          className="group relative bg-brand-800 rounded-lg border border-brand-700 overflow-hidden aspect-square hover:border-brand-accent transition-all cursor-pointer"
                          onClick={() => loadFromGallery(item)}
                      >
                          <img src={item.imageData} alt={item.prompt} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                          
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                               <p className="text-white text-xs truncate mb-1 font-bold">{item.mode === 'CREATE' ? 'Generated' : 'Edited'}</p>
                               <p className="text-gray-300 text-[10px] line-clamp-2 leading-tight">{item.prompt}</p>
                          </div>

                          <button 
                              onClick={(e) => deleteFromGallery(e, item.id)}
                              className="absolute top-2 right-2 bg-black/50 hover:bg-red-500/80 text-white p-1.5 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all"
                              title="Delete"
                          >
                              <span className="material-symbols-outlined text-xs">delete</span>
                          </button>
                      </div>
                  ))}
              </div>
          )}
      </div>
    </div>
  );
};