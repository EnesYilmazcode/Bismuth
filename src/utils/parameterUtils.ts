import { Parameter } from '@shared/types';

/**
 * Calculates intuitive min and max values for a parameter based on its default value
 * Creates ranges like: 94mm -> 0-100, 2.7 -> 0-10, 0.5 -> 0-1
 * Range is fixed based on default value to prevent runaway expansion
 */
export function calculateParameterRange(param: Parameter): {
  min: number;
  max: number;
} {
  // If explicit range is provided, use it
  if (param.range?.min !== undefined && param.range?.max !== undefined) {
    return { min: param.range.min, max: param.range.max };
  }

  const defaultValue = Number(param.defaultValue);

  // Use only the default value for range calculation to prevent runaway expansion
  const referenceValue = Math.abs(defaultValue);

  // Handle zero or very small values
  if (referenceValue <= 0.001) {
    return { min: 0, max: 1 };
  }

  // Calculate the order of magnitude
  const magnitude = Math.floor(Math.log10(referenceValue));
  const normalizedValue = referenceValue / Math.pow(10, magnitude);

  let rangeMultiplier: number;

  // Determine appropriate range based on normalized value
  // Round up to next nice number: 1, 2, 5, or 10
  if (normalizedValue <= 1) {
    rangeMultiplier = 1;
  } else if (normalizedValue <= 2) {
    rangeMultiplier = 2;
  } else if (normalizedValue <= 5) {
    rangeMultiplier = 5;
  } else {
    rangeMultiplier = 10;
  }

  let maxValue = rangeMultiplier * Math.pow(10, magnitude);

  // Special handling for values that should round up to next nice range
  // e.g., 94 -> 100, 2.7 -> 10 (since 2.7 is closer to 10 than 5)
  if (referenceValue > maxValue * 0.5) {
    if (rangeMultiplier === 1) {
      rangeMultiplier = 2;
    } else if (rangeMultiplier === 2) {
      rangeMultiplier = 5;
    } else if (rangeMultiplier === 5) {
      rangeMultiplier = 10;
    } else {
      rangeMultiplier = 10;
      maxValue = Math.pow(10, magnitude + 1);
    }
    maxValue = rangeMultiplier * Math.pow(10, magnitude);
  }

  // Determine minimum value
  let minValue: number;
  if (param.range?.min !== undefined) {
    minValue = param.range.min;
  } else {
    // For negative default values, use symmetric range
    // For positive default values, start from 0
    if (defaultValue < 0) {
      minValue = -maxValue;
    } else {
      minValue = 0;
    }
  }

  return { min: minValue, max: maxValue };
}

/**
 * Calculates an appropriate step size for a parameter based on its range
 */
export function calculateParameterStep(param: Parameter): number {
  // If explicit step is provided, use it
  if (param.range?.step !== undefined) {
    return param.range.step;
  }

  const { min, max } = calculateParameterRange(param);
  const range = max - min;

  // Handle very small ranges
  if (range <= 0.001) {
    return 0.001;
  }

  // Calculate step as 1% of the range, rounded to a nice number
  const rawStep = range / 100;
  const magnitude = Math.floor(Math.log10(rawStep));
  const normalizedStep = rawStep / Math.pow(10, magnitude);

  let stepMultiplier: number;
  if (normalizedStep <= 1) {
    stepMultiplier = 1;
  } else if (normalizedStep <= 2) {
    stepMultiplier = 2;
  } else if (normalizedStep <= 5) {
    stepMultiplier = 5;
  } else {
    stepMultiplier = 10;
  }

  return stepMultiplier * Math.pow(10, magnitude);
}

/**
 * Determines if a parameter represents a measurement in millimeters
 */
export function isMeasurementParameter(param: Parameter): boolean {
  // Common measurement-related terms
  const measurementTerms = [
    'width',
    'height',
    'length',
    'depth',
    'thickness',
    'radius',
    'diameter',
    'distance',
    'size',
    'offset',
    'gap',
    'spacing',
    'margin',
    'padding',
    'inset',
    'extrude',
    'dimension',
  ];

  // Check if parameter name or displayName contains measurement terms
  const nameToCheck = param.name.toLowerCase();
  const displayNameToCheck = param.displayName.toLowerCase();

  // Only consider number type parameters
  if (param.type !== 'number' && param.type !== undefined) {
    return false;
  }

  // Check if the parameter name or display name contains any measurement terms
  return measurementTerms.some(
    (term) => nameToCheck.includes(term) || displayNameToCheck.includes(term),
  );
}

/**
 * Resolve any CSS color value (named or hex) to a #RRGGBB hex string, or
 * return '' when the input isn't a color. Used both to detect color-typed
 * string parameters and to normalize the value for the native/hex picker.
 *
 * Called once per ParameterInput render, so we memoize by input value and
 * reuse a module-level canvas rather than allocating one each time.
 *
 * Detection trick: canvas fillStyle silently keeps the previous value on
 * invalid input. We seed it with 'transparent' (normalizes to
 * 'rgba(0, 0, 0, 0)' — never a 6-char hex, so no collision with any real
 * color the user might declare) and check whether setting the user value
 * changed the normalized form. Opaque colors round-trip to #rrggbb;
 * rejected inputs leave the sentinel intact.
 */
const cssHexCache = new Map<string, string>();
let cssHexCtx: CanvasRenderingContext2D | null = null;
let cssHexSentinelNormalized: string | null = null;

export function cssToHex(value: string): string {
  if (typeof value !== 'string' || !value) return '';
  const cached = cssHexCache.get(value);
  if (cached !== undefined) return cached;

  if (typeof document === 'undefined') return '';
  if (!cssHexCtx) {
    cssHexCtx = document.createElement('canvas').getContext('2d');
    if (cssHexCtx) {
      cssHexCtx.fillStyle = 'transparent';
      cssHexSentinelNormalized = cssHexCtx.fillStyle;
    }
  }
  if (!cssHexCtx || cssHexSentinelNormalized === null) return '';

  cssHexCtx.fillStyle = cssHexSentinelNormalized;
  cssHexCtx.fillStyle = value;
  const normalized = cssHexCtx.fillStyle;
  let result = '';
  if (normalized !== cssHexSentinelNormalized) {
    if (/^#[0-9a-f]{6}$/i.test(normalized)) {
      result = normalized.toUpperCase();
    }
  }
  cssHexCache.set(value, result);
  return result;
}

/**
 * True when the parameter is a string whose value parses as a CSS color.
 * Used to route rendering to the ColorPicker UI and to group color params
 * together at the bottom of the parameter panel.
 */
export function isColorParameter(param: Parameter): boolean {
  if (param.type !== 'string') return false;
  return cssToHex(String(param.value ?? param.defaultValue ?? '')) !== '';
}

/**
 * Validates and sanitizes a parameter value
 */
export function validateParameterValue(
  param: Parameter,
  value: Parameter['value'],
): Parameter['value'] {
  if (param.type === 'number' || !param.type) {
    const numValue = Number(value);
    if (isNaN(numValue)) {
      return Number(param.defaultValue);
    }
    return numValue;
  }

  return value;
}

export function updateParameter(code: string, param: Parameter): string {
  const escapedName = escapeRegExp(param.name);
  const regex = new RegExp(
    `^\\s*(${escapedName}\\s*=\\s*)[^;]+;([\\t\\f\\cK ]*\\/\\/[^\n]*)?`,
    'm',
  );
  // Default to assuming the type is number
  if (!param.type) {
    return code.replace(regex, `$1${param.value};$2`);
  }
  switch (param.type) {
    case 'string':
      return code.replace(
        regex,
        `$1"${escapeReplacement(escapeQuotes(param.value as string))}";$2`,
      );
    case 'number':
      return code.replace(regex, `$1${param.value};$2`);
    case 'boolean':
      return code.replace(regex, `$1${param.value};$2`);
    case 'string[]':
      return code.replace(
        regex,
        `$1[${(param.value as string[])
          .map((value) => escapeReplacement(escapeQuotes(value)))
          .map((value) => `"${value}"`)
          .join(',')}];$2`,
      );
    case 'number[]':
      return code.replace(
        regex,
        `$1[${(param.value as number[]).join(',')}];$2`,
      );
    case 'boolean[]':
      return code.replace(
        regex,
        `$1[${(param.value as boolean[]).join(',')}];$2`,
      );
    default:
      return code;
  }
}

export function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export function escapeReplacement(string: string) {
  return string.replace(/\$/g, '$$$$');
}

export function escapeQuotes(string: string) {
  return string.replace(/"/g, '\\"');
}
