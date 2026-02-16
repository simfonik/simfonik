'use client';

import { useRef, useState, useEffect } from 'react';

interface Track {
  title: string;
  url: string;
  position: string;
}

interface PlaylistPlayerProps {
  tracks: Track[];
  tapeId?: string;
}

const PLAYBACK_RATES = [1, 1.25, 1.5, 2] as const;

export function PlaylistPlayer({ tracks, tapeId }: PlaylistPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const rafRef = useRef<number | null>(null);
  
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentTrack = tracks[currentTrackIndex];

  // Cancel RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // Wire up event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Check if metadata is already loaded (e.g., from cache after refresh)
    if (audio.readyState >= 1) {
      setDuration(audio.duration);
    }

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      if (tapeId) {
        fetch('/api/track-play', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tapeId, sidePosition: currentTrack.position }),
        }).catch(() => {});
      }
    };

    const handlePause = () => {
      setIsPlaying(false);
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      // Auto-advance to next track
      if (currentTrackIndex < tracks.length - 1) {
        setCurrentTrackIndex(currentTrackIndex + 1);
        // Don't reset isPlaying - new track will auto-play
      } else {
        setIsPlaying(false);
        setCurrentTime(0);
        audio.currentTime = 0;
      }
    };

    const handleError = () => {
      setError('Unable to load audio. Please try again.');
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleSeeking = () => {
      setCurrentTime(audio.currentTime);
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
  }, [currentTrackIndex, tracks.length]);

  // Reset state when track changes
  useEffect(() => {
    setCurrentTime(0);
    setError(null);
    // Don't reset duration to 0 - keeps UI stable during track changes
  }, [currentTrackIndex]);

  // Auto-play when isPlaying is true
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isPlaying) return;
    
    // Auto-play without showing loading state (smoother UX)
    audio.play()
      .catch((err) => {
        console.error('Auto-play failed:', err);
        setIsPlaying(false);
      });
  }, [currentTrackIndex, isPlaying]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      setIsLoading(true);
      audio.play()
        .then(() => setIsLoading(false))
        .catch((err) => {
          console.error('Playback failed:', err);
          setError('Playback failed. Please try again.');
          setIsLoading(false);
        });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const cyclePlaybackRate = () => {
    const audio = audioRef.current;
    if (!audio) return;

    const currentIndex = PLAYBACK_RATES.indexOf(playbackRate as typeof PLAYBACK_RATES[number]);
    const nextIndex = (currentIndex + 1) % PLAYBACK_RATES.length;
    const nextRate = PLAYBACK_RATES[nextIndex];

    audio.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds)) return '0:00:00';
    
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const selectTrack = (index: number) => {
    if (index === currentTrackIndex) {
      // If clicking current track, toggle play/pause
      togglePlay();
    } else {
      // Switch to new track and start playing
      setCurrentTrackIndex(index);
      setIsPlaying(true);
    }
  };

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Player */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-2.5">
        <audio
          ref={audioRef}
          src={currentTrack.url}
          preload="metadata"
          playsInline
        />

        <div className="flex items-center gap-3">
          {/* Play/Pause Button */}
          <button
            onClick={togglePlay}
            disabled={isLoading}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg-secondary)]"
          >
            {isLoading ? (
              <svg className="w-5 h-5 text-white animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : isPlaying ? (
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Time and Scrubber */}
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <span className="text-sm text-[var(--muted)] tabular-nums flex-shrink-0">
              {formatTime(currentTime)}
            </span>
            
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              disabled={isLoading || !duration}
              aria-label={`Seek audio: ${currentTrack.title}`}
              className="flex-1 h-2.5 bg-[var(--bg)] rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg-secondary)]
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--accent)] [&::-webkit-slider-thumb]:cursor-pointer
                [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[var(--accent)] [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
            />
            
            <span className="text-sm text-[var(--muted)] tabular-nums flex-shrink-0">
              {duration > 0 ? formatTime(duration) : '--:--:--'}
            </span>

            <a
              href={currentTrack.url}
              download
              className="text-[var(--muted)] hover:text-[var(--accent)] transition-colors flex-shrink-0 ml-3"
              aria-label="Download audio file"
            >
              <svg 
                className="w-5 h-5" 
                viewBox="0 0 24 24" 
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm1 6a1 1 0 00-2 0v5.586l-1.707-1.707a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L13 13.586V8z" clipRule="evenodd" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* Track List */}
      <div>
        <div className="space-y-0.5">
          {tracks.map((track, index) => (
            <button
              key={track.position}
              onClick={() => selectTrack(index)}
              className={`w-full text-left px-3 py-3 rounded transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1 ${
                index === currentTrackIndex
                  ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                  : 'hover:bg-[var(--bg-secondary)] text-[var(--text)]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  {index === currentTrackIndex && isPlaying ? (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 opacity-60" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-sm">
                  {track.title}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
