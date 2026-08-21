import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/instrument-serif/400.css";
import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  public override state = { failed: false };

  public static getDerivedStateFromError() {
    return { failed: true };
  }

  public override componentDidCatch(): void {
    // Error details stay in the local browser and are never transmitted.
  }

  public override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="fatal-error" data-theme="ambient-black">
        <span>LOCAL OBSERVATORY</span>
        <h1>The light went quiet.</h1>
        <p>
          PacketHalo could not render this scene. Your local settings and
          recordings have not been uploaded or changed.
        </p>
        <button onClick={() => window.location.reload()}>
          Restart display
        </button>
      </main>
    );
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener(
    "load",
    () =>
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        /* The online observatory remains usable if offline setup is blocked. */
      }),
  );
}
