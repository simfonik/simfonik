'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

type TapeOption = {
  id: string;
  title: string;
  djName: string;
  released: string;
  coverUrl: string;
};

type SegmentOption = {
  id: string;
  name: string;
};

type SendState = 'idle' | 'confirming' | 'success' | 'error';

// ─── Custom Dropdown ──────────────────────────────────────────────────────────

type DropdownProps<T extends { id: string }> = {
  id: string;
  label: string;
  options: T[];
  value: string;
  onChange: (id: string) => void;
  renderOption: (option: T) => React.ReactNode;
  renderSelected: (option: T) => React.ReactNode;
  placeholder?: string;
};

function Dropdown<T extends { id: string }>({
  id,
  label,
  options,
  value,
  onChange,
  renderOption,
  renderSelected,
  placeholder = 'Select…',
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-[var(--muted)] mb-2"
      >
        {label}
      </label>
      <div ref={ref} className="relative">
        <button
          id={id}
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-3 px-3 py-2.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-md transition-colors hover:border-[#5e6ad2]/60 focus:outline-none focus:border-[#5e6ad2] cursor-pointer text-left"
        >
          <span className="flex-1 min-w-0">
            {selected ? renderSelected(selected) : (
              <span className="text-[var(--muted)]/60">{placeholder}</span>
            )}
          </span>
          <svg
            className={`w-4 h-4 text-[var(--muted)] flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <ul
            role="listbox"
            className="absolute z-50 mt-1 w-full bg-[var(--surface)] border border-[var(--border)] rounded-md shadow-xl overflow-auto max-h-72"
          >
            {options.map((option) => (
              <li
                key={option.id}
                role="option"
                aria-selected={option.id === value}
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
                className={`px-3 py-2.5 cursor-pointer transition-colors ${
                  option.id === value
                    ? 'bg-[#5e6ad2]/15 text-[var(--text)]'
                    : 'hover:bg-[var(--bg-hover)] text-[var(--text)]'
                }`}
              >
                {renderOption(option)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminNewsletterPage() {
  const [tapes, setTapes] = useState<TapeOption[]>([]);
  const [segments, setSegments] = useState<SegmentOption[]>([]);
  const [selectedTapeId, setSelectedTapeId] = useState('');
  const [selectedSegmentId, setSelectedSegmentId] = useState('');
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [locked, setLocked] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [sendState, setSendState] = useState<SendState>('idle');
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [broadcastId, setBroadcastId] = useState('');

  useEffect(() => {
    fetch('/api/newsletter/tapes')
      .then((r) => r.json())
      .then((data) => {
        setTapes(data.tapes ?? []);
        if (data.tapes?.length) setSelectedTapeId(data.tapes[0].id);
      })
      .catch(console.error);
  }, []);

  const handleUnlock = useCallback(async () => {
    if (!password) return;
    setUnlocking(true);
    setUnlockError('');
    try {
      const res = await fetch('/api/newsletter/segments', {
        headers: { 'x-admin-password': password },
      });
      if (res.status === 401) {
        setUnlockError('Incorrect password.');
        return;
      }
      if (!res.ok) {
        setUnlockError('Could not load segments. Try again.');
        return;
      }
      const data = await res.json();
      setSegments(data.segments ?? []);
      if (data.segments?.length) setSelectedSegmentId(data.segments[0].id);
      setLocked(false);
    } catch {
      setUnlockError('Network error. Try again.');
    } finally {
      setUnlocking(false);
    }
  }, [password]);

  const selectedTape = tapes.find((t) => t.id === selectedTapeId);
  const selectedSegment = segments.find((s) => s.id === selectedSegmentId);

  const handleConfirm = () => {
    if (!selectedTapeId || !selectedSegmentId) return;
    setSendState('confirming');
  };

  const handleSend = useCallback(async () => {
    setIsSending(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/newsletter/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tapeId: selectedTapeId,
          segmentId: selectedSegmentId,
          message,
          adminPassword: password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error ?? 'Something went wrong.');
        setSendState('error');
        return;
      }

      setBroadcastId(data.broadcastId ?? '');
      setSendState('success');
    } catch {
      setErrorMessage('Network error. Please try again.');
      setSendState('error');
    } finally {
      setIsSending(false);
    }
  }, [selectedTapeId, selectedSegmentId, message, password]);

  const reset = () => {
    setSendState('idle');
    setErrorMessage('');
    setBroadcastId('');
    setMessage('');
    setPassword('');
    setLocked(true);
    if (tapes.length) setSelectedTapeId(tapes[0].id);
    setSegments([]);
    setSelectedSegmentId('');
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 pt-12 pb-20">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text)]">Newsletter</h1>
          <p className="text-[var(--muted)] mt-1">Send a new mix notification to subscribers.</p>
        </div>

        {locked ? (
          <div className="max-w-sm space-y-4">
            <div>
              <label htmlFor="unlock-password" className="block text-sm font-medium text-[var(--muted)] mb-2">
                Admin password
              </label>
              <input
                id="unlock-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-md focus:outline-none focus:border-[#5e6ad2] transition-colors placeholder:text-[var(--muted)]/40"
              />
            </div>
            {unlockError && (
              <p className="text-red-400 text-sm">{unlockError}</p>
            )}
            <button
              onClick={handleUnlock}
              disabled={!password || unlocking}
              className="px-5 py-2.5 bg-[#5e6ad2] hover:bg-[#7c84e8] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-md transition-colors cursor-pointer"
            >
              {unlocking ? 'Unlocking…' : 'Unlock'}
            </button>
          </div>
        ) :sendState === 'success' ? (
          <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-xl">
            <p className="text-green-400 font-semibold text-lg mb-1">Broadcast sent ✓</p>
            {broadcastId && (
              <p className="text-[var(--muted)] text-sm font-mono mt-1">ID: {broadcastId}</p>
            )}
            <button
              onClick={reset}
              className="mt-4 px-4 py-2 bg-[var(--muted)]/20 hover:bg-[var(--muted)]/30 text-[var(--text)] rounded-md transition-colors cursor-pointer text-sm"
            >
              Send another
            </button>
          </div>

        ) : sendState === 'confirming' ? (
          <div className="space-y-4">
            <p className="text-sm font-medium text-[var(--muted)]">Email preview</p>
            <div className="rounded-xl overflow-hidden border border-[var(--border)]">
              <iframe
                src={`/api/newsletter/preview?tapeId=${encodeURIComponent(selectedTapeId)}&message=${encodeURIComponent(message)}`}
                title="Email preview"
                className="w-full"
                style={{ border: 'none', display: 'block' }}
                sandbox="allow-same-origin"
                onLoad={(e) => {
                  const frame = e.currentTarget;
                  const height = frame.contentDocument?.documentElement?.scrollHeight;
                  if (height) frame.style.height = `${height}px`;
                }}
              />
            </div>
            {selectedSegment && (
              <p className="text-[var(--muted)] text-sm">
                Segment: <span className="text-[var(--text)] font-medium">{selectedSegment.name}</span>
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleSend}
                disabled={isSending}
                className="px-5 py-2.5 bg-[#5e6ad2] hover:bg-[#7c84e8] disabled:opacity-40 text-white font-semibold rounded-md transition-colors cursor-pointer"
              >
                {isSending ? 'Sending…' : 'Confirm & Send'}
              </button>
              <button
                onClick={() => setSendState('idle')}
                disabled={isSending}
                className="px-5 py-2.5 bg-[var(--muted)]/20 hover:bg-[var(--muted)]/30 text-[var(--text)] rounded-md transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>

        ) : (
          <div className="space-y-6">

            {/* Tape picker */}
            <Dropdown<TapeOption>
              id="tape-select"
              label="Tape"
              options={tapes}
              value={selectedTapeId}
              onChange={setSelectedTapeId}
              placeholder="Loading tapes…"
              renderSelected={(tape) => (
                <span className="text-sm">
                  <span className="font-medium">{tape.title}</span>
                  <span className="text-[var(--muted)]"> — {tape.djName} ({tape.released})</span>
                </span>
              )}
              renderOption={(tape) => (
                <div className="text-sm">
                  <span className="font-medium">{tape.title}</span>
                  <span className="text-[var(--muted)]"> — {tape.djName} ({tape.released})</span>
                </div>
              )}
            />

            {/* Tape preview card */}
            {selectedTape && (
              <div className="flex gap-4 items-center p-4 bg-[var(--muted)]/5 border border-[var(--border)] rounded-lg">
                {selectedTape.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedTape.coverUrl}
                    alt={selectedTape.title}
                    className="w-16 h-16 rounded-md object-cover border border-[var(--border)] flex-shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--text)] truncate">{selectedTape.title}</p>
                  <p className="text-[var(--muted)] text-sm">{selectedTape.djName} · {selectedTape.released}</p>
                  <p className="text-[var(--muted)] text-xs mt-1">simfonik.com/tapes/{selectedTape.id}</p>
                </div>
              </div>
            )}

            {/* Segment picker */}
            <Dropdown<SegmentOption>
              id="segment-select"
              label="Segment"
              options={segments}
              value={selectedSegmentId}
              onChange={setSelectedSegmentId}
              placeholder="Loading segments…"
              renderSelected={(seg) => (
                <span className="text-sm font-medium">{seg.name}</span>
              )}
              renderOption={(seg) => (
                <span className="text-sm">{seg.name}</span>
              )}
            />

            {/* Personal note */}
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-[var(--muted)] mb-2">
                Personal note <span className="text-[var(--muted)]/50">(optional)</span>
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                placeholder="Add a short note to include in the email…"
                rows={3}
                className="w-full px-3 py-2.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-md focus:outline-none focus:border-[#5e6ad2] transition-colors resize-none placeholder:text-[var(--muted)]/40 overflow-hidden"
              />
            </div>

            {sendState === 'error' && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-md text-red-400 text-sm">
                {errorMessage}
              </div>
            )}

            <button
              onClick={handleConfirm}
              disabled={!selectedTapeId || !selectedSegmentId}
              className="px-6 py-2.5 bg-[#5e6ad2] hover:bg-[#7c84e8] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-md transition-colors cursor-pointer"
            >
              Review &amp; Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
