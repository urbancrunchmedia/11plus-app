import React from "react";
import { getIconMarkup } from "./Icon";

// The shared badge/rank crest shape — a faceted gem, like Prodigy Math's
// Stone-through-Diamond tiers, where more facets = a harder tier. Used for
// the Rank crest, every badge icon, and the celebration pop-up, so all of
// them read as one consistent object family rather than separate icons.
// `facetCount` (2-6) sets the pavilion's complexity; everything else about
// the shape stays fixed so only colour + facets vary.
export default function Gem({
  size = 96,
  facetCount = 3,
  colorLight = "#fde68a",
  colorMid = "#f2c94c",
  colorDark = "#d4a017",
  icon,
  iconColor = "#ffffff",
  className,
}) {
  const n = Math.max(2, Math.min(6, facetCount));
  const left = 10, right = 90, y = 40, tipX = 50, tipY = 90;
  const facets = [];
  for (let i = 0; i < n; i++) {
    const x0 = left + (i / n) * (right - left);
    const x1 = left + ((i + 1) / n) * (right - left);
    facets.push({
      points: `${x0},${y} ${x1},${y} ${tipX},${tipY}`,
      fill: i % 2 === 0 ? colorMid : colorDark,
    });
  }
  const iconMarkup = icon ? getIconMarkup(icon) : null;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <polygon points="30,20 70,20 58,40 42,40" fill={colorLight} />
      <polygon points="30,20 10,40 42,40" fill={colorMid} />
      <polygon points="70,20 90,40 58,40" fill={colorDark} />
      {facets.map((f, i) => <polygon key={i} points={f.points} fill={f.fill} />)}
      <polygon
        points="30,20 70,20 90,40 50,90 10,40"
        fill="none"
        stroke="rgba(0,0,0,0.18)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <polygon
        points="18,30 20,30 21,27 22,30 24,30 21.8,32 22.6,35 20.5,33 18.4,35 19.2,32"
        fill="rgba(255,255,255,0.8)"
      />
      {iconMarkup && (
        <svg
          x={42} y={22} width={16} height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke={iconColor}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          dangerouslySetInnerHTML={{ __html: iconMarkup }}
        />
      )}
    </svg>
  );
}
