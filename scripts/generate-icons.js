const sharp = require("sharp");
const path = require("path");

const SRC = path.join(__dirname, "..", "assets", "Reline Meta Engine.png");
const PUBLIC = path.join(__dirname, "..", "public");
const APP = path.join(__dirname, "..", "app");

// Crop region containing just the shield emblem (no banner text below it),
// eyeballed against the known 2522x1664 source.
const ICON_CROP = { left: 610, top: 10, width: 1300, height: 1130 };

async function main() {
  const iconBuf = await sharp(SRC).extract(ICON_CROP).toBuffer();

  const png = { compressionLevel: 9, palette: true };

  // Next.js App Router auto-detects these filenames in app/.
  await sharp(iconBuf).resize(192, 192).png(png).toFile(path.join(APP, "icon.png"));
  await sharp(iconBuf).resize(180, 180).png(png).toFile(path.join(APP, "apple-icon.png"));
  await sharp(iconBuf).resize(32, 32).png(png).toFile(path.join(PUBLIC, "favicon-32.png"));
  await sharp(iconBuf).resize(32, 32).toFile(path.join(APP, "favicon.ico"));

  // Standalone square logo (for the sidebar / auth screens).
  await sharp(iconBuf).resize(256, 256).png(png).toFile(path.join(PUBLIC, "logo-icon.png"));

  // Full logo incl. "RELINE META PROJECT by Panasonic" banner, for larger spots.
  await sharp(SRC).resize(900).jpeg({ quality: 85 }).toFile(path.join(PUBLIC, "logo-full.jpg"));

  console.log("Done: app/icon.png, app/apple-icon.png, app/favicon.ico, public/logo-icon.png, public/logo-full.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
