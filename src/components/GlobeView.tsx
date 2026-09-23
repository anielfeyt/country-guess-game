"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import { MeshPhongMaterial } from "three";
import { hexToRgb } from "@/src/lib/heat";
import type { CountryFeature } from "@/src/lib/types";
import { labelMaxAltitude, ringAlpha } from "@/src/lib/zoom";

export interface GlobeViewProps {
  features: CountryFeature[];
  colors: ReadonlyMap<string, string>;
  outlined: string | null;
  overlayOn: boolean;
  focus: { iso2: string; seq: number } | null;
}

const SPACE = "#050814";
const OCEAN = "#0b2a4a";
const LAND = "#3f4a5a";
const OVERLAY_BORDER = "rgba(255,255,255,0.45)";
const GUESSED_BORDER = "rgba(15,23,42,0.9)";
const REVEAL_BORDER = "#ffffff";
// Never `false`: three-globe only lifts a stroke above its cap when the polygon's altitude changes, so a stroke
// switched on later (overlay toggle) would stay hidden under the land. A transparent stroke exists from the start.
const HIDDEN_BORDER = "rgba(0,0,0,0)";
const NEUTRAL_RING = "#e5e7eb";

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

const isoOf = (d: object) => (d as CountryFeature).properties.iso2;
// Module-level so their identity is stable. A new function per render makes react-globe.gl rebuild the layer.
const sideColor = () => "rgba(0,0,0,0.25)";
const markLabelSide = (el: HTMLElement, visible: boolean) => {
  el.dataset.front = String(visible);
};

export default function GlobeView({ features, colors, outlined, overlayOn, focus }: GlobeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [altitude, setAltitude] = useState(INITIAL_ALTITUDE);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const oceanMaterial = useMemo(() => new MeshPhongMaterial({ color: OCEAN, shininess: 6 }), []);

  const byIso = useMemo(
    () => new Map(features.filter((f) => f.properties.iso2).map((f) => [f.properties.iso2 as string, f])),
    [features],
  );

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
  }, []);

  useEffect(() => {
    const globe = globeRef.current;
    const feature = focus ? byIso.get(focus.iso2) : undefined;
    if (!globe || !feature) return;
    const controls = globe.controls();
    controls.autoRotate = false;
    // Flush the damped auto-rotate momentum; otherwise it keeps turning the camera after the flight lands
    // (by ~0.4° at low frame rates, enough to push a micro-state off-screen at deep zoom).
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = damping;
    const { labelLat, labelLng, tiny } = feature.properties;
    globe.pointOfView({ lat: labelLat, lng: labelLng, altitude: tiny ? 0.4 : 2 }, FLY_MS);
  }, [focus, byIso]);

  const handleZoom = useCallback(({ altitude: alt }: { altitude: number }) => {
    containerRef.current?.querySelectorAll<HTMLElement>(".globe-label").forEach((el) => {
      el.dataset.zoomHidden = String(alt > Number(el.dataset.maxAlt));
    });
    const rounded = Math.round(alt * 50) / 50;
    setAltitude((prev) => (prev === rounded ? prev : rounded));
  }, []);

  // Polygon accessors: only change when game colours / overlay change, not on zoom.
  const capColor = useCallback((d: object) => colors.get(isoOf(d) ?? "") ?? LAND, [colors]);
  const strokeColor = useCallback(
    (d: object) => {
      const iso = isoOf(d);
      if (iso && iso === outlined) return REVEAL_BORDER;
      if (iso && colors.has(iso)) return GUESSED_BORDER;
      return overlayOn ? OVERLAY_BORDER : HIDDEN_BORDER;
    },
    [colors, outlined, overlayOn],
  );
  const polygonAltitude = useCallback((d: object) => (colors.has(isoOf(d) ?? "") ? 0.006 : 0.002), [colors]);
  const polygonLabel = useCallback(
    (d: object) => {
      const f = d as CountryFeature;
      const known = f.properties.iso2 !== null && colors.has(f.properties.iso2);
      return known || overlayOn ? `<b>${f.properties.name}</b>` : "";
    },
    [colors, overlayOn],
  );

  const labelData = useMemo<LabelDatum[]>(
    () =>
      features
        .filter((f) => f.properties.playable || (f.properties.areaKm2 > 100_000 && f.properties.a3 !== "ATA"))
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
        .filter((f) => f.properties.tiny && f.properties.iso2 && (colors.has(f.properties.iso2) || overlayOn))
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
      return (t: number) => `rgba(${r},${g},${b},${((1 - t) * alpha).toFixed(3)})`;
    },
    [alpha],
  );

  return (
    <div ref={containerRef} className="absolute inset-0">
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
          onGlobeReady={handleReady}
          onZoom={handleZoom}
          polygonsData={features}
          polygonCapColor={capColor}
          polygonSideColor={sideColor}
          polygonStrokeColor={strokeColor}
          polygonAltitude={polygonAltitude}
          polygonLabel={polygonLabel}
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
    </div>
  );
}
