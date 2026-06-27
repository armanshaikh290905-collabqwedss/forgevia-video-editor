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
    name: 'Video Background',
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
    name: 'Overlay Text',
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
    name: 'Soundtrack',
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

  return {
    id: 'project_default',
    name: 'Cybernetic Voyage Trailer',
    tracks: [videoTrack, textTrack, audioTrack],
    duration: 30, // 30 seconds
    fps: 30,
    width: 1280,
    height: 720
  };
};

export default function App() {
  const [project, setProject] = useState<VideoProject>(createInitialProject);
  
  // Undo/Redo state stacks
  const [history, setHistory] = useState<VideoProject[]>([]);
  const [historyPointer, setHistoryPointer] = useState<number>(-1);

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null);

  // VividCut-style layout states
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [autoSavedTime, setAutoSavedTime] = useState<string>('Auto saved: 12:00:00');

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
          duration: Math.min(5, asset.duration), // Limit to 5s default size
          sourceDuration: asset.duration,
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
          duration: Math.min(10, asset.duration),
          sourceDuration: asset.duration,
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
        name: 'Video Background',
        type: 'video',
        clips: videoClips,
        muted: false,
        locked: false
      },
      {
        id: 'track_text_1',
        name: 'Overlay Text',
        type: 'text',
        clips: textClips,
        muted: false,
        locked: false
      },
      {
        id: 'track_audio_1',
        name: 'Soundtrack',
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
      <header className="bg-[#18181c] border-b border-[#28282e] px-4 py-2.5 shrink-0 flex items-center justify-between shadow z-30">
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

          <span className="text-[10px] text-slate-400 font-medium hidden md:inline-block">
            {autoSavedTime}
          </span>
        </div>

        {/* Center: Interactive Project Name Renamer */}
        <div className="flex items-center gap-1 bg-[#121214] border border-[#2d2d34] rounded px-3 py-1.5">
          <input
            id="input-project-rename"
            type="text"
            value={project.name}
            onChange={(e) => updateProjectState({ ...project, name: e.target.value })}
            className="bg-transparent border-none text-center text-xs font-bold text-slate-200 focus:outline-none focus:ring-0 w-36 sm:w-56 truncate"
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
        <MediaLibrary
          assets={assets}
          onAddAsset={handleAddAsset}
          onDeleteAsset={handleDeleteAsset}
          onImportScriptToTimeline={handleImportScriptToTimeline}
          selectedClip={selectedClip}
          onUpdateClip={handleUpdateClip}
          onLoadTemplate={handleLoadTemplate}
        />

        {/* Column 2: Large Video Preview Monitor */}
        <PreviewPlayer
          project={project}
          currentTime={currentTime}
          onTimeUpdate={setCurrentTime}
          isPlaying={isPlaying}
          onPlayPause={setIsPlaying}
          selectedClip={selectedClip}
        />

        {/* Column 3: Custom Clip Properties Inspector */}
        <PropertiesPanel
          selectedClip={selectedClip}
          onUpdateClip={handleUpdateClip}
          onDeleteClip={handleDeleteClip}
          project={project}
          onUpdateProject={updateProjectState}
          currentTime={currentTime}
          onSeek={setCurrentTime}
        />
      </div>

      {/* Bottom Row: Interactive Multitrack Grid Timeline */}
      <Timeline
        project={project}
        currentTime={currentTime}
        onTimeUpdate={setCurrentTime}
        selectedClip={selectedClip}
        onSelectClip={setSelectedClip}
        onUpdateTrackClips={handleUpdateTrackClips}
        onSplitClip={handleSplitClip}
        onDeleteClip={handleDeleteClip}
        onAddClipToTrack={handleAddClipToTrack}
        onToggleMuteTrack={handleToggleMuteTrack}
        canUndo={historyPointer > 0}
        canRedo={historyPointer < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />
    </div>
  );
}
