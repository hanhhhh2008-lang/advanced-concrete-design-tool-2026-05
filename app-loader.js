(async () => {
  const manifestUrl = "app-bundle/manifest.json?v=20260519-hide-show-fix";

  function showLoadError(error) {
    console.error("Unable to load application bundle", error);
    const message = document.createElement("div");
    message.style.cssText = [
      "position:fixed",
      "inset:auto 16px 16px 16px",
      "z-index:9999",
      "padding:14px 16px",
      "border:1px solid #ef4444",
      "background:#fff5f5",
      "color:#991b1b",
      "box-shadow:0 12px 30px rgba(31,42,68,.18)",
      "font:600 14px system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    ].join(";");
    message.textContent = "The design tool could not load. Refresh the page and try again.";
    document.body.appendChild(message);
  }

  function decodeUtf8Base64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new TextDecoder("utf-8").decode(bytes);
  }

  try {
    const manifestResponse = await fetch(manifestUrl, { cache: "no-store" });
    if (!manifestResponse.ok) throw new Error(`Manifest request failed: ${manifestResponse.status}`);
    const manifest = await manifestResponse.json();
    const parts = [];
    for (const file of manifest.files) {
      const partResponse = await fetch(`${file}?v=${manifest.version}`, { cache: "no-store" });
      if (!partResponse.ok) throw new Error(`Bundle request failed: ${file}`);
      parts.push(await partResponse.text());
    }
    const script = document.createElement("script");
    script.text = `${decodeUtf8Base64(parts.join(""))}\n//# sourceURL=app.bundle.js`;
    document.head.appendChild(script);
  } catch (error) {
    showLoadError(error);
  }
})();
