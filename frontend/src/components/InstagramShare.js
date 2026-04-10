/**
 * InstagramShare.js
 *
 * Generates a 1080×1920 Instagram-story-sized card containing live stats
 * from the dashboard, then:
 *   • Mobile (Web Share API available): opens the native share sheet so the
 *     user can pick Instagram → the image lands directly in Stories.
 *   • Desktop / unsupported: downloads the PNG so the user can share manually.
 *
 * The card includes the website URL (warinfo.net) so viewers can tap it as
 * a link sticker inside Instagram Stories.
 */

import React, { useState } from 'react';

const SITE_URL  = 'warinfo.net';
const SITE_FULL = 'https://warinfo.net';

// ─── Canvas card generator ───────────────────────────────────────────────────
function generateStoryCard(stats) {
  return new Promise((resolve) => {
    const W = 1080, H = 1920;
    const canvas = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // ── Background gradient ──────────────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0,   '#060911');
    bg.addColorStop(0.5, '#0d1117');
    bg.addColorStop(1,   '#0a0f1a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // ── Grid lines (subtle) ──────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(31,41,55,0.6)';
    ctx.lineWidth   = 1;
    for (let x = 0; x < W; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 60) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // ── Green accent top bar ─────────────────────────────────────────────────
    const bar = ctx.createLinearGradient(0, 0, W, 0);
    bar.addColorStop(0, '#10b981');
    bar.addColorStop(1, '#059669');
    ctx.fillStyle = bar;
    ctx.fillRect(0, 0, W, 8);

    // ── Crosshair icon (drawn) ───────────────────────────────────────────────
    const cx = 100, cy = 180, cr = 38;
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth   = 5;
    ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.stroke();
    [[cx - cr - 12, cy, cx - cr + 8, cy],[cx + cr - 8, cy, cx + cr + 12, cy],
     [cx, cy - cr - 12, cx, cy - cr + 8],[cx, cy + cr - 8, cx, cy + cr + 12],
    ].forEach(([x1,y1,x2,y2]) => {
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    });

    // ── Title ────────────────────────────────────────────────────────────────
    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 96px "Arial Black", Arial, sans-serif';
    ctx.fillText('MISSILE', 160, 145);
    ctx.fillText('TRACKING', 160, 255);
    ctx.fillStyle = '#10b981';
    ctx.fillText('DASHBOARD', 160, 365);

    // ── Divider ──────────────────────────────────────────────────────────────
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth   = 2;
    ctx.beginPath(); ctx.moveTo(60, 420); ctx.lineTo(W - 60, 420); ctx.stroke();

    // ── Date ─────────────────────────────────────────────────────────────────
    ctx.fillStyle = '#6b7280';
    ctx.font      = '36px "Courier New", monospace';
    ctx.fillText(new Date().toLocaleDateString('en-GB', {
      day: '2-digit', month: 'long', year: 'numeric'
    }), 60, 475);

    // ── Stats ────────────────────────────────────────────────────────────────
    const statItems = [
      { label: 'MISSILE STRIKES',       value: (stats.total_strikes   || 0).toLocaleString(), color: '#FF3B30' },
      { label: 'INTERCEPTED',           value: (stats.total_intercepted || 0).toLocaleString(), color: '#34C759' },
      { label: 'CASUALTIES',            value: (stats.total_casualties || 0).toLocaleString(), color: '#FF9500' },
      { label: 'LIVES LOST',            value: (stats.total_deceased   || 0).toLocaleString(), color: '#ef4444' },
      { label: 'INTERCEPTION RATE',     value: `${stats.interception_rate || 0}%`,             color: '#34C759' },
      { label: 'MISSILE COST (EST.)',   value: stats.total_missile_cost
          ? `$${(stats.total_missile_cost / 1e9).toFixed(1)}B`
          : 'N/A',                                                                             color: '#FF3B30' },
      { label: 'DEFENSE COST (EST.)',   value: stats.total_defense_cost
          ? `$${(stats.total_defense_cost / 1e9).toFixed(1)}B`
          : 'N/A',                                                                             color: '#34C759' },
    ];

    let y = 560;
    statItems.forEach(({ label, value, color }) => {
      // Card background
      ctx.fillStyle = 'rgba(20,26,36,0.85)';
      roundRect(ctx, 60, y, W - 120, 150, 16);
      ctx.fill();

      // Border left accent
      ctx.fillStyle = color;
      ctx.fillRect(60, y, 6, 150);

      // Label
      ctx.fillStyle = '#6b7280';
      ctx.font      = '30px "Courier New", monospace';
      ctx.fillText(label, 100, y + 52);

      // Value
      ctx.fillStyle = color;
      ctx.font      = 'bold 64px "Courier New", monospace';
      ctx.fillText(value, 100, y + 120);

      y += 172;
    });

    // ── Bottom section ───────────────────────────────────────────────────────
    const bottomY = H - 260;
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth   = 2;
    ctx.beginPath(); ctx.moveTo(60, bottomY); ctx.lineTo(W - 60, bottomY); ctx.stroke();

    // CTA text
    ctx.fillStyle = '#9ca3af';
    ctx.font      = '38px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Real-time global conflict monitoring', W / 2, bottomY + 70);

    // URL pill
    const pillW = 680, pillH = 90, pillX = (W - pillW) / 2, pillY = bottomY + 100;
    ctx.fillStyle = '#10b981';
    roundRect(ctx, pillX, pillY, pillW, pillH, 45);
    ctx.fill();

    ctx.fillStyle = '#000000';
    ctx.font      = 'bold 48px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`🔗 ${SITE_URL}`, W / 2, pillY + 62);

    // Tiny footnote
    ctx.fillStyle = '#374151';
    ctx.font      = '28px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Add link sticker in Instagram Stories → paste URL above', W / 2, H - 40);

    // ── Export ───────────────────────────────────────────────────────────────
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

// Helper: rounded rectangle path
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h,     x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y,         x + r, y);
  ctx.closePath();
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function InstagramShare({ stats }) {
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);  // brief success flash

  const handleShare = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const blob = await generateStoryCard(stats);
      const file = new File([blob], 'warinfo-insights.png', { type: 'image/png' });

      // ── Mobile: Web Share API (opens native share sheet → Instagram) ───────
      const canShareFiles =
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] });

      if (canShareFiles) {
        await navigator.share({
          files: [file],
          title: 'Missile Tracking Insights — warinfo.net',
          text: `🚀 Real-time missile conflict data\n🔗 ${SITE_FULL}`,
        });
        setDone(true);
        setTimeout(() => setDone(false), 3000);
      } else if (typeof navigator.share === 'function') {
        // Share API exists but can't share files — share URL only
        await navigator.share({ title: 'Missile Tracking Dashboard', url: SITE_FULL });
        setDone(true);
        setTimeout(() => setDone(false), 3000);
      } else {
        // Desktop fallback: download the image
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = 'warinfo-insights.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        setDone(true);
        setTimeout(() => setDone(false), 3000);
      }
    } catch (err) {
      // User cancelled share — not an error
      if (err.name !== 'AbortError') console.warn('Share error:', err);
    }
    setLoading(false);
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      padding: '18px 20px',
      background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(99,102,241,0.06))',
      border: '1px solid rgba(16,185,129,0.2)',
      borderRadius: 12,
    }}>
      {/* Label row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Instagram gradient icon */}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#f09433"/>
              <stop offset="25%"  stopColor="#e6683c"/>
              <stop offset="50%"  stopColor="#dc2743"/>
              <stop offset="75%"  stopColor="#cc2366"/>
              <stop offset="100%" stopColor="#bc1888"/>
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"
            stroke="url(#ig-grad)" strokeWidth="2" fill="none"/>
          <circle cx="12" cy="12" r="4.5"
            stroke="url(#ig-grad)" strokeWidth="2" fill="none"/>
          <circle cx="17.5" cy="6.5" r="1.2" fill="url(#ig-grad)"/>
        </svg>
        <span style={{
          color: '#e5e7eb', fontFamily: 'monospace', fontWeight: 700, fontSize: 14,
          letterSpacing: 0.5,
        }}>
          Share insights on your Story
        </span>
      </div>

      <p style={{
        color: '#6b7280', fontSize: 12, fontFamily: 'sans-serif',
        textAlign: 'center', margin: 0, lineHeight: 1.5, maxWidth: 340,
      }}>
        Generates a story card with today's live stats.
        Tap the button below, select Instagram, then add{' '}
        <span style={{ color: '#10b981', fontFamily: 'monospace' }}>{SITE_URL}</span>{' '}
        as a link sticker so your followers can visit the site.
      </p>

      {/* Share button */}
      <button
        onClick={handleShare}
        disabled={loading}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 28px',
          background: done
            ? 'linear-gradient(135deg, #059669, #10b981)'
            : loading
            ? '#374151'
            : 'linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
          border: 'none', borderRadius: 50,
          color: '#fff', fontFamily: 'monospace', fontWeight: 700, fontSize: 14,
          cursor: loading ? 'default' : 'pointer',
          boxShadow: done || loading ? 'none' : '0 4px 20px rgba(220,39,67,0.35)',
          transition: 'all 0.25s',
          whiteSpace: 'nowrap',
        }}
      >
        {done ? (
          <>✓ Done — check Instagram!</>
        ) : loading ? (
          <>Generating story card…</>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"
                stroke="white" strokeWidth="2" fill="none"/>
              <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="2" fill="none"/>
              <circle cx="17.5" cy="6.5" r="1.2" fill="white"/>
            </svg>
            Share to Instagram Story
          </>
        )}
      </button>

      {/* Desktop hint */}
      <p style={{
        color: '#4b5563', fontSize: 11, fontFamily: 'monospace',
        textAlign: 'center', margin: 0,
      }}>
        On mobile: share sheet opens instantly · On desktop: story card is downloaded
      </p>
    </div>
  );
}