import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

// Proactively block and intercept any requests to the Unicorn Studio watermark image
try {
  const originalSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  if (originalSrcDescriptor && originalSrcDescriptor.set) {
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      set: function (value: string) {
        if (typeof value === 'string' && value.includes('assets.unicorn.studio/media/us_fwb.png')) {
          // Replace with a 1x1 transparent base64 GIF to block the request
          originalSrcDescriptor.set.call(this, 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
          return;
        }
        originalSrcDescriptor.set.call(this, value);
      },
      get: function () {
        return originalSrcDescriptor.get ? originalSrcDescriptor.get.call(this) : '';
      }
    });
  }
} catch (e) {
  console.warn("Failed to intercept HTMLImageElement.src", e);
}

try {
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const firstArg = args[0];
    const url = typeof firstArg === 'string' ? firstArg : (firstArg instanceof URL || (firstArg && typeof firstArg === 'object' && 'url' in firstArg) ? (firstArg as any).url : '');
    if (typeof url === 'string' && url.includes('assets.unicorn.studio/media/us_fwb.png')) {
      return new Response(new Blob(), { status: 404, statusText: 'Not Found' });
    }
    return originalFetch.apply(this, args);
  };
} catch (e) {
  console.warn("Failed to intercept window.fetch", e);
}

try {
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: any[]) {
    const urlString = typeof url === 'string' ? url : url.toString();
    if (urlString.includes('assets.unicorn.studio/media/us_fwb.png')) {
      return originalOpen.call(this, method, 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', ...rest as any);
    }
    return originalOpen.call(this, method, url, ...rest as any);
  };
} catch (e) {
  console.warn("Failed to intercept XMLHttpRequest open", e);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
