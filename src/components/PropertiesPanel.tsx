import React from 'react';
import { 
  Settings, 
  Trash2, 
  Sliders, 
  Type as FontIcon, 
  Clock, 
  Sparkles, 
  Volume2, 
  Film,
  Compass,
  Key
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
}

export default function PropertiesPanel({
  selectedClip,
  onUpdateClip,
  onDeleteClip,
  project,
  onUpdateProject,
  currentTime = 0,
  onSeek
}: PropertiesPanelProps) {

  // Update properties handler
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
      // Look for a keyframe extremely close to the current scrubber position (within 0.1s threshold)
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

  const nextClip = getNextClip();

  return (
    <div id="inspector-properties-panel" className="bg-[#161618] border-t md:border-t-0 md:border-l border-[#2A2A2D] w-full md:w-80 flex flex-col h-[400px] md:h-full overflow-y-auto">
      {/* Panel Header */}
      <div className="px-4 py-3 border-b border-[#2A2A2D] bg-[#0F0F10] shrink-0 flex items-center gap-2">
        <Settings size={14} className="text-indigo-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-200">Clip Inspector</span>
      </div>

      {selectedClip ? (
        <div className="p-4 flex flex-col gap-5">
          {/* General Properties */}
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">Clip Name</label>
              <input
                id="input-inspector-clip-name"
                type="text"
                value={selectedClip.name}
                onChange={(e) => handlePropChange('name', e.target.value)}
                className="w-full bg-[#0F0F10] border border-[#2A2A2D] rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
              />
            </div>

            {/* Timing & Duration tuning */}
            <div className="bg-[#121214] p-3 rounded-lg border border-[#2A2A2D] grid grid-cols-2 gap-2">
              <div className="col-span-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1 mb-1">
                <Clock size={11} className="text-slate-400" />
                Timing Precision Tuning
              </div>
              <div>
                <label className="text-[9px] text-slate-400 block mb-0.5">Start Time (s)</label>
                <input
                  id="input-inspector-clip-start"
                  type="number"
                  step="0.1"
                  min="0"
                  value={Number(selectedClip.start.toFixed(1))}
                  onChange={(e) => handlePropChange('start', Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full bg-[#161618] border border-[#2A2A2D] rounded px-2 py-1 text-xs text-slate-300 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[9px] text-slate-400 block mb-0.5">Duration (s)</label>
                <input
                  id="input-inspector-clip-duration"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={Number(selectedClip.duration.toFixed(1))}
                  onChange={(e) => handlePropChange('duration', Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                  className="w-full bg-[#161618] border border-[#2A2A2D] rounded px-2 py-1 text-xs text-slate-300 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-[#2A2A2D] my-1" />

          {/* Type-Specific Properties: VIDEO */}
          {selectedClip.type === 'video' && (
            <div className="flex flex-col gap-4 animate-fadeIn">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 uppercase tracking-wide">
                <Film size={13} className="text-indigo-400" />
                Video Controls
              </div>

              {/* Volume */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Volume</label>
                  <span className="text-[10px] font-mono font-bold text-slate-400">{Math.round((selectedClip as VideoClip).volume * 100)}%</span>
                </div>
                <input
                  id="slider-inspector-video-volume"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={(selectedClip as VideoClip).volume}
                  onChange={(e) => handlePropChange('volume', parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 h-1.5 rounded"
                />
              </div>

              {/* Speed Multiplier */}
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wider">Playback Speed</label>
                <select
                  id="select-inspector-video-speed"
                  value={(selectedClip as VideoClip).speed}
                  onChange={(e) => handlePropChange('speed', parseFloat(e.target.value))}
                  className="w-full bg-[#0F0F10] border border-[#2A2A2D] rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="0.5">0.5x (Slow Motion)</option>
                  <option value="1.0">1.0x (Normal)</option>
                  <option value="1.5">1.5x (Fast Forward)</option>
                  <option value="2.0">2.0x (Double Speed)</option>
                </select>
              </div>

              {/* Color Grading & FX */}
              <div className="flex flex-col gap-3 bg-[#121214] p-3 rounded-lg border border-[#2A2A2D]">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1 mb-1">
                  <Sliders size={11} className="text-indigo-400" />
                  Color Grading &amp; FX
                </span>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Creative Visual FX</label>
                  <select
                    id="select-inspector-video-filter"
                    value={(selectedClip as VideoClip).filter}
                    onChange={(e) => handlePropChange('filter', e.target.value)}
                    className="w-full bg-[#161618] border border-[#2A2A2D] rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="none">Normal (No Filter)</option>
                    <option value="grayscale">Noir Black &amp; White</option>
                    <option value="sepia">Antique Sepia</option>
                    <option value="invert">Infrared Invert</option>
                    <option value="warm">Warm Cinematic Orange</option>
                    <option value="cool">Teal &amp; Cyan Polar</option>
                    <option value="vhs">Cyberpunk VHS Tape</option>
                    <option value="blur">Dream Lens Blur</option>
                    <option value="hue-rotate">Acid Hue Shift</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mb-0.5">
                    <span>Brightness</span>
                    <span className="font-mono">{(selectedClip as VideoClip).brightness}%</span>
                  </div>
                  <input
                    id="slider-inspector-video-brightness"
                    type="range"
                    min="50"
                    max="150"
                    value={(selectedClip as VideoClip).brightness}
                    onChange={(e) => handlePropChange('brightness', parseInt(e.target.value))}
                    className="w-full accent-indigo-500 h-1 rounded"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mb-0.5">
                    <span>Contrast</span>
                    <span className="font-mono">{(selectedClip as VideoClip).contrast}%</span>
                  </div>
                  <input
                    id="slider-inspector-video-contrast"
                    type="range"
                    min="50"
                    max="150"
                    value={(selectedClip as VideoClip).contrast ?? 100}
                    onChange={(e) => handlePropChange('contrast', parseInt(e.target.value))}
                    className="w-full accent-indigo-500 h-1 rounded"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mb-0.5">
                    <span>Saturation</span>
                    <span className="font-mono">{(selectedClip as VideoClip).saturation ?? 100}%</span>
                  </div>
                  <input
                    id="slider-inspector-video-saturation"
                    type="range"
                    min="0"
                    max="200"
                    value={(selectedClip as VideoClip).saturation ?? 100}
                    onChange={(e) => handlePropChange('saturation', parseInt(e.target.value))}
                    className="w-full accent-indigo-500 h-1 rounded"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Type-Specific Properties: IMAGE */}
          {selectedClip.type === 'image' && (
            <div className="flex flex-col gap-4 animate-fadeIn">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 uppercase tracking-wide">
                <Sliders size={13} className="text-indigo-400" />
                Image Settings
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1 uppercase tracking-wider">Visual FX Filter</label>
                <select
                  id="select-inspector-image-filter"
                  value={(selectedClip as ImageClip).filter}
                  onChange={(e) => handlePropChange('filter', e.target.value)}
                  className="w-full bg-[#0F0F10] border border-[#2A2A2D] rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="none">Normal (No Filter)</option>
                  <option value="grayscale">Noir Black &amp; White</option>
                  <option value="sepia">Antique Sepia</option>
                  <option value="invert">Infrared Invert</option>
                  <option value="warm">Warm Orange Grade</option>
                  <option value="cool">Teal &amp; Cool Polar</option>
                  <option value="blur">Dream Blur</option>
                  <option value="hue-rotate">Acid Hue Shift</option>
                </select>
              </div>

              <div className="bg-[#121214] p-3 rounded-lg border border-[#2A2A2D] flex flex-col gap-3">
                <div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mb-0.5">
                    <span>Brightness</span>
                    <span className="font-mono">{(selectedClip as ImageClip).brightness}%</span>
                  </div>
                  <input
                    id="slider-inspector-image-brightness"
                    type="range"
                    min="50"
                    max="150"
                    value={(selectedClip as ImageClip).brightness}
                    onChange={(e) => handlePropChange('brightness', parseInt(e.target.value))}
                    className="w-full accent-indigo-500 h-1 rounded"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mb-0.5">
                    <span>Contrast</span>
                    <span className="font-mono">{(selectedClip as ImageClip).contrast}%</span>
                  </div>
                  <input
                    id="slider-inspector-image-contrast"
                    type="range"
                    min="50"
                    max="150"
                    value={(selectedClip as ImageClip).contrast}
                    onChange={(e) => handlePropChange('contrast', parseInt(e.target.value))}
                    className="w-full accent-indigo-500 h-1 rounded"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mb-0.5">
                    <span>Saturation</span>
                    <span className="font-mono">{(selectedClip as ImageClip).saturation}%</span>
                  </div>
                  <input
                    id="slider-inspector-image-saturation"
                    type="range"
                    min="0"
                    max="200"
                    value={(selectedClip as ImageClip).saturation}
                    onChange={(e) => handlePropChange('saturation', parseInt(e.target.value))}
                    className="w-full accent-indigo-500 h-1 rounded"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Type-Specific Properties: AUDIO */}
          {selectedClip.type === 'audio' && (
            <div className="flex flex-col gap-4 animate-fadeIn">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 uppercase tracking-wide">
                <Volume2 size={13} className="text-emerald-500" />
                Audio Controls
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Volume Level</label>
                  <span className="text-[10px] font-mono font-bold text-slate-400">{Math.round((selectedClip as AudioClip).volume * 100)}%</span>
                </div>
                <input
                  id="slider-inspector-audio-volume"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={(selectedClip as AudioClip).volume}
                  onChange={(e) => handlePropChange('volume', parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 h-1.5 rounded"
                />
              </div>

              {/* Synth Info label */}
              {(selectedClip as AudioClip).synthType && (selectedClip as AudioClip).synthType !== 'none' && (
                <div className="bg-emerald-950/10 border border-emerald-900/20 p-2.5 rounded text-[10px] text-emerald-300 leading-relaxed font-sans">
                  <span className="font-bold block uppercase mb-0.5">Procedural Sound Track</span>
                  This track uses a loop synthesizer to generate bass, percussion, and chord sequences using the Web Audio API context.
                </div>
              )}
            </div>
          )}

          {/* Type-Specific Properties: TEXT OVERLAYS */}
          {selectedClip.type === 'text' && (
            <div className="flex flex-col gap-4 animate-fadeIn">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 uppercase tracking-wide">
                <FontIcon size={13} className="text-indigo-400" />
                Text overlay / subtitles
              </div>

              {/* Text content input */}
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">Text Content</label>
                <textarea
                  id="textarea-inspector-text-val"
                  value={(selectedClip as TextClip).text}
                  onChange={(e) => handlePropChange('text', e.target.value)}
                  rows={2}
                  className="w-full bg-[#0F0F10] border border-[#2A2A2D] rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-sans leading-relaxed resize-none"
                />
              </div>

              {/* Styling parameters */}
              <div className="bg-[#121214] p-3 rounded-lg border border-[#2A2A2D] flex flex-col gap-3">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <FontIcon size={11} className="text-indigo-400" /> Styling &amp; Typography
                </span>

                <div>
                  <label className="text-[9px] text-slate-400 block mb-0.5">Font Family</label>
                  <select
                    id="select-inspector-text-font"
                    value={(selectedClip as TextClip).fontFamily}
                    onChange={(e) => handlePropChange('fontFamily', e.target.value)}
                    className="w-full bg-[#161618] border border-[#2A2A2D] rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Inter">Inter (Sans-Serif)</option>
                    <option value="Space Grotesk">Space Grotesk (Tech Heading)</option>
                    <option value="Playfair Display">Playfair Display (Elegant Serif)</option>
                    <option value="JetBrains Mono">JetBrains Mono (Technical Mono)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-slate-400 block mb-0.5">Font Size (px)</label>
                    <input
                      id="input-inspector-text-fontsize"
                      type="number"
                      min="10"
                      max="100"
                      value={(selectedClip as TextClip).fontSize}
                      onChange={(e) => handlePropChange('fontSize', parseInt(e.target.value) || 24)}
                      className="w-full bg-[#161618] border border-[#2A2A2D] rounded px-2 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] text-slate-400 block mb-0.5">Text Alignment</label>
                    <select
                      id="select-inspector-text-alignment"
                      value={(selectedClip as TextClip).alignment}
                      onChange={(e) => handlePropChange('alignment', e.target.value)}
                      className="w-full bg-[#161618] border border-[#2A2A2D] rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-slate-400 block mb-0.5">Text Color</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        id="picker-inspector-text-color"
                        type="color"
                        value={(selectedClip as TextClip).color}
                        onChange={(e) => handlePropChange('color', e.target.value)}
                        className="w-6 h-6 border border-[#2A2A2D] bg-[#161618] rounded cursor-pointer"
                      />
                      <span className="text-[10px] font-mono text-slate-300">{(selectedClip as TextClip).color}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] text-slate-400 block mb-0.5">Box Fill Color</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        id="picker-inspector-text-bgcolor"
                        type="color"
                        value={(selectedClip as TextClip).backgroundColor === 'transparent' ? '#000000' : (selectedClip as TextClip).backgroundColor}
                        disabled={(selectedClip as TextClip).backgroundColor === 'transparent'}
                        onChange={(e) => handlePropChange('backgroundColor', e.target.value)}
                        className="w-6 h-6 border border-[#2A2A2D] bg-[#161618] rounded cursor-pointer disabled:opacity-30"
                      />
                      <select
                        id="select-inspector-text-bgcolor-type"
                        value={(selectedClip as TextClip).backgroundColor === 'transparent' ? 'transparent' : 'colored'}
                        onChange={(e) => {
                          const val = e.target.value === 'transparent' ? 'transparent' : '#000000';
                          handlePropChange('backgroundColor', val);
                        }}
                        className="bg-[#161618] border border-[#2A2A2D] rounded text-[10px] text-slate-300 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="colored">Color</option>
                        <option value="transparent">Transparent</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center text-[9px] text-slate-400 mb-0.5">
                    <span>Vertical Position (Y%)</span>
                    <span className="font-mono">{(selectedClip as TextClip).positionY}%</span>
                  </div>
                  <input
                    id="slider-inspector-text-position-y"
                    type="range"
                    min="10"
                    max="90"
                    value={(selectedClip as TextClip).positionY}
                    onChange={(e) => handlePropChange('positionY', parseInt(e.target.value))}
                    className="w-full accent-indigo-500 h-1 rounded"
                  />
                </div>

                <div>
                  <label className="text-[9px] text-slate-400 block mb-0.5">Word Art Preset Style</label>
                  <select
                    id="select-inspector-text-preset"
                    value={(selectedClip as TextClip).stylePreset || 'none'}
                    onChange={(e) => handlePropChange('stylePreset', e.target.value)}
                    className="w-full bg-[#161618] border border-[#2A2A2D] rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 mb-2"
                  >
                    <option value="none">Default (Plain text)</option>
                    <option value="neon">Neon Glow (Retro)</option>
                    <option value="cyber">Cyber Punch (Glitch/Vibe)</option>
                    <option value="vintage">Vintage Wood (Warm outline)</option>
                    <option value="subtitles">Subtitles Overlay (White/Black shadow)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[9px] text-slate-400 block mb-0.5">Entrance FX Animation</label>
                  <select
                    id="select-inspector-text-animation"
                    value={(selectedClip as TextClip).animation}
                    onChange={(e) => handlePropChange('animation', e.target.value)}
                    className="w-full bg-[#161618] border border-[#2A2A2D] rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="none">Normal (Instant)</option>
                    <option value="fade">Cinema Fade In/Out</option>
                    <option value="slide">Left Slide Entrance</option>
                    <option value="zoom">Elastic Zoom Pop</option>
                    <option value="glitch">Glitch Hologram Flicker</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Shared Visual Clip Enhancements (Transitions & Creative FX Overlays) */}
          {(selectedClip.type === 'video' || selectedClip.type === 'image') && (
            <div className="flex flex-col gap-4 mt-3 pt-3 border-t border-[#2A2A2D]">
              {/* Transition Settings */}
              <div className="flex flex-col gap-3 bg-[#121214] p-3 rounded-lg border border-[#2A2A2D]">
                <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={11} />
                  Transitions / Fades
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-slate-400 block mb-1">Fade In Type</label>
                    <select
                      id="select-inspector-fadein-type"
                      value={selectedClip.fadeInType || 'fade'}
                      onChange={(e) => handlePropChange('fadeInType', e.target.value)}
                      className="w-full bg-[#161618] border border-[#2A2A2D] rounded px-1.5 py-1 text-[11px] text-slate-200 focus:outline-none"
                    >
                      <option value="none">None</option>
                      <option value="fade">Fade (Opacity)</option>
                      <option value="slide-left">Slide Left</option>
                      <option value="slide-right">Slide Right</option>
                      <option value="zoom">Zoom</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-[9px] text-slate-400 mb-1">
                      <span>In Duration</span>
                      <span className="font-mono text-[9px]">{(selectedClip.fadeInDuration ?? 0).toFixed(1)}s</span>
                    </div>
                    <input
                      id="slider-inspector-fadein-duration"
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={selectedClip.fadeInDuration ?? 0}
                      onChange={(e) => handlePropChange('fadeInDuration', parseFloat(e.target.value))}
                      className="w-full accent-indigo-500 h-1 rounded"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div>
                    <label className="text-[9px] text-slate-400 block mb-1">Fade Out Type</label>
                    <select
                      id="select-inspector-fadeout-type"
                      value={selectedClip.fadeOutType || 'fade'}
                      onChange={(e) => handlePropChange('fadeOutType', e.target.value)}
                      className="w-full bg-[#161618] border border-[#2A2A2D] rounded px-1.5 py-1 text-[11px] text-slate-200 focus:outline-none"
                    >
                      <option value="none">None</option>
                      <option value="fade">Fade (Opacity)</option>
                      <option value="slide-left">Slide Left</option>
                      <option value="slide-right">Slide Right</option>
                      <option value="zoom">Zoom</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-[9px] text-slate-400 mb-1">
                      <span>Out Duration</span>
                      <span className="font-mono text-[9px]">{(selectedClip.fadeOutDuration ?? 0).toFixed(1)}s</span>
                    </div>
                    <input
                      id="slider-inspector-fadeout-duration"
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={selectedClip.fadeOutDuration ?? 0}
                      onChange={(e) => handlePropChange('fadeOutDuration', parseFloat(e.target.value))}
                      className="w-full accent-indigo-500 h-1 rounded"
                    />
                  </div>
                </div>
              </div>

              {/* Cross-Clip Transitions between consecutive clips on the same track */}
              <div className="flex flex-col gap-3 bg-[#121214] p-3 rounded-lg border border-[#2A2A2D]">
                <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={11} className="text-yellow-400 animate-pulse" />
                  Cross-Clip Transition (to Next Clip)
                </span>

                {nextClip ? (
                  <div className="flex flex-col gap-3 animate-fadeIn">
                    <div className="text-[10px] text-emerald-400 font-medium">
                      Connected to consecutive clip: <span className="font-semibold text-slate-200">"{nextClip.name}"</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] text-slate-400 block mb-1">Effect Type</label>
                        <select
                          id="select-inspector-transition-type"
                          value={selectedClip.transitionType || 'none'}
                          onChange={(e) => handlePropChange('transitionType', e.target.value)}
                          className="w-full bg-[#161618] border border-[#2A2A2D] rounded px-1.5 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
                        >
                          <option value="none">None (Cut)</option>
                          <option value="fade">Fade (Dip to Black)</option>
                          <option value="dissolve">Dissolve (Cross-fade)</option>
                          <option value="slide">Slide (Push)</option>
                          <option value="wipe">Wipe (Left to Right)</option>
                        </select>
                      </div>

                      <div>
                        <div className="flex justify-between items-center text-[9px] text-slate-400 mb-1">
                          <span>Duration</span>
                          <span className="font-mono text-[9px]">{(selectedClip.transitionDuration ?? 1.0).toFixed(1)}s</span>
                        </div>
                        <input
                          id="slider-inspector-transition-duration"
                          type="range"
                          min="0.2"
                          max="2.0"
                          step="0.1"
                          disabled={!selectedClip.transitionType || selectedClip.transitionType === 'none'}
                          value={selectedClip.transitionDuration ?? 1.0}
                          onChange={(e) => handlePropChange('transitionDuration', parseFloat(e.target.value))}
                          className="w-full accent-indigo-500 h-1 rounded disabled:opacity-30"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-500 leading-relaxed font-sans">
                    Place two clips side-by-side on this track to enable smooth <span className="text-indigo-400 font-bold">Fade, Dissolve, Slide, or Wipe</span> transitions between them!
                  </div>
                )}
              </div>

              {/* Professional Chroma & Luma Keying */}
              <div className="flex flex-col gap-3 bg-[#121214] p-3 rounded-lg border border-[#2A2A2D]">
                <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders size={11} />
                  Background Removal &amp; Keying
                </span>

                {/* Chroma Key (Green Screen) */}
                <div className="border-b border-[#2A2A2D]/40 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] font-medium text-slate-200">
                      <input
                        id="check-chroma-key-enabled"
                        type="checkbox"
                        checked={!!selectedClip.chromaKeyEnabled}
                        onChange={(e) => handlePropChange('chromaKeyEnabled', e.target.checked)}
                        className="rounded bg-[#161618] border-[#2A2A2D] text-indigo-600 focus:ring-0 w-3.5 h-3.5"
                      />
                      <span>Chroma Key (Color Filter)</span>
                    </label>
                    <span className="text-[9px] bg-indigo-950/40 text-indigo-400 border border-indigo-900/40 px-1 rounded font-mono">PRO</span>
                  </div>

                  {selectedClip.chromaKeyEnabled && (
                    <div className="flex flex-col gap-2 mt-2 pl-5">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <label className="text-[9px] text-slate-400 block mb-1">Key Color</label>
                          <div className="flex items-center gap-1.5">
                            <input
                              id="color-chroma-key"
                              type="color"
                              value={selectedClip.chromaKeyColor || '#00ff00'}
                              onChange={(e) => handlePropChange('chromaKeyColor', e.target.value)}
                              className="w-7 h-6 bg-transparent border-0 rounded cursor-pointer p-0"
                            />
                            <span className="font-mono text-[10px] text-slate-300">
                              {selectedClip.chromaKeyColor || '#00ff00'}
                            </span>
                          </div>
                        </div>

                        {/* Quick Color Presets */}
                        <div className="flex-1">
                          <label className="text-[9px] text-slate-400 block mb-1">Quick Presets</label>
                          <div className="flex gap-1.5">
                            <button
                              id="btn-chroma-preset-green"
                              onClick={() => handlePropChange('chromaKeyColor', '#00ff00')}
                              className="w-4 h-4 rounded-full bg-[#00ff00] border border-white/20 hover:scale-110 transition-transform cursor-pointer"
                              title="Green Screen"
                            />
                            <button
                              id="btn-chroma-preset-blue"
                              onClick={() => handlePropChange('chromaKeyColor', '#0000ff')}
                              className="w-4 h-4 rounded-full bg-[#0000ff] border border-white/20 hover:scale-110 transition-transform cursor-pointer"
                              title="Blue Screen"
                            />
                            <button
                              id="btn-chroma-preset-magenta"
                              onClick={() => handlePropChange('chromaKeyColor', '#ff00ff')}
                              className="w-4 h-4 rounded-full bg-[#ff00ff] border border-white/20 hover:scale-110 transition-transform cursor-pointer"
                              title="Magenta Screen"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-1">
                        <div className="flex justify-between items-center text-[9px] text-slate-400 mb-1">
                          <span>Similarity Tolerance</span>
                          <span className="font-mono text-[9px]">{selectedClip.chromaKeySimilarity ?? 20}%</span>
                        </div>
                        <input
                          id="slider-chroma-key-similarity"
                          type="range"
                          min="1"
                          max="80"
                          step="1"
                          value={selectedClip.chromaKeySimilarity ?? 20}
                          onChange={(e) => handlePropChange('chromaKeySimilarity', parseInt(e.target.value))}
                          className="w-full accent-indigo-500 h-1 rounded"
                        />
                      </div>

                      <div className="mt-1">
                        <div className="flex justify-between items-center text-[9px] text-slate-400 mb-1">
                          <span>Edge Feather (Smoothness)</span>
                          <span className="font-mono text-[9px]">{selectedClip.chromaKeySmoothness ?? 10}%</span>
                        </div>
                        <input
                          id="slider-chroma-key-smoothness"
                          type="range"
                          min="1"
                          max="50"
                          step="1"
                          value={selectedClip.chromaKeySmoothness ?? 10}
                          onChange={(e) => handlePropChange('chromaKeySmoothness', parseInt(e.target.value))}
                          className="w-full accent-indigo-500 h-1 rounded"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Luma Key (Background Remover for Black or White backdrop) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] font-medium text-slate-200">
                      <input
                        id="check-luma-key-enabled"
                        type="checkbox"
                        checked={!!selectedClip.lumaKeyEnabled}
                        onChange={(e) => handlePropChange('lumaKeyEnabled', e.target.checked)}
                        className="rounded bg-[#161618] border-[#2A2A2D] text-indigo-600 focus:ring-0 w-3.5 h-3.5"
                      />
                      <span>Luma Key (Matte Remover)</span>
                    </label>
                  </div>

                  {selectedClip.lumaKeyEnabled && (
                    <div className="flex flex-col gap-2 mt-2 pl-5">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] text-slate-400 block mb-1">Target Backdrop</label>
                          <select
                            id="select-luma-key-type"
                            value={selectedClip.lumaKeyType || 'black'}
                            onChange={(e) => handlePropChange('lumaKeyType', e.target.value)}
                            className="w-full bg-[#161618] border border-[#2A2A2D] rounded px-1.5 py-1 text-[11px] text-slate-200 focus:outline-none"
                          >
                            <option value="black">Remove Black (Dark)</option>
                            <option value="white">Remove White (Light)</option>
                          </select>
                        </div>

                        <div>
                          <div className="flex justify-between items-center text-[9px] text-slate-400 mb-1">
                            <span>Threshold Limit</span>
                            <span className="font-mono text-[9px]">{selectedClip.lumaKeyThreshold ?? 15}%</span>
                          </div>
                          <input
                            id="slider-luma-key-threshold"
                            type="range"
                            min="1"
                            max="90"
                            step="1"
                            value={selectedClip.lumaKeyThreshold ?? 15}
                            onChange={(e) => handlePropChange('lumaKeyThreshold', parseInt(e.target.value))}
                            className="w-full accent-indigo-500 h-1 rounded"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Creative FX Toggles */}
              <div className="flex flex-col gap-3 bg-[#121214] p-3 rounded-lg border border-[#2A2A2D]">
                <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Film size={11} />
                  Creative FX Overlays
                </span>

                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-slate-300 hover:text-slate-100 py-0.5">
                    <input
                      id="check-inspector-fx-vignette"
                      type="checkbox"
                      checked={!!selectedClip.effectVignette}
                      onChange={(e) => handlePropChange('effectVignette', e.target.checked)}
                      className="rounded bg-[#161618] border-[#2A2A2D] text-indigo-600 focus:ring-0 w-3.5 h-3.5"
                    />
                    <span>Cinematic Vignette (Soft Edges)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-slate-300 hover:text-slate-100 py-0.5">
                    <input
                      id="check-inspector-fx-filmgrain"
                      type="checkbox"
                      checked={!!selectedClip.effectFilmGrain}
                      onChange={(e) => handlePropChange('effectFilmGrain', e.target.checked)}
                      className="rounded bg-[#161618] border-[#2A2A2D] text-indigo-600 focus:ring-0 w-3.5 h-3.5"
                    />
                    <span>Film Grain (Vintage Noise)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-slate-300 hover:text-slate-100 py-0.5">
                    <input
                      id="check-inspector-fx-scanlines"
                      type="checkbox"
                      checked={!!selectedClip.effectScanlines}
                      onChange={(e) => handlePropChange('effectScanlines', e.target.checked)}
                      className="rounded bg-[#161618] border-[#2A2A2D] text-indigo-600 focus:ring-0 w-3.5 h-3.5"
                    />
                    <span>Retro TV Scanlines (CRT Grid)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-slate-300 hover:text-slate-100 py-0.5">
                    <input
                      id="check-inspector-fx-glitch"
                      type="checkbox"
                      checked={!!selectedClip.effectGlitch}
                      onChange={(e) => handlePropChange('effectGlitch', e.target.checked)}
                      className="rounded bg-[#161618] border-[#2A2A2D] text-indigo-600 focus:ring-0 w-3.5 h-3.5"
                    />
                    <span>Digital Glitch &amp; Slice Shake</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-slate-300 hover:text-slate-100 py-0.5">
                    <input
                      id="check-inspector-fx-mirror"
                      type="checkbox"
                      checked={!!selectedClip.effectMirror}
                      onChange={(e) => handlePropChange('effectMirror', e.target.checked)}
                      className="rounded bg-[#161618] border-[#2A2A2D] text-indigo-600 focus:ring-0 w-3.5 h-3.5"
                    />
                    <span>Mirror Flip (Horizontal Rotate)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Keyframe Animation Controls Panel */}
          {(selectedClip.type === 'video' || selectedClip.type === 'image' || selectedClip.type === 'text') && (
            <div className="flex flex-col gap-3 mt-3 pt-3 border-t border-[#2A2A2D]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Key size={11} className="animate-pulse" />
                  Keyframe Motion &amp; Transform
                </span>
                <span className="text-[9px] text-slate-500 font-mono bg-slate-900/50 px-1.5 py-0.5 rounded border border-slate-800">
                  Playhead: {clipTime.toFixed(1)}s
                </span>
              </div>

              {/* Slider controls with keyframe diamond toggles */}
              <div className="flex flex-col gap-3 bg-[#121214] p-3 rounded-lg border border-[#2A2A2D]">
                
                {/* Opacity Transform */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[10px]">
                    <div className="flex items-center gap-1">
                      <button
                        id="btn-toggle-kf-opacity"
                        onClick={() => handleToggleKeyframe('opacity')}
                        className={`text-[12px] font-bold focus:outline-none transition-all duration-150 cursor-pointer ${
                          selectedClip.keyframes?.some(k => k.opacity !== undefined)
                            ? selectedClip.keyframes?.some(k => Math.abs(k.time - clipTime) < 0.1 && k.opacity !== undefined)
                              ? 'text-indigo-400 scale-125 font-bold'
                              : 'text-indigo-400/50 hover:text-indigo-400'
                            : 'text-slate-600 hover:text-slate-400'
                        }`}
                        title={selectedClip.keyframes?.some(k => Math.abs(k.time - clipTime) < 0.1 && k.opacity !== undefined) ? 'Delete keyframe' : 'Create/Add keyframe'}
                      >
                        {selectedClip.keyframes?.some(k => Math.abs(k.time - clipTime) < 0.1 && k.opacity !== undefined) ? '◆' : '◇'}
                      </button>
                      <span className="text-slate-300 font-medium">Opacity</span>
                    </div>
                    <span className="font-mono text-slate-400 text-[10px]">
                      {Math.round(getPropertyValueAtTime('opacity') * 100)}%
                    </span>
                  </div>
                  <input
                    id="slider-anim-opacity"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={getPropertyValueAtTime('opacity')}
                    onChange={(e) => handleUpdateProperty('opacity', parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 h-1 rounded"
                  />
                </div>

                {/* Scale Transform */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[10px]">
                    <div className="flex items-center gap-1">
                      <button
                        id="btn-toggle-kf-scale"
                        onClick={() => handleToggleKeyframe('scale')}
                        className={`text-[12px] font-bold focus:outline-none transition-all duration-150 cursor-pointer ${
                          selectedClip.keyframes?.some(k => k.scale !== undefined)
                            ? selectedClip.keyframes?.some(k => Math.abs(k.time - clipTime) < 0.1 && k.scale !== undefined)
                              ? 'text-indigo-400 scale-125 font-bold'
                              : 'text-indigo-400/50 hover:text-indigo-400'
                            : 'text-slate-600 hover:text-slate-400'
                        }`}
                        title="Toggle scale keyframe"
                      >
                        {selectedClip.keyframes?.some(k => Math.abs(k.time - clipTime) < 0.1 && k.scale !== undefined) ? '◆' : '◇'}
                      </button>
                      <span className="text-slate-300 font-medium">Scale (Size)</span>
                    </div>
                    <span className="font-mono text-slate-400 text-[10px]">
                      {getPropertyValueAtTime('scale').toFixed(2)}x
                    </span>
                  </div>
                  <input
                    id="slider-anim-scale"
                    type="range"
                    min="0.1"
                    max="3.0"
                    step="0.05"
                    value={getPropertyValueAtTime('scale')}
                    onChange={(e) => handleUpdateProperty('scale', parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 h-1 rounded"
                  />
                </div>

                {/* Position X Offset */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[10px]">
                    <div className="flex items-center gap-1">
                      <button
                        id="btn-toggle-kf-position-x"
                        onClick={() => handleToggleKeyframe('positionX')}
                        className={`text-[12px] font-bold focus:outline-none transition-all duration-150 cursor-pointer ${
                          selectedClip.keyframes?.some(k => k.positionX !== undefined)
                            ? selectedClip.keyframes?.some(k => Math.abs(k.time - clipTime) < 0.1 && k.positionX !== undefined)
                              ? 'text-indigo-400 scale-125 font-bold'
                              : 'text-indigo-400/50 hover:text-indigo-400'
                            : 'text-slate-600 hover:text-slate-400'
                        }`}
                        title="Toggle X offset keyframe"
                      >
                        {selectedClip.keyframes?.some(k => Math.abs(k.time - clipTime) < 0.1 && k.positionX !== undefined) ? '◆' : '◇'}
                      </button>
                      <span className="text-slate-300 font-medium">Position X (Offset)</span>
                    </div>
                    <span className="font-mono text-slate-400 text-[10px]">
                      {getPropertyValueAtTime('positionX') > 0 ? '+' : ''}{Math.round(getPropertyValueAtTime('positionX'))}%
                    </span>
                  </div>
                  <input
                    id="slider-anim-position-x"
                    type="range"
                    min="-100"
                    max="100"
                    step="1"
                    value={getPropertyValueAtTime('positionX')}
                    onChange={(e) => handleUpdateProperty('positionX', parseInt(e.target.value))}
                    className="w-full accent-indigo-500 h-1 rounded"
                  />
                </div>

                {/* Position Y Offset */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[10px]">
                    <div className="flex items-center gap-1">
                      <button
                        id="btn-toggle-kf-position-y"
                        onClick={() => handleToggleKeyframe('positionY')}
                        className={`text-[12px] font-bold focus:outline-none transition-all duration-150 cursor-pointer ${
                          selectedClip.keyframes?.some(k => k.positionY !== undefined)
                            ? selectedClip.keyframes?.some(k => Math.abs(k.time - clipTime) < 0.1 && k.positionY !== undefined)
                              ? 'text-indigo-400 scale-125 font-bold'
                              : 'text-indigo-400/50 hover:text-indigo-400'
                            : 'text-slate-600 hover:text-slate-400'
                        }`}
                        title="Toggle Y position keyframe"
                      >
                        {selectedClip.keyframes?.some(k => Math.abs(k.time - clipTime) < 0.1 && k.positionY !== undefined) ? '◆' : '◇'}
                      </button>
                      <span className="text-slate-300 font-medium">
                        {selectedClip.type === 'text' ? 'Vertical Position' : 'Position Y (Offset)'}
                      </span>
                    </div>
                    <span className="font-mono text-slate-400 text-[10px]">
                      {selectedClip.type === 'text' ? '' : (getPropertyValueAtTime('positionY') > 0 ? '+' : '')}
                      {Math.round(getPropertyValueAtTime('positionY'))}%
                    </span>
                  </div>
                  <input
                    id="slider-anim-position-y"
                    type="range"
                    min={selectedClip.type === 'text' ? "0" : "-100"}
                    max="100"
                    step="1"
                    value={getPropertyValueAtTime('positionY')}
                    onChange={(e) => handleUpdateProperty('positionY', parseInt(e.target.value))}
                    className="w-full accent-indigo-500 h-1 rounded"
                  />
                </div>

              </div>

              {/* Active Keyframes Timeline List */}
              {selectedClip.keyframes && selectedClip.keyframes.length > 0 && (
                <div className="flex flex-col gap-2 bg-[#0F0F10] p-3 rounded-lg border border-[#2A2A2D]">
                  <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1 text-slate-400">
                      <span>◆</span> Keyframes ({selectedClip.keyframes.length})
                    </span>
                    <button
                      id="btn-clear-keyframes"
                      onClick={() => handlePropChange('keyframes', [])}
                      className="text-red-400 hover:text-red-300 transition-colors text-[9px] font-bold cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="max-h-36 overflow-y-auto flex flex-col gap-1 pr-1">
                    {[...selectedClip.keyframes]
                      .sort((a, b) => a.time - b.time)
                      .map(kf => {
                        const props = [];
                        if (kf.opacity !== undefined) props.push(`Op: ${Math.round(kf.opacity * 100)}%`);
                        if (kf.scale !== undefined) props.push(`Sc: ${kf.scale.toFixed(1)}x`);
                        if (kf.positionX !== undefined) props.push(`X: ${Math.round(kf.positionX)}%`);
                        if (kf.positionY !== undefined) props.push(`Y: ${Math.round(kf.positionY)}%`);

                        return (
                          <div key={kf.id} className="flex justify-between items-center bg-[#161618] px-2 py-1.5 rounded text-[10px] border border-[#2A2A2D]/60 hover:border-slate-700 transition-all duration-150">
                            <div className="flex items-center gap-1.5 font-mono text-indigo-400">
                              <span>◆</span>
                              <span>{kf.time.toFixed(1)}s</span>
                            </div>
                            <div className="text-slate-400 truncate flex-1 text-center px-2 text-[9px]">
                              {props.join(' | ')}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {onSeek && (
                                <button
                                  id={`btn-jump-kf-${kf.id}`}
                                  onClick={() => {
                                    onSeek(selectedClip.start + kf.time);
                                  }}
                                  className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 border border-indigo-900/40 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                                  title="Jump playhead to keyframe time"
                                >
                                  Seek
                                </button>
                              )}
                              <button
                                id={`btn-delete-kf-${kf.id}`}
                                onClick={() => {
                                  const updated = selectedClip.keyframes?.filter(k => k.id !== kf.id) || [];
                                  handlePropChange('keyframes', updated);
                                }}
                                className="text-slate-500 hover:text-red-400 transition-colors p-0.5 cursor-pointer"
                                title="Delete keyframe point"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Delete clip */}
          <div className="border-t border-[#2A2A2D] pt-3 flex justify-end">
            <button
              id="btn-inspector-delete"
              onClick={handleTriggerDelete}
              className="py-1.5 px-3 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 rounded text-red-400 hover:text-red-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 size={13} /> Delete Clip
            </button>
          </div>
        </div>
      ) : (
        /* Empty properties State: project level customization */
        <div className="p-4 flex flex-col gap-4 animate-fadeIn text-center mt-6">
          <Sliders size={32} className="mx-auto text-slate-500 mb-2 animate-pulse" />
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Video Project Settings</h3>
            <p className="text-[11px] text-slate-500 mt-1">Select any clip on the timeline to inspect and edit its values, or tune project config below:</p>
          </div>

          <div className="border-t border-[#2A2A2D] pt-4 flex flex-col gap-3 text-left">
            <div>
              <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">Project Title</label>
              <input
                id="input-project-name"
                type="text"
                value={project.name}
                onChange={(e) => onUpdateProject({ ...project, name: e.target.value })}
                className="w-full bg-[#0F0F10] border border-[#2A2A2D] rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase tracking-wider flex justify-between">
                <span>Timeline Duration (s)</span>
                <span className="text-[9px] text-[#00C4D0] normal-case font-normal">Auto-expands to fit clips</span>
              </label>
              <input
                id="input-project-duration"
                type="number"
                min="5"
                max="600"
                step="1"
                value={project.duration}
                onChange={(e) => {
                  const val = Math.max(5, parseInt(e.target.value) || 5);
                  let maxClipEnd = 0;
                  project.tracks.forEach(track => {
                    track.clips.forEach(clip => {
                      const end = clip.start + clip.duration;
                      if (end > maxClipEnd) {
                        maxClipEnd = end;
                      }
                    });
                  });
                  onUpdateProject({ ...project, duration: Math.max(val, Math.ceil(maxClipEnd)) });
                }}
                className="w-full bg-[#0F0F10] border border-[#2A2A2D] rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div className="bg-[#0F0F10] p-2.5 rounded-lg border border-[#2A2A2D] text-[10px] font-mono text-slate-500 leading-relaxed">
              Specs summary:<br/>
              • Aspect Ratio: 16:9 widescreen<br/>
              • Frame rate: {project.fps} FPS<br/>
              • Resolution: {project.width}x{project.height}<br/>
              • Tracks: {project.tracks.length} active lanes
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
