import React, { useState } from 'react';
import { 
  Settings, 
  Trash2, 
  Sliders, 
  Type as FontIcon, 
  Clock, 
  Sparkles, 
  Volume2, 
  VolumeX,
  Film,
  Compass,
  Key,
  ChevronDown,
  ChevronRight,
  Info,
  Maximize2,
  Activity,
  FolderOpen,
  TextCursorInput,
  Music,
  Download,
  Image,
  Monitor,
  Eye,
  EyeOff,
  RotateCw,
  Scissors
} from 'lucide-react';
import { Clip, VideoClip, ImageClip, TextClip, AudioClip, VideoProject } from '../types';

interface PropertiesPanelProps {
  selectedClip: Clip | null;
  onUpdateClip: (updatedClip: Clip) => void;
  onDeleteClip: (trackId: string, clipId: string) => void;
  project: VideoProject;
  onUpdateProject: (proj: VideoProject) => void;
  currentTime?: number;
  onSeek?: (time: number) => void;
  width?: number;
  isResizing?: boolean;
  onToggleCollapse?: () => void;
  style?: React.CSSProperties;
}

interface SectionProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleSection({ id, title, icon, expanded, onToggle, children }: SectionProps) {
  return (
    <div className="border-b border-[#2A2A2D]/40 last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-2 px-3 hover:bg-[#1E1E21]/60 transition-colors text-slate-300 hover:text-slate-100 select-none cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-indigo-400">{icon}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider">{title}</span>
        </div>
        <div className="text-slate-500">
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </div>
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-1 flex flex-col gap-2.5 bg-[#121214]/15">
          {children}
        </div>
      )}
    </div>
  );
}

export default function PropertiesPanel({
  selectedClip,
  onUpdateClip,
  onDeleteClip,
  project,
  onUpdateProject,
  currentTime = 0,
  onSeek,
  width,
  isResizing,
  onToggleCollapse,
  style
}: PropertiesPanelProps) {

  // State to remember collapsible section states (using localStorage)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('vividcut-expanded-sections-v2');
      return saved ? JSON.parse(saved) : {
        // Defaults: Expand important sections initially
        general: true,
        transform: true,
        animation: true,
        speed: true,
        audio: true,
        color: true,
        effects: true,
        font: true,
        size: true,
        color_text: true,
        alignment: true,
        shadow: true,
        outline: true,
        spacing: true,
        volume: true,
        fadein: true,
        fadeout: true,
        noise: true,
        pitch: true,
        waveform: true,
        position: true,
        scale: true,
        rotation: true,
        opacity: true,
        crop: true,
        mask: true,
      };
    } catch (_) {
      return {};
    }
  });

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem('vividcut-expanded-sections-v2', JSON.stringify(next));
      return next;
    });
  };

  // Update properties helper
  const handlePropChange = (field: string, value: any) => {
    if (!selectedClip) return;
    onUpdateClip({
      ...selectedClip,
      [field]: value
    });
  };

  // Playhead time relative to the selected clip's start boundary
  const clipTime = selectedClip ? Math.max(0, Math.min(selectedClip.duration, currentTime - selectedClip.start)) : 0;

  // Helper to determine active keyframe value at the current frame/time
  const getPropertyValueAtTime = (prop: 'opacity' | 'scale' | 'positionX' | 'positionY'): number => {
    if (!selectedClip) return 0;

    // Check if the property has active keyframes
    if (selectedClip.keyframes && selectedClip.keyframes.length > 0) {
      const exactKf = selectedClip.keyframes.find(kf => Math.abs(kf.time - clipTime) < 0.1);
      if (exactKf && exactKf[prop] !== undefined) {
        return exactKf[prop] as number;
      }

      // Sort and interpolate
      const sorted = [...selectedClip.keyframes].sort((a, b) => a.time - b.time);
      const baseVal = selectedClip[prop] !== undefined ? (selectedClip[prop] as number) : (prop === 'opacity' || prop === 'scale' ? 1 : 0);

      const resolveVal = (kf: any) => kf[prop] !== undefined ? kf[prop] : baseVal;

      if (clipTime <= sorted[0].time) return resolveVal(sorted[0]);
      if (clipTime >= sorted[sorted.length - 1].time) return resolveVal(sorted[sorted.length - 1]);

      for (let i = 0; i < sorted.length - 1; i++) {
        const kf1 = sorted[i];
        const kf2 = sorted[i + 1];
        if (clipTime >= kf1.time && clipTime <= kf2.time) {
          const denom = kf2.time - kf1.time;
          const factor = denom > 0 ? (clipTime - kf1.time) / denom : 0;
          return resolveVal(kf1) + (resolveVal(kf2) - resolveVal(kf1)) * factor;
        }
      }
    }

    // Static fallback
    if (selectedClip[prop] !== undefined) {
      return selectedClip[prop] as number;
    }

    // Defaults
    if (prop === 'opacity' || prop === 'scale') return 1;
    if (prop === 'positionY' && selectedClip.type === 'text') {
      return (selectedClip as TextClip).positionY ?? 50;
    }
    return 0;
  };

  // Toggle/Create/Delete keyframe for a specific property at the active playhead
  const handleToggleKeyframe = (prop: 'opacity' | 'scale' | 'positionX' | 'positionY') => {
    if (!selectedClip) return;
    const currentKeyframes = selectedClip.keyframes ? [...selectedClip.keyframes] : [];
    const targetTime = Number(clipTime.toFixed(1));

    // Check if a keyframe exists around this frame
    const existingIndex = currentKeyframes.findIndex(kf => Math.abs(kf.time - clipTime) < 0.1);

    if (existingIndex > -1) {
      const existingKf = currentKeyframes[existingIndex];
      if (existingKf[prop] !== undefined) {
        // Remove this property from the keyframe
        const updatedKf = { ...existingKf };
        delete updatedKf[prop];

        const hasAnyProp = 'opacity' in updatedKf || 'scale' in updatedKf || 'positionX' in updatedKf || 'positionY' in updatedKf;
        if (!hasAnyProp) {
          currentKeyframes.splice(existingIndex, 1);
        } else {
          currentKeyframes[existingIndex] = updatedKf;
        }
      } else {
        // Add property to existing keyframe
        currentKeyframes[existingIndex] = {
          ...existingKf,
          [prop]: getPropertyValueAtTime(prop)
        };
      }
    } else {
      // Create a brand new keyframe at clipTime
      const newKf = {
        id: 'kf_' + Math.random().toString(36).substring(2, 9),
        time: targetTime,
        [prop]: getPropertyValueAtTime(prop)
      };
      currentKeyframes.push(newKf);
    }

    handlePropChange('keyframes', currentKeyframes);
  };

  // Update property value (takes care of keyframes automatically!)
  const handleUpdateProperty = (prop: 'opacity' | 'scale' | 'positionX' | 'positionY', val: number) => {
    if (!selectedClip) return;

    if (selectedClip.keyframes && selectedClip.keyframes.length > 0) {
      const currentKeyframes = [...selectedClip.keyframes];
      const existingIndex = currentKeyframes.findIndex(kf => Math.abs(kf.time - clipTime) < 0.1);

      if (existingIndex > -1) {
        currentKeyframes[existingIndex] = {
          ...currentKeyframes[existingIndex],
          [prop]: val
        };
      } else {
        // Create a new keyframe automatically when properties are changed during animation mode
        const newKf = {
          id: 'kf_' + Math.random().toString(36).substring(2, 9),
          time: Number(clipTime.toFixed(1)),
          [prop]: val
        };
        currentKeyframes.push(newKf);
      }
      handlePropChange('keyframes', currentKeyframes);
    } else {
      // Normal static update
      handlePropChange(prop, val);
    }
  };

  // Find track containing the selected clip for deletion purposes
  const getSelectedClipTrackId = (): string | null => {
    if (!selectedClip) return null;
    let trackId: string | null = null;
    project.tracks.forEach(track => {
      if (track.clips.some(c => c.id === selectedClip.id)) {
        trackId = track.id;
      }
    });
    return trackId;
  };

  // Find if there is a consecutive clip on the same track
  const getNextClip = (): Clip | null => {
    if (!selectedClip) return null;
    const track = project.tracks.find(t => t.clips.some(c => c.id === selectedClip.id));
    if (!track) return null;
    const sorted = [...track.clips].sort((a, b) => a.start - b.start);
    const index = sorted.findIndex(c => c.id === selectedClip.id);
    if (index === -1 || index === sorted.length - 1) return null;
    const nextClip = sorted[index + 1];
    
    // Check if contiguous (consecutive within a small 0.2s tolerance)
    const boundary = selectedClip.start + selectedClip.duration;
    const gap = Math.abs(nextClip.start - boundary);
    if (gap < 0.2) {
      return nextClip;
    }
    return null;
  };

  const handleTriggerDelete = () => {
    const trackId = getSelectedClipTrackId();
    if (trackId && selectedClip) {
      onDeleteClip(trackId, selectedClip.id);
    }
  };

  const handleAddText = () => {
    let textTrack = project.tracks.find(t => t.type === 'text');
    if (!textTrack) {
      textTrack = project.tracks[0];
    }
    if (textTrack) {
      const clipId = `clip_manual_${Date.now()}`;
      const newClip: TextClip = {
        id: clipId,
        name: 'New Custom Overlay',
        type: 'text',
        start: currentTime,
        duration: 5,
        sourceDuration: 5,
        sourceOffset: 0,
        text: 'TAP TO EDIT OVERLAY',
        fontSize: 24,
        color: '#ffffff',
        backgroundColor: '#ec4899',
        fontFamily: 'Inter',
        alignment: 'center',
        animation: 'fade',
        positionY: 50
      };
      const updatedTracks = project.tracks.map(t => {
        if (t.id === textTrack!.id) {
          return { ...t, clips: [...t.clips, newClip] };
        }
        return t;
      });
      onUpdateProject({ ...project, tracks: updatedTracks });
    }
  };

  const handleAddAudio = () => {
    let audioTrack = project.tracks.find(t => t.type === 'audio');
    if (!audioTrack) {
      audioTrack = project.tracks[0];
    }
    if (audioTrack) {
      const clipId = `clip_manual_${Date.now()}`;
      const newClip: AudioClip = {
        id: clipId,
        name: 'New Synth Beat',
        type: 'audio',
        start: currentTime,
        duration: 10,
        sourceDuration: 60,
        sourceOffset: 0,
        volume: 0.5,
        synthType: 'ambient',
        url: 'synthesized',
        speed: 1.0
      };
      const updatedTracks = project.tracks.map(t => {
        if (t.id === audioTrack!.id) {
          return { ...t, clips: [...t.clips, newClip] };
        }
        return t;
      });
      onUpdateProject({ ...project, tracks: updatedTracks });
    }
  };

  const nextClip = getNextClip();

  // --- RENDERING IF NOTHING IS SELECTED: PROJECT INFORMATION ---
  if (!selectedClip) {
    const totalClips = project.tracks.reduce((sum, t) => sum + t.clips.length, 0);
    const totalTracks = project.tracks.length;
    const actualDuration = Math.max(0, ...project.tracks.flatMap(t => t.clips.map(c => c.start + c.duration)));

    return (
      <div 
        id="inspector-properties-panel" 
        className="bg-[#141416] border-t md:border-t-0 md:border-l border-[#2A2A2D] w-full md:w-80 flex flex-col h-full overflow-y-auto font-sans text-slate-300"
        style={style}
      >
        {/* Panel Header */}
        <div className="px-3.5 py-3 border-b border-[#2A2A2D] bg-[#0E0E10] shrink-0 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Monitor size={14} className="text-indigo-400" />
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-200">
              Project Dashboard
            </span>
          </div>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1 hover:bg-[#202024] rounded text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              title="Collapse Properties Panel"
            >
              <ChevronRight size={14} />
            </button>
          )}
        </div>

        {/* Project info & Quick Actions container */}
        <div className="p-3.5 flex flex-col gap-4">
          
          {/* Section: Project Information Card */}
          <div className="bg-[#1C1C1F]/40 border border-[#2A2A2D]/50 rounded-lg p-3 flex flex-col gap-2.5">
            <div className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5 border-b border-[#2A2A2D]/40 pb-1.5">
              <Info size={11} />
              Project Configurations
            </div>
            
            {/* Project resolution dropdown/inputs */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[8.5px] text-slate-400 uppercase tracking-wide font-bold">Aspect Ratio Preset</label>
              <select
                value={`${project.width}x${project.height}`}
                onChange={(e) => {
                  const [w, h] = e.target.value.split('x').map(Number);
                  onUpdateProject({ ...project, width: w, height: h });
                }}
                className="w-full bg-[#0E0E10] border border-[#2A2A2D] rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
              >
                <option value="1920x1080">16:9 Landscape - Full HD (1920x1080)</option>
                <option value="1080x1920">9:16 Portrait - TikTok/Reels (1080x1920)</option>
                <option value="1080x1080">1:1 Square - Instagram (1080x1080)</option>
                <option value="1280x720">16:9 HD Ready (1280x720)</option>
              </select>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div>
                  <label className="text-[8px] text-slate-500 font-bold block mb-0.5">Width (px)</label>
                  <input
                    type="number"
                    value={project.width}
                    onChange={(e) => onUpdateProject({ ...project, width: parseInt(e.target.value) || 1920 })}
                    className="w-full bg-[#0E0E10] border border-[#2A2A2D] rounded px-2 py-1 text-xs text-slate-300 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[8px] text-slate-500 font-bold block mb-0.5">Height (px)</label>
                  <input
                    type="number"
                    value={project.height}
                    onChange={(e) => onUpdateProject({ ...project, height: parseInt(e.target.value) || 1080 })}
                    className="w-full bg-[#0E0E10] border border-[#2A2A2D] rounded px-2 py-1 text-xs text-slate-300 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* FPS controls */}
            <div className="mt-1 flex flex-col gap-1">
              <label className="text-[8.5px] text-slate-400 uppercase tracking-wide font-bold">Timeline Frame Rate</label>
              <select
                value={project.fps}
                onChange={(e) => onUpdateProject({ ...project, fps: Number(e.target.value) })}
                className="w-full bg-[#0E0E10] border border-[#2A2A2D] rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
              >
                <option value="24">24 FPS - Cinematic Film</option>
                <option value="30">30 FPS - Web / TV Broadcast</option>
                <option value="60">60 FPS - High Frame Rate Gaming</option>
              </select>
            </div>
          </div>

          {/* Statistics Block */}
          <div className="bg-[#1C1C1F]/40 border border-[#2A2A2D]/50 rounded-lg p-3 flex flex-col gap-2.5">
            <div className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5 border-b border-[#2A2A2D]/40 pb-1.5">
              <Activity size={11} />
              Production Metrics
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#0E0E10] p-2 rounded border border-[#2A2A2D]/30 flex flex-col justify-between">
                <span className="text-[8px] text-slate-500 uppercase tracking-wider font-bold">Timeline Duration</span>
                <span className="text-xs font-extrabold font-mono text-slate-200">{project.duration.toFixed(1)}s</span>
              </div>
              <div className="bg-[#0E0E10] p-2 rounded border border-[#2A2A2D]/30 flex flex-col justify-between">
                <span className="text-[8px] text-slate-500 uppercase tracking-wider font-bold">Active Assets</span>
                <span className="text-xs font-extrabold font-mono text-emerald-400">{actualDuration.toFixed(1)}s</span>
              </div>
              <div className="bg-[#0E0E10] p-2 rounded border border-[#2A2A2D]/30 flex flex-col justify-between">
                <span className="text-[8px] text-slate-500 uppercase tracking-wider font-bold">Clips Compiled</span>
                <span className="text-xs font-extrabold font-mono text-indigo-400">{totalClips}</span>
              </div>
              <div className="bg-[#0E0E10] p-2 rounded border border-[#2A2A2D]/30 flex flex-col justify-between">
                <span className="text-[8px] text-slate-500 uppercase tracking-wider font-bold">Timeline Tracks</span>
                <span className="text-xs font-extrabold font-mono text-slate-300">{totalTracks}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 mt-1 text-[9px] text-slate-400 font-bold bg-[#0E0E10]/80 px-2 py-1.5 rounded border border-[#2A2A2D]/20">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span>Autosave Secured (Stored locally)</span>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="flex flex-col gap-2.5 mt-1">
            <div className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles size={11} className="text-indigo-400" />
              Quick Production Toolbar
            </div>
            
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  document.getElementById('vividcut-uploader-input')?.click();
                }}
                className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[10.5px] rounded shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer border border-indigo-500/10 active:scale-[0.98]"
              >
                <FolderOpen size={12} />
                Import Media Files
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleAddText}
                  className="py-2 px-2 bg-[#1C1C1F] hover:bg-[#25252A] border border-[#2A2A2D] text-slate-200 hover:text-white font-bold text-[10px] rounded flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98]"
                >
                  <TextCursorInput size={11} className="text-indigo-400" />
                  Add Overlay Text
                </button>
                <button
                  onClick={handleAddAudio}
                  className="py-2 px-2 bg-[#1C1C1F] hover:bg-[#25252A] border border-[#2A2A2D] text-slate-200 hover:text-white font-bold text-[10px] rounded flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98]"
                >
                  <Music size={11} className="text-emerald-400" />
                  Add Audio Synth
                </button>
              </div>

              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-video-exporter'));
                }}
                className="w-full py-2.5 px-3 bg-transparent hover:bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 font-extrabold text-[10.5px] rounded flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98] mt-1"
              >
                <Download size={12} />
                Export Compiled Video
              </button>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // --- RENDERING IF A CLIP IS SELECTED ---
  return (
    <div 
      id="inspector-properties-panel" 
      className="bg-[#141416] border-t md:border-t-0 md:border-l border-[#2A2A2D] w-full md:w-80 flex flex-col h-full overflow-y-auto font-sans text-slate-300 select-none"
      style={style}
    >
      {/* Panel Header */}
      <div className="px-3.5 py-2.5 border-b border-[#2A2A2D] bg-[#0E0E10] shrink-0 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-hidden">
          <Settings size={13} className="text-indigo-400 shrink-0" />
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-200 truncate">
            {selectedClip.type} properties
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1 hover:bg-[#202024] rounded text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              title="Collapse Properties Panel"
            >
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Main Form Fields Container with compact gap */}
      <div className="flex-1 flex flex-col overflow-y-auto">

        {/* ----------------- VIDEO CLIP PROPERTIES ----------------- */}
        {selectedClip.type === 'video' && (
          <div className="flex flex-col">
            
            {/* 1. General Section */}
            <CollapsibleSection
              id="general"
              title="General"
              icon={<Info size={11} />}
              expanded={!!expandedSections.general}
              onToggle={() => toggleSection('general')}
            >
              <div className="flex flex-col gap-2">
                <div>
                  <label className="text-[8px] text-slate-500 font-extrabold uppercase tracking-wider block mb-0.5">Clip Name</label>
                  <input
                    type="text"
                    value={selectedClip.name}
                    onChange={(e) => handlePropChange('name', e.target.value)}
                    className="w-full bg-[#0E0E10] border border-[#2A2A2D] rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[8px] text-slate-500 font-extrabold uppercase tracking-wider block mb-0.5">Start Time (s)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={Number(selectedClip.start.toFixed(1))}
                      onChange={(e) => handlePropChange('start', Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full bg-[#0E0E10] border border-[#2A2A2D] rounded px-2 py-1 text-xs text-slate-300 font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] text-slate-500 font-extrabold uppercase tracking-wider block mb-0.5">Duration (s)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={Number(selectedClip.duration.toFixed(1))}
                      onChange={(e) => handlePropChange('duration', Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                      className="w-full bg-[#0E0E10] border border-[#2A2A2D] rounded px-2 py-1 text-xs text-slate-300 font-mono focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center text-[8px] text-slate-500 font-extrabold uppercase tracking-wider mb-0.5">
                    <span>Source Trim Offset</span>
                    <span className="font-mono text-[9px]">{(selectedClip.sourceOffset ?? 0).toFixed(1)}s / {(selectedClip.sourceDuration ?? 30).toFixed(1)}s</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(10, selectedClip.sourceDuration ?? 30)}
                    step="0.1"
                    value={selectedClip.sourceOffset ?? 0}
                    onChange={(e) => handlePropChange('sourceOffset', parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10]"
                  />
                </div>
              </div>
            </CollapsibleSection>

            {/* 2. Transform Section */}
            <CollapsibleSection
              id="transform"
              title="Transform"
              icon={<Maximize2 size={11} />}
              expanded={!!expandedSections.transform}
              onToggle={() => toggleSection('transform')}
            >
              <div className="flex flex-col gap-2.5">
                
                {/* Opacity Transform */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[9px] font-bold">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleKeyframe('opacity')}
                        className={`text-[11px] focus:outline-none transition-all cursor-pointer ${
                          selectedClip.keyframes?.some(k => k.opacity !== undefined)
                            ? selectedClip.keyframes?.some(k => Math.abs(k.time - clipTime) < 0.1 && k.opacity !== undefined)
                              ? 'text-indigo-400 font-bold scale-110'
                              : 'text-indigo-400/50 hover:text-indigo-400'
                            : 'text-slate-600 hover:text-slate-400'
                        }`}
                        title="Keyframe Opacity"
                      >
                        {selectedClip.keyframes?.some(k => Math.abs(k.time - clipTime) < 0.1 && k.opacity !== undefined) ? '◆' : '◇'}
                      </button>
                      <span className="text-slate-300 font-bold">Opacity</span>
                    </div>
                    <span className="font-mono text-slate-400">{Math.round(getPropertyValueAtTime('opacity') * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={getPropertyValueAtTime('opacity')}
                    onChange={(e) => handleUpdateProperty('opacity', parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10]"
                  />
                </div>

                {/* Scale Transform */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[9px] font-bold">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleKeyframe('scale')}
                        className={`text-[11px] focus:outline-none transition-all cursor-pointer ${
                          selectedClip.keyframes?.some(k => k.scale !== undefined)
                            ? selectedClip.keyframes?.some(k => Math.abs(k.time - clipTime) < 0.1 && k.scale !== undefined)
                              ? 'text-indigo-400 font-bold scale-110'
                              : 'text-indigo-400/50 hover:text-indigo-400'
                            : 'text-slate-600 hover:text-slate-400'
                        }`}
                        title="Keyframe Scale"
                      >
                        {selectedClip.keyframes?.some(k => Math.abs(k.time - clipTime) < 0.1 && k.scale !== undefined) ? '◆' : '◇'}
                      </button>
                      <span className="text-slate-300 font-bold">Scale</span>
                    </div>
                    <span className="font-mono text-slate-400">{getPropertyValueAtTime('scale').toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="3"
                    step="0.05"
                    value={getPropertyValueAtTime('scale')}
                    onChange={(e) => handleUpdateProperty('scale', parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10]"
                  />
                </div>

                {/* Position X Offset */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[9px] font-bold">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleKeyframe('positionX')}
                        className={`text-[11px] focus:outline-none transition-all cursor-pointer ${
                          selectedClip.keyframes?.some(k => k.positionX !== undefined)
                            ? selectedClip.keyframes?.some(k => Math.abs(k.time - clipTime) < 0.1 && k.positionX !== undefined)
                              ? 'text-indigo-400 font-bold scale-110'
                              : 'text-indigo-400/50 hover:text-indigo-400'
                            : 'text-slate-600 hover:text-slate-400'
                        }`}
                        title="Keyframe Position X"
                      >
                        {selectedClip.keyframes?.some(k => Math.abs(k.time - clipTime) < 0.1 && k.positionX !== undefined) ? '◆' : '◇'}
                      </button>
                      <span className="text-slate-300 font-bold">Position X</span>
                    </div>
                    <span className="font-mono text-slate-400">{getPropertyValueAtTime('positionX') > 0 ? '+' : ''}{Math.round(getPropertyValueAtTime('positionX'))}%</span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    step="1"
                    value={getPropertyValueAtTime('positionX')}
                    onChange={(e) => handleUpdateProperty('positionX', parseInt(e.target.value))}
                    className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10]"
                  />
                </div>

                {/* Position Y Offset */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[9px] font-bold">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleKeyframe('positionY')}
                        className={`text-[11px] focus:outline-none transition-all cursor-pointer ${
                          selectedClip.keyframes?.some(k => k.positionY !== undefined)
                            ? selectedClip.keyframes?.some(k => Math.abs(k.time - clipTime) < 0.1 && k.positionY !== undefined)
                              ? 'text-indigo-400 font-bold scale-110'
                              : 'text-indigo-400/50 hover:text-indigo-400'
                            : 'text-slate-600 hover:text-slate-400'
                        }`}
                        title="Keyframe Position Y"
                      >
                        {selectedClip.keyframes?.some(k => Math.abs(k.time - clipTime) < 0.1 && k.positionY !== undefined) ? '◆' : '◇'}
                      </button>
                      <span className="text-slate-300 font-bold">Position Y</span>
                    </div>
                    <span className="font-mono text-slate-400">{getPropertyValueAtTime('positionY') > 0 ? '+' : ''}{Math.round(getPropertyValueAtTime('positionY'))}%</span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    step="1"
                    value={getPropertyValueAtTime('positionY')}
                    onChange={(e) => handleUpdateProperty('positionY', parseInt(e.target.value))}
                    className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10]"
                  />
                </div>

                {/* Rotation degrees */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[9px] font-bold">
                    <span className="text-slate-300">Rotation</span>
                    <span className="font-mono text-slate-400">{(selectedClip.rotation ?? 0)}°</span>
                  </div>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    step="1"
                    value={selectedClip.rotation ?? 0}
                    onChange={(e) => handlePropChange('rotation', parseInt(e.target.value))}
                    className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10]"
                  />
                </div>

              </div>
            </CollapsibleSection>

            {/* 3. Animation Section */}
            <CollapsibleSection
              id="animation"
              title="Animation & Transitions"
              icon={<Sparkles size={11} />}
              expanded={!!expandedSections.animation}
              onToggle={() => toggleSection('animation')}
            >
              <div className="flex flex-col gap-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[8px] text-slate-500 block mb-0.5 font-bold uppercase">Fade In Type</label>
                    <select
                      value={selectedClip.fadeInType || 'fade'}
                      onChange={(e) => handlePropChange('fadeInType', e.target.value)}
                      className="w-full bg-[#0E0E10] border border-[#2A2A2D] rounded px-1.5 py-1 text-[11px] text-slate-200 focus:outline-none"
                    >
                      <option value="none">None</option>
                      <option value="fade">Fade (Opacity)</option>
                      <option value="slide-left">Slide Left</option>
                      <option value="slide-right">Slide Right</option>
                      <option value="zoom">Zoom</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[8px] text-slate-500 block mb-0.5 font-bold uppercase">In Duration (s)</label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={selectedClip.fadeInDuration ?? 0}
                      onChange={(e) => handlePropChange('fadeInDuration', parseFloat(e.target.value))}
                      className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10] mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[8px] text-slate-500 block mb-0.5 font-bold uppercase">Fade Out Type</label>
                    <select
                      value={selectedClip.fadeOutType || 'fade'}
                      onChange={(e) => handlePropChange('fadeOutType', e.target.value)}
                      className="w-full bg-[#0E0E10] border border-[#2A2A2D] rounded px-1.5 py-1 text-[11px] text-slate-200 focus:outline-none"
                    >
                      <option value="none">None</option>
                      <option value="fade">Fade (Opacity)</option>
                      <option value="slide-left">Slide Left</option>
                      <option value="slide-right">Slide Right</option>
                      <option value="zoom">Zoom</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[8px] text-slate-500 block mb-0.5 font-bold uppercase">Out Duration (s)</label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={selectedClip.fadeOutDuration ?? 0}
                      onChange={(e) => handlePropChange('fadeOutDuration', parseFloat(e.target.value))}
                      className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10] mt-1"
                    />
                  </div>
                </div>

                <div className="border-t border-[#2A2A2D]/40 pt-2 flex flex-col gap-1">
                  <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Scissors size={11} className="text-indigo-400" />
                    Cross-Clip Transition
                  </span>
                  {nextClip ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <select
                          value={selectedClip.transitionType || 'none'}
                          onChange={(e) => handlePropChange('transitionType', e.target.value)}
                          className="w-full bg-[#0E0E10] border border-[#2A2A2D] rounded px-1.5 py-1 text-[10.5px] text-slate-200 focus:outline-none"
                        >
                          <option value="none">None (Cut)</option>
                          <option value="fade">Dip to Black</option>
                          <option value="dissolve">Cross Dissolve</option>
                          <option value="slide">Push Slide</option>
                          <option value="wipe">Linear Wipe</option>
                        </select>
                      </div>
                      <div>
                        <input
                          type="range"
                          min="0.2"
                          max="2.0"
                          step="0.1"
                          disabled={!selectedClip.transitionType || selectedClip.transitionType === 'none'}
                          value={selectedClip.transitionDuration ?? 1.0}
                          onChange={(e) => handlePropChange('transitionDuration', parseFloat(e.target.value))}
                          className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10] mt-1 disabled:opacity-30"
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="text-[8px] text-slate-500">Consecutive clips on same track enable transitions.</span>
                  )}
                </div>
              </div>
            </CollapsibleSection>

            {/* 4. Speed Section */}
            <CollapsibleSection
              id="speed"
              title="Speed"
              icon={<Clock size={11} />}
              expanded={!!expandedSections.speed}
              onToggle={() => toggleSection('speed')}
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-[8px] text-slate-500 block font-bold uppercase">Playback Multiplier</label>
                <select
                  value={(selectedClip as VideoClip).speed || 1.0}
                  onChange={(e) => handlePropChange('speed', parseFloat(e.target.value))}
                  className="w-full bg-[#0E0E10] border border-[#2A2A2D] rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="0.5">0.5x (Slow Motion)</option>
                  <option value="1.0">1.0x (Normal Speed)</option>
                  <option value="1.5">1.5x (Fast Forward)</option>
                  <option value="2.0">2.0x (Double Speed)</option>
                </select>
              </div>
            </CollapsibleSection>

            {/* 5. Audio Section */}
            <CollapsibleSection
              id="audio"
              title="Audio"
              icon={<Volume2 size={11} />}
              expanded={!!expandedSections.audio}
              onToggle={() => toggleSection('audio')}
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-[8px] text-slate-500 font-bold uppercase">Track Volume</span>
                  <span className="text-[10px] font-mono text-slate-400">{Math.round(((selectedClip as VideoClip).volume ?? 1) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={(selectedClip as VideoClip).volume ?? 1}
                  onChange={(e) => handlePropChange('volume', parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10]"
                />
              </div>
            </CollapsibleSection>

            {/* 6. Color Section */}
            <CollapsibleSection
              id="color"
              title="Color grading"
              icon={<Sliders size={11} />}
              expanded={!!expandedSections.color}
              onToggle={() => toggleSection('color')}
            >
              <div className="flex flex-col gap-2.5">
                <div>
                  <label className="text-[8px] text-slate-500 block mb-0.5 font-bold uppercase">Cinematic Filter</label>
                  <select
                    value={(selectedClip as VideoClip).filter || 'none'}
                    onChange={(e) => handlePropChange('filter', e.target.value)}
                    className="w-full bg-[#0E0E10] border border-[#2A2A2D] rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="none">Normal (Rec. 709)</option>
                    <option value="grayscale">Noir Black &amp; White</option>
                    <option value="sepia">Vintage Sepia</option>
                    <option value="invert">Infrared Invert</option>
                    <option value="warm">Golden Sunset Warmth</option>
                    <option value="cool">Teal &amp; Orange Cool</option>
                    <option value="blur">Cinematic Blur</option>
                    <option value="hue-rotate">Acid Hue Shift</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center text-[8px] font-bold text-slate-500 uppercase mb-0.5">
                    <span>Brightness</span>
                    <span className="font-mono text-slate-400">{(selectedClip as VideoClip).brightness ?? 100}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="150"
                    value={(selectedClip as VideoClip).brightness ?? 100}
                    onChange={(e) => handlePropChange('brightness', parseInt(e.target.value))}
                    className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10]"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center text-[8px] font-bold text-slate-500 uppercase mb-0.5">
                    <span>Contrast</span>
                    <span className="font-mono text-slate-400">{(selectedClip as VideoClip).contrast ?? 100}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="150"
                    value={(selectedClip as VideoClip).contrast ?? 100}
                    onChange={(e) => handlePropChange('contrast', parseInt(e.target.value))}
                    className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10]"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center text-[8px] font-bold text-slate-500 uppercase mb-0.5">
                    <span>Saturation</span>
                    <span className="font-mono text-slate-400">{(selectedClip as VideoClip).saturation ?? 100}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={(selectedClip as VideoClip).saturation ?? 100}
                    onChange={(e) => handlePropChange('saturation', parseInt(e.target.value))}
                    className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10]"
                  />
                </div>
              </div>
            </CollapsibleSection>

            {/* 7. Effects Section */}
            <CollapsibleSection
              id="effects"
              title="Effects & Keys"
              icon={<Film size={11} />}
              expanded={!!expandedSections.effects}
              onToggle={() => toggleSection('effects')}
            >
              <div className="flex flex-col gap-2.5">
                
                {/* Chroma Key */}
                <div className="border-b border-[#2A2A2D]/40 pb-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="flex items-center gap-1.5 text-[10px] text-slate-300 font-bold">
                      <input
                        type="checkbox"
                        checked={!!selectedClip.chromaKeyEnabled}
                        onChange={(e) => handlePropChange('chromaKeyEnabled', e.target.checked)}
                        className="rounded bg-[#0E0E10] border-[#2A2A2D]"
                      />
                      Chroma Key
                    </label>
                    <span className="text-[7.5px] bg-indigo-950/40 text-indigo-400 border border-indigo-900/40 px-1 rounded font-bold">PRO</span>
                  </div>
                  {selectedClip.chromaKeyEnabled && (
                    <div className="flex flex-col gap-1.5 pl-4 mt-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={selectedClip.chromaKeyColor || '#00ff00'}
                          onChange={(e) => handlePropChange('chromaKeyColor', e.target.value)}
                          className="w-5 h-5 bg-transparent border-0 cursor-pointer"
                        />
                        <span className="text-[10px] text-slate-400 font-mono">{selectedClip.chromaKeyColor || '#00ff00'}</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="80"
                        value={selectedClip.chromaKeySimilarity ?? 20}
                        onChange={(e) => handlePropChange('chromaKeySimilarity', parseInt(e.target.value))}
                        className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10]"
                        title="Similarity Tolerance"
                      />
                    </div>
                  )}
                </div>

                {/* Luma Key */}
                <div className="border-b border-[#2A2A2D]/40 pb-2">
                  <label className="flex items-center gap-1.5 text-[10px] text-slate-300 font-bold">
                    <input
                      type="checkbox"
                      checked={!!selectedClip.lumaKeyEnabled}
                      onChange={(e) => handlePropChange('lumaKeyEnabled', e.target.checked)}
                      className="rounded bg-[#0E0E10] border-[#2A2A2D]"
                    />
                    Luma Matte Key
                  </label>
                  {selectedClip.lumaKeyEnabled && (
                    <div className="flex flex-col gap-1.5 pl-4 mt-1">
                      <select
                        value={selectedClip.lumaKeyType || 'black'}
                        onChange={(e) => handlePropChange('lumaKeyType', e.target.value)}
                        className="w-full bg-[#0E0E10] border border-[#2A2A2D] rounded px-1.5 py-0.5 text-[10.5px]"
                      >
                        <option value="black">Remove Black backdrop</option>
                        <option value="white">Remove White backdrop</option>
                      </select>
                      <input
                        type="range"
                        min="1"
                        max="90"
                        value={selectedClip.lumaKeyThreshold ?? 15}
                        onChange={(e) => handlePropChange('lumaKeyThreshold', parseInt(e.target.value))}
                        className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10]"
                        title="Luminance Threshold"
                      />
                    </div>
                  )}
                </div>

                {/* Visual Overlays */}
                <div className="flex flex-col gap-1 text-[10px] text-slate-300 font-bold">
                  <span>Visual overlays</span>
                  <div className="grid grid-cols-2 gap-1.5 mt-1">
                    <label className="flex items-center gap-1.5 font-normal text-[9.5px]">
                      <input
                        type="checkbox"
                        checked={!!selectedClip.effectVignette}
                        onChange={(e) => handlePropChange('effectVignette', e.target.checked)}
                        className="rounded bg-[#0E0E10] border-[#2A2A2D]"
                      />
                      Vignette
                    </label>
                    <label className="flex items-center gap-1.5 font-normal text-[9.5px]">
                      <input
                        type="checkbox"
                        checked={!!selectedClip.effectFilmGrain}
                        onChange={(e) => handlePropChange('effectFilmGrain', e.target.checked)}
                        className="rounded bg-[#0E0E10] border-[#2A2A2D]"
                      />
                      Film Grain
                    </label>
                    <label className="flex items-center gap-1.5 font-normal text-[9.5px]">
                      <input
                        type="checkbox"
                        checked={!!selectedClip.effectScanlines}
                        onChange={(e) => handlePropChange('effectScanlines', e.target.checked)}
                        className="rounded bg-[#0E0E10] border-[#2A2A2D]"
                      />
                      CRT Lines
                    </label>
                    <label className="flex items-center gap-1.5 font-normal text-[9.5px]">
                      <input
                        type="checkbox"
                        checked={!!selectedClip.effectGlitch}
                        onChange={(e) => handlePropChange('effectGlitch', e.target.checked)}
                        className="rounded bg-[#0E0E10] border-[#2A2A2D]"
                      />
                      Glitch
                    </label>
                  </div>
                </div>

              </div>
            </CollapsibleSection>

          </div>
        )}

        {/* ----------------- TEXT OVERLAY PROPERTIES ----------------- */}
        {selectedClip.type === 'text' && (
          <div className="flex flex-col">
            
            {/* 1. Text Content & Font */}
            <CollapsibleSection
              id="font"
              title="Font & Content"
              icon={<FontIcon size={11} />}
              expanded={!!expandedSections.font}
              onToggle={() => toggleSection('font')}
            >
              <div className="flex flex-col gap-2">
                <div>
                  <label className="text-[8px] text-slate-500 font-bold uppercase mb-0.5">Content Text</label>
                  <textarea
                    value={(selectedClip as TextClip).text || ''}
                    onChange={(e) => handlePropChange('text', e.target.value)}
                    rows={2}
                    className="w-full bg-[#0E0E10] border border-[#2A2A2D] rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>
                <div>
                  <label className="text-[8px] text-slate-500 font-bold uppercase mb-0.5">Typeface Font</label>
                  <select
                    value={(selectedClip as TextClip).fontFamily || 'Inter'}
                    onChange={(e) => handlePropChange('fontFamily', e.target.value)}
                    className="w-full bg-[#0E0E10] border border-[#2A2A2D] rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="Inter">Inter (Sans-Serif)</option>
                    <option value="Space Grotesk">Space Grotesk (Tech Display)</option>
                    <option value="Playfair Display">Playfair Display (Serif)</option>
                    <option value="JetBrains Mono">JetBrains Mono (Sleek Mono)</option>
                  </select>
                </div>
              </div>
            </CollapsibleSection>

            {/* 2. Size Section */}
            <CollapsibleSection
              id="size"
              title="Size"
              icon={<Maximize2 size={11} />}
              expanded={!!expandedSections.size}
              onToggle={() => toggleSection('size')}
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[8px] text-slate-500 font-bold uppercase">Font Size</span>
                  <span className="text-xs font-mono font-bold">{(selectedClip as TextClip).fontSize || 24}px</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={(selectedClip as TextClip).fontSize || 24}
                  onChange={(e) => handlePropChange('fontSize', parseInt(e.target.value) || 24)}
                  className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10]"
                />
              </div>
            </CollapsibleSection>

            {/* 3. Color & Background Section */}
            <CollapsibleSection
              id="color_text"
              title="Color & Fill"
              icon={<Sliders size={11} />}
              expanded={!!expandedSections.color_text}
              onToggle={() => toggleSection('color_text')}
            >
              <div className="flex flex-col gap-2.5">
                <div>
                  <label className="text-[8px] text-slate-500 font-bold uppercase block mb-1">Text Fill Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={(selectedClip as TextClip).color || '#ffffff'}
                      onChange={(e) => handlePropChange('color', e.target.value)}
                      className="w-6 h-6 border border-[#2A2A2D] bg-[#0E0E10] rounded cursor-pointer"
                    />
                    <span className="text-xs font-mono text-slate-300">{(selectedClip as TextClip).color || '#ffffff'}</span>
                  </div>
                </div>

                <div>
                  <label className="text-[8px] text-slate-500 font-bold uppercase block mb-1">Box Backdrop Fill</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={(selectedClip as TextClip).backgroundColor === 'transparent' ? '#000000' : (selectedClip as TextClip).backgroundColor}
                      disabled={(selectedClip as TextClip).backgroundColor === 'transparent'}
                      onChange={(e) => handlePropChange('backgroundColor', e.target.value)}
                      className="w-6 h-6 border border-[#2A2A2D] bg-[#0E0E10] rounded cursor-pointer disabled:opacity-30"
                    />
                    <select
                      value={(selectedClip as TextClip).backgroundColor === 'transparent' ? 'transparent' : 'colored'}
                      onChange={(e) => {
                        const val = e.target.value === 'transparent' ? 'transparent' : '#000000';
                        handlePropChange('backgroundColor', val);
                      }}
                      className="bg-[#0E0E10] border border-[#2A2A2D] rounded text-xs text-slate-200 focus:outline-none"
                    >
                      <option value="colored">Colored Solid</option>
                      <option value="transparent">Transparent backdrop</option>
                    </select>
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            {/* 4. Alignment Section */}
            <CollapsibleSection
              id="alignment"
              title="Alignment & Layout"
              icon={<Sliders size={11} />}
              expanded={!!expandedSections.alignment}
              onToggle={() => toggleSection('alignment')}
            >
              <div className="flex flex-col gap-2.5">
                <div>
                  <label className="text-[8px] text-slate-500 font-bold uppercase block mb-1">Text Alignment</label>
                  <select
                    value={(selectedClip as TextClip).alignment || 'center'}
                    onChange={(e) => handlePropChange('alignment', e.target.value)}
                    className="w-full bg-[#0E0E10] border border-[#2A2A2D] rounded px-2 py-1 text-xs focus:outline-none"
                  >
                    <option value="left">Align Left</option>
                    <option value="center">Align Center</option>
                    <option value="right">Align Right</option>
                  </select>
                </div>
                <div>
                  <div className="flex justify-between items-center text-[8px] font-bold text-slate-500 uppercase mb-1">
                    <span>Vertical Position (Y%)</span>
                    <span className="font-mono">{(selectedClip as TextClip).positionY || 50}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    value={(selectedClip as TextClip).positionY || 50}
                    onChange={(e) => handlePropChange('positionY', parseInt(e.target.value))}
                    className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10]"
                  />
                </div>
              </div>
            </CollapsibleSection>

            {/* 5. Shadow Section */}
            <CollapsibleSection
              id="shadow"
              title="Shadow & Glow Preset"
              icon={<Sparkles size={11} />}
              expanded={!!expandedSections.shadow}
              onToggle={() => toggleSection('shadow')}
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-[8px] text-slate-500 font-bold uppercase block">Shadow Styling Effect</label>
                <select
                  value={(selectedClip as TextClip).stylePreset || 'none'}
                  onChange={(e) => handlePropChange('stylePreset', e.target.value)}
                  className="w-full bg-[#0E0E10] border border-[#2A2A2D] rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="none">Default Plain Typography</option>
                  <option value="neon">Neon Ambient Glow Preset</option>
                  <option value="cyber">Cyberpunk Glitch Offset</option>
                  <option value="vintage">Vintage Bold Stroke Overlay</option>
                  <option value="subtitles">Subtitles Black Outer Box Shadow</option>
                </select>
              </div>
            </CollapsibleSection>

            {/* 6. Outline Section */}
            <CollapsibleSection
              id="outline"
              title="Outline"
              icon={<Film size={11} />}
              expanded={!!expandedSections.outline}
              onToggle={() => toggleSection('outline')}
            >
              <div className="flex flex-col gap-1.5">
                <span className="text-[8.5px] text-slate-500 font-bold uppercase">Overlay Outline Stroke</span>
                <div className="bg-[#0E0E10] p-2 rounded border border-[#2A2A2D]/30 text-[10px] text-slate-400">
                  Outline width and stroke are configured natively inside the preset designs (Vintage &amp; Neon styles support full vector boundaries).
                </div>
              </div>
            </CollapsibleSection>

            {/* 7. Animation Section */}
            <CollapsibleSection
              id="animation_text"
              title="Animation"
              icon={<Sparkles size={11} />}
              expanded={!!expandedSections.animation_text}
              onToggle={() => toggleSection('animation_text')}
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-[8px] text-slate-500 font-bold uppercase">Intro Entrance Animation</label>
                <select
                  value={(selectedClip as TextClip).animation || 'none'}
                  onChange={(e) => handlePropChange('animation', e.target.value)}
                  className="w-full bg-[#0E0E10] border border-[#2A2A2D] rounded px-2 py-1 text-xs"
                >
                  <option value="none">Instant Render (Default)</option>
                  <option value="fade">Cinema Opacity Fade In</option>
                  <option value="slide">Left Slide Entrance</option>
                  <option value="zoom">Elastic Scale Pop</option>
                  <option value="glitch">CRT Glitch Hologram Flicker</option>
                </select>
              </div>
            </CollapsibleSection>

            {/* 8. Spacing Section */}
            <CollapsibleSection
              id="spacing"
              title="Spacing"
              icon={<Clock size={11} />}
              expanded={!!expandedSections.spacing}
              onToggle={() => toggleSection('spacing')}
            >
              <div className="flex flex-col gap-2 bg-[#0E0E10] p-2 rounded border border-[#2A2A2D]/30 text-[10px] text-slate-400">
                <span>Letter Spacing &amp; Padding are computed automatically to maintain pixel-perfect aspect ratio layout compliance.</span>
              </div>
            </CollapsibleSection>

          </div>
        )}

        {/* ----------------- AUDIO CLIP PROPERTIES ----------------- */}
        {selectedClip.type === 'audio' && (
          <div className="flex flex-col">
            
            {/* 1. Volume Section */}
            <CollapsibleSection
              id="volume"
              title="Volume"
              icon={<Volume2 size={11} />}
              expanded={!!expandedSections.volume}
              onToggle={() => toggleSection('volume')}
            >
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-[8px] text-slate-500 font-bold uppercase">Volume Gain</span>
                  <span className="text-xs font-mono font-bold">{Math.round(((selectedClip as AudioClip).volume ?? 1) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={(selectedClip as AudioClip).volume ?? 1}
                  onChange={(e) => handlePropChange('volume', parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10]"
                />
              </div>
            </CollapsibleSection>

            {/* 2. Fade In Section */}
            <CollapsibleSection
              id="fadein"
              title="Fade In"
              icon={<Sparkles size={11} />}
              expanded={!!expandedSections.fadein}
              onToggle={() => toggleSection('fadein')}
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-[8px] text-slate-500 font-bold uppercase">Fade In Duration</span>
                  <span className="text-xs font-mono font-bold">{(selectedClip.fadeInDuration ?? 0).toFixed(1)}s</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="0.1"
                  value={selectedClip.fadeInDuration ?? 0}
                  onChange={(e) => handlePropChange('fadeInDuration', parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10]"
                />
              </div>
            </CollapsibleSection>

            {/* 3. Fade Out Section */}
            <CollapsibleSection
              id="fadeout"
              title="Fade Out"
              icon={<Sparkles size={11} />}
              expanded={!!expandedSections.fadeout}
              onToggle={() => toggleSection('fadeout')}
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-[8px] text-slate-500 font-bold uppercase">Fade Out Duration</span>
                  <span className="text-xs font-mono font-bold">{(selectedClip.fadeOutDuration ?? 0).toFixed(1)}s</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="0.1"
                  value={selectedClip.fadeOutDuration ?? 0}
                  onChange={(e) => handlePropChange('fadeOutDuration', parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10]"
                />
              </div>
            </CollapsibleSection>

            {/* 4. Noise Reduction Section */}
            <CollapsibleSection
              id="noise"
              title="Noise Reduction"
              icon={<Sliders size={11} />}
              expanded={!!expandedSections.noise}
              onToggle={() => toggleSection('noise')}
            >
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-1.5 text-[10px] text-slate-300 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!(selectedClip as any).noiseReductionEnabled}
                    onChange={(e) => handlePropChange('noiseReductionEnabled', e.target.checked)}
                    className="rounded bg-[#0E0E10] border-[#2A2A2D]"
                  />
                  Smart Noise Gate Filter
                </label>
                {(selectedClip as any).noiseReductionEnabled && (
                  <div className="flex flex-col gap-1 pl-4">
                    <span className="text-[8px] text-slate-500 uppercase font-bold">Threshold limit (dB)</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={(selectedClip as any).noiseReductionThreshold ?? 40}
                      onChange={(e) => handlePropChange('noiseReductionThreshold', parseInt(e.target.value))}
                      className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10]"
                    />
                  </div>
                )}
              </div>
            </CollapsibleSection>

            {/* 5. Pitch Section */}
            <CollapsibleSection
              id="pitch"
              title="Pitch Semitones"
              icon={<Sliders size={11} />}
              expanded={!!expandedSections.pitch}
              onToggle={() => toggleSection('pitch')}
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-[8px] text-slate-500 font-bold uppercase">Pitch Shift</span>
                  <span className="text-xs font-mono font-bold">{(selectedClip as any).pitch ?? 0} semitones</span>
                </div>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={(selectedClip as any).pitch ?? 0}
                  onChange={(e) => handlePropChange('pitch', parseInt(e.target.value))}
                  className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10]"
                />
              </div>
            </CollapsibleSection>

            {/* 6. Speed Section */}
            <CollapsibleSection
              id="speed_audio"
              title="Speed Multiplier"
              icon={<Clock size={11} />}
              expanded={!!expandedSections.speed_audio}
              onToggle={() => toggleSection('speed_audio')}
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-[8px] text-slate-500 font-bold uppercase block">Audio Frequency Rate</label>
                <select
                  value={(selectedClip as any).speed || 1.0}
                  onChange={(e) => handlePropChange('speed', parseFloat(e.target.value))}
                  className="w-full bg-[#0E0E10] border border-[#2A2A2D] rounded px-2 py-1 text-xs"
                >
                  <option value="0.5">0.5x Frequency (Drawn Down)</option>
                  <option value="1.0">1.0x Normal frequency</option>
                  <option value="1.5">1.5x Accelerated Speed</option>
                  <option value="2.0">2.0x High Pitch Speed</option>
                </select>
              </div>
            </CollapsibleSection>

            {/* 7. Waveform Section */}
            <CollapsibleSection
              id="waveform"
              title="Audio Waveform"
              icon={<Activity size={11} />}
              expanded={!!expandedSections.waveform}
              onToggle={() => toggleSection('waveform')}
            >
              <div className="flex flex-col gap-1 bg-[#0E0E10] p-2 rounded border border-[#2A2A2D]/40">
                <span className="text-[8px] text-slate-500 uppercase tracking-wider font-extrabold block">Live Waveform Monitor</span>
                <div className="h-10 w-full bg-slate-950/60 rounded flex items-center justify-center gap-0.5 px-2 relative overflow-hidden mt-1">
                  {/* Generated visual waveform bars */}
                  {Array.from({ length: 28 }).map((_, i) => {
                    const h = 5 + Math.sin(i * 0.4) * 12 + Math.cos(i * 0.8) * 10 + Math.random() * 8;
                    return (
                      <div
                        key={i}
                        className="w-[2px] bg-emerald-500/80 rounded"
                        style={{ height: `${Math.max(2, Math.min(34, h))}px` }}
                      />
                    );
                  })}
                  <div className="absolute top-1 right-2 text-[7px] font-bold text-emerald-400 uppercase tracking-widest font-mono">
                    procedural synth
                  </div>
                </div>
              </div>
            </CollapsibleSection>

          </div>
        )}

        {/* ----------------- IMAGE PROPERTIES ----------------- */}
        {selectedClip.type === 'image' && (
          <div className="flex flex-col">
            
            {/* 1. Position Section */}
            <CollapsibleSection
              id="position"
              title="Position"
              icon={<Compass size={11} />}
              expanded={!!expandedSections.position}
              onToggle={() => toggleSection('position')}
            >
              <div className="flex flex-col gap-2.5">
                <div>
                  <div className="flex justify-between items-center text-[9px] font-bold mb-0.5">
                    <span className="text-slate-300">Horizontal Offset (X)</span>
                    <span className="font-mono text-slate-400">{Math.round(getPropertyValueAtTime('positionX'))}%</span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={getPropertyValueAtTime('positionX')}
                    onChange={(e) => handleUpdateProperty('positionX', parseInt(e.target.value))}
                    className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10]"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center text-[9px] font-bold mb-0.5">
                    <span className="text-slate-300">Vertical Offset (Y)</span>
                    <span className="font-mono text-slate-400">{Math.round(getPropertyValueAtTime('positionY'))}%</span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={getPropertyValueAtTime('positionY')}
                    onChange={(e) => handleUpdateProperty('positionY', parseInt(e.target.value))}
                    className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10]"
                  />
                </div>
              </div>
            </CollapsibleSection>

            {/* 2. Scale Section */}
            <CollapsibleSection
              id="scale"
              title="Scale"
              icon={<Maximize2 size={11} />}
              expanded={!!expandedSections.scale}
              onToggle={() => toggleSection('scale')}
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[9px] font-bold mb-0.5">
                  <span className="text-slate-300">Uniform Size Scale</span>
                  <span className="font-mono text-slate-400">{getPropertyValueAtTime('scale').toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.05"
                  value={getPropertyValueAtTime('scale')}
                  onChange={(e) => handleUpdateProperty('scale', parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10]"
                />
              </div>
            </CollapsibleSection>

            {/* 3. Rotation Section */}
            <CollapsibleSection
              id="rotation"
              title="Rotation"
              icon={<RotateCw size={11} />}
              expanded={!!expandedSections.rotation}
              onToggle={() => toggleSection('rotation')}
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[9px] font-bold mb-0.5">
                  <span className="text-slate-300">Rotation Degrees</span>
                  <span className="font-mono text-slate-400">{(selectedClip.rotation ?? 0)}°</span>
                </div>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={selectedClip.rotation ?? 0}
                  onChange={(e) => handlePropChange('rotation', parseInt(e.target.value))}
                  className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10]"
                />
              </div>
            </CollapsibleSection>

            {/* 4. Opacity Section */}
            <CollapsibleSection
              id="opacity"
              title="Opacity"
              icon={<Sliders size={11} />}
              expanded={!!expandedSections.opacity}
              onToggle={() => toggleSection('opacity')}
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[9px] font-bold mb-0.5">
                  <span className="text-slate-300">Layer Transparency</span>
                  <span className="font-mono text-slate-400">{Math.round(getPropertyValueAtTime('opacity') * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={getPropertyValueAtTime('opacity')}
                  onChange={(e) => handleUpdateProperty('opacity', parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10]"
                />
              </div>
            </CollapsibleSection>

            {/* 5. Crop Section */}
            <CollapsibleSection
              id="crop"
              title="Crop Canvas"
              icon={<Film size={11} />}
              expanded={!!expandedSections.crop}
              onToggle={() => toggleSection('crop')}
            >
              <div className="flex flex-col gap-2 bg-[#0E0E10]/40 p-2 rounded border border-[#2A2A2D]/30">
                <span className="text-[8px] font-bold uppercase text-slate-500 block mb-1">Canvas Margin Crop</span>
                
                <div className="flex flex-col gap-2">
                  <div>
                    <div className="flex justify-between items-center text-[8.5px] text-slate-400 mb-0.5 font-bold">
                      <span>Crop Left</span>
                      <span className="font-mono">{selectedClip.cropLeft ?? 0}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="80"
                      value={selectedClip.cropLeft ?? 0}
                      onChange={(e) => handlePropChange('cropLeft', parseInt(e.target.value))}
                      className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10]"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center text-[8.5px] text-slate-400 mb-0.5 font-bold">
                      <span>Crop Right</span>
                      <span className="font-mono">{selectedClip.cropRight ?? 0}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="80"
                      value={selectedClip.cropRight ?? 0}
                      onChange={(e) => handlePropChange('cropRight', parseInt(e.target.value))}
                      className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10]"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center text-[8.5px] text-slate-400 mb-0.5 font-bold">
                      <span>Crop Top</span>
                      <span className="font-mono">{selectedClip.cropTop ?? 0}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="80"
                      value={selectedClip.cropTop ?? 0}
                      onChange={(e) => handlePropChange('cropTop', parseInt(e.target.value))}
                      className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10]"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center text-[8.5px] text-slate-400 mb-0.5 font-bold">
                      <span>Crop Bottom</span>
                      <span className="font-mono">{selectedClip.cropBottom ?? 0}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="80"
                      value={selectedClip.cropBottom ?? 0}
                      onChange={(e) => handlePropChange('cropBottom', parseInt(e.target.value))}
                      className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10]"
                    />
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            {/* 6. Animation Section */}
            <CollapsibleSection
              id="animation_img"
              title="Animation"
              icon={<Sparkles size={11} />}
              expanded={!!expandedSections.animation_img}
              onToggle={() => toggleSection('animation_img')}
            >
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[8px] text-slate-500 block mb-0.5 font-bold uppercase">Fade In</label>
                    <select
                      value={selectedClip.fadeInType || 'fade'}
                      onChange={(e) => handlePropChange('fadeInType', e.target.value)}
                      className="w-full bg-[#0E0E10] border border-[#2A2A2D] rounded px-1.5 py-1 text-[11px] text-slate-200 focus:outline-none"
                    >
                      <option value="none">None</option>
                      <option value="fade">Opacity</option>
                      <option value="slide-left">Slide Left</option>
                      <option value="slide-right">Slide Right</option>
                      <option value="zoom">Scale Pop</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[8px] text-slate-500 block mb-0.5 font-bold uppercase">Duration (s)</label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={selectedClip.fadeInDuration ?? 0}
                      onChange={(e) => handlePropChange('fadeInDuration', parseFloat(e.target.value))}
                      className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10] mt-1"
                    />
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            {/* 7. Mask Section */}
            <CollapsibleSection
              id="mask"
              title="Mask Shapes"
              icon={<Sliders size={11} />}
              expanded={!!expandedSections.mask}
              onToggle={() => toggleSection('mask')}
            >
              <div className="flex flex-col gap-2.5">
                <div>
                  <label className="text-[8px] text-slate-500 block mb-0.5 font-bold uppercase">Clipping Mask Type</label>
                  <select
                    value={selectedClip.maskType || 'none'}
                    onChange={(e) => handlePropChange('maskType', e.target.value)}
                    className="w-full bg-[#0E0E10] border border-[#2A2A2D] rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="none">No Mask Clipping</option>
                    <option value="circle">Circular Alpha Mask</option>
                    <option value="rectangle">Rectangular Box Mask</option>
                    <option value="linear">Vertical Linear Split</option>
                  </select>
                </div>
                {selectedClip.maskType && selectedClip.maskType !== 'none' && (
                  <div>
                    <div className="flex justify-between items-center text-[8.5px] font-bold text-slate-500 uppercase mb-0.5">
                      <span>Mask Boundary Size</span>
                      <span className="font-mono text-slate-400">{selectedClip.maskSize ?? 50}%</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      value={selectedClip.maskSize ?? 50}
                      onChange={(e) => handlePropChange('maskSize', parseInt(e.target.value))}
                      className="w-full accent-indigo-500 h-1 rounded bg-[#0E0E10]"
                    />
                  </div>
                )}
              </div>
            </CollapsibleSection>

          </div>
        )}

      </div>

      {/* Delete clip / Footer controls */}
      <div className="border-t border-[#2A2A2D] p-3 flex justify-end shrink-0 bg-[#0E0E10]/80">
        <button
          id="btn-inspector-delete"
          onClick={handleTriggerDelete}
          className="py-1.5 px-3 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 rounded text-red-400 hover:text-red-300 text-[10.5px] font-extrabold flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95 uppercase tracking-wide"
        >
          <Trash2 size={12} /> Delete Clip
        </button>
      </div>
    </div>
  );
}
