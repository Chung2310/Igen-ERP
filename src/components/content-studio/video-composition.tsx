import React from 'react';
import { AbsoluteFill, Video, Audio, Img, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';

export interface VideoCompositionProps {
  blueprint: {
    timeline: Array<{
      type: "video" | "text" | "image" | "audio";
      src?: string;
      content?: string;
      start: number; // in seconds
      end: number; // in seconds
      playbackRate?: number; // speed multiplier, e.g. 0.5 or 2.0
      style?: {
        position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center" | "center" | "bottom-center";
        color?: string;
        fontSize?: string;
        opacity?: number;
        width?: number;
      };
      filters?: {
        brightness?: number;
        grayscale?: number;
      };
      volume?: number;
    }>;
  };
}

export const VideoComposition: React.FC<VideoCompositionProps> = ({ blueprint }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const timeline = blueprint?.timeline || [];
  
  // 1. Tách các thành phần theo loại
  const rawVideoClips = timeline.filter(item => item.type === "video");
  const textElements = timeline.filter(item => item.type === "text");
  const imageElements = timeline.filter(item => item.type === "image");
  const audioElements = timeline.filter(item => item.type === "audio");

  // 2. Tính toán thời gian bắt đầu luỹ kế cho các phân đoạn video
  let currentTimelineOffset = 0;
  const videoClips = rawVideoClips.map((item) => {
    const start = item.start ?? 0;
    const end = item.end ?? 5;
    const rate = item.playbackRate ?? 1;
    const clipDuration = (end - start) / rate;
    const startInTimeline = currentTimelineOffset;
    currentTimelineOffset += clipDuration;
    return {
      ...item,
      startInTimeline,
      duration: clipDuration
    };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' }}>
      {/* Phát các phân đoạn video nối tiếp */}
      {videoClips.map((clip, idx) => {
        const startFrame = Math.round(clip.startInTimeline * fps);
        const durationFrames = Math.round(clip.duration * fps);
        
        const brightness = clip.filters?.brightness ?? 1;
        const grayscale = clip.filters?.grayscale ?? 0;
        
        return (
          <Sequence
            key={`video-seq-${idx}`}
            from={startFrame}
            durationInFrames={durationFrames}
          >
            <Video
              src={clip.src!}
              startFrom={Math.round((clip.start ?? 0) * fps)}
              playbackRate={clip.playbackRate ?? 1}
              preload="auto"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                filter: `brightness(${brightness}) grayscale(${grayscale})`
              }}
            />
          </Sequence>
        );
      })}

      {/* Hiển thị lớp phủ ảnh (Logo / Sticker) */}
      {imageElements.map((imgItem, idx) => {
        const startFrame = Math.round(imgItem.start * fps);
        const endFrame = Math.round(imgItem.end * fps);
        
        const isUrlValid = imgItem.src && (imgItem.src.startsWith('http://') || imgItem.src.startsWith('https://') || imgItem.src.startsWith('/'));
        
        if (frame >= startFrame && frame <= endFrame && isUrlValid) {
          const style = imgItem.style || {};
          const positionStyles: React.CSSProperties = {
            position: 'absolute',
            zIndex: 20,
          };
          
          if (style.position === 'top-left') {
            positionStyles.top = 20;
            positionStyles.left = 20;
          } else if (style.position === 'bottom-left') {
            positionStyles.bottom = 20;
            positionStyles.left = 20;
          } else if (style.position === 'bottom-right') {
            positionStyles.bottom = 20;
            positionStyles.right = 20;
          } else {
            positionStyles.top = 20; // default top-right
            positionStyles.right = 20;
          }
          
          return (
            <Img
              key={`image-${idx}`}
              src={imgItem.src}
              style={{
                ...positionStyles,
                width: style.width || 100,
                opacity: style.opacity ?? 1,
                objectFit: 'contain'
              }}
            />
          );
        }
        return null;
      })}

      {/* Hiển thị lớp chữ nghệ thuật */}
      {textElements.map((textItem, idx) => {
        const startFrame = Math.round(textItem.start * fps);
        const endFrame = Math.round(textItem.end * fps);
        
        if (frame >= startFrame && frame <= endFrame && textItem.content) {
          const style = textItem.style || {};
          const positionStyles: React.CSSProperties = {
            position: 'absolute',
            display: 'flex',
            pointerEvents: 'none',
            zIndex: 10,
          };
          
          // Vertically position
          if (style.position?.startsWith('top-')) {
            positionStyles.top = 40;
          } else if (style.position === 'center') {
            positionStyles.top = 0;
            positionStyles.bottom = 0;
            positionStyles.alignItems = 'center';
          } else {
            positionStyles.bottom = 80; // default bottom-center
          }
          
          // Horizontally position
          if (style.position?.endsWith('-left')) {
            positionStyles.left = 40;
          } else if (style.position?.endsWith('-right')) {
            positionStyles.right = 40;
          } else {
            positionStyles.left = 0;
            positionStyles.right = 0;
            positionStyles.justifyContent = 'center';
          }
          
          return (
            <div key={`text-${idx}`} style={positionStyles}>
              <span
                style={{
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  padding: '8px 18px',
                  borderRadius: '12px',
                  color: style.color || 'white',
                  fontSize: style.fontSize || '36px',
                  fontWeight: 'bold',
                  fontFamily: 'Arial, sans-serif',
                  textShadow: '2px 2px 8px rgba(0,0,0,0.8)',
                  textAlign: 'center',
                }}
              >
                {textItem.content}
              </span>
            </div>
          );
        }
        return null;
      })}

      {/* Phát âm thanh (Nhạc nền) */}
      {audioElements.map((audioItem, idx) => {
        const startFrame = Math.round(audioItem.start * fps);
        const endFrame = Math.round(audioItem.end * fps);
        const durationFrames = Math.max(1, endFrame - startFrame);
        
        const isUrlValid = audioItem.src && (audioItem.src.startsWith('http://') || audioItem.src.startsWith('https://') || audioItem.src.startsWith('/'));
        
        if (isUrlValid) {
          return (
            <Sequence
              key={`audio-seq-${idx}`}
              from={startFrame}
              durationInFrames={durationFrames}
            >
              <Audio
                src={audioItem.src}
                volume={audioItem.volume ?? 1}
              />
            </Sequence>
          );
        }
        return null;
      })}
    </AbsoluteFill>
  );
};
