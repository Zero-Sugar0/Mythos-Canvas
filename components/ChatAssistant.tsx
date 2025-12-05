import React, { useState, useRef, useEffect } from 'react';
import { sendChatMessage } from '../services/geminiService';
import { ChatMessage, ChatSession } from '../types';

// Compact Rich Text Renderer for Chat
const ChatRichText: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;
  const blocks = text.split(/\n\s*\n/);
  
  const parseInline = (str: string) => {
    return str.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g).map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
      if (part.startsWith('*') && part.endsWith('*')) return <em key={i} className="italic">{part.slice(1, -1)}</em>;
      if (part.startsWith('`') && part.endsWith('`')) return <code key={i} className="bg-black/30 px-1 rounded font-mono text-xs">{part.slice(1, -1)}</code>;
      return part;
    });
  };

  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((block, idx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith('### ')) return <h3 key={idx} className="font-bold text-base mt-2 text-brand-gold">{trimmed.replace('### ', '')}</h3>;
        if (trimmed.startsWith('## ')) return <h2 key={idx} className="font-bold text-lg mt-3 border-b border-brand-700/50 pb-1 text-white">{trimmed.replace('## ', '')}</h2>;
        
        // Code Block
        if (trimmed.startsWith('```')) {
            const codeContent = trimmed.replace(/^```\w*\n?/, '').replace(/```$/, '');
            return (
                <div key={idx} className="bg-[#0a0f1c] p-3 rounded-lg border border-brand-700/50 my-2 overflow-x-auto shadow-inner">
                    <pre className="font-mono text-xs text-gray-300"><code>{codeContent}</code></pre>
                </div>
            );
        }

        // List
        if (trimmed.match(/^- /m) || trimmed.match(/^\d+\. /m)) {
            const items = trimmed.split('\n');
            return (
                <ul key={idx} className="space-y-1 ml-4 list-disc marker:text-brand-gold/70">
                    {items.map((item, i) => (
                        <li key={i} className="pl-1">{parseInline(item.replace(/^- |^\d+\. /, ''))}</li>
                    ))}
                </ul>
            );
        }
        
        // Blockquote
        if (trimmed.startsWith('> ')) {
             return <blockquote key={idx} className="border-l-2 border-brand-gold pl-3 italic opacity-80 my-2 bg-brand-900/30 py-1 rounded-r">{parseInline(trimmed.replace(/> /g, ''))}</blockquote>
        }

        return <p key={idx} className="">{parseInline(trimmed)}</p>;
      })}
    </div>
  );
};

export const ChatSection: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState<string | null>(null); // Base64 of image
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isFastMode, setIsFastMode] = useState(false); 
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem('mythos_chat_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSessions(parsed);
      } catch (e) {
        console.error("Failed to load chat history", e);
      }
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, attachment]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  // Helper to persist sessions
  const persistSessions = (newSessions: ChatSession[]) => {
      setSessions(newSessions);
      localStorage.setItem('mythos_chat_history', JSON.stringify(newSessions));
  };

  const createNewSession = (firstMessage: ChatMessage) => {
      const id = Date.now().toString();
      const title = firstMessage.text.length > 30 
        ? firstMessage.text.substring(0, 30) + '...' 
        : (firstMessage.attachment ? 'Image Analysis' : firstMessage.text);
      
      const newSession: ChatSession = {
          id,
          title,
          timestamp: Date.now(),
          messages: [firstMessage]
      };

      const updatedSessions = [newSession, ...sessions];
      persistSessions(updatedSessions);
      setCurrentSessionId(id);
      return id;
  };

  const updateSessionInStorage = (id: string, msgs: ChatMessage[]) => {
      const updatedSessions = sessions.map(s => {
          if (s.id === id) {
              return { ...s, messages: msgs, timestamp: Date.now() };
          }
          return s;
      });
      
      // Move current session to top
      const current = updatedSessions.find(s => s.id === id);
      const others = updatedSessions.filter(s => s.id !== id);
      
      if (current) {
          persistSessions([current, ...others]);
      } else {
          persistSessions(updatedSessions);
      }
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const updated = sessions.filter(s => s.id !== id);
      persistSessions(updated);
      if (currentSessionId === id) {
          setMessages([]);
          setCurrentSessionId(null);
      }
  };

  const loadSession = (session: ChatSession) => {
      setMessages(session.messages);
      setCurrentSessionId(session.id);
      setSidebarOpen(false); // Close sidebar on mobile when selecting
  };

  const startNewChat = () => {
      setMessages([]);
      setCurrentSessionId(null);
      setAttachment(null);
      setSidebarOpen(false); // Close sidebar on mobile
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files && event.target.files[0]) {
          const file = event.target.files[0];
          const reader = new FileReader();
          reader.onload = (e) => {
              const result = e.target?.result as string;
              setAttachment(result);
          };
          reader.readAsDataURL(file);
          // Reset value so the same file can be selected again if needed
          event.target.value = '';
      }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      const file = e.clipboardData.files[0];
      if (file.type.startsWith('image/')) {
        e.preventDefault();
        const reader = new FileReader();
        reader.onload = (event) => {
           setAttachment(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if ((!textToSend.trim() && !attachment) || isLoading) return;

    const userMsg: ChatMessage = { 
        role: 'user', 
        text: textToSend, 
        timestamp: Date.now(),
        attachment: attachment || undefined
    };
    
    const newMessages = [...messages, userMsg];
    
    setMessages(newMessages);
    setInput('');
    setAttachment(null);
    setIsLoading(true);

    let activeId = currentSessionId;

    // Handle Session Creation/Update immediately
    if (!activeId) {
        activeId = createNewSession(userMsg);
    } else {
        updateSessionInStorage(activeId, newMessages);
    }

    // Prepare history for the service
    const history = messages.map(m => {
        const parts: any[] = [{ text: m.text }];
        if (m.attachment) {
            parts.push({
                inlineData: {
                    mimeType: "image/jpeg",
                    data: m.attachment.split(',')[1]
                }
            });
        }
        return {
            role: m.role,
            parts: parts
        };
    });

    // Choose model
    const model = isFastMode ? 'gemini-flash-lite-latest' : 'gemini-2.5-flash';
    
    // Call Service
    const response = await sendChatMessage(history, userMsg.text, model, userMsg.attachment);
    
    const modelMsg: ChatMessage = {
      role: 'model',
      text: response.text,
      timestamp: Date.now(),
      generatedImage: response.generatedImage
    };
    
    const finalMessages = [...newMessages, modelMsg];
    setMessages(finalMessages);
    
    if (activeId) {
        updateSessionInStorage(activeId, finalMessages);
    }
    
    setIsLoading(false);
  };

  const suggestions = [
      "Ideas for rat detective sequels",
      "Prompts for fantasy world-building",
      "Character flaws for a paladin",
      "Plot twist involving time travel"
  ];

  return (
    <div className="flex h-full w-full bg-[#0f172a] overflow-hidden relative">
      
      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
          <div className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity" onClick={() => setSidebarOpen(false)}></div>
      )}

      {/* Sidebar */}
      <div 
        className={`
            fixed inset-y-0 left-0 z-50 flex flex-col
            bg-[#0a0f1c] border-r border-brand-800 shadow-2xl md:shadow-none
            transition-all duration-300 ease-in-out
            md:relative 
            ${sidebarOpen ? 'translate-x-0 w-72 md:w-64' : '-translate-x-full w-72 md:translate-x-0 md:w-0 md:border-none'}
        `}
      >
        <div className={`p-3 flex flex-col h-full w-full overflow-hidden transition-opacity duration-200 ${sidebarOpen ? 'opacity-100' : 'md:opacity-0 opacity-100'}`}>
            <button 
                onClick={startNewChat}
                className="flex items-center gap-2 w-full bg-brand-800/50 hover:bg-brand-800 text-white p-3 rounded-lg mb-4 transition-colors font-medium border border-brand-700/50 text-sm group active:scale-95 transform duration-150"
            >
                <span className="material-symbols-outlined text-brand-gold text-xl group-hover:rotate-90 transition-transform">add</span>
                <span className="whitespace-nowrap">New Chat</span>
            </button>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <h3 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 px-2">History</h3>
                <div className="space-y-1">
                    {sessions.length === 0 && (
                        <p className="px-2 text-xs text-gray-600 italic">No previous chats</p>
                    )}
                    {sessions.map(session => (
                        <div 
                            key={session.id}
                            onClick={() => loadSession(session)}
                            className={`p-3 rounded-md text-xs cursor-pointer transition-all flex items-center gap-2 group truncate relative pr-8 touch-manipulation
                                ${currentSessionId === session.id 
                                    ? 'bg-brand-800 text-white border border-brand-700/50 shadow-sm' 
                                    : 'text-gray-400 hover:bg-brand-800/30 hover:text-gray-300'
                                }`}
                        >
                            <span className="material-symbols-outlined text-[16px] flex-shrink-0">chat_bubble_outline</span>
                            <span className="truncate">{session.title}</span>
                            
                            <button 
                                onClick={(e) => deleteSession(e, session.id)}
                                className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 hover:text-red-400 p-2 transition-opacity"
                                title="Delete Chat"
                            >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-auto pt-3 border-t border-brand-800/50 text-[10px] text-gray-600 text-center whitespace-nowrap">
                Strong Mind v1.5
            </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0f172a] relative h-full">
        
        {/* Toggle Sidebar Button */}
        <div className="absolute top-2 left-2 z-10 md:top-3 md:left-3">
            <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 md:p-1.5 bg-brand-800/80 hover:bg-brand-700 text-gray-400 hover:text-white rounded-md transition-colors shadow-sm border border-brand-700/30 active:scale-90 transform duration-150 backdrop-blur-sm"
                aria-label="Toggle Sidebar"
            >
                <span className="material-symbols-outlined text-xl md:text-lg">
                    {sidebarOpen ? 'chevron_left' : 'menu'}
                </span>
            </button>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto px-3 md:px-4 py-4 pt-14 md:pt-4 scroll-smooth custom-scrollbar" ref={scrollRef}>
            {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center px-4 pb-20">
                     <div className="w-12 h-12 md:w-16 md:h-16 bg-brand-800/50 rounded-2xl flex items-center justify-center mb-4 shadow-lg border border-brand-700/50">
                        <span className="material-symbols-outlined text-3xl md:text-4xl text-brand-gold">auto_awesome</span>
                     </div>
                     <h2 className="text-xl md:text-2xl font-serif text-white mb-2">Hey! What's up?</h2>
                     <p className="text-sm text-gray-500 mb-8 max-w-xs md:max-w-none mx-auto">Ready to craft another epic story, brainstorm, or analyze images?</p>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full text-left max-w-lg">
                        {suggestions.map((s, i) => (
                            <button 
                                key={i}
                                onClick={() => handleSend(s)}
                                className="px-3 py-3 bg-brand-800/30 hover:bg-brand-800 border border-brand-700/30 hover:border-brand-600 rounded-xl text-xs md:text-sm text-gray-400 hover:text-white transition-all flex items-center gap-3 group active:scale-[0.98] min-h-[50px]"
                            >
                                <span className="material-symbols-outlined text-brand-accent/70 text-sm group-hover:text-brand-accent">subdirectory_arrow_right</span>
                                {s}
                            </button>
                        ))}
                     </div>
                </div>
            ) : (
                <div className="flex flex-col gap-4 md:gap-6 max-w-3xl mx-auto pt-4 pb-2">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex gap-2 md:gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                             {msg.role === 'model' && (
                                 <div className="w-8 h-8 rounded-full bg-brand-gold flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md">
                                    <span className="material-symbols-outlined text-brand-900 text-sm font-bold">auto_awesome</span>
                                 </div>
                             )}
                             
                             <div className={`max-w-[85%] md:max-w-[80%] flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                 {/* User Attachment Display */}
                                 {msg.attachment && (
                                     <div className="rounded-lg overflow-hidden border border-brand-700/50 shadow-md max-w-[150px] md:max-w-[200px]">
                                         <img src={msg.attachment} alt="User Upload" className="w-full h-auto object-cover" />
                                     </div>
                                 )}

                                 <div className={`${msg.role === 'user' ? 'bg-brand-accent text-white rounded-2xl rounded-tr-none px-4 py-3 shadow-sm text-[15px]' : 'text-gray-200 px-0 py-1 text-[15px]'} break-words w-full`}>
                                     <ChatRichText text={msg.text} />
                                 </div>

                                 {/* Generated Image Display */}
                                 {msg.generatedImage && (
                                     <div className="mt-2 rounded-xl overflow-hidden border border-brand-700 shadow-xl max-w-full md:max-w-md bg-black/50">
                                         <img src={msg.generatedImage} alt="Generated Content" className="w-full h-auto" />
                                         <div className="px-3 py-2 bg-brand-900/80 flex justify-between items-center">
                                             <span className="text-[10px] text-brand-gold font-bold uppercase tracking-wider">AI Generated</span>
                                             <a href={msg.generatedImage} download={`generated_${Date.now()}.png`} className="text-gray-400 hover:text-white p-2">
                                                 <span className="material-symbols-outlined text-lg">download</span>
                                             </a>
                                         </div>
                                     </div>
                                 )}
                             </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex gap-3 max-w-3xl justify-start">
                             <div className="w-8 h-8 rounded-full bg-brand-gold flex items-center justify-center flex-shrink-0 mt-0.5 animate-pulse">
                                <span className="material-symbols-outlined text-brand-900 text-sm font-bold">auto_awesome</span>
                             </div>
                             <div className="flex items-center gap-1 px-1 py-2">
                                <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce delay-75"></div>
                                <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce delay-150"></div>
                             </div>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Input Bar */}
        <div className="w-full flex justify-center pb-safe-bottom pb-2 md:pb-4 bg-transparent relative z-10 px-2 md:px-4">
            <div className="w-full max-w-4xl relative bg-[#1e2330] rounded-3xl border border-brand-700/50 shadow-lg focus-within:border-brand-600 focus-within:ring-1 focus-within:ring-brand-600/30 transition-all p-2 md:p-3 flex flex-col">
                 {/* Attachment Preview */}
                 {attachment && (
                     <div className="flex items-start gap-2 mb-2 p-2 bg-brand-900/50 rounded-lg border border-brand-700/30 w-fit animate-fade-in mx-1">
                         <div className="w-12 h-12 rounded overflow-hidden bg-black/20">
                             <img src={attachment} alt="Preview" className="w-full h-full object-cover" />
                         </div>
                         <div className="flex flex-col justify-center h-12 px-1">
                             <span className="text-[10px] text-brand-gold font-bold uppercase">Image Attached</span>
                             <span className="text-[10px] text-gray-500">Gemini 3 Pro</span>
                         </div>
                         <button 
                            type="button"
                            onClick={() => setAttachment(null)}
                            className="ml-2 p-2 hover:bg-white/10 rounded-full text-gray-500 hover:text-red-400 transition-colors"
                         >
                             <span className="material-symbols-outlined text-lg">close</span>
                         </button>
                     </div>
                 )}

                 <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onPaste={handlePaste}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    placeholder={attachment ? "Ask about this image..." : "Type a message..."}
                    className="w-full bg-transparent border-none text-white text-base placeholder-gray-500 px-3 py-2 focus:ring-0 resize-none max-h-[120px] scrollbar-hide mb-1 min-h-[44px]"
                    rows={1}
                 />
                 
                 <div className="flex justify-between items-center px-1 pt-1">
                    {/* Model Selector / Tools */}
                    <div className="flex items-center gap-1">
                         <input 
                            type="file" 
                            ref={fileInputRef} 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleFileSelect} 
                         />
                         <button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 text-gray-500 hover:text-white hover:bg-white/10 rounded-full transition-colors relative active:scale-90 transform min-w-[40px] flex items-center justify-center"
                            title="Upload Image"
                         >
                             <span className="material-symbols-outlined text-2xl">add_photo_alternate</span>
                         </button>
                         <button
                            type="button"
                            className="flex items-center bg-black/20 rounded-full p-0.5 border border-brand-700/30 cursor-pointer ml-1 active:scale-95 transition-transform select-none disabled:opacity-70 disabled:cursor-not-allowed"
                            onClick={() => setIsFastMode(!isFastMode)}
                            disabled={!!attachment}
                         >
                             <div className={`px-3 py-1.5 rounded-full text-[10px] md:text-[11px] font-bold transition-all flex items-center gap-1 ${isFastMode && !attachment ? 'bg-brand-accent text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>
                                 <span className="material-symbols-outlined text-[14px]">bolt</span>
                                 Fast
                             </div>
                             <div className={`px-3 py-1.5 rounded-full text-[10px] md:text-[11px] font-bold transition-all flex items-center gap-1 ${(!isFastMode || attachment) ? 'bg-brand-gold text-brand-900 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>
                                 <span className="material-symbols-outlined text-[14px]">{attachment ? 'visibility' : 'psychology'}</span>
                                 {attachment ? 'Pro Vision' : 'Smart'}
                             </div>
                         </button>
                    </div>

                    {/* Send Button */}
                    <button 
                        type="button"
                        onClick={() => handleSend()}
                        disabled={(!input.trim() && !attachment) || isLoading}
                        className={`w-10 h-10 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all active:scale-90 transform shadow-md ${(input.trim() || attachment) ? 'bg-white text-black hover:bg-gray-200' : 'bg-brand-700 text-gray-600 cursor-not-allowed'}`}
                    >
                        <span className="material-symbols-outlined text-xl">arrow_upward</span>
                    </button>
                 </div>
            </div>
        </div>

      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .pb-safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
    </div>
  );
};