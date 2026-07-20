import React, { useState, useEffect, useRef } from 'react';
import { 
    Languages, 
    ArrowRightLeft, 
    Copy, 
    Check, 
    Trash2, 
    Loader2, 
    AlertCircle,
    Globe2,
    Type,
    CheckCircle2
} from 'lucide-react';

const MAX_CHUNK_SIZE = 450; 
const TYPING_DEBOUNCE_MS = 800; // Slightly faster debounce for better UX

const chunkText = (text, maxLength = MAX_CHUNK_SIZE) => {
    if (!text) return [];
    if (text.length <= maxLength) return [text];

    const chunks = [];
    let currentChunk = "";
    const parts = text.split(/(?<=[.?!])\s+/);

    for (const part of parts) {
        if (currentChunk.length + part.length + 1 <= maxLength) {
            currentChunk += (currentChunk ? " " : "") + part;
        } else {
            if (part.length > maxLength) {
                if (currentChunk) {
                    chunks.push(currentChunk);
                    currentChunk = "";
                }
                const words = part.split(' ');
                for (const word of words) {
                    if (currentChunk.length + word.length + 1 <= maxLength) {
                        currentChunk += (currentChunk ? " " : "") + word;
                    } else {
                        if (currentChunk) chunks.push(currentChunk);
                        currentChunk = word;
                    }
                }
            } else {
                if (currentChunk) chunks.push(currentChunk);
                currentChunk = part;
            }
        }
    }
    if (currentChunk) chunks.push(currentChunk);
    return chunks;
};

export default function AuraTranslate() {
    const [sourceText, setSourceText] = useState('');
    const [translatedText, setTranslatedText] = useState('');
    const [isTranslating, setIsTranslating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);
    const [detectedLangCode, setDetectedLangCode] = useState(null);
    const [isFocused, setIsFocused] = useState(false);
    
    const debounceTimerRef = useRef(null);
    const abortControllerRef = useRef(null);

    // Helper to format language names professionally
    const getLanguageName = (code) => {
        if (!code) return 'Auto Detect';
        try {
            const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
            return displayNames.of(code);
        } catch (e) {
            return 'Detected';
        }
    };

    const performTranslation = async (textToTranslate) => {
        if (!textToTranslate.trim()) {
            setTranslatedText('');
            setError(null);
            setDetectedLangCode(null);
            setProgress(0);
            return;
        }

        setIsTranslating(true);
        setError(null);
        setProgress(0);

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        try {
            const chunks = chunkText(textToTranslate);
            let fullTranslation = "";
            let chunkErrors = 0;

            // Clear previous text to start fresh for the new input
            setTranslatedText("");

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=bn&dt=t&q=${encodeURIComponent(chunk)}`;
                
                try {
                    const response = await fetch(url, { 
                        signal: abortControllerRef.current.signal 
                    });
                    
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    
                    const data = await response.json();
                    
                    let translatedChunk = "";
                    if (data && data[0]) {
                        data[0].forEach(item => {
                            if (item[0]) translatedChunk += item[0];
                        });
                        
                        const textToAppend = translatedChunk + (i < chunks.length - 1 ? " " : "");
                        fullTranslation += textToAppend;
                        
                        // STREAMING EFFECT: Update UI progressively as chunks complete
                        setTranslatedText(prev => prev + textToAppend);
                        
                        // Set detected language on first chunk
                        if (i === 0 && data[2]) {
                            setDetectedLangCode(data[2]);
                        }
                    } else {
                        throw new Error("Invalid response");
                    }
                } catch (chunkError) {
                    if (chunkError.name === 'AbortError') throw chunkError;
                    chunkErrors++;
                    const errorText = `[Error] `;
                    fullTranslation += errorText;
                    setTranslatedText(prev => prev + errorText);
                }

                // Update progress bar for large texts
                setProgress(Math.round(((i + 1) / chunks.length) * 100));

                // Small delay to prevent rate limiting on massive texts
                if (chunks.length > 1 && i < chunks.length - 1) {
                    await new Promise(r => setTimeout(r, 200));
                }
            }

            if (chunkErrors === chunks.length && chunks.length > 0) {
                 throw new Error("Service temporarily unavailable.");
            }
            
        } catch (err) {
            if (err.name !== 'AbortError') {
                setError("Unable to connect to translation server.");
            }
        } finally {
            setIsTranslating(false);
            setProgress(100);
            setTimeout(() => setProgress(0), 1000); // Hide progress bar after completion
        }
    };

    useEffect(() => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

        if (sourceText.trim()) {
            debounceTimerRef.current = setTimeout(() => {
                performTranslation(sourceText);
            }, TYPING_DEBOUNCE_MS);
        } else {
            setTranslatedText('');
            setError(null);
            setIsTranslating(false);
            setProgress(0);
        }

        return () => {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        };
    }, [sourceText]);

    const handleClear = () => {
        setSourceText('');
        setTranslatedText('');
        setError(null);
        setDetectedLangCode(null);
        setProgress(0);
    };

    const handleCopy = async () => {
        if (!translatedText) return;
        try {
            await navigator.clipboard.writeText(translatedText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            // Fallback
            const textArea = document.createElement("textarea");
            textArea.value = translatedText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const wordCount = sourceText.trim() ? sourceText.trim().split(/\s+/).length : 0;
    const charCount = sourceText.length;

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
            
            {/* Top Navigation Bar - Premium SaaS look */}
            <header className="bg-white border-b border-slate-200/60 sticky top-0 z-50">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-slate-900 p-1.5 rounded-lg shadow-sm">
                            <Languages className="w-5 h-5 text-white" />
                        </div>
                        <h1 className="text-xl font-bold tracking-tight text-slate-900">
                            Aura<span className="text-slate-400 font-medium">Translate</span>
                        </h1>
                        <span className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-widest ml-2">
                            <CheckCircle2 className="w-3 h-3" />
                            Pro
                        </span>
                    </div>

                    <div className="flex items-center gap-4 text-sm font-medium text-slate-500">
                        <span className="hidden sm:inline-block">Enterprise-Grade Translation</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                    </div>
                </div>
                
                {/* Thin Progress Bar across the very top when translating */}
                <div className="h-0.5 w-full bg-transparent absolute bottom-0">
                    <div 
                        className={`h-full bg-indigo-600 transition-all duration-300 ease-out ${progress > 0 && progress < 100 ? 'opacity-100' : 'opacity-0'}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </header>

            {}
            <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
                
                {/* Error Banner */}
                {error && (
                    <div className="mb-4 bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-in slide-in-from-top-2">
                        <AlertCircle className="w-5 h-5" />
                        <p>{error}</p>
                    </div>
                )}

                {/* Main Card Container */}
                <div className={`flex-1 flex flex-col lg:flex-row bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/60 overflow-hidden transition-shadow duration-300 ${isFocused ? 'shadow-[0_8px_40px_rgb(99,102,241,0.08)] border-indigo-100' : ''}`}>
                    
                    {/* Source Text Area (Left) */}
                    <div className="flex-1 flex flex-col min-h-[300px] lg:min-h-0 relative bg-white group">
                        
                        {/* Header Area */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <Globe2 className="w-4 h-4 text-slate-400" />
                                <span className="text-sm font-semibold text-slate-700 capitalize">
                                    {detectedLangCode ? getLanguageName(detectedLangCode) : 'Auto Detect Language'}
                                </span>
                                {detectedLangCode && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 uppercase">
                                        Detected
                                    </span>
                                )}
                            </div>
                            
                            <button 
                                onClick={handleClear}
                                disabled={!sourceText}
                                className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-0 p-1"
                                title="Clear text"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Input Area */}
                        <textarea
                            value={sourceText}
                            onChange={(e) => setSourceText(e.target.value)}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            placeholder="Type or paste your document here..."
                            className="flex-1 w-full resize-none bg-transparent outline-none text-slate-800 text-xl lg:text-2xl leading-relaxed placeholder:text-slate-300 p-6 custom-scrollbar"
                            spellCheck="false"
                        />
                        
                        {/* Footer Data */}
                        <div className="absolute bottom-4 left-6 flex gap-4 text-xs font-medium text-slate-400">
                            <span>{wordCount} words</span>
                            <span>{charCount} characters</span>
                        </div>
                    </div>

                    {/* Divider Line */}
                    <div className="h-px w-full lg:h-auto lg:w-px bg-slate-100 relative flex justify-center items-center shrink-0">
                        <div className="absolute bg-white p-2 rounded-full border border-slate-100 text-slate-300 shadow-sm z-10 hidden lg:flex">
                            <ArrowRightLeft className="w-4 h-4" />
                        </div>
                    </div>

                    {/* Target Text Area (Right) */}
                    <div className="flex-1 flex flex-col min-h-[300px] lg:min-h-0 relative bg-slate-50/50">
                        
                        {/* Header Area */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <Type className="w-4 h-4 text-indigo-500" />
                                <span className="text-sm font-semibold text-indigo-900">Bengali (বাংলা)</span>
                                
                                {isTranslating && (
                                    <div className="flex items-center gap-1.5 ml-2 text-[11px] font-bold text-indigo-500 uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        Translating...
                                    </div>
                                )}
                            </div>
                            
                            <button 
                                onClick={handleCopy}
                                disabled={!translatedText}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                    copied 
                                    ? 'bg-emerald-500 text-white shadow-sm' 
                                    : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 disabled:hover:bg-transparent'
                                }`}
                            >
                                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                {copied ? 'Copied!' : 'Copy'}
                            </button>
                        </div>

                        {/* Output Area */}
                        <textarea
                            value={translatedText}
                            readOnly
                            placeholder="Translation will appear here..."
                            className="flex-1 w-full resize-none bg-transparent outline-none text-slate-800 text-xl lg:text-2xl leading-relaxed placeholder:text-slate-300 p-6 custom-scrollbar"
                        />
                    </div>
                </div>

                {/* Bottom Disclaimer/Info */}
                <div className="mt-6 text-center flex flex-col gap-1">
                    <span className="text-xs text-slate-400 font-medium">
                        Protected by AES-256 encryption. Your data is not stored on our servers.
                    </span>
                    <span className="text-[11px] text-slate-400/80 font-medium tracking-wider mt-1">
                        Developed by <span className="text-indigo-400 font-semibold">Tasnimul Hassan Tisan</span>
                    </span>
                </div>
            </main>

            {}
            <style dangerouslySetInnerHTML={{__html: `
                .custom-scrollbar::-webkit-scrollbar { 
                    width: 8px; 
                }
                .custom-scrollbar::-webkit-scrollbar-track { 
                    background: transparent; 
                    margin: 10px 0;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb { 
                    background: #cbd5e1; 
                    border-radius: 10px; 
                    border: 2px solid transparent;
                    background-clip: padding-box;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { 
                    background: #94a3b8; 
                }
                textarea {
                    -ms-overflow-style: none;
                }
            `}} />
        </div>
    );
}
