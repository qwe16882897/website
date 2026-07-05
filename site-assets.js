/** 离线版个人站静态资源路径解析（uploads / figma / images） */
(function (global) {
  function resolveSiteAssetUrl(url) {
    if (!url) return url;
    if (/^(data:|blob:|https?:)/i.test(url)) return url;
    var path = url.charAt(0) === '/' ? url : '/' + url;

    // 兼容旧数据里带的 /site/ 前缀
    if (path.indexOf('/site/assets/') === 0) {
      return path.replace(/^\/site/, '');
    }
    if (path.indexOf('/site/figma/') === 0) {
      return path.replace(/^\/site\/figma/, '/figma');
    }
    if (path.indexOf('/studio/figma/') === 0) {
      return path.replace(/^\/studio\/figma/, '/figma');
    }

    // 兼容旧路径：旧版 avatar.png 不存在，统一指向 avatar.png
    if (path === '/figma/avatar.svg') {
      return '/figma/avatar.png';
    }

    if (path.indexOf('/uploads/') === 0) {
      var mediaBase = global.SITE_API_MEDIA_BASE || '';
      if (!mediaBase && global.SITE_API_BASE) {
        mediaBase = String(global.SITE_API_BASE).replace(/\/public\/site\/?$/, '');
      }
      if (mediaBase) {
        return mediaBase.replace(/\/$/, '') + '/media/' + path.replace(/^\/uploads\//, '');
      }
    }

    return path;
  }

  global.resolveSiteAssetUrl = resolveSiteAssetUrl;
})(window);
