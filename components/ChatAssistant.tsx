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
    <div className="space-y-2 text-sm">
      {blocks.map((block, idx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith('### ')) return <h3 key={idx} className="font-bold text-base mt-2">{trimmed.replace('### ', '')}</h3>;
        if (trimmed.startsWith('## ')) return <h2 key={idx} className="font-bold text-lg mt-3 border-b border-white/10 pb-1">{trimmed.replace('## ', '')}</h2>;
        
        // Code Block
        if (trimmed.startsWith('```')) {
            const codeContent = trimmed.replace(/^```\w*\n?/, '').replace(/```$/, '');
            return (
                <div key={idx} className="bg-[#0a0f1c] p-3 rounded-lg border border-brand-700/50 my-2 overflow-x-auto">
                    <pre className="font-mono text-xs text-gray-300"><code>{codeContent}</code></pre>
                </div>
            );
        }

        // List
        if (trimmed.match(/^- /m) || trimmed.match(/^\d+\. /m)) {
            const items = trimmed.split('\n');
            return (
                <ul key={idx} className="space-y-1 ml-4 list-disc">
                    {items.map((item, i) => (
                        <li key={i} className="pl-1">{parseInline(item.replace(/^- |^\d+\. /, ''))}</li>
                    ))}
                </ul>
            );
        }
        
        // Blockquote
        if (trimmed.startsWith('> ')) {
             return <blockquote key={idx} className="border-l-2 border-brand-gold pl-3 italic opacity-80 my-2">{parseInline(trimmed.replace(/> /g, ''))}</blockquote>
        }

        return <p key={idx} className="leading-relaxed">{parseInline(trimmed)}</p>;
      })}
    </div>
  );
};

export const ChatSection: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isFastMode, setIsFastMode] = useState(false); // Default to Smart (Flash)
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
  }, [messages, isLoading]);

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
        : firstMessage.text;
      
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
      if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const startNewChat = () => {
      setMessages([]);
      setCurrentSessionId(null);
      if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', text: textToSend, timestamp: Date.now() };
    const newMessages = [...messages, userMsg];
    
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    let activeId = currentSessionId;

    // Handle Session Creation/Update immediately so user doesn't lose data
    if (!activeId) {
        activeId = createNewSession(userMsg);
    } else {
        updateSessionInStorage(activeId, newMessages);
    }

    // Format history for the SDK (using previous messages)
    const history = messages.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));

    // Choose model based on toggle
    const model = isFastMode ? 'gemini-flash-lite-latest' : 'gemini-2.5-flash';
    
    const responseText = await sendChatMessage(history, userMsg.text, model);
    
    const modelMsg: ChatMessage = {
      role: 'model',
      text: responseText,
      timestamp: Date.now()
    };
    
    const finalMessages = [...newMessages, modelMsg];
    setMessages(finalMessages);
    
    // Update storage with final response
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
    <div className="flex h-full w-full bg-[#0f172a] overflow-hidden">
      
      {/* Sidebar */}
      <div 
        className={`${sidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full opacity-0'} 
        bg-[#0a0f1c] transition-all duration-300 ease-in-out border-r border-brand-800 flex flex-col z-20 h-full flex-shrink-0`}
      >
        <div className="p-3 flex flex-col h-full min-w-64">
            <button 
                onClick={startNewChat}
                className="flex items-center gap-2 w-full bg-brand-800/50 hover:bg-brand-800 text-white p-2.5 rounded-lg mb-4 transition-colors font-medium border border-brand-700/50 text-sm group"
            >
                <span className="material-symbols-outlined text-brand-gold text-lg group-hover:rotate-90 transition-transform">add</span>
                New Chat
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
                            className={`p-2 rounded-md text-xs cursor-pointer transition-all flex items-center gap-2 group truncate relative pr-8
                                ${currentSessionId === session.id 
                                    ? 'bg-brand-800 text-white border border-brand-700/50 shadow-sm' 
                                    : 'text-gray-400 hover:bg-brand-800/30 hover:text-gray-300'
                                }`}
                        >
                            <span className="material-symbols-outlined text-[14px] flex-shrink-0">chat_bubble_outline</span>
                            <span className="truncate">{session.title}</span>
                            
                            <button 
                                onClick={(e) => deleteSession(e, session.id)}
                                className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 hover:text-red-400 p-1 transition-opacity"
                                title="Delete Chat"
                            >
                                <span className="material-symbols-outlined text-[14px]">delete</span>
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-auto pt-3 border-t border-brand-800/50 text-[10px] text-gray-600 text-center">
                Strong Mind v1.3
            </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0f172a] relative h-full">
        
        {/* Toggle Sidebar Button */}
        <div className="absolute top-3 left-3 z-20">
            <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-1.5 bg-brand-800/50 hover:bg-brand-700 text-gray-500 hover:text-white rounded-md transition-colors"
            >
                <span className="material-symbols-outlined text-lg">
                    {sidebarOpen ? 'chevron_left' : 'menu'}
                </span>
            </button>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto px-4 py-4 scroll-smooth custom-scrollbar" ref={scrollRef}>
            {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center px-4 pb-20">
                     <div className="w-10 h-10 bg-brand-800/50 rounded-xl flex items-center justify-center mb-4 shadow-lg border border-brand-700/50">
                        <span className="material-symbols-outlined text-2xl text-brand-gold">auto_awesome</span>
                     </div>
                     <h2 className="text-xl font-serif text-white mb-2">Hey! What's up?</h2>
                     <p className="text-xs text-gray-500 mb-6">Ready to craft another epic story or tweak code?</p>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full text-left max-w-lg">
                        {suggestions.map((s, i) => (
                            <button 
                                key={i}
                                onClick={() => handleSend(s)}
                                className="px-2 py-1.5 bg-brand-800/30 hover:bg-brand-800 border border-brand-700/30 hover:border-brand-600 rounded-lg text-[10px] text-gray-400 hover:text-white transition-all flex items-center gap-2 group"
                            >
                                <span className="material-symbols-outlined text-brand-accent/70 text-[12px] group-hover:text-brand-accent">subdirectory_arrow_right</span>
                                {s}
                            </button>
                        ))}
                     </div>
                </div>
            ) : (
                <div className="flex flex-col gap-3 max-w-3xl mx-auto pt-2 pb-2">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                             {msg.role === 'model' && (
                                 <div className="w-6 h-6 rounded-full bg-brand-gold flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="material-symbols-outlined text-brand-900 text-[10px] font-bold">auto_awesome</span>
                                 </div>
                             )}
                             <div className={`max-w-[85%] ${msg.role === 'user' ? 'bg-brand-accent text-white rounded-xl rounded-tr-none px-3 py-1.5 shadow-sm' : 'text-gray-300 px-3 py-1.5'}`}>
                                 <ChatRichText text={msg.text} />
                             </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex gap-3 max-w-3xl justify-start">
                             <div className="w-6 h-6 rounded-full bg-brand-gold flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="material-symbols-outlined text-brand-900 text-[10px] font-bold">auto_awesome</span>
                             </div>
                             <div className="flex items-center gap-1 px-1 py-2">
                                <div className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce"></div>
                                <div className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce delay-75"></div>
                                <div className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce delay-150"></div>
                             </div>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Input Bar */}
        <div className="w-full flex justify-center pb-2 bg-transparent relative z-10 px-4">
            <div className="w-full max-w-4xl relative bg-[#1e2330] rounded-2xl border border-brand-700/50 shadow-lg focus-within:border-brand-600 focus-within:ring-1 focus-within:ring-brand-600/30 transition-all p-3 flex flex-col">
                 <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    placeholder="How can Strong Mind help?"
                    className="w-full bg-transparent border-none text-white text-sm placeholder-gray-500 px-2 py-3 focus:ring-0 resize-none max-h-[150px] scrollbar-hide mb-2"
                    rows={1}
                 />
                 
                 <div className="flex justify-between items-center px-1 pt-1">
                    {/* Model Selector / Tools */}
                    <div className="flex items-center gap-1">
                         <button className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                             <span className="material-symbols-outlined text-lg">attach_file</span>
                         </button>
                         <div 
                            className="flex items-center bg-black/20 rounded-full p-0.5 border border-brand-700/30 cursor-pointer ml-1"
                            onClick={() => setIsFastMode(!isFastMode)}
                         >
                             <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all flex items-center gap-1 ${isFastMode ? 'bg-brand-accent text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>
                                 <span className="material-symbols-outlined text-[12px]">bolt</span>
                                 Fast
                             </div>
                             <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all flex items-center gap-1 ${!isFastMode ? 'bg-brand-gold text-brand-900 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>
                                 <span className="material-symbols-outlined text-[12px]">psychology</span>
                                 Smart
                             </div>
                         </div>
                    </div>

                    {/* Send Button */}
                    <button 
                        onClick={() => handleSend()}
                        disabled={!input.trim() || isLoading}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${input.trim() ? 'bg-white text-black hover:bg-gray-200' : 'bg-brand-700 text-gray-600 cursor-not-allowed'}`}
                    >
                        <span className="material-symbols-outlined text-base">arrow_upward</span>
                    </button>
                 </div>
                 <div className="text-center text-[9px] text-gray-700 font-medium pt-1 w-full pointer-events-none select-none">
                     Powered by Gemini 2.5 Flash & Lite. AI can make mistakes.
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
      `}</style>
    </div>
  );
};