// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getSidebarMenuFilledIcon, getSidebarMenuIcon } from './SidebarMenuIcon';
import { ModuleNavigationButton } from './ModuleNavigation';

const svgFor = (label: string) => renderToStaticMarkup(<>{getSidebarMenuIcon(label)}</>);

describe('shared sidebar artwork', () => {
  it('keeps adjacent retail and finance actions visually distinct', () => {
    for (const labels of [
      ['Báo cáo', 'Tài chính', 'Ca POS', 'Ưu đãi và điểm', 'Mã ưu đãi'],
      ['Thu - Chi', 'VAT', 'Sổ quỹ & dòng tiền', 'Công nợ', 'Tuổi nợ', 'Nhắc nợ'],
    ]) {
      const icons = labels.map(svgFor);
      expect(icons.every((icon) => icon.startsWith('<svg'))).toBe(true);
      expect(new Set(icons).size).toBe(labels.length);
    }
  });

  it('uses the HR line style for other modules and handles padded menu labels', () => {
    const icon = svgFor('Hộp thư hội thoại ');
    expect(icon).toContain('stroke-width="1.65"');
    expect(icon).toContain('stroke-linecap="round"');
    expect(icon).toContain('aria-hidden="true"');
    expect(svgFor('Mục chưa có')).toBe('');
  });

  it('draws a custom icon for a menu label containing a live count', () => {
    const html = renderToStaticMarkup(<ModuleNavigationButton active={false}>Danh mục gói ({3})</ModuleNavigationButton>);
    expect(html).toContain('<svg');
    expect(html).toContain('title="Danh mục gói (3)"');
  });

  it('provides solid companions for student and other module sidebar icons', () => {
    for (const label of ['Học phí', 'Kho hàng', 'Tài sản', 'Dự án', 'Doanh nghiệp']) {
      const filled = renderToStaticMarkup(<>{getSidebarMenuFilledIcon(label)}</>);
      expect(filled).toContain('fill="currentColor"');
      expect(filled).toContain('aria-hidden="true"');
      expect(renderToStaticMarkup(<ModuleNavigationButton active={false}>{label}</ModuleNavigationButton>)).toContain('module-nav-filled');
    }
  });
});
