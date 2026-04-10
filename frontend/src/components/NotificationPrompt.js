/**
 * NotificationPrompt.js
 *
 * Shows a one-time banner asking the visitor to allow notifications.
 * - Always shown on first visit regardless of browser/OS.
 * - Dismissed state stored in localStorage — never shown again after user responds.
 * - On browsers that support the Notification API (Android Chrome, desktop):
 *     clicking Allow triggers the native permission dialog.
 * - On browsers that don't support Notification (iOS Safari, some others):
 *     shows a friendly message explaining they can add to Home Screen for alerts.
 * - Records opt-in to backend for admin stats.
 */

import React, { useEffect, useState } from 'react';

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
const LS_KEY   = 'notif_prompt_v2';      // bump version so old dismissals don't block
const LS_ID    = 'notif_visitor_id';

function getOrCreateVisitorId() {
  let id = localStorage.getItem(LS_ID);
  if (!id) {
    id = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(LS_ID, id);
  }
  return id;
}

const supportsNotifications = () => 'Notification' in window;

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export default function NotificationPrompt() {
  const [visible, setVisible] = useState(false);
  // null | 'asking' | 'granted' | 'denied' | 'unsupported'
  const [status, setStatus] = useState(null);

  useEffect(() => {
    // If user already responded, never show again
    if (localStorage.getItem(LS_KEY)) return;

    // If permission was previously granted at browser level, record silently and skip
    if (supportsNotifications() && Notification.permission === 'granted') {
      localStorage.setItem(LS_KEY, 'granted');
      recordSubscription();
      return;
    }

    // If browser hard-denied (user manually blocked in settings), skip silently
    if (supportsNotifications() && Notification.permission === 'denied') {
      localStorage.setItem(LS_KEY, 'browser-denied');
      return;
    }

    // Show prompt after 3s for all other cases (including unsupported browsers)
    const t = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const recordSubscription = async () => {
    try {
      await fetch(`${API_BASE}/api/notifications/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitor_id: getOrCreateVisitorId(),
          user_agent: navigator.userAgent,
          accepted_at: new Date().toISOString(),
          active: true,
        }),
      });
    } catch (_) {}
  };

  const handleAllow = async () => {
    // Browser doesn't support Notifications at all
    if (!supportsNotifications()) {
      setStatus('unsupported');
      localStorage.setItem(LS_KEY, 'unsupported');
      return;
    }

    setStatus('asking');
    try {
      const result = await Notification.requestPermission();
      if (result === 'granted') {
        setStatus('granted');
        localStorage.setItem(LS_KEY, 'granted');
        await recordSubscription();
        // Fire a welcome notification
        try {
          new Notification('Missile Monitor 🚀', {
            body: 'You will be notified of major missile events.',
          });
        } catch (_) {}
        setTimeout(() => setVisible(false), 2200);
      } else {
        setStatus('denied');
        localStorage.setItem(LS_KEY, 'denied');
        setTimeout(() => setVisible(false), 2200);
      }
    } catch (_) {
      setStatus('denied');
      localStorage.setItem(LS_KEY, 'error');
      setTimeout(() => setVisible(false), 2200);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(LS_KEY, 'dismissed');
    setVisible(false);
  };

  if (!visible) return null;

  // What to show in the body text depending on browser support
  const isUnsupported = !supportsNotifications();
  const iosDevice = isIOS();

  return (
    <>
      {/* Subtle backdrop */}
      <div
        onClick={handleDismiss}
        style={{
          position: 'fixed', inset: 0, zIndex: 8000,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Prompt card — slides up from bottom */}
      <div style={{
        position: 'fixed',
        bottom: 24, left: '50%', transform: 'translateX(-50%)',
        zIndex: 8001,
        background: '#111827',
        border: '1px solid #1f2937',
        borderRadius: 14,
        boxShadow: '0 20px 60px rgba(0,0,0,0.75), 0 0 0 1px rgba(16,185,129,0.12)',
        padding: '20px 22px',
        maxWidth: 420,
        width: 'calc(100vw - 32px)',
        display: 'flex', flexDirection: 'column', gap: 14,
        animation: 'notif-up 0.35s cubic-bezier(0.34,1.56,0.64,1)',
      }}>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 11, flexShrink: 0,
            background: 'rgba(16,185,129,0.12)',
            border: '1px solid rgba(16,185,129,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 21,
          }}>
            🔔
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              color: '#e5e7eb', fontWeight: 700, fontSize: 15,
              fontFamily: 'monospace', letterSpacing: 0.5,
            }}>
              Missile Alerts
            </div>
            <div style={{ color: '#6b7280', fontSize: 11, fontFamily: 'monospace', marginTop: 2 }}>
              Real-time conflict notifications
            </div>
          </div>
          <button
            onClick={handleDismiss}
            style={{
              background: 'transparent', border: 'none',
              color: '#4b5563', cursor: 'pointer',
              fontSize: 20, lineHeight: 1, padding: '2px 4px', flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* Body text */}
        {!status && (
          <div style={{
            color: '#9ca3af', fontSize: 13,
            fontFamily: 'sans-serif', lineHeight: 1.55,
          }}>
            {isUnsupported && iosDevice
              ? 'To receive missile alerts on iPhone, tap the Share button → "Add to Home Screen", then open the site from there to enable notifications.'
              : isUnsupported
              ? 'Your browser does not fully support push notifications. Try opening this site in Chrome or Edge to enable missile alerts.'
              : 'Get notified of missile launches, interceptions, and conflict updates as they happen.'}
          </div>
        )}

        {/* Status feedback */}
        {status === 'granted' && (
          <div style={{
            color: '#10b981', fontFamily: 'monospace', fontSize: 13,
            textAlign: 'center', padding: '4px 0',
          }}>
            ✓ Notifications enabled — you're all set
          </div>
        )}
        {status === 'denied' && (
          <div style={{
            color: '#9ca3af', fontFamily: 'monospace', fontSize: 12,
            textAlign: 'center', lineHeight: 1.5,
          }}>
            Blocked in browser settings.<br />
            You can re-enable under Site Settings → Notifications.
          </div>
        )}
        {status === 'unsupported' && (
          <div style={{
            color: '#9ca3af', fontFamily: 'monospace', fontSize: 12,
            textAlign: 'center', lineHeight: 1.5,
          }}>
            {iosDevice
              ? 'Add to Home Screen from Safari\'s Share menu to enable notifications.'
              : 'Try Chrome or Edge for full notification support.'}
          </div>
        )}
        {status === 'asking' && (
          <div style={{
            color: '#6b7280', fontFamily: 'monospace', fontSize: 12,
            textAlign: 'center',
          }}>
            Check the permission dialog in your browser…
          </div>
        )}

        {/* Action buttons — only while no status yet */}
        {!status && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleDismiss}
              style={{
                flex: 1, padding: '10px 0',
                background: 'transparent', border: '1px solid #374151',
                borderRadius: 8, color: '#6b7280',
                fontFamily: 'monospace', fontSize: 13, cursor: 'pointer',
              }}
            >
              Not now
            </button>
            <button
              onClick={handleAllow}
              style={{
                flex: 2, padding: '10px 0',
                background: 'linear-gradient(135deg, #059669, #10b981)',
                border: 'none', borderRadius: 8, color: '#fff',
                fontFamily: 'monospace', fontSize: 13, fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(16,185,129,0.3)',
              }}
            >
              🔔 Allow Notifications
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes notif-up {
          from { opacity: 0; transform: translateX(-50%) translateY(24px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </>
  );
}