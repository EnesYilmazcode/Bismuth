import { createElement, forwardRef, ReactNode, SVGProps } from 'react';

// This is all from the Lucide codebase
const defaultAttributes = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'currentColor',
  stroke: 'none',
  strokeWidth: 0,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

type SVGAttributes = Partial<SVGProps<SVGSVGElement>>;

interface LucideProps extends SVGAttributes {
  size?: string | number;
}
const toKebabCase = (string: string) =>
  string.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

export const createLucideIcon = (iconName: string, iconNode: ReactNode) => {
  const Component = forwardRef<SVGSVGElement, LucideProps>(
    ({ color = 'currentColor', size = 24, strokeWidth = 0, ...rest }, ref) =>
      createElement(
        'svg',
        {
          ref,
          ...defaultAttributes,
          width: size,
          height: size,
          stroke: color,
          strokeWidth,
          className: `lucide lucide-${toKebabCase(iconName)}`,
          ...rest,
        },
        iconNode,
      ),
  );

  Component.displayName = `${iconName}`;

  return Component;
};
