import { describe, expect, it } from 'vitest';

import { normalizeLegacyNoticeHtml } from './legacy-notice-html';

function bodyOf(html: string): HTMLElement {
  return new DOMParser().parseFromString(html, 'text/html').body;
}

/**
 * 历史 Quill 公告归一化（SPEC-004 A-11 / E-11）。
 * `ql-*` → 内联样式，正文文本不改写，危险节点与属性被剥离。
 */
describe('legacy-notice-html', () => {
  it('ql-align-center/right/justify → 内联 text-align', () => {
    const center = bodyOf(
      normalizeLegacyNoticeHtml('<p class="ql-align-center">居中</p>'),
    ).firstElementChild as HTMLElement;
    const right = bodyOf(
      normalizeLegacyNoticeHtml('<p class="ql-align-right">右</p>'),
    ).firstElementChild as HTMLElement;
    const justify = bodyOf(
      normalizeLegacyNoticeHtml('<p class="ql-align-justify">两端</p>'),
    ).firstElementChild as HTMLElement;

    expect(center.style.textAlign).toBe('center');
    expect(right.style.textAlign).toBe('right');
    expect(justify.style.textAlign).toBe('justify');
    expect(center.className).not.toContain('ql-align-center');
  });

  it('ql-size-large/huge → 标题层级（Tiptap 可识别），small 保留内联字号', () => {
    const small = bodyOf(
      normalizeLegacyNoticeHtml('<span class="ql-size-small">小字</span>'),
    ).firstElementChild as HTMLElement;
    const large = bodyOf(
      normalizeLegacyNoticeHtml(
        '<p><span class="ql-size-large">大字</span></p>',
      ),
    ).firstElementChild as HTMLElement;
    const huge = bodyOf(
      normalizeLegacyNoticeHtml(
        '<p><span class="ql-size-huge">超大</span></p>',
      ),
    ).firstElementChild as HTMLElement;

    expect(small.style.fontSize).toBe('0.75em');
    expect(large.tagName).toBe('H3');
    expect(large.textContent).toBe('大字');
    expect(large.className).not.toContain('ql-size-large');
    expect(huge.tagName).toBe('H2');
    expect(huge.textContent).toBe('超大');
  });

  it('块内混排时保留原结构，字号退化为内联样式', () => {
    const paragraph = bodyOf(
      normalizeLegacyNoticeHtml(
        '<p>前<span class="ql-size-large">大</span>后</p>',
      ),
    ).firstElementChild as HTMLElement;

    expect(paragraph.tagName).toBe('P');
    expect(paragraph.textContent).toBe('前大后');
    expect((paragraph.querySelector('span') as HTMLElement).style.fontSize)
      .toBe('1.5em');
  });

  it('对齐与字号可同时作用于同一节点', () => {
    const heading = bodyOf(
      normalizeLegacyNoticeHtml(
        '<p class="ql-align-center"><span class="ql-size-large">组合</span></p>',
      ),
    ).firstElementChild as HTMLElement;

    expect(heading.tagName).toBe('H3');
    expect(heading.style.textAlign).toBe('center');
    expect(heading.textContent).toBe('组合');
  });

  it('已有内联样式不被覆盖，只补充缺失属性', () => {
    const paragraph = bodyOf(
      normalizeLegacyNoticeHtml(
        '<p class="ql-align-center" style="color: red">红字</p>',
      ),
    ).firstElementChild as HTMLElement;

    expect(paragraph.style.color).toBe('red');
    expect(paragraph.style.textAlign).toBe('center');
  });

  it('文本节点原样保留，不做实体或空白改写', () => {
    const output = normalizeLegacyNoticeHtml(
      '<p>第一段 &amp; 特殊字符</p><p>第二段</p>',
    );
    const body = bodyOf(output);

    expect(body.textContent).toBe('第一段 & 特殊字符第二段');
  });

  it('空值返回空串', () => {
    expect(normalizeLegacyNoticeHtml(null)).toBe('');
    expect(normalizeLegacyNoticeHtml(undefined)).toBe('');
    expect(normalizeLegacyNoticeHtml('')).toBe('');
  });

  it('剥离 script 与事件属性，不保留可执行内容', () => {
    const output = normalizeLegacyNoticeHtml(
      '<p onclick="alert(1)">安全</p><script>window.__notice_x = 1</script>',
    );

    expect(output).not.toContain('<script');
    expect(output).not.toContain('window.__notice_x');
    expect(output).not.toContain('onclick');
    expect(bodyOf(output).textContent).toBe('安全');
  });
});
