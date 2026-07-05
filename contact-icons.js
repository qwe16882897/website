/** 联系方式图标：微信 / 邮箱使用上传 PNG，其余保留 SVG */
(function (global) {
  var ICON_FILL = '#EEEEEE';
  var ICON_SIZE = 20;

  var PNG_ICONS = {
    wechat: 'assets/icons/wechat.png?v=2',
    email: 'assets/icons/email.png?v=2',
  };

  var escapeHtml = global.IconUtils.escapeHtml;
  var resolveIconSrc = global.IconUtils.resolveIconSrc;

  var SVG_ICONS = {
    qq:
      '<svg width="' +
      ICON_SIZE +
      '" height="' +
      ICON_SIZE +
      '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path fill="' +
      ICON_FILL +
      '" d="M12 2C6.48 2 2 5.58 2 10c0 2.4 1.37 4.52 3.47 5.77L4 22l5.8-2.9c.74.12 1.5.18 2.2.18 5.52 0 10-3.58 10-8s-4.48-8-10-8Zm-4.2 8.4a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm4.2 0a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm4.2 0a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Z"/>' +
      '</svg>',
  };

  function contactIconKey(label) {
    var key = String(label || '').trim().toLowerCase();
    if (key === '微信' || key === 'wechat') return 'wechat';
    if (key === 'qq') return 'qq';
    if (key === '邮箱' || key === 'email' || key === 'e-mail') return 'email';
    return '';
  }

  function renderContactIcon(label) {
    var iconKey = contactIconKey(label);
    if (!iconKey) {
      return '<span class="contact-label-text">' + escapeHtml(label) + '</span>';
    }
    if (PNG_ICONS[iconKey]) {
      return (
        '<span class="contact-icon contact-icon--png" aria-label="' +
        escapeHtml(label) +
        '"><img class="contact-icon-img" src="' +
        escapeHtml(resolveIconSrc(PNG_ICONS[iconKey])) +
        '" alt="" width="28" height="28" aria-hidden="true"></span>'
      );
    }
    return (
      '<span class="contact-icon" aria-label="' +
      escapeHtml(label) +
      '">' +
      (SVG_ICONS[iconKey] || '') +
      '</span>'
    );
  }

  global.ContactIcons = {
    renderContactIcon: renderContactIcon,
    escapeHtml: escapeHtml,
    contactIconKey: contactIconKey,
  };
})(typeof window !== 'undefined' ? window : globalThis);
