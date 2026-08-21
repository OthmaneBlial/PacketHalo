import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_SETTINGS,
  isFlowEvent,
  isRecording,
  isSimulatorCommand,
  type DisplaySettings,
  type FlowEvent,
  type Recording,
  type SimulatorCommand,
} from "@packethalo/protocol";
import { PacketHaloRenderer, type RendererMetrics } from "@packethalo/renderer";
import {
  SCENARIOS,
  SimulatorEngine,
  type SimulationSpeed,
} from "@packethalo/simulator-core";

function loadSettings(): DisplaySettings {
  try {
    const saved = localStorage.getItem("packethalo:display-settings");
    return saved
      ? {
          ...DEFAULT_SETTINGS,
          ...(JSON.parse(saved) as Partial<DisplaySettings>),
        }
      : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function resolveStreamUrl(
  configuredUrl: string | undefined,
  location: Pick<Location, "host" | "protocol">,
): string {
  if (configuredUrl !== "same-origin")
    return configuredUrl || "ws://127.0.0.1:8787/stream";
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/stream`;
}

export interface RuntimeStats {
  readonly eventCount: number;
  readonly bytes: number;
  readonly countries: number;
  readonly devices: number;
}

export function useHaloRuntime() {
  const renderer = useRef<PacketHaloRenderer | undefined>(undefined);
  const engine = useRef(new SimulatorEngine());
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [settings, setSettingsState] = useState<DisplaySettings>(loadSettings);
  const [scenarioId, setScenarioIdState] = useState("movie-night");
  const [seed, setSeedState] = useState("halo-42");
  const [paused, setPaused] = useState(false);
  const [speed, setSpeedState] = useState<SimulationSpeed>(1);
  const [recording, setRecording] = useState(false);
  const [lastRecording, setLastRecording] = useState<Recording>();
  const [replaying, setReplaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [latestEvents, setLatestEvents] = useState<readonly FlowEvent[]>([]);
  const [stats, setStats] = useState<RuntimeStats>({
    eventCount: 0,
    bytes: 0,
    countries: 0,
    devices: 0,
  });
  const [metrics, setMetrics] = useState<RendererMetrics>({
    fps: 60,
    activeFlows: 0,
    droppedFlows: 0,
    frameTimeMs: 0,
  });
  const countries = useRef(new Set<string>());
  const devices = useRef(new Set<string>());
  const history = useRef<FlowEvent[]>([]);
  const remoteControl = useRef<(command: SimulatorCommand) => void>(
    () => undefined,
  );

  const ingest = useCallback((events: readonly FlowEvent[]) => {
    if (events.length === 0) return;
    renderer.current?.push(events);
    history.current = [...history.current, ...events]
      .filter(
        (event) =>
          event.timestamp >= events[events.length - 1]!.timestamp - 5 * 60_000,
      )
      .slice(-5_000);
    events.forEach((event) => {
      countries.current.add(event.geo.countryCode);
      devices.current.add(event.deviceId);
    });
    setLatestEvents((current) => [...current, ...events].slice(-48));
    setStats((current) => ({
      eventCount: current.eventCount + events.length,
      bytes:
        current.bytes + events.reduce((sum, event) => sum + event.bytes, 0),
      countries: countries.current.size,
      devices: devices.current.size,
    }));
  }, []);

  useEffect(() => {
    if (!canvas) return;
    const instance = new PacketHaloRenderer(canvas);
    renderer.current = instance;
    instance.setSettings(settings);
    instance.start();
    return () => {
      instance.stop();
      renderer.current = undefined;
    };
  }, [canvas]);

  useEffect(() => {
    renderer.current?.setSettings(settings);
    localStorage.setItem(
      "packethalo:display-settings",
      JSON.stringify(settings),
    );
  }, [settings]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      if (media.matches)
        setSettingsState((current) => ({ ...current, reducedMotion: true }));
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (paused || replaying) return;
    const scenario =
      SCENARIOS.find((entry) => entry.id === scenarioId) ?? SCENARIOS[0]!;
    const delay = (scenario.cadenceMs[0] + scenario.cadenceMs[1]) / 2 / speed;
    const timer = window.setTimeout(
      () => ingest(engine.current.next()),
      Math.max(34, delay),
    );
    return () => window.clearTimeout(timer);
  }, [ingest, latestEvents, paused, replaying, scenarioId, speed]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (renderer.current) setMetrics(renderer.current.metrics);
    }, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!replaying || !lastRecording) return;
    const timer = window.setInterval(() => {
      setPlayhead((current) => {
        const next = Math.min(lastRecording.durationMs, current + 100 * speed);
        const events = lastRecording.events.filter((event) => {
          const offset = event.timestamp - lastRecording.startedAt;
          return offset > current && offset <= next;
        });
        ingest(events);
        if (next >= lastRecording.durationMs) setReplaying(false);
        return next;
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [ingest, lastRecording, replaying, speed]);

  useEffect(() => {
    const configuredUrl = import.meta.env.VITE_PACKET_HALO_SERVER as
      string | undefined;
    const url = resolveStreamUrl(configuredUrl, window.location);
    let socket: WebSocket | undefined;
    try {
      socket = new WebSocket(url);
      socket.addEventListener("message", (message) => {
        try {
          const data = JSON.parse(String(message.data)) as {
            type?: string;
            command?: unknown;
            event?: unknown;
            settings?: DisplaySettings;
          };
          if (data.type === "flow" && isFlowEvent(data.event))
            ingest([data.event]);
          if (data.type === "settings" && data.settings)
            setSettingsState(data.settings);
          if (
            data.type === "simulator.control" &&
            isSimulatorCommand(data.command)
          )
            remoteControl.current(data.command);
        } catch {
          /* Invalid stream entries are ignored at the privacy boundary. */
        }
      });
    } catch {
      /* The simulator remains fully functional without a server. */
    }
    return () => socket?.close();
  }, [ingest]);

  const resetObservation = useCallback(() => {
    renderer.current?.clear();
    countries.current.clear();
    devices.current.clear();
    history.current = [];
    setLatestEvents([]);
    setStats({ eventCount: 0, bytes: 0, countries: 0, devices: 0 });
  }, []);

  const setSettings = useCallback(
    (patch: Partial<DisplaySettings>) =>
      setSettingsState((current) => ({ ...current, ...patch })),
    [],
  );
  const setScenario = useCallback(
    (id: string, requestedSeed = seed) => {
      engine.current.setScenario(id, requestedSeed);
      setScenarioIdState(id);
      setSeedState(requestedSeed);
      setPaused(false);
      setReplaying(false);
      resetObservation();
    },
    [resetObservation, seed],
  );
  const setSeed = useCallback(
    (value: string) => {
      const next = value.trim() || "halo-42";
      setSeedState(next);
      engine.current.setScenario(scenarioId, next);
      resetObservation();
    },
    [resetObservation, scenarioId],
  );
  const togglePause = useCallback(() => {
    engine.current.togglePause();
    const isPaused = engine.current.snapshot.paused;
    setPaused(isPaused);
    setReplaying(false);
    if (isPaused && history.current.length > 0) {
      const events = [...history.current];
      const startedAt = events[0]!.timestamp;
      const durationMs = Math.max(
        1,
        events[events.length - 1]!.timestamp - startedAt,
      );
      setLastRecording({
        version: 1,
        name: `Last five minutes · ${engine.current.snapshot.scenario.name}`,
        scenarioId,
        seed,
        startedAt,
        durationMs,
        events,
      });
      setPlayhead(durationMs);
    }
  }, [scenarioId, seed]);
  const setSpeed = useCallback((value: SimulationSpeed) => {
    engine.current.setSpeed(value);
    setSpeedState(value);
  }, []);
  const toggleRecording = useCallback(() => {
    if (!recording) {
      engine.current.startRecording();
      setRecording(true);
      return;
    }
    const captured = engine.current.stopRecording();
    setRecording(false);
    if (captured) {
      setLastRecording(captured);
      setPlayhead(captured.durationMs);
    }
  }, [recording]);
  const startReplay = useCallback(() => {
    if (!lastRecording) return;
    resetObservation();
    setPaused(true);
    engine.current.pause();
    setPlayhead(0);
    setReplaying(true);
  }, [lastRecording, resetObservation]);
  const scrub = useCallback(
    (next: number) => {
      if (!lastRecording) return;
      setReplaying(false);
      renderer.current?.clear();
      const events = lastRecording.events
        .filter((event) => event.timestamp - lastRecording.startedAt <= next)
        .slice(-2_000);
      renderer.current?.push(events);
      setLatestEvents(events.slice(-48));
      setPlayhead(next);
    },
    [lastRecording],
  );

  const loadRecording = useCallback((value: unknown): boolean => {
    if (!isRecording(value)) return false;
    engine.current.pause();
    setPaused(true);
    setReplaying(false);
    setLastRecording(value);
    setPlayhead(value.durationMs);
    renderer.current?.clear();
    renderer.current?.push(value.events.slice(-2_000));
    setLatestEvents(value.events.slice(-48));
    return true;
  }, []);

  remoteControl.current = (command) => {
    switch (command.action) {
      case "pause":
        if (!engine.current.snapshot.paused) togglePause();
        break;
      case "resume":
        if (engine.current.snapshot.paused) togglePause();
        break;
      case "speed":
        setSpeed(command.speed);
        break;
      case "scenario":
        setScenario(command.scenarioId, command.seed ?? seed);
        break;
      case "seed":
        setSeed(command.seed);
        break;
      case "record.toggle":
        toggleRecording();
        break;
      case "replay":
        startReplay();
        break;
    }
  };

  return {
    setCanvas,
    settings,
    setSettings,
    scenarioId,
    setScenario,
    seed,
    setSeed,
    paused,
    togglePause,
    speed,
    setSpeed,
    recording,
    toggleRecording,
    lastRecording,
    replaying,
    startReplay,
    playhead,
    scrub,
    loadRecording,
    latestEvents,
    stats,
    metrics,
  };
}
