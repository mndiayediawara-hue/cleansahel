
(function() {
  var attempts = 0;
  function patch() {
    attempts++;
    // Find all inputs in recipe forms with datalist
    var inputs = document.querySelectorAll('input[list*="recipes-materials"]');
    inputs.forEach(function(inp) {
      // Replace with plain text input preserving value
      var parent = inp.parentNode;
      if (parent && parent.tagName !== 'DIV') return;
      if (parent && parent.querySelector('input:not([list])')) return; // already patched
      
      var newInput = document.createElement('input');
      newInput.type = 'text';
      newInput.className = inp.className || 'input';
      newInput.value = inp.value;
      newInput.placeholder = 'Escribe el ingrediente';
      newInput.style.cssText = inp.style.cssText;
      newInput.autocomplete = 'off';
      
      // Copy the oninput handler to capture changes
      newInput.oninput = function(e) {
        inp.value = e.target.value;
        inp.dispatchEvent(new Event('input', {bubbles: true}));
      };
      
      parent.replaceChild(newInput, inp);
      // Remove datalist
      var dl = parent.querySelector('datalist');
      if (dl) dl.remove();
    });
    
    if (attempts < 20) setTimeout(patch, 500);
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patch);
  } else {
    setTimeout(patch, 1000);
  }
})();
