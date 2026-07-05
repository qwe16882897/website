/** 访客站英文展示：固定UI标签由 demo-render.js 的 i18nMap 处理；用户填写内容原样展示 */
(function (global) {
  var CJK_RE = /[\u3400-\u9FFF\uF900-\uFAFF]/;

  function hasCjk(text) {
    return CJK_RE.test(String(text || ''));
  }

  /** 用户填写内容不做翻译，原样返回 */
  function localizeText(text) {
    return text;
  }

  /** 用户数据不再翻译，只透传。固定标签翻译由 demo-render.js 内置 i18nMap 负责 */
  function localizeSiteData(data) {
    return data;
  }

  global.SiteLocale = {
    hasCjk: hasCjk,
    localizeText: localizeText,
    localizeSiteData: localizeSiteData,
  };
})(typeof window !== 'undefined' ? window : globalThis);
