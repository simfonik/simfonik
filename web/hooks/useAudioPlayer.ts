import { useState, useEffect, useRef, useCallback } from 'react';

interface UseAudioPlayerOptions {
  src: string;
  tapeId?: string; // For API play tracking
  sidePosition?: string; // For API play tracking
  onEnded?: () => void;
}

export function useAudioPlayer({ src, tapeId, sidePosition, onEnded }: UseAudioPlayerOptions) {
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the src we've already fired an API tracking event for, to prevent rapid-toggle spam
  const trackedSrcRef = useRef<string | null>(null);

  // Handle source transition: reset transient state when `src` changes
  useEffect(() => {
    setCurrentTime(0);
    setError(null);
    setIsLoading(false);
    
    // We do NOT reset isPlaying here to allow 
    // seamless auto-play transitions between playlist tracks
  }, [src]);

  // Handle auto-play intent when src changes while playing
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying && audio.src) {
      setIsLoading(true);
      audio.play().catch((err) => {
        // Ignore AbortError: it happens naturally if src changes again rapidly
        if (err.name !== 'AbortError') {
          console.error('Auto-play failed after source change:', err);
          setIsPlaying(false);
        }
      }).finally(() => {
        setIsLoading(false);
      });
    }
  }, [src, isPlaying]);

  // Bind audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Capture initial duration if metadata already loaded
    if (audio.readyState >= 1) {
      setDuration(audio.duration);
    }

    const handleLoadedMetadata = () => setDuration(audio.duration);
    
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleSeeking = () => setCurrentTime(audio.currentTime);
    
    const handlePlay = () => {
      setIsPlaying(true);
      
      // Audio Coordinator integration: pause all other audio elements on the page
      document.querySelectorAll('audio').forEach((a) => {
        if (a !== audio && !a.paused) {
          a.pause();
        }
      });

      // API tracking with deduping per src
      if (tapeId && sidePosition && trackedSrcRef.current !== src) {
        trackedSrcRef.current = src;
        fetch('/api/track-play', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tapeId, sidePosition }),
        }).catch(() => {});
      }
    };

    const handlePause = () => {
      setIsPlaying(false);
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      if (onEnded) {
        onEnded();
      } else {
        setIsPlaying(false);
        setCurrentTime(0);
        audio.currentTime = 0;
      }
    };

    const handleError = () => {
      setError('Unable to load audio. Please try again.');
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('seeking', handleSeeking);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('seeking', handleSeeking);
    };
  }, [src, tapeId, sidePosition, onEnded]);

  // Explicit control APIs
  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    setIsLoading(true);
    // Setting playing state immediately for responsive UI
    setIsPlaying(true);
    
    audio.play()
      .then(() => setIsLoading(false))
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Playback failed:', err);
          setError('Playback failed. Please try again.');
          setIsPlaying(false);
        }
        setIsLoading(false);
      });
  }, []);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
  }, []);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  return {
    ref: audioRef,
    state: {
      isPlaying,
      currentTime,
      duration,
      isLoading,
      error
    },
    controls: {
      play,
      pause,
      seek
    }
  };
}
