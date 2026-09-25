"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import {
  MeshPhongMaterial,
  type Object3D,
  type PerspectiveCamera,
} from "three";
import { buildBorderLines, buildLandMesh } from "@/src/lib/globeMeshes";
import { hexToRgb } from "@/src/lib/heat";
import { createLocator } from "@/src/lib/locate";
import type { CountryFeature } from "@/src/lib/types";
import { depthRange, labelMaxAltitude, ringAlpha } from "@/src/lib/zoom";

export interface GlobeViewProps {
  features: CountryFeature[];
  colors: ReadonlyMap<string, string>;
  outlined: string | null;
  overlayOn: boolean;
  focus: { iso2: string; seq: number } | null;
  /** Changes when a new game starts: the camera flies back out and resumes auto-rotating. */
  resetKey: string;
}

const SPACE = "#050814";
const OCEAN = "#0b2a4a";
const LAND = "#3f4a5a";
const RAISED_SIDE = "#1e2530";
const OVERLAY_BORDER = "#ffffff";
const OVERLAY_BORDER_OPACITY = 0.45;
const GUESSED_BORDER = "rgba(15,23,42,0.9)";
const REVEAL_BORDER = "#ffffff";
const NEUTRAL_RING = "#e5e7eb";

// three-globe's globe radius; layer altitudes are fractions of it.
const GLOBE_RADIUS = 100;
const LAND_ALTITUDE = 0.002;
const BORDER_ALTITUDE = 0.0025;
const RAISED_ALTITUDE = 0.006;

const MIN_ALTITUDE = 0.025;
const MAX_ALTITUDE = 4;
const INITIAL_ALTITUDE = 2.5;
const FLY_MS = 1200;

interface LabelDatum {
  lat: number;
  lng: number;
  name: string;
  maxAlt: number;
}

interface RingDatum {
  lat: number;
  lng: number;
  color: string;
}

type LayerDatum = { kind: "land" } | { kind: "borders" };

// Module-level so their identity is stable. A new function or array per render makes react-globe.gl rebuild the layer.
const LAYERS: LayerDatum[] = [{ kind: "land" }, { kind: "borders" }];
const keepCustomObject = () => {}; // without an update fn the custom layer clears and rebuilds on every update
const isoOf = (d: object) => (d as CountryFeature).properties.iso2;
const raisedSide = () => RAISED_SIDE;
const raisedAltitude = () => RAISED_ALTITUDE;
const markLabelSide = (el: HTMLElement, visible: boolean) => {
  el.dataset.front = String(visible);
};

// The border object stays in the scene; toggling visibility avoids three-globe disposing and rebuilding it.
function setVisible(object: Object3D, visible: boolean) {
  object.visible = visible;
}

type Controls = ReturnType<GlobeMethods["controls"]>;

// Flush the damped rotation momentum (auto-rotate or a user fling); otherwise it keeps turning the camera
// after a flight lands (by ~0.4° at low frame rates, enough to push a micro-state off-screen at deep zoom).
function stopRotation(controls: Controls) {
  controls.autoRotate = false;
  const damping = controls.enableDamping;
  controls.enableDamping = false;
  controls.update();
  controls.enableDamping = damping;
}

function applyDepthRange(globe: GlobeMethods, altitude: number) {
  const camera = globe.camera() as PerspectiveCamera;
  const { near, far } = depthRange(altitude, globe.getGlobeRadius());
  if (camera.near === near && camera.far === far) return;
  camera.near = near;
  camera.far = far;
  camera.updateProjectionMatrix();
}

export default function GlobeView({
  features,
  colors,
  outlined,
  overlayOn,
  focus,
  resetKey,
}: GlobeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const hoverFrame = useRef(0);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const scheduleHoverRef = useRef<() => void>(() => {});
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [altitude, setAltitude] = useState(INITIAL_ALTITUDE);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const oceanMaterial = useMemo(
    () => new MeshPhongMaterial({ color: OCEAN, shininess: 6 }),
    [],
  );

  // All un-guessed land and all overlay borders are single objects: ~1,900 island polygons would otherwise
  // each cost a draw call (7,600 per frame including sides and strokes).
  const landMesh = useMemo(
    () => buildLandMesh(features, GLOBE_RADIUS, LAND_ALTITUDE, LAND),
    [features],
  );
  const borderLines = useMemo(
    () =>
      buildBorderLines(
        features,
        GLOBE_RADIUS,
        BORDER_ALTITUDE,
        OVERLAY_BORDER,
        OVERLAY_BORDER_OPACITY,
      ),
    [features],
  );
  useEffect(() => setVisible(borderLines, overlayOn), [borderLines, overlayOn]);
  const customObject = useCallback(
    (d: object) => ((d as LayerDatum).kind === "land" ? landMesh : borderLines),
    [landMesh, borderLines],
  );

  const byIso = useMemo(
    () =>
      new Map(
        features
          .filter((f) => f.properties.iso2)
          .map((f) => [f.properties.iso2 as string, f]),
      ),
    [features],
  );
  const locate = useMemo(() => createLocator(features), [features]);

  const handleReady = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const r = globe.getGlobeRadius();
    const controls = globe.controls();
    controls.minDistance = r * (1 + MIN_ALTITUDE);
    controls.maxDistance = r * (1 + MAX_ALTITUDE);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    controls.addEventListener("start", () => {
      controls.autoRotate = false;
    });
    globe.pointOfView({ altitude: INITIAL_ALTITUDE });
    applyDepthRange(globe, INITIAL_ALTITUDE);
  }, []);

  useEffect(() => {
    const globe = globeRef.current;
    const feature = focus ? byIso.get(focus.iso2) : undefined;
    if (!globe || !feature) return;
    stopRotation(globe.controls());
    const { labelLat, labelLng, tiny } = feature.properties;
    globe.pointOfView(
      { lat: labelLat, lng: labelLng, altitude: tiny ? 0.4 : 2 },
      FLY_MS,
    );
  }, [focus, byIso]);

  const lastResetKey = useRef(resetKey);
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || lastResetKey.current === resetKey) return;
    lastResetKey.current = resetKey;
    const controls = globe.controls();
    stopRotation(controls);
    globe.pointOfView({ lat: 0, lng: globe.pointOfView().lng, altitude: INITIAL_ALTITUDE }, FLY_MS);
    // Resume spinning once the flight lands, unless the player grabs the globe first.
    const timer = setTimeout(() => {
      controls.autoRotate = true;
    }, FLY_MS);
    const cancel = () => clearTimeout(timer);
    controls.addEventListener("start", cancel);
    return () => {
      cancel();
      controls.removeEventListener("start", cancel);
    };
  }, [resetKey]);

  const handleZoom = useCallback(({ altitude: alt }: { altitude: number }) => {
    if (globeRef.current) applyDepthRange(globeRef.current, alt);
    if (lastPointer.current) scheduleHoverRef.current();
    containerRef.current
      ?.querySelectorAll<HTMLElement>(".globe-label")
      .forEach((el) => {
        el.dataset.zoomHidden = String(alt > Number(el.dataset.maxAlt));
      });
    const rounded = Math.round(alt * 50) / 50;
    setAltitude((prev) => (prev === rounded ? prev : rounded));
  }, []);

  // Hover names come from a lat/lng lookup instead of three.js raycasting against every polygon. The lookup
  // re-runs when the pointer moves and when the camera moves under a still pointer.
  const scheduleHover = useCallback(() => {
    cancelAnimationFrame(hoverFrame.current);
    hoverFrame.current = requestAnimationFrame(() => {
      const tooltip = tooltipRef.current;
      const pointer = lastPointer.current;
      if (!tooltip) return;
      const coords = pointer
        ? globeRef.current?.toGlobeCoords(pointer.x, pointer.y)
        : null;
      const feature = coords ? locate(coords.lat, coords.lng) : null;
      const iso = feature?.properties.iso2;
      const show =
        pointer && feature && (overlayOn || (iso != null && colors.has(iso)));
      tooltip.hidden = !show;
      if (!show) return;
      tooltip.textContent = feature.properties.name;
      tooltip.style.transform = `translate(${pointer.x + 14}px, ${pointer.y + 14}px)`;
    });
  }, [locate, overlayOn, colors]);
  useEffect(() => {
    scheduleHoverRef.current = scheduleHover;
    scheduleHover(); // overlay / guesses changed under the pointer
  }, [scheduleHover]);
  useEffect(() => () => cancelAnimationFrame(hoverFrame.current), []);

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      // No names while dragging the globe.
      lastPointer.current =
        e.buttons === 0
          ? { x: e.clientX - rect.left, y: e.clientY - rect.top }
          : null;
      scheduleHover();
    },
    [scheduleHover],
  );
  const handlePointerLeave = useCallback(() => {
    lastPointer.current = null;
    scheduleHover();
  }, [scheduleHover]);

  // Only guessed / revealed countries are real polygons: raised, with side walls and outlines.
  const raisedData = useMemo(
    () =>
      features.filter(
        (f) => f.properties.iso2 !== null && colors.has(f.properties.iso2),
      ),
    [features, colors],
  );
  const capColor = useCallback(
    (d: object) => colors.get(isoOf(d) ?? "") ?? LAND,
    [colors],
  );
  const strokeColor = useCallback(
    (d: object) => (isoOf(d) === outlined ? REVEAL_BORDER : GUESSED_BORDER),
    [outlined],
  );

  const labelData = useMemo<LabelDatum[]>(
    () =>
      features
        .filter(
          (f) =>
            f.properties.playable ||
            (f.properties.areaKm2 > 100_000 && f.properties.a3 !== "ATA"),
        )
        .map((f) => ({
          lat: f.properties.labelLat,
          lng: f.properties.labelLng,
          name: f.properties.name,
          maxAlt: labelMaxAltitude(f.properties.areaKm2),
        })),
    [features],
  );

  const makeLabel = useCallback((d: object) => {
    const label = d as LabelDatum;
    const el = document.createElement("div");
    el.className = "globe-label";
    el.textContent = label.name;
    el.dataset.maxAlt = String(label.maxAlt);
    el.dataset.big = String(label.maxAlt === Infinity);
    const alt = globeRef.current?.pointOfView().altitude ?? INITIAL_ALTITUDE;
    el.dataset.zoomHidden = String(alt > label.maxAlt);
    return el;
  }, []);

  const ringData = useMemo<RingDatum[]>(
    () =>
      features
        .filter(
          (f) =>
            f.properties.tiny &&
            f.properties.iso2 &&
            (colors.has(f.properties.iso2) || overlayOn),
        )
        .map((f) => ({
          lat: f.properties.labelLat,
          lng: f.properties.labelLng,
          color: colors.get(f.properties.iso2 as string) ?? NEUTRAL_RING,
        })),
    [features, colors, overlayOn],
  );

  const alpha = ringAlpha(altitude);
  const ringColor = useCallback(
    (d: object) => {
      const [r, g, b] = hexToRgb((d as RingDatum).color);
      return (t: number) =>
        `rgba(${r},${g},${b},${((1 - t) * alpha).toFixed(3)})`;
    },
    [alpha],
  );

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-0"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {size.width > 0 && size.height > 0 && (
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          backgroundColor={SPACE}
          globeMaterial={oceanMaterial}
          showAtmosphere
          atmosphereColor="#5b8def"
          atmosphereAltitude={0.15}
          enablePointerInteraction={false}
          onGlobeReady={handleReady}
          onZoom={handleZoom}
          customLayerData={LAYERS}
          customThreeObject={customObject}
          customThreeObjectUpdate={keepCustomObject}
          polygonsData={raisedData}
          polygonCapColor={capColor}
          polygonSideColor={raisedSide}
          polygonStrokeColor={strokeColor}
          polygonAltitude={raisedAltitude}
          polygonsTransitionDuration={300}
          ringsData={ringData}
          ringLat="lat"
          ringLng="lng"
          ringAltitude={0.007}
          ringColor={ringColor}
          ringMaxRadius={1.5}
          ringPropagationSpeed={1.2}
          ringRepeatPeriod={1400}
          htmlElementsData={overlayOn ? labelData : []}
          htmlLat="lat"
          htmlLng="lng"
          htmlAltitude={0.008}
          htmlElement={makeLabel}
          htmlElementVisibilityModifier={markLabelSide}
        />
      )}
      <div
        ref={tooltipRef}
        hidden
        className="pointer-events-none absolute left-0 top-0 z-10 rounded-md bg-slate-900/90 px-2 py-1 text-sm font-semibold text-white shadow-lg"
      />
    </div>
  );
}
