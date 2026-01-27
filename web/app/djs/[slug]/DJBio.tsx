'use client';

import { useState } from 'react';

interface DJBioProps {
  bio: string;
}

export function DJBio({ bio }: DJBioProps) {
  const [expanded, setExpanded] = useState(false);
  
  // Only show toggle if bio is longer than ~400 characters (roughly 3 lines)
  const isLong = bio.length > 400;
  
  return (
    <div className="mb-8 max-w-3xl">
      <div className="relative">
        <p className={`text-[var(--muted)] leading-relaxed ${!expanded && isLong ? 'line-clamp-3' : ''}`}>
          {bio}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium transition-colors"
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
      </div>
    </div>
  );
}
