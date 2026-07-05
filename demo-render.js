/** 根据 DEMO_SITE 渲染两套界面框架的共用内容块（demo 与 ?slug= 真实创作者站共用本文件） */
(function () {
  var hasSlug = new URLSearchParams(window.location.search).get('slug');
  var worksViewerBound = false;

  /* ---- 可调参数 ---- */
  var TOAST_VISIBLE_MS = 1600;   // 复制成功提示停留时长
  var TOAST_FADE_OUT_MS = 220;   // 提示淡出动画时长
  var DRAG_SENSITIVITY  = 300;   // 3D 画廊拖动灵敏度（像素/单位）
  var MAX_FRAME_DELTA_SEC = 0.05; // 动画帧间隔上限，防跳帧
  var DEFAULT_CELL_WIDTH = 120;   // 横向画廊默认格子宽
  var DEFAULT_GAP = 27;           // 横向画廊默认间距

  function bindWorksImageViewer() {
    if (worksViewerBound) return;
    worksViewerBound = true;
    document.addEventListener('click', function (e) {
      var card = e.target.closest('[data-demo="works-grid"] .card');
      if (!card) return;
      var grid = card.closest('[data-demo="works-grid"]');
      if (!grid || !grid._workList || !grid._workList.length) return;
      var cards = grid.querySelectorAll('.card');
      var workIndexAttr = card.getAttribute('data-work-index');
      var index =
        workIndexAttr != null
          ? parseInt(workIndexAttr, 10)
          : Array.prototype.indexOf.call(cards, card);
      if (index < 0) return;
      if (window.WorkImageViewer) {
        e.preventDefault();
        window.WorkImageViewer.open(grid._workList, index);
      }
    });
  }
  bindWorksImageViewer();

  function normalizeAvatarShape(shape) {
    if (shape === 'square' || shape === 'portrait') return shape;
    return 'circle';
  }

  function applyAvatarShape(shape) {
    var cls =
      shape === 'square'
        ? 'avatar--square'
        : shape === 'portrait'
          ? 'avatar--portrait'
          : 'avatar--circle';
    document.querySelectorAll('.hero-avatar, .sb-avatar').forEach(function (el) {
      el.classList.remove('avatar--circle', 'avatar--square', 'avatar--portrait');
      el.classList.add(cls);
    });
  }

  function applySiteTokens(tokens) {
    if (!tokens) return;
    document.documentElement.style.setProperty('--primary', tokens.primary || '#77B7FF');
    document.documentElement.style.setProperty('--accent', tokens.accent || '#8FB0D9');
    document.documentElement.dataset.theme = tokens.theme === 'dark' ? 'dark' : 'light';
    var mode = tokens.backgroundMode || (tokens.backgroundImage || tokens.backgroundVideo ? 'custom' : 'solid');
    if (mode === 'solid' && tokens.backgroundColor) {
      document.documentElement.style.setProperty('--bg', tokens.backgroundColor);
    } else {
      document.documentElement.style.removeProperty('--bg');
    }
    if (mode === 'custom' && tokens.backgroundImage) {
      var bgUrl = tokens.backgroundImage;
      if (typeof window.resolveSiteAssetUrl === 'function') {
        bgUrl = window.resolveSiteAssetUrl(bgUrl);
      }
      document.documentElement.style.setProperty('--bg-image', 'url(' + bgUrl + ')');
    } else {
      document.documentElement.style.removeProperty('--bg-image');
    }
    // 视频背景
    var videoEl = document.getElementById('bg-video');
    if (mode === 'custom' && tokens.backgroundVideo) {
      var videoUrl = tokens.backgroundVideo;
      if (typeof window.resolveSiteAssetUrl === 'function') {
        videoUrl = window.resolveSiteAssetUrl(videoUrl);
      }
      if (!videoEl) {
        videoEl = document.createElement('video');
        videoEl.id = 'bg-video';
        videoEl.autoplay = true;
        videoEl.loop = true;
        videoEl.muted = true;
        videoEl.playsInline = true;
        videoEl.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:-1;pointer-events:none;';
        document.body.prepend(videoEl);
      }
      if (videoEl.src !== videoUrl) {
        videoEl.src = videoUrl;
        videoEl.load();
        videoEl.play().catch(function () { /* 自动播放被浏览器阻止时静默 */ });
      }
      videoEl.style.display = '';
    } else if (videoEl) {
      videoEl.src = '';
      videoEl.style.display = 'none';
    }
    if (tokens.siteFont) {
      var fontFamily = getFontFamily(tokens.siteFont);
      if (fontFamily) {
        document.documentElement.style.setProperty('--site-font', fontFamily);
      } else {
        document.documentElement.style.removeProperty('--site-font');
      }
    } else {
      document.documentElement.style.removeProperty('--site-font');
    }
    applySiteCursor(tokens);
    applyAvatarShape(normalizeAvatarShape(tokens.avatarShape));
    applyMouseAnimation(tokens);
  }

  /** 招财猫光标：逻辑 25×30，hd 为 2x 平滑缩放 */
  var CAT_WINK_CURSOR = {
    logicalW: 25,
    logicalH: 30,
    hotHdX: 0,
    hotHdY: 0,
    hot1xX: 0,
    hot1xY: 0,
  };

  function cursorSizeSyntaxSupported() {
    try {
      return !!(
        window.CSS &&
        CSS.supports(
          'cursor',
          'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==") 0 0 / 1 1, auto',
        )
      );
    } catch (e) {
      return false;
    }
  }

  /** 自定义光标 DOM 跟随（避免 CSS cursor:url 与系统箭头双显、闪烁） */
  var CUSTOM_CURSOR_DISPLAY_MAX = 64;
  var customCursorFollower = {
    key: '',
    seq: 0,
    el: null,
    onMove: null,
    onOut: null,
  };

  function resolveCustomCursorUrl(rawUrl) {
    if (!rawUrl) return '';
    var url = rawUrl;
    if (typeof window.resolveSiteAssetUrl === 'function') {
      url = window.resolveSiteAssetUrl(url);
    }
    return url;
  }

  function getCustomCursorCacheKey(tokens) {
    if (!tokens || tokens.siteCursor !== 'custom' || !tokens.customCursorImage) return '';
    return 'custom:' + resolveCustomCursorUrl(tokens.customCursorImage);
  }

  function ensureCustomCursorStyles() {
    if (document.getElementById('site-custom-cursor-styles')) return;
    var style = document.createElement('style');
    style.id = 'site-custom-cursor-styles';
    style.textContent =
      'html.site-custom-cursor-active, html.site-custom-cursor-active *, html.site-custom-cursor-active *::before, html.site-custom-cursor-active *::after { cursor: none !important; }' +
      '#site-custom-cursor { position: fixed; top: 0; left: 0; pointer-events: none !important; z-index: 2147483647; user-select: none; margin: 0; padding: 0; border: 0; transform: translate3d(-9999px, -9999px, 0); will-change: transform; }';
    document.head.appendChild(style);
  }

  function setCustomCursorHidden(active) {
    ensureCustomCursorStyles();
    document.documentElement.classList.toggle('site-custom-cursor-active', !!active && !isPreviewEmbed);
    document.documentElement.classList.toggle('site-custom-cursor-preview', !!(active && isPreviewEmbed));
  }

  function destroyCustomCursorFollower() {
    customCursorFollower.seq += 1;
    if (customCursorFollower.onMove) {
      document.removeEventListener('pointermove', customCursorFollower.onMove, true);
      customCursorFollower.onMove = null;
    }
    if (customCursorFollower.onOut) {
      document.documentElement.removeEventListener('pointerleave', customCursorFollower.onOut);
      customCursorFollower.onOut = null;
    }
    if (customCursorFollower.el) {
      customCursorFollower.el.remove();
      customCursorFollower.el = null;
    }
    customCursorFollower.key = '';
  }

  function startCustomCursorFollower(imageUrl, cacheKey) {
    if (customCursorFollower.key === cacheKey) return;
    destroyCustomCursorFollower();
    customCursorFollower.key = cacheKey;
    var loadSeq = customCursorFollower.seq;
    setCustomCursorHidden(true);

    var img = new Image();
    img.onload = function () {
      if (loadSeq !== customCursorFollower.seq) return;
      var nw = img.naturalWidth || 1;
      var nh = img.naturalHeight || 1;
      var scale = Math.min(CUSTOM_CURSOR_DISPLAY_MAX / nw, CUSTOM_CURSOR_DISPLAY_MAX / nh, 1);
      var dw = Math.max(8, Math.round(nw * scale));
      var dh = Math.max(8, Math.round(nh * scale));

      var el = document.createElement('img');
      el.id = 'site-custom-cursor';
      el.src = imageUrl;
      el.alt = '';
      el.draggable = false;
      el.style.width = dw + 'px';
      el.style.height = dh + 'px';
      document.body.appendChild(el);
      customCursorFollower.el = el;

      var onMove = function (e) {
        if (!customCursorFollower.el) return;
        customCursorFollower.el.style.transform =
          'translate3d(' + e.clientX + 'px,' + e.clientY + 'px,0)';
      };
      var onOut = function (e) {
        if (e.relatedTarget || !customCursorFollower.el) return;
        customCursorFollower.el.style.transform = 'translate3d(-9999px,-9999px,0)';
      };
      customCursorFollower.onMove = onMove;
      customCursorFollower.onOut = onOut;
      document.addEventListener('pointermove', onMove, true);
      document.documentElement.addEventListener('pointerleave', onOut);
    };
    img.onerror = function () {
      if (loadSeq !== customCursorFollower.seq) return;
      console.warn('[site-cursor] 自定义光标加载失败:', imageUrl);
      setCustomCursorHidden(false);
      customCursorFollower.key = '';
    };
    img.src = imageUrl;
  }

  function applyMouseAnimation(tokens) {
    var mode = tokens && tokens.mouseAnimation;
    document.body.classList.remove('hover-anim--up', 'hover-anim--slow-zoom', 'hover-anim--track-3d');
    if (mode === 'slow-zoom') {
      document.body.classList.add('hover-anim--slow-zoom');
      destroy3dTracking();
    } else if (mode === 'track-3d') {
      document.body.classList.add('hover-anim--track-3d');
      init3dTracking();
    } else {
      document.body.classList.add('hover-anim--up');
      destroy3dTracking();
    }
  }

  /* ========== 三维跟踪悬停 ========== */
  var track3dBound = false;
  var track3dActiveCards = [];

  function bindCard3dTracking(card) {
    function onMove(e) {
      var rect = card.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var dx = (e.clientX - cx) / (rect.width / 2);
      var dy = (e.clientY - cy) / (rect.height / 2);
      dx = Math.max(-1, Math.min(1, dx));
      dy = Math.max(-1, Math.min(1, dy));
      var rx = -dy * 2;
      var ry = dx * 2;
      card.style.transform = 'perspective(200px) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)';
    }

    function onLeave() {
      card.style.transform = '';
      document.removeEventListener('mousemove', onMove);
      card.removeEventListener('mouseleave', onLeave);
    }

    card.addEventListener('mouseenter', function () {
      document.addEventListener('mousemove', onMove);
      card.addEventListener('mouseleave', onLeave);
    });

    track3dActiveCards.push({ card: card, onMove: onMove, onLeave: onLeave });
  }

  function init3dTracking() {
    if (track3dBound) return;
    track3dBound = true;

    // 绑定已有的卡片
    document.querySelectorAll('.card:not(.depth-gallery-card)').forEach(bindCard3dTracking);

    // 监听未来新渲染的卡片（如切换tab）
    var observer = new MutationObserver(function () {
      if (!track3dBound) {
        observer.disconnect();
        return;
      }
      document.querySelectorAll('.card:not(.depth-gallery-card)').forEach(function (c) {
        if (!track3dActiveCards.some(function (t) { return t.card === c; })) {
          bindCard3dTracking(c);
        }
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    track3dHandlers = { observer: observer };
  }

  var track3dHandlers = null;
  function destroy3dTracking() {
    if (track3dHandlers && track3dHandlers.observer) {
      track3dHandlers.observer.disconnect();
    }
    track3dActiveCards.forEach(function (t) {
      document.removeEventListener('mousemove', t.onMove);
      t.card.removeEventListener('mouseenter', t.onMove);
      t.card.removeEventListener('mouseleave', t.onLeave);
      t.card.style.transform = '';
    });
    track3dActiveCards = [];
    track3dHandlers = null;
    track3dBound = false;
  }

  function applySiteCursor(tokens) {
    var styleEl = document.getElementById('site-cursor-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'site-cursor-style';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = '';

    var cursor = tokens && tokens.siteCursor;
    if (!cursor || cursor === 'default') {
      setCustomCursorHidden(false);
      destroyCustomCursorFollower();
      return;
    }

    var esc = function (u) {
      return String(u).replace(/"/g, '\\"');
    };
    var selector = 'html, html *, html *::before, html *::after';
    var applyRule = function (cssValue) {
      styleEl.textContent = selector + ' { cursor: ' + cssValue + ' !important; }';
    };

    if (cursor === 'custom') {
      var customUrl = resolveCustomCursorUrl(tokens.customCursorImage);
      if (!customUrl) {
        setCustomCursorHidden(false);
        destroyCustomCursorFollower();
        return;
      }
      if (isPreviewEmbed) {
        destroyCustomCursorFollower();
        setCustomCursorHidden(true);
        return;
      }
      startCustomCursorFollower(customUrl, getCustomCursorCacheKey(tokens));
      return;
    }

    destroyCustomCursorFollower();
    setCustomCursorHidden(false);

    if (cursor === 'cat-wink') {
      var url1x = '/assets/cursors/cat-wink.png';
      var urlHd = '/assets/cursors/cat-wink-hd.png';
      if (typeof window.resolveSiteAssetUrl === 'function') {
        url1x = window.resolveSiteAssetUrl(url1x);
        urlHd = window.resolveSiteAssetUrl(urlHd);
      }
      var cfg = CAT_WINK_CURSOR;
      var canResize = cursorSizeSyntaxSupported();
      var applyWithHd = function () {
        applyRule(
          'url("' +
            esc(urlHd) +
            '") ' +
            cfg.hotHdX +
            ' ' +
            cfg.hotHdY +
            ' / ' +
            cfg.logicalW +
            ' ' +
            cfg.logicalH +
            ', none',
        );
      };
      var applyWith1x = function () {
        applyRule(
          'url("' +
            esc(url1x) +
            '") ' +
            cfg.hot1xX +
            ' ' +
            cfg.hot1xY +
            ', none',
        );
      };
      applyWith1x();
      var img = new Image();
      img.onload = function () {
        if (canResize) applyWithHd();
      };
      img.onerror = function () {
        if (canResize) {
          var fallback = new Image();
          fallback.onload = applyWith1x;
          fallback.onerror = function () {
            console.warn('[site-cursor] 光标图片加载失败');
            styleEl.textContent = '';
          };
          fallback.src = url1x;
          return;
        }
        console.warn('[site-cursor] 光标图片加载失败:', url1x);
        styleEl.textContent = '';
      };
      img.src = canResize ? urlHd : url1x;
    }
  }

  function getWorksLayout(tokens) {
    var layout = tokens && tokens.worksLayout;
    if (layout === 'regular-grid') return 'regular-grid';
    if (layout === 'horizontal-gallery') return 'horizontal-gallery';
    if (layout === '3d-depth-gallery') return '3d-depth-gallery';
    return 'memory-stickers';
  }

  var horizontalGalleryEngines = new WeakMap();

  function destroyHorizontalGallery(grid) {
    var engine = horizontalGalleryEngines.get(grid);
    if (!engine) return;
    engine.destroy();
    horizontalGalleryEngines.delete(grid);
  }

  function syncHorizontalGalleryWrapClass(grid, layout) {
    var wrap = grid.closest('.grid-wrap');
    if (wrap) {
      wrap.classList.toggle('grid-wrap--horizontal-gallery', layout === 'horizontal-gallery');
      wrap.classList.toggle('grid-wrap--3d-depth-gallery', layout === '3d-depth-gallery');
      if (layout === '3d-depth-gallery') {
        wrap.style.overflow = 'visible';
        wrap.style.paddingTop = '0';
      }
    }
    var section = grid.closest('#works');
    if (section && layout === '3d-depth-gallery') {
      section.style.overflow = 'visible';
    }
  }

  function distributeWorksToGalleryRows(works, rowCount, minPerRow) {
    var rows = [];
    var i;
    for (i = 0; i < rowCount; i++) rows.push([]);
    if (!works.length) return rows;

    var expanded = [];
    while (expanded.length < minPerRow * rowCount) {
      for (i = 0; i < works.length; i++) {
        expanded.push({ work: works[i], workIndex: i });
        if (expanded.length >= minPerRow * rowCount) break;
      }
    }
    expanded.forEach(function (item, idx) {
      rows[Math.floor(idx / minPerRow)].push(item);
    });
    return rows;
  }

  function buildHorizontalGalleryMatrix(rows, cardStyle, clone) {
    var matrix = document.createElement('div');
    matrix.className = 'horizontal-gallery-matrix';
    if (clone) matrix.setAttribute('aria-hidden', 'true');
    rows.forEach(function (rowItems) {
      var row = document.createElement('div');
      row.className = 'horizontal-gallery-row';
      rowItems.forEach(function (item) {
        var card = createWorkCard(item.work, cardStyle, item.workIndex);
        row.appendChild(card);
      });
      matrix.appendChild(row);
    });
    return matrix;
  }

  function startHorizontalGallery(grid, viewport) {
    var prev = horizontalGalleryEngines.get(grid);
    if (prev) {
      prev.destroy();
      horizontalGalleryEngines.delete(grid);
    }
    var track = viewport.querySelector('.horizontal-gallery-track');
    if (!track) return;
    var matrix = track.querySelector('.horizontal-gallery-matrix');
    if (!matrix) return;

    var currentVx = 0;
    var offset = 0;
    var loopWidth = 0;
    var rafId = 0;
    var lastTs = 0;

    var paused = false;

    function onCardEnter(e) {
      if (e.target.closest('.card')) {
        paused = true;
      }
    }

    function onCardLeave(e) {
      if (e.target.closest('.card')) {
        paused = false;
      }
    }

    var SPEED = 10;
    var RECOVER_SMOOTH = 10;

    function measureLoopWidth() {
      loopWidth = matrix.offsetWidth || 0;
      if (loopWidth > 0 && offset <= -loopWidth) offset += loopWidth;
      if (loopWidth > 0 && offset > 0) offset -= loopWidth;
    }

    function onPointerLeave() {
      paused = false;
    }

    function tick(ts) {
      if (!lastTs) lastTs = ts;
      var dt = Math.min(MAX_FRAME_DELTA_SEC, (ts - lastTs) / 1000);
      lastTs = ts;

        if (!paused) {
          var recoverBlend = 1 - Math.exp(-RECOVER_SMOOTH * dt);
          currentVx += (-SPEED - currentVx) * recoverBlend;
          offset += currentVx * dt;
        if (loopWidth > 0) {
          while (offset <= -loopWidth) offset += loopWidth;
          while (offset > 0) offset -= loopWidth;
        }
      }

      track.style.transform = 'translate3d(' + offset + 'px,0,0)';
      rafId = window.requestAnimationFrame(tick);
    }

    function onResize() {
      measureLoopWidth();
    }

    currentVx = -SPEED;
    measureLoopWidth();
    viewport.addEventListener('pointerleave', onPointerLeave);
    track.addEventListener('pointerover', onCardEnter);
    track.addEventListener('pointerout', onCardLeave);
    window.addEventListener('resize', onResize);
    rafId = window.requestAnimationFrame(tick);

    var engine = {
      destroy: function () {
        window.cancelAnimationFrame(rafId);
        viewport.removeEventListener('pointerleave', onPointerLeave);
        track.removeEventListener('pointerover', onCardEnter);
        track.removeEventListener('pointerout', onCardLeave);
        window.removeEventListener('resize', onResize);
        track.style.transform = '';
      },
    };
    horizontalGalleryEngines.set(grid, engine);
  }

  function getHorizontalGalleryRowWidth(grid) {
    var framework = document.body.getAttribute('data-framework');
    if (framework === 'B') {
      var content = grid.closest('.content') || document.querySelector('.content');
      if (content && content.clientWidth > 0) return content.clientWidth;
    }
    if (framework === 'A') {
      if (window.innerWidth <= 860) {
        var contentA = grid.closest('.content') || document.querySelector('.content');
        if (contentA && contentA.clientWidth > 0) return contentA.clientWidth;
      }
      return window.innerWidth;
    }
    var wrap = grid.closest('.grid-wrap');
    if (wrap && wrap.clientWidth > 0) return wrap.clientWidth;
    return window.innerWidth;
  }

  function renderHorizontalGallery(grid, works, cardStyle) {
    destroyHorizontalGallery(grid);
    grid.innerHTML = '';

    var cellW = DEFAULT_CELL_WIDTH;
    var gap = DEFAULT_GAP;
    try {
      var computed = window.getComputedStyle(grid);
      var parsed = parseFloat(computed.getPropertyValue('--hg-cell-w'));
      if (!isNaN(parsed) && parsed > 0) cellW = parsed;
      var gapParsed = parseFloat(computed.getPropertyValue('--hg-gap'));
      if (!isNaN(gapParsed) && gapParsed > 0) gap = gapParsed;
    } catch (e) {
      /* keep defaults */
    }
    var rowWidth = getHorizontalGalleryRowWidth(grid);
    var minPerRow = Math.max(4, Math.ceil(rowWidth / (cellW + gap)) + 2);
    var rows = distributeWorksToGalleryRows(works, 3, minPerRow);

    var viewport = document.createElement('div');
    viewport.className = 'horizontal-gallery-viewport';
    var track = document.createElement('div');
    track.className = 'horizontal-gallery-track';
    track.appendChild(buildHorizontalGalleryMatrix(rows, cardStyle, false));
    track.appendChild(buildHorizontalGalleryMatrix(rows, cardStyle, true));
    viewport.appendChild(track);
    grid.appendChild(viewport);

    requestAnimationFrame(function () {
      startHorizontalGallery(grid, viewport);
    });
  }

  /* ========== 3D 景深画廊 ========== */
  var depthGalleryEngines = new WeakMap();

  function destroy3dDepthGallery(grid) {
    var engine = depthGalleryEngines.get(grid);
    if (!engine) return;
    engine.destroy();
    depthGalleryEngines.delete(grid);
  }

  /**
   * 3D 景深画廊渲染
   * 始终保持页面上 5 张卡片，中间卡片始终正面朝前。
   * 左右各两张卡片随距离中心产生 rotateY / scale / blur 变化。
   */
  function render3dDepthGallery(grid, works, cardStyle) {
    destroy3dDepthGallery(grid);
    grid.innerHTML = '';

    // 固定生成足够多的卡片，保证 7 张可见 + 循环缓冲
    var sources = [];
    var workLen = works && works.length ? works.length : 1;
    for (var i = 0; i < 21; i++) {
      if (works && works.length) {
        sources.push(works[i % works.length]);
      } else {
        sources.push({ image: '', title: '' });
      }
    }

    var stage = document.createElement('div');
    stage.className = 'depth-gallery-stage';
    var track = document.createElement('div');
    track.className = 'depth-gallery-track';
    stage.appendChild(track);
    grid.appendChild(stage);

    // 通知父窗口当前是 3D 画廊模式
    try {
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'artist-preview-3d-gallery', active: true }, '*');
      }
    } catch (e) {}

    var isPolaroid = cardStyle === 'polaroid';
    var cards = [];
    sources.forEach(function (work, idx) {
      var card = document.createElement('div');
      var usePlaceholder = !hasSlug && isDemoWorkPlaceholder(work.image);
      var workSrc = !usePlaceholder && typeof window.resolveSiteAssetUrl === 'function'
        ? window.resolveSiteAssetUrl(work.image)
        : (work.image || '');

      if (isPolaroid) {
        card.className = 'depth-gallery-card depth-gallery-card--polaroid';
        card.setAttribute('data-work-index', String(idx % works.length));
        var imgBlock = usePlaceholder
          ? '<div class="card-img card-img--placeholder"></div>'
          : '<div class="card-img"><img src="' + workSrc + '" alt="' + (work.title || '') + '"></div>';
        card.innerHTML = imgBlock + '<div class="card-footer"><p class="card-title">' + (work.title || '') + '</p></div>';
        // 让内部图片可拖拽
        var innerImg = card.querySelector('img');
        if (innerImg) innerImg.draggable = false;
      } else {
        card.className = 'depth-gallery-card';
        card.setAttribute('data-work-index', String(idx % works.length));
        var img = document.createElement('img');
        img.src = workSrc;
        img.alt = work.title || '';
        img.draggable = false;
        card.appendChild(img);
      }
      track.appendChild(card);
      cards.push(card);
    });

    var depthScale = document.body.getAttribute('data-framework') === 'B' ? 0.8 : 1;
    var vw = window.innerWidth;
    var isMobileView = vw <= 860;
    var config = {
      maxAngle: 80,
      maxBlur: 1,
      gap: isMobileView ? 0 : 24 * depthScale,
      cardWidth: isMobileView ? Math.round(vw * 0.34) : 220 * depthScale,
      step: isMobileView ? Math.round(vw * 0.44) : 240 * depthScale,
      visibleRange: 4,
    };
    var touchSensitivity = config.step; // 一次划动一整张卡片距离 = 切1张

    var current = 0;
    var target = 0;
    var rafId = 0;
    var isAnimating = false;
    var isDragging = false;

    // 缩放：桌面端中间 1.5，移动端中间 1.2（避免中心卡片过大遮挡两侧）
    function scaleByOffset(absOffset) {
      if (isMobileView) return Math.max(0.8, 1.2 - absOffset * 0.08);
      return Math.max(0.7, 1.5 - absOffset * 0.08);
    }

    function layout() {
      var count = cards.length;
      var half = count / 2;
      var isDark = document.documentElement.dataset.theme === 'dark';
      var minBrightness = isDark ? 0.55 : 0.9;
      var brightnessRange = isDark ? 0.45 : 0.2;

      cards.forEach(function (card, idx) {
        var rawOffset = idx - current;
        var offset = rawOffset;
        while (offset > half) offset -= count;
        while (offset < -half) offset += count;

        var absOffset = Math.abs(offset);

        // 等距布局
        var translateX = offset * config.step;

        // 旋转：Y轴朝里翻转（负值让右侧卡片朝里，正值让左侧卡片朝里）
        var rotateY = offset > 0
          ? -Math.min(90, absOffset / config.visibleRange * config.maxAngle)
          : Math.min(90, absOffset / config.visibleRange * config.maxAngle);

        // 缩放：中间 1.5，两侧缩小 10%，随接近中心渐变恢复
        var baseScale = scaleByOffset(absOffset);
        // sideFactor: 0.9 在边缘(absOffset>=1) → 1.0 在中心(absOffset=0)，线性渐变
        var sideFactor = 1 - 0.1 * Math.min(1, absOffset);
        var scale = baseScale * sideFactor;

        // 景深：模糊连续变化，最两端两张额外增加 2px
        var blur = Math.min(config.maxBlur, absOffset * config.maxBlur / config.visibleRange);
        if (absOffset > config.visibleRange - 1) {
          blur += 2;
        }
        var translateZ = -Math.pow(absOffset / config.visibleRange, 2) * 200;

        // 所有卡片保持 100% 不透明，远近通过缩放、模糊和明度区分
        var opacity = 1;
        var brightness = Math.max(minBrightness, 1 - (absOffset / config.visibleRange) * brightnessRange);

        var filterParts = [];
        if (blur > 0) filterParts.push('blur(' + blur + 'px)');
        if (brightness < 1) filterParts.push('brightness(' + brightness + ')');

        card.style.transform =
          'translateX(' + translateX + 'px) translateZ(' + translateZ + 'px) rotateY(' + rotateY + 'deg) scale(' + scale + ')';
        card.style.filter = filterParts.length ? filterParts.join(' ') : 'none';
        card.style.zIndex = Math.max(0, Math.round((1 - absOffset / config.visibleRange) * 100));
        card.style.opacity = opacity;
      });
    }

    function animate() {
      var diff = target - current;
      if (Math.abs(diff) < 0.0005) {
        current = target;
        layout();
        isAnimating = false;
        return;
      }
      // 缓入缓出曲线：远离目标时加速靠近，临近目标时自然减速
      var rawT = Math.min(1, Math.abs(diff) * 0.5);
      var eased = rawT < 0.5
        ? 2 * rawT * rawT
        : 1 - Math.pow(-2 * rawT + 2, 2) / 2;
      var step = 0.03 + eased * 0.22;
      current += diff * step;
      layout();
      rafId = requestAnimationFrame(animate);
    }

    function startAnimate() {
      if (isAnimating) return;
      isAnimating = true;
      rafId = requestAnimationFrame(animate);
    }

    var startX = 0;
    var startCurrent = 0;
    var autoScrollDir = 0; // -1 向左, 1 向右, 0 停止
    var autoScrollRafId = 0;
    var autoScrollRunning = false;
    var autoScrollAccum = 0; // 滚动累积量，攒满 ±1 才推一格

    function updateAutoScroll(e) {
      var rect = stage.getBoundingClientRect();
      var edgeW = rect.width * 0.40;
      var x = e.clientX - rect.left;
      if (x < edgeW) {
        autoScrollDir = -1;
      } else if (x > rect.width - edgeW) {
        autoScrollDir = 1;
      } else {
        autoScrollDir = 0;
      }
    }

    function autoScrollLoop() {
      if (!isDragging && autoScrollDir !== 0) {
        autoScrollAccum += autoScrollDir * 0.02;
        if (Math.abs(autoScrollAccum) >= 1) {
          target += autoScrollDir;
          autoScrollAccum = 0;
        }
        startAnimate();
      }
      if (autoScrollDir !== 0) {
        autoScrollRafId = requestAnimationFrame(autoScrollLoop);
      } else {
        autoScrollRunning = false;
        autoScrollAccum = 0;
        target = Math.round(target);
        startAnimate();
      }
    }

    function ensureAutoScroll() {
      if (!autoScrollRunning && autoScrollDir !== 0 && !isDragging) {
        autoScrollRunning = true;
        autoScrollRafId = requestAnimationFrame(autoScrollLoop);
      }
    }

    function onMouseDown(e) {
      isDragging = true;
      startX = e.clientX;
      startCurrent = Math.round(current);
    }

    function onMouseMove(e) {
      updateAutoScroll(e);

      if (isDragging) {
        var dx = e.clientX - startX;
        target = startCurrent - dx / DRAG_SENSITIVITY;
        // 拖动时实时吸附到最近整数槽位
        target = Math.round(target);
        startAnimate();
        return;
      }

      // 鼠标在 stage 内位置映射到整数槽位
      var rect = stage.getBoundingClientRect();
      var ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      target = Math.round((ratio - 0.5) * 2 * config.visibleRange);
      startAnimate();

      ensureAutoScroll();
    }

    function onMouseUp() {
      if (!isDragging) return;
      isDragging = false;
      autoScrollDir = 0;
      autoScrollRunning = false;
      // 吸附到最近整数槽位
      target = Math.round(target);
      startAnimate();
    }

    stage.addEventListener('mousedown', onMouseDown);
    stage.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    function onTouchStart(e) {
      if (e.touches.length !== 1) return;
      isDragging = true;
      startX = e.touches[0].clientX;
      startCurrent = Math.round(current);
    }
    function onTouchMove(e) {
      if (!isDragging) return;
      e.preventDefault();
      var dx = e.touches[0].clientX - startX;
      target = startCurrent - dx / touchSensitivity;
      startAnimate();
    }
    function onTouchEnd() {
      if (!isDragging) return;
      isDragging = false;
      autoScrollDir = 0;
      autoScrollRunning = false;
      target = Math.round(target);
      startAnimate();
    }
    stage.addEventListener('touchstart', onTouchStart, { passive: true });
    stage.addEventListener('touchmove', onTouchMove, { passive: false });
    stage.addEventListener('touchend', onTouchEnd);

    function onMouseLeave() {
      autoScrollDir = 0;
      autoScrollRunning = false;
    }
    stage.addEventListener('mouseleave', onMouseLeave);

    function onResize() {
      var vw2 = window.innerWidth;
      var mobile2 = vw2 <= 860;
      isMobileView = mobile2;
      if (mobile2) {
        config.cardWidth = Math.round(vw2 * 0.34);
        config.step = Math.round(vw2 * 0.44);
      } else {
        config.cardWidth = 220 * depthScale;
        config.step = 240 * depthScale;
      }
      touchSensitivity = config.step;
      layout();
    }
    window.addEventListener('resize', onResize);

    layout();

    depthGalleryEngines.set(grid, {
      destroy: function () {
        cancelAnimationFrame(rafId);
        cancelAnimationFrame(autoScrollRafId);
        autoScrollDir = 0;
        autoScrollRunning = false;
        stage.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        window.removeEventListener('resize', onResize);
        stage.removeEventListener('mousedown', onMouseDown);
        stage.removeEventListener('touchstart', onTouchStart);
        stage.removeEventListener('touchmove', onTouchMove);
        stage.removeEventListener('touchend', onTouchEnd);
        stage.removeEventListener('mouseleave', onMouseLeave);
      },
    });
  }

  function getCardStyle(tokens) {
    var style = tokens && tokens.cardStyle;
    return style === 'card' || style === 'rounded-card' ? 'card' : 'polaroid';
  }

  function isDemoWorkPlaceholder(image) {
    return !image || image === '__WORK_PLACEHOLDER__';
  }

  function createWorkCard(work, cardStyle, workIndex) {
    var usePlaceholder = !hasSlug && isDemoWorkPlaceholder(work.image);
    var workSrc =
      !usePlaceholder &&
      typeof window.resolveSiteAssetUrl === 'function'
        ? window.resolveSiteAssetUrl(work.image)
        : work.image;
    var card = document.createElement('div');
    card.className = 'card card--' + cardStyle;
    if (workIndex != null) card.setAttribute('data-work-index', String(workIndex));
    var imgBlock = usePlaceholder
      ? '<div class="card-img card-img--placeholder"></div>'
      : '<div class="card-img"><img src="' +
        workSrc +
        '" alt="' +
        work.title +
        '"></div>';
    if (cardStyle === 'card') {
      card.innerHTML =
        (usePlaceholder
          ? '<div class="card-img card-img--placeholder"><div class="card-overlay"><p class="card-title">' +
            work.title +
            '</p></div></div>'
          : '<div class="card-img"><img src="' +
            workSrc +
            '" alt="' +
            work.title +
            '"><div class="card-overlay"><p class="card-title">' +
            work.title +
            '</p></div></div>');
    } else {
      card.innerHTML =
        imgBlock +
        '<div class="card-footer"><p class="card-title">' +
        work.title +
        '</p></div>';
    }
    return card;
  }

  function applyWorksGridClasses(grid, tokens, workCount) {
    var layout = getWorksLayout(tokens);
    if (layout === 'memory-stickers' && workCount <= 1) layout = 'regular-grid';
    grid.classList.remove('grid--memory-stickers', 'grid--regular-grid', 'grid--horizontal-gallery', 'grid--3d-depth-gallery');
    if (layout === 'regular-grid') grid.classList.add('grid--regular-grid');
    else if (layout === 'horizontal-gallery') grid.classList.add('grid--horizontal-gallery');
    else if (layout === '3d-depth-gallery') grid.classList.add('grid--3d-depth-gallery');
    else grid.classList.add('grid--memory-stickers');
    grid.dataset.cardStyle = getCardStyle(tokens);
    syncHorizontalGalleryWrapClass(grid, layout);
  }

  var worksPreviewBridge = {
    activeWorkTab: 0,
    renderWorksGrids: null,
  };
  var previewTokensOverride = null;
  var previewBasicsOverride = null;
  var lastPreviewAvatarSrc = '';
  var previewBasicsPatchRaf = 0;
  var pendingPreviewBasics = null;
  var previewTokenPatchRaf = 0;
  var pendingPreviewTokens = null;
  var isPreviewEmbed = new URLSearchParams(window.location.search).has('_preview');
  var _refreshContactPreview = null;

  function patchPreviewBasicsDom(data) {
    if (!data) return;
    var siteName = data.siteName || (hasSlug ? '' : '创作者名称');
    document.querySelectorAll('[data-demo="site-name"]').forEach(function (el) {
      if (el.textContent !== siteName) el.textContent = siteName;
    });
    var tagline = data.tagline || '';
    document.querySelectorAll('[data-demo="tagline"]').forEach(function (el) {
      if (el.textContent !== tagline) el.textContent = tagline;
    });
    updatePageTitle(siteName);
    fitFrameworkBSiteNames();

    var avatarSrc =
      typeof window.resolveSiteAssetUrl === 'function'
        ? window.resolveSiteAssetUrl(data.avatarUrl)
        : data.avatarUrl;
    if (!avatarSrc || avatarSrc === lastPreviewAvatarSrc) return;
    lastPreviewAvatarSrc = avatarSrc;

    var isAvatarVideo = /\.(mp4|webm|mov)$/i.test(avatarSrc) || /video/.test(data.avatarUrl || '');
    var isAvatarGif = /\.gif$/i.test(avatarSrc);
    document.querySelectorAll('[data-demo="avatar"]').forEach(function (img) {
      var parent = img.parentNode;
      var existingVideo = parent && parent.querySelector('.avatar-video');
      if (existingVideo) existingVideo.remove();
      if (isAvatarVideo || isAvatarGif) {
        img.style.display = 'none';
        var video = document.createElement('video');
        video.className = 'avatar-video';
        video.src = avatarSrc;
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.style.cssText =
          'width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit;';
        if (parent) {
          parent.style.position = parent.style.position || 'relative';
          parent.appendChild(video);
        }
      } else {
        img.style.display = '';
        if (img.getAttribute('src') !== avatarSrc) img.src = avatarSrc;
        img.alt = siteName;
      }
    });

    // 联系方式变化：清空并重渲染联系模块，再刷新可见性
    var contactsChanged = data.contacts !== undefined;
    var socialsChanged = data.socials !== undefined;
    if (contactsChanged) {
      window.DEMO_SITE.contacts = data.contacts;
    }
    if (socialsChanged) {
      window.DEMO_SITE.socials = data.socials;
    }
    if ((contactsChanged || socialsChanged) && typeof _refreshContactPreview === 'function') {
      _refreshContactPreview();
    }
  }

  function mergePreviewBasics(basics) {
    if (!basics) return;
    pendingPreviewBasics = Object.assign({}, pendingPreviewBasics || {}, basics);
    if (previewBasicsPatchRaf) return;
    previewBasicsPatchRaf = requestAnimationFrame(function () {
      previewBasicsPatchRaf = 0;
      var patch = pendingPreviewBasics;
      pendingPreviewBasics = null;
      if (!patch) return;
      var prevJson = JSON.stringify(previewBasicsOverride);
      previewBasicsOverride = Object.assign({}, previewBasicsOverride || {}, patch);
      if (JSON.stringify(previewBasicsOverride) === prevJson) return;
      if (window.DEMO_SITE) Object.assign(window.DEMO_SITE, previewBasicsOverride);
      patchPreviewBasicsDom(Object.assign({}, window.DEMO_SITE, previewBasicsOverride));
    });
  }

  function mergePreviewTokens(tokens) {
    if (!tokens) return;
    pendingPreviewTokens = Object.assign({}, pendingPreviewTokens || {}, tokens);
    if (previewTokenPatchRaf) return;
    previewTokenPatchRaf = requestAnimationFrame(function () {
      previewTokenPatchRaf = 0;
      var patch = pendingPreviewTokens;
      pendingPreviewTokens = null;
      if (!patch) return;
      previewTokensOverride = Object.assign({}, previewTokensOverride || {}, patch);
      applySiteTokens(previewTokensOverride);
      if (window.DEMO_SITE) {
        window.DEMO_SITE.tokens = Object.assign({}, window.DEMO_SITE.tokens || {}, previewTokensOverride);
      }
      if (typeof worksPreviewBridge.renderWorksGrids === 'function') {
        worksPreviewBridge.renderWorksGrids(worksPreviewBridge.activeWorkTab);
      }
    });
  }

  function applyPreviewTokensToSiteData(data) {
    if (!data) return data;
    if (previewTokensOverride) {
      data.tokens = Object.assign({}, data.tokens || {}, previewTokensOverride);
      if (window.DEMO_SITE) window.DEMO_SITE.tokens = data.tokens;
    }
    if (data.tokens) applySiteTokens(data.tokens);
    return data;
  }

  function notifyPreviewReady() {
    if (!isPreviewEmbed || !window.parent || window.parent === window) return;
    window.parent.postMessage({ type: 'artist-preview-ready' }, '*');
  }

  function getFontFamily(fontLabel) {
    var map = {
      '思源黑体': '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
      '阿里巴巴普惠体': '"Alibaba PuHuiTi", "PingFang SC", "Microsoft YaHei", sans-serif',
      '站酷文艺体': '"ZCOOL WenYiTi", "站酷文艺体", "KaiTi", "STKaiti", serif',
      'VIVO体': '"VIVO体", "PingFang SC", "Microsoft YaHei", sans-serif',
      '卡洛古典英文': '"Carattere", "Georgia", "Times New Roman", serif',
      '猫啃珠圆体': '"MaokenZhuyuanTi", "PingFang SC", "Microsoft YaHei", sans-serif',
    };
    return map[fontLabel] || '';
  }

  /** 后台装扮预览 iframe：跨域滚轮 + 未保存 token 实时预览 + 鼠标位置转发（父页绘制光标） */
  if (isPreviewEmbed) {
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.overflowX = 'hidden';
    function forwardPreviewCursor(e) {
      if (!window.parent || window.parent === window) return;
      window.parent.postMessage(
        {
          type: 'artist-preview-cursor-move',
          x: e.clientX,
          y: e.clientY,
        },
        '*',
      );
    }
    document.addEventListener('pointermove', forwardPreviewCursor, true);
    window.addEventListener('message', function (e) {
      if (!e.data) return;
      if (e.data.type === 'artist-preview-scroll') {
        var deltaY = e.data.deltaY;
        if (typeof deltaY !== 'number') return;
        var root = document.documentElement;
        var body = document.body;
        var prev = root.scrollTop || body.scrollTop || window.scrollY || 0;
        var next = Math.max(0, prev + deltaY);
        root.scrollTop = next;
        if (body) body.scrollTop = next;
        window.scrollTo(0, next);
        window.dispatchEvent(new Event('scroll'));
        if (typeof window.__artistSyncNavScroll === 'function') {
          window.__artistSyncNavScroll();
        }
        return;
      }
      if (e.data.type === 'artist-preview-tokens') {
        mergePreviewTokens(e.data.tokens);
        return;
      }
      if (e.data.type === 'artist-preview-basics') {
        mergePreviewBasics(e.data.basics);
      }
    });
  }

  function isLocalDevHost() {
    var h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
  }

  /** 测试环境（localhost）真实站标签页用「真实A/B」与骨架 demo「框架A/B」区分；生产环境用创作者后台 siteName */
  function updatePageTitle(siteName) {
    if (isLocalDevHost()) {
      var layout = document.body.getAttribute('data-framework');
      var layoutKey = layout === 'B' ? 'B' : 'A';
      document.title = '真实' + layoutKey + ' · 插画接单';
    } else {
      document.title = (siteName || '插画接单') + ' · 插画接单';
    }
  }

  var FRAMEWORK_B_NAME_MAX_PX = 22;
  var FRAMEWORK_B_NAME_MIN_PX = 13;

  function frameworkBNameLineHeight(fontPx) {
    return fontPx * 1.3;
  }

  /** 框架 B 侧栏站名：最多两行，超出则逐级缩小字号 */
  function fitFrameworkBSiteNames() {
    if (document.body.getAttribute('data-framework') !== 'B') return;
    document.querySelectorAll('.sb-name[data-demo="site-name"]').forEach(function (el) {
      var size = FRAMEWORK_B_NAME_MAX_PX;
      var maxLines = 2;
      while (size >= FRAMEWORK_B_NAME_MIN_PX) {
        var lh = frameworkBNameLineHeight(size);
        el.style.fontSize = size + 'px';
        el.style.lineHeight = lh + 'px';
        el.style.maxHeight = lh * maxLines + 'px';
        if (el.scrollHeight <= lh * maxLines + 1) break;
        size -= 1;
      }
    });
  }

  function renderDemoSite() {
    var data = window.DEMO_SITE;
    if (!data) return;
    if (previewBasicsOverride) {
      data = Object.assign({}, data, previewBasicsOverride);
    }
    data = applyPreviewTokensToSiteData(data);
    if (window.SiteLocale && window.SiteLocale.localizeSiteData) {
      data = window.SiteLocale.localizeSiteData(data);
    }

    function setText(selector, text) {
      document.querySelectorAll(selector).forEach(function (el) {
        el.textContent = text;
      });
    }

    function setAttr(selector, attr, value) {
      document.querySelectorAll(selector).forEach(function (el) {
        el.setAttribute(attr, value);
      });
    }

    function setBlockVisibility(el, visible) {
      el.hidden = !visible;
      el.classList.toggle('site-block-off', !visible);
      if (visible) el.removeAttribute('aria-hidden');
      else el.setAttribute('aria-hidden', 'true');
    }

    function setBlockVisible(selector, visible) {
      document.querySelectorAll(selector).forEach(function (el) {
        setBlockVisibility(el, visible);
      });
    }

    function setHidden(selector, hidden) {
      setBlockVisible(selector, !hidden);
    }

    function collectTradeNavItems(siteData) {
      var items = [];
      var tradeChildren = (siteData.blocks && siteData.blocks.trade && siteData.blocks.trade.children) || {};
      if (tradeChildren.status !== false) {
        items.push({ href: '#terms-status', label: '接单状态' });
      }
      if (tradeChildren.terms !== false) {
        items.push({ href: '#terms-rules', label: '委托规则' });
      }
      (siteData.infoModules || []).forEach(function (mod) {
        if (mod.enabled === false) return;
        var label = mod.label && String(mod.label).trim();
        var body = mod.body && String(mod.body).trim();
        if (!label && !body) return;
        items.push({
          href: '#info-' + mod.id,
          label: label || '更多信息',
        });
      });
      return items;
    }

    function renderTradeNav(siteData) {
      var items = collectTradeNavItems(siteData);
      document.querySelectorAll('[data-demo="trade-nav"]').forEach(function (slot) {
        slot.innerHTML = '';
        items.forEach(function (item) {
          var a = document.createElement('a');
          a.href = item.href;
          a.textContent = t(item.label);
          slot.appendChild(a);
        });
      });
    }

    function applyModuleVisibility() {
      var worksBlock = data.blocks && data.blocks.works;
      var contactBlock = data.blocks && data.blocks.contact;
      var worksEnabled = !worksBlock || worksBlock.enabled !== false;
      var hasContacts = (Array.isArray(data.contacts) && data.contacts.some(function (c) { return c.label && c.label.trim() && c.value && c.value.trim(); }))
        || (Array.isArray(data.socials) && data.socials.some(function (s) { return s.label && s.label.trim() && s.href && s.href.trim(); }));
      var contactEnabled = (!contactBlock || contactBlock.enabled !== false) && hasContacts;
      var tradeBlock = (data.blocks && data.blocks.trade) || {};
      var tradeEnabled = tradeBlock.enabled !== false;
      var tradeChildren = tradeBlock.children || {};

      var worksSection = document.getElementById('works');
      var contactSection = document.getElementById('contact');
      var termsSection = document.getElementById('terms');
      if (worksSection) setBlockVisibility(worksSection, worksEnabled);
      if (contactSection) setBlockVisibility(contactSection, contactEnabled);
      if (termsSection) setBlockVisibility(termsSection, tradeEnabled);

      setBlockVisible('a[href="#works"]', worksEnabled);
      setBlockVisible('a[href="#contact"]', contactEnabled);
      setBlockVisible('[data-block="contact-sidebar"], .sb-contact', contactEnabled);
      document.querySelectorAll('[data-demo="trade-nav"] a').forEach(function (a) {
        setBlockVisibility(a, tradeEnabled);
      });
      var statusOff = tradeChildren.status === false;
      setHidden('.status-pill--hero, .sb-status--hero', statusOff);
      if (statusOff) {
        document.querySelectorAll('.hero-avatar-wrap, .sb-avatar-wrap').forEach(function (el) {
          el.classList.add('avatar-wrap--no-wait');
        });
      }

      document.querySelectorAll('[data-block="status"]').forEach(function (el) {
        setBlockVisibility(el, tradeChildren.status !== false);
      });
      document.querySelectorAll('[data-block="terms-rules"]').forEach(function (el) {
        setBlockVisibility(el, tradeChildren.terms !== false);
      });
      (data.infoModules || []).forEach(function (mod) {
        var el = document.getElementById('info-' + mod.id);
        if (el) setBlockVisibility(el, tradeEnabled && mod.enabled !== false);
      });

      // 最后一个可见模块的底部留白：当 #contact 隐藏时，给上方最后一个可见 .sec 补上间距
      var allSecs = document.querySelectorAll('.sec');
      for (var si = 0; si < allSecs.length; si++) {
        allSecs[si].classList.remove('sec--last-visible');
      }
      var lastVisibleSec = null;
      for (var sj = allSecs.length - 1; sj >= 0; sj--) {
        if (!allSecs[sj].classList.contains('site-block-off')) {
          lastVisibleSec = allSecs[sj];
          break;
        }
      }
      if (lastVisibleSec && lastVisibleSec.id !== 'contact') {
        lastVisibleSec.classList.add('sec--last-visible');
      }

      var tradeNavCount = tradeEnabled ? collectTradeNavItems(data).length : 0;
      var visibleNavCount =
        (worksEnabled ? 1 : 0) + tradeNavCount + (contactEnabled ? 1 : 0);
      var showSiteNav = visibleNavCount >= 2;
      setBlockVisible('#nav', showSiteNav);
      setBlockVisible('.sb-nav', showSiteNav);

      return { worksEnabled: worksEnabled, contactEnabled: contactEnabled, tradeEnabled: tradeEnabled };
    }

    // tokens 已在 applyPreviewTokensToSiteData 中 apply，此处不重复调用以免光标反复加载闪烁

    // 站点语言：固定文案 + 用户填写内容（无 CJK 原样，含中文则本地化）
    var siteLanguage = data.siteLanguage || 'zh';
    var i18nMap = {
      '作品': 'Works',
      '作品集': 'Portfolio',
      '简介': 'Intro',
      '联系': 'Contact',
      '接单状态': 'Status',
      '关于我的接单': 'About My Commissions',
      '委托规则': 'Terms & Rules',
      '联系方式': 'Contact Info',
      '想约稿？通过以下方式联系我': 'Want to commission? Reach me via',
      '可接单': 'Available',
      '暂不接单': 'Unavailable',
      '当前可接单约稿': 'Open for Commissions',
      '当前暂不接单': 'Not Accepting',
      '请持续关注我的动态': 'Stay tuned for updates',
      '下方有我的联系方式，可联系我具体沟通约稿哦~': 'My contact info is below — feel free to reach out about commissions',
      '需等': 'Wait ',
      '天': 'd',
      '根据当前排期需等': 'Current wait: ',
      '用户协议': 'Terms of Service',
      '隐私政策': 'Privacy Policy',
      '投诉举报': 'Report',
      '本站由创作者建站平台生成': 'Powered by Artist Brief',
      '微信': 'WeChat',
      '邮箱': 'Email',
      '微博': 'Weibo',
      '小红书': 'RED',
      '✓ 擅长 & 接受': '✓ Skills & Accept',
      '✕ 暂不接受': '✕ Not Accepting',
      '付款与流程': 'Payment & Process',
      '改稿与售后': 'Revisions & After-sales',
      '当前分类下无作品': 'No works in this category',
    };

    function t(text) {
      if (siteLanguage !== 'en') return text;
      // 精确匹配
      if (i18nMap.hasOwnProperty(text)) return i18nMap[text];
      // 匹配前缀（如 "需等14天" → "Wait 14d"）
      var keys = Object.keys(i18nMap).sort(function (a, b) { return b.length - a.length; });
      for (var k = 0; k < keys.length; k++) {
        if (text.indexOf(keys[k]) === 0) {
          var rest = text.slice(keys[k].length);
          if (rest) return i18nMap[keys[k]] + rest;
          return i18nMap[keys[k]];
        }
      }
      return text;
    }

    // 应用多语言到固定 section 标题
    setText('[data-demo="sec-head-works"]', t('作品集'));
    setText('[data-demo="sec-head-contact"]', t('联系'));
    setText('[data-demo="terms-sub-status"]', t('接单状态'));
    setText('[data-demo="terms-sub-rules"]', t('委托规则'));
    setText('[data-demo="contact-intro"]', t('想约稿？通过以下方式联系我'));
    setText('[data-demo="contact-sidebar-lbl"]', t('联系方式'));

    document.querySelectorAll('a[href="#about"]').forEach(function (el) {
      el.textContent = t('简介');
    });
    document.querySelectorAll('a[href="#works"]').forEach(function (el) {
      el.textContent = t('作品集');
    });
    document.querySelectorAll('a[href="#contact"]').forEach(function (el) {
      el.textContent = t('联系');
    });

    renderTradeNav(data);

    var siteName = data.siteName || (hasSlug ? '' : '创作者名称');
    var workTabs = Array.isArray(data.workTabs) && data.workTabs.length ? data.workTabs : ['全部'];
    var worksList = Array.isArray(data.works) ? data.works : [];
    setText('[data-demo="site-name"]', siteName);
    setText('[data-demo="tagline"]', data.tagline);
    fitFrameworkBSiteNames();
    var avatarSrc =
      typeof window.resolveSiteAssetUrl === 'function'
        ? window.resolveSiteAssetUrl(data.avatarUrl)
        : data.avatarUrl;
    var isAvatarVideo = /\.(mp4|webm|mov)$/i.test(avatarSrc) || /video/.test(data.avatarUrl || '');
    var isAvatarGif = /\.gif$/i.test(avatarSrc);
    document.querySelectorAll('[data-demo="avatar"]').forEach(function (img) {
      var parent = img.parentNode;
      // 移除旧的 video 元素
      var existingVideo = parent && parent.querySelector('.avatar-video');
      if (existingVideo) existingVideo.remove();
      if (isAvatarVideo || isAvatarGif) {
        img.style.display = 'none';
        var video = document.createElement('video');
        video.className = 'avatar-video';
        video.src = avatarSrc;
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit;';
        if (parent) {
          parent.style.position = parent.style.position || 'relative';
          parent.appendChild(video);
        }
      } else {
        img.style.display = '';
        if (avatarSrc) img.src = avatarSrc;
        img.alt = siteName;
      }
    });
    lastPreviewAvatarSrc = avatarSrc;

    var moduleVisibility = applyModuleVisibility();
    var worksEnabled = moduleVisibility.worksEnabled;
    var contactEnabled = moduleVisibility.contactEnabled;
    var tradeEnabled = moduleVisibility.tradeEnabled;

    var queueOpen = data.queueStatus === 'open';
    var statusLabel = queueOpen ? t('可接单') : t('暂不接单');

    function formatWaitLine(estWaitTime) {
      if (!estWaitTime) return '';
      var match = String(estWaitTime).match(/\d+/);
      return match ? t('需等') + ' ' + match[0] + ' ' + t('天') : String(estWaitTime);
    }

    function formatWaitCardDesc(estWaitTime) {
      if (!estWaitTime) return '';
      var match = String(estWaitTime).match(/\d+/);
      return match ? t('根据当前排期需等') + ' <span class="wait-number">' + match[0] + '</span> ' + t('天') : String(estWaitTime);
    }

    var showWait = tradeEnabled && queueOpen && data.showWaitTime && data.estWaitTime;
    var waitLine = showWait ? formatWaitLine(data.estWaitTime) : '';

    function getStatusCardContent() {
      if (!queueOpen) {
        return { title: t('当前暂不接单'), desc: t('请持续关注我的动态') };
      }
      if (showWait) {
        return {
          title: t('当前可接单约稿'),
          desc: formatWaitCardDesc(data.estWaitTime),
        };
      }
      return { title: t('当前可接单约稿'), desc: t('下方有我的联系方式，可联系我具体沟通约稿哦~') };
    }

    function renderStatusTag(el, label, wait) {
      el.classList.toggle('is-closed', !queueOpen);
      el.classList.toggle('has-wait', !!wait);
      el.style.display = '';
      var html = '<span class="status-tag__main"><span class="dot"></span>' + label;
      if (wait) {
        html +=
          '<span class="status-tag__sep" aria-hidden="true"></span>' +
          '<span class="status-tag__wait">' +
          wait +
          '</span>';
      }
      html += '</span>';
      el.innerHTML = html;
    }

    document.querySelectorAll('[data-demo="status"]').forEach(function (el) {
      renderStatusTag(el, statusLabel, waitLine);
    });
    document.querySelectorAll('[data-demo="status-detail"]').forEach(function (el) {
      var card = getStatusCardContent();
      el.className = 'status-card' + (queueOpen ? '' : ' is-closed');
      el.innerHTML =
        '<p class="status-card__title" data-demo="status-card-title">' +
        card.title +
        '</p><p class="status-card__desc" data-demo="status-card-desc">' +
        card.desc +
        '</p>';
    });

    document.querySelectorAll('.hero-avatar-wrap, .sb-avatar-wrap').forEach(function (el) {
      el.classList.toggle('avatar-wrap--no-wait', !waitLine);
    });

    if (data.disclaimer && !hasSlug) {
      document.querySelectorAll('[data-demo="terms-disclaimer"]').forEach(function (el) {
        el.textContent = data.disclaimer;
        el.hidden = false;
      });
    }

    function hasFilledContent(text) {
      return !!(text && String(text).trim());
    }

    function applyPairGridLayout(container, filledCount) {
      if (!container) return;
      container.classList.toggle('grid-pair', filledCount >= 2);
    }

    function filterWorksByTab(works, tabName) {
      var list = Array.isArray(works) ? works : [];
      if (!tabName || tabName === '全部' || tabName === 'All') return list;
      return list.filter(function (w) {
        return w.category === tabName;
      });
    }

    function pickFeaturedIndex(group, groupIndex) {
      return 0;
    }

    var MEMORY_SHEET_SIZE = 5;
    var MEMORY_GRID_COLS = 4;

    function chunkWorks(list, size) {
      var chunks = [];
      for (var i = 0; i < list.length; i += size) {
        chunks.push(list.slice(i, i + size));
      }
      return chunks;
    }

    /** 全列表连续网格：每组 5 张（1 大 + 4 小），大图左右交替 */
    function buildContinuousMemoryPlacements(works) {
      var cols = MEMORY_GRID_COLS;
      var occupied = {};
      var placements = [];

      function cellKey(r, c) {
        return r + ',' + c;
      }

      function canPlace(r, c, rowSpan, colSpan) {
        if (c + colSpan > cols) return false;
        for (var rr = r; rr < r + rowSpan; rr++) {
          for (var cc = c; cc < c + colSpan; cc++) {
            if (occupied[cellKey(rr, cc)]) return false;
          }
        }
        return true;
      }

      function markPlace(r, c, rowSpan, colSpan) {
        for (var rr = r; rr < r + rowSpan; rr++) {
          for (var cc = c; cc < c + colSpan; cc++) {
            occupied[cellKey(rr, cc)] = true;
          }
        }
      }

      function findNextSmallSlot() {
        for (var r = 0; r < 200; r++) {
          for (var c = 0; c < cols; c++) {
            if (canPlace(r, c, 1, 1)) return { r: r, c: c };
          }
        }
        return { r: 0, c: 0 };
      }

      function findFeaturedAnchor(preferredCol) {
        for (var r = 0; r < 200; r++) {
          if (canPlace(r, preferredCol, 2, 2)) return { r: r, c: preferredCol };
        }
        var fallbackCol = preferredCol === 0 ? 2 : 0;
        for (var r2 = 0; r2 < 200; r2++) {
          if (canPlace(r2, fallbackCol, 2, 2)) return { r: r2, c: fallbackCol };
        }
        return { r: 0, c: preferredCol };
      }

      function placeSmall(work, isFirstSmall) {
        var slot = findNextSmallSlot();
        markPlace(slot.r, slot.c, 1, 1);
        placements.push({
          work: work,
          row: slot.r + 1,
          col: slot.c + 1,
          rowSpan: 1,
          colSpan: 1,
          featured: false,
          isFirstSmall: !!isFirstSmall,
        });
      }

      function placeFeatured(work, groupIndex) {
        var preferredCol = groupIndex % 2 === 0 ? 0 : 2;
        var anchor = findFeaturedAnchor(preferredCol);
        markPlace(anchor.r, anchor.c, 2, 2);
        placements.push({
          work: work,
          row: anchor.r + 1,
          col: anchor.c + 1,
          rowSpan: 2,
          colSpan: 2,
          featured: true,
        });
      }

      chunkWorks(works, MEMORY_SHEET_SIZE).forEach(function (group, groupIndex) {
        var n = group.length;
        if (n <= 4) {
          group.forEach(function (work) {
            placeSmall(work);
          });
          return;
        }

        var featuredIndex = pickFeaturedIndex(group, groupIndex);
        var smallWorks = [];
        group.forEach(function (work, index) {
          if (index !== featuredIndex) smallWorks.push(work);
        });

        placeFeatured(group[featuredIndex], groupIndex);
        smallWorks.forEach(function (work, idx) {
          placeSmall(work, idx === 0);
        });
      });

      return placements;
    }

    function applyMemoryPlacement(card, placement) {
      if (placement.colSpan > 1) {
        card.style.gridColumn = placement.col + ' / span ' + placement.colSpan;
      } else {
        card.style.gridColumn = String(placement.col);
      }
      if (placement.rowSpan > 1) {
        card.style.gridRow = placement.row + ' / span ' + placement.rowSpan;
      } else {
        card.style.gridRow = String(placement.row);
      }
    }

    function renderMemoryStickersSheet(sheet, works, cardStyle) {
      var placements = buildContinuousMemoryPlacements(works);
      placements.forEach(function (placement) {
        var card = createWorkCard(placement.work, cardStyle);
        if (placement.featured) card.classList.add('card--featured');
        applyMemoryPlacement(card, placement);
        // 回忆墙：第一张小图顺时针旋转 2°，其余卡片随机轻微旋转 ±1.7°
        var deg;
        if (placement.isFirstSmall) {
          deg = '2';
        } else {
          var seed = placement.work.title ? placement.work.title.charCodeAt(placement.work.title.length - 1) : 0;
          deg = (((seed % 7) / 7) * 3.4 - 1.7).toFixed(1);
        }
        card.style.rotate = deg + 'deg';
        sheet.appendChild(card);
      });
    }

    function renderWorksGrids(activeTabIndex) {
      worksPreviewBridge.activeWorkTab = activeTabIndex;
      var tabName = workTabs[activeTabIndex] || '全部';
      var filtered = filterWorksByTab(worksList, tabName);
      var tokens = Object.assign({}, data.tokens || {}, previewTokensOverride || {});
      var layoutMode = getWorksLayout(tokens);
      var cardStyle = getCardStyle(tokens);
      document.querySelectorAll('[data-demo="works-grid"]').forEach(function (grid) {
        applyWorksGridClasses(grid, tokens, filtered.length);
        grid._workList = filtered;
        if (filtered.length === 0) {
          destroyHorizontalGallery(grid);
          destroy3dDepthGallery(grid);
          grid.innerHTML = '';
          var emptyMsg = document.createElement('div');
          emptyMsg.className = 'works-empty-msg';
          emptyMsg.textContent = t('当前分类下无作品');
          grid.appendChild(emptyMsg);
          return;
        }
        if (layoutMode === 'horizontal-gallery') {
          renderHorizontalGallery(grid, filtered, cardStyle);
          return;
        }
        if (layoutMode === '3d-depth-gallery') {
          render3dDepthGallery(grid, filtered, cardStyle);
          return;
        }
        destroyHorizontalGallery(grid);
        destroy3dDepthGallery(grid);
        grid.innerHTML = '';
        if (layoutMode === 'memory-stickers' && filtered.length > 1) {
          var sheet = document.createElement('div');
          sheet.className = 'memory-stickers-sheet';
          renderMemoryStickersSheet(sheet, filtered, cardStyle);
          grid.appendChild(sheet);
        } else {
          filtered.forEach(function (work) {
            grid.appendChild(createWorkCard(work, cardStyle));
          });
        }
      });
    }
    worksPreviewBridge.renderWorksGrids = renderWorksGrids;

    var activeWorkTab = 0;
    document.querySelectorAll('[data-demo="work-tabs"]').forEach(function (container) {
      if (workTabs.length === 1) {
        container.style.display = 'none';
        return;
      }
      container.style.removeProperty('display');
      container.innerHTML = '';
      workTabs.forEach(function (tab, i) {
        var span = document.createElement('span');
        span.className = 'tab' + (i === activeWorkTab ? ' active' : '');
        span.textContent = tab;
        span.addEventListener('click', function () {
          activeWorkTab = i;
          document.querySelectorAll('[data-demo="work-tabs"]').forEach(function (c) {
            c.querySelectorAll('.tab').forEach(function (x, xi) {
              x.classList.toggle('active', xi === i);
            });
          });
          renderWorksGrids(i);
        });
        container.appendChild(span);
      });
    });
    renderWorksGrids(activeWorkTab);
    notifyPreviewReady();

    document.querySelectorAll('[data-demo="terms"]').forEach(function (container) {
      container.innerHTML = '';
      var filledTerms = (data.terms || []).filter(function (term) {
        if (term.label === '需提供信息') return false;
        if (!(term.body && String(term.body).trim())) return false;
        return true;
      });
      filledTerms.forEach(function (term) {
        var wrap = document.createElement('div');
        wrap.className = 'term';
        wrap.innerHTML = '<h3>' + t(term.label) + '</h3><p>' + term.body + '</p>';
        container.appendChild(wrap);
      });
      applyPairGridLayout(container, filledTerms.length);
    });

    document.querySelectorAll('[data-demo="info-modules"]').forEach(function (root) {
      root.innerHTML = '';
      (data.infoModules || []).forEach(function (mod) {
        if (mod.enabled === false) return;
        var label = mod.label && String(mod.label).trim();
        var body = mod.body && String(mod.body).trim();
        if (!label && !body) return;
        var wrap = document.createElement('div');
        wrap.className = 'terms-sub';
        wrap.id = 'info-' + mod.id;
        wrap.setAttribute('data-block', 'info-module');
        var title = label || '';
        var bodyHtml = body || '';
        wrap.innerHTML =
          '<h3 class="site-block-title">' +
          t(title || '更多信息') +
          '</h3><div class="term terms-info-module-card"><p>' +
          bodyHtml +
          '</p></div>';
        root.appendChild(wrap);
      });
    });

    document.querySelectorAll('[data-demo="contact-methods-a"]').forEach(function (container) {
      container.innerHTML = '';
    });
    document.querySelectorAll('[data-demo="sidebar-contact-icons"]').forEach(function (container) {
      container.innerHTML = '';
    });
    document.querySelectorAll('[data-demo="socials"]').forEach(function (container) {
      container.innerHTML = '';
    });

    function findContactByIconKey(contacts, iconKey) {
      if (!window.SocialIcons || !window.SocialIcons.socialIconKey) return null;
      return (contacts || []).find(function (c) {
        if (!c.value || !String(c.value).trim()) return false;
        return window.SocialIcons.socialIconKey(c.label) === iconKey;
      });
    }

    function copyContactValue(text, evt) {
      if (evt) {
        evt.preventDefault();
        evt.stopPropagation();
      }
      var value = String(text || '').trim();
      if (!value) return;

      function showCopyToast() {
        var existing = document.querySelector('.site-copy-toast');
        if (existing) existing.remove();
        var toast = document.createElement('div');
        toast.className = 'site-copy-toast';
        toast.textContent = siteLanguage === 'en' ? 'Copied' : '复制成功';
        document.body.appendChild(toast);
        requestAnimationFrame(function () {
          toast.classList.add('is-visible');
        });
        setTimeout(function () {
          toast.classList.remove('is-visible');
          setTimeout(function () {
            toast.remove();
          }, TOAST_FADE_OUT_MS);
        }, TOAST_VISIBLE_MS);
      }

      function fallbackCopy() {
        var input = document.createElement('textarea');
        input.value = value;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.focus();
        input.select();
        input.setSelectionRange(0, value.length);
        var ok = false;
        try {
          ok = document.execCommand('copy');
        } catch (err) {
          ok = false;
        }
        document.body.removeChild(input);
        return ok;
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(value)
          .then(showCopyToast)
          .catch(function () {
            fallbackCopy();
            showCopyToast();
          });
      } else {
        fallbackCopy();
        showCopyToast();
      }
    }

    function customPlatformInitial(label) {
      var s = String(label || '').trim();
      if (!s) return '?';
      var ch = s.charAt(0);
      return /[a-zA-Z]/.test(ch) ? ch.toUpperCase() : ch;
    }

    function renderContactIconRow(container, options) {
      var renderSocialIcon =
        window.SocialIcons && window.SocialIcons.renderSocialIcon
          ? window.SocialIcons.renderSocialIcon
          : null;
      if (!renderSocialIcon) return;

      var sidebar = options && options.sidebar;
      var iconClass = sidebar ? 'sidebar-contact-icon' : 'contact-row-icon';
      if (!sidebar) container.classList.add('contact-methods--icons');
      container.innerHTML = '';

      function appendIconItem(el, labelText) {
        if (sidebar) {
          container.appendChild(el);
          return;
        }
        var wrap = document.createElement('div');
        wrap.className = 'contact-social-item';
        wrap.appendChild(el);
        var labelEl = document.createElement('span');
        labelEl.className = 'contact-social-label';
        labelEl.textContent = t(labelText);
        wrap.appendChild(labelEl);
        container.appendChild(wrap);
      }

      var contactKeys = [
        { iconKey: 'wechat', label: '微信' },
        { iconKey: 'email', label: '邮箱' },
      ];
      var socialLabels = ['微博', '小红书'];
      var builtinSocialLabelMap = { '微博': true, '小红书': true };

      function appendSocialLink(label, href, sidebar) {
        var link = document.createElement('a');
        link.className = iconClass + (sidebar ? ' sidebar-contact-icon--link' : '');
        link.title = label;
        link.setAttribute('aria-label', label);
        link.href = href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        var iconHtml = renderSocialIcon(label);
        if (iconHtml) {
          link.innerHTML = iconHtml;
        } else {
          link.classList.add('contact-icon--custom');
          var letter = document.createElement('span');
          letter.className = 'contact-custom-icon__letter';
          letter.textContent = customPlatformInitial(label);
          link.appendChild(letter);
        }
        appendIconItem(link, label);
      }

      function isLikelyUrl(value) {
        if (/^https?:\/\//i.test(value)) return true;
        if (/^www\./i.test(value)) return true;
        if (/\.[a-z]{2,6}(\/|$)/i.test(value)) return true;
        return false;
      }

      function normalizeUrl(value) {
        if (/^https?:\/\//i.test(value)) return value;
        if (/^www\./i.test(value)) return 'https://' + value;
        return 'https://' + value;
      }

      function appendSocialOrCopy(label, href, sidebar) {
        if (isLikelyUrl(href)) {
          appendSocialLink(label, normalizeUrl(href), sidebar);
          return;
        }
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = iconClass + (sidebar ? ' sidebar-contact-icon--copy' : '');
        btn.title = label + '：' + href;
        btn.setAttribute('aria-label', label + '：' + href);
        var iconHtml = renderSocialIcon(label);
        if (iconHtml) {
          btn.innerHTML = iconHtml;
        } else {
          btn.classList.add('contact-icon--custom');
          var letterEl = document.createElement('span');
          letterEl.className = 'contact-custom-icon__letter';
          letterEl.textContent = customPlatformInitial(label);
          btn.appendChild(letterEl);
        }
        btn.addEventListener('click', function (e) {
          copyContactValue(href, e);
        });
        appendIconItem(btn, label);
      }

      contactKeys.forEach(function (item) {
        var match = findContactByIconKey(data.contacts, item.iconKey);
        if (!match) return;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = iconClass + (sidebar ? ' sidebar-contact-icon--copy' : '');
        btn.title = item.label + '：' + match.value;
        btn.setAttribute('aria-label', item.label + '：' + match.value);
        btn.innerHTML = renderSocialIcon(item.label);
        btn.addEventListener('click', function (e) {
          copyContactValue(match.value, e);
        });
        appendIconItem(btn, item.label);
      });

      socialLabels.forEach(function (label) {
        var match = (data.socials || []).find(function (s) {
          return s.label === label;
        });
        if (!match) return;
        var href = String(match.href || '').trim();
        if (!href || href === '#') return;
        appendSocialLink(label, href, sidebar);
      });

      (data.socials || []).forEach(function (s) {
        var label = String(s.label || '').trim();
        var href = String(s.href || '').trim();
        if (!label || !href || href === '#') return;
        if (builtinSocialLabelMap[label]) return;
        appendSocialOrCopy(label, href, sidebar);
      });
    }

    if (contactEnabled) {
      document.querySelectorAll('[data-demo="contact-methods-a"]').forEach(function (container) {
        renderContactIconRow(container, { sidebar: false });
      });

      document.querySelectorAll('[data-demo="sidebar-contact-icons"]').forEach(function (container) {
        renderContactIconRow(container, { sidebar: true });
      });
    }

    applyModuleVisibility();
    _refreshContactPreview = function () {
      document.querySelectorAll('[data-demo="contact-methods-a"]').forEach(function (container) {
        container.innerHTML = '';
      });
      document.querySelectorAll('[data-demo="sidebar-contact-icons"]').forEach(function (container) {
        container.innerHTML = '';
      });
      // 重新判断是否有联系方式
      var hasContactsNow = (Array.isArray(window.DEMO_SITE.contacts) && window.DEMO_SITE.contacts.some(function (c) { return c.label && c.label.trim() && c.value && c.value.trim(); }))
        || (Array.isArray(window.DEMO_SITE.socials) && window.DEMO_SITE.socials.some(function (s) { return s.label && s.label.trim() && s.href && s.href.trim(); }));
      var contactBlockNow = window.DEMO_SITE.blocks && window.DEMO_SITE.blocks.contact;
      var contactEnabledNow = (!contactBlockNow || contactBlockNow.enabled !== false) && hasContactsNow;
      var contactSection = document.getElementById('contact');
      if (contactSection) {
        contactSection.classList.toggle('site-block-off', !contactEnabledNow);
      }
      setBlockVisible('a[href="#contact"]', contactEnabledNow);
      setBlockVisible('[data-block="contact-sidebar"], .sb-contact', contactEnabledNow);
      if (contactEnabledNow) {
        document.querySelectorAll('[data-demo="contact-methods-a"]').forEach(function (container) {
          renderContactIconRow(container, { sidebar: false });
        });
        document.querySelectorAll('[data-demo="sidebar-contact-icons"]').forEach(function (container) {
          renderContactIconRow(container, { sidebar: true });
        });
      }
      // 刷新最后模块底部间距
      var allSecs = document.querySelectorAll('.sec');
      for (var si = 0; si < allSecs.length; si++) {
        allSecs[si].classList.remove('sec--last-visible');
      }
      var lastVisibleSec = null;
      for (var sj = allSecs.length - 1; sj >= 0; sj--) {
        if (!allSecs[sj].classList.contains('site-block-off')) {
          lastVisibleSec = allSecs[sj];
          break;
        }
      }
      if (lastVisibleSec && lastVisibleSec.id !== 'contact') {
        lastVisibleSec.classList.add('sec--last-visible');
      }
    };
    updatePageTitle(siteName);
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    if (!window.location.hash) {
      window.scrollTo(0, 0);
    }
    document.dispatchEvent(new CustomEvent('site-render-complete'));
  }

  function finishRender() {
    try {
      renderDemoSite();
    } catch (err) {
      console.error('[demo-render] 渲染失败:', err);
    }
  }

  if (window.DEMO_SITE && window.DEMO_SITE.tokens) {
    applySiteTokens(window.DEMO_SITE.tokens);
    if (window.DEMO_SITE.tokens.backgroundImage) {
      var earlyBg = window.DEMO_SITE.tokens.backgroundImage;
      if (typeof window.resolveSiteAssetUrl === 'function') {
        earlyBg = window.resolveSiteAssetUrl(earlyBg);
      }
      var preloadImg = new Image();
      preloadImg.src = earlyBg;
    }
  }

  if (hasSlug) {
    // 页面加载动画：全屏白底居中三柱动画
    var loaderOverlay = document.createElement('div');
    loaderOverlay.id = 'site-page-loader';
    loaderOverlay.innerHTML =
      '<div style="display:flex;gap:2px">' +
      '<span></span><span></span><span></span>' +
      '</div>';
    document.body.appendChild(loaderOverlay);

    var loaderStyle = document.createElement('style');
    loaderStyle.textContent =
      '#site-page-loader{' +
      'position:fixed;inset:0;z-index:99999;' +
      'display:flex;align-items:center;justify-content:center;' +
      'background:#fff' +
      '}' +
      '#site-page-loader span{' +
      'display:block;width:8px;height:32px;border-radius:4px;' +
      'background:#666666;' +
      'animation:site-pillar 1.2s ease-in-out infinite' +
      '}' +
      '#site-page-loader span:nth-child(1){animation-delay:0s}' +
      '#site-page-loader span:nth-child(2){animation-delay:0.1s}' +
      '#site-page-loader span:nth-child(3){animation-delay:0.2s}' +
      '@keyframes site-pillar{' +
      '0%,100%{transform:scaleY(0.3);opacity:0.3}' +
      '50%{transform:scaleY(1);opacity:1}' +
      '}';
    document.head.appendChild(loaderStyle);

    function removeSiteLoader() {
      var el = document.getElementById('site-page-loader');
      if (el) el.remove();
    }
    document.documentElement.classList.add('awaiting-site-data');
    document.addEventListener('demo-site-ready', function () {
      document.documentElement.classList.remove('awaiting-site-data');
      removeSiteLoader();
      finishRender();
    });
  } else {
    finishRender();
  }

  document.addEventListener('demo-site-failed', function () {
    document.documentElement.classList.remove('awaiting-site-data');
    var el = document.getElementById('site-page-loader');
    if (el) el.remove();
  });

  // 移动端顶栏：滚动后出现毛玻璃
  var mobileBar = document.querySelector('.mobile-bar');
  if (mobileBar) {
    var mobileBarCheck = function () {
      var y = window.scrollY || document.documentElement.scrollTop || 0;
      mobileBar.classList.toggle('scrolled', y > 0);
    };
    window.addEventListener('scroll', mobileBarCheck, { passive: true });
    mobileBarCheck();
  }
})();
