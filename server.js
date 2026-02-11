const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');

if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/downloads', express.static(DOWNLOAD_DIR));

const PLATFORM_PATTERNS = {
  youtube: /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/i,
  instagram: /instagram\.com\/(reel|p)\//i,
  pinterest: /pinterest\./i,
};

const sanitizeFileName = (name) =>
  name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

app.post('/api/download', async (req, res) => {
  const { url, platform } = req.body;

  if (!url || !platform) {
    return res.status(400).json({ message: 'URL and platform are required.' });
  }

  const pattern = PLATFORM_PATTERNS[platform];
  if (!pattern || !pattern.test(url)) {
    return res.status(400).json({
      message: 'Please provide a valid URL for the selected platform.',
    });
  }

  const outputTemplate = path.join(DOWNLOAD_DIR, '%(title).80s-%(id)s.%(ext)s');

  const ytdlpArgs = [
    '--restrict-filenames',
    '--no-playlist',
    '--merge-output-format',
    'mp4',
    '-o',
    outputTemplate,
    url,
  ];

  const processRef = spawn('yt-dlp', ytdlpArgs);
  let stderrOutput = '';
  let responded = false;

  processRef.stderr.on('data', (chunk) => {
    stderrOutput += chunk.toString();
  });

  processRef.on('error', () => {
    if (responded) return;
    responded = true;
    return res.status(500).json({
      message:
        'Could not start yt-dlp. Please install yt-dlp on the server and try again.',
    });
  });

  processRef.on('close', (code) => {
    if (responded) return;

    if (code !== 0) {
      responded = true;
      return res.status(500).json({
        message: 'Download failed. The URL may be private or unsupported.',
        details: stderrOutput.slice(-500),
      });
    }

    const files = fs
      .readdirSync(DOWNLOAD_DIR)
      .map((file) => ({
        file,
        fullPath: path.join(DOWNLOAD_DIR, file),
        mtime: fs.statSync(path.join(DOWNLOAD_DIR, file)).mtime.getTime(),
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (!files.length) {
      responded = true;
      return res.status(500).json({ message: 'Download completed, but file was not found.' });
    }

    const latest = files[0];
    const safeName = sanitizeFileName(path.parse(latest.file).name) + path.extname(latest.file);

    responded = true;
    res.json({
      message: 'Download successful.',
      fileName: safeName,
      downloadPath: `/downloads/${encodeURIComponent(latest.file)}`,
    });
  });
});

app.listen(PORT, () => {
  console.log(`Video downloader is running at http://localhost:${PORT}`);
});
