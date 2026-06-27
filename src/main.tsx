import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App.tsx";
import "./index.css";

// Import your Publishable Key
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  console.error("Missing Publishable Key");
}

// Proactively block and intercept any requests to the Unicorn Studio watermark image
try {
  const originalSrcDescriptor = Object.getOwnPropertyDescriptor(
    HTMLImageElement.prototype,
    "src",
  );
  if (originalSrcDescriptor && originalSrcDescriptor.set) {
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      set: function (value: string) {
        if (
          typeof value === "string" &&
          value.includes("assets.unicorn.studio/media/us_fwb.png")
        ) {
          // Replace with a 1x1 transparent base64 GIF to block the request
          originalSrcDescriptor.set.call(
            this,
            "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
          );
          return;
        }
        originalSrcDescriptor.set.call(this, value);
      },
      get: function () {
        return originalSrcDescriptor.get
          ? originalSrcDescriptor.get.call(this)
          : "";
      },
    });
  }
} catch (e) {
  console.warn("Failed to intercept HTMLImageElement.src", e);
}

try {
  const originalSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    if (
      typeof value === "string" &&
      value.includes("assets.unicorn.studio/media/us_fwb.png")
    ) {
      return originalSetAttribute.call(
        this,
        name,
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      );
    }
    return originalSetAttribute.call(this, name, value);
  };
} catch (e) {
  console.warn("Failed to intercept Element.setAttribute", e);
}

try {
  const originalSetProperty = CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty = function (
    property,
    value,
    priority,
  ) {
    if (
      typeof value === "string" &&
      value.includes("assets.unicorn.studio/media/us_fwb.png")
    ) {
      return originalSetProperty.call(this, property, "none", priority);
    }
    return originalSetProperty.call(this, property, value, priority);
  };
} catch (e) {
  console.warn("Failed to intercept CSSStyleDeclaration.setProperty", e);
}

try {
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const firstArg = args[0];
    const url =
      typeof firstArg === "string"
        ? firstArg
        : firstArg instanceof URL ||
            (firstArg && typeof firstArg === "object" && "url" in firstArg)
          ? (firstArg as any).url
          : "";
    if (
      typeof url === "string" &&
      url.includes("assets.unicorn.studio/media/us_fwb.png")
    ) {
      return new Response(new Blob(), { status: 404, statusText: "Not Found" });
    }
    return originalFetch.apply(this, args);
  };
} catch (e) {
  console.warn("Failed to intercept window.fetch", e);
}

try {
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    ...rest: any[]
  ) {
    const urlString = typeof url === "string" ? url : url.toString();
    if (urlString.includes("assets.unicorn.studio/media/us_fwb.png")) {
      return originalOpen.call(
        this,
        method,
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
        ...(rest as any),
      );
    }
    return originalOpen.call(this, method, url, ...(rest as any));
  };
} catch (e) {
  console.warn("Failed to intercept XMLHttpRequest open", e);
}

// Set up MutationObserver to aggressively find and delete any nested watermarks
try {
  const removeWatermarkElements = () => {
    // Look for links to unicorn.studio
    const links = document.querySelectorAll('a[href*="unicorn.studio"]');
    links.forEach((link) => {
      link.remove();
    });

    // Look for images requesting the watermark
    const images = document.querySelectorAll(
      'img[src*="us_fwb.png"], img[src*="unicorn.studio"]',
    );
    images.forEach((img) => {
      img.remove();
    });

    // Look for divs with watermark classes/styles
    const watermarkDivs = document.querySelectorAll(
      '[class*="unicorn-watermark"], [id*="unicorn-watermark"], [class*="us-watermark"], [class*="us_watermark"]',
    );
    watermarkDivs.forEach((div) => {
      div.remove();
    });
  };

  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const observer = new MutationObserver((mutations) => {
      removeWatermarkElements();
    });

    document.addEventListener("DOMContentLoaded", () => {
      removeWatermarkElements();
      observer.observe(document.body, { childList: true, subtree: true });
    });

    // Fallback periodic sweep
    setInterval(removeWatermarkElements, 500);
  }
} catch (e) {
  console.warn("Failed to set up watermark MutationObserver", e);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {PUBLISHABLE_KEY ? (
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
        <BrowserRouter>
          <Routes>
            <Route path="/*" element={<App />} />
          </Routes>
        </BrowserRouter>
      </ClerkProvider>
    ) : (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          backgroundColor: "#050505",
          color: "white",
          fontFamily: "monospace",
        }}
      >
        <h2>Missing Clerk Publishable Key</h2>
        <p>
          Please set <code>VITE_CLERK_PUBLISHABLE_KEY</code> in your environment
          variables.
        </p>
      </div>
    )}
  </StrictMode>,
);
