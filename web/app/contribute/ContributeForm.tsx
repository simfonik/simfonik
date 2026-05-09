'use client';

import { useState } from 'react';

export function ContributeForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setSubmitStatus('success');
        (event.target as HTMLFormElement).reset();
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error('Form submission error:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  }

  const labelClasses =
    'block font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--muted)] mb-2';
  const inputClasses =
    'font-mono w-full border-[1.5px] border-[var(--text)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:bg-[var(--surface)]';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <input type="hidden" name="access_key" value="a13233a0-9133-44b1-9b22-b902329edcc9" />
      <input type="hidden" name="subject" value="New Contribution from simfonik.com" />

      <div>
        <label htmlFor="name" className={labelClasses}>
          Name <span className="text-[var(--accent-text)]">*</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          className={inputClasses}
          placeholder="Your name"
        />
      </div>

      <div>
        <label htmlFor="email" className={labelClasses}>
          Email <span className="text-[var(--accent-text)]">*</span>
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          className={inputClasses}
          placeholder="your.email@example.com"
        />
      </div>

      <div>
        <label htmlFor="message" className={labelClasses}>
          What would you like to contribute? <span className="text-[var(--accent-text)]">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={8}
          className={`${inputClasses} resize-y`}
          placeholder="Tell us about the mixtapes you have, DJ names, years, etc..."
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="poster-btn"
      >
        {isSubmitting ? 'Sending…' : 'Send Message'}
      </button>

      {submitStatus === 'success' && (
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] px-3 py-2 border-[1.5px] border-[var(--text)] text-[var(--text)]">
          Thank you. Your message has been sent.
        </p>
      )}

      {submitStatus === 'error' && (
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] px-3 py-2 border-[1.5px] border-red-500 text-red-500">
          Sorry, there was an error sending your message. Please try again.
        </p>
      )}
    </form>
  );
}
