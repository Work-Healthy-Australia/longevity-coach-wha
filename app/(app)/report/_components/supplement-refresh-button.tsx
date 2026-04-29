'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { triggerSupplementProtocol } from '../actions';

type State = 'idle' | 'pending' | 'done' | 'timeout' | 'error';

export function SupplementRefreshButton({ hasProtocol }: { hasProtocol: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  useEffect(() => () => stopPolling(), []);

  function startPolling(since: string) {
    let attempts = 0;
    const MAX_ATTEMPTS = 60; // 5 min at 5s interval

    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > MAX_ATTEMPTS) {
        stopPolling();
        setState('timeout');
        setMessage('Taking longer than expected — refresh the page to check.');
        return;
      }
      try {
        const res = await fetch(`/api/report/supplement-status?since=${encodeURIComponent(since)}`);
        if (!res.ok) return; // network blip — keep polling
        const data = await res.json() as { ready: boolean };
        if (data.ready) {
          stopPolling();
          setState('done');
          setMessage('Your supplement protocol is ready!');
          router.refresh();
          window.dispatchEvent(new CustomEvent('supplementProtocolReady', { detail: { since } }));
        }
      } catch {
        // network blip — keep polling
      }
    }, 5000);
  }

  async function handleClick() {
    setState('pending');
    const since = new Date().toISOString();

    const result = await triggerSupplementProtocol();
    if (result.status === 'error') {
      setState('error');
      setMessage(result.message);
      return;
    }
    setMessage(result.message);
    window.dispatchEvent(new CustomEvent('supplementTaskStarted', { detail: { since } }));
    startPolling(since);
  }

  if (state === 'done') {
    return <span className="supplement-refresh-done">✓ Protocol ready</span>;
  }

  const label = state === 'pending' ? 'Generating…' : hasProtocol ? 'Refresh protocol' : 'Generate my protocol';

  return (
    <div className="supplement-refresh-wrap">
      {message && (
        <p className={`supplement-refresh-msg${state === 'error' || state === 'timeout' ? ' supplement-refresh-error' : ''}`}>
          {message}
        </p>
      )}
      <button
        type="button"
        className="btn-secondary"
        onClick={handleClick}
        disabled={state === 'pending'}
      >
        {label}
      </button>
    </div>
  );
}
