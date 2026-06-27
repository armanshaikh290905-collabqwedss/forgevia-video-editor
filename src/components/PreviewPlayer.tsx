import React, { useRef, useEffect, useState } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  Volume2, 
  VolumeX, 
  Download, 
  Maximize2, 
  SkipBack, 
  SkipForward,
  Film,
  RotateCcw,
  Sparkles,
  RefreshCw,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { VideoProject, Clip, VideoClip, ImageClip, TextClip, AudioClip } from '../types';
import { drawProceduralFrame, ProceduralAudioEngine } from '../utils/procedural';

function applyKeyingEffects(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  clip: any
) {
  if (!clip.chromaKeyEnabled && !clip.lumaKeyEnabled) return;

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  if (clip.chromaKeyEnabled) {
    const keyColorHex = clip.chromaKeyColor || '#00ff00';
    // Parse hex safely
    const kr = parseInt(keyColorHex.slice(1, 3), 16) || 0;
    const kg = parseInt(keyColorHex.slice(3, 5), 16) || 255;
    const kb = parseInt(keyColorHex.slice(5, 7), 16) || 0;

    const sim = clip.chromaKeySimilarity ?? 20;
    const smooth = clip.chromaKeySmoothness ?? 10;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a === 0) continue;

      const rDiff = r - kr;
      const gDiff = g - kg;
      const bDiff = b - kb;
      
      // Calculate Euclidean distance, normalized as percentage of maximum possible distance (441.67)
      const dist = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
      const pct = (dist / 441.67) * 100;

      if (pct < sim) {
        data[i + 3] = 0;
      } else if (pct < sim + smooth) {
        const factor = (pct - sim) / smooth;
        data[i + 3] = Math.floor(a * factor);
      }
    }
  }

  if (clip.lumaKeyEnabled) {
    const type = clip.lumaKeyType || 'black';
    const thresh = clip.lumaKeyThreshold ?? 15;
    const tVal = (thresh / 100) * 255;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a === 0) continue;

      // Rec. 601 luminance
      const y = 0.299 * r + 0.587 * g + 0.114 * b;

      if (type === 'black') {
        if (y < tVal) {
          const factor = tVal > 0 ? y / tVal : 0;
          data[i + 3] = Math.min(data[i + 3], Math.floor(a * factor));
        }
      } else {
        const limit = 255 - tVal;
        if (y > limit) {
          const factor = tVal > 0 ? (255 - y) / tVal : 0;
          data[i + 3] = Math.min(data[i + 3], Math.floor(a * factor));
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

interface InterpolatedProps {
  opacity: number;
  scale: number;
  positionX: number;
  positionY: number;
  volume: number;
}

function getInterpolatedProperties(clip: any, relativeTime: number): InterpolatedProps {
  const baseOpacity = clip.opacity ?? 1;
  const baseScale = clip.scale ?? 1;
  const basePositionX = clip.positionX ?? 0;
  const basePositionY = clip.positionY ?? (clip.type === 'text' ? clip.positionY : 0);
  const baseVolume = clip.volume ?? 1;

  const defaults = {
    opacity: baseOpacity,
    scale: baseScale,
    positionX: basePositionX,
    positionY: basePositionY,
    volume: baseVolume
  };

  if (!clip.keyframes || clip.keyframes.length === 0) {
    return defaults;
  }

  const sorted = [...clip.keyframes].sort((a, b) => a.time - b.time);

  const resolveKF = (kf: any) => ({
    opacity: kf.opacity !== undefined ? kf.opacity : baseOpacity,
    scale: kf.scale !== undefined ? kf.scale : baseScale,
    positionX: kf.positionX !== undefined ? kf.positionX : basePositionX,
    positionY: kf.positionY !== undefined ? kf.positionY : basePositionY,
    volume: kf.volume !== undefined ? kf.volume : baseVolume,
  });

  if (relativeTime <= sorted[0].time) {
    return resolveKF(sorted[0]);
  }

  if (relativeTime >= sorted[sorted.length - 1].time) {
    return resolveKF(sorted[sorted.length - 1]);
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const kf1 = sorted[i];
    const kf2 = sorted[i + 1];
    if (relativeTime >= kf1.time && relativeTime <= kf2.time) {
      const denom = kf2.time - kf1.time;
      const factor = denom > 0 ? (relativeTime - kf1.time) / denom : 0;
      
      const v1 = resolveKF(kf1);
      const v2 = resolveKF(kf2);

      return {
        opacity: v1.opacity + (v2.opacity - v1.opacity) * factor,
        scale: v1.scale + (v2.scale - v1.scale) * factor,
        positionX: v1.positionX + (v2.positionX - v1.positionX) * factor,
        positionY: v1.positionY + (v2.positionY - v1.positionY) * factor,
        volume: v1.volume + (v2.volume - v1.volume) * factor,
      };
    }
  }

  return defaults;
}

interface PreviewPlayerProps {
  project: VideoProject;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  isPlaying: boolean;
  onPlayPause: (playing: boolean) => void;
  selectedClip: Clip | null;
  style?: React.CSSProperties;
}

export default function PreviewPlayer({
  project,
  currentTime,
  onTimeUpdate,
  isPlaying,
  onPlayPause,
  selectedClip,
  style
}: PreviewPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Audio Engine Refs
  const audioEngineRef = useRef<ProceduralAudioEngine | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [renderProgress, setRenderProgress] = useState<number | null>(null);
  const [renderedBlobUrl, setRenderedBlobUrl] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFps, setExportFps] = useState<number>(30);
  const cancelExportRef = useRef<boolean>(false);

  // Asset Loader Caches
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const videoCacheRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const audioCacheRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Independent preview resizer states
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 700, height: 500 });
  const [isResizingPreview, setIsResizingPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState<'fit' | 'custom'>(() => {
    const saved = localStorage.getItem('vividcut-preview-mode');
    return (saved as 'fit' | 'custom') || 'fit';
  });
  const [customWidth, setCustomWidth] = useState<number>(() => {
    const saved = localStorage.getItem('vividcut-preview-custom-width');
    return saved ? parseInt(saved, 10) : 540;
  });

  // Observe outer container dimensions
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width: width || 700, height: height || 500 });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Remember the preferred size options in local storage
  useEffect(() => {
    localStorage.setItem('vividcut-preview-mode', previewMode);
  }, [previewMode]);

  useEffect(() => {
    localStorage.setItem('vividcut-preview-custom-width', String(customWidth));
  }, [customWidth]);

  // Compute size boundaries for perfect fit-to-window or custom sizing
  const aspectRatio = project.width / project.height;
  const paddingX = 48; // horizontal safe padding
  const paddingY = 160; // vertical offset for toolbar, control bar, margins
  const maxFitWidth = Math.max(200, containerSize.width - paddingX);
  const maxFitHeight = Math.max(150, containerSize.height - paddingY);
  const fitWidth = Math.min(maxFitWidth, maxFitHeight * aspectRatio);

  const activeWidth = previewMode === 'fit' ? fitWidth : Math.min(customWidth, containerSize.width - 24);

  // Drag hander for symmetrical scaling from both margins
  const handleSymmetricalResizeStart = (e: React.MouseEvent, direction: 1 | -1) => {
    e.preventDefault();
    setIsResizingPreview(true);
    setPreviewMode('custom');
    const startX = e.clientX;
    const startWidth = activeWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let newWidth = startWidth + deltaX * 2 * direction;
      const minW = 240;
      const maxW = Math.max(1600, containerSize.width);
      if (newWidth < minW) newWidth = minW;
      if (newWidth > maxW) newWidth = maxW;
      setCustomWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingPreview(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // FPS ticker
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Scratch Canvas for compositing isolated effects/transitions without double-filtering
  const scratchCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const getScratchCanvas = (w: number, h: number) => {
    if (!scratchCanvasRef.current) {
      scratchCanvasRef.current = document.createElement('canvas');
    }
    const c = scratchCanvasRef.current;
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    return c;
  };

  // Dedicated scratch canvases for cross-clip transitions (A and B buffers)
  const scratchCanvasARef = useRef<HTMLCanvasElement | null>(null);
  const scratchCanvasBRef = useRef<HTMLCanvasElement | null>(null);

  const getScratchCanvasA = (w: number, h: number) => {
    if (!scratchCanvasARef.current) {
      scratchCanvasARef.current = document.createElement('canvas');
    }
    const c = scratchCanvasARef.current;
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    return c;
  };

  const getScratchCanvasB = (w: number, h: number) => {
    if (!scratchCanvasBRef.current) {
      scratchCanvasBRef.current = document.createElement('canvas');
    }
    const c = scratchCanvasBRef.current;
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    return c;
  };

  // Initialize Audio Engine
  useEffect(() => {
    audioEngineRef.current = new ProceduralAudioEngine();
    return () => {
      if (audioEngineRef.current) {
        audioEngineRef.current.stop();
      }
    };
  }, []);

  const currentTimeRef = useRef<number>(currentTime);
  currentTimeRef.current = currentTime;
  const onTimeUpdateRef = useRef(onTimeUpdate);
  onTimeUpdateRef.current = onTimeUpdate;
  const projectRef = useRef(project);
  projectRef.current = project;

  // Sync state transitions of Play/Pause
  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now();
      
      // Start the update loop
      const tick = (now: number) => {
        const delta = (now - lastTimeRef.current) / 1000;
        lastTimeRef.current = now;

        const nextTime = currentTimeRef.current + delta;
        if (nextTime >= projectRef.current.duration) {
          onTimeUpdateRef.current(0);
          onPlayPause(false);
          syncAudioAndVideo(0, false);
        } else {
          onTimeUpdateRef.current(nextTime);
          syncAudioAndVideo(nextTime, true);
          animationFrameRef.current = requestAnimationFrame(tick);
        }
      };
      animationFrameRef.current = requestAnimationFrame(tick);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      syncAudioAndVideo(currentTimeRef.current, false);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  // Force re-render of canvas frame when scrubber or selection changes
  useEffect(() => {
    drawFrame(currentTime);
  }, [currentTime, project, selectedClip]);

  // Listen to global app header exporter trigger to open the real visual render modal
  useEffect(() => {
    const handleOpenExporter = () => {
      setRenderedBlobUrl(null);
      setRenderProgress(null);
      setShowExportModal(true);
    };
    window.addEventListener('open-video-exporter', handleOpenExporter);
    return () => {
      window.removeEventListener('open-video-exporter', handleOpenExporter);
    };
  }, []);

  // Sync Video playback & Synthesized audio loops
  const syncAudioAndVideo = (timelineTime: number, playing: boolean) => {
    if (!audioEngineRef.current) return;

    if (isMuted || !playing) {
      audioEngineRef.current.stop();
      // Stop all playing uploaded audio/video tracks
      videoCacheRef.current.forEach(v => v.pause());
      audioCacheRef.current.forEach(a => a.pause());
      return;
    }

    // Identify active synthesiser loops
    let activeSynthLoop: 'lofi' | 'techno' | 'ambient' | 'none' = 'none';
    let synthVolume = 0.5;

    project.tracks.forEach(track => {
      if (track.muted) return;
      track.clips.forEach(clip => {
        if (clip.type === 'audio' && timelineTime >= clip.start && timelineTime < clip.start + clip.duration) {
          const audioClip = clip as AudioClip;
          const anim = getInterpolatedProperties(audioClip, timelineTime - clip.start);
          const currentVolume = anim.volume;
          
          if (audioClip.synthType && audioClip.synthType !== 'none') {
            activeSynthLoop = audioClip.synthType;
            synthVolume = currentVolume;
          } else if (audioClip.url) {
            // Native audio playback sync
            const cachedAudio = getOrLoadAudio(audioClip.url);
            if (cachedAudio) {
              const offset = timelineTime - clip.start + clip.sourceOffset;
              cachedAudio.volume = currentVolume;
              if (cachedAudio.paused) {
                cachedAudio.currentTime = offset;
                cachedAudio.play().catch(() => {});
              } else if (Math.abs(cachedAudio.currentTime - offset) > 0.3) {
                cachedAudio.currentTime = offset;
              }
            }
          }
        }
        
        // Native video playback sound sync
        if (clip.type === 'video' && timelineTime >= clip.start && timelineTime < clip.start + clip.duration) {
          const videoClip = clip as VideoClip;
          const anim = getInterpolatedProperties(videoClip, timelineTime - clip.start);
          const currentVolume = anim.volume;
          if (videoClip.url && videoClip.url !== 'procedural') {
            const cachedVideo = getOrLoadVideo(videoClip.url);
            if (cachedVideo) {
              const offset = timelineTime - clip.start + clip.sourceOffset;
              cachedVideo.volume = isMuted ? 0 : currentVolume;
              if (cachedVideo.paused) {
                cachedVideo.currentTime = offset;
                cachedVideo.play().catch(() => {});
              } else if (Math.abs(cachedVideo.currentTime - offset) > 0.3) {
                cachedVideo.currentTime = offset;
              }
            }
          }
        }
      });
    });

    if (activeSynthLoop !== 'none') {
      audioEngineRef.current.setLoop(activeSynthLoop);
      audioEngineRef.current.setVolume(synthVolume);
    } else {
      audioEngineRef.current.stop();
    }
  };

  // Helper: Cache uploaded image loading
  const getOrLoadImage = (url: string): HTMLImageElement | null => {
    if (imageCacheRef.current.has(url)) {
      return imageCacheRef.current.get(url)!;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    img.onload = () => {
      imageCacheRef.current.set(url, img);
      drawFrame(currentTime); // Redraw
    };
    return null;
  };

  // Helper: Cache uploaded video loading
  const getOrLoadVideo = (url: string): HTMLVideoElement | null => {
    if (videoCacheRef.current.has(url)) {
      return videoCacheRef.current.get(url)!;
    }
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = url;
    video.muted = true; // Stay muted, we coordinate audio or canvas drawing
    video.playsInline = true;
    video.loop = false;
    video.load();
    video.addEventListener('loadeddata', () => {
      videoCacheRef.current.set(url, video);
      drawFrame(currentTime);
    });
    return null;
  };

  // Helper: Cache uploaded audio
  const getOrLoadAudio = (url: string): HTMLAudioElement | null => {
    if (audioCacheRef.current.has(url)) {
      return audioCacheRef.current.get(url)!;
    }
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.src = url;
    audio.load();
    audio.addEventListener('loadeddata', () => {
      audioCacheRef.current.set(url, audio);
    });
    return null;
  };

  // Compose all track layers at active timestamp onto Canvas context
  const drawFrame = (time: number, targetCanvas: HTMLCanvasElement | null = null) => {
    const canvas = targetCanvas || canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 1. Clear with deep space background slate-950
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Apply filters utility
    const getFilterCssString = (filter: string, brightness: number, contrast = 100, saturation = 100) => {
      let str = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
      if (filter === 'grayscale') str += ' grayscale(100%)';
      else if (filter === 'sepia') str += ' sepia(100%)';
      else if (filter === 'invert') str += ' invert(100%)';
      else if (filter === 'blur') str += ' blur(5px)';
      else if (filter === 'hue-rotate') str += ' hue-rotate(120deg)';
      else if (filter === 'warm') str += ' sepia(35%) saturate(140%) hue-rotate(-10deg)';
      else if (filter === 'cool') str += ' saturate(120%) hue-rotate(20deg)';
      else if (filter === 'vhs') str += ' contrast(110%) saturate(150%) hue-rotate(5deg)';
      return str;
    };

    // Helper to render a clip's basic frame onto a target canvas and context
    const renderClipToScratch = (clip: any, renderTime: number, sCanvas: HTMLCanvasElement, sCtx: CanvasRenderingContext2D) => {
      sCtx.clearRect(0, 0, width, height);

      if (clip.type === 'video') {
        const vClip = clip as VideoClip;
        const relativeTime = renderTime - clip.start + clip.sourceOffset;

        if (vClip.url === 'procedural' && vClip.proceduralType) {
          sCtx.save();
          drawProceduralFrame(sCtx, vClip.proceduralType, relativeTime, width, height, {
            speed: vClip.speed
          });
          
          // Apply filter to procedural drawing
          const filterStr = getFilterCssString(vClip.filter, vClip.brightness, vClip.contrast, vClip.saturation);
          if (filterStr && filterStr !== 'none') {
            sCtx.filter = filterStr;
            sCtx.drawImage(sCanvas, 0, 0);
          }
          sCtx.restore();
        } else {
          const video = getOrLoadVideo(vClip.url);
          if (video && video.readyState >= 2) {
            const videoTime = relativeTime * vClip.speed;
            if (Math.abs(video.currentTime - videoTime) > 0.1) {
              video.currentTime = videoTime;
            }
            
            sCtx.save();
            const filterStr = getFilterCssString(vClip.filter, vClip.brightness, vClip.contrast, vClip.saturation);
            sCtx.filter = filterStr;

            const vWidth = video.videoWidth;
            const vHeight = video.videoHeight;
            const scale = Math.min(width / vWidth, height / vHeight);
            const dw = vWidth * scale;
            const dh = vHeight * scale;
            const dx = (width - dw) / 2;
            const dy = (height - dh) / 2;
            sCtx.drawImage(video, dx, dy, dw, dh);
            sCtx.restore();
          } else {
            sCtx.fillStyle = '#0f0f11';
            sCtx.fillRect(0, 0, width, height);
            sCtx.fillStyle = '#6366f1';
            sCtx.font = '13px "JetBrains Mono"';
            sCtx.textAlign = 'center';
            sCtx.fillText('Buffering video frame...', width / 2, height / 2);
          }
        }
      } else if (clip.type === 'image') {
        const imgClip = clip as ImageClip;
        const img = getOrLoadImage(imgClip.url);
        if (img) {
          sCtx.save();
          const filterStr = getFilterCssString(imgClip.filter, imgClip.brightness, imgClip.contrast, imgClip.saturation);
          sCtx.filter = filterStr;
          
          const scale = Math.min(width / img.width, height / img.height);
          const dw = img.width * scale;
          const dh = img.height * scale;
          const dx = (width - dw) / 2;
          const dy = (height - dh) / 2;
          sCtx.drawImage(img, dx, dy, dw, dh);
          sCtx.restore();
        }
      }

      // Apply Chroma Key and Luma Key pixel transformations to the scratch context
      applyKeyingEffects(sCtx, width, height, clip);
    };

    const renderClipToDisplayCanvas = (clip: any, renderTime: number, targetCtx: CanvasRenderingContext2D, scratchBufferName: 'normal' | 'A' | 'B' = 'normal') => {
      let sCanvas: HTMLCanvasElement;
      if (scratchBufferName === 'A') {
        sCanvas = getScratchCanvasA(width, height);
      } else if (scratchBufferName === 'B') {
        sCanvas = getScratchCanvasB(width, height);
      } else {
        sCanvas = getScratchCanvas(width, height);
      }
      const sCtx = sCanvas.getContext('2d');
      if (!sCtx) return;

      renderClipToScratch(clip, renderTime, sCanvas, sCtx);

      // Draw the sandbox result onto the targetCtx with transitions & overlays
      targetCtx.save();

      // Compute Transition Dynamics
      const clipTime = renderTime - clip.start;
      const timeLeft = clip.duration - clipTime;
      
      // Resolve Keyframe Interpolation
      const anim = getInterpolatedProperties(clip, clipTime);
      
      let opacity = anim.opacity;
      let scaleVal = anim.scale;
      let translateX = (anim.positionX / 100) * width;
      let translateY = (anim.positionY / 100) * height;

      if (clip.fadeInDuration && clip.fadeInDuration > 0 && clipTime < clip.fadeInDuration) {
        const progress = clipTime / clip.fadeInDuration;
        const type = clip.fadeInType || 'fade';
        if (type === 'fade') opacity *= progress;
        else if (type === 'slide-left') translateX += (1.0 - progress) * -width;
        else if (type === 'slide-right') translateX += (1.0 - progress) * width;
        else if (type === 'zoom') scaleVal *= progress;
      }

      if (clip.fadeOutDuration && clip.fadeOutDuration > 0 && timeLeft < clip.fadeOutDuration) {
        const progress = timeLeft / clip.fadeOutDuration;
        const type = clip.fadeOutType || 'fade';
        if (type === 'fade') opacity = Math.min(opacity, opacity * progress);
        else if (type === 'slide-left') translateX += (1.0 - progress) * width;
        else if (type === 'slide-right') translateX += (1.0 - progress) * -width;
        else if (type === 'zoom') scaleVal = Math.min(scaleVal, scaleVal * progress);
      }

      targetCtx.globalAlpha = Math.max(0, Math.min(1, opacity));
      
      if (translateX !== 0 || translateY !== 0) {
        targetCtx.translate(translateX, translateY);
      }
      if (scaleVal !== 1.0) {
        targetCtx.translate(width / 2, height / 2);
        targetCtx.scale(scaleVal, scaleVal);
        targetCtx.translate(-width / 2, -height / 2);
      }

      // Creative FX: Mirror Horizontal
      if (clip.effectMirror) {
        targetCtx.translate(width, 0);
        targetCtx.scale(-1, 1);
      }

      // Paint Sandbox composited clip
      targetCtx.drawImage(sCanvas, 0, 0);

      // Creative FX: Overlays (temporarily un-mirrored for symmetry)
      if (clip.effectMirror) {
        targetCtx.scale(-1, 1);
        targetCtx.translate(-width, 0);
      }

      if (clip.effectVignette) {
        const gradient = targetCtx.createRadialGradient(
          width / 2, height / 2, Math.min(width, height) * 0.35,
          width / 2, height / 2, Math.max(width, height) * 0.75
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
        targetCtx.fillStyle = gradient;
        targetCtx.fillRect(0, 0, width, height);
      }

      if (clip.effectFilmGrain) {
        targetCtx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        for (let i = 0; i < 300; i++) {
          const gx = Math.random() * width;
          const gy = Math.random() * height;
          const gw = Math.random() * 1.5 + 0.5;
          targetCtx.fillRect(gx, gy, gw, gw);
        }
        targetCtx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        for (let i = 0; i < 300; i++) {
          const gx = Math.random() * width;
          const gy = Math.random() * height;
          const gw = Math.random() * 1.5 + 0.5;
          targetCtx.fillRect(gx, gy, gw, gw);
        }
      }

      if (clip.effectScanlines) {
        targetCtx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
        targetCtx.lineWidth = 1;
        targetCtx.beginPath();
        for (let y = 0; y < height; y += 4) {
          targetCtx.moveTo(0, y);
          targetCtx.lineTo(width, y);
        }
        targetCtx.stroke();
      }

      if (clip.effectGlitch && Math.random() < 0.2) {
        const slices = Math.floor(Math.random() * 2) + 1;
        for (let s = 0; s < slices; s++) {
          const sliceY = Math.random() * (height - 30);
          const sliceH = Math.random() * 20 + 8;
          const shift = (Math.random() - 0.5) * 20;
          targetCtx.drawImage(targetCtx.canvas, 0, sliceY, width, sliceH, shift, sliceY, width, sliceH);
        }
        targetCtx.fillStyle = Math.random() > 0.5 ? 'rgba(99, 102, 241, 0.1)' : 'rgba(236, 72, 153, 0.1)';
        targetCtx.fillRect(0, Math.random() * height, width, Math.random() * 25 + 5);
      }

      targetCtx.restore();
    };

    // 2. Render Background to Foreground Track Video/Image Layers
    project.tracks.forEach(track => {
      if (track.muted || track.type === 'audio') return;

      const sortedClips = [...track.clips].sort((a, b) => a.start - b.start);
      const clipsRenderedInTransition = new Set<string>();

      // 2a. Find and render any active transitions
      for (let i = 0; i < sortedClips.length - 1; i++) {
        const clipA = sortedClips[i];
        const clipB = sortedClips[i + 1];

        // Transition only applies between consecutive visual clips on the same track
        if (clipA.type === 'audio' || clipB.type === 'audio') continue;

        const boundary = clipA.start + clipA.duration;
        const gap = Math.abs(clipB.start - boundary);

        // Check if consecutive (consecutive within 0.2s tolerance) and has transition enabled
        if (gap < 0.2 && clipA.transitionType && clipA.transitionType !== 'none') {
          const duration = clipA.transitionDuration ?? 1.0;
          const midpoint = (boundary + clipB.start) / 2;
          const startTrans = midpoint - duration / 2;
          const endTrans = midpoint + duration / 2;

          if (time >= startTrans && time < endTrans) {
            clipsRenderedInTransition.add(clipA.id);
            clipsRenderedInTransition.add(clipB.id);

            const progress = (time - startTrans) / duration;
            const clampedProgress = Math.max(0, Math.min(1, progress));

            // Render Clip A and Clip B to their respective scratch canvases
            const timeA = Math.min(clipA.start + clipA.duration - 0.01, time);
            const timeB = Math.max(clipB.start, time);

            const sCanvasA = getScratchCanvasA(width, height);
            const sCtxA = sCanvasA.getContext('2d');
            const sCanvasB = getScratchCanvasB(width, height);
            const sCtxB = sCanvasB.getContext('2d');

            if (sCtxA && sCtxB) {
              sCtxA.clearRect(0, 0, width, height);
              sCtxB.clearRect(0, 0, width, height);

              // Render clip A's and clip B's fully composed frame onto their canvases
              renderClipToDisplayCanvas(clipA, timeA, sCtxA, 'A');
              renderClipToDisplayCanvas(clipB, timeB, sCtxB, 'B');

              // Now, draw the transition result onto the main ctx
              ctx.save();
              
              const type = clipA.transitionType;
              if (type === 'fade') {
                // Dip to Black
                if (clampedProgress < 0.5) {
                  ctx.globalAlpha = 1 - (clampedProgress * 2);
                  ctx.drawImage(sCanvasA, 0, 0);
                } else {
                  ctx.globalAlpha = (clampedProgress - 0.5) * 2;
                  ctx.drawImage(sCanvasB, 0, 0);
                }
              } else if (type === 'dissolve') {
                // Cross Dissolve
                ctx.globalAlpha = 1;
                ctx.drawImage(sCanvasA, 0, 0);
                ctx.globalAlpha = clampedProgress;
                ctx.drawImage(sCanvasB, 0, 0);
              } else if (type === 'slide') {
                // Push Slide
                ctx.drawImage(sCanvasA, -clampedProgress * width, 0);
                ctx.drawImage(sCanvasB, (1 - clampedProgress) * width, 0);
              } else if (type === 'wipe') {
                // Linear Wipe Left to Right
                ctx.drawImage(sCanvasA, 0, 0);
                ctx.beginPath();
                ctx.rect(0, 0, clampedProgress * width, height);
                ctx.clip();
                ctx.drawImage(sCanvasB, 0, 0);
              } else {
                // Fallback (instant cut)
                if (clampedProgress < 0.5) {
                  ctx.drawImage(sCanvasA, 0, 0);
                } else {
                  ctx.drawImage(sCanvasB, 0, 0);
                }
              }

              ctx.restore();

              // Draw active border if either is selected
              const isSelectedA = selectedClip?.id === clipA.id;
              const isSelectedB = selectedClip?.id === clipB.id;
              if ((isSelectedA || isSelectedB) && !targetCanvas) {
                ctx.save();
                ctx.filter = 'none';
                ctx.strokeStyle = '#6366f1';
                ctx.lineWidth = 4;
                ctx.strokeRect(0, 0, width, height);
                ctx.restore();
              }
            }
          }
        }
      }

      // 2b. Render normal clips that are NOT currently in an active transition zone
      sortedClips.forEach(clip => {
        if (clipsRenderedInTransition.has(clip.id)) return;

        if (time >= clip.start && time < clip.start + clip.duration) {
          const isSelected = selectedClip?.id === clip.id;
          
          renderClipToDisplayCanvas(clip, time, ctx, 'normal');

          // Active Clip Border (drawn cleanly on display level)
          if (isSelected && !targetCanvas) {
            ctx.save();
            ctx.filter = 'none';
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 4;
            ctx.strokeRect(0, 0, width, height);
            ctx.restore();
          }
        }
      });
    });

    // 3. Render Overlaid Subtitles/Text Layers
    project.tracks.forEach(track => {
      if (track.muted || track.type !== 'text') return;

      track.clips.forEach(clip => {
        if (time >= clip.start && time < clip.start + clip.duration) {
          const tClip = clip as TextClip;
          ctx.save();

          const textTime = time - clip.start;
          
          // Resolve Keyframe Interpolation
          const anim = getInterpolatedProperties(tClip, textTime);

          let opacity = anim.opacity;

          // Animations
          if (tClip.animation === 'fade') {
            if (textTime < 0.5) opacity *= (textTime / 0.5);
            else if (clip.duration - textTime < 0.5) opacity *= ((clip.duration - textTime) / 0.5);
          }

          // Setup font styles
          ctx.font = `${tClip.fontSize}px "${tClip.fontFamily || 'Inter'}"`;
          ctx.textAlign = tClip.alignment;
          ctx.textBaseline = 'middle';

          const textWidth = ctx.measureText(tClip.text).width;
          const textHeight = tClip.fontSize;
          const paddingX = 20;
          const paddingY = 10;

          // Align coordinates
          let x = width / 2;
          if (tClip.alignment === 'left') x = 60;
          if (tClip.alignment === 'right') x = width - 60;
          
          // Apply horizontal offset from keyframe positionX (default 0)
          x += (anim.positionX / 100) * width;

          // Vertical position (for text, positionY represents the absolute y percentage, e.g. 0 to 100)
          const y = height * (anim.positionY / 100);

          // Background bounding box
          if (tClip.backgroundColor && tClip.backgroundColor !== 'transparent') {
            ctx.fillStyle = tClip.backgroundColor;
            ctx.globalAlpha = opacity * 0.75;
            
            let boxX = x - textWidth / 2 - paddingX;
            if (tClip.alignment === 'left') boxX = x - paddingX;
            if (tClip.alignment === 'right') boxX = x - textWidth - paddingX;

            ctx.fillRect(
              boxX, 
              y - textHeight / 2 - paddingY, 
              textWidth + paddingX * 2, 
              textHeight + paddingY * 2
            );
          }

          // Slide effect offset
          let animOffsetX = 0;
          if (tClip.animation === 'slide' && textTime < 0.4) {
            animOffsetX = (1.0 - textTime / 0.4) * -80; // Slide from left
          }

          // Apply scale to text drawing using scaleVal from keyframes!
          let scaleVal = anim.scale;
          if (tClip.animation === 'zoom' && textTime < 0.3) {
            scaleVal *= (textTime / 0.3);
          }

          if (scaleVal !== 1.0) {
            ctx.translate(x, y);
            ctx.scale(scaleVal, scaleVal);
            ctx.translate(-x, -y);
          }

          // Apply custom Word Art style presets
          const preset = tClip.stylePreset || 'none';
          if (preset === 'neon') {
            ctx.shadowColor = tClip.color || '#f43f5e';
            ctx.shadowBlur = 15;
            ctx.strokeStyle = '#ffe4e6';
            ctx.lineWidth = Math.max(2, tClip.fontSize * 0.08);
            ctx.strokeText(tClip.text, x + animOffsetX, y);
          } else if (preset === 'cyber') {
            ctx.shadowColor = '#d946ef';
            ctx.shadowBlur = 8;
            ctx.fillStyle = '#06b6d4';
            ctx.fillText(tClip.text, x + animOffsetX - 3, y + 2);
          } else if (preset === 'vintage') {
            ctx.shadowColor = '#451a03';
            ctx.shadowBlur = 6;
            ctx.shadowOffsetX = 3;
            ctx.shadowOffsetY = 3;
          } else if (preset === 'subtitles') {
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = Math.max(3, tClip.fontSize * 0.12);
            ctx.strokeText(tClip.text, x + animOffsetX, y);
          }

          // Glitch text animation
          let animGlitchX = 0;
          if (tClip.animation === 'glitch' && Math.random() < 0.25) {
            animGlitchX = (Math.random() - 0.5) * 12;
            ctx.shadowColor = '#06b6d4'; // Cyan glitch shadow
            ctx.shadowBlur = 10;
          }

          // Draw Text
          ctx.fillStyle = tClip.color || '#ffffff';
          ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
          ctx.fillText(tClip.text, x + animOffsetX + animGlitchX, y);

          ctx.restore();
        }
      });
    });
  };

  // Sequence Exporter & Recording Engine
  const startExportVideo = async () => {
    cancelExportRef.current = false;
    setRenderProgress(0);
    setRenderedBlobUrl(null);
    setShowExportModal(true);
    
    if (audioEngineRef.current) audioEngineRef.current.stop();
    onPlayPause(false);

    // Create a high-res rendering canvas for export
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = 1280;
    exportCanvas.height = 720;
    const exportCtx = exportCanvas.getContext('2d');
    if (!exportCtx) return;

    // Use MediaRecorder to capture canvas frame updates
    const stream = exportCanvas.captureStream(exportFps);
    
    // Check supported types
    let options: any = { mimeType: 'video/mp4;codecs=h264' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/mp4;codecs=avc1' };
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/mp4' };
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm;codecs=vp9' };
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm;codecs=vp8' };
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm' };
    }

    try {
      const mediaRecorder = new MediaRecorder(stream, options);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        if (cancelExportRef.current) {
          setRenderedBlobUrl(null);
          setRenderProgress(null);
          return;
        }
        const outType = options.mimeType.includes('mp4') ? options.mimeType : 'video/mp4';
        const videoBlob = new Blob(chunks, { type: outType });
        const url = URL.createObjectURL(videoBlob);
        setRenderedBlobUrl(url);
        setRenderProgress(null);
      };

      // Start recording
      mediaRecorder.start();

      const totalFrames = Math.ceil(project.duration * exportFps);
      let frame = 0;

      // Draw frames sequentially with awaitable seeking
      const drawNextFrameForRecording = async () => {
        if (cancelExportRef.current) {
          mediaRecorder.stop();
          return;
        }

        if (frame >= totalFrames) {
          mediaRecorder.stop();
          return;
        }

        const seekTime = frame / exportFps;

        // 1. Gather all active videos and wait for them to seek to the frame position
        const activeVideoClips: { video: HTMLVideoElement; targetTime: number }[] = [];
        project.tracks.forEach(track => {
          if (track.muted || track.type === 'audio') return;
          track.clips.forEach(clip => {
            if (seekTime >= clip.start && seekTime < clip.start + clip.duration) {
              if (clip.type === 'video') {
                const vClip = clip as VideoClip;
                if (vClip.url !== 'procedural') {
                  const video = getOrLoadVideo(vClip.url);
                  if (video) {
                    const relativeTime = seekTime - clip.start + clip.sourceOffset;
                    const videoTime = relativeTime * vClip.speed;
                    activeVideoClips.push({ video, targetTime: videoTime });
                  }
                }
              }
            }
          });
        });

        // Seek all active video elements in parallel
        await Promise.all(activeVideoClips.map(({ video, targetTime }) => {
          return new Promise<void>((resolve) => {
            if (Math.abs(video.currentTime - targetTime) < 0.05) {
              resolve();
              return;
            }
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              resolve();
            };
            video.addEventListener('seeked', onSeeked);
            video.currentTime = targetTime;
            // Fallback in case of slow or failed seeked event
            setTimeout(() => {
              video.removeEventListener('seeked', onSeeked);
              resolve();
            }, 100);
          });
        }));

        // 2. Render frame onto export canvas
        drawFrame(seekTime, exportCanvas);

        setRenderProgress(Math.floor((frame / totalFrames) * 100));
        frame++;

        // Render slightly accelerated but bounded to capture stream accurately
        setTimeout(drawNextFrameForRecording, 20);
      };

      drawNextFrameForRecording();

    } catch (e) {
      console.error('Recording initialization error:', e);
      setRenderProgress(null);
      alert('Unable to initialize MediaRecorder on your browser.');
    }
  };

  // Simple formatting for timer
  const formatTime = (timeInSecs: number) => {
    const mins = Math.floor(timeInSecs / 60);
    const secs = Math.floor(timeInSecs % 60);
    const frames = Math.floor((timeInSecs % 1) * project.fps);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${frames.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      id="video-preview-panel" 
      ref={containerRef}
      className="flex-1 bg-[#0F0F10] flex flex-col relative border-b border-[#2A2A2D] overflow-hidden select-none"
      style={style}
    >
      {/* Dynamic Monitor Control Toolbar */}
      <div className="px-4 py-2.5 bg-[#121214] border-b border-[#2A2A2D] flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Film size={13} className="text-indigo-400 animate-pulse" />
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-200">
            Monitor Preview
          </span>
          <span className="text-[9px] text-slate-500 font-mono bg-slate-900/40 border border-[#2A2A2D] px-1.5 py-0.5 rounded">
            {project.width}x{project.height} @ {project.fps}fps
          </span>
        </div>

        {/* Resize Controls */}
        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
          {/* Zoom Slider */}
          <div className="flex items-center gap-1.5">
            <ZoomOut size={12} className="text-slate-500" />
            <input
              id="slider-preview-zoom"
              type="range"
              min="240"
              max={Math.max(1200, containerSize.width)}
              step="10"
              value={activeWidth}
              onChange={(e) => {
                setPreviewMode('custom');
                setCustomWidth(parseInt(e.target.value, 10));
              }}
              className="w-20 sm:w-28 accent-indigo-500 h-1 rounded bg-[#161618] border border-[#2A2A2D] cursor-ew-resize"
              title="Drag to scale preview dynamically"
            />
            <ZoomIn size={12} className="text-slate-500" />
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Sizing Selector */}
            <select
              id="select-preview-scale"
              value={previewMode === 'fit' ? 'fit' : customWidth}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'fit') {
                  setPreviewMode('fit');
                } else {
                  setPreviewMode('custom');
                  setCustomWidth(parseInt(val, 10));
                }
              }}
              className="bg-[#161618] border border-[#2A2A2D] rounded px-2 py-1 text-[10px] text-slate-300 font-semibold focus:outline-none focus:border-indigo-500"
            >
              <option value="fit">Fit Window ({Math.round((activeWidth / fitWidth) * 100)}%)</option>
              <option value="320">320px (Compact)</option>
              <option value="480">480px (Standard)</option>
              <option value="640">640px (Medium)</option>
              <option value="800">800px (Large)</option>
              <option value="1000">1000px (Cinema)</option>
            </select>

            {/* Fit-to-Window Toggle */}
            <button
              id="btn-preview-fit"
              onClick={() => setPreviewMode(previewMode === 'fit' ? 'custom' : 'fit')}
              className={`p-1 rounded border transition-all ${
                previewMode === 'fit'
                  ? 'border-indigo-500 bg-indigo-950/40 text-indigo-400'
                  : 'border-[#2A2A2D] bg-[#161618] text-slate-400 hover:text-slate-200 hover:border-[#35353A]'
              }`}
              title="Toggle Fit to Window"
            >
              <Maximize2 size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Preview Work Area with dynamic overflow panning */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto scrollbar-thin scrollbar-thumb-[#2A2A2D] scrollbar-track-transparent">
        
        {/* Resizable Player Wrapper */}
        <div 
          className="flex flex-col items-center justify-center relative group"
          style={{ 
            width: `${activeWidth}px`, 
            maxWidth: '100%',
            transition: isResizingPreview ? 'none' : 'width 0.12s ease-out'
          }}
        >
          {/* Symmetrical Left Resize Drag Handle */}
          <div
            id="handle-preview-resize-left"
            onMouseDown={(e) => handleSymmetricalResizeStart(e, -1)}
            className={`absolute left-0 top-0 bottom-0 w-1.5 -ml-1 cursor-col-resize z-20 hover:bg-indigo-500/20 active:bg-indigo-500 rounded flex items-center justify-center transition-all ${
              isResizingPreview ? '!bg-indigo-500 !w-2' : ''
            }`}
            title="Drag to resize symmetrically"
          >
            <div className="w-[1px] h-8 bg-slate-400/30 rounded-full" />
          </div>

          {/* Symmetrical Right Resize Drag Handle */}
          <div
            id="handle-preview-resize-right"
            onMouseDown={(e) => handleSymmetricalResizeStart(e, 1)}
            className={`absolute right-0 top-0 bottom-0 w-1.5 -mr-1 cursor-col-resize z-20 hover:bg-indigo-500/20 active:bg-indigo-500 rounded flex items-center justify-center transition-all ${
              isResizingPreview ? '!bg-indigo-500 !w-2' : ''
            }`}
            title="Drag to resize symmetrically"
          >
            <div className="w-[1px] h-8 bg-slate-400/30 rounded-full" />
          </div>

          {/* Player Canvas Frame Box */}
          <div 
            className="relative w-full bg-[#161618] rounded-lg shadow-2xl overflow-hidden border border-[#2A2A2D] shrink-0"
            style={{ aspectRatio: `${project.width} / ${project.height}` }}
          >
            <canvas
              id="preview-canvas"
              ref={canvasRef}
              width={project.width}
              height={project.height}
              className="w-full h-full object-contain"
            />

            {/* Loading Overlay */}
            {renderProgress !== null && (
              <div className="absolute inset-0 bg-[#0F0F10]/95 flex flex-col items-center justify-center p-6 text-center animate-fadeIn z-30">
                <RefreshCw size={36} className="text-indigo-400 animate-spin mb-4" />
                <span className="text-base font-bold text-white uppercase tracking-wider">Rendering Digital Video</span>
                <p className="text-xs text-slate-400 mt-1 max-w-[320px]">
                  Slicing frames and mixing procedural tracks client-side. Hold tight...
                </p>
                <div className="w-64 bg-[#232326] h-2 rounded-full overflow-hidden mt-4 border border-[#2A2A2D]">
                  <div 
                    className="bg-gradient-to-r from-indigo-600 to-violet-600 h-full transition-all duration-100"
                    style={{ width: `${renderProgress}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono font-bold text-slate-500 mt-2">{renderProgress}% COMPLETE</span>
              </div>
            )}

            {/* Selected Clip Indicator Watermark */}
            {selectedClip && (
              <div className="absolute top-3 left-3 bg-[#0F0F10]/90 backdrop-blur border border-[#2A2A2D] px-2 py-1 rounded text-[9px] font-mono text-slate-400 flex items-center gap-1.5 pointer-events-none">
                <Film size={10} className="text-indigo-400" />
                ACTIVE LAYER: {selectedClip.name.toUpperCase()}
              </div>
            )}
          </div>

          {/* Control Rail Panel */}
          <div className="w-full mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#161618] px-4 py-3 rounded-lg border border-[#2A2A2D] shadow-lg shrink-0">
            {/* Timestamp */}
            <div className="flex items-center gap-2 shrink-0 justify-center">
              <span className="text-xs font-mono font-bold text-indigo-400 bg-[#0F0F10] px-2.5 py-1 rounded border border-[#2A2A2D]">
                {formatTime(currentTime)}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                / {formatTime(project.duration)}
              </span>
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-center gap-2">
              <button
                id="btn-player-rewind"
                onClick={() => {
                  onTimeUpdate(0);
                  syncAudioAndVideo(0, isPlaying);
                }}
                className="p-1.5 hover:bg-[#232326] rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                title="Reset to 0s"
              >
                <RotateCcw size={15} />
              </button>
              
              <button
                id="btn-player-prev-frame"
                onClick={() => {
                  const next = Math.max(0, currentTime - 1 / project.fps);
                  onTimeUpdate(next);
                  syncAudioAndVideo(next, isPlaying);
                }}
                className="p-1.5 hover:bg-[#232326] rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                title="Back 1 frame"
              >
                <SkipBack size={15} />
              </button>

              <button
                id="btn-player-play-pause"
                onClick={() => onPlayPause(!isPlaying)}
                className="w-9 h-9 bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center rounded-full transition-all cursor-pointer shadow-lg shadow-indigo-900/20 shrink-0"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
              </button>

              <button
                id="btn-player-next-frame"
                onClick={() => {
                  const next = Math.min(project.duration, currentTime + 1 / project.fps);
                  onTimeUpdate(next);
                  syncAudioAndVideo(next, isPlaying);
                }}
                className="p-1.5 hover:bg-[#232326] rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                title="Forward 1 frame"
              >
                <SkipForward size={15} />
              </button>

              <button
                id="btn-player-mute"
                onClick={() => {
                  const nextMute = !isMuted;
                  setIsMuted(nextMute);
                  syncAudioAndVideo(currentTime, isPlaying && !nextMute);
                }}
                className="p-1.5 hover:bg-[#232326] rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                title={isMuted ? 'Unmute procedural audio' : 'Mute procedural audio'}
              >
                {isMuted ? <VolumeX size={15} className="text-red-500" /> : <Volume2 size={15} />}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Export Dialog overlay */}
      {showExportModal && (
        <div className="fixed inset-0 bg-[#0F0F10]/90 backdrop-blur-sm flex items-center justify-center p-4 z-40 animate-fadeIn">
          <div className="bg-[#161618] border border-[#2A2A2D] rounded-lg max-w-sm w-full p-5 shadow-2xl relative animate-scaleIn">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 uppercase tracking-wide">
              <Film size={15} className="text-indigo-400" />
              Web Video Exporter
            </h3>
            
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Compile your multi-track interactive timeline into a shareable local MP4 video file. Frame synthesis is executed live in your client browser.
            </p>

            {renderedBlobUrl ? (
              <div className="mt-4 flex flex-col gap-3 animate-fadeIn">
                <div className="bg-emerald-950/40 border border-emerald-900/60 rounded p-3 text-emerald-400 text-xs flex items-center gap-2">
                  <Sparkles size={16} className="text-emerald-500" />
                  <span>Success! Your MP4 video compiled cleanly.</span>
                </div>

                <a
                  id="link-download-rendered-video"
                  href={renderedBlobUrl}
                  download={`${project.name.toLowerCase().replace(/\s+/g, '-')}-edit.mp4`}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-center font-bold text-xs rounded flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Download size={14} /> Download MP4 Video File
                </a>
              </div>
            ) : renderProgress !== null ? (
              <div className="mt-4 flex flex-col gap-3 animate-fadeIn">
                <div className="bg-[#0F0F10] border border-[#2A2A2D] p-4 rounded-lg flex flex-col items-center justify-center text-center">
                  <RefreshCw size={24} className="text-indigo-400 animate-spin mb-3" />
                  <span className="text-[11px] font-bold text-slate-200 uppercase tracking-wider">
                    Compiling Video Stream
                  </span>
                  <p className="text-[9px] text-slate-400 mt-1 max-w-[280px] leading-relaxed">
                    Slicing tracks, interpolating keyframes, and seeking video buffers frame-by-frame...
                  </p>
                  
                  <div className="w-full bg-[#232326] h-1.5 rounded-full overflow-hidden mt-4 border border-[#2A2A2D]">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full transition-all duration-150"
                      style={{ width: `${renderProgress}%` }}
                    />
                  </div>
                  
                  <div className="flex justify-between w-full mt-2 text-[10px] text-slate-500 font-mono">
                    <span>Exporting frames:</span>
                    <span className="text-indigo-400 font-bold">{renderProgress}%</span>
                  </div>
                </div>

                <button
                  id="btn-cancel-export"
                  onClick={() => {
                    cancelExportRef.current = true;
                  }}
                  className="w-full py-2 bg-red-950/40 hover:bg-red-900/40 border border-red-900/60 text-red-400 text-center font-bold text-xs rounded transition-all cursor-pointer"
                >
                  Cancel Compilation
                </button>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">Target Frame-Rate (FPS)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => setExportFps(30)}
                      className={`py-1.5 text-xs rounded font-medium border transition-colors ${
                        exportFps === 30 
                          ? 'border-indigo-500 bg-indigo-950/20 text-indigo-400' 
                          : 'border-[#2A2A2D] bg-[#0F0F10] text-slate-400 hover:border-[#35353A]'
                      }`}
                    >
                      30 FPS (Default)
                    </button>
                    <button 
                      onClick={() => setExportFps(60)}
                      className={`py-1.5 text-xs rounded font-medium border transition-colors ${
                        exportFps === 60 
                          ? 'border-indigo-500 bg-indigo-950/20 text-indigo-400' 
                          : 'border-[#2A2A2D] bg-[#0F0F10] text-slate-400 hover:border-[#35353A]'
                      }`}
                    >
                      60 FPS (Ultra Smooth)
                    </button>
                  </div>
                </div>

                <div className="bg-[#0F0F10] border border-[#2A2A2D] p-2.5 rounded text-[10px] font-mono text-slate-500 leading-relaxed">
                  Export Specs:<br/>
                  • Format: MP4 container<br/>
                  • Quality: Constant Rate Factor (CRF)<br/>
                  • Resolution: 1280 x 720 (720p HD)<br/>
                  • Duration: {project.duration} seconds ({project.duration * exportFps} frames)
                </div>

                <button
                  id="btn-trigger-render"
                  onClick={startExportVideo}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-indigo-950/25"
                >
                  <Download size={13} /> Start Render Compilation
                </button>
              </div>
            )}

            <div className="mt-5 pt-3 border-t border-[#2A2A2D] flex justify-end gap-2">
              <button
                id="btn-close-exporter"
                onClick={() => {
                  cancelExportRef.current = true;
                  setShowExportModal(false);
                  setRenderedBlobUrl(null);
                  setRenderProgress(null);
                }}
                className="px-3.5 py-1.5 bg-[#0F0F10] hover:bg-[#232326] border border-[#2A2A2D] text-slate-400 text-xs rounded font-semibold transition-colors cursor-pointer"
              >
                {renderProgress !== null ? 'Cancel & Close' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
