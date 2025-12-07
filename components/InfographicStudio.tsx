import React, { useState, useRef, useEffect } from 'react';
import { structureInfographicData, generateImage } from '../services/geminiService';
import { InfographicItem } from '../types';
import { jsPDF } from 'jspdf';

const USE_CASES = [
    { id: 'custom', label: 'Custom / Scratch', desc: 'Define your own topic.', prompt: '', style: 'Swiss' },
    { id: 'linkedin', label: 'LinkedIn Carousel', desc: 'Professional slides for social media.', prompt: 'Create a thought leadership carousel about: ', style: 'Corporate Minimalism' },
    { id: 'executive', label: 'Executive Summary', desc: 'High-level decisions and metrics.', prompt: 'Summarize these meeting notes into key decisions: ', style: 'Swiss' },
    { id: 'flashcards', label: 'Educational Flashcards', desc: 'Visual learning aids.', prompt: 'Create study flashcards for: ', style: 'Flat 2.5D' },
    { id: 'pitch', label: 'Startup Pitch Deck', desc: 'Problem, Solution, Market.', prompt: 'Visualize a pitch deck for a startup that does: ', style: 'Neo-Futuristic' },
    { id: 'onboarding', label: 'Onboarding Guide', desc: 'Step-by-step process.', prompt: 'Create an onboarding workflow for: ', style: 'Hand Drawn' },
    { id: 'book', label: 'Book Summary', desc: 'Key takeaways and metaphors.', prompt: 'Visualize the key concepts of the book: ', style: 'Swiss' },
    { id: 'recipe', label: 'Recipe Visuals', desc: 'Ingredients and cooking steps.', prompt: 'Create a visual recipe guide for: ', style: 'Hand Drawn' },
    { id: 'features', label: 'Feature Highlights', desc: 'Product capabilities.', prompt: 'Showcase the features of: ', style: 'Corporate Minimalism' },
    { id: 'travel', label: 'Travel Itinerary', desc: 'Locations and activities.', prompt: 'Visual itinerary for a trip to: ', style: 'Flat 2.5D' },
    { id: 'goals', label: 'Goal Visualization', desc: 'Vision board style.', prompt: 'Visualize these personal goals: ', style: 'Neo-Futuristic' },
];

const STYLES = [
    { id: 'Swiss', label: 'Swiss', desc: 'Bold typography, grids, high contrast.', icon: 'grid_view' },
    { id: 'Corporate Minimalism', label: 'Tech Minimal', desc: 'Clean lines, blue accents, flat.', icon: 'business' },
    { id: 'Hand Drawn', label: 'Sketchy', desc: 'Organic lines, marker texture.', icon: 'draw' },
    { id: 'Neo-Futuristic', label: 'Cyber', desc: 'Neon glows, dark mode, geometry.', icon: 'hub' },
    { id: 'Flat 2.5D', label: 'Isometric', desc: '3D depth, soft shadows, cute.', icon: 'view_in_ar' },
    { id: 'Custom', label: 'Custom', desc: 'Define your own aesthetic.', icon: 'edit' }
];

const ASPECT_RATIOS = [
    { label: 'Slide (16:9)', value: '16:9', icon: 'crop_16_9' },
    { label: 'Card (4:3)', value: '4:3', icon: 'crop_landscape' },
    { label: 'Square (1:1)', value: '1:1', icon: 'crop_square' },
    { label: 'Story (9:16)', value: '9:16', icon: 'crop_portrait' },
];

const CHART_TYPES = [
    { id: 'Bar', label: 'Bar Chart', icon: 'bar_chart' },
    { id: 'Line', label: 'Line Chart', icon: 'show_chart' },
    { id: 'Pie', label: 'Pie Chart', icon: 'pie_chart' },
    { id: 'Area', label: 'Area Chart', icon: 'area_chart' },
];

export const InfographicStudio: React.FC = () => {
    const [mode, setMode] = useState<'VISUAL' | 'CHART'>('VISUAL');
    const [inputText, setInputText] = useState('');
    const [selectedStyle, setSelectedStyle] = useState(STYLES[0].id);
    const [customStylePrompt, setCustomStylePrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState('16:9');
    const [useCase, setUseCase] = useState(USE_CASES[0].id);
    const [isPlanning, setIsPlanning] = useState(false);
    const [items, setItems] = useState<InfographicItem[]>([]);
    const [fileName, setFileName] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Chart Options
    const [chartType, setChartType] = useState<string>('Bar');
    const [xAxisLabel, setXAxisLabel] = useState('');
    const [yAxisLabel, setYAxisLabel] = useState('');

    // Mobile View State
    const [mobileTab, setMobileTab] = useState<'EDITOR' | 'RESULTS'>('EDITOR');

    // Presentation Mode State
    const [slideIndex, setSlideIndex] = useState<number | null>(null);

    const handleUseCaseChange = (id: string) => {
        setUseCase(id);
        const uc = USE_CASES.find(u => u.id === id);
        if (uc) {
            setInputText(uc.prompt);
            setSelectedStyle(uc.style);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFileName(file.name);
            const reader = new FileReader();
            reader.onload = (ev) => {
                const text = ev.target?.result as string;
                if (text) setInputText(prev => prev + '\n\n' + text);
            };
            reader.readAsText(file);
        }
    };

    const clearFile = () => {
        setFileName(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setInputText('');
    };

    const handlePlan = async () => {
        if (!inputText.trim()) return;
        setIsPlanning(true);
        
        if (window.innerWidth < 1024) {
            setMobileTab('RESULTS');
        }

        setItems([]);
        try {
            const styleToUse = selectedStyle === 'Custom' ? customStylePrompt : selectedStyle;
            const chartOptions = mode === 'CHART' ? { 
                isChart: true, 
                chartType, 
                xAxisLabel, 
                yAxisLabel 
            } : undefined;

            const structuredItems = await structureInfographicData(inputText, styleToUse, chartOptions);
            const initializedItems = structuredItems.map(item => ({ ...item, aspectRatio }));
            setItems(initializedItems);
            generateAllImages(initializedItems);
        } catch (e) {
            alert("Failed to analyze text. Please try again.");
            setIsPlanning(false); 
        } finally {
            setIsPlanning(false);
        }
    };

    const generateAllImages = async (itemsToGen: InfographicItem[]) => {
        const promises = itemsToGen.map(async (item) => {
           await generateSingleItem(item);
        });
        await Promise.allSettled(promises);
    };

    const generateSingleItem = async (item: InfographicItem) => {
        try {
            setItems(prev => prev.map(p => p.id === item.id ? { ...p, status: 'generating' } : p));
            
            const styleToUse = selectedStyle === 'Custom' ? customStylePrompt : selectedStyle;
            const enhancedPrompt = `${item.visualPrompt} (${styleToUse} style). High resolution, professional, clear background, minimal text artifacts, 2k.`;
            
            const rawImageUrl = await generateImage(enhancedPrompt, item.aspectRatio || aspectRatio);
            
            setItems(prev => prev.map(p => p.id === item.id ? { ...p, status: 'done', imageData: rawImageUrl } : p));
        } catch (e) {
            setItems(prev => prev.map(p => p.id === item.id ? { ...p, status: 'failed' } : p));
        }
    };

    const handleRegenerate = (e: React.MouseEvent, item: InfographicItem) => {
        e.stopPropagation();
        generateSingleItem(item);
    };

    const handleExportPDF = () => {
        if (items.length === 0) return;
        
        // Very basic PDF export for now - capturing the images only
        // Ideally, we'd use html2canvas on the "Slide" div, but that's complex without new deps.
        // We will just export the AI generated assets.
        const doc = new jsPDF({
            orientation: aspectRatio === '9:16' ? 'portrait' : 'landscape',
        });
        
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        items.forEach((item, index) => {
            if (index > 0) doc.addPage();
            doc.setFillColor(15, 23, 42); 
            doc.rect(0, 0, pageWidth, pageHeight, 'F');

            if (item.imageData) {
                const imgProps = doc.getImageProperties(item.imageData);
                const imgRatio = imgProps.width / imgProps.height;
                let w = pageWidth - 20; // margins
                let h = w / imgRatio;
                if (h > pageHeight - 40) {
                    h = pageHeight - 40;
                    w = h * imgRatio;
                }
                const x = (pageWidth - w) / 2;
                const y = (pageHeight - h) / 2;
                
                doc.addImage(item.imageData, 'PNG', x, y, w, h);
                
                // Add simple text summary at bottom
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(10);
                doc.text(item.title, 10, pageHeight - 10);
            }
        });

        doc.save('mythos_slides.pdf');
    };

    const renderSlide = (item: InfographicItem, index: number, isPreview = false) => {
        // Slide Layout Calculation
        const isPortrait = item.aspectRatio === '9:16';
        
        return (
            <div 
                className={`bg-white text-gray-900 overflow-hidden relative shadow-2xl flex flex-col ${isPreview ? 'h-full w-full' : 'h-[80vh] w-auto aspect-[16/9]'}`}
                style={{ 
                    aspectRatio: item.aspectRatio ? item.aspectRatio.replace(':', '/') : '16/9',
                    fontFamily: "'Inter', sans-serif"
                }}
            >
                {/* Header Bar */}
                <div className="h-16 flex-none bg-[#f8fafc] border-b border-gray-200 px-8 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-slate-800">{item.title}</h3>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-brand-accent"></div>
                        <span className="text-xs uppercase tracking-widest text-slate-400 font-bold">Mythos Deck</span>
                    </div>
                </div>

                {/* Content Area */}
                <div className={`flex-1 p-8 flex gap-8 ${isPortrait ? 'flex-col' : 'flex-row'}`}>
                    {/* Text Column */}
                    <div className={`${isPortrait ? 'w-full h-1/3' : 'w-1/3 h-full'} flex flex-col justify-center`}>
                        <div className="prose prose-sm prose-slate">
                            <h4 className="text-2xl font-serif text-slate-900 mb-4 leading-tight">{item.title}</h4>
                            <p className="text-slate-600 text-sm md:text-base leading-relaxed">{item.summary}</p>
                            <ul className="mt-4 space-y-2">
                                <li className="flex items-start gap-2 text-xs text-slate-500">
                                    <span className="text-brand-accent mt-0.5">●</span> Key Insight 1
                                </li>
                                <li className="flex items-start gap-2 text-xs text-slate-500">
                                    <span className="text-brand-accent mt-0.5">●</span> Data Point 2
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Image/Chart Column */}
                    <div className={`${isPortrait ? 'w-full h-2/3' : 'w-2/3 h-full'} bg-slate-100 rounded-xl overflow-hidden relative flex items-center justify-center border border-slate-200`}>
                        {item.status === 'done' && item.imageData ? (
                            <img src={item.imageData} alt="Visual" className="max-w-full max-h-full object-contain shadow-sm" />
                        ) : item.status === 'failed' ? (
                            <div className="text-center p-4">
                                <span className="material-symbols-outlined text-red-400 text-4xl mb-2">broken_image</span>
                                <p className="text-red-400 text-xs">Generation Failed</p>
                            </div>
                        ) : (
                            <div className="text-center p-4">
                                <div className="w-12 h-12 border-4 border-slate-300 border-t-brand-accent rounded-full animate-spin mx-auto mb-4"></div>
                                <p className="text-slate-400 text-xs uppercase tracking-widest font-bold">Rendering Visual...</p>
                            </div>
                        )}
                        
                        {/* Fake Legend for Charts */}
                        {item.isChart && (
                            <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur px-3 py-2 rounded shadow text-[10px] text-slate-600 border border-slate-200">
                                <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 bg-blue-500 rounded-sm"></span> Series A</div>
                                <div className="flex items-center gap-2"><span className="w-2 h-2 bg-emerald-500 rounded-sm"></span> Series B</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="h-10 flex-none px-8 flex items-center justify-between border-t border-gray-100 text-[10px] text-slate-400">
                    <span>Generated by Mythos</span>
                    <span>{index + 1}</span>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100dvh-50px)] md:h-[calc(100dvh-60px)] overflow-hidden gap-0 bg-[#0a0f1c] animate-fade-in relative">
            
            {/* Mobile Navigation Tabs */}
            <div className="lg:hidden flex-none flex border-b border-brand-800 bg-[#0f172a] z-30">
                <button 
                    onClick={() => setMobileTab('EDITOR')}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${mobileTab === 'EDITOR' ? 'text-brand-accent border-b-2 border-brand-accent bg-brand-800/50' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <span className="material-symbols-outlined text-lg">tune</span> Editor
                </button>
                <button 
                    onClick={() => setMobileTab('RESULTS')}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${mobileTab === 'RESULTS' ? 'text-brand-gold border-b-2 border-brand-gold bg-brand-800/50' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <span className="material-symbols-outlined text-lg">grid_view</span> Results
                    {items.length > 0 && <span className="bg-brand-700 text-white px-1.5 rounded-full text-[10px] shadow-sm">{items.length}</span>}
                </button>
            </div>

            {/* Left Panel: Configuration */}
            <div className={`w-full lg:w-[400px] bg-[#0f172a] border-r border-brand-800 flex-col z-20 shadow-2xl h-full flex-shrink-0 ${mobileTab === 'EDITOR' ? 'flex' : 'hidden lg:flex'}`}>
                {/* Header */}
                <div className="p-6 pb-4 border-b border-brand-800 bg-[#0f172a]">
                    <h2 className="text-xl font-serif text-white mb-1 flex items-center gap-2">
                        <span className="material-symbols-outlined text-brand-gold text-2xl">dashboard_customize</span>
                        Infographics
                    </h2>
                    <p className="text-xs text-gray-500">Transform text into professional slides.</p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                    
                    {/* Step 1: Content Input */}
                    <div className="bg-[#1e293b]/50 rounded-xl border border-brand-700 p-4 relative group hover:border-brand-600 transition-colors">
                        <div className="absolute top-0 right-0 p-2 opacity-10 font-black text-6xl text-white pointer-events-none -mt-2 -mr-2">1</div>
                        <label className="text-[10px] font-bold text-brand-accent uppercase tracking-widest mb-3 block flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-brand-accent text-white flex items-center justify-center text-[10px]">1</span>
                            Content Source
                        </label>
                        
                        <div className="relative">
                            <textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="Paste your article notes, data, or summary here..."
                                className="w-full bg-[#0f172a] border border-brand-700 rounded-xl p-3 text-sm text-gray-200 focus:ring-1 focus:ring-brand-accent focus:border-brand-accent transition-all resize-none h-32 placeholder-gray-600 shadow-inner"
                            />
                            <div className="absolute bottom-2 right-2 flex gap-2">
                                {fileName && (
                                    <button onClick={clearFile} className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 bg-black/40 px-2 py-1 rounded">
                                        <span className="material-symbols-outlined text-[12px]">close</span> {fileName}
                                    </button>
                                )}
                                <label className="cursor-pointer bg-brand-800 hover:bg-brand-700 border border-brand-700 text-gray-400 hover:text-white p-1.5 rounded-lg flex items-center justify-center transition-all shadow-sm active:scale-95" title="Upload Text File">
                                    <span className="material-symbols-outlined text-lg">upload_file</span>
                                    <input 
                                        ref={fileInputRef}
                                        type="file" 
                                        accept=".txt,.md,.json,.csv"
                                        onChange={handleFileUpload}
                                        className="hidden" 
                                    />
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Step 2: Mode Selection */}
                    <div className="bg-[#1e293b]/50 rounded-xl border border-brand-700 p-4 relative group hover:border-brand-600 transition-colors">
                        <div className="absolute top-0 right-0 p-2 opacity-10 font-black text-6xl text-white pointer-events-none -mt-2 -mr-2">2</div>
                        <label className="text-[10px] font-bold text-brand-gold uppercase tracking-widest mb-3 block flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-brand-gold text-brand-900 flex items-center justify-center text-[10px]">2</span>
                            Visualization Mode
                        </label>

                        <div className="flex bg-[#0f172a] p-1 rounded-lg border border-brand-700 mb-4">
                            <button 
                                onClick={() => setMode('VISUAL')}
                                className={`flex-1 py-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-2 ${mode === 'VISUAL' ? 'bg-brand-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                            >
                                <span className="material-symbols-outlined text-sm">image</span> Visual
                            </button>
                            <button 
                                onClick={() => setMode('CHART')}
                                className={`flex-1 py-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-2 ${mode === 'CHART' ? 'bg-brand-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                            >
                                <span className="material-symbols-outlined text-sm">bar_chart</span> Chart
                            </button>
                        </div>
                        
                        {mode === 'VISUAL' ? (
                            <div className="grid grid-cols-3 gap-2">
                                {STYLES.map(style => (
                                    <button
                                        key={style.id}
                                        onClick={() => setSelectedStyle(style.id)}
                                        className={`relative p-2 rounded-lg border text-center transition-all duration-200 flex flex-col items-center gap-1 group ${selectedStyle === style.id ? 'bg-brand-800 border-brand-gold/50 shadow-lg shadow-brand-gold/5' : 'bg-transparent border-brand-800 hover:bg-brand-800/50'}`}
                                    >
                                        <span className={`material-symbols-outlined text-xl group-hover:scale-110 transition-transform ${selectedStyle === style.id ? 'text-brand-gold' : 'text-gray-500'}`}>{style.icon}</span>
                                        <span className={`text-[9px] font-bold leading-tight ${selectedStyle === style.id ? 'text-white' : 'text-gray-400'}`}>{style.label}</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <label className="text-[10px] text-gray-400 uppercase font-bold">Chart Type</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {CHART_TYPES.map(ct => (
                                        <button 
                                            key={ct.id}
                                            onClick={() => setChartType(ct.id)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${chartType === ct.id ? 'bg-brand-800 border-brand-gold text-white' : 'bg-[#0f172a] border-brand-700 text-gray-400 hover:border-gray-500'}`}
                                        >
                                            <span className="material-symbols-outlined text-sm">{ct.icon}</span> {ct.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="grid grid-cols-2 gap-3 mt-2">
                                    <div>
                                        <label className="text-[10px] text-gray-500 block mb-1">X-Axis Label</label>
                                        <input 
                                            type="text" 
                                            value={xAxisLabel}
                                            onChange={(e) => setXAxisLabel(e.target.value)}
                                            placeholder="e.g. Years"
                                            className="w-full bg-[#0f172a] border border-brand-700 rounded-lg px-2 py-1.5 text-xs text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-500 block mb-1">Y-Axis Label</label>
                                        <input 
                                            type="text" 
                                            value={yAxisLabel}
                                            onChange={(e) => setYAxisLabel(e.target.value)}
                                            placeholder="e.g. Revenue"
                                            className="w-full bg-[#0f172a] border border-brand-700 rounded-lg px-2 py-1.5 text-xs text-white"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Step 3: Format */}
                    <div className="bg-[#1e293b]/50 rounded-xl border border-brand-700 p-4 relative group hover:border-brand-600 transition-colors">
                         <div className="absolute top-0 right-0 p-2 opacity-10 font-black text-6xl text-white pointer-events-none -mt-2 -mr-2">3</div>
                        <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-3 block flex items-center gap-2">
                             <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px]">3</span>
                             Format & Layout
                        </label>
                        
                        <div className="flex gap-2 overflow-x-auto pb-1 mb-3 scrollbar-hide">
                             {ASPECT_RATIOS.map(ratio => (
                                <button 
                                    key={ratio.value}
                                    onClick={() => setAspectRatio(ratio.value)}
                                    className={`flex-shrink-0 px-3 py-2 rounded-lg border text-center transition-all flex items-center gap-2 ${aspectRatio === ratio.value ? 'bg-brand-700 border-blue-400 text-white' : 'bg-brand-900 border-brand-800 text-gray-500 hover:text-gray-300'}`}
                                >
                                    <span className="material-symbols-outlined text-sm">{ratio.icon}</span>
                                    <span className="text-[10px] font-bold">{ratio.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                </div>

                {/* Footer Action */}
                <div className="p-6 border-t border-brand-700 bg-[#0f172a] z-10">
                    <button
                        onClick={handlePlan}
                        disabled={!inputText || isPlanning}
                        className="w-full py-4 bg-gradient-to-r from-brand-accent to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
                    >
                        {isPlanning ? (
                            <>
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                Architecting...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-xl">auto_awesome_motion</span>
                                Generate Slides
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Right Panel: Results */}
            <div className={`flex-1 bg-[#0a0f1c] overflow-y-auto p-4 md:p-8 relative custom-scrollbar ${mobileTab === 'RESULTS' ? 'block' : 'hidden lg:block'}`}>
                {/* Background Pattern */}
                <div 
                    className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                    style={{ 
                        backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', 
                        backgroundSize: '24px 24px' 
                    }}
                ></div>

                {items.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-60 relative z-10 min-h-[50vh]">
                        <div className="w-32 h-32 bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-[2rem] flex items-center justify-center mb-8 border border-brand-700/50 shadow-2xl rotate-6 transform hover:rotate-3 transition-transform duration-700">
                            <span className="material-symbols-outlined text-7xl text-brand-gold/80 drop-shadow-lg">grid_view</span>
                        </div>
                        <h3 className="text-3xl font-serif text-white mb-3 tracking-tight">Presentation Engine</h3>
                        <p className="text-gray-400 max-w-sm text-sm leading-relaxed">
                            Configure your slide content on the left, and watch your deck materialize here.
                        </p>
                    </div>
                ) : (
                    <div className="max-w-7xl mx-auto relative z-10 pb-10">
                        <div className="sticky top-0 z-20 bg-[#0a0f1c]/80 backdrop-blur-md py-4 mb-6 flex justify-between items-center border-b border-brand-800">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                                    Slide Deck
                                    <span className="px-2.5 py-0.5 rounded-full bg-brand-800 text-brand-gold text-xs font-mono border border-brand-700 shadow-inner">{items.length} Slides</span>
                                </h3>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setSlideIndex(0)} className="bg-brand-800 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors border border-brand-700 shadow-sm hover:shadow-md">
                                    <span className="material-symbols-outlined text-lg">slideshow</span> Present
                                </button>
                                <button onClick={handleExportPDF} className="bg-brand-accent hover:bg-brand-accent/80 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors shadow-lg hover:shadow-blue-500/20">
                                    <span className="material-symbols-outlined text-lg">picture_as_pdf</span> Export PDF
                                </button>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 md:gap-12">
                            {items.map((item, idx) => (
                                <div 
                                    key={item.id} 
                                    onClick={() => setSlideIndex(idx)}
                                    className="group cursor-pointer relative"
                                    style={{ animationDelay: `${idx * 100}ms` }}
                                >
                                    {/* Slide Container - Scaled Down for Grid */}
                                    <div className="transform transition-transform duration-300 group-hover:scale-[1.02] shadow-2xl rounded-lg overflow-hidden border border-brand-700/50">
                                        {renderSlide(item, idx, true)}
                                    </div>
                                    
                                    {/* Hover Actions */}
                                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                        <button 
                                            onClick={(e) => handleRegenerate(e, item)}
                                            className="bg-black/70 hover:bg-brand-accent text-white p-2 rounded-full backdrop-blur-md"
                                            title="Regenerate Visual"
                                        >
                                            <span className="material-symbols-outlined text-lg">refresh</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Presentation Modal */}
            {slideIndex !== null && items[slideIndex] && (
                <div className="fixed inset-0 z-50 bg-[#0a0f1c]/95 backdrop-blur-xl flex flex-col animate-fade-in">
                    <div className="flex justify-between items-center p-4 border-b border-white/10 bg-black/20 flex-shrink-0">
                        <div className="flex items-center gap-4">
                            <span className="text-white font-bold text-lg font-mono">
                                Slide {String(slideIndex + 1).padStart(2, '0')}
                            </span>
                        </div>
                        <button 
                            onClick={() => setSlideIndex(null)} 
                            className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
                        >
                            <span className="material-symbols-outlined text-2xl">close</span>
                        </button>
                    </div>

                    <div className="flex-1 flex items-center justify-center p-4 md:p-8 overflow-hidden relative">
                        {/* Navigation Arrows */}
                        <button 
                            onClick={(e) => { e.stopPropagation(); setSlideIndex(prev => prev !== null && prev > 0 ? prev - 1 : prev)}}
                            disabled={slideIndex === 0}
                            className="absolute left-4 top-1/2 -translate-y-1/2 w-14 h-14 flex items-center justify-center rounded-full bg-black/20 hover:bg-brand-accent text-white disabled:opacity-0 transition-all z-20"
                        >
                            <span className="material-symbols-outlined text-4xl">chevron_left</span>
                        </button>
                        
                        <button 
                            onClick={(e) => { e.stopPropagation(); setSlideIndex(prev => prev !== null && prev < items.length - 1 ? prev + 1 : prev)}}
                            disabled={slideIndex === items.length - 1}
                            className="absolute right-4 top-1/2 -translate-y-1/2 w-14 h-14 flex items-center justify-center rounded-full bg-black/20 hover:bg-brand-accent text-white disabled:opacity-0 transition-all z-20"
                        >
                            <span className="material-symbols-outlined text-4xl">chevron_right</span>
                        </button>

                        {/* Full Size Slide */}
                        <div className="max-w-[90vw] max-h-[85vh] aspect-video shadow-2xl rounded-xl overflow-hidden">
                            {renderSlide(items[slideIndex], slideIndex, false)}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
                .scrollbar-hide::-webkit-scrollbar { display: none; }
            `}</style>
        </div>
    );
};