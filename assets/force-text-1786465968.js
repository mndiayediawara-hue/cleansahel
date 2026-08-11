<script>
(function() {
  function isDark() {
    return document.documentElement.classList.contains('dark') ||
           window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function fixInputs() {
    var dark = isDark();
    var fg = dark ? '#f1f5f9' : '#0f172a';
    var bg = dark ? '#1e293b' : '#ffffff';
    var ph = dark ? '#64748b' : '#94a3b8';
    var els = document.querySelectorAll('input, select, textarea');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var t = (el.type || '').toLowerCase();
      if (t === 'checkbox' || t === 'radio' || t === 'submit' || t === 'button' || t === 'file') continue;
      el.style.setProperty('color', fg, 'important');
      el.style.setProperty('-webkit-text-fill-color', fg, 'important');
      el.style.setProperty('background-color', bg, 'important');
      el.style.setProperty('caret-color', fg, 'important');
      el.style.setProperty('opacity', '1', 'important');
      try { el.style.setProperty('::placeholder', 'color:' + ph, 'important'); } catch(e) {}
    }
    // Force placeholder via CSS injection (webkit + moz)
    var styleId = '__force_input_text__';
    if (!document.getElementById(styleId)) {
      var s = document.createElement('style');
      s.id = styleId;
      s.textContent = 'input::placeholder,textarea::placeholder,input::-webkit-input-placeholder,textarea::-webkit-input-placeholder{opacity:1 !important;color:' + ph + ' !important;-webkit-text-fill-color:' + ph + ' !important}';
      document.head.appendChild(s);
    }
  }
  // Run now and after DOM is ready
  fixInputs();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fixInputs);
  } else {
    setTimeout(fixInputs, 50);
  }
  // Run repeatedly to catch React-rendered inputs
  setInterval(fixInputs, 1000);
  // MutationObserver to catch new inputs
  if (window.MutationObserver) {
    var obs = new MutationObserver(function() { fixInputs(); });
    obs.observe(document.body, { childList: true, subtree: true });
  }
})();
</script>
