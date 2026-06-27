import React, { useState, useRef, useEffect } from 'react';
import { 
  Video, 
  Image as ImageIcon, 
  Music, 
  Plus, 
  Sparkles, 
  Trash2, 
  FileVideo, 
  Compass, 
  Cpu, 
  FileText,
  Upload,
  AlertCircle,
  Type,
  Sliders,
  Filter,
  Check,
  Zap,
  Grid,
  Sun,
  Tv,
  Activity,
  Layers,
  Smile,
  Mic,
  Radio,
  Volume2
} from 'lucide-react';
import { MediaAsset, AIScriptResponse, Clip, VideoClip, TextClip, AudioClip, ImageClip } from '../types';

interface MediaLibraryProps {
  assets: MediaAsset[];
  onAddAsset: (asset: MediaAsset) => void;
  onDeleteAsset: (id: string) => void;
  onImportScriptToTimeline: (script: AIScriptResponse) => void;
  selectedClip?: Clip | null;
  onUpdateClip?: (clip: Clip) => void;
  onLoadTemplate?: (type: 'gaming' | 'podcast' | 'shorts') => void;
}

export default function MediaLibrary({ 
  assets, 
  onAddAsset, 
  onDeleteAsset,
  onImportScriptToTimeline,
  selectedClip,
  onUpdateClip,
  onLoadTemplate
}: MediaLibraryProps) {
  const clipAny = selectedClip as any;

  // VividCut-style Navigation Tabs
  const [activeCategory, setActiveCategory] = useState<'media' | 'audio' | 'text' | 'stickers' | 'effects' | 'transitions' | 'filters' | 'adjust'>('media');
  
  // Sub-tabs
  const [mediaSubTab, setMediaSubTab] = useState<'local' | 'library' | 'templates'>('local');
  const [audioSubTab, setAudioSubTab] = useState<'synth' | 'record'>('synth');
  const [textSubTab, setTextSubTab] = useState<'template' | 'ai'>('template');
  const [stickersSubTab, setStickersSubTab] = useState<'emoji' | 'badge'>('emoji');

  // Procedural assets creation states
  const [proceduralType, setProceduralType] = useState<'grid' | 'stars' | 'plasma' | 'gradient' | 'waves' | 'matrix'>('grid');
  const [proceduralName, setProceduralName] = useState('Retro Sunset Grid');
  
  // AI Script Assistant State
  const [aiPrompt, setAiPrompt] = useState('A dynamic cyberpunk trailer with futuristic neon grids and scrolling matrix code');
  const [aiLoading, setAiLoading] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<AIScriptResponse | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Voiceover Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);


  // Helper to safely handle property modification on active clip
  const handleClipPropChange = (key: string, value: any) => {
    if (!selectedClip || !onUpdateClip) return;
    const updated = {
      ...selectedClip,
      [key]: value
    } as Clip;
    onUpdateClip(updated);
  };

  // Add procedural asset to library
  const handleAddProcedural = () => {
    const newAsset: MediaAsset = {
      id: `proc_${Date.now()}`,
      name: proceduralName || `${proceduralType.toUpperCase()} Visual`,
      type: 'video',
      url: 'procedural',
      duration: 30,
      proceduralType
    };
    onAddAsset(newAsset);
    setProceduralName('');
  };

  // Add procedural audio asset
  const handleAddSynthAudio = (type: 'lofi' | 'techno' | 'ambient', name: string) => {
    const newAsset: MediaAsset = {
      id: `synth_${Date.now()}`,
      name,
      type: 'audio',
      url: 'synthesized',
      duration: 60,
      synthType: type
    };
    onAddAsset(newAsset);
  };

  // Local file upload handling
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      const type = file.type.split('/')[0];
      if (type === 'video' || type === 'image' || type === 'audio') {
        const objectUrl = URL.createObjectURL(file);
        const newAsset: MediaAsset = {
          id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          name: file.name,
          type: type as any,
          url: objectUrl,
          duration: type === 'image' ? 5 : 10
        };

        if (type === 'video' || type === 'audio') {
          const tempEl = document.createElement(type) as HTMLVideoElement | HTMLAudioElement;
          tempEl.src = objectUrl;
          tempEl.addEventListener('loadedmetadata', () => {
            if (tempEl.duration && tempEl.duration !== Infinity) {
              onDeleteAsset(newAsset.id);
              onAddAsset({ ...newAsset, duration: tempEl.duration });
            }
          });
        } else {
          onAddAsset(newAsset);
        }
      }
    });
  };

  // Voiceover Recording Methods
  const startRecordingFlow = async () => {
    try {
      setCountdown(3);
      let count = 3;
      const countInterval = setInterval(() => {
        count -= 1;
        if (count > 0) {
          setCountdown(count);
        } else {
          clearInterval(countInterval);
          setCountdown(null);
          executeStartRecording();
        }
      }, 1000);
    } catch (err) {
      console.error('Failed to start microphone recording:', err);
    }
  };

  const executeStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Add as media asset
        const recordName = `Voiceover_${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
        const duration = recordDuration || 5; // Fallback or computed
        const newAsset: MediaAsset = {
          id: `voiceover_${Date.now()}`,
          name: recordName,
          type: 'audio',
          url: audioUrl,
          duration: duration
        };
        onAddAsset(newAsset);

        // Also trigger auto insertion into track
        const customEvent = new CustomEvent('add-clip-to-timeline', { detail: newAsset });
        window.dispatchEvent(customEvent);
      };

      recorder.start();
      setIsRecording(true);
      setRecordDuration(0);

      // Setup timer
      timerRef.current = setInterval(() => {
        setRecordDuration(prev => prev + 1);
      }, 1000);

    } catch (err: any) {
      console.error(err);
      alert('Microphone access denied or error starting recording: ' + err.message);
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Call server route to generate Gemini script
  const generateAiScript = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError(null);
    setGeneratedScript(null);

    try {
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate screenplay.');
      }
      setGeneratedScript(data.data);
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'Error communicating with Gemini AI Server. Verify process.env.GEMINI_API_KEY is configured.');
    } finally {
      setAiLoading(false);
    }
  };

  const applyScriptToTimeline = () => {
    if (!generatedScript) return;
    onImportScriptToTimeline(generatedScript);
  };

  return (
    <div id="media-library-panel" className="bg-[#16161a] border-b border-[#28282e] md:border-b-0 md:border-r md:border-[#28282e] w-full md:w-[350px] flex flex-col h-[420px] md:h-full shrink-0 select-none">
      
      {/* 1. TOP VIVIDCUT HORIZONTAL CATEGORY SELECTORS */}
      <div className="grid grid-cols-8 border-b border-[#28282e] bg-[#121214] py-1">
        {[
          { id: 'media', label: 'Media', icon: Video },
          { id: 'audio', label: 'Audio', icon: Music },
          { id: 'text', label: 'Text', icon: Type },
          { id: 'stickers', label: 'Stickers', icon: Smile },
          { id: 'effects', label: 'Effects', icon: Sparkles },
          { id: 'transitions', label: 'Transitions', icon: Layers },
          { id: 'filters', label: 'Filters', icon: Filter },
          { id: 'adjust', label: 'Adjust', icon: Sliders }
        ].map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`flex flex-col items-center justify-center py-1 text-[8.5px] font-bold transition-all cursor-pointer ${
                isActive ? 'text-[#00C4D0]' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon size={13} className={isActive ? 'scale-110' : ''} />
              <span className="mt-0.5 scale-90">{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* 2. TAB SIDEBAR & CONTENT ROW */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Narrow Sub-Navigation Sidebar */}
        <div className="w-16 bg-[#121214] border-r border-[#28282e] flex flex-col items-center py-3 gap-2 shrink-0">
          {activeCategory === 'media' && (
            <>
              <button 
                onClick={() => setMediaSubTab('local')}
                className={`w-12 py-1.5 text-[10px] font-bold rounded flex flex-col items-center justify-center transition-all ${
                  mediaSubTab === 'local' ? 'bg-[#1e1e24] text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Upload size={12} className="mb-0.5" />
                Local
              </button>
              <button 
                onClick={() => setMediaSubTab('library')}
                className={`w-12 py-1.5 text-[10px] font-bold rounded flex flex-col items-center justify-center transition-all ${
                  mediaSubTab === 'library' ? 'bg-[#1e1e24] text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Compass size={12} className="mb-0.5" />
                Library
              </button>
              <button 
                id="tab-media-templates"
                onClick={() => setMediaSubTab('templates')}
                className={`w-12 py-1.5 text-[10px] font-bold rounded flex flex-col items-center justify-center transition-all ${
                  mediaSubTab === 'templates' ? 'bg-[#1e1e24] text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Grid size={12} className="mb-0.5" />
                Templates
              </button>
            </>
          )}

          {activeCategory === 'audio' && (
            <>
              <button 
                onClick={() => setAudioSubTab('synth')}
                className={`w-12 py-1.5 text-[10px] font-bold rounded flex flex-col items-center justify-center transition-all ${
                  audioSubTab === 'synth' ? 'bg-[#1e1e24] text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Music size={12} className="mb-0.5" />
                Synth
              </button>
              <button 
                onClick={() => setAudioSubTab('record')}
                className={`w-12 py-1.5 text-[10px] font-bold rounded flex flex-col items-center justify-center transition-all ${
                  audioSubTab === 'record' ? 'bg-[#1e1e24] text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Mic size={12} className="mb-0.5" />
                Record
              </button>
            </>
          )}

          {activeCategory === 'text' && (
            <>
              <button 
                onClick={() => setTextSubTab('template')}
                className={`w-12 py-1.5 text-[10px] font-bold rounded flex flex-col items-center justify-center transition-all ${
                  textSubTab === 'template' ? 'bg-[#1e1e24] text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Type size={12} className="mb-0.5" />
                Draft
              </button>
              <button 
                onClick={() => setTextSubTab('ai')}
                className={`w-12 py-1.5 text-[10px] font-bold rounded flex flex-col items-center justify-center transition-all ${
                  textSubTab === 'ai' ? 'bg-[#1e1e24] text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Sparkles size={12} className="mb-0.5" />
                AI Writer
              </button>
            </>
          )}

          {activeCategory === 'stickers' && (
            <>
              <button 
                onClick={() => setStickersSubTab('emoji')}
                className={`w-12 py-1.5 text-[10px] font-bold rounded flex flex-col items-center justify-center transition-all ${
                  stickersSubTab === 'emoji' ? 'bg-[#1e1e24] text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Smile size={12} className="mb-0.5" />
                Emoji
              </button>
              <button 
                onClick={() => setStickersSubTab('badge')}
                className={`w-12 py-1.5 text-[10px] font-bold rounded flex flex-col items-center justify-center transition-all ${
                  stickersSubTab === 'badge' ? 'bg-[#1e1e24] text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Grid size={12} className="mb-0.5" />
                Badge
              </button>
            </>
          )}

          {activeCategory === 'effects' && (
            <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest rotate-270 py-6 whitespace-nowrap scale-90 origin-center">
              STYLING
            </div>
          )}

          {activeCategory === 'transitions' && (
            <div className="text-[10px] font-black text-yellow-500 uppercase tracking-widest rotate-270 py-6 whitespace-nowrap scale-90 origin-center">
              DYNAMICS
            </div>
          )}

          {activeCategory === 'filters' && (
            <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest rotate-270 py-6 whitespace-nowrap scale-90 origin-center">
              LUTS
            </div>
          )}

          {activeCategory === 'adjust' && (
            <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest rotate-270 py-6 whitespace-nowrap scale-90 origin-center">
              COLOR
            </div>
          )}
        </div>

        {/* Right Main Content Block */}
        <div className="flex-1 p-3 overflow-y-auto bg-[#16161a] flex flex-col gap-3">
          
          {/* CATEGORY: MEDIA */}
          {activeCategory === 'media' && (
            <>
              {mediaSubTab === 'local' ? (
                <div className="flex flex-col gap-3 h-full">
                  {/* Local drag drop zone */}
                  <label className="border border-dashed border-[#28282e] hover:border-[#3d3d46] rounded-lg p-3.5 flex flex-col items-center justify-center text-center cursor-pointer bg-[#121214] transition-all group">
                    <Upload size={20} className="text-[#00C4D0] mb-1.5 group-hover:scale-110 transition-transform" />
                    <span className="text-[11px] text-slate-200 font-bold">Import Material</span>
                    <span className="text-[9px] text-slate-500 mt-0.5">Drag files or click here</span>
                    <input
                      id="vividcut-uploader-input"
                      type="file"
                      multiple
                      accept="video/*,image/*,audio/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  {/* List Local Uploaded Assets */}
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Local Materials ({assets.length})</span>
                    </div>

                    {assets.length === 0 ? (
                      <div className="text-center py-10 text-slate-600 text-xs font-medium">
                        Shelf is currently empty.<br />Upload media clips to populate!
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5 max-h-[190px] md:max-h-none overflow-y-auto pr-0.5">
                        {assets.map((asset) => (
                          <div 
                            key={asset.id} 
                            className="bg-[#121214] rounded border border-[#28282e] p-1.5 flex items-center justify-between group hover:border-[#00C4D0]/40 transition-colors"
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <div className="w-7 h-7 rounded bg-[#18181c] border border-[#28282e] flex items-center justify-center shrink-0">
                                {asset.type === 'video' && <Video size={12} className="text-indigo-400" />}
                                {asset.type === 'image' && <ImageIcon size={12} className="text-blue-500" />}
                                {asset.type === 'audio' && <Music size={12} className="text-emerald-500" />}
                              </div>
                              <div className="text-left overflow-hidden">
                                <p className="text-[11px] text-slate-200 font-semibold truncate max-w-[150px]">{asset.name}</p>
                                <span className="text-[9px] text-slate-500 block leading-none mt-0.5">
                                  {asset.type.toUpperCase()} • {asset.duration.toFixed(1)}s
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                title="Insert into project"
                                onClick={() => {
                                  const customEvent = new CustomEvent('add-clip-to-timeline', { detail: asset });
                                  window.dispatchEvent(customEvent);
                                }}
                                className="p-1 bg-[#232326] hover:bg-[#00C4D0] hover:text-black rounded text-slate-300 cursor-pointer transition-colors"
                              >
                                <Plus size={11} />
                              </button>
                              <button
                                title="Delete item"
                                onClick={() => onDeleteAsset(asset.id)}
                                className="p-1 hover:bg-[#232326] rounded text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : mediaSubTab === 'library' ? (
                <div className="flex flex-col gap-3">
                  <div className="bg-[#121214] p-3 rounded-lg border border-[#28282e]">
                    <span className="text-[10px] font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                      <Compass size={12} className="text-[#00C4D0]" />
                      Procedural Generator
                    </span>
                    <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                      Render dynamic, fluid canvas loops that scale mathematically on frame updates.
                    </p>

                    <div className="flex flex-col gap-2 mt-3">
                      <div>
                        <label className="text-[9px] text-slate-400 block mb-1">Animation Type</label>
                        <select
                          value={proceduralType}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            setProceduralType(val);
                            const defaults = {
                              grid: 'Retro Sunset Grid',
                              stars: 'Deep Starfield Voyage',
                              plasma: 'Psychedelic Plasma Flow',
                              gradient: 'Liquid Blob Gradients',
                              waves: 'Sine Wave Crests',
                              matrix: 'Emerald Matrix Rain'
                            };
                            setProceduralName(defaults[val] || 'Custom Loop');
                          }}
                          className="w-full bg-[#18181c] border border-[#28282e] rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-[#00C4D0]"
                        >
                          <option value="grid">Grid Retro-Wave</option>
                          <option value="stars">Cosmic Starfield</option>
                          <option value="plasma">Plasma Liquid Swirl</option>
                          <option value="gradient">Drifting Soft Gradients</option>
                          <option value="waves">Overlapping Sine Waves</option>
                          <option value="matrix">Matrix Digital Rain</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[9px] text-slate-400 block mb-1">Material Title</label>
                        <input
                          type="text"
                          value={proceduralName}
                          onChange={(e) => setProceduralName(e.target.value)}
                          className="w-full bg-[#18181c] border border-[#28282e] rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-[#00C4D0]"
                        />
                      </div>

                      <button
                        onClick={handleAddProcedural}
                        className="w-full mt-2 py-1.5 bg-[#00C4D0] hover:bg-[#00b0ba] text-black font-black text-xs rounded transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow"
                      >
                        <Plus size={12} /> Add to Stock Shelf
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="bg-[#121214] p-3 rounded-lg border border-[#28282e]">
                    <span className="text-[10px] font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                      <Zap size={12} className="text-[#00C4D0]" />
                      Creative Project Templates
                    </span>
                    <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                      Instantly rebuild the editor timeline with fully customized tracks, visual layers, sound beats, and custom aspect ratios.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {[
                      {
                        id: 'gaming',
                        name: '🎮 Gaming Intro',
                        desc: 'Neon starfields, glitch titles, and energetic techno beats. (12s, Landscape 16:9)',
                        bg: 'from-orange-950/40 to-pink-950/40 border-orange-900/40'
                      },
                      {
                        id: 'podcast',
                        name: '🎙️ Podcast Intro',
                        desc: 'Elegant waves, clean titles, and chill lo-fi beats. (18s, Landscape 16:9)',
                        bg: 'from-blue-950/40 to-teal-950/40 border-blue-900/40'
                      },
                      {
                        id: 'shorts',
                        name: '📱 YouTube Shorts',
                        desc: 'Warm sunset grid, vertical 9:16 aspect ratio, cinematic ambient synth. (15s, Vertical 9:16)',
                        bg: 'from-violet-950/40 to-fuchsia-950/40 border-violet-900/40'
                      }
                    ].map((tpl) => (
                      <button
                        key={tpl.id}
                        onClick={() => onLoadTemplate?.(tpl.id as any)}
                        className={`w-full text-left p-3 rounded-lg border bg-gradient-to-r ${tpl.bg} hover:border-[#00C4D0]/60 active:scale-95 transition-all cursor-pointer group`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-slate-100 group-hover:text-[#00C4D0] transition-colors">{tpl.name}</span>
                          <span className="text-[9px] bg-black/40 text-slate-300 px-1.5 py-0.5 rounded font-mono">Load Preset</span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-normal">{tpl.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* CATEGORY: AUDIO */}
          {activeCategory === 'audio' && (
            <>
              {audioSubTab === 'synth' ? (
                <div className="flex flex-col gap-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Procedural Music Synthesizer</span>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Generates high-fidelity loop beats using synthesized oscillator oscillators and frequency gains inside the AudioCtx.
                  </p>

                  <div className="flex flex-col gap-2 mt-1.5">
                    {[
                      { type: 'lofi', label: 'Lo-Fi Jazz Beat', desc: 'Chill beats with synth electric piano chords', color: 'bg-emerald-500' },
                      { type: 'techno', label: 'Techno Acid Loop', desc: 'Sizzling acid basslines and 4/4 kicks', color: 'bg-purple-500' },
                      { type: 'ambient', label: 'Meditative Pad', desc: 'Slow, lush detuned oscillator drones', color: 'bg-blue-500' }
                    ].map((s) => (
                      <button
                        key={s.type}
                        onClick={() => handleAddSynthAudio(s.type as any, s.label)}
                        className="w-full p-2 bg-[#121214] hover:bg-[#1e1e24] border border-[#28282e] rounded text-left flex items-center justify-between group transition-colors cursor-pointer"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${s.color}`} />
                            <span className="text-xs font-bold text-slate-200">{s.label}</span>
                          </div>
                          <span className="text-[9px] text-slate-500 block mt-0.5">{s.desc}</span>
                        </div>
                        <Plus size={11} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="bg-[#121214] p-3 rounded-lg border border-[#28282e]">
                    <span className="text-[10px] font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                      <Mic size={12} className="text-[#00C4D0]" />
                      Voiceover Studio
                    </span>
                    <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                      Record voiceovers and audio annotations directly from your microphone into the active timeline track.
                    </p>

                    <div className="mt-4 flex flex-col items-center justify-center p-4 bg-[#18181c] rounded-lg border border-[#232326] relative overflow-hidden">
                      {countdown !== null ? (
                        <div className="flex flex-col items-center justify-center animate-pulse py-4">
                          <span className="text-4xl font-black text-red-500">{countdown}</span>
                          <span className="text-[9px] uppercase tracking-widest text-red-400 font-bold mt-2">Get Ready...</span>
                        </div>
                      ) : isRecording ? (
                        <div className="flex flex-col items-center justify-center py-2 w-full">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
                            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">LIVE RECORDING</span>
                          </div>
                          <span className="text-2xl font-mono font-bold text-slate-200">
                            {Math.floor(recordDuration / 60)}:{(recordDuration % 60).toString().padStart(2, '0')}
                          </span>
                          <p className="text-[9px] text-slate-500 mt-1.5 mb-4 text-center">
                            Speak clearly. Tap stop when finished.
                          </p>

                          <button
                            onClick={stopRecording}
                            className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-full transition-colors flex items-center gap-1.5 cursor-pointer shadow shadow-red-950"
                          >
                            <Radio size={12} className="animate-spin" /> Stop Voiceover
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-2 w-full text-center">
                          <div className="w-12 h-12 rounded-full bg-[#232326] border border-[#28282e] flex items-center justify-center text-slate-400 mb-3">
                            <Mic size={20} />
                          </div>
                          <span className="text-xs font-bold text-slate-300">Microphone Ready</span>
                          <p className="text-[9px] text-slate-500 mt-1 mb-4 max-w-[200px]">
                            Permissions will be requested when recording starts.
                          </p>

                          <button
                            onClick={startRecordingFlow}
                            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-full transition-colors flex items-center gap-1.5 cursor-pointer shadow shadow-indigo-950"
                          >
                            <Mic size={12} /> Start Voiceover
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* CATEGORY: TEXT */}
          {activeCategory === 'text' && (
            <>
              {textSubTab === 'template' ? (
                <div className="flex flex-col gap-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Custom Text Overlay</span>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Create rich text overlay templates with custom animations and font properties.
                  </p>

                  <button
                    onClick={() => {
                      // Trigger global overlay creation event inside active clip
                      const customEvent = new CustomEvent('add-clip-to-timeline', { 
                        detail: {
                          id: `temp_text_${Date.now()}`,
                          name: 'Custom Overlay Subtitle',
                          type: 'text',
                          duration: 5,
                          url: 'text'
                        }
                      });
                      window.dispatchEvent(customEvent);
                    }}
                    className="w-full mt-1.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow"
                  >
                    <Plus size={13} />
                    Insert Text Box
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="bg-[#121214] p-3 rounded-lg border border-[#28282e]">
                    <span className="text-[10px] font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                      <Sparkles size={12} className="text-[#00C4D0]" />
                      AI Video Assembler
                    </span>
                    <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                      Provide a theme prompt. Gemini AI will compose a full multi-scene storyboard, captions, and soundtracks, then automatically arrange them!
                    </p>

                    <div className="mt-3 flex flex-col gap-2.5">
                      <textarea
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="E.g. A retro neon synthwave ride..."
                        rows={3}
                        className="w-full bg-[#18181c] border border-[#28282e] rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-[#00C4D0] resize-none leading-relaxed"
                      />

                      <button
                        disabled={aiLoading}
                        onClick={generateAiScript}
                        className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow"
                      >
                        {aiLoading ? (
                          <>
                            <span className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></span>
                            Assembling Script...
                          </>
                        ) : (
                          <>
                            <Cpu size={12} />
                            Generate Script
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {aiError && (
                    <div className="bg-red-950/40 border border-red-900/60 rounded p-2 text-red-400 text-[10px] leading-relaxed flex gap-1.5">
                      <AlertCircle size={13} className="shrink-0 mt-0.5" />
                      <span>{aiError}</span>
                    </div>
                  )}

                  {generatedScript && (
                    <div className="bg-[#121214] p-3 rounded-lg border border-[#28282e] animate-fadeIn flex flex-col gap-2">
                      <div className="border-b border-[#28282e] pb-1.5">
                        <span className="text-[8px] font-bold text-indigo-400 bg-indigo-950 px-1 py-0.5 rounded">Assembled Screenplay</span>
                        <h5 className="text-xs font-bold text-slate-200 mt-1.5">{generatedScript.title}</h5>
                        <p className="text-[9px] text-slate-500 italic mt-0.5">"{generatedScript.overview}"</p>
                      </div>

                      <button
                        onClick={applyScriptToTimeline}
                        className="w-full mt-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded transition-colors flex items-center justify-center gap-1 cursor-pointer shadow"
                      >
                        <Plus size={12} /> Auto-Assemble Tracks
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* CATEGORY: STICKERS */}
          {activeCategory === 'stickers' && (
            <div className="flex flex-col gap-2.5">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                {stickersSubTab === 'emoji' ? 'Decorative Emoji Overlays' : 'Vivid Badge Decals'}
              </span>
              <p className="text-[10px] text-slate-500 leading-normal">
                Click any sticker below to place it onto your active project timeline. Emojis and Badges support full keyframe motion pathways!
              </p>

              {stickersSubTab === 'emoji' ? (
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {[
                    { char: '🔥', name: 'Fire' },
                    { char: '💖', name: 'Heart' },
                    { char: '🚀', name: 'Rocket' },
                    { char: '😂', name: 'Laughing' },
                    { char: '🎉', name: 'Celebration' },
                    { char: '🌟', name: 'Star' },
                    { char: '👾', name: 'Alien' },
                    { char: '🎨', name: 'Palette' },
                    { char: '🌈', name: 'Rainbow' },
                    { char: '⚡', name: 'Lightning' },
                    { char: '👑', name: 'Crown' },
                    { char: '💥', name: 'BOOM!' },
                    { char: '💡', name: 'Idea' },
                    { char: '💎', name: 'Diamond' },
                    { char: '🍕', name: 'Pizza' },
                    { char: '🍒', name: 'Cherries' }
                  ].map((s) => (
                    <button
                      key={s.char}
                      onClick={() => {
                        const customEvent = new CustomEvent('add-clip-to-timeline', { 
                          detail: {
                            id: `sticker_${Date.now()}`,
                            name: `${s.name} Sticker`,
                            type: 'text',
                            text: s.char,
                            duration: 4,
                            fontSize: 72,
                            color: '#ffffff',
                            backgroundColor: 'transparent',
                            alignment: 'center',
                            animation: 'zoom',
                            positionY: 50
                          }
                        });
                        window.dispatchEvent(customEvent);
                      }}
                      className="aspect-square bg-[#121214] hover:bg-[#1e1e24] border border-[#28282e] hover:border-[#00C4D0]/50 rounded-lg flex items-center justify-center text-3xl transition-all cursor-pointer transform hover:scale-105 active:scale-95"
                      title={s.name}
                    >
                      {s.char}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2 mt-1">
                  {[
                    { text: 'VLOG', color: '#ef4444', preset: 'neon' as const },
                    { text: 'LIVE', color: '#22c55e', preset: 'neon' as const },
                    { text: 'OMG!', color: '#eab308', preset: 'cyber' as const },
                    { text: 'PRO', color: '#3b82f6', preset: 'cyber' as const },
                    { text: 'NEW', color: '#a855f7', preset: 'cyber' as const },
                    { text: 'BANGER', color: '#f97316', preset: 'subtitles' as const },
                    { text: 'ALERT', color: '#f43f5e', preset: 'subtitles' as const },
                    { text: 'COOL', color: '#06b6d4', preset: 'vintage' as const }
                  ].map((b) => (
                    <button
                      key={b.text}
                      onClick={() => {
                        const customEvent = new CustomEvent('add-clip-to-timeline', { 
                          detail: {
                            id: `sticker_${Date.now()}`,
                            name: `${b.text} Badge`,
                            type: 'text',
                            text: b.text,
                            duration: 4,
                            fontSize: 32,
                            color: '#ffffff',
                            backgroundColor: b.color,
                            alignment: 'center',
                            animation: 'slide',
                            positionY: 30,
                            stylePreset: b.preset
                          }
                        });
                        window.dispatchEvent(customEvent);
                      }}
                      className="w-full py-2 bg-[#121214] hover:bg-[#1e1e24] border border-[#28282e] hover:border-[#00C4D0]/40 rounded-lg text-left px-3 flex items-center justify-between group transition-colors cursor-pointer"
                    >
                      <span 
                        className="px-2 py-0.5 rounded text-[11px] font-black tracking-widest text-white shrink-0"
                        style={{ backgroundColor: b.color }}
                      >
                        {b.text}
                      </span>
                      <span className="text-[10px] text-slate-500 group-hover:text-slate-300 transition-colors flex items-center gap-1">
                        Insert Badge <Plus size={11} />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CATEGORY: EFFECTS */}
          {activeCategory === 'effects' && (
            <div className="flex flex-col gap-2.5">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Creative Lens Effects</span>
              
              {!selectedClip ? (
                <div className="text-center py-10 text-slate-600 text-xs font-medium">
                  Select a clip on the timeline<br />to apply live lens FX!
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="text-[10px] text-[#00C4D0] font-bold">
                    Editing Selected: "{selectedClip.name}"
                  </div>

                  <div className="grid grid-cols-1 gap-2 mt-1">
                    {[
                      { key: 'effectMirror', label: 'Mirror Horizontal', desc: 'Flip clip frame horizontally', icon: Tv },
                      { key: 'effectVignette', label: 'Cinema Vignette', desc: 'Soft dark radial corners shade', icon: Compass },
                      { key: 'effectFilmGrain', label: '35mm Film Grain', desc: 'Vintage camera organic noise particles', icon: Activity },
                      { key: 'effectScanlines', label: 'Analog CRT Scanlines', desc: 'Retro television horizontal grill', icon: Layers },
                      { key: 'effectGlitch', label: 'Digital Signal Glitch', desc: 'Random RGB horizontal screen slices', icon: Sparkles }
                    ].map((fx) => {
                      const Icon = fx.icon;
                      const isEnabled = !!(selectedClip as any)[fx.key];
                      return (
                        <button
                          key={fx.key}
                          onClick={() => handleClipPropChange(fx.key, !isEnabled)}
                          className={`w-full p-2.5 border rounded-lg text-left flex items-center justify-between transition-all cursor-pointer ${
                            isEnabled 
                              ? 'bg-indigo-950/40 border-indigo-500 text-slate-200' 
                              : 'bg-[#121214] border-[#28282e] text-slate-400 hover:text-slate-200 hover:border-[#3d3d46]'
                          }`}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <div className={`p-1.5 rounded ${isEnabled ? 'bg-indigo-600 text-white' : 'bg-[#1a1a1f] text-slate-400'}`}>
                              <Icon size={12} />
                            </div>
                            <div className="text-left overflow-hidden">
                              <span className="text-[11px] font-bold block">{fx.label}</span>
                              <span className="text-[9px] text-slate-500 block truncate">{fx.desc}</span>
                            </div>
                          </div>
                          
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                            isEnabled ? 'border-indigo-400 bg-indigo-500 text-white' : 'border-slate-600 bg-transparent'
                          }`}>
                            {isEnabled && <Check size={8} strokeWidth={4} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CATEGORY: TRANSITIONS */}
          {activeCategory === 'transitions' && (
            <div className="flex flex-col gap-2.5">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Track Cross-Clip Transitions</span>
              
              {!selectedClip ? (
                <div className="text-center py-10 text-slate-600 text-xs font-medium">
                  Select a clip on the timeline<br />to apply cross-clip transitions!
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <div className="text-[10px] text-yellow-500 font-bold">
                    Setting transition for: "{selectedClip.name}"
                  </div>
                  
                  <p className="text-[10px] text-slate-500 leading-normal">
                    This transition plays at the boundary when this clip connects to the next contiguous clip on the same track lane.
                  </p>

                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {[
                      { type: 'none', label: 'Standard Cut', desc: 'Instant frame cut' },
                      { type: 'fade', label: 'Dip to Black', desc: 'Classic fade down' },
                      { type: 'dissolve', label: 'Cross-Fade', desc: 'Overlay alpha mix' },
                      { type: 'slide', label: 'Slide Push', desc: 'Push side transition' },
                      { type: 'wipe', label: 'Linear Wipe', desc: 'Sweep left to right' }
                    ].map((t) => {
                      const isCurrent = (selectedClip.transitionType || 'none') === t.type;
                      return (
                        <button
                          key={t.type}
                          onClick={() => {
                            handleClipPropChange('transitionType', t.type);
                            if (t.type !== 'none' && !selectedClip.transitionDuration) {
                              handleClipPropChange('transitionDuration', 1.0);
                            }
                          }}
                          className={`p-2 rounded-lg border text-left flex flex-col justify-between transition-all cursor-pointer h-[54px] ${
                            isCurrent 
                              ? 'bg-yellow-950/20 border-yellow-500 text-yellow-300' 
                              : 'bg-[#121214] border-[#28282e] text-slate-400 hover:text-slate-200 hover:border-[#3d3d46]'
                          }`}
                        >
                          <span className="text-[11px] font-bold block">{t.label}</span>
                          <span className="text-[9px] text-slate-500 mt-0.5 leading-none block truncate">{t.desc}</span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedClip.transitionType && selectedClip.transitionType !== 'none' && (
                    <div className="bg-[#121214] p-2 rounded-lg border border-[#28282e] mt-1.5">
                      <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                        <span>Transition Duration</span>
                        <span className="font-mono text-[9px] text-yellow-400">{(selectedClip.transitionDuration ?? 1.0).toFixed(1)}s</span>
                      </div>
                      <input
                        type="range"
                        min="0.2"
                        max="2.0"
                        step="0.1"
                        value={selectedClip.transitionDuration ?? 1.0}
                        onChange={(e) => handleClipPropChange('transitionDuration', parseFloat(e.target.value))}
                        className="w-full accent-yellow-500 h-1 rounded-full cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* CATEGORY: FILTERS */}
          {activeCategory === 'filters' && (
            <div className="flex flex-col gap-2.5">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Visual LUT Presets</span>
              
              {!selectedClip ? (
                <div className="text-center py-10 text-slate-600 text-xs font-medium">
                  Select a clip on the timeline<br />to apply a visual filter LUT!
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="text-[10px] text-rose-400 font-bold">
                    Editing Filter on: "{selectedClip.name}"
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    {[
                      { type: 'none', label: 'Original', color: 'from-slate-700 to-slate-800' },
                      { type: 'vhs', label: 'VHS Vintage', color: 'from-purple-900 to-indigo-950' },
                      { type: 'cool', label: 'Slate Cool', color: 'from-cyan-900 to-slate-900' },
                      { type: 'warm', label: 'Amber Warm', color: 'from-amber-900 to-rose-950' },
                      { type: 'grayscale', label: 'B&W Noir', color: 'from-zinc-800 to-zinc-950' },
                      { type: 'sepia', label: 'Retro Sepia', color: 'from-yellow-950 to-amber-950' },
                      { type: 'invert', label: 'Neg Invert', color: 'from-lime-950 to-teal-950' },
                      { type: 'hue-rotate', label: 'Psychedelic', color: 'from-pink-900 to-violet-950' }
                    ].map((filter) => {
                      const isCurrent = (clipAny?.filter || 'none') === filter.type;
                      return (
                        <button
                          key={filter.type}
                          onClick={() => handleClipPropChange('filter', filter.type)}
                          className={`relative h-[48px] rounded-lg overflow-hidden border text-left p-2 flex flex-col justify-end transition-all cursor-pointer bg-gradient-to-br ${filter.color} ${
                            isCurrent 
                              ? 'border-rose-400 ring-2 ring-rose-300/20' 
                              : 'border-[#28282e] hover:scale-[1.02]'
                          }`}
                        >
                          <span className="text-[10px] font-bold text-white z-10">{filter.label}</span>
                          <div className="absolute inset-0 bg-black/35 z-0" />
                          {isCurrent && (
                            <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-rose-500 border border-white text-white flex items-center justify-center z-10">
                              <Check size={8} strokeWidth={4} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CATEGORY: ADJUST */}
          {activeCategory === 'adjust' && (
            <div className="flex flex-col gap-2.5">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Precision Color LUT Adjustments</span>
              
              {!selectedClip ? (
                <div className="text-center py-10 text-slate-600 text-xs font-medium">
                  Select a clip on the timeline<br />to edit brightness, contrast, and saturation!
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="text-[10px] text-emerald-400 font-bold">
                    Adjusting Colors: "{selectedClip.name}"
                  </div>

                  <div className="flex flex-col gap-3 mt-1.5">
                    {/* Brightness */}
                    <div className="bg-[#121214] p-2.5 rounded-lg border border-[#28282e]">
                      <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                        <span className="flex items-center gap-1">
                          <Sun size={11} className="text-yellow-400" />
                          Brightness
                        </span>
                        <span className="font-mono text-[9px] text-emerald-400">{clipAny?.brightness ?? 100}%</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="150"
                        value={clipAny?.brightness ?? 100}
                        onChange={(e) => handleClipPropChange('brightness', parseInt(e.target.value))}
                        className="w-full accent-emerald-400 h-1 rounded-full cursor-pointer"
                      />
                    </div>

                    {/* Contrast */}
                    <div className="bg-[#121214] p-2.5 rounded-lg border border-[#28282e]">
                      <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                        <span className="flex items-center gap-1">
                          <Sliders size={11} className="text-indigo-400" />
                          Contrast
                        </span>
                        <span className="font-mono text-[9px] text-emerald-400">{clipAny?.contrast ?? 100}%</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="150"
                        value={clipAny?.contrast ?? 100}
                        onChange={(e) => handleClipPropChange('contrast', parseInt(e.target.value))}
                        className="w-full accent-emerald-400 h-1 rounded-full cursor-pointer"
                      />
                    </div>

                    {/* Saturation */}
                    <div className="bg-[#121214] p-2.5 rounded-lg border border-[#28282e]">
                      <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                        <span className="flex items-center gap-1">
                          <Sliders size={11} className="text-rose-400" />
                          Saturation
                        </span>
                        <span className="font-mono text-[9px] text-emerald-400">{clipAny?.saturation ?? 100}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="200"
                        value={clipAny?.saturation ?? 100}
                        onChange={(e) => handleClipPropChange('saturation', parseInt(e.target.value))}
                        className="w-full accent-emerald-400 h-1 rounded-full cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
