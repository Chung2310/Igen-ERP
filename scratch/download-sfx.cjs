const fs = require('fs');
const path = require('path');

async function download() {
  const url = "https://remotion.media/whoosh.wav";
  const destDir = path.join(__dirname, '../public/sfx');
  const destPath = path.join(destDir, 'whoosh.wav');

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  console.log("Downloading whoosh sound from", url);
  try {
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const buffer = await res.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(buffer));
    console.log("Successfully downloaded to", destPath);
  } catch (err) {
    console.error("Failed to download:", err);
  }
}

download();
