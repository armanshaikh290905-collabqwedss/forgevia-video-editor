import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  RotateCcw, 
  RotateCw, 
  Layers, 
  FileVideo, 
  HelpCircle,
  Play,
  Film,
  Compass,
  Undo2,
  Redo2,
  RefreshCw,
  Info,
  ChevronDown,
  Download,
  CheckCircle2,
  Sliders,
  Settings
} from 'lucide-react';
import { 
  VideoProject, 
  Clip, 
  TimelineTrack, 
  MediaAsset, 
  MediaType, 
  AIScriptResponse,
  VideoClip,
  TextClip,
  AudioClip,
  ImageClip
} from './types';
import MediaLibrary from './components/MediaLibrary';
import PreviewPlayer from './components/PreviewPlayer';
import Timeline from './components/Timeline';
import PropertiesPanel from './components/PropertiesPanel';

// Initial default state with working preloaded assets and track clips so the editor is instantly functional
const createInitialProject = (): VideoProject => {
  const videoTrack: TimelineTrack = {
    id: 'track_video_1',
    name: '🎬 Video',
    type: 'video',
    clips: [
      {
        id: 'clip_vid_1',
        name: 'Retro Sunset Grid',
        type: 'video',
        start: 0,
        duration: 10,
        sourceDuration: 30,
        sourceOffset: 0,
        url: 'procedural',
        proceduralType: 'grid',
        filter: 'vhs',
        volume: 0,
        speed: 1,
        brightness: 110,
        contrast: 105,
        saturation: 130
      } as VideoClip,
      {
        id: 'clip_vid_2',
        name: 'Cosmic Starfield Voyage',
        type: 'video',
        start: 10,
        duration: 12,
        sourceDuration: 30,
        sourceOffset: 0,
        url: 'procedural',
        proceduralType: 'stars',
        filter: 'none',
        volume: 0,
        speed: 1.2,
        brightness: 100,
        contrast: 100,
        saturation: 100
      } as VideoClip,
      {
        id: 'clip_vid_3',
        name: 'Psychedelic Plasma Flow',
        type: 'video',
        start: 22,
        duration: 8,
        sourceDuration: 30,
        sourceOffset: 0,
        url: 'procedural',
        proceduralType: 'plasma',
        filter: 'hue-rotate',
        volume: 0,
        speed: 0.8,
        brightness: 100,
        contrast: 110,
        saturation: 120
      } as VideoClip
    ],
    muted: false,
    locked: false
  };

  const textTrack: TimelineTrack = {
    id: 'track_text_1',
    name: '📝 Text',
    type: 'text',
    clips: [
      {
        id: 'clip_text_1',
        name: 'Caption 1',
        type: 'text',
        start: 1.5,
        duration: 7,
        sourceDuration: 7,
        sourceOffset: 0,
        text: 'CINEMA AI PRESENTS',
        fontSize: 32,
        color: '#facc15', // yellow
        backgroundColor: 'rgba(0,0,0,0.5)',
        fontFamily: 'Space Grotesk',
        alignment: 'center',
        animation: 'zoom',
        positionY: 45
      } as TextClip,
      {
        id: 'clip_text_2',
        name: 'Caption 2',
        type: 'text',
        start: 11.5,
        duration: 8,
        sourceDuration: 8,
        sourceOffset: 0,
        text: 'A Deep Space Odyssey',
        fontSize: 26,
        color: '#ffffff',
        backgroundColor: 'transparent',
        fontFamily: 'Playfair Display',
        alignment: 'center',
        animation: 'fade',
        positionY: 75
      } as TextClip
    ],
    muted: false,
    locked: false
  };

  const audioTrack: TimelineTrack = {
    id: 'track_audio_1',
    name: '🎵 Audio',
    type: 'audio',
    clips: [
      {
        id: 'clip_aud_1',
        name: 'Lo-Fi Chill Beat',
        type: 'audio',
        start: 0,
        duration: 30,
        sourceDuration: 60,
        sourceOffset: 0,
        url: 'synthesized',
        synthType: 'lofi',
        volume: 0.35,
        speed: 1.0
      } as AudioClip
    ],
    muted: false,
    locked: false
  };

  const overlayTrack: TimelineTrack = {
    id: 'track_overlay_1',
    name: '✨ Effects',
    type: 'text',
    clips: [
      {
        id: 'clip_overlay_1',
        name: 'Trending Sticker',
        type: 'text',
        start: 5,
        duration: 4,
        sourceDuration: 4,
        sourceOffset: 0,
        text: '🔥 TRENDING 🔥',
        fontSize: 18,
        color: '#ffffff',
        backgroundColor: '#ef4444',
        fontFamily: 'JetBrains Mono',
        alignment: 'center',
        animation: 'glitch',
        positionY: 20
      } as TextClip
    ],
    muted: false,
    locked: false
  };

  return {
    id: 'project_default',
    name: 'Cybernetic Voyage Trailer',
    tracks: [videoTrack, overlayTrack, textTrack, audioTrack],
    duration: 30, // 30 seconds
    fps: 30,
    width: 1280,
    height: 720
  };
};

export interface WorkspacePreset {
  id: string;
  name: string;
  isCustom?: boolean;
  leftWidth: number;
  rightWidth: number;
  bottomHeight: number;
  mediaVisible: boolean;
  propertiesVisible: boolean;
  timelineVisible: boolean;
  order: {
    media: number;
    preview: number;
    properties: number;
  };
}

const DEFAULT_WORKSPACES: WorkspacePreset[] = [
  {
    id: 'editing',
    name: 'Editing (Standard)',
    leftWidth: 340,
    rightWidth: 440,
    bottomHeight: 300,
    mediaVisible: true,
    propertiesVisible: true,
    timelineVisible: true,
    order: { media: 1, preview: 2, properties: 3 }
  },
  {
    id: 'color',
    name: 'Color Tuning',
    leftWidth: 240,
    rightWidth: 420,
    bottomHeight: 200,
    mediaVisible: true,
    propertiesVisible: true,
    timelineVisible: true,
    order: { media: 3, preview: 2, properties: 1 } // Swapped! Properties on left, Media on right
  },
  {
    id: 'audio',
    name: 'Audio Mixing',
    leftWidth: 240,
    rightWidth: 240,
    bottomHeight: 440,
    mediaVisible: true,
    propertiesVisible: true,
    timelineVisible: true,
    order: { media: 1, preview: 2, properties: 3 }
  },
  {
    id: 'minimal',
    name: 'Minimal Focus',
    leftWidth: 0,
    rightWidth: 0,
    bottomHeight: 70,
    mediaVisible: false,
    propertiesVisible: false,
    timelineVisible: true,
    order: { media: 1, preview: 2, properties: 3 }
  },
  {
    id: 'media',
    name: 'Media Intake',
    leftWidth: 480,
    rightWidth: 0,
    bottomHeight: 220,
    mediaVisible: true,
    propertiesVisible: false,
    timelineVisible: true,
    order: { media: 1, preview: 2, properties: 3 }
  }
];

export default function App() {
  const [project, setProject] = useState<VideoProject>(createInitialProject);
  
  // Workspace Layout State Engines
  const [workspaces, setWorkspaces] = useState<WorkspacePreset[]>(() => {
    const saved = localStorage.getItem('vividcut-workspaces');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved workspaces, falling back to default", e);
      }
    }
    return DEFAULT_WORKSPACES;
  });

  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string>(() => {
    const saved = localStorage.getItem('vividcut-active-workspace');
    return saved || 'editing';
  });

  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [isSavingCustom, setIsSavingCustom] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');

  const [layoutOrder, setLayoutOrder] = useState<{ media: number; preview: number; properties: number }>(() => {
    const savedWsId = localStorage.getItem('vividcut-active-workspace') || 'editing';
    const savedWsList = localStorage.getItem('vividcut-workspaces');
    let loadedList = DEFAULT_WORKSPACES;
    if (savedWsList) {
      try { loadedList = JSON.parse(savedWsList); } catch (_) {}
    }
    const currentWs = loadedList.find(w => w.id === savedWsId) || loadedList[0];
    return currentWs.order || { media: 1, preview: 2, properties: 3 };
  });

  // Undo/Redo state stacks
  const [history, setHistory] = useState<VideoProject[]>([]);
  const [historyPointer, setHistoryPointer] = useState<number>(-1);

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null);
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [copiedClips, setCopiedClips] = useState<Array<{ clip: Clip; originalTrackType: string }>>([]);

  // VividCut-style layout states
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [autoSavedTime, setAutoSavedTime] = useState<string>('Auto saved: 12:00:00');

  // Draggable panel states
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    const savedWsId = localStorage.getItem('vividcut-active-workspace') || 'editing';
    const savedWsList = localStorage.getItem('vividcut-workspaces');
    let loadedList = DEFAULT_WORKSPACES;
    if (savedWsList) {
      try { loadedList = JSON.parse(savedWsList); } catch (_) {}
    }
    const currentWs = loadedList.find(w => w.id === savedWsId) || loadedList[0];
    return currentWs.mediaVisible ? currentWs.leftWidth : 0;
  });
  
  const [rightWidth, setRightWidth] = useState<number>(() => {
    const savedWsId = localStorage.getItem('vividcut-active-workspace') || 'editing';
    const savedWsList = localStorage.getItem('vividcut-workspaces');
    let loadedList = DEFAULT_WORKSPACES;
    if (savedWsList) {
      try { loadedList = JSON.parse(savedWsList); } catch (_) {}
    }
    const currentWs = loadedList.find(w => w.id === savedWsId) || loadedList[0];
    return currentWs.propertiesVisible ? currentWs.rightWidth : 0;
  });
  
  const [bottomHeight, setBottomHeight] = useState<number>(() => {
    const savedWsId = localStorage.getItem('vividcut-active-workspace') || 'editing';
    const savedWsList = localStorage.getItem('vividcut-workspaces');
    let loadedList = DEFAULT_WORKSPACES;
    if (savedWsList) {
      try { loadedList = JSON.parse(savedWsList); } catch (_) {}
    }
    const currentWs = loadedList.find(w => w.id === savedWsId) || loadedList[0];
    return currentWs.timelineVisible ? currentWs.bottomHeight : 70;
  });

  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [isResizingBottom, setIsResizingBottom] = useState(false);

  // Workspace Management Handlers & Helpers
  const saveWorkspaceDimension = (key: 'leftWidth' | 'rightWidth' | 'bottomHeight', value: number) => {
    setWorkspaces(prev => {
      const updated = prev.map(w => {
        if (w.id === currentWorkspaceId) {
          const nextWs = {
            ...w,
            [key]: value
          };
          // Automatically synchronize visibility flags based on thresholds
          if (key === 'leftWidth') nextWs.mediaVisible = value > 50;
          if (key === 'rightWidth') nextWs.propertiesVisible = value > 50;
          if (key === 'bottomHeight') nextWs.timelineVisible = value > 75;
          return nextWs;
        }
        return w;
      });
      localStorage.setItem('vividcut-workspaces', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSelectWorkspace = (workspaceId: string) => {
    const ws = workspaces.find(w => w.id === workspaceId);
    if (!ws) return;
    setCurrentWorkspaceId(workspaceId);
    localStorage.setItem('vividcut-active-workspace', workspaceId);

    // Apply layout positions & sizes
    setLayoutOrder(ws.order || { media: 1, preview: 2, properties: 3 });
    setLeftWidth(ws.mediaVisible ? ws.leftWidth : 0);
    setRightWidth(ws.propertiesVisible ? ws.rightWidth : 0);
    setBottomHeight(ws.timelineVisible ? ws.bottomHeight : 70);
    setWorkspaceOpen(false);
  };

  const handleSaveWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    const newId = 'custom_' + Date.now();
    const newWs: WorkspacePreset = {
      id: newId,
      name: newWorkspaceName.trim(),
      isCustom: true,
      leftWidth: leftWidth > 0 ? leftWidth : 340,
      rightWidth: rightWidth > 0 ? rightWidth : 320,
      bottomHeight: bottomHeight > 70 ? bottomHeight : 280,
      mediaVisible: leftWidth > 0,
      propertiesVisible: rightWidth > 0,
      timelineVisible: bottomHeight > 70,
      order: { ...layoutOrder }
    };

    const updatedWorkspaces = [...workspaces, newWs];
    setWorkspaces(updatedWorkspaces);
    localStorage.setItem('vividcut-workspaces', JSON.stringify(updatedWorkspaces));
    
    setCurrentWorkspaceId(newId);
    localStorage.setItem('vividcut-active-workspace', newId);
    
    setNewWorkspaceName('');
    setIsSavingCustom(false);
    setWorkspaceOpen(false);
  };

  const handleDeleteCustomWorkspace = (e: React.MouseEvent, workspaceId: string) => {
    e.stopPropagation();
    const updated = workspaces.filter(w => w.id !== workspaceId);
    setWorkspaces(updated);
    localStorage.setItem('vividcut-workspaces', JSON.stringify(updated));

    if (currentWorkspaceId === workspaceId) {
      handleSelectWorkspace('editing');
    }
  };

  const handleResetActiveWorkspace = () => {
    const original = DEFAULT_WORKSPACES.find(w => w.id === currentWorkspaceId);
    if (original) {
      setWorkspaces(prev => {
        const updated = prev.map(w => {
          if (w.id === currentWorkspaceId) {
            return { ...original };
          }
          return w;
        });
        localStorage.setItem('vividcut-workspaces', JSON.stringify(updated));
        return updated;
      });
      setLayoutOrder(original.order);
      setLeftWidth(original.mediaVisible ? original.leftWidth : 0);
      setRightWidth(original.propertiesVisible ? original.rightWidth : 0);
      setBottomHeight(original.timelineVisible ? original.bottomHeight : 70);
    } else {
      setWorkspaces(prev => {
        const updated = prev.map(w => {
          if (w.id === currentWorkspaceId) {
            return {
              ...w,
              leftWidth: 340,
              rightWidth: 320,
              bottomHeight: 280,
              mediaVisible: true,
              propertiesVisible: true,
              timelineVisible: true,
              order: { media: 1, preview: 2, properties: 3 }
            };
          }
          return w;
        });
        localStorage.setItem('vividcut-workspaces', JSON.stringify(updated));
        return updated;
      });
      setLayoutOrder({ media: 1, preview: 2, properties: 3 });
      setLeftWidth(340);
      setRightWidth(320);
      setBottomHeight(280);
    }
    setWorkspaceOpen(false);
  };

  const handleResetAllToDefault = () => {
    const conf = window.confirm('Are you sure you want to delete all custom workspaces and reset layout parameters back to their original defaults?');
    if (conf) {
      localStorage.removeItem('vividcut-workspaces');
      localStorage.removeItem('vividcut-active-workspace');
      setWorkspaces(DEFAULT_WORKSPACES);
      setCurrentWorkspaceId('editing');
      setLayoutOrder({ media: 1, preview: 2, properties: 3 });
      setLeftWidth(340);
      setRightWidth(320);
      setBottomHeight(280);
      setWorkspaceOpen(false);
    }
  };

  const handleSwapPanels = () => {
    const nextOrder = {
      ...layoutOrder,
      media: layoutOrder.media === 1 ? 3 : 1,
      properties: layoutOrder.properties === 1 ? 3 : 1,
    };
    
    setLayoutOrder(nextOrder);
    
    setWorkspaces(prev => {
      const updated = prev.map(w => {
        if (w.id === currentWorkspaceId) {
          return { ...w, order: nextOrder };
        }
        return w;
      });
      localStorage.setItem('vividcut-workspaces', JSON.stringify(updated));
      return updated;
    });
  };

  const togglePanelVisibility = (panel: 'media' | 'properties' | 'timeline') => {
    setWorkspaces(prev => {
      const updated = prev.map(w => {
        if (w.id === currentWorkspaceId) {
          const nextWs = { ...w };
          if (panel === 'media') {
            nextWs.mediaVisible = !nextWs.mediaVisible;
            setLeftWidth(nextWs.mediaVisible ? (nextWs.leftWidth || 340) : 0);
          } else if (panel === 'properties') {
            nextWs.propertiesVisible = !nextWs.propertiesVisible;
            setRightWidth(nextWs.propertiesVisible ? (nextWs.rightWidth || 320) : 0);
          } else if (panel === 'timeline') {
            nextWs.timelineVisible = !nextWs.timelineVisible;
            setBottomHeight(nextWs.timelineVisible ? (nextWs.bottomHeight || 280) : 70);
          }
          return nextWs;
        }
        return w;
      });
      localStorage.setItem('vividcut-workspaces', JSON.stringify(updated));
      return updated;
    });
  };

  // Layout orders generator for flexible columns rearrangement
  const getLayoutOrders = (orderObj: { media: number; preview: number; properties: number }) => {
    let mediaOrder = 1;
    let leftHandleOrder = 2;
    let previewOrder = 3;
    let rightHandleOrder = 4;
    let propertiesOrder = 5;

    if (orderObj.media === 1 && orderObj.properties === 3) {
      mediaOrder = 1;
      leftHandleOrder = 2;
      previewOrder = 3;
      rightHandleOrder = 4;
      propertiesOrder = 5;
    } else if (orderObj.properties === 1 && orderObj.media === 3) {
      propertiesOrder = 1;
      rightHandleOrder = 2;
      previewOrder = 3;
      leftHandleOrder = 4;
      mediaOrder = 5;
    }

    return {
      mediaOrder,
      leftHandleOrder,
      previewOrder,
      rightHandleOrder,
      propertiesOrder,
    };
  };

  const layoutOrders = getLayoutOrders(layoutOrder);

  // Resize Left Panel (Media Library)
  const handleLeftResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingLeft(true);
    const startX = e.clientX;
    const startWidth = leftWidth;
    let finalWidth = startWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let newWidth = startWidth + deltaX;
      const minWidth = 220;
      const containerWidth = window.innerWidth;
      const maxWidth = containerWidth - rightWidth - 320; // 320px min for preview
      if (newWidth < minWidth) newWidth = minWidth;
      if (newWidth > maxWidth) newWidth = maxWidth;
      setLeftWidth(newWidth);
      finalWidth = newWidth;
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      saveWorkspaceDimension('leftWidth', finalWidth);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Resize Right Panel (Properties Inspector)
  const handleRightResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingRight(true);
    const startX = e.clientX;
    const startWidth = rightWidth;
    let finalWidth = startWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let newWidth = startWidth - deltaX; // dragging left increases width
      const minWidth = 220;
      const containerWidth = window.innerWidth;
      const maxWidth = containerWidth - leftWidth - 320; // 320px min for preview
      if (newWidth < minWidth) newWidth = minWidth;
      if (newWidth > maxWidth) newWidth = maxWidth;
      setRightWidth(newWidth);
      finalWidth = newWidth;
    };

    const handleMouseUp = () => {
      setIsResizingRight(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      saveWorkspaceDimension('rightWidth', finalWidth);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Resize Bottom Panel (Timeline)
  const handleBottomResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingBottom(true);
    const startY = e.clientY;
    const startHeight = bottomHeight;
    let finalHeight = startHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      let newHeight = startHeight - deltaY; // dragging up increases height
      const minHeight = 160;
      const maxHeight = window.innerHeight - 200; // 200px min for upper part
      if (newHeight < minHeight) newHeight = minHeight;
      if (newHeight > maxHeight) newHeight = maxHeight;
      setBottomHeight(newHeight);
      finalHeight = newHeight;
    };

    const handleMouseUp = () => {
      setIsResizingBottom(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      saveWorkspaceDimension('bottomHeight', finalHeight);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Persist values on changes
  useEffect(() => {
    localStorage.setItem('vividcut-panel-left-width', String(leftWidth));
  }, [leftWidth]);

  useEffect(() => {
    localStorage.setItem('vividcut-panel-right-width', String(rightWidth));
  }, [rightWidth]);

  useEffect(() => {
    localStorage.setItem('vividcut-panel-bottom-height', String(bottomHeight));
  }, [bottomHeight]);

  // Double-click to reset dividers
  const handleLeftResizeReset = () => {
    setLeftWidth(Math.max(240, Math.floor(window.innerWidth * 0.19)));
  };
  const handleRightResizeReset = () => {
    setRightWidth(Math.max(280, Math.floor(window.innerWidth * 0.25)));
  };
  const handleBottomResizeReset = () => {
    setBottomHeight(Math.max(200, Math.floor(window.innerHeight * 0.32)));
  };

  // Window resize responsive clamping
  useEffect(() => {
    const handleWindowResize = () => {
      const containerWidth = window.innerWidth;
      const minWidth = 220;
      if (containerWidth >= 768) {
        let updatedLeft = leftWidth;
        let updatedRight = rightWidth;

        if (updatedLeft < minWidth) updatedLeft = minWidth;
        if (updatedRight < minWidth) updatedRight = minWidth;

        const totalSides = updatedLeft + updatedRight;
        if (totalSides > containerWidth - 320) {
          const ratio = (containerWidth - 320) / totalSides;
          updatedLeft = Math.max(minWidth, Math.floor(updatedLeft * ratio));
          updatedRight = Math.max(minWidth, Math.floor(updatedRight * ratio));
        }

        if (updatedLeft !== leftWidth) setLeftWidth(updatedLeft);
        if (updatedRight !== rightWidth) setRightWidth(updatedRight);
      }
    };
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [leftWidth, rightWidth]);

  // Sync auto-saved clock whenever project updates
  useEffect(() => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    setAutoSavedTime(`Auto saved: ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);
  }, [project]);

  const triggerExport = () => {
    const customEvent = new CustomEvent('open-video-exporter');
    window.dispatchEvent(customEvent);
  };

  // Preloaded library stock assets so shelves are fully stocked
  const [assets, setAssets] = useState<MediaAsset[]>([
    {
      id: 'pre_grid',
      name: 'Retro Sunset Grid',
      type: 'video',
      url: 'procedural',
      duration: 30,
      proceduralType: 'grid'
    },
    {
      id: 'pre_stars',
      name: 'Deep Starfield Voyage',
      type: 'video',
      url: 'procedural',
      duration: 30,
      proceduralType: 'stars'
    },
    {
      id: 'pre_plasma',
      name: 'Psychedelic Plasma Flow',
      type: 'video',
      url: 'procedural',
      duration: 30,
      proceduralType: 'plasma'
    },
    {
      id: 'pre_lofi',
      name: 'Lo-Fi Lounge Beats',
      type: 'audio',
      url: 'synthesized',
      duration: 60,
      synthType: 'lofi'
    }
  ]);

  // Keep track of history snapshots for undo/redo
  const saveToHistory = (newProjectState: VideoProject) => {
    const updatedHistory = history.slice(0, historyPointer + 1);
    updatedHistory.push(JSON.parse(JSON.stringify(newProjectState))); // Deep copy
    setHistory(updatedHistory);
    setHistoryPointer(updatedHistory.length - 1);
  };

  const updateProjectState = (newProj: VideoProject, recordHistory = true) => {
    // Automatically expand project duration to accommodate the end of the last clip
    let maxClipEnd = 0;
    newProj.tracks.forEach(t => {
      t.clips.forEach(c => {
        const end = c.start + c.duration;
        if (end > maxClipEnd) {
          maxClipEnd = end;
        }
      });
    });

    // Ensure project duration matches the end of the longest clip, unless user manually set a higher duration
    const baseDuration = (newProj as any).userDuration || 0;
    newProj.duration = Math.max(5, baseDuration, Math.ceil(maxClipEnd));

    setProject(newProj);
    if (recordHistory) {
      saveToHistory(newProj);
    }
    // Sync current selected clip reference if its values shifted
    if (selectedClip) {
      let found: Clip | null = null;
      newProj.tracks.forEach(t => {
        const c = t.clips.find(clip => clip.id === selectedClip.id);
        if (c) found = c;
      });
      setSelectedClip(found);
    }

    // Sync multi-selected clip IDs
    if (selectedClipIds.length > 0) {
      const allClipIds = new Set<string>();
      newProj.tracks.forEach(t => t.clips.forEach(c => allClipIds.add(c.id)));
      setSelectedClipIds(prev => prev.filter(id => allClipIds.has(id)));
    }
  };

  // Undo / Redo triggers
  const handleUndo = () => {
    if (historyPointer > 0) {
      const prevPointer = historyPointer - 1;
      setHistoryPointer(prevPointer);
      setProject(JSON.parse(JSON.stringify(history[prevPointer])));
    }
  };

  const handleRedo = () => {
    if (historyPointer < history.length - 1) {
      const nextPointer = historyPointer + 1;
      setHistoryPointer(nextPointer);
      setProject(JSON.parse(JSON.stringify(history[nextPointer])));
    }
  };

  // Setup initial history record on mount
  useEffect(() => {
    setHistory([JSON.parse(JSON.stringify(project))]);
    setHistoryPointer(0);
  }, []);

  // Event listener to support adding assets directly to the timeline via "+" trigger
  useEffect(() => {
    const handleAddClipEvent = (e: Event) => {
      const customEvent = e as CustomEvent<MediaAsset>;
      const asset = customEvent.detail;
      if (!asset) return;

      // Find matching track type
      const targetTrack = project.tracks.find(t => t.type === asset.type);
      if (!targetTrack) return;

      // Check overlaps
      const isOverlapping = targetTrack.clips.some(
        c => currentTime >= c.start && currentTime < c.start + c.duration
      );

      // Create new clip structure
      const clipId = `clip_${asset.id}_${Date.now()}`;
      let newClip: Clip;

      if (asset.type === 'video') {
        newClip = {
          id: clipId,
          name: asset.name,
          type: 'video',
          start: currentTime,
          duration: asset.duration && asset.duration !== Infinity ? asset.duration : 5,
          sourceDuration: asset.duration && asset.duration !== Infinity ? asset.duration : 5,
          sourceOffset: 0,
          url: asset.url,
          proceduralType: asset.proceduralType,
          filter: 'none',
          volume: 0.5,
          speed: 1,
          brightness: 100,
          contrast: 100,
          saturation: 100
        } as VideoClip;
      } else if (asset.type === 'image') {
        newClip = {
          id: clipId,
          name: asset.name,
          type: 'image',
          start: currentTime,
          duration: 5,
          sourceDuration: 5,
          sourceOffset: 0,
          url: asset.url,
          filter: 'none',
          brightness: 100,
          contrast: 100,
          saturation: 100
        } as ImageClip;
      } else if (asset.type === 'audio') {
        newClip = {
          id: clipId,
          name: asset.name,
          type: 'audio',
          start: currentTime,
          duration: asset.duration && asset.duration !== Infinity ? asset.duration : 10,
          sourceDuration: asset.duration && asset.duration !== Infinity ? asset.duration : 10,
          sourceOffset: 0,
          url: asset.url,
          synthType: asset.synthType,
          volume: 0.6,
          speed: 1
        } as AudioClip;
      } else if (asset.type === 'text') {
        newClip = {
          id: clipId,
          name: asset.name,
          type: 'text',
          start: currentTime,
          duration: asset.duration || 5,
          sourceDuration: asset.duration || 5,
          sourceOffset: 0,
          url: 'text',
          text: asset.text || 'Custom Subtitle Caption',
          fontFamily: asset.fontFamily || 'Inter',
          fontSize: asset.fontSize || 32,
          color: asset.color || '#ffffff',
          backgroundColor: asset.backgroundColor || 'transparent',
          alignment: asset.alignment || 'center',
          animation: asset.animation || 'none',
          positionY: asset.positionY ?? 50,
          stylePreset: asset.stylePreset || 'none'
        } as TextClip;
      } else {
        return;
      }

      const updatedTracks = project.tracks.map(t => {
        if (t.id === targetTrack.id) {
          return {
            ...t,
            clips: [...t.clips, newClip]
          };
        }
        return t;
      });

      const updatedProj = { ...project, tracks: updatedTracks };
      updateProjectState(updatedProj);
      setSelectedClip(newClip);
    };

    window.addEventListener('add-clip-to-timeline', handleAddClipEvent);
    return () => {
      window.removeEventListener('add-clip-to-timeline', handleAddClipEvent);
    };
  }, [project, currentTime]);

  // Asset Shelf Managers
  const handleAddAsset = (asset: MediaAsset) => {
    setAssets([...assets, asset]);
  };

  const handleDeleteAsset = (id: string) => {
    setAssets(assets.filter(a => a.id !== id));
  };

  // Timeline Action Handlers
  const handleUpdateTrackClips = (trackId: string, clips: Clip[]) => {
    const updatedTracks = project.tracks.map(t => {
      if (t.id === trackId) {
        return { ...t, clips };
      }
      return t;
    });
    updateProjectState({ ...project, tracks: updatedTracks });
  };

  // Split (Cut) tool implementation
  const handleSplitClip = (trackId: string, clipId: string, splitTime: number) => {
    const track = project.tracks.find(t => t.id === trackId);
    if (!track) return;

    const clip = track.clips.find(c => c.id === clipId);
    if (!clip) return;

    // Split clip into two components: A (left half) and B (right half)
    const durationA = splitTime - clip.start;
    const durationB = clip.duration - durationA;

    const clipA = {
      ...clip,
      id: `${clip.id}_splitA`,
      duration: durationA
    };

    const clipB = {
      ...clip,
      id: `${clip.id}_splitB`,
      start: splitTime,
      duration: durationB,
      sourceOffset: clip.sourceOffset + durationA
    };

    const updatedClips = track.clips
      .filter(c => c.id !== clipId)
      .concat([clipA, clipB])
      .sort((a, b) => a.start - b.start);

    handleUpdateTrackClips(trackId, updatedClips);
    setSelectedClip(clipB); // Maintain active selection on second half
  };

  // Delete all selected clips
  const handleDeleteSelectedClips = () => {
    const idsToDelete = selectedClipIds.length > 0 
      ? selectedClipIds 
      : (selectedClip ? [selectedClip.id] : []);

    if (idsToDelete.length === 0) return;

    const updatedTracks = project.tracks.map(t => {
      const remainingClips = t.clips.filter(c => !idsToDelete.includes(c.id));
      return { ...t, clips: remainingClips };
    });

    setSelectedClipIds([]);
    setSelectedClip(null);

    // Update state and record history
    updateProjectState({ ...project, tracks: updatedTracks });
  };

  // Copy selected clips to custom state clipboard
  const handleCopyClips = () => {
    const idsToCopy = selectedClipIds.length > 0 
      ? selectedClipIds 
      : (selectedClip ? [selectedClip.id] : []);

    if (idsToCopy.length === 0) return;

    const copied: Array<{ clip: Clip; originalTrackType: string }> = [];
    project.tracks.forEach(track => {
      track.clips.forEach(clip => {
        if (idsToCopy.includes(clip.id)) {
          copied.push({
            clip: JSON.parse(JSON.stringify(clip)),
            originalTrackType: track.type
          });
        }
      });
    });

    setCopiedClips(copied);
  };

  // Paste copied clips from custom state clipboard
  const handlePasteClips = () => {
    if (copiedClips.length === 0) return;

    const minCopiedStart = Math.min(...copiedClips.map(cc => cc.clip.start));
    const newTracks = project.tracks.map(t => ({ ...t, clips: [...t.clips] }));
    const newSelectedIds: string[] = [];
    let lastPasted: Clip | null = null;

    copiedClips.forEach(cc => {
      const relativeOffset = cc.clip.start - minCopiedStart;
      const targetStart = currentTime + relativeOffset;

      const pastedClip: Clip = {
        ...JSON.parse(JSON.stringify(cc.clip)),
        id: 'clip-' + Math.random().toString(36).substr(2, 9),
        start: targetStart
      };

      const targetTrack = newTracks.find(t => t.type === cc.originalTrackType);
      if (targetTrack) {
        targetTrack.clips.push(pastedClip);
        newSelectedIds.push(pastedClip.id);
        lastPasted = pastedClip;
      }
    });

    newTracks.forEach(t => {
      t.clips.sort((a, b) => a.start - b.start);
    });

    setSelectedClipIds(newSelectedIds);
    setSelectedClip(lastPasted);

    updateProjectState({ ...project, tracks: newTracks });
  };

  // Cut selected clips to custom state clipboard
  const handleCutClips = () => {
    const idsToCut = selectedClipIds.length > 0 
      ? selectedClipIds 
      : (selectedClip ? [selectedClip.id] : []);

    if (idsToCut.length === 0) return;

    // Copy phase
    const copied: Array<{ clip: Clip; originalTrackType: string }> = [];
    project.tracks.forEach(track => {
      track.clips.forEach(clip => {
        if (idsToCut.includes(clip.id)) {
          copied.push({
            clip: JSON.parse(JSON.stringify(clip)),
            originalTrackType: track.type
          });
        }
      });
    });
    setCopiedClips(copied);

    // Delete phase
    const updatedTracks = project.tracks.map(t => {
      const remainingClips = t.clips.filter(c => !idsToCut.includes(c.id));
      return { ...t, clips: remainingClips };
    });

    setSelectedClipIds([]);
    setSelectedClip(null);
    updateProjectState({ ...project, tracks: updatedTracks });
  };

  // Bind global professional keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.getAttribute('contenteditable') === 'true')) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteSelectedClips();
      } else if (isCtrl && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        handleCopyClips();
      } else if (isCtrl && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        handlePasteClips();
      } else if (isCtrl && (e.key === 'x' || e.key === 'X')) {
        e.preventDefault();
        handleCutClips();
      } else if (isCtrl && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        handleRedo();
      } else if (isCtrl && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        handleUndo();
      } else if (isCtrl && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const step = e.shiftKey ? 1.0 : 0.1;
        setCurrentTime(prev => Math.max(0, prev - step));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const step = e.shiftKey ? 1.0 : 0.1;
        // Support scrolling and key scrubbing into the empty overscroll workspace
        const maxLimit = Math.max(project.duration + 3600, 14400);
        setCurrentTime(prev => Math.min(maxLimit, prev + step));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setCurrentTime(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setCurrentTime(project.duration);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedClipIds, selectedClip, copiedClips, project, historyPointer, history, isPlaying, currentTime]);

  // Delete individual clip
  const handleDeleteClip = (trackId: string, clipId: string) => {
    const track = project.tracks.find(t => t.id === trackId);
    if (!track) return;

    const updatedClips = track.clips.filter(c => c.id !== clipId);
    handleUpdateTrackClips(trackId, updatedClips);
  };

  // Add dummy blank clip to a track
  const handleAddClipToTrack = (trackId: string, type: MediaType) => {
    const track = project.tracks.find(t => t.id === trackId);
    if (!track) return;

    const clipId = `clip_manual_${Date.now()}`;
    let newClip: Clip;

    if (type === 'video') {
      newClip = {
        id: clipId,
        name: 'Empty Procedural Gradient',
        type: 'video',
        start: currentTime,
        duration: 5,
        sourceDuration: 30,
        sourceOffset: 0,
        url: 'procedural',
        proceduralType: 'gradient',
        filter: 'none',
        volume: 0,
        speed: 1,
        brightness: 100,
        contrast: 100,
        saturation: 100
      } as VideoClip;
    } else if (type === 'text') {
      newClip = {
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
        backgroundColor: '#ec4899', // pink-500 box fill
        fontFamily: 'Inter',
        alignment: 'center',
        animation: 'fade',
        positionY: 50
      } as TextClip;
    } else {
      newClip = {
        id: clipId,
        name: 'New Synth Beat',
        type: 'audio',
        start: currentTime,
        duration: 10,
        sourceDuration: 60,
        sourceOffset: 0,
        url: 'synthesized',
        synthType: 'ambient',
        volume: 0.5,
        speed: 1
      } as AudioClip;
    }

    const updatedClips = [...track.clips, newClip].sort((a, b) => a.start - b.start);
    handleUpdateTrackClips(trackId, updatedClips);
    setSelectedClip(newClip);
  };

  // Mute track lane
  const handleToggleMuteTrack = (trackId: string) => {
    const updatedTracks = project.tracks.map(t => {
      if (t.id === trackId) {
        return { ...t, muted: !t.muted };
      }
      return t;
    });
    updateProjectState({ ...project, tracks: updatedTracks });
  };

  // Update details of selected active clip
  const handleUpdateClip = (updatedClip: Clip) => {
    let targetTrackId = '';
    project.tracks.forEach(t => {
      if (t.clips.some(c => c.id === updatedClip.id)) {
        targetTrackId = t.id;
      }
    });

    if (targetTrackId) {
      const track = project.tracks.find(t => t.id === targetTrackId)!;
      const updatedClips = track.clips.map(c => {
        if (c.id === updatedClip.id) return updatedClip;
        return c;
      });
      handleUpdateTrackClips(targetTrackId, updatedClips);
    }
  };

  // Import Gemini AI Script directly onto the active timeline tracks
  const handleImportScriptToTimeline = (script: AIScriptResponse) => {
    // Determine video tracks, subtitle tracks, and music tracks
    const videoClips: Clip[] = [];
    const textClips: Clip[] = [];
    const audioClips: Clip[] = [];

    let activeStartTime = 0;

    script.scenes.forEach((scene, index) => {
      const clipVidId = `ai_vid_${scene.id}_${index}`;
      const clipTextId = `ai_text_${scene.id}_${index}`;

      // 1. Create matching procedural visual scene clip
      videoClips.push({
        id: clipVidId,
        name: `${scene.title} (${scene.suggestedAssetType.toUpperCase()})`,
        type: 'video',
        start: activeStartTime,
        duration: scene.duration,
        sourceDuration: 30,
        sourceOffset: 0,
        url: 'procedural',
        proceduralType: scene.suggestedAssetType,
        filter: script.theme === 'neon' ? 'vhs' : script.theme === 'cosmic' ? 'cool' : 'none',
        volume: 0,
        speed: 1,
        brightness: 100,
        contrast: 100,
        saturation: 100
      } as VideoClip);

      // 2. Create overlay text subtitle clip
      textClips.push({
        id: clipTextId,
        name: `Subtitle ${index + 1}`,
        type: 'text',
        start: activeStartTime + 0.5, // slightly delay text entrance
        duration: Math.max(1, scene.duration - 1.0),
        sourceDuration: scene.duration,
        sourceOffset: 0,
        text: scene.overlayText,
        fontSize: 24,
        color: '#ffffff',
        backgroundColor: script.theme === 'neon' ? 'rgba(236,72,153,0.3)' : 'rgba(0,0,0,0.6)',
        fontFamily: script.theme === 'neon' ? 'Space Grotesk' : 'Inter',
        alignment: 'center',
        animation: 'slide',
        positionY: 75 // Lower third alignment
      } as TextClip);

      activeStartTime += scene.duration;
    });

    // 3. Create background sound synth loop
    audioClips.push({
      id: `ai_aud_${Date.now()}`,
      name: `${script.suggestedMusic.toUpperCase()} AI Soundtrack`,
      type: 'audio',
      start: 0,
      duration: activeStartTime,
      sourceDuration: 60,
      sourceOffset: 0,
      url: 'synthesized',
      synthType: script.suggestedMusic,
      volume: 0.45,
      speed: 1.0
    } as AudioClip);

    // Assembly tracks
    const updatedTracks: TimelineTrack[] = [
      {
        id: 'track_video_1',
        name: '🎬 Video',
        type: 'video',
        clips: videoClips,
        muted: false,
        locked: false
      },
      {
        id: 'track_overlay_1',
        name: '✨ Effects',
        type: 'text',
        clips: [],
        muted: false,
        locked: false
      },
      {
        id: 'track_text_1',
        name: '📝 Text',
        type: 'text',
        clips: textClips,
        muted: false,
        locked: false
      },
      {
        id: 'track_audio_1',
        name: '🎵 Audio',
        type: 'audio',
        clips: audioClips,
        muted: false,
        locked: false
      }
    ];

    const assembledProj: VideoProject = {
      id: `assembled_${Date.now()}`,
      name: script.title,
      tracks: updatedTracks,
      duration: activeStartTime,
      fps: 30,
      width: 1280,
      height: 720
    };

    updateProjectState(assembledProj);
    setCurrentTime(0);
    setIsPlaying(false);
    setSelectedClip(null);
  };

  const handleLoadTemplate = (type: 'gaming' | 'podcast' | 'shorts') => {
    let newProject: VideoProject;

    if (type === 'gaming') {
      newProject = {
        id: `template_gaming_${Date.now()}`,
        name: 'Retro Gaming Intro',
        duration: 12,
        fps: 30,
        width: 1280,
        height: 720,
        tracks: [
          {
            id: 'track_video_1',
            name: 'Video Background',
            type: 'video',
            clips: [
              {
                id: 'tpl_gam_vid1',
                name: 'Deep Starfield Voyage',
                type: 'video',
                start: 0,
                duration: 6,
                sourceDuration: 30,
                sourceOffset: 0,
                url: 'procedural',
                proceduralType: 'stars',
                filter: 'vhs',
                volume: 0,
                speed: 1,
                brightness: 110,
                contrast: 100,
                saturation: 120
              } as VideoClip,
              {
                id: 'tpl_gam_vid2',
                name: 'Psychedelic Plasma Flow',
                type: 'video',
                start: 6,
                duration: 6,
                sourceDuration: 30,
                sourceOffset: 0,
                url: 'procedural',
                proceduralType: 'plasma',
                filter: 'hue-rotate',
                volume: 0,
                speed: 1.2,
                brightness: 100,
                contrast: 110,
                saturation: 130
              } as VideoClip
            ],
            muted: false,
            locked: false
          },
          {
            id: 'track_text_1',
            name: 'Overlay Text',
            type: 'text',
            clips: [
              {
                id: 'tpl_gam_txt1',
                name: 'Main Glitch Title',
                type: 'text',
                start: 1.5,
                duration: 4.5,
                sourceDuration: 4.5,
                sourceOffset: 0,
                text: 'LEVEL UP!',
                fontSize: 38,
                color: '#ff5e00',
                backgroundColor: 'rgba(0,0,0,0.6)',
                fontFamily: 'Space Grotesk',
                alignment: 'center',
                animation: 'glitch',
                positionY: 45
              } as TextClip,
              {
                id: 'tpl_gam_txt2',
                name: 'Ready Subtitle',
                type: 'text',
                start: 6.5,
                duration: 4.5,
                sourceDuration: 4.5,
                sourceOffset: 0,
                text: 'READY PLAYER ONE',
                fontSize: 28,
                color: '#00ffcc',
                backgroundColor: 'transparent',
                fontFamily: 'JetBrains Mono',
                alignment: 'center',
                animation: 'zoom',
                positionY: 70
              } as TextClip
            ],
            muted: false,
            locked: false
          },
          {
            id: 'track_audio_1',
            name: 'Soundtrack',
            type: 'audio',
            clips: [
              {
                id: 'tpl_gam_aud1',
                name: 'Synth Techno Loop',
                type: 'audio',
                start: 0,
                duration: 12,
                sourceDuration: 60,
                sourceOffset: 0,
                url: 'synthesized',
                synthType: 'techno',
                volume: 0.4,
                speed: 1.0
              } as AudioClip
            ],
            muted: false,
            locked: false
          }
        ]
      };
    } else if (type === 'podcast') {
      newProject = {
        id: `template_podcast_${Date.now()}`,
        name: 'Creative Podcast Intro',
        duration: 18,
        fps: 30,
        width: 1280,
        height: 720,
        tracks: [
          {
            id: 'track_video_1',
            name: 'Video Background',
            type: 'video',
            clips: [
              {
                id: 'tpl_pod_vid1',
                name: 'Overlapping Sine Waves',
                type: 'video',
                start: 0,
                duration: 9,
                sourceDuration: 30,
                sourceOffset: 0,
                url: 'procedural',
                proceduralType: 'waves',
                filter: 'cool',
                volume: 0,
                speed: 1,
                brightness: 90,
                contrast: 100,
                saturation: 100
              } as VideoClip,
              {
                id: 'tpl_pod_vid2',
                name: 'Matrix Digital Rain',
                type: 'video',
                start: 9,
                duration: 9,
                sourceDuration: 30,
                sourceOffset: 0,
                url: 'procedural',
                proceduralType: 'matrix',
                filter: 'grayscale',
                volume: 0,
                speed: 1,
                brightness: 100,
                contrast: 100,
                saturation: 100
              } as VideoClip
            ],
            muted: false,
            locked: false
          },
          {
            id: 'track_text_1',
            name: 'Overlay Text',
            type: 'text',
            clips: [
              {
                id: 'tpl_pod_txt1',
                name: 'Podcast Name',
                type: 'text',
                start: 2,
                duration: 6,
                sourceDuration: 6,
                sourceOffset: 0,
                text: 'THE CREATIVE BRAIN',
                fontSize: 32,
                color: '#ffffff',
                backgroundColor: 'rgba(0,0,0,0.5)',
                fontFamily: 'Playfair Display',
                alignment: 'center',
                animation: 'fade',
                positionY: 45
              } as TextClip,
              {
                id: 'tpl_pod_txt2',
                name: 'Episode Number',
                type: 'text',
                start: 10,
                duration: 7,
                sourceDuration: 7,
                sourceOffset: 0,
                text: 'Episode 128: Future of AI',
                fontSize: 26,
                color: '#a7f3d0',
                backgroundColor: 'transparent',
                fontFamily: 'Inter',
                alignment: 'center',
                animation: 'slide',
                positionY: 75
              } as TextClip
            ],
            muted: false,
            locked: false
          },
          {
            id: 'track_audio_1',
            name: 'Soundtrack',
            type: 'audio',
            clips: [
              {
                id: 'tpl_pod_aud1',
                name: 'Lo-Fi Chill Beat',
                type: 'audio',
                start: 0,
                duration: 18,
                sourceDuration: 60,
                sourceOffset: 0,
                url: 'synthesized',
                synthType: 'lofi',
                volume: 0.35,
                speed: 1.0
              } as AudioClip
            ],
            muted: false,
            locked: false
          }
        ]
      };
    } else {
      newProject = {
        id: `template_shorts_${Date.now()}`,
        name: 'Viral Shorts Template',
        duration: 15,
        fps: 30,
        width: 405,
        height: 720,
        tracks: [
          {
            id: 'track_video_1',
            name: 'Video Background',
            type: 'video',
            clips: [
              {
                id: 'tpl_sho_vid1',
                name: 'Retro Sunset Grid',
                type: 'video',
                start: 0,
                duration: 7.5,
                sourceDuration: 30,
                sourceOffset: 0,
                url: 'procedural',
                proceduralType: 'grid',
                filter: 'warm',
                volume: 0,
                speed: 1,
                brightness: 110,
                contrast: 100,
                saturation: 120
              } as VideoClip,
              {
                id: 'tpl_sho_vid2',
                name: 'Deep Starfield Voyage',
                type: 'video',
                start: 7.5,
                duration: 7.5,
                sourceDuration: 30,
                sourceOffset: 0,
                url: 'procedural',
                proceduralType: 'stars',
                filter: 'cool',
                volume: 0,
                speed: 1,
                brightness: 100,
                contrast: 100,
                saturation: 100
              } as VideoClip
            ],
            muted: false,
            locked: false
          },
          {
            id: 'track_text_1',
            name: 'Overlay Text',
            type: 'text',
            clips: [
              {
                id: 'tpl_sho_txt1',
                name: 'Hook Title',
                type: 'text',
                start: 1,
                duration: 5.5,
                sourceDuration: 5.5,
                sourceOffset: 0,
                text: '3 LIFE HACKS YOU NEED',
                fontSize: 22,
                color: '#facc15',
                backgroundColor: 'rgba(0,0,0,0.7)',
                fontFamily: 'Space Grotesk',
                alignment: 'center',
                animation: 'glitch',
                positionY: 45
              } as TextClip,
              {
                id: 'tpl_sho_txt2',
                name: 'Retention Subtitle',
                type: 'text',
                start: 8,
                duration: 6,
                sourceDuration: 6,
                sourceOffset: 0,
                text: 'DONT SKIP THIS!',
                fontSize: 24,
                color: '#f87171',
                backgroundColor: 'rgba(0,0,0,0.7)',
                fontFamily: 'Space Grotesk',
                alignment: 'center',
                animation: 'zoom',
                positionY: 65
              } as TextClip
            ],
            muted: false,
            locked: false
          },
          {
            id: 'track_audio_1',
            name: 'Soundtrack',
            type: 'audio',
            clips: [
              {
                id: 'tpl_sho_aud1',
                name: 'Cinematic Ambient Beat',
                type: 'audio',
                start: 0,
                duration: 15,
                sourceDuration: 60,
                sourceOffset: 0,
                url: 'synthesized',
                synthType: 'ambient',
                volume: 0.45,
                speed: 1.0
              } as AudioClip
            ],
            muted: false,
            locked: false
          }
        ]
      };
    }

    updateProjectState(newProject);
    setCurrentTime(0);
    setIsPlaying(false);
    setSelectedClip(null);
  };

  return (
    <div id="video-editor-app" className="bg-[#0F0F10] text-slate-100 flex flex-col h-screen overflow-hidden font-sans">
      
      {/* VividCut-style Application Ribbon Header */}
      <header className="bg-[#121214] border-b border-[#242428] px-4 py-1.5 shrink-0 flex items-center justify-between z-30">
        {/* Left Side: VividCut Branding & Menu */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-400 via-[#00C4D0] to-indigo-500 flex items-center justify-center shadow-md shadow-cyan-950/20 transform hover:scale-105 transition-transform">
              <span className="text-[11px] font-black text-slate-900 tracking-tighter">VC</span>
            </div>
            <span className="text-sm font-black tracking-wider bg-gradient-to-r from-white via-slate-100 to-cyan-300 bg-clip-text text-transparent uppercase">VividCut</span>
          </div>
          
          <div className="relative">
            <button
              id="btn-app-menu"
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-1 px-2 py-1 bg-[#232326] hover:bg-[#2A2A2D] border border-[#2d2d34] text-xs font-semibold rounded text-slate-200 transition-colors cursor-pointer"
            >
              Menu
              <ChevronDown size={11} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
            </button>

            {menuOpen && (
              <div className="absolute left-0 mt-1.5 w-48 bg-[#1c1c22] border border-[#2d2d34] rounded-lg shadow-2xl py-1 z-40 animate-fadeIn">
                <button
                  id="menu-btn-reset"
                  onClick={() => {
                    setMenuOpen(false);
                    const conf = window.confirm('Are you sure you want to discard your edits and reset the timeline back to the default demo?');
                    if (conf) {
                      const initial = createInitialProject();
                      updateProjectState(initial);
                      setCurrentTime(0);
                      setSelectedClip(null);
                      setIsPlaying(false);
                    }
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-[#2A2A2D] transition-colors"
                >
                  Reset Demo Timeline
                </button>
                <button
                  id="menu-btn-clear"
                  onClick={() => {
                    setMenuOpen(false);
                    const conf = window.confirm('Are you sure you want to clear all timeline tracks and start completely from scratch?');
                    if (conf) {
                      const emptyProj: VideoProject = {
                        ...project,
                        tracks: project.tracks.map(t => ({ ...t, clips: [] }))
                      };
                      updateProjectState(emptyProj);
                      setCurrentTime(0);
                      setSelectedClip(null);
                      setIsPlaying(false);
                    }
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/20 transition-colors"
                >
                  Clear Slate Timeline
                </button>
              </div>
            )}
          </div>

          {/* Workspace Switcher Dropdown */}
          <div className="relative">
            <button
              id="btn-workspace-selector"
              onClick={() => {
                setWorkspaceOpen(!workspaceOpen);
                setMenuOpen(false);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-[#232326] hover:bg-[#2A2A2D] border border-[#2d2d34] text-xs font-semibold rounded text-indigo-300 hover:text-white transition-colors cursor-pointer"
              title="Switch Layout Preset"
            >
              <Sliders size={12} className="text-indigo-400" />
              <span>Workspace: {workspaces.find(w => w.id === currentWorkspaceId)?.name || 'Custom'}</span>
              <ChevronDown size={11} className={`transition-transform text-slate-400 ${workspaceOpen ? 'rotate-180' : ''}`} />
            </button>

            {workspaceOpen && (
              <div className="absolute left-0 mt-1.5 w-72 bg-[#1c1c22] border border-[#2d2d34] rounded-lg shadow-2xl py-2 z-40 animate-fadeIn text-xs">
                {/* Header Section */}
                <div className="px-3 pb-2 mb-1 border-b border-[#2d2d34] flex items-center justify-between">
                  <span className="font-extrabold text-[10px] tracking-wider text-slate-400 uppercase">Layout Presets</span>
                  <button 
                    onClick={handleResetAllToDefault}
                    className="text-[9px] text-indigo-400 hover:text-indigo-300 font-bold transition-colors"
                    title="Delete custom templates and reset defaults"
                  >
                    Reset All Defaults
                  </button>
                </div>

                {/* List of Presets */}
                <div className="max-h-56 overflow-y-auto space-y-0.5 px-1">
                  {workspaces.map(ws => {
                    const isActive = ws.id === currentWorkspaceId;
                    return (
                      <div 
                        key={ws.id}
                        onClick={() => handleSelectWorkspace(ws.id)}
                        className={`group w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left cursor-pointer transition-all ${
                          isActive 
                            ? 'bg-indigo-950/40 border border-indigo-850/50 text-indigo-300' 
                            : 'hover:bg-[#25252b] text-slate-300 hover:text-white'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="font-semibold">{ws.name}</span>
                          <span className="text-[9px] text-slate-500">
                            {ws.id === 'editing' && 'Standard balanced canvas'}
                            {ws.id === 'color' && 'Swapped: Inspector left, Media right'}
                            {ws.id === 'audio' && 'Enlarged multitrack workflow'}
                            {ws.id === 'minimal' && 'Cinematic monitor focus'}
                            {ws.id === 'media' && 'Enlarged asset library'}
                            {ws.isCustom && 'User custom layout'}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {isActive && <CheckCircle2 size={12} className="text-indigo-400" />}
                          {ws.isCustom && (
                            <button
                              onClick={(e) => handleDeleteCustomWorkspace(e, ws.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 rounded hover:bg-slate-800 transition-all"
                              title="Delete custom workspace"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Rearrange Control Section */}
                <div className="mt-2 pt-2 px-3 border-t border-[#2d2d34] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[9px] text-slate-400 uppercase">Interactive Rearrange</span>
                    <button 
                      onClick={handleSwapPanels}
                      className="px-2 py-0.5 bg-indigo-900/30 hover:bg-indigo-900/60 border border-indigo-700/30 hover:border-indigo-500/50 text-indigo-300 font-bold rounded text-[10px] transition-all flex items-center gap-1"
                    >
                      <RefreshCw size={10} />
                      Swap Columns
                    </button>
                  </div>

                  {/* Panel visibility overrides */}
                  <div className="grid grid-cols-3 gap-1 bg-[#121215] p-1.5 rounded border border-[#2d2d34]/60">
                    <button
                      onClick={() => togglePanelVisibility('media')}
                      className={`py-1 text-[9px] font-bold rounded transition-colors ${
                        leftWidth > 0 
                          ? 'bg-[#1e1e24] border border-[#3e3e48] text-indigo-300' 
                          : 'bg-transparent text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      Media
                    </button>
                    <button
                      onClick={() => togglePanelVisibility('properties')}
                      className={`py-1 text-[9px] font-bold rounded transition-colors ${
                        rightWidth > 0 
                          ? 'bg-[#1e1e24] border border-[#3e3e48] text-indigo-300' 
                          : 'bg-transparent text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      Inspector
                    </button>
                    <button
                      onClick={() => togglePanelVisibility('timeline')}
                      className={`py-1 text-[9px] font-bold rounded transition-colors ${
                        bottomHeight > 75 
                          ? 'bg-[#1e1e24] border border-[#3e3e48] text-indigo-300' 
                          : 'bg-transparent text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      Timeline
                    </button>
                  </div>
                </div>

                {/* Save Current Workspace form */}
                <div className="mt-2 pt-2 px-3 border-t border-[#2d2d34] space-y-1.5">
                  {!isSavingCustom ? (
                    <div className="flex items-center justify-between gap-1.5">
                      <button 
                        onClick={handleResetActiveWorkspace}
                        className="flex-1 text-center py-1 bg-transparent hover:bg-slate-800 text-[10px] font-semibold rounded text-slate-400 hover:text-white transition-colors"
                      >
                        Reset Layout Settings
                      </button>
                      <button 
                        onClick={() => setIsSavingCustom(true)}
                        className="flex-1 text-center py-1 bg-[#1c1c24] hover:bg-indigo-900/40 border border-indigo-900/40 hover:border-indigo-600/50 text-[10px] font-semibold rounded text-indigo-300 hover:text-indigo-200 transition-colors"
                      >
                        + Save Custom
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSaveWorkspace} className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="text"
                        placeholder="My Layout Name"
                        value={newWorkspaceName}
                        onChange={(e) => setNewWorkspaceName(e.target.value)}
                        className="w-full bg-[#121215] border border-[#2d2d34] rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500 font-semibold text-xs"
                        maxLength={24}
                        autoFocus
                      />
                      <div className="flex gap-1">
                        <button 
                          type="button"
                          onClick={() => {
                            setIsSavingCustom(false);
                            setNewWorkspaceName('');
                          }}
                          className="flex-1 py-1 text-[9px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                        >
                          Cancel
                        </button>
                        <button 
                          type="submit"
                          disabled={!newWorkspaceName.trim()}
                          className="flex-1 py-1 text-[9px] font-bold bg-[#00C4D0] hover:bg-[#00b0ba] text-black disabled:opacity-50 rounded"
                        >
                          Save
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>

          <span className="text-[10px] text-slate-400 font-medium hidden md:inline-block">
            {autoSavedTime}
          </span>
        </div>

        {/* Center: Interactive Project Name Renamer */}
        <div className="flex items-center gap-1 bg-[#0F0F10] border border-[#242428] rounded px-2.5 py-1">
          <input
            id="input-project-rename"
            type="text"
            value={project.name}
            onChange={(e) => updateProjectState({ ...project, name: e.target.value })}
            className="bg-transparent border-none text-center text-[11px] font-bold text-slate-200 focus:outline-none focus:ring-0 w-36 sm:w-56 truncate"
            title="Double-click to rename your project"
          />
        </div>

        {/* Right Side: Shortcut & VividCut Premium Export */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => alert('Keyboard Shortcuts:\n• Space: Play/Pause\n• Del/Backspace: Delete Selected Clip\n• Ctrl+Z: Undo\n• Ctrl+Y: Redo\n• Right/Left Arrow: Nudge time')}
            className="text-[10px] text-slate-400 font-semibold hover:text-slate-200 bg-[#232326] hover:bg-[#2A2A2D] border border-[#2d2d34] px-2.5 py-1 rounded hidden sm:inline-block"
          >
            Shortcut
          </button>
          
          <button
            id="btn-app-export"
            onClick={triggerExport}
            className="px-4 py-1.5 bg-[#00C4D0] hover:bg-[#00b0ba] text-black font-black text-xs rounded-md transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-cyan-950/20"
          >
            <Download size={13} strokeWidth={3} />
            Export
          </button>
        </div>
      </header>

      {/* Main Workspace Body Columns */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Column 1: Asset Shelf */}
        {leftWidth > 0 && (
          <MediaLibrary
            assets={assets}
            onAddAsset={handleAddAsset}
            onDeleteAsset={handleDeleteAsset}
            onImportScriptToTimeline={handleImportScriptToTimeline}
            selectedClip={selectedClip}
            onUpdateClip={handleUpdateClip}
            onLoadTemplate={handleLoadTemplate}
            width={leftWidth}
            isResizing={isResizingLeft}
            style={{ order: layoutOrders.mediaOrder }}
          />
        )}

        {/* Horizontal Divider 1 (Left panel resize handle) */}
        {leftWidth > 0 && (
          <div
            id="handle-left-resize"
            onMouseDown={handleLeftResizeStart}
            onDoubleClick={handleLeftResizeReset}
            className={`hidden md:flex w-1.5 hover:w-2 bg-[#202024] hover:bg-[#4F46E5]/90 border-r border-l border-[#2d2d34]/60 hover:border-[#4F46E5] cursor-col-resize select-none shrink-0 z-30 transition-all duration-150 items-center justify-center relative ${isResizingLeft ? '!w-2 !bg-[#4F46E5] !border-[#4F46E5]' : ''}`}
            title="Drag to resize Media Library, Double-click to reset"
            style={{ order: layoutOrders.leftHandleOrder }}
          >
            {/* Subtle dots representing grab handles */}
            <div className="flex flex-col gap-1 items-center justify-center pointer-events-none opacity-40">
              <div className="w-[3px] h-[3px] bg-slate-400 rounded-full" />
              <div className="w-[3px] h-[3px] bg-slate-400 rounded-full" />
              <div className="w-[3px] h-[3px] bg-slate-400 rounded-full" />
            </div>
          </div>
        )}

        {/* Column 2: Large Video Preview Monitor */}
        <PreviewPlayer
          project={project}
          currentTime={currentTime}
          onTimeUpdate={setCurrentTime}
          isPlaying={isPlaying}
          onPlayPause={setIsPlaying}
          selectedClip={selectedClip}
          style={{ order: layoutOrders.previewOrder }}
        />

        {/* Horizontal Divider 2 (Right panel resize handle) */}
        {rightWidth > 0 && selectedClip && (
          <div
            id="handle-right-resize"
            onMouseDown={handleRightResizeStart}
            onDoubleClick={handleRightResizeReset}
            className={`hidden md:flex w-1.5 hover:w-2 bg-[#202024] hover:bg-[#4F46E5]/90 border-r border-l border-[#2d2d34]/60 hover:border-[#4F46E5] cursor-col-resize select-none shrink-0 z-30 transition-all duration-150 items-center justify-center relative ${isResizingRight ? '!w-2 !bg-[#4F46E5] !border-[#4F46E5]' : ''}`}
            title="Drag to resize Inspector Panel, Double-click to reset"
            style={{ order: layoutOrders.rightHandleOrder }}
          >
            {/* Subtle dots representing grab handles */}
            <div className="flex flex-col gap-1 items-center justify-center pointer-events-none opacity-40">
              <div className="w-[3px] h-[3px] bg-slate-400 rounded-full" />
              <div className="w-[3px] h-[3px] bg-slate-400 rounded-full" />
              <div className="w-[3px] h-[3px] bg-slate-400 rounded-full" />
            </div>
          </div>
        )}

        {/* Column 3: Custom Clip Properties Inspector */}
        {rightWidth > 0 && (
          <PropertiesPanel
            selectedClip={selectedClip}
            onUpdateClip={handleUpdateClip}
            onDeleteClip={handleDeleteClip}
            project={project}
            onUpdateProject={updateProjectState}
            currentTime={currentTime}
            onSeek={setCurrentTime}
            width={selectedClip ? rightWidth : 40}
            isResizing={isResizingRight}
            style={{ order: layoutOrders.propertiesOrder }}
          />
        )}
      </div>

      {/* Vertical Divider 3 (Bottom panel/Timeline resize handle) */}
      <div
        id="handle-bottom-resize"
        onMouseDown={handleBottomResizeStart}
        onDoubleClick={handleBottomResizeReset}
        className={`h-1.5 hover:h-2 bg-[#202024] hover:bg-[#4F46E5]/90 border-t border-b border-[#2d2d34]/60 hover:border-[#4F46E5] cursor-row-resize select-none shrink-0 z-30 transition-all duration-150 flex items-center justify-center relative ${isResizingBottom ? '!h-2 !bg-[#4F46E5] !border-[#4F46E5]' : ''}`}
        title="Drag to resize Timeline, Double-click to reset"
      >
        {/* Subtle horizontal dots representing grab handles */}
        <div className="flex gap-1 items-center justify-center pointer-events-none opacity-40">
          <div className="w-[3px] h-[3px] bg-slate-400 rounded-full" />
          <div className="w-[3px] h-[3px] bg-slate-400 rounded-full" />
          <div className="w-[3px] h-[3px] bg-slate-400 rounded-full" />
        </div>
      </div>

      {/* Bottom Row: Interactive Multitrack Grid Timeline */}
      <Timeline
        project={project}
        currentTime={currentTime}
        onTimeUpdate={setCurrentTime}
        selectedClip={selectedClip}
        onSelectClip={setSelectedClip}
        selectedClipIds={selectedClipIds}
        onSelectClips={(ids, primary) => {
          setSelectedClipIds(ids);
          setSelectedClip(primary);
        }}
        onDeleteSelectedClips={handleDeleteSelectedClips}
        onCopyClips={handleCopyClips}
        onPasteClips={handlePasteClips}
        onUpdateTrackClips={handleUpdateTrackClips}
        onSplitClip={handleSplitClip}
        onDeleteClip={handleDeleteClip}
        onAddClipToTrack={handleAddClipToTrack}
        onToggleMuteTrack={handleToggleMuteTrack}
        onUpdateProject={updateProjectState}
        canUndo={historyPointer > 0}
        canRedo={historyPointer < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        height={bottomHeight}
        isResizing={isResizingBottom}
      />
    </div>
  );
}
