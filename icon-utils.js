/** 图标渲染通用工具：HTML 转义 + 静态资源路径解析 */
(function (global) {
  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function resolveIconSrc(src) {
    var resolved = src;
    if (typeof global.resolveSiteAssetUrl === 'function') {
      resolved = global.resolveSiteAssetUrl(src);
    }
    if (/^\/images\//.test(resolved)) {
      return encodeURI(resolved);
    }
    return resolved;
  }

  global.IconUtils = { escapeHtml: escapeHtml, resolveIconSrc: resolveIconSrc };
})(typeof window !== 'undefined' ? window : globalThis);
