(function() {
  function isDark() {
    return document.documentElement.classList.contains('dark') ||
           (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function getColors() {
    var dark = isDark();
    return {
      fg: dark ? '#f1f5f9' : '#0f172a',
      bg: dark ? '#1e293b' : '#ffffff',
      ph: dark ? '#64748b' : '#94a3b8'
    };
  }
  function fixElement(el) {
    if (!el) return;
    var tag = (el.tagName || '').toLowerCase();
    var type = (el.type || '').toLowerCase();
    if (tag === 'input' && (type === 'checkbox' || type === 'radio' || type === 'submit' || type === 'button' || type === 'file' || type === 'hidden' || type === 'image')) return;
    var c = getColors();
    el.style.cssText += ';color: ' + c.fg + ' !important; -webkit-text-fill-color: ' + c.fg + ' !important; background-color: ' + c.bg + ' !important; caret-color: ' + c.fg + ' !important; opacity: 1 !important;';
    // ESPECÍFICO para inputs con datalist (list attribute): Safari los pone con text-fill-color transparente
    if (el.hasAttribute && el.hasAttribute('list')) {
      el.setAttribute('list', el.getAttribute('list'));
      // Forzar estilos una y otra vez para inputs con list
      el.style.setProperty('color', c.fg, 'important');
      el.style.setProperty('-webkit-text-fill-color', c.fg, 'important');
    }
  }
  function fixAll() {
    var inputs = document.querySelectorAll('input, select, textarea, [contenteditable="true"]');
    for (var i = 0; i < inputs.length; i++) fixElement(inputs[i]);
  }
  // INYECTAR estilo CSS con prioridad máxima para inputs con list
  function injectCSS() {
    if (document.getElementById('__force_list_input__')) return;
    var s = document.createElement('style');
    s.id = '__force_list_input__';
    s.textContent = 'input[list]{color:#0f172a !important;-webkit-text-fill-color:#0f172a !important;background-color:#ffffff !important;caret-color:#0f172a !important;opacity:1 !important}html.dark input[list],.dark input[list]{color:#f1f5f9 !important;-webkit-text-fill-color:#f1f5f9 !important;background-color:#1e293b !important;caret-color:#f1f5f9 !important}input::placeholder,textarea::placeholder,input::-webkit-input-placeholder,textarea::-webkit-input-placeholder{opacity:1 !important}';
    (document.head || document.documentElement).appendChild(s);
  }
  fixAll();
  injectCSS();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { fixAll(); injectCSS(); });
  } else {
    setTimeout(function() { fixAll(); injectCSS(); }, 10);
  }
  setInterval(fixAll, 300);
  if (window.MutationObserver) {
    var obs = new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.addedNodes && m.addedNodes.length) {
          for (var j = 0; j < m.addedNodes.length; j++) {
            var n = m.addedNodes[j];
            if (n.nodeType === 1) {
              var tag = (n.tagName || '');
              if (/^(INPUT|SELECT|TEXTAREA)$/i.test(tag)) fixElement(n);
              if (n.querySelectorAll) {
                var children = n.querySelectorAll('input, select, textarea');
                for (var k = 0; k < children.length; k++) fixElement(children[k]);
              }
            }
          }
        }
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
