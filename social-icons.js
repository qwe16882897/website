/** 社交平台固定展示图标：微博 / 微信 / 邮箱 / 小红书（文件名与平台一一对应） */
(function (global) {
  var ICONS = {
    weibo: 'assets/icons/weibo.png?v=2',
    wechat: 'assets/icons/wechat.png?v=2',
    email: 'assets/icons/email.png?v=2',
    xiaohongshu: 'assets/icons/xiaohongshu.png?v=2',
  };

  var escapeHtml = global.IconUtils.escapeHtml;
  var resolveIconSrc = global.IconUtils.resolveIconSrc;

  function socialIconKey(label) {
    var key = String(label || '').trim().toLowerCase();
    if (key === '微博' || key === 'weibo') return 'weibo';
    if (key === '微信' || key === 'wechat') return 'wechat';
    if (key === '邮箱' || key === 'email' || key === 'e-mail') return 'email';
    if (key === '小红书' || key === 'xiaohongshu' || key === 'xhs') return 'xiaohongshu';
    return '';
  }

  function renderSocialIcon(label) {
    var iconKey = socialIconKey(label);
    if (!iconKey) return '';
    return (
      '<img class="social-icon-img" src="' +
      escapeHtml(resolveIconSrc(ICONS[iconKey])) +
      '" alt="" width="29" height="29" aria-hidden="true">'
    );
  }

  global.SocialIcons = {
    renderSocialIcon: renderSocialIcon,
    socialIconKey: socialIconKey,
    escapeHtml: escapeHtml,
  };
})(typeof window !== 'undefined' ? window : globalThis);
