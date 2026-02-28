import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { Clock, Trash2, ShieldCheck, Home, Play, Copy, Check } from 'lucide-react';

interface HistoryItem {
    id: string;
    text: string;
    timestamp: string;
}

const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export default function DashboardUI() {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Load history from local storage on mount
    useEffect(() => {
        const saved = localStorage.getItem('flow_history');
        if (saved) {
            try {
                setHistory(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse history.");
            }
        }
    }, []);

    useEffect(() => {
        if (!isTauri()) return;

        const unlistenPromise = listen('new-transcription', (event: any) => {
            console.log("Received new transcription in Dashboard", event);
            if (event.payload && event.payload.text) {
                const newText = event.payload.text;
                const newItem: HistoryItem = {
                    id: Date.now().toString(),
                    text: newText,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };

                setHistory(prev => {
                    const updated = [newItem, ...prev];
                    localStorage.setItem('flow_history', JSON.stringify(updated));
                    return updated;
                });
            }
        });

        return () => {
            unlistenPromise.then(f => f()).catch(console.warn);
        };
    }, []);

    // Listen for paste shortcut
    useEffect(() => {
        if (!isTauri()) return;

        const unlistenPromise = listen('shortcut-paste', async () => {
            if (history.length > 0) {
                const latestText = history[0].text;
                await writeText(latestText);
                setTimeout(async () => {
                    await invoke('paste_transcript');
                }, 100);
            }
        });

        return () => {
            unlistenPromise.then(f => f()).catch(console.warn);
        };
    }, [history]);

    const clearHistory = () => {
        if (confirm('Clear entire transcription history?')) {
            setHistory([]);
            localStorage.removeItem('flow_history');
        }
    };

    const copyItem = async (id: string, text: string) => {
        await writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div
            className="flex h-screen bg-[#0A0A0B] text-slate-300 font-sans selection:bg-rose-500/30"
            onContextMenu={(e) => e.preventDefault()}
        >

            {/* Sidebar Navigation */}
            <div className="w-64 border-r border-[#1C1C1E] bg-[#0E0E10] flex flex-col pt-6 pb-4 relative z-10">
                <div className="px-6 mb-10 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-500 to-rose-400 flex items-center justify-center shadow-[0_0_20px_rgba(244,63,94,0.4)]">
                                <Play className="w-4 h-4 text-white ml-0.5 fill-current" />
                            </div>
                            <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#0E0E10] rounded-full"></div>
                        </div>
                        <span className="font-bold text-lg text-white tracking-tight">Meraflow</span>
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-1 relative">
                    <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#2A2A2D]/50 text-rose-300 font-medium transition-colors border border-[#2A2A2D]">
                        <Home className="w-4 h-4" />
                        Home
                    </button>
                </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col bg-[#0A0A0B] relative overflow-hidden">

                {/* Top Header */}
                <header className="h-20 shrink-0 flex items-center justify-between px-10 border-b border-[#1C1C1E] bg-[#0A0A0B]/80 backdrop-blur-md relative z-10">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-white mb-1">Good Morning</h1>
                        <p className="text-sm text-slate-500 font-medium tracking-wide">Ready to capture your thoughts.</p>
                    </div>

                    <div className="flex items-center gap-3 bg-[#131315] border border-[#1C1C1E] rounded-full px-4 py-2 shadow-sm">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span className="text-[13px] font-medium text-slate-300">API Connected</span>
                    </div>
                </header>

                {/* History Feed */}
                <div className="flex-1 overflow-y-auto w-full p-10 relative z-10 custom-scrollbar">
                    <div className="max-w-3xl w-full mx-auto">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-sm font-semibold tracking-widest text-[#666666] uppercase">Today's Transcriptions</h2>
                            {history.length > 0 && (
                                <button onClick={clearHistory} className="text-[13px] font-medium text-slate-500 hover:text-rose-400 transition-colors flex items-center gap-1.5">
                                    <Trash2 className="w-3.5 h-3.5" /> Clear All
                                </button>
                            )}
                        </div>

                        {history.length === 0 ? (
                            <div className="mt-20 flex flex-col items-center justify-center text-center opacity-60">
                                <div className="w-20 h-20 rounded-full bg-[#1A1A1C] flex items-center justify-center mb-6 border border-[#2A2A2D]">
                                    <Clock className="w-8 h-8 text-[#4A4A4D]" />
                                </div>
                                <h3 className="text-lg font-medium text-white mb-2 tracking-tight">No history yet</h3>
                                <p className="text-sm text-[#888888] max-w-sm">Use the floating widget (<kbd className="bg-[#1A1A1C] border border-[#2A2A2D] rounded px-1.5 py-0.5 font-mono text-xs mx-1 text-slate-300">Ctrl+Shift+Space</kbd>) to start dictating seamlessly.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {history.map((item) => (
                                    <div key={item.id} className="group relative bg-[#131315] border border-[#1C1C1E] rounded-2xl p-6 hover:bg-[#1A1A1C] transition-all duration-300 hover:border-[#2A2A2D] shadow-sm hover:shadow-md">
                                        <p className="text-slate-200 text-[15px] pr-8 leading-relaxed font-medium">
                                            {item.text}
                                        </p>

                                        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[#1C1C1E] group-hover:border-[#2A2A2D] transition-colors">
                                            <div className="flex items-center text-[#555555] text-[12px] font-medium tracking-wide">
                                                <Clock className="w-3.5 h-3.5 mr-1.5 opacity-70" /> {item.timestamp}
                                            </div>

                                            <div className="flex-1" />

                                            {/* Copy Button */}
                                            <button
                                                onClick={() => copyItem(item.id, item.text)}
                                                className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500 hover:text-emerald-400 transition-colors bg-[#1A1A1C] border border-[#1C1C1E] rounded-md px-2.5 py-1"
                                            >
                                                {copiedId === item.id ? (
                                                    <><Check className="w-3.5 h-3.5" /> Copied</>
                                                ) : (
                                                    <><Copy className="w-3.5 h-3.5" /> Copy</>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
