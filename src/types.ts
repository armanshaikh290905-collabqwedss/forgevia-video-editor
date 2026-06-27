export type MediaType = 'video' | 'image' | 'audio' | 'text';

export interface Keyframe {
  id: string;
  time: number; // relative time in seconds from clip start (0 to clip.duration)
  opacity?: number; // 0 to 1
  scale?: number; // 0.1 to 3
  positionX?: number; // -100 to 100 (percentage offset)
  positionY?: number; // -100 to 100 (percentage offset, or 0-100 for text)
  volume?: number; // 0 to 1 (volume level overlay)
}

export interface BaseClip {
  id: string;
  name: string;
  type: MediaType;
  start: number; // Start time in the timeline (seconds)
  duration: number; // Active duration of the clip (seconds)
  sourceDuration: number; // Total length of original media asset (seconds)
  sourceOffset: number; // Start offset within original media (seconds, for trimming)
  
  // Base Layout Properties
  opacity?: number; // default 1 (0 to 1)
  scale?: number; // default 1 (0.1 to 3)
  positionX?: number; // default 0 (-100 to 100)
  positionY?: number; // default 0 (-100 to 100, except for TextClip which can use 0-100)

  // Keyframe Animations
  keyframes?: Keyframe[];

  // Transitions
  fadeInDuration?: number; // duration in seconds
  fadeInType?: 'fade' | 'slide-left' | 'slide-right' | 'zoom' | 'none';
  fadeOutDuration?: number; // duration in seconds
  fadeOutType?: 'fade' | 'slide-left' | 'slide-right' | 'zoom' | 'none';
  
  // Cross-clip transitions (between consecutive clips)
  transitionType?: 'none' | 'fade' | 'slide' | 'wipe' | 'dissolve';
  transitionDuration?: number; // duration in seconds

  // Creative Effects
  effectVignette?: boolean;
  effectFilmGrain?: boolean;
  effectScanlines?: boolean;
  effectGlitch?: boolean;
  effectMirror?: boolean;

  // Professional Keying & Background Removal
  chromaKeyEnabled?: boolean;
  chromaKeyColor?: string; // hex string, default '#00ff00'
  chromaKeySimilarity?: number; // threshold 0 to 100
  chromaKeySmoothness?: number; // edge roll-off / feathering

  lumaKeyEnabled?: boolean;
  lumaKeyType?: 'black' | 'white';
  lumaKeyThreshold?: number; // threshold 0 to 100
}

export interface VideoClip extends BaseClip {
  type: 'video';
  url: string; // HTTP URL, Blob URL, or 'procedural'
  proceduralType?: 'grid' | 'stars' | 'plasma' | 'gradient' | 'waves' | 'matrix';
  proceduralParams?: {
    speed?: number;
    color1?: string;
    color2?: string;
    density?: number;
  };
  filter: 'none' | 'grayscale' | 'sepia' | 'invert' | 'warm' | 'cool' | 'vhs' | 'blur' | 'hue-rotate';
  volume: number; // 0 to 1
  speed: number; // Playback speed (0.5 to 2.0)
  brightness: number; // Percentage (e.g. 100)
  contrast: number; // Percentage (e.g. 100)
  saturation: number; // Percentage (e.g. 100)
}

export interface ImageClip extends BaseClip {
  type: 'image';
  url: string;
  filter: 'none' | 'grayscale' | 'sepia' | 'invert' | 'warm' | 'cool' | 'blur' | 'hue-rotate';
  brightness: number;
  contrast: number;
  saturation: number;
}

export interface AudioClip extends BaseClip {
  type: 'audio';
  url: string; // HTTP URL, Blob URL, or 'synthesized'
  synthType?: 'lofi' | 'techno' | 'ambient' | 'none';
  volume: number; // 0 to 1
  speed: number; // Playback speed multiplier
}

export interface TextClip extends BaseClip {
  type: 'text';
  text: string;
  fontSize: number; // in pixels
  color: string;
  backgroundColor: string; // background of text box
  fontFamily: string; // 'Inter' | 'Space Grotesk' | 'Playfair Display' | 'JetBrains Mono'
  alignment: 'left' | 'center' | 'right';
  animation: 'none' | 'fade' | 'slide' | 'zoom' | 'glitch';
  positionY: number; // Percent from top (e.g., 50 is center)
  stylePreset?: 'none' | 'neon' | 'cyber' | 'vintage' | 'subtitles';
}

export type Clip = VideoClip | ImageClip | AudioClip | TextClip;

export interface TimelineTrack {
  id: string;
  name: string;
  type: MediaType;
  clips: Clip[];
  muted: boolean;
  locked: boolean;
  height?: number;
}

export interface VideoProject {
  id: string;
  name: string;
  tracks: TimelineTrack[];
  duration: number; // Total timeline limit in seconds
  fps: number; // frames per second
  width: number; // video render width
  height: number; // video render height
}

export interface MediaAsset {
  id: string;
  name: string;
  type: MediaType;
  url: string;
  duration: number; // in seconds (for video/audio)
  proceduralType?: 'grid' | 'stars' | 'plasma' | 'gradient' | 'waves' | 'matrix';
  synthType?: 'lofi' | 'techno' | 'ambient';
  thumbnailUrl?: string;
  text?: string;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
  fontFamily?: string;
  alignment?: 'left' | 'center' | 'right';
  animation?: 'none' | 'fade' | 'slide' | 'zoom' | 'glitch';
  positionY?: number;
  stylePreset?: 'none' | 'neon' | 'cyber' | 'vintage' | 'subtitles';
}

export interface AIScriptScene {
  id: string;
  title: string;
  timeStart: number;
  duration: number;
  description: string;
  overlayText: string;
  suggestedAssetType: 'cyberpunk' | 'space' | 'plasma' | 'gradient' | 'nature' | 'retro';
}

export interface AIScriptResponse {
  title: string;
  overview: string;
  theme: 'neon' | 'cosmic' | 'dreamy' | 'ambient';
  suggestedMusic: 'lofi' | 'techno' | 'ambient';
  scenes: AIScriptScene[];
}
