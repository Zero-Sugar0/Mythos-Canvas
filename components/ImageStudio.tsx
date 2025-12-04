import React, { useState } from 'react';
import { editImage, generateImage } from '../services/geminiService';

type StudioMode = 'CREATE' | 'EDIT';

export const ImageStudio: React.FC = () => {
  const [mode, setMode] = useState<StudioMode>('CREATE');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);

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
    } catch (error) {
      alert(`Failed to ${mode === 'CREATE' ? 'generate' : 'process'} image. Please try again.`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 animate-fade-in">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
            <div className="flex-1 bg-black/40 rounded-xl flex items-center justify-center border border-brand-700 overflow-hidden relative">
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
                        className="absolute bottom-4 right-4 bg-brand-900/90 text-white p-3 rounded-full hover:bg-black transition-colors backdrop-blur-sm border border-brand-700"
                        title="Download"
                    >
                        <span className="material-symbols-outlined">download</span>
                    </a>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};