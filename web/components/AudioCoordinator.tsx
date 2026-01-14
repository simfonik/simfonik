'use client';

import { useEffect } from 'react';

/**
 * AudioCoordinator ensures only one audio player plays at a time.
 * When a user plays an audio element, all other audio elements on the page are paused.
 */
export function AudioCoordinator() {
  useEffect(() => {
    const handlePlay = (e: Event) => {
      const playingAudio = e.target as HTMLAudioElement;
      
      // Pause all other audio elements
      document.querySelectorAll('audio').forEach(audio => {
        if (audio !== playingAudio && !audio.paused) {
          audio.pause();
        }
      });
    };
    
    // Listen to all audio elements on the page
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
      audio.addEventListener('play', handlePlay);
    });
    
    // Cleanup event listeners on unmount
    return () => {
      audioElements.forEach(audio => {
        audio.removeEventListener('play', handlePlay);
      });
    };
  }, []);
  
  // This component renders nothing
  return null;
}
