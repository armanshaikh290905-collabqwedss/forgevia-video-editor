import React, { useRef, useState } from 'react';
import { 
  Scissors, 
  Trash2, 
  Lock, 
  Unlock, 
  Eye, 
  EyeOff, 
  Volume2, 
  VolumeX, 
  Plus, 
  ZoomIn, 
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Undo2,
  Redo2,
  Magnet
} from 'lucide-react';
import { VideoProject, TimelineTrack, Clip, MediaType } from '../types';

// Generates an SVG path representing the volume envelope level across the clip's duration
const getVolumePathD = (clip: Clip) => {
  const duration = clip.duration;
  const baseVolume = (clip as any).volume !== undefined ? (clip as any).volume : 1;
  const keyframes = clip.keyframes || [];
  
  if (keyframes.length === 0) {
    const y = (1 - baseVolume) * 100;
    return `M 0 ${y} L 100 ${y}`;
  }
  
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  
  const getVolAtTime = (t: number) => {
    if (sorted.length === 0) return baseVolume;
    if (t <= sorted[0].time) return sorted[0].volume ?? baseVolume;
    if (t >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].volume ?? baseVolume;
    for (let i = 0; i < sorted.length - 1; i++) {
      const k1 = sorted[i];
      const k2 = sorted[i + 1];
      if (t >= k1.time && t <= k2.time) {
        const d = k2.time - k1.time;
        const f = d > 0 ? (t - k1.time) / d : 0;
        const v1 = k1.volume ?? baseVolume;
        const v2 = k2.volume ?? baseVolume;
        return v1 + (v2 - v1) * f;
      }
    }
    return baseVolume;
  };
  
  const startVol = getVolAtTime(0);
  const endVol = getVolAtTime(duration);
  
  let dPath = `M 0 ${(1 - startVol) * 100}`;
  
  sorted.forEach(kf => {
    const x = (kf.time / duration) * 100;
    const y = (1 - (kf.volume ?? baseVolume)) * 100;
    dPath += ` L ${x} ${y}`;
  });
  
  dPath += ` L 100 ${(1 - endVol) * 100}`;
  return dPath;
};

// Generates dynamic deterministic waveform values for audio clips
const getClipWaveformAmplitudes = (clipId: string, count: number): number[] => {
  let hash = 0;
  for (let i = 0; i < clipId.length; i++) {
    hash = clipId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const amplitudes: number[] = [];
  for (let i = 0; i < count; i++) {
    const x = (i / count) * Math.PI * 4;
    const sin1 = Math.sin(x * 1.5 + (hash & 0xFF) / 100);
    const sin2 = Math.sin(x * 3.8 + ((hash >> 8) & 0xFF) / 100);
    const sin3 = Math.cos(x * 8.4 + ((hash >> 16) & 0xFF) / 100);
    
    let amp = Math.abs(sin1 * 0.45 + sin2 * 0.35 + sin3 * 0.2);
    amp = 0.15 + amp * 0.8; // Map to nice height limits
    
    // Add realistic peaks and troughs
    if (i % 8 === 0) amp = Math.min(0.95, amp * 1.35);
    if (i % 13 === 0) amp = Math.max(0.12, amp * 0.55);
    
    amplitudes.push(amp);
  }
  return amplitudes;
};

interface TimelineProps {
  project: VideoProject;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  selectedClip: Clip | null;
  onSelectClip: (clip: Clip | null) => void;
  onUpdateTrackClips: (trackId: string, clips: Clip[]) => void;
  onSplitClip: (trackId: string, clipId: string, splitTime: number) => void;
  onDeleteClip: (trackId: string, clipId: string) => void;
  onAddClipToTrack: (trackId: string, type: MediaType) => void;
  onToggleMuteTrack: (trackId: string) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

export default function Timeline({
  project,
  currentTime,
  onTimeUpdate,
  selectedClip,
  onSelectClip,
  onUpdateTrackClips,
  onSplitClip,
  onDeleteClip,
  onAddClipToTrack,
  onToggleMuteTrack,
  canUndo,
  canRedo,
  onUndo,
  onRedo
}: TimelineProps) {
  const [zoom, setZoom] = useState<number>(10); // pixels per second (range 2 to 100)
  const tracksContainerRef = useRef<HTMLDivElement | null>(null);

  // Dragging state for sliding clips
  const [dragState, setDragState] = useState<{
    clipId: string;
    trackId: string;
    initialStart: number;
    initialMouseX: number;
  } | null>(null);

  // Dragging state for volume envelope keyframes
  const [activeKfDrag, setActiveKfDrag] = useState<{
    kfId: string;
    clipId: string;
    trackId: string;
    initialMouseX: number;
    initialMouseY: number;
    initialTime: number;
    initialVolume: number;
  } | null>(null);

  // Magnetic snapping and guideline states
  const [magnetEnabled, setMagnetEnabled] = useState<boolean>(true);
  const [snapLineTime, setSnapLineTime] = useState<number | null>(null);

  // Handle clicking on Ruler to scrub/seek playhead
  const handleRulerClickOrDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tracksContainerRef.current) return;
    const rect = tracksContainerRef.current.getBoundingClientRect();
    // Offset relative to the scrollable tracks area
    const scrollLeft = tracksContainerRef.current.scrollLeft;
    const clickX = e.clientX - rect.left + scrollLeft - 80; // 80px offset for the track label sidebar
    
    if (clickX >= 0) {
      const targetTime = Math.max(0, Math.min(project.duration, clickX / zoom));
      onTimeUpdate(targetTime);
    }
  };

  // Start sliding a clip
  const handleClipMouseDown = (e: React.MouseEvent, trackId: string, clip: Clip) => {
    e.stopPropagation();
    onSelectClip(clip);
    setDragState({
      clipId: clip.id,
      trackId: trackId,
      initialStart: clip.start,
      initialMouseX: e.clientX
    });
  };

  // Double-click overlay inside audio clip to add volume keyframe
  const handleOverlayDoubleClick = (e: React.MouseEvent<HTMLDivElement>, clip: Clip, track: TimelineTrack) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    const relativeTime = (clickX / rect.width) * clip.duration;
    const volumeValue = Math.max(0, Math.min(1, 1 - (clickY / rect.height)));
    
    const newKf = {
      id: Math.random().toString(36).substr(2, 9),
      time: parseFloat(relativeTime.toFixed(2)),
      volume: parseFloat(volumeValue.toFixed(2))
    };
    
    const currentKfs = clip.keyframes || [];
    const updatedKfs = [...currentKfs, newKf].sort((a, b) => a.time - b.time);
    
    const updatedClips = track.clips.map(c => {
      if (c.id === clip.id) {
        return { ...c, keyframes: updatedKfs };
      }
      return c;
    });
    
    onUpdateTrackClips(track.id, updatedClips);
  };

  // Start dragging a volume keyframe node
  const handleKfMouseDown = (e: React.MouseEvent, kf: any, clip: Clip, track: TimelineTrack) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveKfDrag({
      kfId: kf.id,
      clipId: clip.id,
      trackId: track.id,
      initialMouseX: e.clientX,
      initialMouseY: e.clientY,
      initialTime: kf.time,
      initialVolume: kf.volume ?? (clip as any).volume ?? 1
    });
  };

  // Double click a keyframe node to delete it
  const handleDeleteKf = (kfId: string, clip: Clip, track: TimelineTrack) => {
    const updatedKfs = (clip.keyframes || []).filter(k => k.id !== kfId);
    const updatedClips = track.clips.map(c => {
      if (c.id === clip.id) {
        return { ...c, keyframes: updatedKfs };
      }
      return c;
    });
    onUpdateTrackClips(track.id, updatedClips);
  };

  // Drag handler for sliding clips or adjusting volume keyframes
  const handleTimelineMouseMove = (e: React.MouseEvent) => {
    if (activeKfDrag) {
      e.preventDefault();
      const track = project.tracks.find(t => t.id === activeKfDrag.trackId);
      if (!track) return;
      const clip = track.clips.find(c => c.id === activeKfDrag.clipId);
      if (!clip) return;
      
      const deltaX = e.clientX - activeKfDrag.initialMouseX;
      const deltaY = e.clientY - activeKfDrag.initialMouseY;
      
      // X-axis adjusts time
      const deltaTime = deltaX / zoom;
      let targetTime = Math.max(0, Math.min(clip.duration, activeKfDrag.initialTime + deltaTime));
      targetTime = parseFloat(targetTime.toFixed(2));
      
      // Y-axis adjusts volume (assuming standard lane height around 48px)
      const deltaVol = -deltaY / 48;
      let targetVolume = Math.max(0, Math.min(1, activeKfDrag.initialVolume + deltaVol));
      targetVolume = parseFloat(targetVolume.toFixed(2));
      
      const updatedKfs = (clip.keyframes || []).map(k => {
        if (k.id === activeKfDrag.kfId) {
          return { ...k, time: targetTime, volume: targetVolume };
        }
        return k;
      }).sort((a, b) => a.time - b.time);
      
      const updatedClips = track.clips.map(c => {
        if (c.id === clip.id) {
          return { ...c, keyframes: updatedKfs };
        }
        return c;
      });
      onUpdateTrackClips(track.id, updatedClips);
      return;
    }

    if (!dragState) return;

    const deltaX = e.clientX - dragState.initialMouseX;
    const deltaSecs = deltaX / zoom;
    
    // Find active track
    const track = project.tracks.find(t => t.id === dragState.trackId);
    if (!track) return;

    // Adjust start time safely, clamping it inside boundaries
    const originalClip = track.clips.find(c => c.id === dragState.clipId);
    if (!originalClip) return;

    let targetStart = Math.max(0, Math.min(project.duration - originalClip.duration, dragState.initialStart + deltaSecs));

    // Magnetic snapping logic
    let activeSnapTime: number | null = null;
    if (magnetEnabled) {
      const targetEnd = targetStart + originalClip.duration;
      const snapThresholdPx = 10; // Snapping radius in screen pixels
      const snapThresholdSecs = snapThresholdPx / zoom;
      let bestDiff = snapThresholdSecs;
      let bestSnapPoint: number | null = null;
      let snapTargetType: 'start' | 'end' | null = null;

      // Collect all snap candidate times
      const snapPoints = new Set<number>();
      snapPoints.add(0); // Snap to start of timeline
      snapPoints.add(project.duration); // Snap to end of timeline
      snapPoints.add(currentTime); // Snap to current playhead / scrubber time

      // Snap to any other clip's boundary (either start or end) in any track
      project.tracks.forEach(t => {
        t.clips.forEach(c => {
          if (c.id !== originalClip.id) {
            snapPoints.add(c.start);
            snapPoints.add(c.start + c.duration);
          }
        });
      });

      for (const pt of snapPoints) {
        // Distance from start of dragged clip to this point
        const diffStart = Math.abs(targetStart - pt);
        if (diffStart < bestDiff) {
          bestDiff = diffStart;
          bestSnapPoint = pt;
          snapTargetType = 'start';
        }

        // Distance from end of dragged clip to this point
        const diffEnd = Math.abs(targetEnd - pt);
        if (diffEnd < bestDiff) {
          bestDiff = diffEnd;
          bestSnapPoint = pt;
          snapTargetType = 'end';
        }
      }

      if (bestSnapPoint !== null) {
        if (snapTargetType === 'start') {
          targetStart = bestSnapPoint;
        } else if (snapTargetType === 'end') {
          targetStart = bestSnapPoint - originalClip.duration;
        }
        activeSnapTime = bestSnapPoint;
      }
    }

    setSnapLineTime(activeSnapTime);

    const updatedClips = track.clips.map(c => {
      if (c.id === originalClip.id) {
        return { ...c, start: targetStart };
      }
      return c;
    });

    onUpdateTrackClips(track.id, updatedClips);
  };

  const handleTimelineMouseUp = () => {
    setDragState(null);
    setActiveKfDrag(null);
    setSnapLineTime(null);
  };

  // Slicer / Split handler
  const handleTriggerSplit = () => {
    if (!selectedClip) return;
    
    // Find parent track of selected clip
    let parentTrack: TimelineTrack | null = null;
    project.tracks.forEach(track => {
      if (track.clips.some(c => c.id === selectedClip.id)) {
        parentTrack = track;
      }
    });

    if (!parentTrack) return;
    
    const track: TimelineTrack = parentTrack;
    
    // Check if scrubber divides the clip
    if (currentTime > selectedClip.start && currentTime < selectedClip.start + selectedClip.duration) {
      onSplitClip(track.id, selectedClip.id, currentTime);
    } else {
      alert('Move the scrubber playhead inside the boundaries of the selected clip to cut/split it!');
    }
  };

  // Delete clip helper
  const handleTriggerDelete = () => {
    if (!selectedClip) return;
    project.tracks.forEach(track => {
      if (track.clips.some(c => c.id === selectedClip.id)) {
        onDeleteClip(track.id, selectedClip.id);
        onSelectClip(null);
      }
    });
  };

  // Visual offsets
  const totalTimelineWidth = project.duration * zoom;

  // Render rulers timing intervals (e.g., every 5s)
  const renderRulerTicks = () => {
    const ticks = [];
    // Adaptive tick frequency based on extended zoom levels
    const interval = zoom < 5 ? 10 : zoom < 15 ? 5 : zoom < 40 ? 2 : 1;
    for (let s = 0; s <= project.duration; s += interval) {
      const left = s * zoom;
      const mins = Math.floor(s / 60);
      const secs = s % 60;
      const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
      ticks.push(
        <div key={s} className="absolute top-0 bottom-0 border-l border-[#2A2A2D] flex flex-col justify-between select-none" style={{ left: `${left + 80}px` }}>
          <span className="text-[10px] font-mono font-semibold text-slate-500 pl-1 mt-1">{timeStr}</span>
          <div className="h-2 w-px bg-[#2A2A2D]"></div>
        </div>
      );
    }
    return ticks;
  };

  return (
    <div 
      id="video-timeline"
      className="bg-[#121214] border-t border-[#2A2A2D] flex flex-col shrink-0 select-none h-[300px]"
      onMouseMove={handleTimelineMouseMove}
      onMouseUp={handleTimelineMouseUp}
      onMouseLeave={handleTimelineMouseUp}
    >
      {/* Timeline Controls / Split / Delete actions */}
      <div className="flex items-center justify-between border-b border-[#2A2A2D] px-4 py-2 shrink-0 bg-[#0F0F10]">
        <div className="flex items-center gap-2">
          {/* VividCut-style Timeline Undo/Redo buttons */}
          <div className="flex items-center gap-1 border-r border-[#2A2A2D] pr-2.5 mr-1">
            <button
              id="btn-timeline-undo"
              disabled={!canUndo}
              onClick={onUndo}
              className="p-1.5 bg-[#161618] border border-[#2d2d34] hover:border-[#3d3d46] disabled:opacity-35 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Undo edit (Ctrl+Z)"
            >
              <Undo2 size={13} />
            </button>
            <button
              id="btn-timeline-redo"
              disabled={!canRedo}
              onClick={onRedo}
              className="p-1.5 bg-[#161618] border border-[#2d2d34] hover:border-[#3d3d46] disabled:opacity-35 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Redo edit (Ctrl+Y)"
            >
              <Redo2 size={13} />
            </button>
          </div>

          <button
            id="btn-split-selected-clip"
            disabled={!selectedClip}
            onClick={handleTriggerSplit}
            className="px-3 py-1.5 bg-[#161618] border border-[#2A2A2D] hover:border-[#35353A] hover:bg-[#232326] disabled:opacity-30 text-xs font-semibold text-indigo-400 rounded flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Split selected clip at current playhead position"
          >
            <Scissors size={13} />
            Split Clip
          </button>

          <button
            id="btn-delete-selected-clip"
            disabled={!selectedClip}
            onClick={handleTriggerDelete}
            className="px-3 py-1.5 bg-[#161618] border border-[#2A2A2D] hover:border-[#35353A] hover:bg-[#232326] disabled:opacity-30 text-xs font-semibold text-red-400 rounded flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Delete active clip"
          >
            <Trash2 size={13} />
            Delete
          </button>

          <button
            id="btn-toggle-magnetic-snapping"
            onClick={() => setMagnetEnabled(prev => !prev)}
            className={`px-3 py-1.5 border rounded flex items-center gap-1.5 transition-colors cursor-pointer text-xs font-semibold ${
              magnetEnabled 
                ? 'bg-cyan-950/40 border-cyan-800/80 hover:border-cyan-700 hover:bg-cyan-950/60 text-cyan-400' 
                : 'bg-[#161618] border-[#2A2A2D] hover:border-[#35353A] text-slate-400 hover:text-slate-300'
            }`}
            title={magnetEnabled ? "Magnetic Snapping: Enabled (Click to disable)" : "Magnetic Snapping: Disabled (Click to enable)"}
          >
            <Magnet size={13} className={magnetEnabled ? "animate-pulse text-cyan-400" : "text-slate-400"} />
            Snapping
          </button>
        </div>

        {/* Volume Automation Help / Glowing Tip Banner */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-emerald-950/30 border border-emerald-900/40 rounded-full text-emerald-400 text-[10px] font-medium tracking-wide">
          <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Tip: Double-click audio clips to add volume keyframes, then drag to fade & automate levels!</span>
        </div>

        {/* Horizontal Time-Scale (Zoom) Slider */}
        <div className="flex items-center gap-3 bg-[#161618] px-3 py-1 rounded-md border border-[#2A2A2D]">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden sm:inline">
            Time Scale
          </span>
          
          <button 
            id="btn-timeline-zoom-out"
            onClick={() => setZoom(prev => Math.max(2, prev - 5))}
            className="p-1 hover:bg-[#232326] text-slate-400 hover:text-slate-200 rounded cursor-pointer transition-colors"
            title="Decrease Horizontal Zoom"
          >
            <ZoomOut size={13} />
          </button>
          
          <input
            id="timeline-zoom-slider"
            type="range"
            min={2}
            max={100}
            step={1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-28 sm:w-36 accent-indigo-500 h-1 bg-[#2A2A2D] rounded-full cursor-ew-resize focus:outline-none"
            title="Adjust horizontal scale"
          />

          <button 
            id="btn-timeline-zoom-in"
            onClick={() => setZoom(prev => Math.min(100, prev + 5))}
            className="p-1 hover:bg-[#232326] text-slate-400 hover:text-slate-200 rounded cursor-pointer transition-colors"
            title="Increase Horizontal Zoom"
          >
            <ZoomIn size={13} />
          </button>

          <span className="text-[10px] text-indigo-400 font-mono font-bold bg-indigo-950/40 border border-indigo-900/40 px-1.5 py-0.5 rounded select-none min-w-[50px] text-center">
            {zoom} px/s
          </span>
        </div>
      </div>

      {/* Main Track lanes + Scrubber Scrollarea */}
      <div 
        ref={tracksContainerRef}
        className="flex-1 overflow-x-auto overflow-y-auto relative flex flex-col"
      >
        {/* Time Ruler / Scrubber Clickable Strip */}
        <div 
          id="timeline-ruler"
          className="h-9 border-b border-[#2A2A2D] relative bg-[#0F0F10]/60 cursor-pointer select-none sticky top-0 z-20 shrink-0"
          onClick={handleRulerClickOrDrag}
        >
          {/* Label Spacer */}
          <div className="absolute top-0 bottom-0 left-0 w-20 bg-[#0F0F10] border-r border-[#2A2A2D] flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase tracking-wider z-10">
            Ruler
          </div>

          {/* Time ticks */}
          {renderRulerTicks()}

          {/* Track Limit bounding boundary */}
          <div 
            className="absolute top-0 bottom-0 border-r-2 border-dashed border-red-900 pointer-events-none"
            style={{ left: `${totalTimelineWidth + 80}px` }}
          />
        </div>

        {/* List Track Lanes */}
        <div className="flex-1 flex flex-col min-h-max relative pb-4">
          
          {/* Vertical Pink Time Scrubber Line Indicator */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-indigo-500 z-15 pointer-events-none shadow"
            style={{ left: `${currentTime * zoom + 80}px` }}
          >
            {/* Scrubber head handle */}
            <div className="absolute -top-[36px] -left-[6px] w-3.5 h-3.5 bg-indigo-500 rounded-full border border-white shadow"></div>
          </div>

          {/* Magnetic Guideline Indicator */}
          {snapLineTime !== null && (
            <div 
              className="absolute top-0 bottom-0 w-px border-l-2 border-dashed border-cyan-400 z-20 pointer-events-none"
              style={{ left: `${snapLineTime * zoom + 80}px` }}
            >
              <div className="absolute -top-6 -left-[7px] w-4 h-4 bg-cyan-400 rounded-full border border-slate-900 shadow-md flex items-center justify-center animate-bounce">
                <span className="text-[8px] text-slate-900 font-bold select-none">🧲</span>
              </div>
            </div>
          )}

          {project.tracks.map((track) => (
            <div 
              key={track.id} 
              className="h-[64px] border-b border-[#2A2A2D] flex items-center relative group select-none"
            >
              {/* Track Info sidebar label */}
              <div className="absolute left-0 top-0 bottom-0 w-20 bg-[#0F0F10] border-r border-[#2A2A2D] flex flex-col justify-center px-2 py-1 shrink-0 z-10 select-none">
                <span className="text-[10px] font-bold text-slate-300 truncate tracking-wide block capitalize">{track.name}</span>
                
                {/* Track controls */}
                <div className="flex items-center gap-1.5 mt-1 opacity-60 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onToggleMuteTrack(track.id)}
                    className="p-0.5 hover:bg-[#232326] rounded text-slate-500 hover:text-slate-300 cursor-pointer"
                    title={track.muted ? 'Unmute Track' : 'Mute Track'}
                  >
                    {track.muted ? <VolumeX size={10} className="text-red-500" /> : <Volume2 size={10} />}
                  </button>

                  <button
                    onClick={() => onAddClipToTrack(track.id, track.type)}
                    className="p-0.5 hover:bg-[#232326] rounded text-slate-500 hover:text-indigo-400 cursor-pointer ml-auto"
                    title="Add dummy blank clip here"
                  >
                    <Plus size={10} />
                  </button>
                </div>
              </div>

              {/* Lane Content clips zone */}
              <div 
                className="absolute top-0 bottom-0 flex items-center overflow-hidden"
                style={{ left: '80px', width: `${totalTimelineWidth}px` }}
              >
                {/* Empty track guides overlay */}
                <div className="absolute inset-0 bg-[#0F0F10]/30 pointer-events-none" />

                {track.clips.map((clip) => {
                  const isSelected = selectedClip?.id === clip.id;
                  
                  // Style colors based on clip type
                  const colorStyles = {
                    video: isSelected 
                      ? 'bg-indigo-600/90 border-indigo-400 ring-2 ring-indigo-300/40 shadow-lg shadow-indigo-950/40' 
                      : 'bg-indigo-950/80 hover:bg-indigo-900 border-indigo-900/60 text-indigo-200',
                    image: isSelected 
                      ? 'bg-blue-600/90 border-blue-400 ring-2 ring-blue-300/40 shadow-lg shadow-blue-950/40' 
                      : 'bg-blue-950/80 hover:bg-blue-900 border-blue-900/60 text-blue-200',
                    audio: isSelected 
                      ? 'bg-emerald-600/90 border-emerald-400 ring-2 ring-emerald-300/40 shadow-lg shadow-emerald-950/40' 
                      : 'bg-emerald-950/80 hover:bg-emerald-900 border-emerald-900/60 text-emerald-200',
                    text: isSelected 
                      ? 'bg-violet-600/90 border-violet-400 ring-2 ring-violet-300/40 shadow-lg shadow-violet-950/40' 
                      : 'bg-violet-950/80 hover:bg-violet-900 border-violet-900/60 text-violet-200',
                  }[clip.type];

                  const leftOffset = clip.start * zoom;
                  const width = clip.duration * zoom;

                  return (
                    <div
                      key={clip.id}
                      onMouseDown={(e) => handleClipMouseDown(e, track.id, clip)}
                      className={`absolute top-2 bottom-2 border rounded-md px-2 flex flex-col justify-center overflow-hidden select-none cursor-grab transition-all duration-75 ${colorStyles}`}
                      style={{ 
                        left: `${leftOffset}px`, 
                        width: `${width}px` 
                      }}
                    >
                      {/* Left Trim Handle */}
                      <div 
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          // Handle fine trimming manually inside the properties panel or with nudge keys
                        }}
                        className="absolute left-0 top-0 bottom-0 w-1.5 bg-black/20 hover:bg-black/40 cursor-ew-resize transition-colors z-20"
                        title="Drag to trim"
                      />

                      {/* Dynamic Audio Waveform Background */}
                      {clip.type === 'audio' && (
                        <div className="absolute inset-x-3 inset-y-1.5 overflow-hidden pointer-events-none opacity-40 flex items-center justify-between gap-[2px] z-0">
                          {getClipWaveformAmplitudes(clip.id, Math.max(16, Math.floor(width / 4.5))).map((amp, idx) => (
                            <div 
                              key={idx}
                              className={`w-[2px] rounded-full transition-all duration-300 ${isSelected ? 'bg-emerald-300' : 'bg-emerald-500/80'}`}
                              style={{ height: `${amp * 100}%` }}
                            />
                          ))}
                        </div>
                      )}

                      {/* Clip label */}
                      <div className="flex flex-col text-[10px] pl-1 font-semibold leading-tight select-none pointer-events-none truncate z-0">
                        <span className="truncate">{clip.name}</span>
                        <span className="text-[8px] opacity-75 font-mono truncate">
                          {(clip.start).toFixed(1)}s - {(clip.start + clip.duration).toFixed(1)}s
                        </span>
                      </div>

                      {/* Right Trim Handle */}
                      <div 
                        onMouseDown={(e) => {
                          e.stopPropagation();
                        }}
                        className="absolute right-0 top-0 bottom-0 w-1.5 bg-black/20 hover:bg-black/40 cursor-ew-resize transition-colors z-20"
                        title="Drag to trim"
                      />

                      {/* Interactive Volume Envelope overlay (only for Audio clips) */}
                      {clip.type === 'audio' && (
                        <div 
                          className="absolute inset-0 z-10 pointer-events-auto"
                          onDoubleClick={(e) => handleOverlayDoubleClick(e, clip, track)}
                          title="Double-click to add a volume automation keyframe"
                        >
                          {/* Shaded area and path line */}
                          <svg 
                            className="absolute inset-0 w-full h-full pointer-events-none"
                            viewBox="0 0 100 100" 
                            preserveAspectRatio="none"
                          >
                            <defs>
                              <linearGradient id={`grad-${clip.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#facc15" stopOpacity="0.3" />
                                <stop offset="100%" stopColor="#facc15" stopOpacity="0" />
                              </linearGradient>
                            </defs>
                            
                            {/* Area under curve */}
                            <path 
                              d={`${getVolumePathD(clip)} L 100 100 L 0 100 Z`}
                              fill={`url(#grad-${clip.id})`}
                              className="opacity-40"
                            />
                            
                            {/* Envelope Line */}
                            <path 
                              d={getVolumePathD(clip)}
                              fill="none"
                              stroke="#facc15"
                              strokeWidth="2"
                              className="opacity-70"
                            />
                          </svg>

                          {/* Keyframe node handles */}
                          {(clip.keyframes || []).map((kf) => {
                            const cx = (kf.time / clip.duration) * 100;
                            const cy = (1 - (kf.volume ?? (clip as any).volume ?? 1)) * 100;
                            const isActive = activeKfDrag?.kfId === kf.id;
                            
                            return (
                              <div
                                key={kf.id}
                                onMouseDown={(e) => handleKfMouseDown(e, kf, clip, track)}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteKf(kf.id, clip, track);
                                }}
                                className={`absolute w-3 h-3 -ml-1.5 -mt-1.5 bg-yellow-400 hover:bg-yellow-300 border border-slate-950 rounded-full cursor-pointer z-20 shadow-md transition-transform ${
                                  isActive ? 'scale-125 bg-amber-400 ring-2 ring-yellow-400' : ''
                                }`}
                                style={{
                                  left: `${cx}%`,
                                  top: `${cy}%`
                                }}
                                title={`Volume: ${Math.round((kf.volume ?? 1) * 100)}% at ${kf.time.toFixed(2)}s. Drag to move, double-click to remove.`}
                              >
                                {/* Floating percentage value indicator when dragging */}
                                {isActive && (
                                  <div className="absolute bg-slate-950 text-yellow-400 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border border-yellow-500/40 shadow-xl pointer-events-none select-none z-30 -translate-x-1/2 -translate-y-6 left-1/2 whitespace-nowrap">
                                    {Math.round((kf.volume ?? 1) * 100)}%
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
