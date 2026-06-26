const fs = require('fs');
const path = require('path');

async function download() {
  const url = "https://assets.mixkit.co/active_storage/sfx/2013/2013-84.wav";
  const destDir = path.join(__dirname, '../public/sfx');
  const destPath = path.join(destDir, 'whoosh.wav');

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  console.log("Downloading whoosh sound from", url);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Referer": "https://mixkit.co/",
      }
    });

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
