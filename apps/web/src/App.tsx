import { useEffect, useMemo, useRef, useState } from "react";
import type { DisplaySettings, FlowEvent } from "@packethalo/protocol";
import { PRODUCT } from "@packethalo/config";
import { formatBytes } from "@packethalo/shared";
import { SCENARIOS } from "@packethalo/simulator-core";
import {
  ChevronIcon,
  CloseIcon,
  ExpandIcon,
  PauseIcon,
  PlayIcon,
  RecordIcon,
  ShieldIcon,
  ShuffleIcon,
  SlidersIcon,
  SparkIcon,
} from "./icons";
import { useHaloRuntime } from "./useHaloRuntime";

const MODES: readonly {
  id: DisplaySettings["mode"];
  label: string;
  key: string;
}[] = [
  { id: "halo", label: "Halo", key: "01" },
  { id: "globe", label: "Globe", key: "02" },
  { id: "constellation", label: "Constellation", key: "03" },
  { id: "ambient", label: "Ambient", key: "04" },
  { id: "forensic", label: "Forensic", key: "05" },
];

const THEMES: readonly {
  id: DisplaySettings["theme"];
  label: string;
  colors: readonly [string, string];
}[] = [
  {
    id: "ambient-black",
    label: "Ambient black",
    colors: ["#81ead1", "#f3d7a0"],
  },
  {
    id: "midnight-blue",
    label: "Midnight blue",
    colors: ["#6bd9ff", "#8e9dff"],
  },
  { id: "aurora", label: "Aurora", colors: ["#5df2bb", "#a88bff"] },
  { id: "cyber-green", label: "Cyber green", colors: ["#70ff94", "#d5ff9c"] },
  { id: "deep-space", label: "Deep space", colors: ["#75c8ff", "#cf8aff"] },
  { id: "monochrome", label: "Monochrome", colors: ["#ffffff", "#898989"] },
  { id: "projector", label: "Projector", colors: ["#b8ffec", "#fff1c7"] },
  { id: "oled", label: "OLED", colors: ["#6fe0c5", "#eab67e"] },
  {
    id: "accessibility",
    label: "High contrast",
    colors: ["#00ffff", "#ffdf00"],
  },
];

const SPEEDS = [0.25, 1, 2, 5, 20] as const;
const MAX_RECORDING_FILE_BYTES = 10 * 1024 * 1024;

export function App() {
  const runtime = useHaloRuntime();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scenariosOpen, setScenariosOpen] = useState(false);
  const [controlsHidden, setControlsHidden] = useState(false);
  const [seedDraft, setSeedDraft] = useState(runtime.seed);
  const [recordingError, setRecordingError] = useState("");
  const [recordingNotice, setRecordingNotice] = useState("");
  const importInput = useRef<HTMLInputElement>(null);
  const scenarioDialog = useRef<HTMLElement>(null);
  const settingsDialog = useRef<HTMLElement>(null);
  const [aliases, setAliases] = useState<Record<string, string>>(loadAliases);
  const activeScenario =
    SCENARIOS.find((scenario) => scenario.id === runtime.scenarioId) ??
    SCENARIOS[0]!;
  const latest = runtime.latestEvents.at(-1);
  const observed = useMemo(
    () => summarize(runtime.latestEvents),
    [runtime.latestEvents],
  );
  const countryOptions = useMemo(
    () => [
      ...new Map(
        runtime.latestEvents.map((event) => [
          event.geo.countryCode,
          event.geo.country,
        ]),
      ).entries(),
    ],
    [runtime.latestEvents],
  );
  const asnOptions = useMemo(
    () => [
      ...new Map(
        runtime.latestEvents.map((event) => [event.asn, event.organization]),
      ).entries(),
    ],
    [runtime.latestEvents],
  );
  const deviceOptions = useMemo(
    () => [
      ...new Map(
        runtime.latestEvents.map((event) => [event.deviceId, event.deviceName]),
      ).entries(),
    ],
    [runtime.latestEvents],
  );
  const ambient = runtime.settings.mode === "ambient";

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement
      )
        return;
      if (event.key === " ") {
        event.preventDefault();
        runtime.togglePause();
      }
      if (event.key.toLowerCase() === "m") {
        const index = MODES.findIndex(
          (mode) => mode.id === runtime.settings.mode,
        );
        runtime.setSettings({ mode: MODES[(index + 1) % MODES.length]!.id });
      }
      if (event.key.toLowerCase() === "c") setControlsHidden((value) => !value);
      if (event.key.toLowerCase() === "f")
        void document.documentElement
          .requestFullscreen?.()
          .catch(() => undefined);
      if (event.key === "Escape") {
        setSettingsOpen(false);
        setScenariosOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runtime]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "packethalo:device-aliases",
        JSON.stringify(aliases),
      );
    } catch {
      /* Aliases remain available for this session when storage is blocked. */
    }
  }, [aliases]);

  useEffect(() => {
    const dialog = scenariosOpen
      ? scenarioDialog.current
      : settingsOpen
        ? settingsDialog.current
        : undefined;
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () =>
      [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((element) => !element.hasAttribute("hidden"));
    focusable()[0]?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", trapFocus);
    return () => {
      dialog.removeEventListener("keydown", trapFocus);
      previous?.focus();
    };
  }, [scenariosOpen, settingsOpen]);

  const selectScenario = (id: string) => {
    runtime.setScenario(id);
    setScenariosOpen(false);
  };

  const jumpToNextEvent = () => {
    if (!runtime.lastRecording) return;
    const offsets = runtime.lastRecording.events.map(
      (event) => event.timestamp - runtime.lastRecording!.startedAt,
    );
    runtime.scrub(
      offsets.find((offset) => offset > runtime.playhead + 1) ??
        offsets[0] ??
        0,
    );
  };

  const exportRecording = () => {
    if (!runtime.lastRecording) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(runtime.lastRecording, null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${runtime.lastRecording.scenarioId}-${runtime.lastRecording.seed}.packethalo.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setRecordingError("");
    setRecordingNotice("Metadata recording exported locally.");
  };

  const importRecording = async (file: File | undefined) => {
    if (!file) return;
    setRecordingNotice("");
    if (file.size > MAX_RECORDING_FILE_BYTES) {
      setRecordingError("That recording is larger than the 10 MB local limit.");
      return;
    }
    try {
      const loaded = runtime.loadRecording(
        JSON.parse(await file.text()) as unknown,
      );
      setRecordingError(
        loaded
          ? ""
          : "That file is not a valid metadata-only PacketHalo recording.",
      );
      if (loaded)
        setRecordingNotice("Metadata recording loaded and ready to replay.");
    } catch {
      setRecordingError("That file is not valid JSON.");
    }
  };

  const clearBrowserData = () => {
    if (
      !window.confirm(
        "Clear local aliases, display preferences, and the in-memory recording? SQLite history is not affected.",
      )
    )
      return;
    try {
      localStorage.removeItem("packethalo:device-aliases");
      localStorage.removeItem("packethalo:display-settings");
    } catch {
      /* In-memory data can still be cleared when storage is unavailable. */
    }
    setAliases({});
    runtime.clearLocalSession();
    setRecordingError("");
    setRecordingNotice("Browser-only PacketHalo data cleared.");
  };

  return (
    <main
      className={`observatory ${ambient ? "is-ambient" : ""} ${controlsHidden ? "controls-hidden" : ""}`}
      data-theme={runtime.settings.theme}
      data-renderer-fps={runtime.metrics.fps}
      data-active-flows={runtime.metrics.activeFlows}
      data-frame-time={runtime.metrics.frameTimeMs.toFixed(2)}
      style={
        {
          "--rotation": `${runtime.settings.projectionRotation}deg`,
        } as React.CSSProperties
      }
    >
      <a className="skip-link" href="#instrument-dock">
        Skip to controls
      </a>
      <canvas
        ref={runtime.setCanvas}
        className="sky-canvas"
        aria-hidden="true"
      />
      <div className="atmosphere" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />

      <header className="masthead interface-layer">
        <button
          className="wordmark"
          onClick={() => setControlsHidden(false)}
          aria-label="PacketHalo home"
        >
          <span className="mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            Packet<span>Halo</span>
          </span>
        </button>
        <div className="masthead-center" aria-live="polite">
          <span className={`live-orb ${runtime.paused ? "paused" : ""}`} />
          {runtime.paused ? "Observation paused" : "Live local simulation"}
        </div>
        <button
          className="quiet-button"
          onClick={() =>
            void document.documentElement
              .requestFullscreen?.()
              .catch(() => undefined)
          }
          title="Fullscreen (F)"
        >
          <ExpandIcon /> <span>Project</span>
        </button>
      </header>

      <section
        className="scene-caption interface-layer"
        aria-labelledby="scene-title"
      >
        <span className="micro-label">{activeScenario.eyebrow}</span>
        <h1 id="scene-title">{activeScenario.name}</h1>
        <p>{activeScenario.description}</p>
      </section>

      <section
        className="observation-card interface-layer"
        aria-label="Latest observation"
      >
        <div className="observation-rule">
          <span>
            {latest
              ? `${latest.geo.countryCode} · AS${latest.asn}`
              : "Awaiting light"}
          </span>
          <i />
        </div>
        {latest ? (
          <FlowObservation
            event={latest}
            privateMode={runtime.settings.privacyMode}
            deviceName={aliases[latest.deviceId] || latest.deviceName}
          />
        ) : (
          <div className="observation-empty">
            <SparkIcon />
            <p>The simulator is preparing the first connection.</p>
          </div>
        )}
      </section>

      <section
        className="measurements interface-layer"
        aria-label="Live summary"
      >
        <Metric
          value={runtime.stats.eventCount.toLocaleString()}
          label="connections"
        />
        <Metric value={formatBytes(runtime.stats.bytes)} label="observed" />
        <Metric value={String(runtime.stats.countries)} label="countries" />
      </section>

      <div className="privacy-promise interface-layer">
        <ShieldIcon />
        <span>{PRODUCT.privacyPromise}</span>
      </div>

      <div className="mode-legend interface-layer" aria-hidden="true">
        <span>In</span>
        <i className="inbound" />
        <span>Out</span>
        <i className="outbound" />
      </div>

      {!controlsHidden && (
        <section
          id="instrument-dock"
          className="instrument-dock interface-layer"
          aria-label="Playback and display controls"
        >
          <div className="dock-group playback-group">
            <button
              className="primary-control"
              onClick={runtime.togglePause}
              aria-label={
                runtime.paused ? "Resume simulation" : "Pause simulation"
              }
              title="Pause or resume (Space)"
            >
              {runtime.paused ? <PlayIcon /> : <PauseIcon />}
            </button>
            <div className="speed-control" aria-label="Simulation speed">
              {SPEEDS.map((value) => (
                <button
                  key={value}
                  className={runtime.speed === value ? "active" : ""}
                  onClick={() => runtime.setSpeed(value)}
                >
                  ×{value}
                </button>
              ))}
            </div>
          </div>

          <button
            className="scenario-switch"
            onClick={() => setScenariosOpen(true)}
            aria-expanded={scenariosOpen}
          >
            <span>
              <small>SIMULATOR SCENE</small>
              {activeScenario.name}
            </span>
            <ChevronIcon />
          </button>

          <div className="mode-switch" role="group" aria-label="Display mode">
            {MODES.map((mode) => (
              <button
                key={mode.id}
                className={runtime.settings.mode === mode.id ? "active" : ""}
                onClick={() => runtime.setSettings({ mode: mode.id })}
                title={`${mode.label} mode`}
                aria-label={`${mode.label} mode`}
              >
                <small>{mode.key}</small>
                <span>{mode.label}</span>
              </button>
            ))}
          </div>

          <div className="dock-group action-group">
            <button
              className={`icon-button record-button ${runtime.recording ? "recording" : ""}`}
              onClick={runtime.toggleRecording}
              aria-label={
                runtime.recording ? "Stop recording" : "Record session"
              }
              title="Record session"
            >
              <RecordIcon />
            </button>
            <button
              className={`icon-button ${settingsOpen ? "active" : ""}`}
              onClick={() => setSettingsOpen(true)}
              aria-label="Open controls"
              title="Control panel"
            >
              <SlidersIcon />
            </button>
          </div>
        </section>
      )}

      {runtime.lastRecording && !controlsHidden && (
        <section
          className="timeline interface-layer"
          aria-label="Recorded session timeline"
        >
          <button onClick={runtime.startReplay} aria-label="Replay recording">
            <PlayIcon />
          </button>
          <span>{formatClock(runtime.playhead)}</span>
          <input
            type="range"
            min="0"
            max={Math.max(1, runtime.lastRecording.durationMs)}
            value={runtime.playhead}
            onChange={(event) => runtime.scrub(Number(event.target.value))}
            aria-label="Replay position"
          />
          <button
            onClick={jumpToNextEvent}
            aria-label="Jump to next event"
            title="Jump to next event"
          >
            <SparkIcon />
          </button>
          <span>{formatClock(runtime.lastRecording.durationMs)}</span>
          <small>
            {runtime.replaying
              ? "REPLAYING"
              : `${runtime.lastRecording.events.length} EVENTS`}
          </small>
        </section>
      )}

      {controlsHidden && (
        <button
          className="reveal-controls interface-layer"
          onClick={() => setControlsHidden(false)}
        >
          Reveal instruments <kbd>C</kbd>
        </button>
      )}

      {scenariosOpen && (
        <div
          className="panel-scrim interface-layer"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setScenariosOpen(false);
          }}
        >
          <section
            ref={scenarioDialog}
            className="scenario-library"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scenario-heading"
            tabIndex={-1}
          >
            <header>
              <div>
                <span className="micro-label">Built-in observatory</span>
                <h2 id="scenario-heading">Choose a living scene</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setScenariosOpen(false)}
                aria-label="Close scenarios"
              >
                <CloseIcon />
              </button>
            </header>
            <p className="panel-intro">
              Each scene is deterministic, metadata-only, and ready without
              capture permissions.
            </p>
            <div className="scenario-grid">
              {SCENARIOS.map((scenario, index) => (
                <button
                  key={scenario.id}
                  className={scenario.id === runtime.scenarioId ? "active" : ""}
                  onClick={() => selectScenario(scenario.id)}
                >
                  <small>{String(index + 1).padStart(2, "0")}</small>
                  <span>
                    <strong>{scenario.name}</strong>
                    <em>{scenario.eyebrow}</em>
                  </span>
                  <i data-mood={scenario.mood} />
                </button>
              ))}
            </div>
            <footer>
              <label htmlFor="seed">REPEATABLE SEED</label>
              <div className="seed-control">
                <input
                  id="seed"
                  value={seedDraft}
                  maxLength={120}
                  onChange={(event) => setSeedDraft(event.target.value)}
                />
                <button onClick={() => runtime.setSeed(seedDraft)}>
                  Apply
                </button>
                <button
                  aria-label="Generate new seed"
                  onClick={() => {
                    const next = `halo-${Math.floor(Math.random() * 9_999)}`;
                    setSeedDraft(next);
                    runtime.setSeed(next);
                  }}
                >
                  <ShuffleIcon />
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}

      {settingsOpen && (
        <div
          className="control-scrim interface-layer"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSettingsOpen(false);
          }}
        >
          <aside
            ref={settingsDialog}
            className="control-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="controls-heading"
            tabIndex={-1}
          >
            <header>
              <div>
                <span className="micro-label">Live instrumentation</span>
                <h2 id="controls-heading">Shape the light</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setSettingsOpen(false)}
                aria-label="Close controls"
              >
                <CloseIcon />
              </button>
            </header>
            <section>
              <h3>Light character</h3>
              <Range
                label="Orbit tempo"
                value={runtime.settings.animationSpeed}
                min={0.25}
                max={3}
                step={0.05}
                format={(value) => `×${value.toFixed(2)}`}
                onChange={(animationSpeed) =>
                  runtime.setSettings({ animationSpeed })
                }
              />
              <Range
                label="Glow"
                value={runtime.settings.glow}
                min={0}
                max={1.5}
                step={0.05}
                format={(value) => `${Math.round(value * 100)}%`}
                onChange={(glow) => runtime.setSettings({ glow })}
              />
              <Range
                label="Particles"
                value={runtime.settings.particleCount}
                min={8}
                max={160}
                step={4}
                format={String}
                onChange={(particleCount) =>
                  runtime.setSettings({ particleCount })
                }
              />
              <Range
                label="Afterglow"
                value={runtime.settings.retentionSeconds}
                min={6}
                max={60}
                step={1}
                format={(value) => `${value}s`}
                onChange={(retentionSeconds) =>
                  runtime.setSettings({ retentionSeconds })
                }
              />
            </section>
            <section>
              <h3>Palette</h3>
              <div className="theme-grid">
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    className={
                      runtime.settings.theme === theme.id ? "active" : ""
                    }
                    onClick={() => runtime.setSettings({ theme: theme.id })}
                  >
                    <i
                      style={
                        {
                          "--a": theme.colors[0],
                          "--b": theme.colors[1],
                        } as React.CSSProperties
                      }
                    />
                    <span>{theme.label}</span>
                  </button>
                ))}
              </div>
            </section>
            <section className="focus-controls">
              <h3>Focus filters</h3>
              <FilterRow
                label="Country"
                options={countryOptions.map(([value, name]) => ({
                  value,
                  label: `${value} · ${name}`,
                }))}
                selected={runtime.settings.countryFilters}
                onChange={(countryFilters) =>
                  runtime.setSettings({ countryFilters })
                }
              />
              <FilterRow
                label="Network"
                options={asnOptions.map(([value, name]) => ({
                  value,
                  label: `AS${value} · ${name}`,
                }))}
                selected={runtime.settings.asnFilters}
                onChange={(asnFilters) => runtime.setSettings({ asnFilters })}
              />
              <FilterRow
                label="Device"
                options={deviceOptions.map(([value, name]) => ({
                  value,
                  label: aliases[value] || name,
                }))}
                selected={runtime.settings.deviceFilters}
                onChange={(deviceFilters) =>
                  runtime.setSettings({ deviceFilters })
                }
              />
            </section>
            {deviceOptions.length > 0 && (
              <section className="alias-controls">
                <h3>Device aliases</h3>
                {deviceOptions.map(([id, name]) => (
                  <label key={id}>
                    <span>{name}</span>
                    <input
                      value={aliases[id] || ""}
                      placeholder="Add a local alias"
                      maxLength={80}
                      onChange={(event) =>
                        setAliases((current) => ({
                          ...current,
                          [id]: event.target.value,
                        }))
                      }
                    />
                  </label>
                ))}
              </section>
            )}
            <section className="recording-controls">
              <h3>Recorded sessions</h3>
              <p>
                Import and replay versioned metadata locally. Files never leave
                this browser.
              </p>
              <div>
                <button onClick={() => importInput.current?.click()}>
                  Import recording
                </button>
                <button
                  disabled={!runtime.lastRecording}
                  onClick={exportRecording}
                >
                  Export current
                </button>
                <button className="clear-local" onClick={clearBrowserData}>
                  Clear browser data
                </button>
              </div>
              <input
                ref={importInput}
                className="sr-only"
                type="file"
                accept=".json,.packethalo.json,application/json"
                onChange={(event) =>
                  void importRecording(event.target.files?.[0])
                }
              />
              {recordingError && <strong role="alert">{recordingError}</strong>}
              {recordingNotice && (
                <strong className="success-note" role="status">
                  {recordingNotice}
                </strong>
              )}
            </section>
            <section>
              <h3>Projection</h3>
              <div className="segmented">
                {([0, 90, 180, 270] as const).map((rotation) => (
                  <button
                    key={rotation}
                    className={
                      runtime.settings.projectionRotation === rotation
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      runtime.setSettings({ projectionRotation: rotation })
                    }
                  >
                    {rotation}°
                  </button>
                ))}
              </div>
            </section>
            <section className="toggle-list">
              <Toggle
                label="Privacy veil"
                description="Masks IP addresses in the interface."
                checked={runtime.settings.privacyMode}
                onChange={(privacyMode) => runtime.setSettings({ privacyMode })}
              />
              <Toggle
                label="Reduced motion"
                description="Removes traveling particles and rotation."
                checked={runtime.settings.reducedMotion}
                onChange={(reducedMotion) =>
                  runtime.setSettings({ reducedMotion })
                }
              />
            </section>
            <section className="renderer-health">
              <h3>Renderer health</h3>
              <div>
                <Metric value={`${runtime.metrics.fps}`} label="frames/sec" />
                <Metric
                  value={`${runtime.metrics.activeFlows}`}
                  label="active trails"
                />
                <Metric
                  value={`${runtime.metrics.frameTimeMs.toFixed(1)} ms`}
                  label="frame time"
                />
              </div>
              <p className={`bridge-state ${runtime.streamStatus}`}>
                Local bridge {runtime.streamStatus}. The built-in simulator
                remains available offline.
              </p>
            </section>
            <footer>
              <ShieldIcon />
              <p>
                <strong>Metadata only.</strong> No payloads, pages, messages,
                passwords, cookies, or tokens enter this interface.
              </p>
            </footer>
          </aside>
        </div>
      )}

      <div className="sr-only" aria-live="polite">
        {latest
          ? `New ${latest.protocol} connection to ${latest.classification.label} in ${latest.geo.country}. Confidence ${Math.round(latest.confidence * 100)} percent.`
          : ""}
      </div>
      <div className="sr-only">Observed services: {observed}</div>
    </main>
  );
}

function FlowObservation({
  event,
  privateMode,
  deviceName,
}: {
  event: FlowEvent;
  privateMode: boolean;
  deviceName: string;
}) {
  const uncertain = event.confidence < 0.74;
  return (
    <div className="flow-observation">
      <span className={`event-sigil ${event.direction}`}>
        <i />
      </span>
      <div>
        <small>{uncertain ? "POSSIBLE SERVICE" : "OBSERVED SERVICE"}</small>
        <h2>{event.classification.label}</h2>
        <p>{event.organization}</p>
      </div>
      <dl>
        <div>
          <dt>Place</dt>
          <dd>
            {event.geo.city}, {event.geo.country}
          </dd>
        </div>
        <div>
          <dt>Transport</dt>
          <dd>
            {event.transport.toUpperCase()} · {event.protocol}
          </dd>
        </div>
        <div>
          <dt>Remote</dt>
          <dd>
            {privateMode ? maskIp(event.remoteIp) : event.remoteIp}:
            {event.remotePort}
          </dd>
        </div>
        <div>
          <dt>Device</dt>
          <dd>{deviceName}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{Math.round(event.confidence * 100)}%</dd>
        </div>
      </dl>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="range-control">
      <span>
        {label}
        <output>{format(value)}</output>
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

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="toggle">
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <i aria-hidden="true" />
    </label>
  );
}

function FilterRow<T extends string | number>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  selected: readonly T[];
  onChange: (next: T[]) => void;
}) {
  const toggle = (value: T) =>
    onChange(
      selected.includes(value)
        ? selected.filter((entry) => entry !== value)
        : [...selected, value],
    );
  return (
    <div className="filter-row">
      <span>
        {label}
        <small>
          {selected.length === 0
            ? "All visible"
            : `${selected.length} selected`}
        </small>
      </span>
      <div>
        {options.length === 0 ? (
          <em>Waiting for observations…</em>
        ) : (
          options.slice(0, 8).map((option) => (
            <button
              key={String(option.value)}
              className={selected.includes(option.value) ? "active" : ""}
              onClick={() => toggle(option.value)}
            >
              {option.label}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function maskIp(ip: string): string {
  const parts = ip.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.•••.•••` : "hidden";
}

function formatClock(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1_000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function summarize(events: readonly FlowEvent[]): string {
  return [...new Set(events.map((event) => event.classification.label))]
    .slice(-8)
    .join(", ");
}

function loadAliases(): Record<string, string> {
  try {
    const value = JSON.parse(
      localStorage.getItem("packethalo:device-aliases") || "{}",
    ) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key, alias]) =>
            key.length > 0 &&
            key.length <= 120 &&
            typeof alias === "string" &&
            alias.length <= 80,
        )
        .slice(0, 100),
    );
  } catch {
    return {};
  }
}
