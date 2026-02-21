import React, { Component, type ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import App from './App';
import './index.css';
import { initializeThemePreference } from './lib/themePreference';

const APP_RENDERED_EVENT = 'ml:app-rendered';
const RESCUE_OVERLAY_ID = 'ml-pwa-rescue-overlay';

declare global {
  interface Window {
    __APP_RENDERED__?: boolean;
  }
}

const dispatchUpdateAvailable = () => {
  window.dispatchEvent(
    new CustomEvent('ml:pwa-update-available', {
      detail: { updatedAt: Date.now() },
    })
  );
};

const triggerSkipWaiting = async () => {
  if (!('serviceWorker' in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations.map(async (registration) => {
      try {
        await registration.update();
      } catch {
        // Ignore update fetch errors and still attempt skip waiting.
      }

      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    })
  );
};

const reloadApplication = async () => {
  try {
    await triggerSkipWaiting();
  } catch {
    // Ignore and still force reload.
  }
  window.location.reload();
};

const clearCacheAndReload = async () => {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ('caches' in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((key) => window.caches.delete(key)));
    }
  } catch {
    // Ignore cleanup errors and still force reload.
  }
  window.location.reload();
};

const removeRescueOverlay = () => {
  const existing = document.getElementById(RESCUE_OVERLAY_ID);
  if (existing) {
    existing.remove();
  }
};

const showRescueOverlay = () => {
  if (document.getElementById(RESCUE_OVERLAY_ID)) return;

  const overlay = document.createElement('div');
  overlay.id = RESCUE_OVERLAY_ID;
  overlay.setAttribute(
    'style',
    [
      'position:fixed',
      'inset:0',
      'z-index:2147483647',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'padding:24px',
      'background:#020617',
      'color:#f8fafc',
      "font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",
    ].join(';')
  );

  const card = document.createElement('div');
  card.setAttribute(
    'style',
    [
      'width:min(420px,100%)',
      'background:#0f172a',
      'border:1px solid #334155',
      'border-radius:16px',
      'padding:20px',
      'box-shadow:0 20px 50px rgba(2,6,23,0.5)',
    ].join(';')
  );

  const title = document.createElement('h1');
  title.textContent = 'Aplikasi perlu dimuat ulang';
  title.setAttribute('style', 'margin:0 0 8px 0;font-size:20px;line-height:1.3;');

  const text = document.createElement('p');
  text.textContent = 'Ada pembaruan atau cache lama.';
  text.setAttribute('style', 'margin:0 0 16px 0;font-size:14px;color:#cbd5e1;');

  const actions = document.createElement('div');
  actions.setAttribute('style', 'display:flex;gap:10px;flex-wrap:wrap;');

  const reloadButton = document.createElement('button');
  reloadButton.type = 'button';
  reloadButton.textContent = 'Muat Ulang';
  reloadButton.setAttribute(
    'style',
    [
      'padding:10px 14px',
      'border:none',
      'border-radius:10px',
      'background:#059669',
      'color:#ecfeff',
      'font-weight:700',
      'cursor:pointer',
    ].join(';')
  );
  reloadButton.addEventListener('click', () => {
    void reloadApplication();
  });

  const clearCacheButton = document.createElement('button');
  clearCacheButton.type = 'button';
  clearCacheButton.textContent = 'Bersihkan Cache';
  clearCacheButton.setAttribute(
    'style',
    [
      'padding:10px 14px',
      'border:1px solid #475569',
      'border-radius:10px',
      'background:#1e293b',
      'color:#e2e8f0',
      'font-weight:600',
      'cursor:pointer',
    ].join(';')
  );
  clearCacheButton.addEventListener('click', () => {
    void clearCacheAndReload();
  });

  actions.appendChild(reloadButton);
  actions.appendChild(clearCacheButton);
  card.appendChild(title);
  card.appendChild(text);
  card.appendChild(actions);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
};

interface GlobalErrorBoundaryProps {
  children: ReactNode;
}

interface GlobalErrorBoundaryState {
  hasError: boolean;
}

class GlobalErrorBoundary extends Component<GlobalErrorBoundaryProps, GlobalErrorBoundaryState> {
  declare props: GlobalErrorBoundaryProps;

  state: GlobalErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): GlobalErrorBoundaryState {
    return {
      hasError: true,
    };
  }

  componentDidCatch(error: unknown) {
    console.error('Global error boundary caught', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 2147483647,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: '#020617',
          color: '#f8fafc',
          fontFamily: "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",
        }}
      >
        <div
          style={{
            width: 'min(420px, 100%)',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 16,
            padding: 20,
            boxShadow: '0 20px 50px rgba(2,6,23,0.5)',
          }}
        >
          <h1 style={{ margin: '0 0 8px 0', fontSize: 20, lineHeight: 1.3 }}>Aplikasi perlu dimuat ulang</h1>
          <p style={{ margin: '0 0 16px 0', fontSize: 14, color: '#cbd5e1' }}>Ada pembaruan atau cache lama.</p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                void reloadApplication();
              }}
              style={{
                padding: '10px 14px',
                border: 'none',
                borderRadius: 10,
                background: '#059669',
                color: '#ecfeff',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Muat Ulang
            </button>
            <button
              type="button"
              onClick={() => {
                void clearCacheAndReload();
              }}
              style={{
                padding: '10px 14px',
                border: '1px solid #475569',
                borderRadius: 10,
                background: '#1e293b',
                color: '#e2e8f0',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Bersihkan Cache
            </button>
          </div>
        </div>
      </div>
    );
  }
}

const watchServiceWorkerRegistration = (registration: ServiceWorkerRegistration) => {
  const emitIfWaiting = () => {
    if (registration.waiting) {
      dispatchUpdateAvailable();
    }
  };

  const attachWorkerStateListener = (worker: ServiceWorker | null) => {
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        emitIfWaiting();
      }
    });
  };

  emitIfWaiting();
  attachWorkerStateListener(registration.installing);

  registration.addEventListener('updatefound', () => {
    attachWorkerStateListener(registration.installing);
  });
};

const startRenderWatchdog = () => {
  window.__APP_RENDERED__ = false;

  const timer = window.setTimeout(() => {
    if (!window.__APP_RENDERED__) {
      showRescueOverlay();
    }
  }, 4000);

  const onRendered = () => {
    window.__APP_RENDERED__ = true;
    window.clearTimeout(timer);
    removeRescueOverlay();
  };

  window.addEventListener(APP_RENDERED_EVENT, onRendered);
};

initializeThemePreference();
startRenderWatchdog();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <App />
      <Analytics />
    </GlobalErrorBoundary>
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.dispatchEvent(
      new CustomEvent('ml:pwa-controllerchange', {
        detail: { changedAt: Date.now() },
      })
    );
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        watchServiceWorkerRegistration(registration);
      })
      .catch((error) => {
        console.error('SW registration failed', error);
      });
  });
}
