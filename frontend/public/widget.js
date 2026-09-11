/*
 * Helpdesk support widget loader.
 * Drop-in launcher: a floating bubble that opens the support form on click.
 *
 *   <script src="https://your-app/widget.js"
 *           data-key="wgt_your_public_key"
 *           data-color="#4f46e5"
 *           data-greeting="Namaste, how may I help you?"></script>
 */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var key = script.getAttribute('data-key');
  if (!key) {
    if (window.console) console.error('[Helpdesk widget] missing data-key');
    return;
  }
  if (window.__helpdeskWidgetLoaded) return;
  window.__helpdeskWidgetLoaded = true;

  var color = script.getAttribute('data-color') || '#4f46e5';
  var greeting = script.getAttribute('data-greeting') || 'Hi! How can we help?';
  var origin = new URL(script.src, location.href).origin;
  var open = false;

  var chatIcon =
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
  var closeIcon =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  var root = document.createElement('div');
  root.style.cssText =
    'position:fixed;bottom:20px;right:20px;z-index:2147483000;' +
    "font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

  var panel = document.createElement('div');
  panel.style.cssText =
    'position:absolute;bottom:78px;right:0;width:380px;max-width:calc(100vw - 40px);' +
    'height:560px;max-height:calc(100vh - 120px);border-radius:16px;overflow:hidden;' +
    'box-shadow:0 16px 50px rgba(16,24,40,0.28);background:#fff;opacity:0;' +
    'transform:translateY(12px) scale(0.98);pointer-events:none;' +
    'transition:opacity .2s ease, transform .2s ease;';
  var iframe = document.createElement('iframe');
  iframe.title = 'Support';
  iframe.style.cssText = 'width:100%;height:100%;border:0;display:block;';
  panel.appendChild(iframe);

  var bubble = document.createElement('div');
  bubble.textContent = greeting;
  bubble.style.cssText =
    'position:absolute;bottom:12px;right:78px;max-width:220px;background:#fff;color:#101828;' +
    'padding:10px 14px;border-radius:14px;border-bottom-right-radius:4px;' +
    'box-shadow:0 8px 24px rgba(16,24,40,0.18);font-size:14px;line-height:1.4;cursor:pointer;' +
    'display:none;opacity:0;transform:translateY(6px);transition:opacity .25s ease, transform .25s ease;';

  var btn = document.createElement('button');
  btn.setAttribute('aria-label', 'Open support');
  btn.innerHTML = chatIcon;
  btn.style.cssText =
    'width:60px;height:60px;border-radius:50%;border:0;cursor:pointer;background:' +
    color +
    ';box-shadow:0 10px 28px rgba(16,24,40,0.28);display:flex;align-items:center;justify-content:center;' +
    'transition:transform .15s ease;padding:0;';
  btn.onmouseenter = function () {
    btn.style.transform = 'scale(1.06)';
  };
  btn.onmouseleave = function () {
    btn.style.transform = 'scale(1)';
  };

  function hideBubble() {
    bubble.style.opacity = '0';
    bubble.style.transform = 'translateY(6px)';
    setTimeout(function () {
      bubble.style.display = 'none';
    }, 250);
  }

  function setOpen(value) {
    open = value;
    if (open) {
      if (!iframe.src) iframe.src = origin + '/widget?key=' + encodeURIComponent(key);
      panel.style.opacity = '1';
      panel.style.transform = 'translateY(0) scale(1)';
      panel.style.pointerEvents = 'auto';
      btn.innerHTML = closeIcon;
      hideBubble();
    } else {
      panel.style.opacity = '0';
      panel.style.transform = 'translateY(12px) scale(0.98)';
      panel.style.pointerEvents = 'none';
      btn.innerHTML = chatIcon;
    }
  }

  btn.onclick = function () {
    setOpen(!open);
  };
  bubble.onclick = function () {
    setOpen(true);
  };

  root.appendChild(panel);
  root.appendChild(bubble);
  root.appendChild(btn);

  function mount() {
    document.body.appendChild(root);
    setTimeout(function () {
      if (open) return;
      bubble.style.display = 'block';
      requestAnimationFrame(function () {
        bubble.style.opacity = '1';
        bubble.style.transform = 'translateY(0)';
      });
    }, 1200);
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
