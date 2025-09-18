(function(){
  function escapeHTML(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Escape for inclusion inside single-quoted JS string literals in HTML attributes
  function escapeJSStringSingleQuoted(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/</g, '\\x3C');
  }

  // Expose globally for legacy code paths
  if (typeof window !== 'undefined') {
    window.escapeHTML = escapeHTML;
    window.escapeJSStringSingleQuoted = escapeJSStringSingleQuoted;
  }
})();

