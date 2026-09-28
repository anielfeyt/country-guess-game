import { ImageResponse } from "next/og";
import { loadDemoRound, renderGlobeSvg, svgDataUri } from "@/src/lib/globeArt";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** Tab icon: the globe heat-mapped around the secret country (green), neighbours deep red. */
export default async function Icon() {
  const { features, heatmap } = await loadDemoRound();
  const globe = renderGlobeSvg(features, { size: size.width, rotate: [-12, -30], colors: heatmap });
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element
    <img src={svgDataUri(globe)} width={size.width} height={size.height} alt="" />,
    size,
  );
}
