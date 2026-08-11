<script>
(function() {
  // Detect dark mode
  function isDark() {
    return document.documentElement.classList.contains('dark') ||
           (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  // Get colors based on mode
  function getColors() {
    var dark = isDark();
    return {
      fg: dark ? '#f1f5f9' : '#0f172a',
      bg: dark ? '#1e293b' : '#ffffff',
      ph: dark ? '#64748b' : '#94a3b8',
      border: dark ? '#475569' : '#cbd5e1'
    };
  }
  // Apply fix to a single element
  function fixElement(el) {
    if (!el) return;
    var t = (el.type || el.tagName || '').toLowerCase();
    if (t === 'checkbox' || t === 'radio' || t === 'submit' || t === 'button' || t === 'file' || t === 'hidden' || t === 'image') return;
    var c = getColors();
    // Use cssText to completely override any existing inline styles
    var existingPadding = '';
    try {
      var cs = window.getComputedStyle(el);
      existingPadding = cs.padding || '';
    } catch(e) {}
    el.style.cssText = 'color: ' + c.fg + ' !important; -webkit-text-fill-color: ' + c.fg + ' !important; background-color: ' + c.bg + ' !important; caret-color: ' + c.fg + ' !important; opacity: 1 !important; ' + (existingPadding ? 'padding: ' + existingPadding + ' !important; ' : '');
  }
  // Fix all inputs in the document
  function fixAll() {
    var inputs = document.querySelectorAll('input, select, textarea, [contenteditable="true"]');
    for (var i = 0; i < inputs.length; i++) {
      fixElement(inputs[i]);
    }
    // Also inject a style tag with placeholder rules
    if (!document.getElementById('__force_placeholder__')) {
      var s = document.createElement('style');
      s.id = '__force_placeholder__';
      s.textContent = 'input::placeholder,textarea::placeholder,input::-webkit-input-placeholder,textarea::-webkit-input-placeholder{opacity:1 !important}';
      document.head.appendChild(s);
    }
  }
  // Run as soon as possible
  fixAll();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fixAll);
  } else {
    setTimeout(fixAll, 10);
  }
  // Run every 500ms to catch new inputs
  setInterval(fixAll, 500);
  // MutationObserver to catch dynamic inputs
  if (window.MutationObserver) {
    var obs = new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.addedNodes && m.addedNodes.length) {
          for (var j = 0; j < m.addedNodes.length; j++) {
            var n = m.addedNodes[j];
            if (n.nodeType === 1) {
              if (/^(INPUT|SELECT|TEXTAREA)$/i.test(n.tagName || '')) {
                fixElement(n);
              }
              if (n.querySelectorAll) {
                var children = n.querySelectorAll('input, select, textarea');
                for (var k = 0; k < children.length; k++) {
                  fixElement(children[k]);
                }
              }
            }
          }
        }
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
</script>
