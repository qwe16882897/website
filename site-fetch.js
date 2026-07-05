/** 真实创作者站：按 slug 从 API 加载配置 → window.DEMO_SITE → demo-render.js（与 demo 共用渲染）
 * 导出包模式：若 HTML 内嵌 window.__EXPORTED_SITE_DATA__ 则直接使用，不走 API */
(function () {
  function resolveAssetUrl(url) {
    if (typeof window.resolveSiteAssetUrl === 'function') {
      return window.resolveSiteAssetUrl(url);
    }
    return url;
  }

  function setupSiteData(d) {
    window.DEMO_SITE = {
      siteName: d.siteName,
      tagline: d.tagline,
      avatarUrl: resolveAssetUrl(d.avatarUrl),
      queueStatus: d.queueStatus,
      showWaitTime: d.showWaitTime,
      estWaitTime: d.estWaitTime,
      blocks: d.blocks,
      capabilities: d.capabilities,
      workTabs: d.workTabs,
      works: (d.works || []).map(function (w) {
        return {
          title: w.title,
          image: resolveAssetUrl(w.image),
          category: w.category || '',
        };
      }),
      terms: d.terms || [],
      infoModules: d.infoModules || [],
      contacts: d.contacts || [],
      socials: d.socials || [],
      footer: d.footer,
      legalLinks: d.legalLinks,
      tokens: d.tokens,
      siteLanguage: d.siteLanguage || 'zh',
    };
    if (d.tokens) {
      document.documentElement.style.setProperty('--primary', d.tokens.primary || '#77B7FF');
      document.documentElement.style.setProperty('--accent', d.tokens.accent || '#8FB0D9');
      document.documentElement.dataset.theme = d.tokens.theme === 'dark' ? 'dark' : 'light';
      var bgMode = d.tokens.backgroundMode || (d.tokens.backgroundImage || d.tokens.backgroundVideo ? 'custom' : 'solid');
      if (d.tokens.backgroundColor && d.tokens.theme !== 'dark' && bgMode === 'solid') {
        document.documentElement.style.setProperty('--bg', d.tokens.backgroundColor);
      } else {
        document.documentElement.style.removeProperty('--bg');
      }
      if (bgMode === 'custom' && d.tokens.backgroundImage) {
        var bgUrl = resolveAssetUrl(d.tokens.backgroundImage);
        document.documentElement.style.setProperty('--bg-image', 'url(' + bgUrl + ')');
        var bgPreload = new Image();
        bgPreload.src = bgUrl;
      } else {
        document.documentElement.style.removeProperty('--bg-image');
      }
      if (bgMode === 'custom' && d.tokens.backgroundVideo) {
        var videoUrl = resolveAssetUrl(d.tokens.backgroundVideo);
        var preloadLink = document.createElement('link');
        preloadLink.rel = 'preload';
        preloadLink.as = 'video';
        preloadLink.href = videoUrl;
        document.head.appendChild(preloadLink);
      }
      if (d.tokens.siteFont) {
        var fontMap = {
          '思源黑体': '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
          '阿里巴巴普惠体': '"Alibaba PuHuiTi", "PingFang SC", "Microsoft YaHei", sans-serif',
          '站酷文艺体': '"ZCOOL WenYiTi", "站酷文艺体", "KaiTi", "STKaiti", serif',
          'VIVO体': '"VIVO体", "PingFang SC", "Microsoft YaHei", sans-serif',
          '卡洛古典英文': '"Carattere", "Georgia", "Times New Roman", serif',
          '猫啃珠圆体': '"MaokenZhuyuanTi", "PingFang SC", "Microsoft YaHei", sans-serif',
        };
        var ff = fontMap[d.tokens.siteFont];
        if (ff) document.documentElement.style.setProperty('--site-font', ff);
      }
    }
    document.dispatchEvent(new CustomEvent('demo-site-ready'));
  }

  // ---- 导出包模式：直接使用内嵌数据 ----
  if (window.__EXPORTED_SITE_DATA__) {
    setupSiteData(window.__EXPORTED_SITE_DATA__);
    return;
  }

  var params = new URLSearchParams(window.location.search);
  var slug = params.get('slug');
  if (!slug) return;

  var apiBase = window.SITE_API_BASE || '/api/public/site/';
  var apiUrl = apiBase + encodeURIComponent(slug);

  function failLoad(err) {
    console.error('[site-fetch] 加载失败:', apiUrl, err);
    document.documentElement.classList.remove('awaiting-site-data');
    var main = document.querySelector('main') || document.body;
    var el = document.createElement('div');
    el.style.cssText = 'padding:80px 24px;text-align:center;color:#666;font-family:sans-serif;';
    var msg =
      err && err.code === 'NOT_FOUND'
        ? '站点不存在，请检查链接是否正确。'
        : '无法拉取数据，请确认本地 API（3001）已启动后重试。';
    el.innerHTML =
      '<h1 style="color:#333;margin-bottom:12px;">站点数据加载失败</h1>' +
      '<p>' + msg + '</p>' +
      '<p style="margin-top:8px;font-size:12px;color:#999;">' + apiUrl + '</p>';
    if (main.parentNode) main.parentNode.insertBefore(el, main);
    if (main) main.hidden = true;
    document.dispatchEvent(new CustomEvent('demo-site-failed'));
  }

    fetch(apiUrl)
    .then(function (res) {
      return res.json().then(function (json) {
        if (!res.ok || !json.success || !json.data) {
          var err = new Error(json.message || 'HTTP ' + res.status);
          err.code = res.status === 404 ? 'NOT_FOUND' : 'API_ERROR';
          throw err;
        }
        return json;
      });
    })
    .then(function (json) {
      setupSiteData(json.data);
    })
    .catch(function (err) {
      failLoad(err);
    });
})();
