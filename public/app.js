const form = document.getElementById('downloadForm');
const statusText = document.getElementById('status');
const downloadLink = document.getElementById('downloadLink');
const pasteBtn = document.getElementById('pasteBtn');
const videoUrl = document.getElementById('videoUrl');

const setStatus = (message, type = '') => {
  statusText.textContent = message;
  statusText.className = `status ${type}`.trim();
};

pasteBtn.addEventListener('click', async () => {
  if (!navigator.clipboard?.readText) {
    setStatus('Clipboard access is not available in this browser.', 'error');
    return;
  }

  try {
    const text = await navigator.clipboard.readText();
    if (!text) {
      setStatus('Clipboard is empty.', 'error');
      return;
    }

    videoUrl.value = text.trim();
    setStatus('Link pasted from clipboard.', 'success');
  } catch {
    setStatus('Could not read clipboard. Paste manually.', 'error');
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const platform = document.getElementById('platform').value;
  const url = videoUrl.value.trim();

  downloadLink.hidden = true;
  setStatus('Downloading... please wait.');

  try {
    const response = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, url }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Something went wrong.');
    }

    setStatus(result.message, 'success');
    downloadLink.hidden = false;
    downloadLink.href = result.downloadPath;
    downloadLink.download = result.fileName;
    downloadLink.textContent = `Download ${result.fileName}`;
  } catch (error) {
    setStatus(error.message || 'Download failed.', 'error');
  }
});
