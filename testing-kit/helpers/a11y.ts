// Accessibility assertion helpers — quick checks without pulling in axe-core.
// For deep WCAG audits install @axe-core/react or @axe-core/playwright.

export interface A11yIssue {
  selector: string;
  rule: string;
  message: string;
}

/** Scan a container for the most common, easy-to-detect a11y problems. */
export function quickAxe(container: HTMLElement): A11yIssue[] {
  const issues: A11yIssue[] = [];

  // 1. Inputs without an accessible name
  container.querySelectorAll('input, select, textarea').forEach((el) => {
    const input = el as HTMLInputElement;
    if (input.type === 'hidden') return;
    const labelled =
      !!input.labels?.length ||
      input.getAttribute('aria-label') ||
      input.getAttribute('aria-labelledby') ||
      input.getAttribute('title');
    if (!labelled) {
      issues.push({
        selector: describeEl(input),
        rule: 'label-required',
        message: 'Input has no associated label, aria-label, or aria-labelledby',
      });
    }
  });

  // 2. Buttons / links without accessible text
  container.querySelectorAll('button, a').forEach((el) => {
    const txt = el.textContent?.trim() ?? '';
    const aria = el.getAttribute('aria-label');
    const title = el.getAttribute('title');
    if (!txt && !aria && !title) {
      issues.push({
        selector: describeEl(el),
        rule: 'name-required',
        message: 'Interactive element has no visible text or aria-label',
      });
    }
  });

  // 3. Images without alt
  container.querySelectorAll('img').forEach((el) => {
    if (el.getAttribute('alt') == null && el.getAttribute('role') !== 'presentation') {
      issues.push({
        selector: describeEl(el),
        rule: 'img-alt',
        message: 'Image is missing the alt attribute',
      });
    }
  });

  // 4. Headings: warn if none and there is a lot of text content
  if (!container.querySelector('h1, h2, h3, h4, h5, h6') && (container.textContent?.length ?? 0) > 200) {
    issues.push({
      selector: describeEl(container),
      rule: 'heading-required',
      message: 'Container has substantial text but no headings',
    });
  }

  // 5. Duplicate ids inside the container
  const ids = new Map<string, number>();
  container.querySelectorAll('[id]').forEach((el) => {
    const id = el.id;
    ids.set(id, (ids.get(id) ?? 0) + 1);
  });
  for (const [id, count] of ids) {
    if (count > 1) {
      issues.push({
        selector: `#${id}`,
        rule: 'unique-id',
        message: `Duplicate id "${id}" used ${count} times`,
      });
    }
  }

  return issues;
}

function describeEl(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `${tag}#${el.id}`;
  const cls = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean).slice(0, 2).join('.');
  return cls ? `${tag}.${cls}` : tag;
}
