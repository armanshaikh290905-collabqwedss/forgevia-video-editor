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
import { drawProceduralFrame, ProceduralAudioEngine } from '../utils/procedural';

// Beautiful live animated micro-canvas for procedural clips
function ProceduralThumbnail({ type, className, isHovered }: { type: any; className?: string; isHovered?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef(Date.now());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    lastTimeRef.current = Date.now();

    const render = () => {
      const now = Date.now();
      const deltaTime = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      // Subtle slow movement when resting, fully animated at 60fps on hover
      const speed = isHovered ? 1.2 : 0.05;
      elapsedRef.current += deltaTime * speed;

      drawProceduralFrame(ctx, type, elapsedRef.current, canvas.width, canvas.height);
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [type, isHovered]);

  return (
    <canvas 
      ref={canvasRef} 
      width={128} 
      height={72} 
      className={className} 
    />
  );
}

// Minimalist vector scene for rendering effects live previews
const MiniScene = () => (
  <svg viewBox="0 0 100 60" className="w-full h-full object-cover rounded">
    <defs>
      <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#f43f5e" />
        <stop offset="100%" stopColor="#e11d48" />
      </linearGradient>
    </defs>
    <rect width="100" height="60" fill="url(#skyGrad)" />
    <circle cx="50" cy="35" r="14" fill="#facc15" />
    <path d="M 0 60 L 32 32 L 64 60 Z" fill="#1e1b4b" opacity="0.8" />
    <path d="M 38 60 L 68 26 L 100 60 Z" fill="#1e1b4b" />
  </svg>
);

// Deterministic waveform helper for audio previews
const renderWaveform = (id: string, colorClass: string = 'bg-emerald-500/70', isPlaying: boolean = false) => {
  const bars = 22;
  const h = [];
  let seed = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  for (let i = 0; i < bars; i++) {
    const amplitude = 0.2 + 0.8 * Math.sin((i / (bars - 1)) * Math.PI);
    seed = (seed * 9301 + 49297) % 233280;
    const rnd = seed / 233280;
    const height = Math.max(15, Math.min(100, (25 + rnd * 75) * amplitude));
    h.push(height);
  }
  return (
    <div className="flex items-end gap-[1.5px] h-full justify-center px-1.5 py-0.5">
      {h.map((val, idx) => {
        const delay = (idx % 6) * 0.12;
        const duration = 0.5 + (idx % 4) * 0.15;
        return (
          <span 
            key={idx} 
            className={`w-[2.5px] rounded-full transition-all duration-300 ${colorClass}`}
            style={{ 
              height: `${val}%`,
              animation: isPlaying ? `wave-bounce ${duration}s ease-in-out infinite` : 'none',
              animationDelay: isPlaying ? `${delay}s` : 'none',
              transformOrigin: 'bottom'
            }} 
          />
        );
      })}
    </div>
  );
};

interface MediaLibraryProps {
  assets: MediaAsset[];
  onAddAsset: (asset: MediaAsset) => void;
  onDeleteAsset: (id: string) => void;
  onImportScriptToTimeline: (script: AIScriptResponse) => void;
  selectedClip?: Clip | null;
  onUpdateClip?: (clip: Clip) => void;
  onLoadTemplate?: (type: 'gaming' | 'podcast' | 'shorts') => void;
  width?: number;
  isResizing?: boolean;
  style?: React.CSSProperties;
}

export default function MediaLibrary({ 
  assets, 
  onAddAsset, 
  onDeleteAsset,
  onImportScriptToTimeline,
  selectedClip,
  onUpdateClip,
  onLoadTemplate,
  width,
  isResizing,
  style
}: MediaLibraryProps) {
  const clipAny = selectedClip as any;

  // Responsive layout width detection
  const libraryWidth = width ?? 350;
  const isCompact = libraryWidth < 280;
  const isWide = libraryWidth >= 420;

  // Responsive grid column counts
  const cols2 = isCompact ? 'grid-cols-1' : (libraryWidth >= 550 ? 'grid-cols-4' : (libraryWidth >= 400 ? 'grid-cols-3' : 'grid-cols-2'));
  const colsStickers = isCompact ? 'grid-cols-2' : (libraryWidth >= 550 ? 'grid-cols-6' : (libraryWidth >= 400 ? 'grid-cols-5' : 'grid-cols-4'));

  // VividCut-style Navigation Tabs
  const [activeCategory, setActiveCategory] = useState<'media' | 'audio' | 'text' | 'stickers' | 'effects' | 'transitions' | 'filters' | 'adjust'>('media');
  
  // Sub-tabs
  const [mediaSubTab, setMediaSubTab] = useState<'local' | 'library' | 'templates'>('local');
  const [audioSubTab, setAudioSubTab] = useState<'synth' | 'record'>('synth');
  const [textSubTab, setTextSubTab] = useState<'template' | 'ai'>('template');
  const [stickersSubTab, setStickersSubTab] = useState<'emoji' | 'badge'>('emoji');

  // Shared state and refs for playing audio previews on hover
  const [activeHoverAudioId, setActiveHoverAudioId] = useState<string | null>(null);
  const [hoveredAssetId, setHoveredAssetId] = useState<string | null>(null);
  const hoverAudioSourceRef = useRef<HTMLAudioElement | null>(null);
  const hoverAudioSynthRef = useRef<ProceduralAudioEngine | null>(null);
  const hoverAudioTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 1. Clean up any currently playing previews and timers
    if (hoverAudioTimeoutRef.current) {
      clearTimeout(hoverAudioTimeoutRef.current);
      hoverAudioTimeoutRef.current = null;
    }
    if (hoverAudioSourceRef.current) {
      try {
        hoverAudioSourceRef.current.pause();
        hoverAudioSourceRef.current.src = "";
      } catch (e) {}
      hoverAudioSourceRef.current = null;
    }
    if (hoverAudioSynthRef.current) {
      try {
        hoverAudioSynthRef.current.stop();
      } catch (e) {}
      hoverAudioSynthRef.current = null;
    }

    if (!activeHoverAudioId) return;

    // 2. Play the new sound preview
    if (activeHoverAudioId.startsWith('synth_')) {
      const type = activeHoverAudioId.replace('synth_', '') as 'lofi' | 'techno' | 'ambient';
      try {
        const engine = new ProceduralAudioEngine();
        hoverAudioSynthRef.current = engine;
        engine.init();
        engine.setVolume(0.12); // Elegant, comfortable volume
        engine.setLoop(type);

        // Preview is limited to first few seconds (4 seconds)
        hoverAudioTimeoutRef.current = setTimeout(() => {
          if (hoverAudioSynthRef.current) {
            hoverAudioSynthRef.current.stop();
          }
        }, 4000);
      } catch (e) {
        console.warn('Procedural synth engine blocked or failed:', e);
      }
    } else {
      // Find standard audio asset
      const asset = assets.find(a => a.id === activeHoverAudioId);
      if (asset && asset.type === 'audio' && asset.url && asset.url !== 'synthesized') {
        try {
          const audio = new Audio(asset.url);
          audio.volume = 0.15;
          hoverAudioSourceRef.current = audio;
          audio.play().catch(e => {
            console.warn('HTML5 audio play blocked:', e);
          });

          // Play first few seconds (4 seconds)
          hoverAudioTimeoutRef.current = setTimeout(() => {
            if (hoverAudioSourceRef.current) {
              hoverAudioSourceRef.current.pause();
            }
          }, 4000);
        } catch (e) {
          console.warn('HTML5 audio load failed:', e);
        }
      }
    }

    return () => {
      if (hoverAudioTimeoutRef.current) {
        clearTimeout(hoverAudioTimeoutRef.current);
      }
      if (hoverAudioSourceRef.current) {
        try {
          hoverAudioSourceRef.current.pause();
        } catch (e) {}
      }
      if (hoverAudioSynthRef.current) {
        try {
          hoverAudioSynthRef.current.stop();
        } catch (e) {}
      }
    };
  }, [activeHoverAudioId, assets]);

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

  const handleDragStart = (e: React.DragEvent, itemType: string, data: any) => {
    const dragPayload = { itemType, data };
    (window as any).VividCutDraggedItem = dragPayload;
    e.dataTransfer.setData("vividcut-item", JSON.stringify(dragPayload));
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDragEnd = () => {
    delete (window as any).VividCutDraggedItem;
    window.dispatchEvent(new CustomEvent('vividcut-drag-end'));
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
          // Add first with a default duration so it shows up immediately
          onAddAsset(newAsset);

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
    <div 
      id="media-library-panel" 
      className="bg-[#16161a] border-b border-[#28282e] md:border-b-0 md:border-r md:border-[#28282e] w-full md:w-[350px] flex flex-col h-[420px] md:h-full shrink-0 select-none"
      style={{
        ...(typeof window !== 'undefined' && window.innerWidth >= 768 && width !== undefined 
          ? { 
              width: `${width}px`,
              transition: isResizing ? 'none' : 'width 300ms cubic-bezier(0.16, 1, 0.3, 1)'
            } 
          : {}),
        ...style
      }}
    >
      <style>{`
        /* Audio waveform bouncing micro-animation */
        @keyframes wave-bounce {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1.1); }
        }

        /* Transitions: default paused, running on hover */
        .transition-preview-item .anim-target {
          animation-play-state: paused !important;
        }
        .transition-preview-item:hover .anim-target {
          animation-play-state: running !important;
        }

        /* Effects: default hidden/static, active on hover */
        .effect-preview-vignette {
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .effect-preview-card:hover .effect-preview-vignette {
          opacity: 1;
        }

        .effect-preview-grain {
          opacity: 0;
          transition: opacity 0.3s ease;
          animation: grain-animation 0.8s steps(10) infinite;
          animation-play-state: paused;
        }
        .effect-preview-card:hover .effect-preview-grain {
          opacity: 0.14;
          animation-play-state: running;
        }
        @keyframes grain-animation {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(-5%, -5%); }
          20% { transform: translate(-10%, 5%); }
          30% { transform: translate(5%, -10%); }
          40% { transform: translate(-5%, 15%); }
          50% { transform: translate(-15%, 10%); }
          60% { transform: translate(15%, 0%); }
          70% { transform: translate(0%, 10%); }
          80% { transform: translate(5%, 15%); }
          90% { transform: translate(-10%, 10%); }
        }

        .effect-preview-scanlines {
          opacity: 0;
          transition: opacity 0.3s ease;
          animation: scanline-animation 6s linear infinite;
          animation-play-state: paused;
        }
        .effect-preview-card:hover .effect-preview-scanlines {
          opacity: 1;
          animation-play-state: running;
        }
        @keyframes scanline-animation {
          0% { background-position: 0 0; }
          100% { background-position: 0 100%; }
        }

        .effect-preview-glitch-active {
          animation-play-state: paused;
        }
        .effect-preview-card:hover .effect-preview-glitch-active {
          animation: preview-glitch 1s infinite ease-in-out;
          animation-play-state: running;
        }
        .effect-preview-glitch-overlay {
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .effect-preview-card:hover .effect-preview-glitch-overlay {
          opacity: 1;
        }

        .effect-preview-mirror-half {
          width: 100%;
          transition: width 0.3s ease;
        }
        .effect-preview-card:hover .effect-preview-mirror-half {
          width: 50%;
        }
        .effect-preview-mirror-split {
          transform: scaleX(1);
          opacity: 0;
          width: 0%;
          transition: width 0.3s ease, opacity 0.3s ease;
        }
        .effect-preview-card:hover .effect-preview-mirror-split {
          opacity: 1;
          width: 50%;
        }
        .effect-preview-mirror-line {
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .effect-preview-card:hover .effect-preview-mirror-line {
          opacity: 1;
        }
      `}</style>
      
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
              title={cat.label}
              className={`flex flex-col items-center justify-center py-1 text-[8.5px] font-bold transition-all cursor-pointer ${
                isActive ? 'text-[#00C4D0]' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon size={13} className={isActive ? 'scale-110' : ''} />
              {!isCompact && <span className="mt-0.5 scale-90">{cat.label}</span>}
            </button>
          );
        })}
      </div>

      {/* 2. TAB SIDEBAR & CONTENT ROW */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Narrow Sub-Navigation Sidebar */}
        <div className={`${isCompact ? 'w-11' : 'w-16'} bg-[#121214] border-r border-[#28282e] flex flex-col items-center py-3 gap-2 shrink-0 transition-all duration-150`}>
          {activeCategory === 'media' && (
            <>
              <button 
                onClick={() => setMediaSubTab('local')}
                title="Local Materials"
                className={`${isCompact ? 'w-9 py-1 text-[8.5px]' : 'w-12 py-1.5 text-[10px]'} font-bold rounded flex flex-col items-center justify-center transition-all ${
                  mediaSubTab === 'local' ? 'bg-[#1e1e24] text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Upload size={12} className="mb-0.5" />
                {!isCompact && <span>Local</span>}
              </button>
              <button 
                onClick={() => setMediaSubTab('library')}
                title="Procedural Library"
                className={`${isCompact ? 'w-9 py-1 text-[8.5px]' : 'w-12 py-1.5 text-[10px]'} font-bold rounded flex flex-col items-center justify-center transition-all ${
                  mediaSubTab === 'library' ? 'bg-[#1e1e24] text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Compass size={12} className="mb-0.5" />
                {!isCompact && <span>Library</span>}
              </button>
              <button 
                id="tab-media-templates"
                onClick={() => setMediaSubTab('templates')}
                title="Project Templates"
                className={`${isCompact ? 'w-9 py-1 text-[8.5px]' : 'w-12 py-1.5 text-[10px]'} font-bold rounded flex flex-col items-center justify-center transition-all ${
                  mediaSubTab === 'templates' ? 'bg-[#1e1e24] text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Grid size={12} className="mb-0.5" />
                {!isCompact && <span>Templates</span>}
              </button>
            </>
          )}

          {activeCategory === 'audio' && (
            <>
              <button 
                onClick={() => setAudioSubTab('synth')}
                title="Synth Beats"
                className={`${isCompact ? 'w-9 py-1 text-[8.5px]' : 'w-12 py-1.5 text-[10px]'} font-bold rounded flex flex-col items-center justify-center transition-all ${
                  audioSubTab === 'synth' ? 'bg-[#1e1e24] text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Music size={12} className="mb-0.5" />
                {!isCompact && <span>Synth</span>}
              </button>
              <button 
                onClick={() => setAudioSubTab('record')}
                title="Voice Recorder"
                className={`${isCompact ? 'w-9 py-1 text-[8.5px]' : 'w-12 py-1.5 text-[10px]'} font-bold rounded flex flex-col items-center justify-center transition-all ${
                  audioSubTab === 'record' ? 'bg-[#1e1e24] text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Mic size={12} className="mb-0.5" />
                {!isCompact && <span>Record</span>}
              </button>
            </>
          )}

          {activeCategory === 'text' && (
            <>
              <button 
                onClick={() => setTextSubTab('template')}
                title="Draft Titles"
                className={`${isCompact ? 'w-9 py-1 text-[8.5px]' : 'w-12 py-1.5 text-[10px]'} font-bold rounded flex flex-col items-center justify-center transition-all ${
                  textSubTab === 'template' ? 'bg-[#1e1e24] text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Type size={12} className="mb-0.5" />
                {!isCompact && <span>Draft</span>}
              </button>
              <button 
                onClick={() => setTextSubTab('ai')}
                title="AI Script Generator"
                className={`${isCompact ? 'w-9 py-1 text-[8.5px]' : 'w-12 py-1.5 text-[10px]'} font-bold rounded flex flex-col items-center justify-center transition-all ${
                  textSubTab === 'ai' ? 'bg-[#1e1e24] text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Sparkles size={12} className="mb-0.5" />
                {!isCompact && <span>AI Writer</span>}
              </button>
            </>
          )}

          {activeCategory === 'stickers' && (
            <>
              <button 
                onClick={() => setStickersSubTab('emoji')}
                title="Emoji Stickers"
                className={`${isCompact ? 'w-9 py-1 text-[8.5px]' : 'w-12 py-1.5 text-[10px]'} font-bold rounded flex flex-col items-center justify-center transition-all ${
                  stickersSubTab === 'emoji' ? 'bg-[#1e1e24] text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Smile size={12} className="mb-0.5" />
                {!isCompact && <span>Emoji</span>}
              </button>
              <button 
                onClick={() => setStickersSubTab('badge')}
                title="Badge Overlay Stickers"
                className={`${isCompact ? 'w-9 py-1 text-[8.5px]' : 'w-12 py-1.5 text-[10px]'} font-bold rounded flex flex-col items-center justify-center transition-all ${
                  stickersSubTab === 'badge' ? 'bg-[#1e1e24] text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Grid size={12} className="mb-0.5" />
                {!isCompact && <span>Badge</span>}
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
                      <div className={`grid ${isCompact ? 'grid-cols-1' : cols2} gap-2 max-h-[280px] md:max-h-none overflow-y-auto pr-0.5`}>
                        {assets.map((asset) => {
                          const isHovered = hoveredAssetId === asset.id;
                          const isPlayingAudio = activeHoverAudioId === asset.id;
                          return (
                            <div 
                              key={asset.id} 
                              draggable
                              onDragStart={(e) => handleDragStart(e, asset.type, asset)}
                              onDragEnd={handleDragEnd}
                              onMouseEnter={() => {
                                setHoveredAssetId(asset.id);
                                if (asset.type === 'audio') {
                                  setActiveHoverAudioId(asset.id);
                                }
                              }}
                              onMouseLeave={() => {
                                setHoveredAssetId(null);
                                if (asset.type === 'audio') {
                                  setActiveHoverAudioId(null);
                                }
                              }}
                              className={`bg-[#121214] rounded-lg border border-[#28282e] p-1.5 flex ${
                                isCompact ? 'flex-row items-center gap-2.5' : 'flex-col'
                              } group hover:border-[#00C4D0]/60 hover:bg-[#18181c] transition-all cursor-grab active:cursor-grabbing relative`}
                            >
                              {/* Visual Preview Container */}
                              <div className={`${
                                isCompact ? 'aspect-video w-16' : 'aspect-video w-full'
                              } bg-[#18181c] rounded-md overflow-hidden relative border border-[#232326] flex items-center justify-center shrink-0`}>
                                {asset.type === 'video' ? (
                                  asset.url === 'procedural' ? (
                                    <ProceduralThumbnail 
                                      type={asset.proceduralType} 
                                      isHovered={isHovered}
                                      className="w-full h-full object-cover" 
                                    />
                                  ) : (
                                    <video
                                      src={asset.url}
                                      className="w-full h-full object-cover"
                                      muted
                                      playsInline
                                      loop
                                      ref={(el) => {
                                        if (el) {
                                          if (isHovered) {
                                            el.play().catch(() => {});
                                          } else {
                                            el.pause();
                                            el.currentTime = 0;
                                          }
                                        }
                                      }}
                                    />
                                  )
                                ) : asset.type === 'image' ? (
                                  <img
                                    src={asset.url}
                                    className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                                    referrerPolicy="no-referrer"
                                    alt={asset.name}
                                  />
                                ) : asset.type === 'audio' ? (
                                  <div className="w-full h-full bg-[#0a0a0c] flex flex-col justify-end relative">
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                                      <Music size={14} className="text-emerald-500" />
                                    </div>
                                    <div className="h-[75%] w-full">
                                      {renderWaveform(asset.id, 'bg-emerald-500/70', isPlayingAudio)}
                                    </div>
                                  </div>
                                ) : null}

                                {/* Duration badge */}
                                {asset.duration > 0 && (
                                  <div className="absolute bottom-1 right-1 bg-black/80 px-1 py-0.5 rounded text-[8px] font-mono text-slate-300 font-bold z-10 leading-none">
                                    {asset.duration.toFixed(1)}s
                                  </div>
                                )}

                                {/* Hover actions */}
                                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-20">
                                  <button
                                    title="Insert into project"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const customEvent = new CustomEvent('add-clip-to-timeline', { detail: asset });
                                      window.dispatchEvent(customEvent);
                                    }}
                                    className="p-1.5 bg-[#00C4D0] hover:bg-[#00b0ba] text-black rounded-full cursor-pointer transition-transform hover:scale-110 shadow-lg"
                                  >
                                    <Plus size={11} strokeWidth={3} />
                                  </button>
                                  <button
                                    title="Delete item"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteAsset(asset.id);
                                    }}
                                    className="p-1.5 bg-[#232326] hover:bg-red-600 hover:text-white text-slate-400 rounded-full cursor-pointer transition-transform hover:scale-110 shadow-lg"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </div>

                              {/* Filename and details */}
                              <div className={`${isCompact ? 'flex-1' : 'mt-1.5'} text-left w-full overflow-hidden`}>
                                <p 
                                  className={`text-[10px] text-slate-200 font-bold leading-tight px-0.5 ${
                                    isWide ? 'whitespace-normal break-all line-clamp-3' : 'truncate'
                                  }`} 
                                  title={asset.name}
                                >
                                  {asset.name}
                                </p>
                                {isWide ? (
                                  <div className="mt-1 px-0.5 flex flex-col gap-0.5">
                                    <span className="text-[8px] text-slate-400 uppercase font-bold tracking-wider leading-none">
                                      {asset.type === 'video' 
                                        ? (asset.url === 'procedural' ? 'Vector Render • Stock' : '1080p • 30 FPS • MP4') 
                                        : asset.type === 'image' 
                                          ? 'PNG • 1920x1080 Image' 
                                          : asset.type === 'audio' 
                                            ? (asset.url === 'synthesized' ? 'Oscillator Synth' : '44.1 kHz • Stereo • WAV') 
                                            : 'Overlay Clip'}
                                    </span>
                                    <span className="text-[7.5px] text-[#00C4D0] font-mono font-bold leading-none">
                                      Length: {asset.duration.toFixed(1)}s
                                    </span>
                                  </div>
                                ) : (
                                  <p className="text-[8px] text-slate-500 uppercase px-0.5 mt-0.5 font-bold tracking-wider leading-none">
                                    {asset.type} • {asset.duration.toFixed(1)}s
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
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
                    {!isCompact && (
                      <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                        Render dynamic, fluid canvas loops that scale mathematically on frame updates.
                      </p>
                    )}

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
                    {!isCompact && (
                      <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                        Instantly rebuild the editor timeline with fully customized tracks, visual layers, sound beats, and custom aspect ratios.
                      </p>
                    )}
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
                        className={`w-full text-left ${isCompact ? 'p-2' : 'p-3'} rounded-lg border bg-gradient-to-r ${tpl.bg} hover:border-[#00C4D0]/60 active:scale-95 transition-all cursor-pointer group`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-slate-100 group-hover:text-[#00C4D0] transition-colors">{tpl.name}</span>
                          <span className="text-[9px] bg-black/40 text-slate-300 px-1.5 py-0.5 rounded font-mono">Load</span>
                        </div>
                        {!isCompact && <p className="text-[10px] text-slate-400 leading-normal">{tpl.desc}</p>}
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
                  {!isCompact && (
                    <p className="text-[10px] text-slate-500 leading-normal">
                      Generates high-fidelity loop beats using synthesized oscillator oscillators and frequency gains inside the AudioCtx.
                    </p>
                  )}

                  <div className="flex flex-col gap-2.5 mt-2">
                    {[
                      { type: 'lofi', label: 'Lo-Fi Jazz Beat', desc: 'Chill beats with synth electric piano chords', colorClass: 'bg-emerald-500/70', color: '#10b981' },
                      { type: 'techno', label: 'Techno Acid Loop', desc: 'Sizzling acid basslines and 4/4 kicks', colorClass: 'bg-purple-500/70', color: '#a855f7' },
                      { type: 'ambient', label: 'Meditative Pad', desc: 'Slow, lush detuned oscillator drones', colorClass: 'bg-blue-500/70', color: '#3b82f6' }
                    ].map((s) => {
                      const isPlaying = activeHoverAudioId === `synth_${s.type}`;
                      return (
                        <div
                          key={s.type}
                          draggable
                          onDragStart={(e) => handleDragStart(e, 'audio', {
                            id: `synth_${s.type}`,
                            name: s.label,
                            type: 'audio',
                            url: 'synthesized',
                            duration: 60,
                            synthType: s.type
                          })}
                          onDragEnd={handleDragEnd}
                          onMouseEnter={() => setActiveHoverAudioId(`synth_${s.type}`)}
                          onMouseLeave={() => setActiveHoverAudioId(null)}
                          className={`bg-[#121214] rounded-lg border border-[#28282e] ${
                            isCompact ? 'p-1.5 gap-2' : 'p-2 gap-3'
                          } flex items-center justify-between group hover:border-[#00C4D0]/60 hover:bg-[#18181c] transition-all cursor-grab active:cursor-grabbing relative`}
                        >
                          {/* Waveform Thumbnail container */}
                          <div className={`${
                            isCompact ? 'w-12 h-8' : isWide ? 'w-24 h-12' : 'w-[84px] h-[48px]'
                          } bg-[#0a0a0c] rounded-md overflow-hidden relative shrink-0 border border-[#232326] flex flex-col justify-end transition-all`}>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                              <Music size={isCompact ? 10 : 14} style={{ color: s.color }} />
                            </div>
                            <div className="h-[75%] w-full">
                              {renderWaveform(`synth_${s.type}`, s.colorClass, isPlaying)}
                            </div>
                            <div className="absolute bottom-0.5 right-0.5 bg-black/80 px-1 py-0.5 rounded text-[7px] font-mono text-slate-300 font-bold leading-none scale-90">
                              60s
                            </div>
                          </div>

                          {/* Text info and buttons */}
                          <div className="flex-1 text-left min-w-0">
                            <span className="text-[11px] font-bold text-slate-200 block truncate" title={s.label}>{s.label}</span>
                            {!isCompact && (
                              <span className={`text-[9px] text-slate-500 block leading-tight mt-0.5 ${
                                isWide ? 'whitespace-normal' : 'truncate max-w-[170px]'
                              }`}>{s.desc}</span>
                            )}
                            <span className="text-[8px] text-[#00C4D0]/80 font-mono mt-0.5 block font-bold uppercase tracking-wider">
                              {isWide ? '120 BPM • Synthesized Beat' : 'Synth Loop'}
                            </span>
                          </div>

                          <div className="flex items-center shrink-0">
                            <button
                              title="Insert Beat"
                              onClick={() => handleAddSynthAudio(s.type as any, s.label)}
                              className="p-1.5 bg-[#232326] hover:bg-[#00C4D0] hover:text-black rounded text-slate-300 cursor-pointer transition-colors"
                            >
                              <Plus size={11} strokeWidth={2.5} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
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
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Custom Text Presets</span>
                  {!isCompact && (
                    <p className="text-[10px] text-slate-500 leading-normal">
                      Drag or click a preset style to overlay responsive typography.
                    </p>
                  )}

                  <div className={`grid ${cols2} gap-2 mt-1`}>
                    {[
                      {
                        id: 'text_minimal',
                        name: 'Bold Minimal',
                        text: 'BOLD MINIMAL',
                        stylePreset: 'none' as const,
                        fontFamily: 'Inter',
                        color: '#ffffff',
                        animation: 'zoom' as const,
                        preview: (
                          <span className="text-[10px] font-sans font-black tracking-widest text-slate-100 uppercase">
                            MINIMAL
                          </span>
                        )
                      },
                      {
                        id: 'text_neon',
                        name: 'Neon Pink Glow',
                        text: 'NEON GLOW',
                        stylePreset: 'neon' as const,
                        fontFamily: 'Inter',
                        color: '#ff007f',
                        animation: 'glitch' as const,
                        preview: (
                          <span className="text-[10px] font-sans font-black tracking-wider text-pink-400" style={{ textShadow: '0 0 6px #f43f5e, 0 0 12px #f43f5e' }}>
                            NEON GLOW
                          </span>
                        )
                      },
                      {
                        id: 'text_cyber',
                        name: 'Cyber Glitch',
                        text: 'CYBER VIBE',
                        stylePreset: 'cyber' as const,
                        fontFamily: 'JetBrains Mono',
                        color: '#00ffff',
                        animation: 'zoom' as const,
                        preview: (
                          <span className="text-[9px] font-mono font-black tracking-tight text-cyan-300" style={{ textShadow: '2px 0 #eab308, -1px 0 #ec4899' }}>
                            CYBER VIBE
                          </span>
                        )
                      },
                      {
                        id: 'text_vintage',
                        name: 'Vintage Outline',
                        text: 'Vintage Vibe',
                        stylePreset: 'vintage' as const,
                        fontFamily: 'serif',
                        color: '#fef08a',
                        animation: 'fade' as const,
                        preview: (
                          <span className="text-[10px] font-serif italic font-extrabold text-yellow-200" style={{ textShadow: '1px 1px 0 #b45309, 1.5px 1.5px 0 #78350f' }}>
                            Vintage Vibe
                          </span>
                        )
                      },
                      {
                        id: 'text_caption',
                        name: 'Cinema Caption',
                        text: 'Cinematic Subtitle Overlay',
                        stylePreset: 'subtitles' as const,
                        fontFamily: 'Inter',
                        color: '#ffffff',
                        animation: 'slide' as const,
                        preview: (
                          <span className="text-[8px] font-bold text-white bg-black/75 px-1.5 py-0.5 rounded leading-none border border-white/5">
                            Subtitle Caption
                          </span>
                        )
                      },
                      {
                        id: 'text_classic',
                        name: 'Classic White',
                        text: 'Classic Overlay',
                        stylePreset: 'none' as const,
                        fontFamily: 'Inter',
                        color: '#ffffff',
                        animation: 'fade' as const,
                        preview: (
                          <span className="text-[10px] font-bold text-white tracking-wide">
                            Classic Title
                          </span>
                        )
                      }
                    ].map((preset) => (
                      <div
                        key={preset.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, 'text', {
                          id: `${preset.id}_${Date.now()}`,
                          name: preset.name,
                          type: 'text',
                          text: preset.text,
                          duration: 5,
                          url: 'text',
                          color: preset.color,
                          stylePreset: preset.stylePreset,
                          animation: preset.animation,
                          fontFamily: preset.fontFamily,
                          fontSize: 48,
                          backgroundColor: 'transparent',
                          alignment: 'center',
                          positionY: 50
                        })}
                        onDragEnd={handleDragEnd}
                        onClick={() => {
                          const customEvent = new CustomEvent('add-clip-to-timeline', { 
                            detail: {
                              id: `${preset.id}_${Date.now()}`,
                              name: preset.name,
                              type: 'text',
                              text: preset.text,
                              duration: 5,
                              url: 'text',
                              color: preset.color,
                              stylePreset: preset.stylePreset,
                              animation: preset.animation,
                              fontFamily: preset.fontFamily,
                              fontSize: 48,
                              backgroundColor: 'transparent',
                              alignment: 'center',
                              positionY: 50
                            }
                          });
                          window.dispatchEvent(customEvent);
                        }}
                        className={`bg-[#121214] rounded-lg border border-[#28282e] p-1.5 flex ${
                          isCompact ? 'flex-row items-center gap-2' : 'flex-col'
                        } group hover:border-[#00C4D0]/60 hover:bg-[#18181c] transition-all cursor-grab active:cursor-grabbing relative`}
                      >
                        {/* Live CSS styled preview window */}
                        <div className={`${
                          isCompact ? 'w-14 h-9' : 'h-14 w-full'
                        } bg-[#0a0a0c] rounded-md border border-[#232326] flex items-center justify-center overflow-hidden relative p-1 text-center shrink-0`}>
                          {preset.preview}
                        </div>
                        {/* Preset Name label */}
                        <div className={`${isCompact ? 'flex-1 mt-0' : 'mt-1'} px-0.5 text-left min-w-0`}>
                          <span className="text-[9px] font-bold text-slate-200 block truncate leading-normal" title={preset.name}>{preset.name}</span>
                          {!isCompact && (
                            <span className="text-[7.5px] text-slate-500 uppercase font-bold tracking-wider leading-none">Preset overlay</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="bg-[#121214] p-3 rounded-lg border border-[#28282e]">
                    <span className="text-[10px] font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                      <Sparkles size={12} className="text-[#00C4D0]" />
                      AI Video Assembler
                    </span>
                    {!isCompact && (
                      <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                        Provide a theme prompt. Gemini AI will compose a full multi-scene storyboard, captions, and soundtracks, then automatically arrange them!
                      </p>
                    )}

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
              {!isCompact && (
                <p className="text-[10px] text-slate-500 leading-normal">
                  Click any sticker below to place it onto your active project timeline. Emojis and Badges support full keyframe motion pathways!
                </p>
              )}

              {stickersSubTab === 'emoji' ? (
                <div className={`grid ${colsStickers} gap-2 mt-1`}>
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
                      draggable
                      onDragStart={(e) => handleDragStart(e, 'sticker', {
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
                      })}
                      onDragEnd={handleDragEnd}
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
                      className={`aspect-square bg-[#121214] hover:bg-[#1e1e24] border border-[#28282e] hover:border-[#00C4D0]/50 rounded-lg flex items-center justify-center ${
                        isCompact ? 'text-xl' : 'text-3xl'
                      } transition-all cursor-grab active:cursor-grabbing transform hover:scale-105 active:scale-95`}
                      title={s.name}
                    >
                      {s.char}
                    </button>
                  ))}
                </div>
              ) : (
                <div className={`grid ${cols2} gap-2 mt-1`}>
                  {[
                    { text: 'VLOG', color: '#ef4444', preset: 'neon' as const, style: { textShadow: '0 0 8px #ef4444' } },
                    { text: 'LIVE', color: '#22c55e', preset: 'neon' as const, style: { textShadow: '0 0 8px #22c55e' } },
                    { text: 'OMG!', color: '#eab308', preset: 'cyber' as const, style: { border: '1px solid #eab308', textShadow: '2px 0 #ec4899' } },
                    { text: 'PRO', color: '#3b82f6', preset: 'cyber' as const, style: { border: '1px solid #3b82f6', textShadow: '2px 0 #00ffff' } },
                    { text: 'NEW', color: '#a855f7', preset: 'cyber' as const, style: { border: '1px solid #a855f7' } },
                    { text: 'BANGER', color: '#f97316', preset: 'subtitles' as const, style: { background: 'linear-gradient(45deg, #f97316, #ef4444)' } },
                    { text: 'ALERT', color: '#f43f5e', preset: 'subtitles' as const, style: { background: 'linear-gradient(45deg, #f43f5e, #e11d48)' } },
                    { text: 'COOL', color: '#06b6d4', preset: 'vintage' as const, style: { fontStyle: 'italic', border: '2px double #06b6d4' } }
                  ].map((b) => (
                    <div
                      key={b.text}
                      draggable
                      onDragStart={(e) => handleDragStart(e, 'sticker', {
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
                      })}
                      onDragEnd={handleDragEnd}
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
                      className={`bg-[#121214] rounded-lg border border-[#28282e] p-1.5 flex ${
                        isCompact ? 'flex-row items-center gap-2' : 'flex-col'
                      } group hover:border-[#00C4D0]/60 hover:bg-[#18181c] transition-all cursor-grab active:cursor-grabbing relative`}
                    >
                      {/* Styled Visual Badge Preview Box */}
                      <div className={`${
                        isCompact ? 'w-14 h-9' : 'h-14 w-full'
                      } bg-[#0a0a0c] rounded-md border border-[#232326] flex items-center justify-center overflow-hidden relative shrink-0 p-1`}>
                        <span 
                          className="px-2 py-0.5 rounded text-[9px] font-black tracking-widest text-white leading-none shadow"
                          style={{ backgroundColor: b.color, ...b.style }}
                        >
                          {b.text}
                        </span>
                      </div>

                      {/* Badge labels */}
                      <div className={`${isCompact ? 'flex-1 mt-0' : 'mt-1'} px-0.5 text-left flex justify-between items-center min-w-0`}>
                        <div className="overflow-hidden">
                          <span className="text-[9px] font-bold text-slate-200 block truncate leading-none" title={`${b.text} Badge`}>{b.text} Badge</span>
                          {!isCompact && (
                            <span className="text-[7.5px] text-slate-500 uppercase font-bold tracking-wider leading-none mt-1 block">Badge decal</span>
                          )}
                        </div>
                        <Plus size={10} className="text-slate-500 group-hover:text-[#00C4D0] transition-colors shrink-0" />
                      </div>
                    </div>
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

                  <div className="flex flex-col gap-2.5 mt-1">
                    {[
                      { 
                        key: 'effectMirror', 
                        label: 'Mirror Horizontal', 
                        desc: 'Flip clip frame horizontally', 
                        icon: Tv,
                        preview: (
                          <div className="w-16 h-[38px] rounded overflow-hidden border border-[#232326] relative shrink-0">
                            <div className="flex w-full h-full">
                              <div className="effect-preview-mirror-half h-full overflow-hidden relative">
                                <MiniScene />
                              </div>
                              <div className="effect-preview-mirror-split h-full overflow-hidden relative scale-x-[-1]">
                                <MiniScene />
                              </div>
                            </div>
                            <div className="effect-preview-mirror-line absolute inset-y-0 left-1/2 w-[1px] bg-indigo-500/55" />
                          </div>
                        )
                      },
                      { 
                        key: 'effectVignette', 
                        label: 'Cinema Vignette', 
                        desc: 'Soft dark radial corners shade', 
                        icon: Compass,
                        preview: (
                          <div className="w-16 h-[38px] rounded overflow-hidden border border-[#232326] relative shrink-0">
                            <MiniScene />
                            <div className="effect-preview-vignette absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle, transparent 30%, rgba(0,0,0,0.85) 100%)' }} />
                          </div>
                        )
                      },
                      { 
                        key: 'effectFilmGrain', 
                        label: '35mm Film Grain', 
                        desc: 'Vintage camera organic noise', 
                        icon: Activity,
                        preview: (
                          <div className="w-16 h-[38px] rounded overflow-hidden border border-[#232326] relative shrink-0 bg-[#121214]">
                            <MiniScene />
                            <div className="effect-preview-grain absolute inset-0 bg-repeat pointer-events-none" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")" }} />
                          </div>
                        )
                      },
                      { 
                        key: 'effectScanlines', 
                        label: 'Analog CRT Scanlines', 
                        desc: 'Retro television horizontal lines', 
                        icon: Layers,
                        preview: (
                          <div className="w-16 h-[38px] rounded overflow-hidden border border-[#232326] relative shrink-0">
                            <MiniScene />
                            <div className="effect-preview-scanlines absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.45) 50%)', backgroundSize: '100% 3px' }} />
                          </div>
                        )
                      },
                      { 
                        key: 'effectGlitch', 
                        label: 'Digital Signal Glitch', 
                        desc: 'Random RGB horizontal screen slices', 
                        icon: Sparkles,
                        preview: (
                          <div className="effect-preview-glitch-active w-16 h-[38px] rounded overflow-hidden border border-[#232326] relative shrink-0">
                            <MiniScene />
                            <div className="effect-preview-glitch-overlay absolute inset-0 bg-cyan-500/20 mix-blend-screen pointer-events-none" />
                          </div>
                        )
                      }
                    ].map((fx) => {
                      const Icon = fx.icon;
                      const isEnabled = !!(selectedClip as any)[fx.key];
                      return (
                        <div
                          key={fx.key}
                          draggable
                          onDragStart={(e) => handleDragStart(e, 'effect', {
                            key: fx.key,
                            label: fx.label
                          })}
                          onDragEnd={handleDragEnd}
                          onClick={() => handleClipPropChange(fx.key, !isEnabled)}
                          className={`p-2 border rounded-lg text-left flex items-center justify-between gap-3 transition-all cursor-grab active:cursor-grabbing effect-preview-card group ${
                            isEnabled 
                              ? 'bg-indigo-950/20 border-indigo-500 text-slate-200 shadow-inner' 
                              : 'bg-[#121214] border-[#28282e] text-slate-400 hover:text-slate-200 hover:border-[#3d3d46]'
                          }`}
                        >
                          <div className="flex items-center gap-3 overflow-hidden min-w-0">
                            {/* Visual scene preview */}
                            {fx.preview}
 
                            <div className="text-left overflow-hidden min-w-0">
                              <span className="text-[11px] font-bold block truncate leading-tight">{fx.label}</span>
                              <span className="text-[8.5px] text-slate-500 block truncate mt-1 leading-none">{fx.desc}</span>
                              <span className="text-[7.5px] text-indigo-400/80 font-bold uppercase tracking-wider block mt-1 leading-none">Lens FX</span>
                            </div>
                          </div>
                          
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            isEnabled ? 'border-indigo-400 bg-indigo-500 text-white' : 'border-slate-600 bg-transparent'
                          }`}>
                            {isEnabled && <Check size={9} strokeWidth={4} />}
                          </div>
                        </div>
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

                  <style>{`
                    @keyframes preview-cut {
                      0%, 45% { opacity: 1; }
                      50%, 95% { opacity: 0; }
                      100% { opacity: 1; }
                    }
                    @keyframes preview-dip {
                      0%, 20%, 80%, 100% { opacity: 0; }
                      45%, 55% { opacity: 1; }
                    }
                    @keyframes preview-fade {
                      0%, 20% { opacity: 0; }
                      45%, 75% { opacity: 1; }
                      100% { opacity: 0; }
                    }
                    @keyframes preview-slide-red {
                      0%, 20% { transform: translateX(0); }
                      45%, 75% { transform: translateX(-100%); }
                      100% { transform: translateX(0); }
                    }
                    @keyframes preview-slide-blue {
                      0%, 20% { transform: translateX(0); }
                      45%, 75% { transform: translateX(-100%); }
                      100% { transform: translateX(0); }
                    }
                    @keyframes preview-wipe {
                      0%, 20% { clip-path: inset(0 100% 0 0); }
                      45%, 75% { clip-path: inset(0 0 0 0); }
                      100% { clip-path: inset(0 100% 0 0); }
                    }
                    @keyframes preview-glitch {
                      0%, 100% { transform: translate(0, 0); opacity: 1; }
                      15% { transform: translate(-2px, 1px); opacity: 0.9; }
                      30% { transform: translate(1px, -1px); opacity: 0.95; }
                      45% { transform: translate(-1px, 0); opacity: 1; }
                      60% { transform: translate(2px, 2px); opacity: 0.85; }
                      75% { transform: translate(-2px, -2px); opacity: 0.95; }
                    }
                  `}</style>

                  <div className={`grid ${cols2} gap-2 mt-1`}>
                    {[
                      { 
                        type: 'none', 
                        label: 'Standard Cut', 
                        desc: 'Instant frame cut',
                        preview: (
                          <div className="w-full h-10 relative overflow-hidden rounded bg-[#0a0a0c] border border-[#232326]">
                            <div className="absolute inset-0 bg-[#ef4444]" />
                            <div className="absolute inset-0 bg-[#3b82f6] anim-target" style={{ animation: 'preview-cut 3s infinite steps(1)' }} />
                          </div>
                        )
                      },
                      { 
                        type: 'fade', 
                        label: 'Dip to Black', 
                        desc: 'Classic fade down',
                        preview: (
                          <div className="w-full h-10 relative overflow-hidden rounded bg-[#0a0a0c] border border-[#232326]">
                            <div className="absolute inset-0 bg-[#ef4444]" />
                            <div className="absolute inset-0 bg-[#3b82f6] anim-target" style={{ animation: 'preview-cut 3s infinite steps(1)' }} />
                            <div className="absolute inset-0 bg-black anim-target" style={{ animation: 'preview-dip 3s infinite ease-in-out' }} />
                          </div>
                        )
                      },
                      { 
                        type: 'dissolve', 
                        label: 'Cross-Fade', 
                        desc: 'Overlay alpha mix',
                        preview: (
                          <div className="w-full h-10 relative overflow-hidden rounded bg-[#0a0a0c] border border-[#232326]">
                            <div className="absolute inset-0 bg-[#ef4444]" />
                            <div className="absolute inset-0 bg-[#3b82f6] anim-target" style={{ animation: 'preview-fade 3s infinite ease-in-out' }} />
                          </div>
                        )
                      },
                      { 
                        type: 'slide', 
                        label: 'Slide Push', 
                        desc: 'Push side transition',
                        preview: (
                          <div className="w-full h-10 relative overflow-hidden rounded bg-[#0a0a0c] border border-[#232326] flex">
                            <div className="w-full h-full bg-[#ef4444] shrink-0 anim-target" style={{ animation: 'preview-slide-red 3s infinite ease-in-out' }} />
                            <div className="w-full h-full bg-[#3b82f6] shrink-0 anim-target" style={{ animation: 'preview-slide-blue 3s infinite ease-in-out' }} />
                          </div>
                        )
                      },
                      { 
                        type: 'wipe', 
                        label: 'Linear Wipe', 
                        desc: 'Sweep left to right',
                        preview: (
                          <div className="w-full h-10 relative overflow-hidden rounded bg-[#0a0a0c] border border-[#232326]">
                            <div className="absolute inset-0 bg-[#ef4444]" />
                            <div className="absolute inset-0 bg-[#3b82f6] anim-target" style={{ animation: 'preview-wipe 3s infinite ease-in-out' }} />
                          </div>
                        )
                      }
                    ].map((t) => {
                      const isCurrent = (selectedClip.transitionType || 'none') === t.type;
                      return (
                        <div
                          key={t.type}
                          draggable
                          onDragStart={(e) => handleDragStart(e, 'transition', {
                            type: t.type,
                            label: t.label
                          })}
                          onDragEnd={handleDragEnd}
                          onClick={() => {
                            handleClipPropChange('transitionType', t.type);
                            if (t.type !== 'none' && !selectedClip.transitionDuration) {
                              handleClipPropChange('transitionDuration', 1.0);
                            }
                          }}
                          className={`p-1.5 rounded-lg border text-left flex ${
                            isCompact ? 'flex-row items-center gap-2' : 'flex-col justify-between gap-1.5'
                          } transition-all cursor-grab active:cursor-grabbing relative transition-preview-item ${
                            isCurrent 
                              ? 'bg-yellow-950/20 border-yellow-500 text-yellow-300' 
                              : 'bg-[#121214] border-[#28282e] text-slate-400 hover:text-slate-200 hover:border-[#3d3d46]'
                          }`}
                        >
                          {/* Animated Preview Container */}
                          <div className={isCompact ? 'w-14 h-9 overflow-hidden shrink-0 rounded border border-[#232326]' : 'w-full shrink-0'}>
                            {t.preview}
                          </div>

                          <div className="text-left overflow-hidden min-w-0 flex-1">
                            <span className="text-[10px] font-bold block truncate leading-tight">{t.label}</span>
                            {!isCompact && (
                              <span className="text-[8px] text-slate-500 mt-0.5 leading-none block truncate">{t.desc}</span>
                            )}
                          </div>
                          
                          {/* Current marker badge */}
                          {isCurrent && (
                            <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-yellow-500 border border-black text-slate-950 flex items-center justify-center z-10">
                              <Check size={8} strokeWidth={4} />
                            </span>
                          )}
                        </div>
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

                  <div className={`grid ${cols2} gap-2 mt-1.5`}>
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
                          className={`relative ${
                            isCompact ? 'h-[36px]' : 'h-[48px]'
                          } rounded-lg overflow-hidden border text-left p-2 flex flex-col justify-end transition-all cursor-pointer bg-gradient-to-br ${filter.color} ${
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
