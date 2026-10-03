// Generates every app icon from one mark: three rank chevrons levelling up from blood red to ember to gold.
// Run: node scripts/icons.mjs   then   npx capacitor-assets generate --android
import sharp from "sharp";
import fs from "node:fs";

const GROUND = "#17110f";
const GLOW = "#e2552c";
const RANKS = ["#d63a2f", "#f0873a", "#f6b84b"]; // bottom -> top

/** The three chevrons on a 512 grid. `ink` forces one colour (monochrome badges). */
const chevrons = (ink) => `
  <g fill="none" stroke-width="40" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="4">
    <path d="M162 402 L256 316 L350 402" stroke="${ink ?? RANKS[0]}"/>
    <path d="M162 302 L256 216 L350 302" stroke="${ink ?? RANKS[1]}"/>
    <path d="M162 202 L256 116 L350 202" stroke="${ink ?? RANKS[2]}"/>
  </g>`;
const glowDef = `<defs><radialGradient id="glow" cx="0.5" cy="0.66" r="0.6"><stop offset="0" stop-color="${GLOW}" stop-opacity="0.34"/><stop offset="1" stop-color="${GLOW}" stop-opacity="0"/></radialGradient></defs>`;
const svg = (body, view = "0 0 512 512") => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}">${body}</svg>`);

/** Rounded tile: favicon, PWA "any" icons, splash. */
const tile = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  ${glowDef}
  <rect width="512" height="512" rx="116" fill="${GROUND}"/>
  <rect width="512" height="512" rx="116" fill="url(#glow)"/>
  ${chevrons()}
</svg>
`;
/** Full-bleed square, mark shrunk into the maskable safe zone (inner 80%). */
const maskable = svg(`${glowDef}<rect width="512" height="512" fill="${GROUND}"/><rect width="512" height="512" fill="url(#glow)"/><g transform="translate(256 256) scale(0.78) translate(-256 -256)">${chevrons()}</g>`);
const background = svg(`${glowDef}<rect width="512" height="512" fill="${GROUND}"/><rect width="512" height="512" fill="url(#glow)"/>`);
const foreground = svg(chevrons());
const badge = svg(chevrons("#fff"), "76 76 360 360");

fs.writeFileSync("public/icon.svg", tile);
const tileBuf = Buffer.from(tile);

await sharp(tileBuf).resize(192, 192).png().toFile("public/icon-192.png");
await sharp(tileBuf).resize(512, 512).png().toFile("public/icon-512.png");
await sharp(maskable).resize(512, 512).png().toFile("public/icon-maskable-512.png");
await sharp(badge).resize(72, 72).png().toFile("public/badge-72.png");

// Capacitor sources. Android crops adaptive icons to the inner ~61%, so the foreground mark sits at 58%.
await sharp(maskable).resize(1024, 1024).png().toFile("assets/icon-only.png");
await sharp(background).resize(1024, 1024).png().toFile("assets/icon-background.png");
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: await sharp(foreground).resize(600, 600).png().toBuffer(), gravity: "center" }])
  .png()
  .toFile("assets/icon-foreground.png");
const splash = svg(`<rect width="2732" height="2732" fill="${GROUND}"/>`, "0 0 2732 2732");
for (const name of ["splash", "splash-dark"]) {
  await sharp(splash)
    .composite([{ input: await sharp(foreground).resize(520, 520).png().toBuffer(), gravity: "center" }])
    .png()
    .toFile(`assets/${name}.png`);
}
console.log("icons generated");
