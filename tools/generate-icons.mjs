import { writeFileSync } from "node:fs";
import sharp from "sharp";

const tracePath = `
  <rect x="265" y="190" width="72" height="620" rx="36" fill="CURRENT_AXIS"/>
  <path d="M 610 190 C 720 290, 710 410, 650 500 C 585 598, 610 705, 705 810"
        fill="none" stroke="CURRENT_TRACE" stroke-width="72" stroke-linecap="round"/>
`;

const webSvg = symbolSvg({ background: "#F2EEE6", axis: "#151310", trace: "#806451", rounded: true });
writeFileSync("public/icon.svg", webSvg);
writeFileSync("public/favicon.svg", webSvg);

await Promise.all([
  render(webSvg, "public/favicon-16x16.png", 16),
  render(webSvg, "public/favicon-32x32.png", 32),
  render(symbolSvg({ background: "#F2EEE6", axis: "#151310", trace: "#806451" }), "public/apple-touch-icon.png", 180),
  render(webSvg, "public/icon-192.png", 192),
  render(webSvg, "public/icon-512.png", 512),
  render(symbolSvg({ background: "#F2EEE6", axis: "#151310", trace: "#806451" }), "public/icon-maskable-512.png", 512),
  render(symbolSvg({ background: "#F2EEE6", axis: "#151310", trace: "#806451" }), "Form/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon-Any-1024.png", 1024),
  render(symbolSvg({ background: "#151310", axis: "#FBF9F4", trace: "#FBF9F4" }), "Form/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon-Dark-1024.png", 1024),
  render(symbolSvg({ background: "#F2EEE6", axis: "#151310", trace: "#151310" }), "Form/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon-Tinted-1024.png", 1024)
]);

function symbolSvg({ background, axis, trace, rounded = false }) {
  const radius = rounded ? " rx=\"220\"" : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">
  <rect width="1000" height="1000"${radius} fill="${background}"/>
${tracePath.replace("CURRENT_AXIS", axis).replace("CURRENT_TRACE", trace)}
</svg>\n`;
}

async function render(svg, target, size) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(target);
}
