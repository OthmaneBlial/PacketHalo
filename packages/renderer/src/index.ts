import {
  DEFAULT_SETTINGS,
  type DisplaySettings,
  type FlowEvent,
} from "@packethalo/protocol";
import { clamp } from "@packethalo/shared";

interface Palette {
  readonly background: string;
  readonly backgroundHalo: string;
  readonly home: string;
  readonly inbound: string;
  readonly outbound: string;
  readonly faint: string;
  readonly text: string;
  readonly suspicious: string;
}

export const PALETTES: Record<DisplaySettings["theme"], Palette> = {
  "ambient-black": {
    background: "#050707",
    backgroundHalo: "#0e1816",
    home: "#f3d7a0",
    inbound: "#81ead1",
    outbound: "#f3b885",
    faint: "#90aaa3",
    text: "#e7eee9",
    suspicious: "#ff796f",
  },
  "midnight-blue": {
    background: "#050815",
    backgroundHalo: "#0c1733",
    home: "#ffe4a8",
    inbound: "#6bd9ff",
    outbound: "#8e9dff",
    faint: "#7691b5",
    text: "#e5edff",
    suspicious: "#ff728d",
  },
  aurora: {
    background: "#030b0b",
    backgroundHalo: "#092620",
    home: "#f4e6b8",
    inbound: "#5df2bb",
    outbound: "#a88bff",
    faint: "#74a69c",
    text: "#e3fff6",
    suspicious: "#ff7b72",
  },
  "cyber-green": {
    background: "#010604",
    backgroundHalo: "#071b12",
    home: "#d5ff9c",
    inbound: "#70ff94",
    outbound: "#baffdc",
    faint: "#5d9672",
    text: "#dfffe8",
    suspicious: "#ffbf45",
  },
  "deep-space": {
    background: "#03030b",
    backgroundHalo: "#151128",
    home: "#ffe1a6",
    inbound: "#75c8ff",
    outbound: "#cf8aff",
    faint: "#807d9d",
    text: "#ece9ff",
    suspicious: "#ff6d82",
  },
  monochrome: {
    background: "#070808",
    backgroundHalo: "#151616",
    home: "#ffffff",
    inbound: "#dadada",
    outbound: "#a2a2a2",
    faint: "#777777",
    text: "#f4f4f4",
    suspicious: "#ffffff",
  },
  projector: {
    background: "#020303",
    backgroundHalo: "#151a17",
    home: "#fff1c7",
    inbound: "#b8ffec",
    outbound: "#ffd49e",
    faint: "#a6bbb4",
    text: "#ffffff",
    suspicious: "#ff8d84",
  },
  oled: {
    background: "#000000",
    backgroundHalo: "#050706",
    home: "#f5dca8",
    inbound: "#6fe0c5",
    outbound: "#eab67e",
    faint: "#53635e",
    text: "#dce5df",
    suspicious: "#ff7268",
  },
  accessibility: {
    background: "#000000",
    backgroundHalo: "#101010",
    home: "#ffffff",
    inbound: "#00ffff",
    outbound: "#ffdf00",
    faint: "#b7b7b7",
    text: "#ffffff",
    suspicious: "#ff5c5c",
  },
};

interface ActiveFlow {
  readonly event: FlowEvent;
  readonly bornAt: number;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

export interface RendererMetrics {
  readonly fps: number;
  readonly activeFlows: number;
  readonly droppedFlows: number;
  readonly frameTimeMs: number;
}

export function stableHash(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function polarDestination(
  event: FlowEvent,
  width: number,
  height: number,
): Point {
  const hash = stableHash(`${event.organization}:${event.geo.countryCode}`);
  const angle = ((hash % 3_600) / 3_600) * Math.PI * 2 - Math.PI / 2;
  const inner = Math.min(width, height) * 0.23;
  const outer = Math.min(width, height) * 0.44;
  const distance = inner + (((hash >>> 10) % 1_000) / 1_000) * (outer - inner);
  return {
    x: width / 2 + Math.cos(angle) * distance,
    y: height / 2 + Math.sin(angle) * distance,
  };
}

export function easedProgress(progress: number): number {
  const normalized = clamp(progress, 0, 1);
  if (normalized === 0 || normalized === 1) return normalized;
  return -(Math.cos(Math.PI * normalized) - 1) / 2;
}

export class PacketHaloRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private settings: DisplaySettings = DEFAULT_SETTINGS;
  private flows: ActiveFlow[] = [];
  private frameRequest = 0;
  private running = false;
  private previousFrame = 0;
  private framesInWindow = 0;
  private fpsWindowStart = 0;
  private metricsValue: RendererMetrics = {
    fps: 60,
    activeFlows: 0,
    droppedFlows: 0,
    frameTimeMs: 0,
  };
  private droppedFlows = 0;
  private readonly stars: readonly Point[];

  public constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("PacketHalo requires a Canvas 2D context");
    this.canvas = canvas;
    this.context = context;
    this.stars = Array.from({ length: 180 }, (_, index) => ({
      x: (stableHash(`star-x-${index}`) % 10_000) / 10_000,
      y: (stableHash(`star-y-${index}`) % 10_000) / 10_000,
    }));
  }

  public setSettings(settings: DisplaySettings): void {
    this.settings = settings;
  }

  public push(events: readonly FlowEvent[]): void {
    const bornAt = performance.now();
    this.flows.push(...events.map((event) => ({ event, bornAt })));
    if (this.flows.length > 2_000) {
      const overflow = this.flows.length - 2_000;
      this.flows.splice(0, overflow);
      this.droppedFlows += overflow;
    }
  }

  public clear(): void {
    this.flows = [];
  }
  public get metrics(): RendererMetrics {
    return this.metricsValue;
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.previousFrame = 0;
    this.frameRequest = requestAnimationFrame(this.draw);
  }

  public stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frameRequest);
  }

  private readonly draw = (now: number): void => {
    if (!this.running) return;
    const frameInterval = 1_000 / 60;
    if (this.previousFrame > 0 && now + 0.5 < this.previousFrame) {
      this.frameRequest = requestAnimationFrame(this.draw);
      return;
    }
    this.previousFrame =
      this.previousFrame === 0 || now - this.previousFrame > frameInterval * 2
        ? now + frameInterval
        : this.previousFrame + frameInterval;
    const frameStart = performance.now();
    this.resize();
    const retentionMs = this.settings.retentionSeconds * 1_000;
    this.flows = this.flows.filter((flow) => now - flow.bornAt < retentionMs);
    this.paintBackground(now);

    switch (this.settings.mode) {
      case "globe":
        this.paintGlobe(now);
        break;
      case "constellation":
        this.paintConstellation(now);
        break;
      case "ambient":
        this.paintHalo(now, true);
        break;
      case "forensic":
        this.paintHalo(now, false);
        this.paintForensics(now);
        break;
      default:
        this.paintHalo(now, false);
    }

    this.updateMetrics(now, performance.now() - frameStart);
    this.frameRequest = requestAnimationFrame(this.draw);
  };

  private resize(): void {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(this.canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(this.canvas.clientHeight * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  private dimensions(): Point {
    return { x: this.canvas.clientWidth, y: this.canvas.clientHeight };
  }

  private paintBackground(now: number): void {
    const { x: width, y: height } = this.dimensions();
    const palette = PALETTES[this.settings.theme];
    this.context.fillStyle = palette.background;
    this.context.fillRect(0, 0, width, height);
    const glow = this.context.createRadialGradient(
      width / 2,
      height / 2,
      0,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.64,
    );
    glow.addColorStop(0, palette.backgroundHalo);
    glow.addColorStop(0.42, `${palette.background}cc`);
    glow.addColorStop(1, palette.background);
    this.context.fillStyle = glow;
    this.context.fillRect(0, 0, width, height);

    const slowTime = this.settings.reducedMotion ? 0 : now * 0.000012;
    this.context.fillStyle = palette.faint;
    for (let index = 0; index < this.stars.length; index += 1) {
      const star = this.stars[index]!;
      const opacity =
        0.05 + Math.sin(index * 2.4 + slowTime * (index % 5)) * 0.025;
      this.context.globalAlpha = opacity;
      this.context.beginPath();
      this.context.arc(
        star.x * width,
        star.y * height,
        index % 11 === 0 ? 1.1 : 0.55,
        0,
        Math.PI * 2,
      );
      this.context.fill();
    }
    this.context.globalAlpha = 1;
  }

  private paintHalo(now: number, ambient: boolean): void {
    const { x: width, y: height } = this.dimensions();
    const center = { x: width / 2, y: height / 2 };
    const palette = PALETTES[this.settings.theme];
    const scale = Math.min(width, height);
    const orbitCount = ambient ? 1 : 2;

    this.context.save();
    this.context.lineWidth = 1;
    for (let orbit = 0; orbit < orbitCount; orbit += 1) {
      const radius = scale * (0.115 + orbit * 0.054);
      this.context.strokeStyle = palette.faint;
      this.context.globalAlpha = 0.08 - orbit * 0.009;
      this.context.setLineDash([1.5, 7 + orbit * 2]);
      this.context.beginPath();
      this.context.ellipse(
        center.x,
        center.y,
        radius * (1 + orbit * 0.04),
        radius * 0.76,
        -0.18 + orbit * 0.11,
        0,
        Math.PI * 2,
      );
      this.context.stroke();
    }
    this.context.setLineDash([]);
    this.context.restore();

    const allVisible = this.visibleFlows();
    this.paintDeviceOrbits(now, center, scale, palette, allVisible, ambient);
    const maxDraw = this.settings.reducedMotion
      ? 96
      : Math.min(220, Math.max(80, this.settings.particleCount * 4));
    const visible = allVisible.slice(-maxDraw);
    for (let index = 0; index < visible.length; index += 1) {
      this.paintHaloFlow(
        visible[index]!,
        now,
        center,
        width,
        height,
        ambient,
        index,
      );
    }
    this.paintHome(now, center, palette, ambient);
  }

  private paintDeviceOrbits(
    now: number,
    center: Point,
    scale: number,
    palette: Palette,
    flows: readonly ActiveFlow[],
    ambient: boolean,
  ): void {
    const devices = new Map<string, FlowEvent>();
    for (const { event } of flows) devices.set(event.deviceId, event);
    const visibleDevices = [...devices.values()]
      .sort((left, right) => left.deviceId.localeCompare(right.deviceId))
      .slice(0, 7);

    for (let index = 0; index < visibleDevices.length; index += 1) {
      const device = visibleDevices[index]!;
      const hash = stableHash(device.deviceId);
      const radius = scale * (0.095 + index * 0.027);
      const rotation = -0.36 + ((hash >>> 8) % 720) / 1_000;
      const speed = (index % 2 === 0 ? 1 : -1) * (0.000025 + index * 0.000002);
      const phase = ((hash % 3_600) / 3_600) * Math.PI * 2;
      const progress = this.settings.reducedMotion
        ? phase
        : phase +
          now * speed * this.settings.animationSpeed * (ambient ? 0.28 : 1);
      const orbitX = Math.cos(progress) * radius;
      const orbitY = Math.sin(progress) * radius * 0.68;
      const point = rotatePoint(orbitX, orbitY, rotation, center);

      this.context.save();
      this.context.strokeStyle = palette.faint;
      this.context.globalAlpha = ambient ? 0.035 : 0.075;
      this.context.lineWidth = 0.7;
      this.context.beginPath();
      this.context.ellipse(
        center.x,
        center.y,
        radius,
        radius * 0.68,
        rotation,
        0,
        Math.PI * 2,
      );
      this.context.stroke();
      this.context.globalCompositeOperation = "lighter";
      this.context.globalAlpha = (ambient ? 0.12 : 0.2) * this.settings.glow;
      this.context.strokeStyle = palette.inbound;
      this.context.fillStyle = palette.inbound;
      this.context.beginPath();
      this.context.arc(
        point.x,
        point.y,
        4.5 + this.settings.glow * 2,
        0,
        Math.PI * 2,
      );
      this.context.fill();
      this.context.globalAlpha = ambient ? 0.38 : 0.72;
      this.context.fillStyle = palette.background;
      this.context.lineWidth = 1;
      this.context.beginPath();
      this.context.arc(point.x, point.y, 3.4, 0, Math.PI * 2);
      this.context.fill();
      this.context.stroke();
      if (!ambient && this.settings.mode === "forensic") {
        this.context.globalCompositeOperation = "source-over";
        this.context.globalAlpha = 0.52;
        this.context.fillStyle = palette.text;
        this.context.font = "500 8px Manrope, sans-serif";
        this.context.fillText(
          `${deviceGlyph(device.deviceKind)}  ${device.deviceName}`,
          point.x + 8,
          point.y + 3,
        );
      }
      this.context.restore();
    }
  }

  private paintHaloFlow(
    flow: ActiveFlow,
    now: number,
    center: Point,
    width: number,
    height: number,
    ambient: boolean,
    index: number,
  ): void {
    const { event, bornAt } = flow;
    const palette = PALETTES[this.settings.theme];
    const destination = polarDestination(event, width, height);
    const life = clamp(
      (now - bornAt) / Math.max(1, this.settings.retentionSeconds * 1_000),
      0,
      1,
    );
    const appear = clamp(
      (now - bornAt) / (this.settings.reducedMotion ? 80 : 680),
      0,
      1,
    );
    const fade = (1 - life) * appear;
    const color =
      event.classification.category === "suspicious"
        ? palette.suspicious
        : event.direction === "inbound"
          ? palette.inbound
          : palette.outbound;
    const hash = stableHash(event.id);
    const bend = ((hash % 200) / 200 - 0.5) * Math.min(width, height) * 0.48;
    const midpoint = {
      x: (center.x + destination.x) / 2,
      y: (center.y + destination.y) / 2,
    };
    const dx = destination.x - center.x;
    const dy = destination.y - center.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const control = {
      x: midpoint.x - (dy / length) * bend,
      y: midpoint.y + (dx / length) * bend,
    };
    const weight = clamp(Math.log10(event.bytes + 10) - 2.6, 0.5, 4.8);

    this.context.save();
    this.context.globalCompositeOperation = "lighter";
    this.context.strokeStyle = color;
    this.context.beginPath();
    this.context.moveTo(center.x, center.y);
    this.context.quadraticCurveTo(
      control.x,
      control.y,
      destination.x,
      destination.y,
    );
    this.context.globalAlpha =
      fade * (ambient ? 0.05 : 0.08) * this.settings.glow;
    this.context.lineWidth = weight * (1 + this.settings.glow * 1.7);
    this.context.stroke();
    this.context.globalAlpha = fade * (ambient ? 0.17 : 0.26);
    this.context.lineWidth = weight;
    this.context.stroke();

    if (
      !this.settings.reducedMotion &&
      index %
        Math.max(1, Math.floor(visibleStride(this.settings.particleCount))) ===
        0
    ) {
      const travel =
        ((now - bornAt) *
          0.00034 *
          eventMotionRate(event) *
          this.settings.animationSpeed *
          (ambient ? 0.28 : 1) +
          (hash % 100) / 100) %
        1;
      const easedTravel = easedProgress(travel);
      const endpointVisibility = Math.sin(Math.PI * travel);
      const point = quadraticPoint(
        event.direction === "inbound" ? 1 - easedTravel : easedTravel,
        center,
        control,
        destination,
      );
      this.context.globalAlpha =
        fade * 0.18 * this.settings.glow * endpointVisibility;
      this.context.fillStyle = color;
      this.context.beginPath();
      this.context.arc(
        point.x,
        point.y,
        3 + weight * 0.5 + this.settings.glow,
        0,
        Math.PI * 2,
      );
      this.context.fill();
      this.context.globalAlpha = fade * 0.9 * endpointVisibility;
      this.context.fillStyle = color;
      this.context.beginPath();
      this.context.arc(point.x, point.y, 1.3 + weight * 0.38, 0, Math.PI * 2);
      this.context.fill();
    }

    this.context.globalAlpha =
      fade * (ambient ? 0.08 : 0.14) * this.settings.glow;
    this.context.fillStyle = color;
    this.context.beginPath();
    this.context.arc(
      destination.x,
      destination.y,
      3.4 + this.settings.glow * 1.5,
      0,
      Math.PI * 2,
    );
    this.context.fill();
    this.context.globalAlpha = fade * (ambient ? 0.26 : 0.55);
    this.context.beginPath();
    this.context.arc(
      destination.x,
      destination.y,
      1.4 + Math.sin(now * 0.002 + hash) * 0.45,
      0,
      Math.PI * 2,
    );
    this.context.fill();
    this.context.restore();
  }

  private paintHome(
    now: number,
    center: Point,
    palette: Palette,
    ambient: boolean,
  ): void {
    const pulse = this.settings.reducedMotion
      ? 0
      : Math.sin(now * 0.0011) * 2.5;
    this.context.save();
    this.context.globalCompositeOperation = "lighter";
    const halo = this.context.createRadialGradient(
      center.x,
      center.y,
      0,
      center.x,
      center.y,
      58 + pulse,
    );
    halo.addColorStop(0, palette.home);
    halo.addColorStop(0.09, `${palette.home}dd`);
    halo.addColorStop(0.32, `${palette.home}28`);
    halo.addColorStop(1, `${palette.home}00`);
    this.context.fillStyle = halo;
    this.context.beginPath();
    this.context.arc(center.x, center.y, 58 + pulse, 0, Math.PI * 2);
    this.context.fill();
    this.context.fillStyle = palette.home;
    this.context.beginPath();
    this.context.arc(center.x, center.y, ambient ? 2.4 : 3.2, 0, Math.PI * 2);
    this.context.fill();
    this.context.restore();
  }

  private paintGlobe(now: number): void {
    const { x: width, y: height } = this.dimensions();
    const palette = PALETTES[this.settings.theme];
    const radius = Math.min(width, height) * 0.34;
    const center = { x: width / 2, y: height / 2 };
    const rotation = this.settings.reducedMotion
      ? 0
      : now * 0.000018 * this.settings.animationSpeed;
    this.context.save();
    this.context.strokeStyle = palette.faint;
    this.context.lineWidth = 0.8;
    this.context.globalAlpha = 0.16;
    this.context.beginPath();
    this.context.arc(center.x, center.y, radius, 0, Math.PI * 2);
    this.context.stroke();
    for (let latitude = -60; latitude <= 60; latitude += 30) {
      const y = center.y - Math.sin((latitude * Math.PI) / 180) * radius;
      const rx = Math.cos((latitude * Math.PI) / 180) * radius;
      this.context.beginPath();
      this.context.ellipse(center.x, y, rx, rx * 0.16, 0, 0, Math.PI * 2);
      this.context.stroke();
    }
    for (let longitude = 0; longitude < 6; longitude += 1) {
      this.context.beginPath();
      this.context.ellipse(
        center.x,
        center.y,
        radius * Math.abs(Math.cos(rotation + (longitude * Math.PI) / 6)),
        radius,
        0,
        0,
        Math.PI * 2,
      );
      this.context.stroke();
    }
    this.context.restore();

    const home = globePoint(-6.0 + rotation * 40, 31.8, center, radius);
    const visible = this.visibleFlows().slice(-220);
    for (let index = 0; index < visible.length; index += 1) {
      const flow = visible[index]!;
      const destination = globePoint(
        flow.event.geo.longitude + rotation * 40,
        flow.event.geo.latitude,
        center,
        radius,
      );
      const age = clamp(
        (now - flow.bornAt) / (this.settings.retentionSeconds * 1_000),
        0,
        1,
      );
      const color =
        flow.event.direction === "inbound" ? palette.inbound : palette.outbound;
      const altitude =
        radius * clamp(Math.log10(flow.event.bytes + 10) / 24, 0.08, 0.32);
      const control = {
        x: (home.x + destination.x) / 2,
        y: (home.y + destination.y) / 2 - altitude,
      };
      this.context.save();
      this.context.globalCompositeOperation = "lighter";
      const appear = clamp((now - flow.bornAt) / 680, 0, 1);
      this.context.strokeStyle = color;
      const lineWidth = clamp(Math.log10(flow.event.bytes) - 3, 0.6, 3.5);
      this.context.beginPath();
      this.context.moveTo(home.x, home.y);
      this.context.quadraticCurveTo(
        control.x,
        control.y,
        destination.x,
        destination.y,
      );
      this.context.globalAlpha = (1 - age) * appear * 0.1 * this.settings.glow;
      this.context.lineWidth = lineWidth * (1 + this.settings.glow * 1.5);
      this.context.stroke();
      this.context.globalAlpha = (1 - age) * appear * 0.36;
      this.context.lineWidth = lineWidth;
      this.context.stroke();
      if (
        !this.settings.reducedMotion &&
        index %
          Math.max(
            1,
            Math.floor(visibleStride(this.settings.particleCount)),
          ) ===
          0
      ) {
        const travel =
          ((now - flow.bornAt) *
            0.0003 *
            eventMotionRate(flow.event) *
            this.settings.animationSpeed +
            (stableHash(flow.event.id) % 100) / 100) %
          1;
        const easedTravel = easedProgress(travel);
        const endpointVisibility = Math.sin(Math.PI * travel);
        const point = quadraticPoint(
          flow.event.direction === "inbound" ? 1 - easedTravel : easedTravel,
          home,
          control,
          destination,
        );
        this.context.globalAlpha =
          (1 - age) * appear * 0.2 * this.settings.glow * endpointVisibility;
        this.context.fillStyle = color;
        this.context.beginPath();
        this.context.arc(
          point.x,
          point.y,
          3.5 + this.settings.glow,
          0,
          Math.PI * 2,
        );
        this.context.fill();
        this.context.globalAlpha =
          (1 - age) * appear * 0.92 * endpointVisibility;
        this.context.fillStyle = color;
        this.context.beginPath();
        this.context.arc(point.x, point.y, 1.7, 0, Math.PI * 2);
        this.context.fill();
      }
      this.context.restore();
    }
    this.paintHome(now, home, palette, true);
  }

  private paintConstellation(now: number): void {
    const { x: width, y: height } = this.dimensions();
    const palette = PALETTES[this.settings.theme];
    const groups = new Map<string, ActiveFlow[]>();
    for (const flow of this.visibleFlows()) {
      const key = flow.event.classification.label;
      const group = groups.get(key) ?? [];
      group.push(flow);
      groups.set(key, group);
    }
    const nodes = [...groups.entries()].slice(-38).map(([name, flows]) => {
      const hash = stableHash(name);
      const category = flows[flows.length - 1]!.event.classification.category;
      const anchor = constellationAnchor(category);
      return {
        name,
        flows,
        category,
        x:
          width *
          clamp(anchor.x + ((hash % 2_000) / 2_000 - 0.5) * 0.22, 0.08, 0.92),
        y:
          height *
          clamp(
            anchor.y + (((hash >>> 8) % 2_000) / 2_000 - 0.5) * 0.2,
            0.1,
            0.9,
          ),
      };
    });
    const center = { x: width / 2, y: height / 2 };
    const previousByCategory = new Map<
      FlowEvent["classification"]["category"],
      Point
    >();
    for (const node of nodes) {
      const latest = node.flows[node.flows.length - 1]!;
      const age = clamp(
        (now - latest.bornAt) / (this.settings.retentionSeconds * 1_000),
        0,
        1,
      );
      const color =
        latest.event.classification.category === "suspicious"
          ? palette.suspicious
          : latest.event.direction === "inbound"
            ? palette.inbound
            : palette.outbound;
      this.context.save();
      this.context.strokeStyle = color;
      this.context.globalAlpha = (1 - age) * 0.16;
      this.context.lineWidth = 0.8;
      this.context.beginPath();
      const previous = previousByCategory.get(node.category) ?? center;
      this.context.moveTo(previous.x, previous.y);
      this.context.lineTo(node.x, node.y);
      this.context.stroke();
      previousByCategory.set(node.category, node);
      this.context.fillStyle = color;
      this.context.globalAlpha = 0.12 * this.settings.glow;
      this.context.beginPath();
      this.context.arc(
        node.x,
        node.y,
        4.5 + Math.log2(node.flows.length + 1) + this.settings.glow * 2,
        0,
        Math.PI * 2,
      );
      this.context.fill();
      this.context.globalAlpha = 0.45 + Math.min(0.45, node.flows.length / 22);
      this.context.beginPath();
      this.context.arc(
        node.x,
        node.y,
        1.8 + Math.log2(node.flows.length + 1),
        0,
        Math.PI * 2,
      );
      this.context.fill();
      if (node.flows.length > 2 && width > 720) {
        this.context.fillStyle = palette.text;
        this.context.globalAlpha = 0.52;
        this.context.font = "500 10px Manrope, sans-serif";
        this.context.fillText(node.name.toUpperCase(), node.x + 10, node.y + 4);
      }
      this.context.restore();
    }
    this.paintHome(now, center, palette, false);
  }

  private paintForensics(now: number): void {
    const { x: width, y: height } = this.dimensions();
    if (width < 700) return;
    const palette = PALETTES[this.settings.theme];
    const latest = this.visibleFlows().slice(-8).reverse();
    this.context.save();
    this.context.font = "500 10px Manrope, sans-serif";
    for (let index = 0; index < latest.length; index += 1) {
      const flow = latest[index]!;
      const event = flow.event;
      const y = height - 34 - index * 18;
      const age = clamp((now - flow.bornAt) / 4_000, 0, 1);
      this.context.fillStyle = palette.text;
      this.context.globalAlpha = 0.62 * (1 - age * 0.45);
      this.context.fillText(
        `${event.transport.toUpperCase()}  ${event.remotePort}  AS${event.asn}  ${event.geo.countryCode}  ${event.process ?? "unknown process"}  ${event.deviceName}  ${event.classification.label}  ${Math.round(event.confidence * 100)}%`,
        24,
        y,
      );
    }
    this.context.strokeStyle = palette.faint;
    this.context.globalAlpha = 0.15;
    this.context.beginPath();
    this.context.moveTo(24, height - 20);
    this.context.lineTo(width - 24, height - 20);
    this.context.stroke();
    this.context.restore();
  }

  private updateMetrics(now: number, frameTimeMs: number): void {
    if (this.fpsWindowStart === 0) this.fpsWindowStart = now;
    this.framesInWindow += 1;
    if (now - this.fpsWindowStart >= 1_000) {
      const fps = Math.round(
        (this.framesInWindow * 1_000) / (now - this.fpsWindowStart),
      );
      this.metricsValue = {
        fps,
        activeFlows: this.flows.length,
        droppedFlows: this.droppedFlows,
        frameTimeMs,
      };
      this.fpsWindowStart = now;
      this.framesInWindow = 0;
    } else {
      this.metricsValue = {
        ...this.metricsValue,
        activeFlows: this.flows.length,
        frameTimeMs,
      };
    }
  }

  private visibleFlows(): ActiveFlow[] {
    return this.flows.filter(
      ({ event }) =>
        (this.settings.countryFilters.length === 0 ||
          this.settings.countryFilters.includes(event.geo.countryCode)) &&
        (this.settings.asnFilters.length === 0 ||
          this.settings.asnFilters.includes(event.asn)) &&
        (this.settings.deviceFilters.length === 0 ||
          this.settings.deviceFilters.includes(event.deviceId)),
    );
  }
}

function quadraticPoint(
  t: number,
  start: Point,
  control: Point,
  end: Point,
): Point {
  const inverse = 1 - t;
  return {
    x:
      inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
    y:
      inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y,
  };
}

function globePoint(
  longitude: number,
  latitude: number,
  center: Point,
  radius: number,
): Point {
  const lon = (longitude * Math.PI) / 180;
  const lat = (latitude * Math.PI) / 180;
  return {
    x: center.x + Math.sin(lon) * Math.cos(lat) * radius,
    y: center.y - Math.sin(lat) * radius,
  };
}

function rotatePoint(
  x: number,
  y: number,
  rotation: number,
  center: Point,
): Point {
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  return {
    x: center.x + x * cosine - y * sine,
    y: center.y + x * sine + y * cosine,
  };
}

export function eventMotionRate(event: FlowEvent): number {
  const seconds = Math.max(0.2, event.durationMs / 1_000 || 1);
  const bytesPerSecond = event.bytes / seconds;
  return clamp((Math.log10(bytesPerSecond + 10) - 2.5) / 2.5, 0.35, 1.8);
}

function deviceGlyph(kind: FlowEvent["deviceKind"]): string {
  return {
    laptop: "LAPTOP",
    phone: "PHONE",
    tv: "TV",
    console: "CONSOLE",
    nas: "NAS",
    router: "ROUTER",
    unknown: "DEVICE",
  }[kind];
}

export function constellationAnchor(
  category: FlowEvent["classification"]["category"],
): Point {
  return {
    media: { x: 0.26, y: 0.28 },
    communication: { x: 0.72, y: 0.27 },
    gaming: { x: 0.76, y: 0.7 },
    development: { x: 0.31, y: 0.72 },
    system: { x: 0.5, y: 0.51 },
    iot: { x: 0.17, y: 0.58 },
    suspicious: { x: 0.86, y: 0.48 },
    unknown: { x: 0.51, y: 0.17 },
  }[category];
}

function visibleStride(particles: number): number {
  return clamp(80 / Math.max(1, particles), 1, 8);
}
