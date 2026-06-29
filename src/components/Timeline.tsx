import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
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
  Magnet,
  RefreshCw,
  Copy,
  Clipboard,
  ArrowUp,
  ArrowDown,
  Settings,
  Maximize,
  MoreHorizontal,
  ChevronDown,
  Diamond
} from 'lucide-react';
import { VideoProject, TimelineTrack, Clip, MediaType, VideoClip, ImageClip, AudioClip, TextClip } from '../types';

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

const formatPlayheadTime = (time: number) => {
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  const ms = Math.floor((time % 1) * 10);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
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
  onUpdateProject?: (project: VideoProject) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  selectedClipIds?: string[];
  onSelectClips?: (ids: string[], primaryClip: Clip | null) => void;
  onDeleteSelectedClips?: () => void;
  onCopyClips?: () => void;
  onPasteClips?: () => void;
  height?: number;
  isResizing?: boolean;
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
  onUpdateProject,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  selectedClipIds = [],
  onSelectClips,
  onDeleteSelectedClips,
  onCopyClips,
  onPasteClips,
  height,
  isResizing
}: TimelineProps) {
  const [zoom, setZoom] = useState<number>(10);
  const tracksContainerRef = useRef<HTMLDivElement | null>(null);
  const timelineOuterRef = useRef<HTMLDivElement | null>(null);

  // Zoom / Interaction Refs
  const zoomRef = useRef<number>(10);
  const targetZoomRef = useRef<number>(10);
  const zoomAnchorTimeRef = useRef<number | null>(null);
  const zoomAnchorMouseXRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Scroll Tracking State (needed to virtualize ruler and update it on horizontal scroll)
  const [scrollLeftState, setScrollLeftState] = useState<number>(0);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);

  // Middle-mouse drag panning state refs
  const isPanningRef = useRef<boolean>(false);
  const panStartXRef = useRef<number>(0);
  const panStartScrollLeftRef = useRef<number>(0);

  // Auto-scroll refs
  const autoScrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastMouseXRef = useRef<number>(0);
  const containerRectRef = useRef<DOMRect | null>(null);

  // Sync prop refs to prevent rebuilding event listeners
  const currentTimeRef = useRef<number>(currentTime);
  currentTimeRef.current = currentTime;
  const projectDurationRef = useRef<number>(project.duration);
  projectDurationRef.current = project.duration;

  // Selection box / marquee state
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Collapsed tracks state
  const [collapsedTracks, setCollapsedTracks] = useState<Record<string, boolean>>({});
  
  // Track renaming state
  const [renamingTrackId, setRenamingTrackId] = useState<string | null>(null);
  const [renamingTrackName, setRenamingTrackName] = useState<string>('');

  const handleRenameTrackStart = (trackId: string, name: string) => {
    setRenamingTrackId(trackId);
    setRenamingTrackName(name);
  };

  const handleRenameTrackSubmit = (trackId: string) => {
    if (!renamingTrackName.trim() || !onUpdateProject) return;
    const updatedTracks = project.tracks.map(t => {
      if (t.id === trackId) {
        return { ...t, name: renamingTrackName.trim() };
      }
      return t;
    });
    onUpdateProject({ ...project, tracks: updatedTracks });
    setRenamingTrackId(null);
  };

  // Individual track heights state & helpers
  const [trackHeights, setTrackHeights] = useState<Record<string, number>>(() => {
    const saved: Record<string, number> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('vividcut-track-height-')) {
          const trackId = key.replace('vividcut-track-height-', '');
          const val = localStorage.getItem(key);
          if (val) {
            saved[trackId] = parseInt(val, 10);
          }
        }
      }
    } catch (e) {
      console.error('Error loading track heights:', e);
    }
    return saved;
  });

  const updateTrackHeight = (trackId: string, height: number) => {
    setTrackHeights(prev => ({
      ...prev,
      [trackId]: height
    }));
    localStorage.setItem(`vividcut-track-height-${trackId}`, String(height));
  };

  const resetTrackHeight = (trackId: string) => {
    setTrackHeights(prev => {
      const next = { ...prev };
      delete next[trackId];
      return next;
    });
    localStorage.removeItem(`vividcut-track-height-${trackId}`);
  };

  // Mouse resizing handler for individual tracks
  const handleTrackResizeStart = (e: React.MouseEvent, trackId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startY = e.clientY;
    const startHeight = trackHeights[trackId] || 64;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const newHeight = Math.max(36, Math.min(300, startHeight + deltaY));
      updateTrackHeight(trackId, newHeight);
    };
    
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const activeSelectedIds = selectedClipIds && selectedClipIds.length > 0 
    ? selectedClipIds 
    : (selectedClip ? [selectedClip.id] : []);

  // Dragging state for sliding clips
  const [dragState, setDragState] = useState<{
    clipId: string;
    trackId: string;
    initialStart: number;
    initialMouseX: number;
    initialScrollLeft: number;
    currentStart: number;
    snappedStart: number;
    currentTrackId: string;
    isValidTarget: boolean;
    isMultiDrag?: boolean;
    draggedClips?: Array<{
      clipId: string;
      trackId: string;
      initialStart: number;
      currentStart: number;
      snappedStart: number;
    }>;
  } | null>(null);

  // Trimming state for clips
  const [trimState, setTrimState] = useState<{
    clipId: string;
    trackId: string;
    edge: 'left' | 'right';
    initialStart: number;
    initialDuration: number;
    initialSourceOffset: number;
    initialMouseX: number;
    initialScrollLeft: number;
    currentStart: number;
    currentDuration: number;
    currentSourceOffset: number;
  } | null>(null);

  // External drag state for assets being dragged from Media Library
  const [externalDrag, setExternalDrag] = useState<{
    itemType: string;
    data: any;
    currentTrackId: string | null;
    hoverTime: number;
    snappedTime: number;
    isValidTarget: boolean;
    hoverClipId: string | null;
  } | null>(null);

  // Ripple editing state
  const [rippleEnabled, setRippleEnabled] = useState<boolean>(true);

  // Advanced dropdown menu state
  const [advancedMenuOpen, setAdvancedMenuOpen] = useState<boolean>(false);

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

  // Hover state for the ruler to show ghost playhead & tooltip
  const [hoverRulerTime, setHoverRulerTime] = useState<number | null>(null);

  // Dynamic active duration calculation based on project length and currently edited items
  let activeDuration = project.duration;
  
  if (dragState) {
    if (dragState.isMultiDrag && dragState.draggedClips) {
      dragState.draggedClips.forEach(dc => {
        const originalClip = project.tracks
          .find(t => t.id === dc.trackId)
          ?.clips.find(c => c.id === dc.clipId);
        if (originalClip) {
          const end = dc.snappedStart + originalClip.duration;
          if (end > activeDuration) {
            activeDuration = end;
          }
        }
      });
    } else {
      const originalClip = project.tracks
        .find(t => t.id === dragState.trackId)
        ?.clips.find(c => c.id === dragState.clipId);
      if (originalClip) {
        const end = dragState.snappedStart + originalClip.duration;
        if (end > activeDuration) {
          activeDuration = end;
        }
      }
    }
  }
  
  if (trimState) {
    const end = trimState.currentStart + trimState.currentDuration;
    if (end > activeDuration) {
      activeDuration = end;
    }
  }
  
  if (externalDrag) {
    const assetDuration = (externalDrag.itemType === 'effect' || externalDrag.itemType === 'transition')
      ? 3
      : (externalDrag.data?.duration || 5);
    const end = externalDrag.snappedTime + assetDuration;
    if (end > activeDuration) {
      activeDuration = end;
    }
  }

  // Calculate dynamic workspace duration (ensures blank workspace of at least 5 minutes, extending dynamically as we scroll)
  const viewportWidthForWorkspace = tracksContainerRef.current ? tracksContainerRef.current.clientWidth : 800;
  const visibleEndTime = (scrollLeftState + viewportWidthForWorkspace) / zoom;
  const viewportDuration = viewportWidthForWorkspace / zoom;
  // Always keep at least 5 minutes of empty space after the last clip, and at least one viewport width of empty overscroll beyond the visible window
  let workspaceDuration = Math.max(activeDuration + 300, visibleEndTime + viewportDuration);

  // Keep projectDurationRef synced so zoom constraints stay correct
  projectDurationRef.current = workspaceDuration;

  // Toggle track locking status helper
  const handleToggleLockTrack = (trackId: string) => {
    if (!onUpdateProject) return;
    const updatedTracks = project.tracks.map(t => {
      if (t.id === trackId) {
        return { ...t, locked: !t.locked };
      }
      return t;
    });
    onUpdateProject({ ...project, tracks: updatedTracks });
  };

  // Toggle track hiding status helper
  const handleToggleHideTrack = (trackId: string) => {
    if (!onUpdateProject) return;
    const updatedTracks = project.tracks.map(t => {
      if (t.id === trackId) {
        return { ...t, hidden: !t.hidden };
      }
      return t;
    });
    onUpdateProject({ ...project, tracks: updatedTracks });
  };

  // Zoom keys hotkey listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCtrl = isMac ? e.metaKey : e.ctrlKey;
      
      if (isCtrl) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          triggerZoomTo(zoomRef.current * 1.35);
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          triggerZoomTo(zoomRef.current / 1.35);
        } else if (e.key === '0') {
          e.preventDefault();
          const { minZoom } = getZoomLimits();
          triggerZoomTo(minZoom);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [project.duration]);

  // Context Menu State
  interface ContextMenuState {
    x: number;
    y: number;
    type: 'clip' | 'empty';
    clip?: Clip;
    track?: TimelineTrack;
  }

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const handleClipContextMenu = (e: React.MouseEvent, track: TimelineTrack, clip: Clip) => {
    e.preventDefault();
    e.stopPropagation();

    // Sync selected clips: if clip is not already part of selectedClipIds, select it as primary
    if (onSelectClips) {
      if (!selectedClipIds.includes(clip.id)) {
        onSelectClips([clip.id], clip);
      }
    } else {
      onSelectClip(clip);
    }

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'clip',
      clip,
      track
    });
  };

  const handleGridContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'empty'
    });
  };

  // Close context menu on any global clicks or presses
  useEffect(() => {
    if (!contextMenu) return;

    const handleGlobalClick = () => {
      setContextMenu(null);
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
      }
    };

    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [contextMenu]);

  // External drag cleanup
  useEffect(() => {
    const handleDragEnd = () => {
      setExternalDrag(null);
    };
    window.addEventListener('vividcut-drag-end', handleDragEnd);
    return () => {
      window.removeEventListener('vividcut-drag-end', handleDragEnd);
    };
  }, []);

  const createClipFromDraggedItem = (itemType: string, data: any, dropTime: number): Clip => {
    const clipId = `clip_${data.id || Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    if (itemType === 'video') {
      const clipDuration = data.duration && data.duration !== Infinity ? data.duration : 5;
      return {
        id: clipId,
        name: data.name,
        type: 'video',
        start: dropTime,
        duration: clipDuration,
        sourceDuration: clipDuration,
        sourceOffset: 0,
        url: data.url,
        proceduralType: data.proceduralType,
        filter: 'none',
        volume: 0.5,
        speed: 1,
        brightness: 100,
        contrast: 100,
        saturation: 100
      } as VideoClip;
    } else if (itemType === 'image') {
      return {
        id: clipId,
        name: data.name,
        type: 'image',
        start: dropTime,
        duration: 5,
        sourceDuration: 5,
        sourceOffset: 0,
        url: data.url,
        filter: 'none',
        brightness: 100,
        contrast: 100,
        saturation: 100
      } as ImageClip;
    } else if (itemType === 'audio') {
      const clipDuration = data.duration && data.duration !== Infinity ? data.duration : 10;
      return {
        id: clipId,
        name: data.name,
        type: 'audio',
        start: dropTime,
        duration: clipDuration,
        sourceDuration: clipDuration,
        sourceOffset: 0,
        url: data.url,
        synthType: data.synthType || 'none',
        volume: 0.6,
        speed: 1
      } as AudioClip;
    } else if (itemType === 'text' || itemType === 'sticker') {
      return {
        id: clipId,
        name: data.name || 'Custom Overlay',
        type: 'text',
        start: dropTime,
        duration: data.duration || 5,
        sourceDuration: data.duration || 5,
        sourceOffset: 0,
        url: 'text',
        text: data.text || data.name || 'Custom Caption Subtitle',
        fontFamily: data.fontFamily || 'Inter',
        fontSize: data.fontSize || 32,
        color: data.color || '#ffffff',
        backgroundColor: data.backgroundColor || 'transparent',
        alignment: data.alignment || 'center',
        animation: data.animation || 'none',
        positionY: data.positionY ?? 50,
        stylePreset: data.stylePreset || 'none'
      } as TextClip;
    }
    
    throw new Error(`Unsupported item type: ${itemType}`);
  };

  const handleTrackDragOver = (e: React.DragEvent<HTMLDivElement>, track: TimelineTrack) => {
    e.preventDefault();
    
    const draggedItem = (window as any).VividCutDraggedItem;
    if (!draggedItem) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const scrollLeft = tracksContainerRef.current ? tracksContainerRef.current.scrollLeft : 0;
    
    const xOnTrack = e.clientX - rect.left - 80;
    if (xOnTrack < 0) {
      setExternalDrag(prev => prev ? { ...prev, currentTrackId: null } : null);
      return;
    }

    const hoverTime = (scrollLeft + xOnTrack) / zoom;
    
    let snappedTime = hoverTime;
    const snapDistance = 15 / zoom;
    if (Math.abs(hoverTime - currentTime) < snapDistance) {
      snappedTime = currentTime;
    }

    track.clips.forEach(c => {
      if (Math.abs(hoverTime - c.start) < snapDistance) {
        snappedTime = c.start;
      }
      if (Math.abs(hoverTime - (c.start + c.duration)) < snapDistance) {
        snappedTime = c.start + c.duration;
      }
    });

    let isValidTarget = false;
    if (draggedItem.itemType === 'video' || draggedItem.itemType === 'image') {
      isValidTarget = track.type === 'video';
    } else if (draggedItem.itemType === 'audio') {
      isValidTarget = track.type === 'audio';
    } else if (draggedItem.itemType === 'text' || draggedItem.itemType === 'sticker') {
      isValidTarget = track.type === 'text';
    } else if (draggedItem.itemType === 'effect' || draggedItem.itemType === 'transition') {
      isValidTarget = true;
    }

    let hoverClipId: string | null = null;
    if (draggedItem.itemType === 'effect' || draggedItem.itemType === 'transition') {
      const clipUnderMouse = track.clips.find(c => hoverTime >= c.start && hoverTime <= c.start + c.duration);
      if (clipUnderMouse) {
        hoverClipId = clipUnderMouse.id;
      }
    }

    setExternalDrag({
      itemType: draggedItem.itemType,
      data: draggedItem.data,
      currentTrackId: track.id,
      hoverTime,
      snappedTime,
      isValidTarget,
      hoverClipId
    });
  };

  const handleTrackDragLeave = () => {
    setExternalDrag(prev => prev ? { ...prev, currentTrackId: null } : null);
  };

  const handleTrackDrop = (e: React.DragEvent<HTMLDivElement>, track: TimelineTrack) => {
    e.preventDefault();
    
    if (!externalDrag || !externalDrag.isValidTarget) {
      setExternalDrag(null);
      return;
    }
    
    const { itemType, data, snappedTime, hoverClipId } = externalDrag;
    
    if (itemType === 'effect' || itemType === 'transition') {
      if (hoverClipId) {
        const updatedClips = track.clips.map(c => {
          if (c.id === hoverClipId) {
            if (itemType === 'effect') {
              return {
                ...c,
                [data.key]: true
              };
            } else {
              return {
                ...c,
                transitionType: data.type || data.transitionType || 'fade',
                transitionDuration: c.transitionDuration || 1.0
              };
            }
          }
          return c;
        });
        onUpdateTrackClips(track.id, updatedClips);
        const targetClip = updatedClips.find(c => c.id === hoverClipId);
        if (targetClip) {
          onSelectClip(targetClip);
        }
      }
    } else {
      const newClip = createClipFromDraggedItem(itemType, data, snappedTime);
      const updatedClips = [...track.clips, newClip].sort((a, b) => a.start - b.start);
      onUpdateTrackClips(track.id, updatedClips);
      onSelectClip(newClip);
    }
    
    setExternalDrag(null);
  };

  const handleCopyAction = () => {
    if (onCopyClips) {
      onCopyClips();
    }
    setContextMenu(null);
  };

  const handleCutAction = () => {
    if (onCopyClips) {
      onCopyClips();
    }
    if (onDeleteSelectedClips) {
      onDeleteSelectedClips();
    }
    setContextMenu(null);
  };

  const handleDuplicateAction = () => {
    if (!onUpdateProject) return;
    
    // Determine which clip IDs are selected
    const idsToDuplicate = activeSelectedIds.length > 0 
      ? activeSelectedIds 
      : (contextMenu?.clip ? [contextMenu.clip.id] : []);
      
    if (idsToDuplicate.length === 0) return;
    
    const newTracks = project.tracks.map(track => {
      const clipsToDup = track.clips.filter(c => idsToDuplicate.includes(c.id));
      if (clipsToDup.length === 0) return track;
      
      const duplicatedClips = clipsToDup.map(c => {
        const newId = 'clip-' + Math.random().toString(36).substr(2, 9);
        return {
          ...JSON.parse(JSON.stringify(c)),
          id: newId,
          start: c.start + c.duration // place immediately after
        } as Clip;
      });
      
      return {
        ...track,
        clips: [...track.clips, ...duplicatedClips].sort((a, b) => a.start - b.start)
      };
    });
    
    onUpdateProject({ ...project, tracks: newTracks });
    setContextMenu(null);
  };

  const handleDeleteAction = () => {
    if (onDeleteSelectedClips) {
      onDeleteSelectedClips();
    } else if (contextMenu?.clip && contextMenu?.track) {
      onDeleteClip(contextMenu.track.id, contextMenu.clip.id);
    }
    setContextMenu(null);
  };

  const handleSplitAction = () => {
    if (contextMenu?.clip && contextMenu?.track) {
      onSplitClip(contextMenu.track.id, contextMenu.clip.id, currentTime);
    }
    setContextMenu(null);
  };

  const handleLayerShift = (direction: 'forward' | 'backward') => {
    if (!onUpdateProject || !contextMenu?.track) return;
    
    const trackId = contextMenu.track.id;
    const trackIndex = project.tracks.findIndex(t => t.id === trackId);
    if (trackIndex === -1) return;
    
    const updatedTracks = [...project.tracks];
    
    if (direction === 'forward') {
      // Bring Forward: move track later in rendering order (index increases, i.e. rendered on top of next layer)
      if (trackIndex < updatedTracks.length - 1) {
        // swap with next
        const temp = updatedTracks[trackIndex];
        updatedTracks[trackIndex] = updatedTracks[trackIndex + 1];
        updatedTracks[trackIndex + 1] = temp;
      }
    } else {
      // Send Backward: move track earlier in rendering order (index decreases, i.e. rendered underneath previous layer)
      if (trackIndex > 0) {
        // swap with previous
        const temp = updatedTracks[trackIndex];
        updatedTracks[trackIndex] = updatedTracks[trackIndex - 1];
        updatedTracks[trackIndex - 1] = temp;
      }
    }
    
    onUpdateProject({ ...project, tracks: updatedTracks });
    setContextMenu(null);
  };

  const handlePropertiesAction = () => {
    if (contextMenu?.clip) {
      onSelectClip(contextMenu.clip);
    }
    setContextMenu(null);
  };

  const handlePasteAction = () => {
    if (onPasteClips) {
      onPasteClips();
    }
    setContextMenu(null);
  };

  const handleAddCustomTrack = (type: MediaType) => {
    if (!onUpdateProject) return;
    
    const newTrackId = `track_custom_${Date.now()}`;
    const newTrack: TimelineTrack = {
      id: newTrackId,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Track ${project.tracks.length + 1}`,
      type: type,
      clips: [],
      muted: false,
      locked: false
    };
    
    const updatedTracks = [...project.tracks, newTrack];
    onUpdateProject({ ...project, tracks: updatedTracks });
    setContextMenu(null);
  };

  const handleZoomToFitAction = () => {
    const { minZoom } = getZoomLimits();
    triggerZoomTo(minZoom);
    setContextMenu(null);
  };

  // Zoom bounds helper
  const getZoomLimits = () => {
    const viewportWidth = tracksContainerRef.current ? tracksContainerRef.current.clientWidth - 80 : 800;
    // Base minZoom on active clips duration + 5 minutes of padding so the entire active workspace is fully visible when zoomed out
    const minZoom = Math.max(0.005, viewportWidth / (activeDuration + 300));
    const maxZoom = 500;
    return { minZoom, maxZoom };
  };

  // Logarithmic slider helpers to map linear [0, 100] values to logarithmic zoom levels
  const getSliderValue = (currentZoom: number) => {
    const { minZoom, maxZoom } = getZoomLimits();
    const lMin = Math.log(minZoom);
    const lMax = Math.log(maxZoom);
    if (Math.abs(lMax - lMin) < 0.0001) return 50;
    const pct = (Math.log(currentZoom) - lMin) / (lMax - lMin);
    return Math.max(0, Math.min(100, pct * 100));
  };

  const getZoomFromSlider = (val: number) => {
    const { minZoom, maxZoom } = getZoomLimits();
    const lMin = Math.log(minZoom);
    const lMax = Math.log(maxZoom);
    const pct = val / 100;
    return Math.exp(lMin + pct * (lMax - lMin));
  };

  // Keep scrolling/zoom anchored precisely before painting to eliminate visual jumping/bouncing
  useLayoutEffect(() => {
    if (!tracksContainerRef.current || zoomAnchorTimeRef.current === null || zoomAnchorMouseXRef.current === null) return;
    
    // S_ideal = t_anchor * z - x_anchor
    const idealScroll = zoomAnchorTimeRef.current * zoom - zoomAnchorMouseXRef.current;
    
    // Clamp target scroll position to avoid physical layout boundary jumps
    const maxScroll = tracksContainerRef.current.scrollWidth - tracksContainerRef.current.clientWidth;
    const clampedScroll = Math.max(0, Math.min(maxScroll, idealScroll));
    
    tracksContainerRef.current.scrollLeft = clampedScroll;
    setScrollLeftState(clampedScroll);
  }, [zoom]);

  // Zoom animation loop using requestAnimationFrame
  const startZoomAnimationLoop = () => {
    if (animFrameRef.current !== null) return;

    const tick = () => {
      if (!tracksContainerRef.current) {
        animFrameRef.current = null;
        return;
      }

      const currentZoom = zoomRef.current;
      const targetZoom = targetZoomRef.current;
      const diff = targetZoom - currentZoom;

      if (Math.abs(diff) < 0.01) {
        const finalZoom = targetZoom;
        zoomRef.current = finalZoom;
        setZoom(finalZoom);
        animFrameRef.current = null;
      } else {
        const step = diff * 0.14; // smoother, premium exponential spring lerping
        const nextZoom = currentZoom + step;
        zoomRef.current = nextZoom;
        setZoom(nextZoom);
        animFrameRef.current = requestAnimationFrame(tick);
      }
    };

    animFrameRef.current = requestAnimationFrame(tick);
  };

  // Unified function to zoom to a specific level
  const triggerZoomTo = (newZoom: number) => {
    if (!tracksContainerRef.current) return;
    const rect = tracksContainerRef.current.getBoundingClientRect();
    const viewportWidth = rect.width - 80;
    const scrollLeft = tracksContainerRef.current.scrollLeft;

    const { minZoom, maxZoom } = getZoomLimits();
    const clampedZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));

    // Determine viewport/playhead anchor point
    let anchorTime = 0;
    let anchorX = 0;
    const playheadX = currentTimeRef.current * zoomRef.current - scrollLeft;
    
    if (playheadX >= 0 && playheadX <= viewportWidth) {
      anchorTime = currentTimeRef.current;
      anchorX = playheadX;
    } else {
      anchorTime = (scrollLeft + viewportWidth / 2) / zoomRef.current;
      anchorX = viewportWidth / 2;
    }

    zoomAnchorTimeRef.current = anchorTime;
    zoomAnchorMouseXRef.current = anchorX;
    targetZoomRef.current = clampedZoom;

    startZoomAnimationLoop();
  };

  // Zoom/Scroll wheel event handler (supports Trackpad pinch-to-zoom + standard wheel zooming)
  const handleWheel = (e: WheelEvent) => {
    if (!tracksContainerRef.current) return;

    const rect = tracksContainerRef.current.getBoundingClientRect();
    const mouseXInTimeline = e.clientX - rect.left - 80;
    const scrollLeft = tracksContainerRef.current.scrollLeft;
    const viewportWidth = rect.width - 80;

    // Zooming is ONLY triggered if Ctrl key (or trackpad pinch-to-zoom), Alt key, or Cmd/Meta key is pressed.
    // This prevents accidental zooming while scrolling normally.
    const isZoom = e.ctrlKey || e.altKey || e.metaKey;

    if (isZoom) {
      e.preventDefault();

      const { minZoom, maxZoom } = getZoomLimits();

      // Anchor to mouse if within valid lanes zone, otherwise playhead or center
      let anchorTime = 0;
      let anchorX = 0;

      if (mouseXInTimeline >= 0 && mouseXInTimeline <= viewportWidth) {
        // Calculate anchorTime dynamically using zoomRef.current so ongoing zoom transitions don't drift
        anchorTime = (scrollLeft + mouseXInTimeline) / zoomRef.current;
        anchorX = mouseXInTimeline;
      } else {
        const playheadX = currentTimeRef.current * zoomRef.current - scrollLeft;
        if (playheadX >= 0 && playheadX <= viewportWidth) {
          anchorTime = currentTimeRef.current;
          anchorX = playheadX;
        } else {
          anchorTime = (scrollLeft + viewportWidth / 2) / zoomRef.current;
          anchorX = viewportWidth / 2;
        }
      }

      zoomAnchorTimeRef.current = anchorTime;
      zoomAnchorMouseXRef.current = anchorX;

      // Trackpad pinch-zoom uses a very high frequency of small events, while normal mouse wheels are clicky.
      // We reduce standard wheel zoom step size to 5–10% (e.g. 1.06 factor) for extreme fine control.
      const isPinch = e.ctrlKey && Math.abs(e.deltaY) < 10; // Pinch gestures have smaller, faster deltaY
      const zoomFactor = isPinch ? 1.03 : 1.06;
      
      let nextTargetZoom = targetZoomRef.current;
      if (e.deltaY < 0) {
        nextTargetZoom = Math.min(maxZoom, targetZoomRef.current * zoomFactor);
      } else {
        nextTargetZoom = Math.max(minZoom, targetZoomRef.current / zoomFactor);
      }

      targetZoomRef.current = nextTargetZoom;
      startZoomAnimationLoop();
    } else {
      // Normal mouse wheel or Shift + Mouse wheel -> Horizontally scroll the timeline (matches Premiere/DaVinci)
      e.preventDefault();
      
      const deltaX = e.deltaX;
      const deltaY = e.deltaY;
      
      // Map vertical scrolling (deltaY) to horizontal movement if horizontal delta is small/absent
      let scrollDelta = 0;
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        scrollDelta = deltaX;
      } else {
        scrollDelta = deltaY;
      }
      
      tracksContainerRef.current.scrollLeft += scrollDelta;
      setScrollLeftState(tracksContainerRef.current.scrollLeft);
    }
  };

  // Attach native non-passive wheel event listener specifically to outer timeline
  useEffect(() => {
    const el = timelineOuterRef.current;
    if (!el) return;

    const handleNativeWheel = (e: WheelEvent) => {
      handleWheel(e);
    };

    el.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleNativeWheel);
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  // Recalculate zoom when project duration changes (e.g. templates load / change)
  useEffect(() => {
    if (!tracksContainerRef.current) return;
    const { minZoom, maxZoom } = getZoomLimits();
    if (zoomRef.current < minZoom) {
      zoomRef.current = minZoom;
      targetZoomRef.current = minZoom;
      setZoom(minZoom);
    } else if (zoomRef.current > maxZoom) {
      zoomRef.current = maxZoom;
      targetZoomRef.current = maxZoom;
      setZoom(maxZoom);
    }
  }, [project.duration]);

  // Auto-scroll timeline to keep playhead visible with smooth behavior during playback
  useEffect(() => {
    if (!tracksContainerRef.current) return;
    const container = tracksContainerRef.current;
    const playheadX = currentTime * zoom + 80; // playhead position in px
    const containerWidth = container.clientWidth;
    const scrollLeft = container.scrollLeft;

    const rightMargin = 120; // safe zone from right
    const leftMargin = 120;  // safe zone from left

    if (playheadX > scrollLeft + containerWidth - rightMargin) {
      // Smoothly scroll ahead to center the playhead to show upcoming track content
      const targetScroll = playheadX - (containerWidth / 2);
      if (isScrubbing) {
        container.scrollLeft = targetScroll;
      } else {
        container.scrollTo({
          left: targetScroll,
          behavior: 'smooth'
        });
      }
    } else if (playheadX < scrollLeft + leftMargin) {
      const targetScroll = Math.max(0, playheadX - (containerWidth / 2));
      if (isScrubbing) {
        container.scrollLeft = targetScroll;
      } else {
        container.scrollTo({
          left: targetScroll,
          behavior: 'smooth'
        });
      }
    }
  }, [currentTime, zoom, isScrubbing]);

  const scrubToMouseX = (clientX: number) => {
    if (!tracksContainerRef.current) return;
    const rect = tracksContainerRef.current.getBoundingClientRect();
    const scrollLeft = tracksContainerRef.current.scrollLeft;
    const clickX = clientX - rect.left + scrollLeft - 80; // 80px offset for the track label sidebar
    
    const targetTime = Math.max(0, Math.min(workspaceDuration, clickX / zoom));
    onTimeUpdate(targetTime);
  };

  const handleRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only scrub with left click
    setIsScrubbing(true);
    scrubToMouseX(e.clientX);
  };

  // Handle clicking on Ruler to scrub/seek playhead
  const handleRulerClickOrDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only scrub with left click
    scrubToMouseX(e.clientX);
  };

  // Handle timeline horizontal scroll to trigger virtualized ruler update
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollLeftState(e.currentTarget.scrollLeft);
  };

  // Handle middle click panning initiation on the timeline outer element
  const handleTimelineMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) { // Middle mouse click
      e.preventDefault();
      isPanningRef.current = true;
      panStartXRef.current = e.clientX;
      if (tracksContainerRef.current) {
        panStartScrollLeftRef.current = tracksContainerRef.current.scrollLeft;
      }
      document.body.style.cursor = 'grabbing';
    }
  };

  // Start dragging marquee selection box
  const handleGridMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only
    if (isPanningRef.current || dragState || trimState) return;

    // Get coordinates relative to the tracks container
    const rect = tracksContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const startX = e.clientX - rect.left + (tracksContainerRef.current?.scrollLeft || 0);
    const startY = e.clientY - rect.top;

    // Ignore clicks in the track label sidebar (first 80px)
    if (e.clientX - rect.left < 80) return;

    // Clear selection if neither Shift nor Ctrl is held down
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const isCtrl = isMac ? e.metaKey : e.ctrlKey;
    if (!e.shiftKey && !isCtrl) {
      if (onSelectClips) {
        onSelectClips([], null);
      } else {
        onSelectClip(null);
      }
    }

    setSelectionBox({
      startX,
      startY,
      currentX: startX,
      currentY: startY
    });
  };

  // Start sliding a clip
  const handleClipMouseDown = (e: React.MouseEvent, trackId: string, clip: Clip) => {
    e.stopPropagation();

    // Determine the new selection
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const isCtrl = isMac ? e.metaKey : e.ctrlKey;
    const isShift = e.shiftKey;

    let newIds: string[] = [];
    let primaryClip: Clip | null = clip;

    if (isShift) {
      // Range selection based on start times
      const referenceClip = selectedClip;
      if (referenceClip) {
        const t1 = referenceClip.start;
        const t2 = clip.start;
        const minTime = Math.min(t1, t2);
        const maxTime = Math.max(t1, t2);

        const clipsInRange: string[] = [];
        project.tracks.forEach(t => {
          t.clips.forEach(c => {
            if (c.start >= minTime - 0.001 && c.start <= maxTime + 0.001) {
              clipsInRange.push(c.id);
            }
          });
        });

        const currentSet = new Set(activeSelectedIds);
        clipsInRange.forEach(id => currentSet.add(id));
        newIds = Array.from(currentSet);
      } else {
        newIds = [clip.id];
      }
    } else if (isCtrl) {
      // Toggle selection
      const currentSet = new Set(activeSelectedIds);
      if (currentSet.has(clip.id)) {
        currentSet.delete(clip.id);
        if (selectedClip?.id === clip.id) {
          const remaining = Array.from(currentSet);
          if (remaining.length > 0) {
            let found: Clip | null = null;
            project.tracks.forEach(t => {
              const c = t.clips.find(item => item.id === remaining[remaining.length - 1]);
              if (c) found = c;
            });
            primaryClip = found;
          } else {
            primaryClip = null;
          }
        } else {
          primaryClip = selectedClip;
        }
      } else {
        currentSet.add(clip.id);
        primaryClip = clip;
      }
      newIds = Array.from(currentSet);
    } else {
      // Standard click
      if (activeSelectedIds.includes(clip.id)) {
        newIds = activeSelectedIds;
        primaryClip = selectedClip;
      } else {
        newIds = [clip.id];
        primaryClip = clip;
      }
    }

    // Call state update
    if (onSelectClips) {
      onSelectClips(newIds, primaryClip);
    } else {
      onSelectClip(primaryClip);
    }

    // Initialize dragging state
    const isMulti = newIds.length > 1 && newIds.includes(clip.id);

    if (isMulti) {
      const draggedClips: Array<{
        clipId: string;
        trackId: string;
        initialStart: number;
        currentStart: number;
        snappedStart: number;
      }> = [];

      project.tracks.forEach(t => {
        t.clips.forEach(c => {
          if (newIds.includes(c.id)) {
            draggedClips.push({
              clipId: c.id,
              trackId: t.id,
              initialStart: c.start,
              currentStart: c.start,
              snappedStart: c.start
            });
          }
        });
      });

      setDragState({
        clipId: clip.id,
        trackId: trackId,
        initialStart: clip.start,
        initialMouseX: e.clientX,
        initialScrollLeft: tracksContainerRef.current?.scrollLeft || 0,
        currentStart: clip.start,
        snappedStart: clip.start,
        currentTrackId: trackId,
        isValidTarget: true,
        isMultiDrag: true,
        draggedClips
      });
    } else {
      setDragState({
        clipId: clip.id,
        trackId: trackId,
        initialStart: clip.start,
        initialMouseX: e.clientX,
        initialScrollLeft: tracksContainerRef.current?.scrollLeft || 0,
        currentStart: clip.start,
        snappedStart: clip.start,
        currentTrackId: trackId,
        isValidTarget: true,
        isMultiDrag: false
      });
    }
  };

  // Start trimming the left edge
  const handleLeftTrimMouseDown = (e: React.MouseEvent, trackId: string, clip: Clip) => {
    e.stopPropagation();
    onSelectClip(clip);
    setTrimState({
      clipId: clip.id,
      trackId: trackId,
      edge: 'left',
      initialStart: clip.start,
      initialDuration: clip.duration,
      initialSourceOffset: clip.sourceOffset || 0,
      initialMouseX: e.clientX,
      initialScrollLeft: tracksContainerRef.current?.scrollLeft || 0,
      currentStart: clip.start,
      currentDuration: clip.duration,
      currentSourceOffset: clip.sourceOffset || 0
    });
  };

  // Start trimming the right edge
  const handleRightTrimMouseDown = (e: React.MouseEvent, trackId: string, clip: Clip) => {
    e.stopPropagation();
    onSelectClip(clip);
    setTrimState({
      clipId: clip.id,
      trackId: trackId,
      edge: 'right',
      initialStart: clip.start,
      initialDuration: clip.duration,
      initialSourceOffset: clip.sourceOffset || 0,
      initialMouseX: e.clientX,
      initialScrollLeft: tracksContainerRef.current?.scrollLeft || 0,
      currentStart: clip.start,
      currentDuration: clip.duration,
      currentSourceOffset: clip.sourceOffset || 0
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
  const processMouseMove = (clientX: number, clientY: number) => {
    if (isScrubbing) {
      scrubToMouseX(clientX);
      return;
    }

    if (isPanningRef.current) {
      if (tracksContainerRef.current) {
        const dx = clientX - panStartXRef.current;
        tracksContainerRef.current.scrollLeft = panStartScrollLeftRef.current - dx;
        setScrollLeftState(tracksContainerRef.current.scrollLeft);
      }
      return;
    }

    if (activeKfDrag) {
      const track = project.tracks.find(t => t.id === activeKfDrag.trackId);
      if (!track) return;
      const clip = track.clips.find(c => c.id === activeKfDrag.clipId);
      if (!clip) return;
      
      const deltaX = clientX - activeKfDrag.initialMouseX;
      const deltaY = clientY - activeKfDrag.initialMouseY;
      
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

    // Find active duration dynamically for snapping limit
    let currentActiveDuration = project.duration;
    if (dragState) {
      if (dragState.isMultiDrag && dragState.draggedClips) {
        dragState.draggedClips.forEach(dc => {
          const originalClip = project.tracks
            .find(t => t.id === dc.trackId)
            ?.clips.find(c => c.id === dc.clipId);
          if (originalClip) {
            const end = dc.snappedStart + originalClip.duration;
            if (end > currentActiveDuration) {
              currentActiveDuration = end;
            }
          }
        });
      } else {
        const originalClip = project.tracks
          .find(t => t.id === dragState.trackId)
          ?.clips.find(c => c.id === dragState.clipId);
        if (originalClip) {
          const end = dragState.snappedStart + originalClip.duration;
          if (end > currentActiveDuration) {
            currentActiveDuration = end;
          }
        }
      }
    }
    if (trimState) {
      const end = trimState.currentStart + trimState.currentDuration;
      if (end > currentActiveDuration) {
        currentActiveDuration = end;
      }
    }
    if (externalDrag) {
      const assetDuration = (externalDrag.itemType === 'effect' || externalDrag.itemType === 'transition')
        ? 3
        : (externalDrag.data?.duration || 5);
      const end = externalDrag.snappedTime + assetDuration;
      if (end > currentActiveDuration) {
        currentActiveDuration = end;
      }
    }

    if (trimState) {
      const currentScrollLeft = tracksContainerRef.current?.scrollLeft || 0;
      const deltaX = (clientX - trimState.initialMouseX) + (currentScrollLeft - trimState.initialScrollLeft);
      const deltaSecs = deltaX / zoom;

      const track = project.tracks.find(t => t.id === trimState.trackId);
      if (!track) return;
      const clip = track.clips.find(c => c.id === trimState.clipId);
      if (!clip) return;

      let possibleDelta = deltaSecs;
      let activeSnapTime: number | null = null;
      const minDuration = 0.1;

      // Snapping candidates collection
      const getSnapPoint = (testValue: number) => {
        if (!magnetEnabled) return null;
        const snapThresholdPx = 12;
        const snapThresholdSecs = snapThresholdPx / zoom;
        let bestDiff = snapThresholdSecs;
        let bestSnapPoint: number | null = null;

        const snapPoints = new Set<number>();
        snapPoints.add(0);
        snapPoints.add(currentActiveDuration);
        snapPoints.add(currentTime);

        project.tracks.forEach(t => {
          t.clips.forEach(c => {
            if (c.id !== clip.id) {
              snapPoints.add(c.start);
              snapPoints.add(c.start + c.duration);
            }
          });
        });

        for (const pt of snapPoints) {
          const diff = Math.abs(testValue - pt);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestSnapPoint = pt;
          }
        }
        return bestSnapPoint;
      };

      if (trimState.edge === 'left') {
        let minDelta = -trimState.initialStart;
        if (clip.type === 'video' || clip.type === 'audio') {
          minDelta = Math.max(minDelta, -trimState.initialSourceOffset);
        }
        const maxDelta = trimState.initialDuration - minDuration;

        possibleDelta = Math.max(minDelta, Math.min(maxDelta, possibleDelta));

        const targetStart = trimState.initialStart + possibleDelta;
        const snappedStartPoint = getSnapPoint(targetStart);
        if (snappedStartPoint !== null) {
          const snappedDelta = snappedStartPoint - trimState.initialStart;
          if (snappedDelta >= minDelta && snappedDelta <= maxDelta) {
            possibleDelta = snappedDelta;
            activeSnapTime = snappedStartPoint;
          }
        }

        setSnapLineTime(activeSnapTime);

        setTrimState(prev => prev ? {
          ...prev,
          currentStart: trimState.initialStart + possibleDelta,
          currentDuration: trimState.initialDuration - possibleDelta,
          currentSourceOffset: trimState.initialSourceOffset + possibleDelta
        } : null);

      } else {
        const minDelta = minDuration - trimState.initialDuration;
        let maxDelta = Infinity;

        if (clip.type === 'video' || clip.type === 'audio') {
          const srcDur = clip.sourceDuration || clip.duration || 30;
          maxDelta = srcDur - trimState.initialSourceOffset - trimState.initialDuration;
        }

        possibleDelta = Math.max(minDelta, Math.min(maxDelta, possibleDelta));

        const targetEnd = trimState.initialStart + trimState.initialDuration + possibleDelta;
        const snappedEndPoint = getSnapPoint(targetEnd);
        if (snappedEndPoint !== null) {
          const snappedDelta = snappedEndPoint - (trimState.initialStart + trimState.initialDuration);
          if (snappedDelta >= minDelta && snappedDelta <= maxDelta) {
            possibleDelta = snappedDelta;
            activeSnapTime = snappedEndPoint;
          }
        }

        setSnapLineTime(activeSnapTime);

        setTrimState(prev => prev ? {
          ...prev,
          currentStart: trimState.initialStart,
          currentDuration: trimState.initialDuration + possibleDelta,
          currentSourceOffset: trimState.initialSourceOffset
        } : null);
      }

      return;
    }

    if (selectionBox) {
      const rect = tracksContainerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const currentX = clientX - rect.left + (tracksContainerRef.current?.scrollLeft || 0);
      const currentY = clientY - rect.top;

      setSelectionBox(prev => prev ? {
        ...prev,
        currentX,
        currentY
      } : null);

      const left = Math.min(selectionBox.startX, currentX);
      const right = Math.max(selectionBox.startX, currentX);
      const top = Math.min(selectionBox.startY, currentY);
      const bottom = Math.max(selectionBox.startY, currentY);

      const selectedIds: string[] = [];
      let primary: Clip | null = null;

      let accumulatedTop = 0;
      project.tracks.forEach((track) => {
        const trackHeight = trackHeights[track.id] || 64;
        const trackTop = accumulatedTop;
        const trackBottom = accumulatedTop + trackHeight;
        accumulatedTop += trackHeight;

        const verticalOverlap = !(trackBottom <= top || trackTop >= bottom);
        if (verticalOverlap) {
          track.clips.forEach(clip => {
            const clipLeft = clip.start * zoom + 80;
            const clipRight = (clip.start + clip.duration) * zoom + 80;

            const horizontalOverlap = !(clipRight <= left || clipLeft >= right);
            if (horizontalOverlap) {
              selectedIds.push(clip.id);
              primary = clip;
            }
          });
        }
      });

      if (onSelectClips) {
        onSelectClips(selectedIds, primary);
      } else {
        if (selectedIds.length > 0) {
          let found: Clip | null = null;
          project.tracks.forEach(t => {
            const c = t.clips.find(item => item.id === selectedIds[0]);
            if (c) found = c;
          });
          onSelectClip(found);
        } else {
          onSelectClip(null);
        }
      }
      return;
    }

    if (!dragState) return;

    const currentScrollLeft = tracksContainerRef.current?.scrollLeft || 0;
    const deltaX = (clientX - dragState.initialMouseX) + (currentScrollLeft - dragState.initialScrollLeft);
    const deltaSecs = deltaX / zoom;

    if (dragState.isMultiDrag && dragState.draggedClips) {
      const minInitialStart = Math.min(...dragState.draggedClips.map(dc => dc.initialStart));
      const finalDelta = Math.max(-minInitialStart, deltaSecs);

      let activeSnapTime: number | null = null;
      let snapDeltaSecs = finalDelta;

      if (magnetEnabled) {
        const primaryDC = dragState.draggedClips.find(dc => dc.clipId === dragState.clipId);
        if (primaryDC) {
          const targetStart = primaryDC.initialStart + finalDelta;
          const originalClip = project.tracks
            .find(t => t.id === primaryDC.trackId)
            ?.clips.find(c => c.id === primaryDC.clipId);

          if (originalClip) {
            const targetEnd = targetStart + originalClip.duration;
            const snapThresholdPx = 12;
            const snapThresholdSecs = snapThresholdPx / zoom;
            let bestDiff = snapThresholdSecs;
            let bestSnapPoint: number | null = null;
            let snapTargetType: 'start' | 'end' | null = null;

            const snapPoints = new Set<number>();
            snapPoints.add(0);
            snapPoints.add(currentActiveDuration);
            snapPoints.add(currentTime);

            project.tracks.forEach(t => {
              t.clips.forEach(c => {
                if (!activeSelectedIds.includes(c.id)) {
                  snapPoints.add(c.start);
                  snapPoints.add(c.start + c.duration);
                }
              });
            });

            for (const pt of snapPoints) {
              const diffStart = Math.abs(targetStart - pt);
              if (diffStart < bestDiff) {
                bestDiff = diffStart;
                bestSnapPoint = pt;
                snapTargetType = 'start';
              }

              const diffEnd = Math.abs(targetEnd - pt);
              if (diffEnd < bestDiff) {
                bestDiff = diffEnd;
                bestSnapPoint = pt;
                snapTargetType = 'end';
              }
            }

            if (bestSnapPoint !== null) {
              if (snapTargetType === 'start') {
                const snapDelta = bestSnapPoint - primaryDC.initialStart;
                if (primaryDC.initialStart + snapDelta >= 0) {
                  snapDeltaSecs = snapDelta;
                  activeSnapTime = bestSnapPoint;
                }
              } else if (snapTargetType === 'end') {
                const snapDelta = (bestSnapPoint - originalClip.duration) - primaryDC.initialStart;
                if (primaryDC.initialStart + snapDelta >= 0) {
                  snapDeltaSecs = snapDelta;
                  activeSnapTime = bestSnapPoint;
                }
              }
            }
          }
        }
      }

      setSnapLineTime(activeSnapTime);

      const updatedDraggedClips = dragState.draggedClips.map(dc => {
        const currentStart = Math.max(0, dc.initialStart + finalDelta);
        const snappedStart = Math.max(0, dc.initialStart + snapDeltaSecs);
        return {
          ...dc,
          currentStart,
          snappedStart
        };
      });

      setDragState(prev => prev ? {
        ...prev,
        draggedClips: updatedDraggedClips
      } : null);

    } else {
      const track = project.tracks.find(t => t.id === dragState.trackId);
      if (!track) return;

      const originalClip = track.clips.find(c => c.id === dragState.clipId);
      if (!originalClip) return;

      const currentStart = Math.max(0, dragState.initialStart + deltaSecs);
      let targetStart = currentStart;

      let activeSnapTime: number | null = null;
      if (magnetEnabled) {
        const targetEnd = targetStart + originalClip.duration;
        const snapThresholdPx = 12;
        const snapThresholdSecs = snapThresholdPx / zoom;
        let bestDiff = snapThresholdSecs;
        let bestSnapPoint: number | null = null;
        let snapTargetType: 'start' | 'end' | null = null;

        const snapPoints = new Set<number>();
        snapPoints.add(0);
        snapPoints.add(currentActiveDuration);
        snapPoints.add(currentTime);

        project.tracks.forEach(t => {
          t.clips.forEach(c => {
            if (c.id !== originalClip.id) {
              snapPoints.add(c.start);
              snapPoints.add(c.start + c.duration);
            }
          });
        });

        for (const pt of snapPoints) {
          const diffStart = Math.abs(targetStart - pt);
          if (diffStart < bestDiff) {
            bestDiff = diffStart;
            bestSnapPoint = pt;
            snapTargetType = 'start';
          }

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

      const resolveCollisions = (targetTrackId: string, clipId: string, testStart: number, duration: number): number => {
        const targetTrack = project.tracks.find(t => t.id === targetTrackId);
        if (!targetTrack) return testStart;

        const otherClips = targetTrack.clips.filter(c => c.id !== clipId);
        if (otherClips.length === 0) return testStart;

        let resolvedStart = testStart;
        const testEnd = testStart + duration;

        const overlappingClips = otherClips.filter(c => !(c.start + c.duration <= testStart + 0.001 || c.start >= testEnd - 0.001));

        if (overlappingClips.length > 0) {
          let bestValidStart = testStart;
          let minDistance = Infinity;

          overlappingClips.forEach(oc => {
            const optionA = oc.start - duration;
            if (optionA >= 0) {
              const hasOverlap = otherClips.some(c => c.id !== oc.id && !(c.start + c.duration <= optionA + 0.001 || c.start >= optionA + duration - 0.001));
              if (!hasOverlap) {
                const dist = Math.abs(optionA - testStart);
                if (dist < minDistance) {
                  minDistance = dist;
                  bestValidStart = optionA;
                }
              }
            }

            const optionB = oc.start + oc.duration;
            const hasOverlapB = otherClips.some(c => c.id !== oc.id && !(c.start + c.duration <= optionB + 0.001 || c.start >= optionB + duration - 0.001));
            if (!hasOverlapB) {
              const dist = Math.abs(optionB - testStart);
              if (dist < minDistance) {
                minDistance = dist;
                bestValidStart = optionB;
              }
            }
          });

          if (minDistance !== Infinity) {
            resolvedStart = bestValidStart;
          } else {
            const originalTrack = project.tracks.find(t => t.clips.some(c => c.id === clipId));
            const originalClip = originalTrack?.clips.find(c => c.id === clipId);
            resolvedStart = originalClip ? originalClip.start : testStart;
          }
        }

        return resolvedStart;
      };

      let snappedStart = targetStart;
      if (!rippleEnabled && dragState.currentTrackId) {
        snappedStart = resolveCollisions(dragState.currentTrackId, originalClip.id, targetStart, originalClip.duration);
      }

      setDragState(prev => prev ? {
        ...prev,
        currentStart,
        snappedStart
      } : null);
    }
  };

  const startAutoScroll = () => {
    if (autoScrollTimerRef.current) return;
    autoScrollTimerRef.current = setInterval(() => {
      const container = tracksContainerRef.current;
      const rect = containerRectRef.current;
      if (!container || !rect) return;

      const mouseX = lastMouseXRef.current - rect.left;
      const rightThreshold = rect.width - 80;
      const leftThreshold = 140;

      let scrolled = false;
      let speed = 0;
      if (mouseX > rightThreshold) {
        speed = Math.max(2, Math.min(30, (mouseX - rightThreshold) * 0.4));
        container.scrollLeft += speed;
        setScrollLeftState(container.scrollLeft);
        scrolled = true;
      } else if (mouseX < leftThreshold && container.scrollLeft > 0) {
        speed = -Math.max(2, Math.min(30, (leftThreshold - mouseX) * 0.4));
        container.scrollLeft += speed;
        setScrollLeftState(container.scrollLeft);
        scrolled = true;
      }

      if (scrolled) {
        // Recalculate duration and visual representation
        let tempActiveDuration = project.duration;
        if (dragState) {
          const originalClip = project.tracks
            .find(t => t.id === dragState.trackId)
            ?.clips.find(c => c.id === dragState.clipId);
          if (originalClip) {
            const end = dragState.snappedStart + originalClip.duration;
            if (end > tempActiveDuration) tempActiveDuration = end;
          }
        } else if (trimState) {
          const end = trimState.currentStart + trimState.currentDuration;
          if (end > tempActiveDuration) tempActiveDuration = end;
        } else if (externalDrag) {
          const assetDuration = (externalDrag.itemType === 'effect' || externalDrag.itemType === 'transition')
            ? 3
            : (externalDrag.data?.duration || 5);
          const end = externalDrag.snappedTime + assetDuration;
          if (end > tempActiveDuration) tempActiveDuration = end;
        }

        if (externalDrag) {
          const scrollLeft = container.scrollLeft;
          const relativeX = lastMouseXRef.current - rect.left + scrollLeft - 80;
          const hoverTime = Math.max(0, relativeX / zoom);
          let snappedTime = hoverTime;
          
          if (magnetEnabled) {
            const snapThresholdPx = 12;
            const snapThresholdSecs = snapThresholdPx / zoom;
            let bestDiff = snapThresholdSecs;
            let bestSnapPoint: number | null = null;
            
            const snapPoints = new Set<number>();
            snapPoints.add(0);
            snapPoints.add(tempActiveDuration);
            snapPoints.add(currentTime);
            
            project.tracks.forEach(t => {
              t.clips.forEach(c => {
                snapPoints.add(c.start);
                snapPoints.add(c.start + c.duration);
              });
            });
            
            for (const pt of snapPoints) {
              const diff = Math.abs(hoverTime - pt);
              if (diff < bestDiff) {
                bestDiff = diff;
                bestSnapPoint = pt;
              }
            }
            if (bestSnapPoint !== null) {
              snappedTime = bestSnapPoint;
            }
          }
          
          setExternalDrag(prev => prev ? {
            ...prev,
            hoverTime,
            snappedTime
          } : null);
        } else {
          processMouseMove(lastMouseXRef.current, 0);
        }
      }
    }, 16);
  };

  const stopAutoScroll = () => {
    if (autoScrollTimerRef.current) {
      clearInterval(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
    }
  };

  const handleTimelineMouseMove = (e: React.MouseEvent) => {
    lastMouseXRef.current = e.clientX;
    containerRectRef.current = tracksContainerRef.current?.getBoundingClientRect() || null;

    if (dragState || trimState || externalDrag) {
      const container = tracksContainerRef.current;
      if (container) {
        const rect = containerRectRef.current!;
        const mouseX = e.clientX - rect.left;
        const rightThreshold = rect.width - 80;
        const leftThreshold = 140;

        if (mouseX > rightThreshold || (mouseX < leftThreshold && container.scrollLeft > 0)) {
          startAutoScroll();
        } else {
          stopAutoScroll();
        }
      }
    } else {
      stopAutoScroll();
    }

    processMouseMove(e.clientX, e.clientY);
  };

  const handleTimelineMouseUp = () => {
    stopAutoScroll();

    if (isPanningRef.current) {
      isPanningRef.current = false;
      document.body.style.cursor = '';
    }

    if (dragState) {
      if (dragState.isMultiDrag && dragState.draggedClips) {
        const newTracks = project.tracks.map(t => {
          const updatedClips = t.clips.map(c => {
            const dc = dragState.draggedClips?.find(item => item.clipId === c.id);
            if (dc) {
              return { ...c, start: dc.snappedStart };
            }
            return c;
          });
          return { ...t, clips: updatedClips };
        });

        if (onUpdateProject) {
          onUpdateProject({ ...project, tracks: newTracks });
        }
      } else {
        const originalTrack = project.tracks.find(t => t.id === dragState.trackId);
        const originalClip = originalTrack?.clips.find(c => c.id === dragState.clipId);

        if (originalTrack && originalClip && dragState.isValidTarget && dragState.currentTrackId) {
          const finalStart = dragState.snappedStart;

          const newTracks = project.tracks.map(t => {
            let clips = t.clips.filter(c => c.id !== originalClip.id);

            if (t.id === dragState.currentTrackId) {
              const updatedClip = { ...originalClip, start: finalStart };
              if (rippleEnabled) {
                const sortedOthers = [...clips].sort((a, b) => a.start - b.start);
                let currentOccupiedEnd = finalStart + originalClip.duration;
                
                const rippledClips = sortedOthers.map(c => {
                  if (c.start >= finalStart - 0.01) {
                    const newStart = Math.max(c.start + originalClip.duration, currentOccupiedEnd);
                    currentOccupiedEnd = newStart + c.duration;
                    return { ...c, start: newStart };
                  }
                  return c;
                });
                
                clips = [...rippledClips, updatedClip].sort((a, b) => a.start - b.start);
              } else {
                clips = [...clips, updatedClip].sort((a, b) => a.start - b.start);
              }
            }
            return { ...t, clips };
          });

          if (onUpdateProject) {
            onUpdateProject({ ...project, tracks: newTracks });
          } else {
            onUpdateTrackClips(dragState.currentTrackId, newTracks.find(t => t.id === dragState.currentTrackId)?.clips || []);
          }
        }
      }
    }

    if (trimState) {
      const originalTrack = project.tracks.find(t => t.id === trimState.trackId);
      const originalClip = originalTrack?.clips.find(c => c.id === trimState.clipId);

      if (originalTrack && originalClip) {
        const updatedClips = originalTrack.clips.map(c => {
          if (c.id === originalClip.id) {
            return {
              ...c,
              start: trimState.currentStart,
              duration: trimState.currentDuration,
              sourceOffset: trimState.currentSourceOffset
            };
          }
          return c;
        });

        const newTracks = project.tracks.map(t => {
          if (t.id === originalTrack.id) {
            return { ...t, clips: updatedClips };
          }
          return t;
        });

        if (onUpdateProject) {
          onUpdateProject({ ...project, tracks: newTracks });
        } else {
          onUpdateTrackClips(trimState.trackId, updatedClips);
        }
      }
    }

    setDragState(null);
    setTrimState(null);
    setActiveKfDrag(null);
    setSnapLineTime(null);
    setSelectionBox(null);
    setIsScrubbing(false);
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

  // Professional Keyframe Helper & Handler functions
  const getInterpolatedProps = (clip: Clip, targetTime: number) => {
    const baseOpacity = clip.opacity ?? 1;
    const baseScale = clip.scale ?? 1;
    const basePositionX = clip.positionX ?? 0;
    const basePositionY = clip.positionY !== undefined ? clip.positionY : (clip.type === 'text' ? 50 : 0);
    const baseVolume = (clip as any).volume ?? 1;

    if (!clip.keyframes || clip.keyframes.length === 0) {
      return {
        opacity: baseOpacity,
        scale: baseScale,
        positionX: basePositionX,
        positionY: basePositionY,
        volume: baseVolume
      };
    }

    const sorted = [...clip.keyframes].sort((a, b) => a.time - b.time);

    const getPropVal = (prop: 'opacity' | 'scale' | 'positionX' | 'positionY' | 'volume') => {
      const fallback = prop === 'opacity' || prop === 'scale' ? 1 : (prop === 'positionY' && clip.type === 'text' ? 50 : 0);
      const clipFallback = (clip as any)[prop] !== undefined ? (clip as any)[prop] : fallback;

      const resolveVal = (kf: any) => kf[prop] !== undefined ? kf[prop] : clipFallback;

      if (targetTime <= sorted[0].time) return resolveVal(sorted[0]);
      if (targetTime >= sorted[sorted.length - 1].time) return resolveVal(sorted[sorted.length - 1]);

      for (let i = 0; i < sorted.length - 1; i++) {
        const kf1 = sorted[i];
        const kf2 = sorted[i + 1];
        if (targetTime >= kf1.time && targetTime <= kf2.time) {
          const denom = kf2.time - kf1.time;
          const factor = denom > 0 ? (targetTime - kf1.time) / denom : 0;
          return resolveVal(kf1) + (resolveVal(kf2) - resolveVal(kf1)) * factor;
        }
      }
      return clipFallback;
    };

    return {
      opacity: getPropVal('opacity'),
      scale: getPropVal('scale'),
      positionX: getPropVal('positionX'),
      positionY: getPropVal('positionY'),
      volume: getPropVal('volume')
    };
  };

  const handleToggleKeyframeAtPlayhead = () => {
    if (!selectedClip) return;
    const track = project.tracks.find(t => t.clips.some(c => c.id === selectedClip.id));
    if (!track) return;

    const clipTime = currentTime - selectedClip.start;
    const targetTime = Math.max(0, Math.min(selectedClip.duration, clipTime));

    const currentKfs = selectedClip.keyframes ? [...selectedClip.keyframes] : [];
    const existingKfIdx = currentKfs.findIndex(kf => Math.abs(kf.time - targetTime) < 0.1);

    let updatedKfs: any[] = [];
    if (existingKfIdx !== -1) {
      // Remove keyframe
      updatedKfs = currentKfs.filter((_, idx) => idx !== existingKfIdx);
    } else {
      // Add keyframe
      const interp = getInterpolatedProps(selectedClip, targetTime);
      const newKf: any = {
        id: 'kf-' + Math.random().toString(36).substring(2, 9),
        time: targetTime,
      };

      if (selectedClip.type === 'audio') {
        newKf.volume = interp.volume;
      } else {
        newKf.opacity = interp.opacity;
        newKf.scale = interp.scale;
        newKf.positionX = interp.positionX;
        newKf.positionY = interp.positionY;
      }

      updatedKfs = [...currentKfs, newKf].sort((a, b) => a.time - b.time);
    }

    const updatedClips = track.clips.map(c => {
      if (c.id === selectedClip.id) {
        return { ...c, keyframes: updatedKfs };
      }
      return c;
    });

    onUpdateTrackClips(track.id, updatedClips);

    const updatedSelectedClip = updatedClips.find(c => c.id === selectedClip.id);
    if (updatedSelectedClip) {
      onSelectClip(updatedSelectedClip);
    }
  };

  const handleGoToPrevKeyframe = () => {
    if (!selectedClip || !selectedClip.keyframes || selectedClip.keyframes.length === 0) return;
    
    const clipTime = currentTime - selectedClip.start;
    const sorted = [...selectedClip.keyframes].sort((a, b) => a.time - b.time);
    
    const prevKf = [...sorted].reverse().find(kf => kf.time < clipTime - 0.05);
    
    if (prevKf) {
      const targetTimelineTime = selectedClip.start + prevKf.time;
      onTimeUpdate(Math.max(0, targetTimelineTime));
    }
  };

  const handleGoToNextKeyframe = () => {
    if (!selectedClip || !selectedClip.keyframes || selectedClip.keyframes.length === 0) return;
    
    const clipTime = currentTime - selectedClip.start;
    const sorted = [...selectedClip.keyframes].sort((a, b) => a.time - b.time);
    
    const nextKf = sorted.find(kf => kf.time > clipTime + 0.05);
    
    if (nextKf) {
      const targetTimelineTime = selectedClip.start + nextKf.time;
      onTimeUpdate(Math.max(0, targetTimelineTime));
    }
  };

  // Visual offsets
  const totalTimelineWidth = workspaceDuration * zoom;

  const findBestInterval = (z: number) => {
    // We want tick labels to have at least 85px space between each other for readability
    const minSpacingPx = 85;
    const candidateIntervals = [
      120, 60, 30, 15, 10, 5, 2, 1, 
      0.5, 0.2, 0.1, 0.05, 0.03333, 0.01
    ];
    for (const interval of candidateIntervals) {
      if (interval * z >= minSpacingPx) {
        return interval;
      }
    }
    return 0.01;
  };

  // Render rulers timing intervals (adaptive & virtualized)
  const renderRulerTicks = () => {
    const ticks = [];
    const container = tracksContainerRef.current;
    const viewportWidth = container ? container.clientWidth : 800;
    
    // Find visible time range
    const visibleStartTime = Math.max(0, (scrollLeftState - 80) / zoom);
    const visibleEndTime = (scrollLeftState + viewportWidth) / zoom;
    
    const interval = findBestInterval(zoom);
    
    // Add small buffer to prevent ticks disappearing abruptly at the viewport boundaries
    const startTick = Math.max(0, Math.floor((visibleStartTime - 1) / interval) * interval);
    const endTick = Math.min(workspaceDuration, Math.ceil((visibleEndTime + 1) / interval) * interval);

    // Render major, medium, and minor ticks
    // Divide interval into 10 steps to draw high-density sub-seconds
    const subSteps = 10;
    const step = interval / subSteps;
    const startStep = Math.max(0, Math.floor(startTick / step) * step);
    const endStep = Math.min(workspaceDuration, Math.ceil(endTick / step) * step);

    for (let s = startStep; s <= endStep; s += step) {
      const roundedS = Math.round(s * 1000) / 1000;
      const left = roundedS * zoom;
      
      // Determine if this aligns with major, medium (half interval), or minor ticks
      const isMajor = Math.abs(roundedS % interval) < 0.0001 || Math.abs((roundedS % interval) - interval) < 0.0001;
      const isMedium = !isMajor && (Math.abs((roundedS % (interval / 2))) < 0.0001 || Math.abs((roundedS % (interval / 2)) - (interval / 2)) < 0.0001);

      if (isMajor) {
        const mins = Math.floor(roundedS / 60);
        const secs = Math.floor(roundedS % 60);
        
        let timeStr = '';
        if (interval >= 1) {
          timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
        } else {
          const ms = Math.round((roundedS % 1) * 100);
          timeStr = `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
        }

        ticks.push(
          <div 
            key={`major-${roundedS}`} 
            className="absolute top-0 bottom-0 border-l border-[#2D2D31] flex flex-col justify-between select-none pointer-events-none" 
            style={{ left: `${left + 80}px` }}
          >
            <span className="text-[9px] font-mono font-medium text-slate-400 pl-1.5 mt-1 select-none">{timeStr}</span>
            <div className="h-3 w-px bg-[#404044]"></div>
          </div>
        );
      } else if (isMedium) {
        ticks.push(
          <div 
            key={`medium-${roundedS}`} 
            className="absolute bottom-0 h-2 border-l border-[#3A3A3E] select-none pointer-events-none" 
            style={{ left: `${left + 80}px` }}
          />
        );
      } else if (zoom > 40) { // Only render minor ticks at higher zooms to keep the viewport clean
        ticks.push(
          <div 
            key={`minor-${roundedS}`} 
            className="absolute bottom-0 h-1 border-l border-[#2E2E31]/60 select-none pointer-events-none" 
            style={{ left: `${left + 80}px` }}
          />
        );
      }
    }
    return ticks;
  };

  // Render vertical grid lines behind the clips to enhance tracking and alignment
  const renderGridLines = () => {
    const gridLines = [];
    const container = tracksContainerRef.current;
    const viewportWidth = container ? container.clientWidth : 800;
    
    const visibleStartTime = Math.max(0, (scrollLeftState - 80) / zoom);
    const visibleEndTime = (scrollLeftState + viewportWidth) / zoom;
    
    const interval = findBestInterval(zoom);
    const startTick = Math.max(0, Math.floor((visibleStartTime - 1) / interval) * interval);
    const endTick = Math.min(workspaceDuration, Math.ceil((visibleEndTime + 1) / interval) * interval);

    for (let s = startTick; s <= endTick; s += interval) {
      const roundedS = Math.round(s * 1000) / 1000;
      const left = roundedS * zoom;
      gridLines.push(
        <div 
          key={`grid-${roundedS}`} 
          className="absolute top-0 bottom-0 border-l border-[#1A1A1C]/60 h-full pointer-events-none" 
          style={{ left: `${left}px` }}
        />
      );
    }
    return gridLines;
  };

  // Get currently dragged clip details
  const getDraggedClipInfo = () => {
    if (!dragState) return null;
    const originalTrack = project.tracks.find(t => t.id === dragState.trackId);
    if (!originalTrack) return null;
    const clip = originalTrack.clips.find(c => c.id === dragState.clipId);
    return clip ? { clip, track: originalTrack } : null;
  };
  const draggedInfo = getDraggedClipInfo();

  const renderClipElement = (
    clip: Clip,
    track: TimelineTrack,
    renderStart: number,
    isSelected: boolean,
    isDragging: boolean
  ) => {
    const isCollapsed = collapsedTracks[track.id];

    // Style colors based on clip type with premium gradients, glow states and border effects
    const colorStyles = track.locked
      ? {
          video: 'bg-[#1e1e21] border-slate-700/40 text-slate-400',
          image: 'bg-[#1e1e21] border-slate-700/40 text-slate-400',
          audio: 'bg-[#1e1e21] border-slate-700/40 text-slate-400',
          text: 'bg-[#1e1e21] border-slate-700/40 text-slate-400',
        }[clip.type]
      : {
          video: isSelected 
            ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white border-white selected-clip-pulse shadow-[0_0_15px_rgba(99,102,241,0.65)] z-20 font-semibold' 
            : 'bg-gradient-to-r from-indigo-950/85 to-indigo-900/65 hover:from-indigo-900 hover:to-indigo-850 border-indigo-500/25 hover:border-indigo-500/50 text-indigo-200 hover:text-white hover:shadow-md hover:shadow-indigo-950/20',
          image: isSelected 
            ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white border-white selected-clip-pulse shadow-[0_0_15px_rgba(59,130,246,0.65)] z-20 font-semibold' 
            : 'bg-gradient-to-r from-blue-950/85 to-blue-900/65 hover:from-blue-900 hover:to-blue-850 border-blue-500/25 hover:border-blue-500/50 text-blue-200 hover:text-white hover:shadow-md hover:shadow-blue-950/20',
          audio: isSelected 
            ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white border-white selected-clip-pulse shadow-[0_0_15px_rgba(16,185,129,0.65)] z-20 font-semibold' 
            : 'bg-gradient-to-r from-emerald-950/85 to-emerald-900/65 hover:from-emerald-900 hover:to-emerald-850 border-emerald-500/25 hover:border-emerald-500/50 text-emerald-200 hover:text-white hover:shadow-md hover:shadow-emerald-950/20',
          text: isSelected 
            ? 'bg-gradient-to-r from-violet-600 to-violet-500 text-white border-white selected-clip-pulse shadow-[0_0_15px_rgba(139,92,246,0.65)] z-20 font-semibold' 
            : 'bg-gradient-to-r from-violet-950/85 to-violet-900/65 hover:from-violet-900 hover:to-violet-850 border-violet-500/25 hover:border-violet-500/50 text-violet-200 hover:text-white hover:shadow-md hover:shadow-violet-950/20',
        }[clip.type];

    const leftOffset = renderStart * zoom;
    const width = clip.duration * zoom;

    const isTrimmingThis = trimState && trimState.clipId === clip.id;
    const anyDragOrTrimActive = !!dragState || !!trimState;

    // Transition optimization: disable all transitions during active dragging/trimming to prevent cursor lag/sluggishness
    const transitionClass = anyDragOrTrimActive 
      ? 'transition-none' 
      : 'transition-all duration-150 ease-out';

    const dragStyles = track.locked
      ? 'opacity-60 cursor-not-allowed grayscale'
      : isDragging 
        ? 'opacity-40 pointer-events-none scale-[1.01] border-cyan-400 ring-2 ring-cyan-400/40 shadow-2xl z-30 cursor-grabbing'
        : isTrimmingThis
          ? 'ring-2 ring-amber-500 border-amber-400 z-30 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
          : 'cursor-grab active:cursor-grabbing hover:scale-[1.002] active:scale-[0.998]';

    const isHoveredByFx = externalDrag && externalDrag.hoverClipId === clip.id;

    return (
      <div
        key={clip.id}
        onMouseDown={isDragging || isTrimmingThis || track.locked ? undefined : (e) => handleClipMouseDown(e, track.id, clip)}
        onContextMenu={(e) => handleClipContextMenu(e, track, clip)}
        className={`absolute border flex flex-col justify-center overflow-hidden select-none ${colorStyles} ${dragStyles} ${transitionClass} ${
          isCollapsed ? 'top-[3px] bottom-[3px] rounded-sm px-1.5' : 'top-2 bottom-2 rounded-md px-2'
        } ${
          isHoveredByFx ? 'border-yellow-400 border-2 scale-[1.02] ring-4 ring-yellow-400/30 z-20' : ''
        }`}
        style={{ 
          left: `${leftOffset}px`, 
          width: `${width}px` 
        }}
      >
        {/* Lock indicator */}
        {track.locked && (
          <div className="absolute right-1.5 top-1.5 bg-black/50 p-1 rounded-full text-amber-500 z-10 border border-amber-500/20 shadow">
            <Lock size={10} />
          </div>
        )}

        {/* Selected corners handle indicator overlay */}
        {isSelected && !track.locked && !isCollapsed && (
          <>
            <div className="absolute inset-0 border-[2px] border-white rounded-md pointer-events-none z-30 shadow-[inset_0_0_12px_rgba(255,255,255,0.35)]" />
            <div className="absolute top-[-2px] left-[-2px] w-2 h-2 bg-white rounded-sm border border-slate-950 pointer-events-none z-30 shadow" />
            <div className="absolute top-[-2px] right-[-2px] w-2 h-2 bg-white rounded-sm border border-slate-950 pointer-events-none z-30 shadow" />
            <div className="absolute bottom-[-2px] left-[-2px] w-2 h-2 bg-white rounded-sm border border-slate-950 pointer-events-none z-30 shadow" />
            <div className="absolute bottom-[-2px] right-[-2px] w-2 h-2 bg-white rounded-sm border border-slate-950 pointer-events-none z-30 shadow" />
          </>
        )}

        {isHoveredByFx && (
          <div className="absolute inset-0 bg-yellow-500/10 border-2 border-yellow-400 rounded-md flex items-center justify-center z-10 pointer-events-none animate-pulse">
            <span className="text-[9px] text-yellow-300 font-bold tracking-wider uppercase px-1.5 py-0.5 bg-slate-900/95 rounded border border-yellow-500/50 shadow-md">
              Apply {externalDrag.data.label}
            </span>
          </div>
        )}
        {/* Left Trim Handle - Sleek glowing handle bar */}
        {!isCollapsed && !anyDragOrTrimActive && !track.locked && (
          <div 
            onMouseDown={(e) => handleLeftTrimMouseDown(e, track.id, clip)}
            className="absolute left-0 top-0 bottom-0 w-3.5 hover:w-4.5 hover:bg-amber-500 bg-white/10 border-r border-white/20 hover:border-amber-400 cursor-ew-resize transition-all z-20 flex items-center justify-center group"
            title="Drag left edge to trim start"
          >
            <div className="w-[2px] h-4 bg-white/60 group-hover:bg-slate-950 rounded-full transition-colors animate-pulse" />
          </div>
        )}

        {/* Highlight Active Left Handle while Trimming */}
        {isTrimmingThis && trimState.edge === 'left' && (
          <div 
            className="absolute left-0 top-0 bottom-0 w-3 bg-amber-500 border-r border-[#1e1e21] cursor-ew-resize z-20 shadow-[0_0_8px_rgba(245,158,11,0.6)]"
          />
        )}

        {/* Live Trimming Duration Preview Tooltip */}
        {isTrimmingThis && (
          <div className="absolute -top-11 left-1/2 -translate-x-1/2 bg-amber-950 border border-amber-500/80 text-amber-300 text-[10px] font-mono font-bold px-2 py-1 rounded shadow-xl flex items-center gap-1.5 z-40 whitespace-nowrap pointer-events-none animate-pulse">
            <RefreshCw size={11} className="animate-spin text-amber-400" />
            <span>Duration: {clip.duration.toFixed(2)}s</span>
            {clip.type !== 'image' && clip.type !== 'text' && (
              <span className="opacity-75 text-[9px] border-l border-amber-700 pl-1.5">
                Offset: {clip.sourceOffset?.toFixed(2) || '0.00'}s
              </span>
            )}
          </div>
        )}

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
        <div className={`flex flex-col font-semibold leading-tight select-none pointer-events-none truncate z-0 ${isCollapsed ? 'text-[9px] pl-0' : 'text-[10px] pl-1'}`}>
          <span className="truncate">{clip.name}</span>
          {!isCollapsed && (
            <span className="text-[8px] opacity-75 font-mono truncate">
              {renderStart.toFixed(1)}s - {(renderStart + clip.duration).toFixed(1)}s
            </span>
          )}
        </div>

        {/* Right Trim Handle - Sleek glowing handle bar */}
        {!isCollapsed && !anyDragOrTrimActive && !track.locked && (
          <div 
            onMouseDown={(e) => handleRightTrimMouseDown(e, track.id, clip)}
            className="absolute right-0 top-0 bottom-0 w-3.5 hover:w-4.5 hover:bg-amber-500 bg-white/10 border-l border-white/20 hover:border-amber-400 cursor-ew-resize transition-all z-20 flex items-center justify-center group"
            title="Drag right edge to trim end"
          >
            <div className="w-[2px] h-4 bg-white/60 group-hover:bg-slate-950 rounded-full transition-colors animate-pulse" />
          </div>
        )}

        {/* Highlight Active Right Handle while Trimming */}
        {isTrimmingThis && trimState.edge === 'right' && (
          <div 
            className="absolute right-0 top-0 bottom-0 w-3 bg-amber-500 border-l border-black/30 cursor-ew-resize z-20 shadow-[0_0_8px_rgba(245,158,11,0.6)]"
          />
        )}

        {/* Interactive Volume Envelope overlay (only for Audio clips) */}
        {clip.type === 'audio' && !isDragging && (
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
  };

  const hasActiveKeyframe = selectedClip
    ? selectedClip.keyframes?.some(kf => Math.abs(kf.time - (currentTime - selectedClip.start)) < 0.1)
    : false;

  const hasPrevKeyframe = selectedClip && selectedClip.keyframes && selectedClip.keyframes.length > 0
    ? selectedClip.keyframes.some(kf => kf.time < (currentTime - selectedClip.start) - 0.05)
    : false;

  const hasNextKeyframe = selectedClip && selectedClip.keyframes && selectedClip.keyframes.length > 0
    ? selectedClip.keyframes.some(kf => kf.time > (currentTime - selectedClip.start) + 0.05)
    : false;

  return (
    <div 
      id="video-timeline"
      ref={timelineOuterRef}
      onMouseDown={handleTimelineMouseDown}
      className="bg-[#121214] border-t border-[#2A2A2D] flex flex-col shrink-0 select-none"
      style={
        height !== undefined 
          ? { 
              height: `${height}px`,
              transition: isResizing ? 'none' : 'height 300ms cubic-bezier(0.16, 1, 0.3, 1)'
            } 
          : { height: '300px' }
      }
      onMouseMove={handleTimelineMouseMove}
      onMouseUp={handleTimelineMouseUp}
      onMouseLeave={handleTimelineMouseUp}
    >
      <style>{`
        /* Professional custom scrollbar for track lane scrollareas */
        .tracks-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .tracks-scrollbar::-webkit-scrollbar-track {
          background: #0d0d0f;
        }
        .tracks-scrollbar::-webkit-scrollbar-thumb {
          background: #252529;
          border-radius: 4px;
          border: 1.5px solid #0d0d0f;
        }
        .tracks-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #4f46e5;
        }
        .tracks-scrollbar::-webkit-scrollbar-corner {
          background: #0d0d0f;
        }

        /* Diagonal warning/projective stripes for placements */
        .bg-stripes {
          background-image: linear-gradient(45deg, rgba(0, 229, 255, 0.15) 25%, transparent 25%, transparent 50%, rgba(0, 229, 255, 0.15) 50%, rgba(0, 229, 255, 0.15) 75%, transparent 75%, transparent);
          background-size: 24px 24px;
          animation: stripes-move 1s linear infinite;
        }
        @keyframes stripes-move {
          0% { background-position: 0 0; }
          100% { background-position: 24px 0; }
        }

        /* Ambient selection pulse glow for professional feeling */
        @keyframes selection-pulse {
          0%, 100% { box-shadow: 0 0 12px rgba(99, 102, 241, 0.45), inset 0 0 8px rgba(255, 255, 255, 0.3); }
          50% { box-shadow: 0 0 18px rgba(99, 102, 241, 0.75), inset 0 0 14px rgba(255, 255, 255, 0.5); }
        }
        .selected-clip-pulse {
          animation: selection-pulse 2s infinite ease-in-out;
        }
      `}</style>
      {/* Timeline Controls / Split / Delete actions */}
      <div className="flex items-center justify-between border-b border-[#2A2A2D]/80 px-4 py-1 shrink-0 bg-[#0F0F10] h-10 select-none">
        <div className="flex items-center gap-1.5">
          {/* VividCut-style Timeline Undo/Redo buttons */}
          <div className="flex items-center gap-1 pr-2 mr-0.5 border-r border-[#2A2A2D]/60">
            <button
              id="btn-timeline-undo"
              disabled={!canUndo}
              onClick={onUndo}
              className="w-8 h-8 flex items-center justify-center bg-[#161618] border border-[#2d2d34]/60 hover:border-slate-500 disabled:opacity-25 rounded text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Undo edit (Ctrl+Z)"
            >
              <Undo2 size={16} />
            </button>
            <button
              id="btn-timeline-redo"
              disabled={!canRedo}
              onClick={onRedo}
              className="w-8 h-8 flex items-center justify-center bg-[#161618] border border-[#2d2d34]/60 hover:border-slate-500 disabled:opacity-25 rounded text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Redo edit (Ctrl+Y)"
            >
              <Redo2 size={16} />
            </button>
          </div>

          <button
            id="btn-split-selected-clip"
            disabled={!selectedClip}
            onClick={handleTriggerSplit}
            className="w-8 h-8 flex items-center justify-center bg-[#161618] border border-[#2A2A2D]/80 hover:border-slate-500 disabled:opacity-25 text-indigo-400 hover:text-indigo-300 rounded transition-all cursor-pointer"
            title="Split selected clip at current playhead position (S)"
          >
            <Scissors size={18} />
          </button>

          <button
            id="btn-delete-selected-clip"
            disabled={activeSelectedIds.length === 0}
            onClick={handleTriggerDelete}
            className="w-8 h-8 flex items-center justify-center bg-[#161618] border border-[#2A2A2D]/80 hover:border-slate-500 disabled:opacity-25 text-red-400 hover:text-red-300 rounded transition-all cursor-pointer"
            title="Delete active clip (Delete/Backspace)"
          >
            <Trash2 size={18} />
          </button>

          {/* Professional Keyframe Controls */}
          {selectedClip && (
            <>
              <div className="w-px h-5 bg-[#2A2A2D]/60 mx-1" />
              <div className="flex items-center gap-1">
                {selectedClip.keyframes && selectedClip.keyframes.length > 0 && (
                  <button
                    id="btn-timeline-prev-keyframe"
                    onClick={handleGoToPrevKeyframe}
                    className="w-8 h-8 flex items-center justify-center bg-[#161618] border border-[#2A2A2D]/80 hover:border-slate-500 text-slate-400 hover:text-slate-200 rounded transition-all cursor-pointer"
                    title="Previous Keyframe"
                  >
                    <ChevronLeft size={18} />
                  </button>
                )}

                <button
                  id="btn-timeline-toggle-keyframe"
                  onClick={handleToggleKeyframeAtPlayhead}
                  className={`w-8 h-8 flex items-center justify-center border rounded transition-all cursor-pointer ${
                    hasActiveKeyframe
                      ? 'bg-amber-950/60 border-amber-500/80 hover:border-amber-400 hover:bg-amber-900/60 text-amber-400'
                      : 'bg-[#161618] border-[#2A2A2D]/80 hover:border-slate-500 text-slate-400 hover:text-slate-200'
                  }`}
                  title={hasActiveKeyframe ? "Remove Keyframe" : "Add Keyframe"}
                >
                  <Diamond size={15} className={hasActiveKeyframe ? "fill-amber-400 text-amber-400" : ""} />
                </button>

                {selectedClip.keyframes && selectedClip.keyframes.length > 0 && (
                  <button
                    id="btn-timeline-next-keyframe"
                    onClick={handleGoToNextKeyframe}
                    className="w-8 h-8 flex items-center justify-center bg-[#161618] border border-[#2A2A2D]/80 hover:border-slate-500 text-slate-400 hover:text-slate-200 rounded transition-all cursor-pointer"
                    title="Next Keyframe"
                  >
                    <ChevronRight size={18} />
                  </button>
                )}
              </div>
            </>
          )}

          <div className="w-px h-5 bg-[#2A2A2D]/60 mx-1" />

          <button
            id="btn-copy-selected-clips"
            disabled={activeSelectedIds.length === 0}
            onClick={onCopyClips}
            className="w-8 h-8 flex items-center justify-center bg-[#161618] border border-[#2A2A2D]/80 hover:border-slate-500 disabled:opacity-25 text-amber-400 hover:text-amber-300 rounded transition-all cursor-pointer"
            title="Copy selected clips (Ctrl+C)"
          >
            <Copy size={18} />
          </button>

          <button
            id="btn-paste-selected-clips"
            onClick={onPasteClips}
            className="w-8 h-8 flex items-center justify-center bg-[#161618] border border-[#2A2A2D]/80 hover:border-slate-500 text-emerald-400 hover:text-emerald-300 rounded transition-all cursor-pointer"
            title="Paste copied clips at playhead (Ctrl+V)"
          >
            <Clipboard size={18} />
          </button>

          <div className="w-px h-5 bg-[#2A2A2D]/60 mx-1" />

          <button
            id="btn-toggle-magnetic-snapping"
            onClick={() => setMagnetEnabled(prev => !prev)}
            className={`w-8 h-8 flex items-center justify-center border rounded transition-all cursor-pointer ${
              magnetEnabled 
                ? 'bg-cyan-950/60 border-cyan-500/80 hover:border-cyan-400 hover:bg-cyan-900/60 text-cyan-400' 
                : 'bg-[#161618] border-[#2A2A2D]/80 hover:border-slate-500 text-slate-400 hover:text-slate-200'
            }`}
            title={magnetEnabled ? "Magnetic Snapping: Enabled (N)" : "Magnetic Snapping: Disabled (N)"}
          >
            <Magnet size={18} className={magnetEnabled ? "animate-pulse" : ""} />
          </button>

          <button
            id="btn-toggle-ripple-editing"
            onClick={() => setRippleEnabled(prev => !prev)}
            className={`w-8 h-8 flex items-center justify-center border rounded transition-all cursor-pointer ${
              rippleEnabled 
                ? 'bg-amber-950/60 border-amber-500/80 hover:border-amber-400 hover:bg-amber-900/60 text-amber-400' 
                : 'bg-[#161618] border-[#2A2A2D]/80 hover:border-slate-500 text-slate-400 hover:text-slate-200'
            }`}
            title={rippleEnabled ? "Ripple Editing: Enabled (R)" : "Ripple Editing: Disabled (R)"}
          >
            <RefreshCw size={17} className={rippleEnabled ? "animate-spin" : ""} style={{ animationDuration: '10s' }} />
          </button>

          {/* More Actions Dropdown */}
          <div className="relative">
            {advancedMenuOpen && (
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setAdvancedMenuOpen(false)} 
              />
            )}
            <button
              id="btn-timeline-advanced-options"
              onClick={() => setAdvancedMenuOpen(prev => !prev)}
              className={`w-8 h-8 flex items-center justify-center bg-[#161618] border border-[#2A2A2D]/80 hover:border-slate-500 text-slate-300 rounded transition-all cursor-pointer z-50 relative ${advancedMenuOpen ? 'border-indigo-500/80 bg-indigo-950/20 text-indigo-400' : ''}`}
              title="Advanced Actions"
            >
              <MoreHorizontal size={18} />
            </button>

            {advancedMenuOpen && (
              <div className="absolute left-0 mt-1.5 w-48 bg-[#141416] border border-[#2A2A2D] rounded shadow-2xl py-1 z-50 animate-fadeIn">
                <button
                  id="btn-advanced-copy"
                  disabled={activeSelectedIds.length === 0}
                  onClick={() => {
                    onCopyClips();
                    setAdvancedMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-slate-300 hover:text-white hover:bg-[#2A2A2D] disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                >
                  <Copy size={13} className="text-amber-400" />
                  <span>Copy Clips (Ctrl+C)</span>
                </button>

                <button
                  id="btn-advanced-paste"
                  onClick={() => {
                    onPasteClips();
                    setAdvancedMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-slate-300 hover:text-white hover:bg-[#2A2A2D] transition-colors cursor-pointer"
                >
                  <Clipboard size={13} className="text-emerald-400" />
                  <span>Paste Clips (Ctrl+V)</span>
                </button>

                <div className="h-px bg-[#2A2A2D] my-1" />

                <button
                  id="btn-advanced-ripple"
                  onClick={() => {
                    setRippleEnabled(prev => !prev);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs text-left text-slate-300 hover:text-white hover:bg-[#2A2A2D] transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <RefreshCw size={13} className={`text-amber-400 ${rippleEnabled ? 'animate-spin' : ''}`} style={{ animationDuration: '8s' }} />
                    <span>Ripple Editing</span>
                  </span>
                  {rippleEnabled && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Volume Automation Help / Glowing Tip Banner */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-emerald-950/30 border border-emerald-900/40 rounded-full text-emerald-400 text-[10px] font-medium tracking-wide">
          <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Tip: Double-click audio clips to add volume keyframes, then drag to fade & automate levels!</span>
        </div>

        {/* Horizontal Time-Scale (Zoom) Slider */}
        <div className="flex items-center gap-2 bg-[#161618] px-2 py-0.5 rounded border border-[#2A2A2D]/60 h-8">
          <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider hidden md:inline pl-1">
            Zoom
          </span>
          
          <button 
            id="btn-timeline-zoom-out"
            onClick={() => triggerZoomTo(zoomRef.current / 1.35)}
            className="p-1 hover:bg-[#232326] text-slate-400 hover:text-slate-200 rounded cursor-pointer transition-colors"
            title="Decrease Zoom"
          >
            <ZoomOut size={12} />
          </button>
          
          <input
            id="timeline-zoom-slider"
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={getSliderValue(zoom)}
            onChange={(e) => triggerZoomTo(getZoomFromSlider(Number(e.target.value)))}
            onDoubleClick={() => {
              const { minZoom } = getZoomLimits();
              const defaultZoom = Math.max(minZoom, 10);
              triggerZoomTo(defaultZoom);
            }}
            className="w-20 sm:w-28 accent-indigo-500 h-1 bg-[#2A2A2D] rounded-full cursor-ew-resize focus:outline-none"
            title="Adjust horizontal scale (Double-click to reset)"
          />

          <button 
            id="btn-timeline-zoom-in"
            onClick={() => triggerZoomTo(zoomRef.current * 1.35)}
            className="p-1 hover:bg-[#232326] text-slate-400 hover:text-slate-200 rounded cursor-pointer transition-colors"
            title="Increase Zoom"
          >
            <ZoomIn size={12} />
          </button>

          <span 
            className="text-[10px] text-indigo-400 font-mono font-bold bg-indigo-950/40 border border-indigo-900/40 px-1.5 py-0.5 rounded select-none min-w-[50px] text-center cursor-pointer hover:bg-indigo-950/60 transition-colors"
            title="Current zoom level. Double-click slider to reset to default."
          >
            {zoom < 1 ? zoom.toFixed(2) : Math.round(zoom)} px/s
          </span>
        </div>
      </div>

      {/* Main Track lanes + Scrubber Scrollarea */}
      <div 
        ref={tracksContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-x-auto overflow-y-auto relative flex flex-col tracks-scrollbar"
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          if (e.clientX < rect.left || e.clientX >= rect.right || e.clientY < rect.top || e.clientY >= rect.bottom) {
            setExternalDrag(null);
          }
        }}
      >
        {/* Time Ruler / Scrubber Clickable Strip */}
        <div 
          id="timeline-ruler"
          className="h-9 border-b border-[#2A2A2D] relative bg-[#141416]/90 backdrop-blur-sm cursor-pointer select-none sticky top-0 z-20 shrink-0 shadow-sm"
          onMouseDown={handleRulerMouseDown}
          onClick={handleRulerClickOrDrag}
          onMouseMove={(e) => {
            if (!tracksContainerRef.current) return;
            const rect = tracksContainerRef.current.getBoundingClientRect();
            const scrollLeft = tracksContainerRef.current.scrollLeft;
            const mouseX = e.clientX - rect.left + scrollLeft - 80;
            const hoverTime = Math.max(0, Math.min(workspaceDuration, mouseX / zoom));
            setHoverRulerTime(hoverTime);
          }}
          onMouseLeave={() => {
            setHoverRulerTime(null);
          }}
        >
          {/* Label Spacer */}
          <div className="sticky left-0 top-0 bottom-0 w-20 bg-gradient-to-b from-[#1c1c1e] to-[#121214] border-r border-[#2A2A2D] flex items-center justify-center text-[9px] font-bold text-slate-300 uppercase tracking-wider z-30 shadow-[4px_0_12px_rgba(0,0,0,0.5)]">
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
        <div 
          onMouseDown={handleGridMouseDown}
          onContextMenu={handleGridContextMenu}
          className="flex-1 flex flex-col min-h-max relative pb-4"
        >
          {/* Dynamic Background Grid Lines */}
          <div 
            className="absolute inset-0 pointer-events-none overflow-hidden select-none"
            style={{ left: '80px', width: `${totalTimelineWidth}px` }}
          >
            {renderGridLines()}
          </div>

          {/* Marquee Selection Box Overlay */}
          {selectionBox && (
            <div 
              className="absolute bg-indigo-500/10 border-2 border-indigo-500 rounded pointer-events-none z-50 shadow-inner"
              style={{
                left: `${Math.min(selectionBox.startX, selectionBox.currentX)}px`,
                top: `${Math.min(selectionBox.startY, selectionBox.currentY)}px`,
                width: `${Math.abs(selectionBox.startX - selectionBox.currentX)}px`,
                height: `${Math.abs(selectionBox.startY - selectionBox.currentY)}px`
              }}
            />
          )}
          
          {/* Vertical Playhead Scrubber Line Indicator */}
          <div 
            className="absolute top-0 bottom-0 w-[1.5px] bg-[#FF3B30] z-40 pointer-events-none shadow-[0_0_10px_rgba(255,59,48,0.7)]"
            style={{ left: `${currentTime * zoom + 80}px` }}
          >
            {/* Playhead Cap (Handle) - Designed like a professional editing cursor */}
            <div 
              onMouseDown={(e) => {
                e.stopPropagation();
                setIsScrubbing(true);
              }}
              className="absolute -top-8 -left-[9px] w-[19px] h-5 bg-gradient-to-b from-[#EF4444] to-[#C92A2A] border border-[#FF6B6B] rounded-t-sm shadow-[0_3px_8px_rgba(0,0,0,0.6)] pointer-events-auto cursor-col-resize flex flex-col items-center justify-center group/playhead transition-all hover:scale-110 active:scale-95 z-50"
            >
              {/* Downward pointing triangle at the bottom of the handle */}
              <div className="absolute top-full left-0 right-0 h-0 w-0 border-t-[6px] border-t-[#C92A2A] border-x-[9.5px] border-x-transparent pointer-events-none" />
              
              {/* Core playhead glowing line inside handle */}
              <div className="w-[1.5px] h-3 bg-white/95 rounded-full shadow-[0_0_3px_#fff]" />

              {/* Floating Real-time time display badge inside/above playhead */}
              <div className="absolute -top-[23px] left-1/2 -translate-x-1/2 bg-[#FF3B30] text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md shadow-lg border border-red-300/30 whitespace-nowrap pointer-events-none opacity-0 group-hover/playhead:opacity-100 transition-opacity flex items-center gap-1">
                <span>{formatPlayheadTime(currentTime)}</span>
              </div>
            </div>
          </div>

          {/* Ruler Hover Ghost Playhead Scrubber */}
          {hoverRulerTime !== null && !isScrubbing && (
            <div 
              className="absolute top-0 bottom-0 w-[1px] bg-slate-400/30 z-30 pointer-events-none border-l border-dashed border-slate-400/20"
              style={{ left: `${hoverRulerTime * zoom + 80}px` }}
            >
              {/* Mini Ghost Indicator */}
              <div className="absolute top-1 -left-[20px] bg-slate-800/90 text-slate-300 text-[8px] font-mono px-1 py-0.5 rounded border border-slate-600 shadow pointer-events-none">
                {formatPlayheadTime(hoverRulerTime)}
              </div>
            </div>
          )}

          {/* Magnetic Guideline Indicator with Professional Badge */}
          {(snapLineTime !== null || (externalDrag && externalDrag.snappedTime !== externalDrag.hoverTime)) && (
            <div 
              className="absolute top-0 bottom-0 w-[2px] bg-cyan-400 z-40 pointer-events-none shadow-[0_0_10px_rgba(0,229,255,0.8)]"
              style={{ left: `${(snapLineTime !== null ? snapLineTime : (externalDrag ? externalDrag.snappedTime : 0)) * zoom + 80}px` }}
            >
              {/* Pulsing indicator dot on top of the playhead / ruler height */}
              <div className="absolute top-0 -left-[4px] w-2.5 h-2.5 bg-cyan-400 rotate-45 border border-white shadow-[0_0_6px_rgba(0,229,255,1)]" />

              <div className="absolute -top-[32px] -left-[32px] bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 text-[9px] font-mono font-bold px-2 py-0.5 rounded shadow-[0_2px_8px_rgba(0,229,255,0.4)] flex items-center gap-1 border border-cyan-300">
                <Magnet size={9} className="stroke-[2.5] animate-pulse" />
                <span>{(snapLineTime !== null ? snapLineTime : (externalDrag ? externalDrag.snappedTime : 0)).toFixed(2)}s</span>
              </div>
            </div>
          )}          {project.tracks.map((track) => {
            const isCollapsed = collapsedTracks[track.id];
            const trackHeight = isCollapsed ? 32 : (trackHeights[track.id] || 64);
            return (
              <div 
                key={track.id} 
                onDragOver={(e) => handleTrackDragOver(e, track)}
                onDragLeave={handleTrackDragLeave}
                onDrop={(e) => handleTrackDrop(e, track)}
                className={`border-b border-[#2A2A2D] flex items-center relative group/track select-none transition-colors duration-150 ${
                dragState && dragState.currentTrackId === track.id
                  ? dragState.isValidTarget
                    ? 'bg-indigo-950/20 border-indigo-500/30'
                    : 'bg-red-950/15 border-red-500/20'
                  : ''
              } ${
                externalDrag
                  ? externalDrag.currentTrackId === track.id
                    ? externalDrag.isValidTarget
                      ? 'bg-cyan-950/30 border-cyan-500/50 ring-1 ring-cyan-500/20'
                      : 'bg-red-950/20 border-red-500/30 ring-1 ring-red-500/20'
                    : (externalDrag.itemType === 'effect' || externalDrag.itemType === 'transition')
                      ? 'hover:bg-slate-800/10'
                      : (externalDrag.itemType === 'video' || externalDrag.itemType === 'image') && track.type === 'video'
                        ? 'bg-cyan-950/10 border-cyan-600/20 border-dashed'
                        : externalDrag.itemType === 'audio' && track.type === 'audio'
                          ? 'bg-cyan-950/10 border-cyan-600/20 border-dashed'
                          : (externalDrag.itemType === 'text' || externalDrag.itemType === 'sticker') && track.type === 'text'
                            ? 'bg-cyan-950/10 border-cyan-600/20 border-dashed'
                            : 'opacity-40'
                  : ''
              }`}
              style={{ height: `${trackHeight}px` }}
              onMouseEnter={() => {
                if (dragState && draggedInfo) {
                  const isValid = track.type === draggedInfo.clip.type;
                  setDragState(prev => prev ? {
                    ...prev,
                    currentTrackId: track.id,
                    isValidTarget: isValid
                  } : null);
                }
              }}
            >
              {/* Track Info sidebar label */}
              <div 
                className="sticky left-0 top-0 bottom-0 w-20 bg-[#141416] border-r border-[#2A2A2D] flex flex-col justify-between px-1.5 py-1.5 shrink-0 z-30 select-none shadow-[4px_0_12px_rgba(0,0,0,0.5)] h-full overflow-hidden"
              >
                <div className="flex items-center gap-1 w-full overflow-hidden">
                  {/* Collapse chevron */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCollapsedTracks(prev => ({ ...prev, [track.id]: !prev[track.id] }));
                    }}
                    className="p-0.5 hover:bg-[#232326] rounded text-slate-400 hover:text-slate-100 cursor-pointer"
                    title={isCollapsed ? "Expand Track" : "Collapse Track"}
                  >
                    {isCollapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
                  </button>

                  {renamingTrackId === track.id ? (
                    <input
                      autoFocus
                      type="text"
                      value={renamingTrackName}
                      onChange={(e) => setRenamingTrackName(e.target.value)}
                      onBlur={() => handleRenameTrackSubmit(track.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameTrackSubmit(track.id);
                        if (e.key === 'Escape') setRenamingTrackId(null);
                      }}
                      className="bg-[#111112] text-[10px] text-white px-1 py-0.5 border border-indigo-500 rounded outline-none w-12"
                    />
                  ) : (
                    <span 
                      onDoubleClick={() => handleRenameTrackStart(track.id, track.name)}
                      className="text-[10px] font-bold text-slate-300 truncate tracking-wide block cursor-pointer select-none"
                      title="Double-click to rename track"
                    >
                      {track.name}
                    </span>
                  )}
                </div>

                {/* Track controls - grid pattern to look extremely technical and dense */}
                {!isCollapsed && (
                  <div className="grid grid-cols-4 gap-1 mt-1 w-full opacity-60 group-hover/track:opacity-100 transition-opacity">
                    {/* Hide toggle */}
                    <button
                      onClick={() => handleToggleHideTrack(track.id)}
                      className={`p-0.5 hover:bg-[#232326] rounded cursor-pointer flex items-center justify-center ${
                        track.hidden ? 'text-[#38BDF8]' : 'text-slate-500 hover:text-[#38BDF8]'
                      }`}
                      title={track.hidden ? 'Show Track Visuals' : 'Hide Track Visuals'}
                    >
                      {track.hidden ? <EyeOff size={10} /> : <Eye size={10} />}
                    </button>

                    {/* Mute toggle */}
                    <button
                      onClick={() => onToggleMuteTrack(track.id)}
                      className={`p-0.5 hover:bg-[#232326] rounded cursor-pointer flex items-center justify-center ${
                        track.muted ? 'text-[#EF4444]' : 'text-slate-500 hover:text-[#EF4444]'
                      }`}
                      title={track.muted ? 'Unmute Track Audio' : 'Mute Track Audio'}
                    >
                      {track.muted ? <VolumeX size={10} /> : <Volume2 size={10} />}
                    </button>

                    {/* Lock toggle */}
                    <button
                      onClick={() => handleToggleLockTrack(track.id)}
                      className={`p-0.5 hover:bg-[#232326] rounded cursor-pointer flex items-center justify-center ${
                        track.locked ? 'text-[#F59E0B]' : 'text-slate-500 hover:text-[#F59E0B]'
                      }`}
                      title={track.locked ? 'Unlock Track' : 'Lock Track'}
                    >
                      {track.locked ? <Lock size={10} /> : <Unlock size={10} />}
                    </button>

                    {/* Plus toggle */}
                    <button
                      onClick={() => onAddClipToTrack(track.id, track.type)}
                      className="p-0.5 hover:bg-[#232326] rounded text-slate-500 hover:text-[#818CF8] cursor-pointer flex items-center justify-center"
                      title="Add dummy blank clip here"
                    >
                      <Plus size={10} />
                    </button>
                  </div>
                )}
              </div>

              {/* Lane Content clips zone */}
              <div 
                className="absolute top-0 bottom-0 flex items-center overflow-hidden"
                style={{ left: '80px', width: `${totalTimelineWidth}px` }}
              >
                {/* Empty track guides overlay */}
                <div className="absolute inset-0 bg-[#0F0F10]/30 pointer-events-none" />

                {/* Semi-transparent placement preview indicator */}
                {dragState && draggedInfo && dragState.currentTrackId === track.id && dragState.isValidTarget && (
                  <div
                    className="absolute top-2 bottom-2 border-2 border-dashed border-cyan-400 bg-cyan-400/20 rounded-md flex items-center justify-center pointer-events-none z-10 animate-pulse"
                    style={{
                      left: `${dragState.snappedStart * zoom}px`,
                      width: `${draggedInfo.clip.duration * zoom}px`
                    }}
                  >
                    <span className="text-[9px] text-cyan-300 font-mono font-bold">Drop Here</span>
                  </div>
                )}

                {/* External placement preview indicator */}
                {externalDrag && externalDrag.currentTrackId === track.id && externalDrag.isValidTarget && (
                  <div
                    className="absolute top-2 bottom-2 border-2 border-dashed border-cyan-400 bg-cyan-400/20 rounded-md flex items-center justify-center pointer-events-none z-10 animate-pulse"
                    style={{
                      left: `${externalDrag.snappedTime * zoom}px`,
                      width: `${((externalDrag.itemType === 'effect' || externalDrag.itemType === 'transition') ? 3 : (externalDrag.data?.duration || 5)) * zoom}px`
                    }}
                  >
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-[10px] text-cyan-300 font-bold truncate max-w-[120px] px-1">
                        {externalDrag.itemType === 'effect' || externalDrag.itemType === 'transition'
                          ? (externalDrag.hoverClipId ? `Apply ${externalDrag.data.label}` : 'Hover over a clip')
                          : `Add: ${externalDrag.data?.name || externalDrag.itemType}`}
                      </span>
                      <span className="text-[8px] text-cyan-400/80 font-mono leading-none mt-0.5">
                        {externalDrag.snappedTime.toFixed(2)}s
                      </span>
                    </div>
                  </div>
                )}

                {(() => {
                  const getTrackClips = () => {
                    return track.clips.map(clip => {
                      if (trimState && trimState.clipId === clip.id && trimState.trackId === track.id) {
                        return {
                          ...clip,
                          start: trimState.currentStart,
                          duration: trimState.currentDuration,
                          sourceOffset: trimState.currentSourceOffset
                        };
                      }
                      return clip;
                    });
                  };

                  const activeClips = getTrackClips();

                  if (dragState && dragState.isMultiDrag && dragState.draggedClips) {
                    return activeClips.map(clip => {
                      const dc = dragState.draggedClips?.find(item => item.clipId === clip.id);
                      const isSelected = activeSelectedIds.includes(clip.id);
                      if (dc) {
                        return renderClipElement(clip, track, dc.currentStart, isSelected, true);
                      } else {
                        return renderClipElement(clip, track, clip.start, isSelected, false);
                      }
                    });
                  }

                  if (!dragState || !draggedInfo) {
                    return activeClips.map(clip => {
                      const isSelected = activeSelectedIds.includes(clip.id);
                      return renderClipElement(clip, track, clip.start, isSelected, false);
                    });
                  }

                  const { clip: originalClip } = draggedInfo;
                  const isHoveredTrack = track.id === dragState.currentTrackId;

                  // Get other clips excluding the active dragged clip
                  const otherClips = activeClips.filter(c => c.id !== originalClip.id);

                  if (isHoveredTrack && dragState.isValidTarget) {
                    let renderedOthers: { clip: Clip; start: number }[] = [];
                    if (rippleEnabled) {
                      // Ripple is enabled: shift other clips to the right in real-time
                      const sortedOthers = [...otherClips].sort((a, b) => a.start - b.start);
                      let currentOccupiedEnd = dragState.snappedStart + originalClip.duration;
                      renderedOthers = sortedOthers.map(c => {
                        if (c.start >= dragState.snappedStart - 0.01) {
                          const newStart = Math.max(c.start + originalClip.duration, currentOccupiedEnd);
                          currentOccupiedEnd = newStart + c.duration;
                          return { clip: c, start: newStart };
                        }
                        return { clip: c, start: c.start };
                      });
                    } else {
                      // Ripple is disabled: keep other clips in their original position
                      renderedOthers = otherClips.map(c => ({ clip: c, start: c.start }));
                    }

                    // Render other clips + the dragged clip in its floating/raw dragged position
                    const elements = renderedOthers.map(({ clip, start }) => {
                      const isSelected = activeSelectedIds.includes(clip.id);
                      return renderClipElement(clip, track, start, isSelected, false);
                    });

                    // Add the floating dragged clip
                    elements.push(
                      renderClipElement(originalClip, track, dragState.currentStart, activeSelectedIds.includes(originalClip.id), true)
                    );

                    return elements;
                  } else {
                    // Not the hovered track: just render other clips
                    return otherClips.map(clip => {
                      const isSelected = activeSelectedIds.includes(clip.id);
                      return renderClipElement(clip, track, clip.start, isSelected, false);
                    });
                  }
                })()}
              </div>

              {/* Individual Track bottom border resize handle */}
              <div
                onMouseDown={(e) => handleTrackResizeStart(e, track.id)}
                onDoubleClick={() => resetTrackHeight(track.id)}
                className="absolute bottom-0 left-0 right-0 h-1 cursor-row-resize bg-transparent hover:bg-indigo-500/80 z-40 transition-colors duration-100 flex items-center justify-center group-hover/track:bg-slate-800/20"
                title="Drag track edge to resize height. Double-click to reset."
              >
                {/* Visual grab highlight line */}
                <div className="w-16 h-[2px] rounded-full bg-slate-500/0 group-hover/track:bg-indigo-500/50 transition-all pointer-events-none" />
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {/* Custom Context Menu */}
      {contextMenu && (() => {
        // Position correction to keep it on-screen
        const menuWidth = 180;
        const menuHeight = contextMenu.type === 'clip' ? 260 : 130;
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        let renderX = contextMenu.x;
        let renderY = contextMenu.y;

        if (renderX + menuWidth > screenWidth) {
          renderX = screenWidth - menuWidth - 8;
        }
        if (renderY + menuHeight > screenHeight) {
          renderY = screenHeight - menuHeight - 8;
        }

        const canSplit = contextMenu.clip 
          ? (currentTime > contextMenu.clip.start && currentTime < contextMenu.clip.start + contextMenu.clip.duration)
          : false;

        return (
          <div 
            className="fixed bg-[#141416]/95 backdrop-blur-md border border-[#2A2A2D] rounded-lg shadow-2xl py-1.5 z-50 w-48 animate-fadeIn select-none text-slate-300 font-sans"
            style={{ left: `${renderX}px`, top: `${renderY}px` }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {contextMenu.type === 'clip' ? (
              <div className="flex flex-col gap-0.5 px-1">
                {/* Header info */}
                <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-[#2A2A2D] mb-1 truncate">
                  Clip: {contextMenu.clip?.name}
                </div>

                {/* Copy */}
                <button
                  onClick={handleCopyAction}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs text-left text-slate-300 hover:text-white hover:bg-[#2A2A2D] rounded transition-colors w-full cursor-pointer"
                >
                  <Copy size={13} className="opacity-70" />
                  <span>Copy</span>
                </button>

                {/* Cut */}
                <button
                  onClick={handleCutAction}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs text-left text-slate-300 hover:text-white hover:bg-[#2A2A2D] rounded transition-colors w-full cursor-pointer"
                >
                  <Scissors size={13} className="opacity-70" />
                  <span>Cut</span>
                </button>

                {/* Duplicate */}
                <button
                  onClick={handleDuplicateAction}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs text-left text-slate-300 hover:text-white hover:bg-[#2A2A2D] rounded transition-colors w-full cursor-pointer"
                >
                  <Copy size={13} className="opacity-70 rotate-90" />
                  <span>Duplicate</span>
                </button>

                {/* Delete */}
                <button
                  onClick={handleDeleteAction}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs text-left text-red-400 hover:text-red-300 hover:bg-red-950/25 rounded transition-colors w-full cursor-pointer"
                >
                  <Trash2 size={13} className="opacity-70" />
                  <span>Delete</span>
                </button>

                <div className="h-px bg-[#2A2A2D] my-1" />

                {/* Split */}
                <button
                  onClick={handleSplitAction}
                  disabled={!canSplit}
                  className={`flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded transition-colors w-full cursor-pointer ${
                    canSplit 
                      ? 'text-slate-300 hover:text-white hover:bg-[#2A2A2D]' 
                      : 'text-slate-600 cursor-not-allowed'
                  }`}
                  title={canSplit ? "Split clip at current playhead" : "Move playhead over clip to split"}
                >
                  <Scissors size={13} className="opacity-70" />
                  <span>Split at Playhead</span>
                </button>

                {/* Bring Forward */}
                <button
                  onClick={() => handleLayerShift('forward')}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs text-left text-slate-300 hover:text-white hover:bg-[#2A2A2D] rounded transition-colors w-full cursor-pointer"
                >
                  <ArrowUp size={13} className="opacity-70" />
                  <span>Bring Forward</span>
                </button>

                {/* Send Backward */}
                <button
                  onClick={() => handleLayerShift('backward')}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs text-left text-slate-300 hover:text-white hover:bg-[#2A2A2D] rounded transition-colors w-full cursor-pointer"
                >
                  <ArrowDown size={13} className="opacity-70" />
                  <span>Send Backward</span>
                </button>

                <div className="h-px bg-[#2A2A2D] my-1" />

                {/* Properties */}
                <button
                  onClick={handlePropertiesAction}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs text-left text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/20 rounded transition-colors w-full cursor-pointer"
                >
                  <Settings size={13} className="opacity-70" />
                  <span>Properties</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5 px-1">
                <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-[#2A2A2D] mb-1">
                  Timeline
                </div>

                {/* Paste */}
                <button
                  onClick={handlePasteAction}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs text-left text-slate-300 hover:text-white hover:bg-[#2A2A2D] rounded transition-colors w-full cursor-pointer"
                >
                  <Clipboard size={13} className="opacity-70" />
                  <span>Paste</span>
                </button>

                {/* Add Track Submenu */}
                <div className="relative group/sub">
                  <button className="flex items-center justify-between w-full px-2 py-1.5 text-xs text-left text-slate-300 hover:text-white hover:bg-[#2A2A2D] rounded transition-colors cursor-pointer">
                    <span className="flex items-center gap-2">
                      <Plus size={13} className="opacity-70" />
                      <span>Add Track</span>
                    </span>
                    <ChevronRight size={11} className="opacity-50" />
                  </button>
                  <div className="absolute left-full top-0 -mt-1 ml-1 hidden group-hover/sub:block w-36 bg-[#141416] border border-[#2D2D34] rounded shadow-2xl py-1 z-50">
                    <button 
                      onClick={() => handleAddCustomTrack('video')} 
                      className="w-full px-3 py-1.5 text-xs text-left text-slate-300 hover:text-white hover:bg-[#2A2A2D] transition-colors cursor-pointer"
                    >
                      Video Track
                    </button>
                    <button 
                      onClick={() => handleAddCustomTrack('audio')} 
                      className="w-full px-3 py-1.5 text-xs text-left text-slate-300 hover:text-white hover:bg-[#2A2A2D] transition-colors cursor-pointer"
                    >
                      Audio Track
                    </button>
                    <button 
                      onClick={() => handleAddCustomTrack('text')} 
                      className="w-full px-3 py-1.5 text-xs text-left text-slate-300 hover:text-white hover:bg-[#2A2A2D] transition-colors cursor-pointer"
                    >
                      Text Track
                    </button>
                    <button 
                      onClick={() => handleAddCustomTrack('image')} 
                      className="w-full px-3 py-1.5 text-xs text-left text-slate-300 hover:text-white hover:bg-[#2A2A2D] transition-colors cursor-pointer"
                    >
                      Image Track
                    </button>
                  </div>
                </div>

                <div className="h-px bg-[#2A2A2D] my-1" />

                {/* Zoom to Fit */}
                <button
                  onClick={handleZoomToFitAction}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs text-left text-indigo-400 hover:text-indigo-300 hover:bg-[#2A2A2D] rounded transition-colors w-full cursor-pointer"
                >
                  <Maximize size={13} className="opacity-70" />
                  <span>Zoom to Fit</span>
                </button>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
