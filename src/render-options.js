export function shouldRenderRawHtml(preferences = {}) {
  return preferences.renderHtml !== false;
}

export function shouldUseFullWidthTables(preferences = {}) {
  return preferences.fullWidthTables !== false;
}

export function shouldWidenRenderedTable(scrollWidth = 0, clientWidth = 0) {
  return scrollWidth > clientWidth + 1;
}
