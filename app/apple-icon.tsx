import { ImageResponse } from "next/og";
import { ART_SPACE, loadDemoRound, renderGlobeSvg, svgDataUri } from "@/src/lib/globeArt";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: opaque background, since iOS masks the corners itself. */
export default async function AppleIcon() {
  const { features, heatmap } = await loadDemoRound();
  const globe = renderGlobeSvg(features, { size: size.width, rotate: [-12, -30], colors: heatmap, borderWidth: 0.4, glow: true });
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: ART_SPACE }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={svgDataUri(globe)} width={size.width} height={size.height} alt="" />
    </div>,
    size,
  );
}
