/** 作品大图查看器 — 行为对齐创作者后台 WorksPage ImageViewer */
(function () {
  var FALLBACK_CSS =
    '.work-viewer-overlay{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0);display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding-top:10vh;transition:background .2s ease}' +
    '.work-viewer-overlay--active{background:rgba(0,0,0,.85)}' +
    '.work-viewer-overlay--closing{background:rgba(0,0,0,0)}' +
    '.work-viewer-image-wrap{position:relative;max-width:90vw;max-height:75vh;display:flex;align-items:center;justify-content:center;opacity:0;transform:scale(.92);transition:opacity .2s ease,transform .25s cubic-bezier(.22,1,.36,1)}' +
    '.work-viewer-image-wrap--active{opacity:1;transform:scale(1)}' +
    '.work-viewer-image-wrap--closing{opacity:0;transform:scale(.92)}' +
    '.work-viewer-close{position:fixed;top:24px;right:24px;width:44px;height:44px;border:none;border-radius:50%;background:rgba(255,255,255,.15);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10001;padding:0}' +
    '.work-viewer-title{color:#fff;font-size:26px;font-weight:500;text-align:center;margin-top:20px;max-width:80vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:0;transition:opacity .2s ease}' +
    '.work-viewer-title--visible{opacity:1}' +
    '.work-viewer-nav{position:fixed;top:calc(10vh + 37.5vh);transform:translateY(-50%);width:48px;height:48px;border:none;border-radius:50%;background:rgba(255,255,255,.12);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10001;padding:0}' +
    '.work-viewer-nav--prev{left:24px}.work-viewer-nav--next{right:24px}' +
    '.work-viewer-image{display:block;max-width:85vw;max-height:75vh;object-fit:contain;border-radius:4px;box-shadow:0 4px 40px rgba(0,0,0,.4)}';

  function ensureViewerStyles() {
    if (document.getElementById('work-viewer-fallback-css')) return;
    var probe = document.createElement('div');
    probe.className = 'work-viewer-overlay';
    probe.hidden = true;
    document.documentElement.appendChild(probe);
    var loaded = getComputedStyle(probe).position === 'fixed';
    probe.remove();
    if (loaded) return;
    var style = document.createElement('style');
    style.id = 'work-viewer-fallback-css';
    style.textContent = FALLBACK_CSS;
    document.head.appendChild(style);
  }
  ensureViewerStyles();

  var overlay = null;
  var imageEl = null;
  var titleEl = null;
  var prevBtn = null;
  var nextBtn = null;
  var images = [];
  var currentIndex = 0;
  var visible = false;
  var closing = false;

  var ICON_CLOSE =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var ICON_PREV =
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M14 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_NEXT =
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M10 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function ensureDOM() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'work-viewer-overlay';
    overlay.hidden = true;
    overlay.innerHTML =
      '<button type="button" class="work-viewer-close" aria-label="关闭大图">' +
      ICON_CLOSE +
      '</button>' +
      '<button type="button" class="work-viewer-nav work-viewer-nav--prev" aria-label="上一张">' +
      ICON_PREV +
      '</button>' +
      '<button type="button" class="work-viewer-nav work-viewer-nav--next" aria-label="下一张">' +
      ICON_NEXT +
      '</button>' +
      '<div class="work-viewer-image-wrap">' +
      '<img class="work-viewer-image" alt="">' +
      '</div>' +
      '<div class="work-viewer-title"></div>';

    document.body.appendChild(overlay);

    imageEl = overlay.querySelector('.work-viewer-image');
    titleEl = overlay.querySelector('.work-viewer-title');
    prevBtn = overlay.querySelector('.work-viewer-nav--prev');
    nextBtn = overlay.querySelector('.work-viewer-nav--next');
    var wrap = overlay.querySelector('.work-viewer-image-wrap');

    overlay.querySelector('.work-viewer-close').addEventListener('click', close);
    overlay.addEventListener('click', close);
    wrap.addEventListener('click', function (e) {
      e.stopPropagation();
    });
    prevBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      goPrev();
    });
    nextBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      goNext();
    });
  }

  function render() {
    var item = images[currentIndex];
    if (!item || !imageEl) return;
    imageEl.src = item.image;
    imageEl.alt = item.title || '';
    if (titleEl) {
      titleEl.textContent = item.title || '';
    }
    var multi = images.length > 1;
    prevBtn.hidden = !multi;
    nextBtn.hidden = !multi;
  }

  function applyClasses() {
    overlay.classList.toggle('work-viewer-overlay--active', visible && !closing);
    overlay.classList.toggle('work-viewer-overlay--closing', closing);
    var wrap = overlay.querySelector('.work-viewer-image-wrap');
    wrap.classList.toggle('work-viewer-image-wrap--active', visible && !closing);
    wrap.classList.toggle('work-viewer-image-wrap--closing', closing);
    if (titleEl) {
      titleEl.classList.toggle('work-viewer-title--visible', visible && !closing);
    }
  }

  function onKeyDown(e) {
    if (overlay.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') goPrev();
    if (e.key === 'ArrowRight') goNext();
  }

  function open(list, index) {
    if (!list || !list.length) return;
    ensureDOM();
    images = list;
    currentIndex = Math.max(0, Math.min(index || 0, list.length - 1));
    closing = false;
    visible = false;
    overlay.hidden = false;
    render();
    applyClasses();
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    requestAnimationFrame(function () {
      visible = true;
      applyClasses();
    });
  }

  function close() {
    if (closing || overlay.hidden) return;
    closing = true;
    visible = false;
    applyClasses();
    setTimeout(function () {
      overlay.hidden = true;
      closing = false;
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeyDown);
      applyClasses();
    }, 250);
  }

  function goPrev() {
    if (images.length <= 1) return;
    currentIndex = (currentIndex - 1 + images.length) % images.length;
    render();
  }

  function goNext() {
    if (images.length <= 1) return;
    currentIndex = (currentIndex + 1) % images.length;
    render();
  }

  window.WorkImageViewer = { open: open, close: close };
})();