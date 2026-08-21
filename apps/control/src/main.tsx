import "@fontsource/manrope/400.css";
import "@fontsource/manrope/600.css";
import "@fontsource/instrument-serif/400.css";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  DEFAULT_SETTINGS,
  isDisplaySettings,
  type ClientMessage,
  type DisplaySettings,
  type ServerMessage,
  type SimulatorCommand,
} from "@packethalo/protocol";
import { SCENARIOS, type SimulationSpeed } from "@packethalo/simulator-core";
import "./styles.css";

const modes: readonly DisplaySettings["mode"][] = [
  "halo",
  "globe",
  "constellation",
  "ambient",
  "forensic",
];
const themes: readonly DisplaySettings["theme"][] = [
  "ambient-black",
  "midnight-blue",
  "aurora",
  "cyber-green",
  "deep-space",
  "monochrome",
  "projector",
  "oled",
  "accessibility",
];

function ControlApp() {
  const socket = useRef<WebSocket | undefined>(undefined);
  const [status, setStatus] = useState<"connecting" | "connected" | "offline">(
    "connecting",
  );
  const [settings, setSettings] = useState<DisplaySettings>(DEFAULT_SETTINGS);
  const [connectionError, setConnectionError] = useState("");
  const [endpoint, setEndpoint] = useState(loadEndpoint);
  const [token, setToken] = useState("");
  const [scenarioId, setScenarioId] = useState("movie-night");
  const [simulatorSeed, setSimulatorSeed] = useState("phone-halo-42");

  const connect = () => {
    socket.current?.close();
    setStatus("connecting");
    try {
      const url = new URL(endpoint);
      if (
        (url.protocol !== "ws:" && url.protocol !== "wss:") ||
        url.username ||
        url.password
      )
        throw new Error("invalid-endpoint");
      if (token) url.searchParams.set("token", token);
      const next = new WebSocket(url);
      socket.current = next;
      next.addEventListener("open", () => {
        if (socket.current !== next) return;
        setStatus("connected");
        setConnectionError("");
        try {
          localStorage.setItem("packethalo:control-endpoint", endpoint);
        } catch {
          /* The connection remains active when browser storage is blocked. */
        }
      });
      next.addEventListener("close", () => {
        if (socket.current !== next) return;
        setStatus("offline");
        setConnectionError(
          "Display unavailable. Check its address and LAN token, then reconnect.",
        );
      });
      next.addEventListener("error", () => next.close());
      next.addEventListener("message", (message) => {
        try {
          const data = JSON.parse(String(message.data)) as ClientMessage;
          if (data.type === "settings" && isDisplaySettings(data.settings))
            setSettings(data.settings);
          if (data.type === "error") setConnectionError(data.message);
        } catch {
          setConnectionError("The display sent an invalid control message.");
        }
      });
    } catch {
      setStatus("offline");
      setConnectionError("Enter a valid ws:// or wss:// display address.");
    }
  };

  useEffect(() => {
    connect();
    return () => socket.current?.close();
  }, []);

  const update = (patch: Partial<DisplaySettings>) => {
    if (socket.current?.readyState !== WebSocket.OPEN) {
      setConnectionError("Connect to the display before changing its light.");
      return;
    }
    setSettings((current) => ({ ...current, ...patch }));
    socket.current.send(
      JSON.stringify({
        type: "settings.update",
        patch,
      } satisfies ServerMessage),
    );
  };

  const controlSimulator = (command: SimulatorCommand) => {
    if (socket.current?.readyState !== WebSocket.OPEN) {
      setConnectionError(
        "Connect to the display before controlling its scene.",
      );
      return;
    }
    socket.current.send(
      JSON.stringify({
        type: "simulator.update",
        command,
      } satisfies ServerMessage),
    );
  };

  return (
    <main>
      <header>
        <div className="logo">
          <i />
          <span>
            Packet<b>Halo</b>
          </span>
        </div>
        <span className={`status ${status}`} role="status">
          {status}
        </span>
      </header>
      <section className="hero">
        <small>REMOTE INSTRUMENT</small>
        <h1>Shape the room.</h1>
        <p>
          Every change travels directly to the local display. No cloud passes
          between your hand and the light.
        </p>
      </section>
      <section>
        <h2>Display mode</h2>
        <div className="mode-grid">
          {modes.map((mode, index) => (
            <button
              key={mode}
              className={settings.mode === mode ? "active" : ""}
              onClick={() => update({ mode })}
            >
              <small>0{index + 1}</small>
              <span>{mode}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="simulator-controls">
        <h2>Simulator</h2>
        <select
          aria-label="Simulator scene"
          value={scenarioId}
          onChange={(event) => {
            const next = event.target.value;
            setScenarioId(next);
            controlSimulator({
              action: "scenario",
              scenarioId: next,
              seed: simulatorSeed,
            });
          }}
        >
          {SCENARIOS.map((scenario) => (
            <option key={scenario.id} value={scenario.id}>
              {scenario.name}
            </option>
          ))}
        </select>
        <div className="simulator-actions">
          <button onClick={() => controlSimulator({ action: "pause" })}>
            Pause
          </button>
          <button onClick={() => controlSimulator({ action: "resume" })}>
            Resume
          </button>
          <button onClick={() => controlSimulator({ action: "record.toggle" })}>
            Record / stop
          </button>
          <button onClick={() => controlSimulator({ action: "replay" })}>
            Replay
          </button>
        </div>
        <div
          className="simulator-speeds"
          aria-label="Simulator and replay speed"
        >
          {(
            [0.25, 1, 2, 5, 20] as const satisfies readonly SimulationSpeed[]
          ).map((speed) => (
            <button
              key={speed}
              onClick={() => controlSimulator({ action: "speed", speed })}
            >
              ×{speed}
            </button>
          ))}
        </div>
        <label className="simulator-seed">
          REPEATABLE SEED
          <span>
            <input
              value={simulatorSeed}
              maxLength={120}
              onChange={(event) => setSimulatorSeed(event.target.value)}
            />
            <button
              onClick={() =>
                controlSimulator({ action: "seed", seed: simulatorSeed })
              }
            >
              Apply
            </button>
          </span>
        </label>
      </section>
      <section>
        <h2>Light</h2>
        <ControlRange
          label="Orbit tempo"
          value={settings.animationSpeed}
          min={0.25}
          max={3}
          step={0.05}
          onChange={(animationSpeed) => update({ animationSpeed })}
        />
        <ControlRange
          label="Glow"
          value={settings.glow}
          min={0}
          max={1.5}
          step={0.05}
          onChange={(glow) => update({ glow })}
        />
        <ControlRange
          label="Particles"
          value={settings.particleCount}
          min={8}
          max={160}
          step={4}
          onChange={(particleCount) => update({ particleCount })}
        />
        <ControlRange
          label="Afterglow"
          value={settings.retentionSeconds}
          min={6}
          max={60}
          step={1}
          onChange={(retentionSeconds) => update({ retentionSeconds })}
        />
      </section>
      <section>
        <h2>Theme</h2>
        <select
          aria-label="Display theme"
          value={settings.theme}
          onChange={(event) =>
            update({ theme: event.target.value as DisplaySettings["theme"] })
          }
        >
          {themes.map((theme) => (
            <option key={theme} value={theme}>
              {theme.replaceAll("-", " ")}
            </option>
          ))}
        </select>
      </section>
      <section>
        <h2>Projection rotation</h2>
        <div className="segments">
          {([0, 90, 180, 270] as const).map((value) => (
            <button
              key={value}
              className={settings.projectionRotation === value ? "active" : ""}
              onClick={() => update({ projectionRotation: value })}
            >
              {value}°
            </button>
          ))}
        </div>
      </section>
      <section className="toggles">
        <label>
          <span>
            <b>Privacy veil</b>
            <small>Mask addresses on the display</small>
          </span>
          <input
            type="checkbox"
            checked={settings.privacyMode}
            onChange={(event) => update({ privacyMode: event.target.checked })}
          />
        </label>
        <label>
          <span>
            <b>Reduced motion</b>
            <small>Slow down the sky</small>
          </span>
          <input
            type="checkbox"
            checked={settings.reducedMotion}
            onChange={(event) =>
              update({ reducedMotion: event.target.checked })
            }
          />
        </label>
      </section>
      <section className="connection">
        <h2>Local connection</h2>
        <label>
          DISPLAY ADDRESS
          <input
            type="url"
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value)}
          />
        </label>
        <label>
          LAN TOKEN <em>kept in memory only</em>
          <input
            type="password"
            value={token}
            maxLength={256}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setToken(event.target.value)}
          />
        </label>
        <button onClick={connect}>Connect to display</button>
        {connectionError && (
          <p className="connection-error" role="alert">
            {connectionError}
          </p>
        )}
      </section>
      <footer>Packet contents are never inspected.</footer>
    </main>
  );
}

function ControlRange({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="range">
      <span>
        {label}
        <output>{value}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

createRoot(document.getElementById("root")!).render(<ControlApp />);

function loadEndpoint(): string {
  const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
  const configured = import.meta.env.VITE_PACKET_HALO_CONTROL as
    string | undefined;
  try {
    return (
      localStorage.getItem("packethalo:control-endpoint") ||
      configured ||
      `${scheme}//${window.location.hostname}:8787/control`
    );
  } catch {
    return configured || `${scheme}//${window.location.hostname}:8787/control`;
  }
}
