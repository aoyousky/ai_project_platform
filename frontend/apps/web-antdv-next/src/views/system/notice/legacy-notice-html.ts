/**
 * 历史 Quill 公告 HTML 归一化（SPEC-004 A-11 / E-11）。
 *
 * plus-ui 存量公告使用 Quill 的 `ql-align-*` / `ql-size-*` 类；Tiptap 只识别
 * 内联 `text-align` 与标题层级，默认未注册 FontSize 扩展。归一化规则：
 * - `ql-align-*` → 内联 `text-align`（Tiptap TextAlign 可解析段落样式）；
 * - `ql-size-large/huge` 且独占所在块 → `h3`/`h2`（plan.md §风险预案的标题层级等效）；
 * - 块内混排的 `ql-size-*` 退化为内联 `font-size`，保留原结构；
 * - 正文文本节点不改写；脚本节点、事件属性与 `javascript:` 链接被剥离。
 *
 * 输出只进入 Tiptap 编辑器，页面不渲染 `v-html`。
 */

const ALIGN_TO_TEXT: Record<string, string> = {
  'ql-align-center': 'center',
  'ql-align-justify': 'justify',
  'ql-align-right': 'right',
};

const SIZE_TO_HEADING: Record<string, 'h2' | 'h3'> = {
  'ql-size-huge': 'h2',
  'ql-size-large': 'h3',
};

const SIZE_TO_FONT: Record<string, string> = {
  'ql-size-huge': '2.5em',
  'ql-size-large': '1.5em',
  'ql-size-small': '0.75em',
};

const BLOCK_SELECTOR = 'p,li,div,h1,h2,h3,h4,h5,h6';
const DANGEROUS_SELECTOR =
  'script,style,iframe,object,embed,link,meta,form,input,button,select,textarea';

function removeDangerousContent(doc: Document): void {
  doc.body.querySelectorAll(DANGEROUS_SELECTOR).forEach((node) => {
    node.remove();
  });

  doc.body.querySelectorAll('*').forEach((element) => {
    for (const attr of element.attributes) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) {
        element.removeAttribute(attr.name);
        continue;
      }
      if (
        (name === 'href' || name === 'src' || name === 'xlink:href') &&
        attr.value.trim().toLowerCase().startsWith('javascript:')
      ) {
        element.removeAttribute(attr.name);
      }
    }
  });
}

function cleanupClass(element: Element): void {
  if (element.getAttribute('class') === '') {
    element.removeAttribute('class');
  }
}

function applyAlignClasses(element: HTMLElement): void {
  const classes = [...element.classList];
  let changed = false;
  for (const className of classes) {
    const align = ALIGN_TO_TEXT[className];
    if (!align) {
      continue;
    }
    changed = true;
    if (!element.style.textAlign) {
      element.style.textAlign = align;
    }
    element.classList.remove(className);
  }
  if (changed) {
    cleanupClass(element);
  }
}

function nearestBlock(element: HTMLElement): HTMLElement | null {
  if (element.matches(BLOCK_SELECTOR)) {
    return element;
  }
  return element.closest<HTMLElement>(BLOCK_SELECTOR);
}

/** 尺寸节点是否独占所在块（允许空白或零文本子节点） */
function isEntireBlock(block: HTMLElement, element: HTMLElement): boolean {
  if ((element.textContent ?? '').trim() !== (block.textContent ?? '').trim()) {
    return false;
  }
  for (const child of block.children) {
    if (child === element) {
      continue;
    }
    if (
      child.matches('img') ||
      (child.textContent ?? '').trim() !== ''
    ) {
      return false;
    }
  }
  return true;
}

function toHeading(
  doc: Document,
  block: HTMLElement,
  element: HTMLElement,
  tagName: 'h2' | 'h3',
): void {
  const heading = doc.createElement(tagName);
  const blockStyle = block.getAttribute('style');
  if (blockStyle) {
    heading.setAttribute('style', blockStyle);
  }
  if (!heading.style.textAlign && element.style.textAlign) {
    heading.style.textAlign = element.style.textAlign;
  }
  heading.innerHTML = element.innerHTML;
  block.replaceWith(heading);
}

function applySizeClasses(doc: Document, element: HTMLElement): void {
  const classes = [...element.classList];
  const headingClass = classes.find(
    (className) => className in SIZE_TO_HEADING,
  );
  const small = classes.includes('ql-size-small');

  classes
    .filter((className) => className in SIZE_TO_FONT)
    .forEach((className) => element.classList.remove(className));

  if (!headingClass && !small) {
    return;
  }

  if (headingClass) {
    const block = nearestBlock(element);
    if (block && isEntireBlock(block, element)) {
      toHeading(doc, block, element, SIZE_TO_HEADING[headingClass]!);
      return;
    }
    if (!element.style.fontSize) {
      element.style.fontSize = SIZE_TO_FONT[headingClass]!;
    }
  } else if (!element.style.fontSize) {
    element.style.fontSize = '0.75em';
  }

  cleanupClass(element);
}

/**
 * 归一化历史公告 HTML；空值返回空串。调用方只把结果交给 Tiptap。
 */
export function normalizeLegacyNoticeHtml(
  html: null | string = '',
): string {
  if (html === null || html.trim() === '') {
    return '';
  }
  const source = html;

  const doc = new DOMParser().parseFromString(
    `<div id="notice-root">${source}</div>`,
    'text/html',
  );
  const root = doc.querySelector('#notice-root');
  if (!root) {
    return '';
  }

  removeDangerousContent(doc);

  const elements = [...root.querySelectorAll<HTMLElement>('*')];
  for (const element of elements) {
    applyAlignClasses(element);
  }
  for (const element of elements) {
    applySizeClasses(doc, element);
  }

  return root.innerHTML;
}
