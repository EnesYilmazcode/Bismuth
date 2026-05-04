import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';

import { cn } from '@/lib/utils';

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
    hideDefaultMarker?: boolean;
    variant?: 'default' | 'capsule';
    defaultMarkerStyle?: 'dot' | 'line';
  }
>(
  (
    {
      className,
      onValueChange,
      onValueCommit,
      value,
      min = 0,
      max = 100,
      step = 1,
      defaultValue,
      hideDefaultMarker = false,
      variant = 'default',
      defaultMarkerStyle = 'dot',
      ...props
    },
    ref,
  ) => {
    const [isDragging, setIsDragging] = React.useState(false);
    const [startX, setStartX] = React.useState(0);
    const [startValue, setStartValue] = React.useState(0);
    const [isAnimating, setIsAnimating] = React.useState(false);
    const trackRef = React.useRef<HTMLDivElement>(null);
    const lastValueRef = React.useRef<number>(
      Array.isArray(value) ? (value?.[0] ?? 0) : (value ?? 0),
    );
    const [isCoarsePointer, setIsCoarsePointer] = React.useState(false);
    const interactionIsCoarseRef = React.useRef<boolean>(false);
    const isPointerDownRef = React.useRef<boolean>(false);
    const [isPointerDown, setIsPointerDown] = React.useState(false);
    const [smoothAnimate, setSmoothAnimate] = React.useState(false);
    const smoothAnimateTimeoutRef = React.useRef<number | null>(null);
    const pointerDownXRef = React.useRef<number>(0);
    const DRAG_DETECTION_PX = 4;

    // Cache track rect to avoid layout thrashing
    const trackRectRef = React.useRef<DOMRect | null>(null);
    const rafIdRef = React.useRef<number | null>(null);

    const currentValue = Array.isArray(value) ? value[0] : value || 0;
    const defaultVal = Array.isArray(defaultValue)
      ? defaultValue[0]
      : defaultValue || 0;

    // Calculate default value position as percentage
    const defaultPosition = ((defaultVal - min) / (max - min)) * 100;

    // Trigger animation when value changes to default (likely from reset)
    const prevValueRef = React.useRef(currentValue);
    React.useEffect(() => {
      if (
        prevValueRef.current !== currentValue &&
        currentValue === defaultVal &&
        !isDragging
      ) {
        setIsAnimating(true);
        setTimeout(() => {
          setIsAnimating(false);
        }, 300);
      }
      prevValueRef.current = currentValue;
    }, [currentValue, defaultVal, isDragging]);

    // Cleanup effect to cancel any pending animation frames
    React.useEffect(() => {
      return () => {
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
        }
        if (smoothAnimateTimeoutRef.current) {
          clearTimeout(smoothAnimateTimeoutRef.current);
        }
      };
    }, []);

    const handlePointerDown = (event: React.PointerEvent) => {
      if (!trackRef.current) return;

      // Cache the track rect once at the start of interaction to avoid layout thrashing
      trackRectRef.current = trackRef.current.getBoundingClientRect();

      // Don't mark as dragging yet on desktop. On mobile (coarse), we do.
      setIsDragging(false);
      isPointerDownRef.current = true;
      setIsPointerDown(true);
      // Detect pointer context on first interaction if not yet detected
      let coarse = isCoarsePointer;
      if (typeof window !== 'undefined') {
        coarse = !!(
          window.matchMedia && window.matchMedia('(pointer: coarse)').matches
        );
        setIsCoarsePointer(coarse);
      }
      interactionIsCoarseRef.current = coarse;

      pointerDownXRef.current = event.clientX;

      if (coarse) {
        setIsDragging(true);
        // Mobile: relative drag behavior
        setStartX(event.clientX);
        setStartValue(currentValue);
      } else {
        // Desktop: jump to cursor position with smooth animation.
        // Arm a brief smooth animation window so the range animates the width change
        if (smoothAnimateTimeoutRef.current) {
          window.clearTimeout(smoothAnimateTimeoutRef.current);
          smoothAnimateTimeoutRef.current = null;
        }
        setSmoothAnimate(true);
        smoothAnimateTimeoutRef.current = window.setTimeout(() => {
          setSmoothAnimate(false);
          smoothAnimateTimeoutRef.current = null;
        }, 180);
        // Use rAF so the transition class applies before width changes.
        const clientX = event.clientX;
        const rect = trackRectRef.current;
        window.requestAnimationFrame(() => {
          if (!rect) return;
          const trackWidth = rect.width;
          const clampedX = Math.min(Math.max(clientX, rect.left), rect.right);
          const ratio =
            trackWidth > 0 ? (clampedX - rect.left) / trackWidth : 0;
          const valueRange = max - min;
          let newValue = min + ratio * valueRange;
          if (step > 0) {
            newValue = Math.round(newValue / step) * step;
          }
          const decimals =
            step >= 1 ? 0 : Math.max(0, -Math.floor(Math.log10(step)));
          newValue =
            Math.round(newValue * Math.pow(10, decimals)) /
            Math.pow(10, decimals);
          lastValueRef.current = newValue;
          if (onValueChange) {
            onValueChange([newValue]);
          }
        });
      }

      // Capture pointer for smooth dragging
      (event.target as Element).setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: React.PointerEvent) => {
      if (!trackRectRef.current) return;
      // Ignore hover-only movement (no buttons pressed) unless already dragging
      if (!isDragging && event.buttons === 0) return;

      // Cancel any pending animation frame to avoid multiple updates
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }

      // Use cached rect to avoid layout thrashing
      const rect = trackRectRef.current;
      const trackWidth = rect.width;
      const clientX = event.clientX;

      // Schedule update on next animation frame for smooth performance
      rafIdRef.current = requestAnimationFrame(() => {
        let newValue: number;
        if (interactionIsCoarseRef.current) {
          // Mobile: relative drag behavior
          const deltaX = clientX - startX;
          const valueRange = max - min;
          const deltaValue =
            trackWidth > 0 ? (deltaX / trackWidth) * valueRange : 0;
          newValue = startValue + deltaValue;
        } else {
          // Desktop
          if (!isDragging) {
            const moved = Math.abs(clientX - pointerDownXRef.current);
            if (moved < DRAG_DETECTION_PX) {
              // Treat as click: set value to absolute position immediately with a short smooth transition
              if (smoothAnimateTimeoutRef.current) {
                window.clearTimeout(smoothAnimateTimeoutRef.current);
                smoothAnimateTimeoutRef.current = null;
              }
              setSmoothAnimate(true);
              smoothAnimateTimeoutRef.current = window.setTimeout(() => {
                setSmoothAnimate(false);
                smoothAnimateTimeoutRef.current = null;
              }, 180);
              const clampedX = Math.min(
                Math.max(clientX, rect.left),
                rect.right,
              );
              const ratio =
                trackWidth > 0 ? (clampedX - rect.left) / trackWidth : 0;
              const valueRange = max - min;
              let clickValue = min + ratio * valueRange;
              if (step > 0) clickValue = Math.round(clickValue / step) * step;
              const decimals =
                step >= 1 ? 0 : Math.max(0, -Math.floor(Math.log10(step)));
              clickValue =
                Math.round(clickValue * Math.pow(10, decimals)) /
                Math.pow(10, decimals);
              lastValueRef.current = clickValue;
              onValueChange?.([clickValue]);
              return;
            }
            // Threshold crossed: enter dragging mode and disable smooth animation
            setIsDragging(true);
            if (smoothAnimate) {
              setSmoothAnimate(false);
              if (smoothAnimateTimeoutRef.current) {
                window.clearTimeout(smoothAnimateTimeoutRef.current);
                smoothAnimateTimeoutRef.current = null;
              }
            }
          }
          // Desktop: absolute position behavior
          const clampedX = Math.min(Math.max(clientX, rect.left), rect.right);
          const ratio =
            trackWidth > 0 ? (clampedX - rect.left) / trackWidth : 0;
          const valueRange = max - min;
          newValue = min + ratio * valueRange;
        }

        // Clamp to min/max bounds
        newValue = Math.max(min, Math.min(max, newValue));

        // Snap to step
        if (step > 0) {
          newValue = Math.round(newValue / step) * step;
        }

        // Round based on step size to avoid floating point precision issues
        const decimals =
          step >= 1 ? 0 : Math.max(0, -Math.floor(Math.log10(step)));
        newValue =
          Math.round(newValue * Math.pow(10, decimals)) /
          Math.pow(10, decimals);

        lastValueRef.current = newValue;
        if (onValueChange) {
          onValueChange([newValue]);
        }
      });
    };

    const handlePointerUp = (event: React.PointerEvent) => {
      if (!isDragging && !isPointerDownRef.current) return;

      setIsDragging(false);
      isPointerDownRef.current = false;
      setIsPointerDown(false);

      // Clear cached rect when interaction ends
      trackRectRef.current = null;

      // Cancel any pending animation frame
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      if (onValueCommit) {
        onValueCommit([lastValueRef.current]);
      }

      (event.target as Element).releasePointerCapture(event.pointerId);
    };

    const handlePointerCancel = () => {
      setIsDragging(false);
      isPointerDownRef.current = false;
      setIsPointerDown(false);

      // Clear cached rect when interaction ends
      trackRectRef.current = null;

      // Cancel any pending animation frame
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };

    const handleDefaultMarkerClick = (event: React.MouseEvent) => {
      event.stopPropagation();

      // Trigger animation
      setIsAnimating(true);

      if (onValueChange) {
        onValueChange([defaultVal]);
      }
      if (onValueCommit) {
        onValueCommit([defaultVal]);
      }

      // Reset animation state after animation completes
      setTimeout(() => {
        setIsAnimating(false);
      }, 300);
    };

    // Prevent default Radix behavior
    const handleRadixValueChange = () => {
      // Do nothing - we handle our own value changes
    };

    return (
      <SliderPrimitive.Root
        ref={ref}
        className={cn(
          'group relative flex h-8 w-full touch-none select-none items-center',
          className,
        )}
        onValueChange={handleRadixValueChange}
        value={[currentValue]}
        min={min}
        max={max}
        step={step}
        {...props}
      >
        <SliderPrimitive.Track
          ref={trackRef}
          className={cn(
            'relative h-6 w-full grow cursor-pointer overflow-hidden transition-all',
            variant === 'capsule'
              ? 'rounded-full bg-sky-500/20'
              : 'rounded-[8px] bg-sky-500/20',
            (isDragging || isPointerDown) && 'h-7',
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          <SliderPrimitive.Range
            className={cn(
              'absolute h-full overflow-hidden bg-sky-300/20',
              variant === 'capsule' ? 'rounded-full' : 'rounded-l-[8px]',
              isAnimating
                ? 'transition-all duration-300 ease-out'
                : smoothAnimate && !isDragging
                  ? 'transition-all duration-150 ease-out'
                  : 'transition-colors',
              !isDragging &&
                !isPointerDown &&
                '[@media(hover:hover)]:group-hover:bg-sky-100/50',
              (isDragging || isPointerDown) && '!bg-sky-200/50',
              isAnimating && '!bg-sky-200/50',
            )}
          />
          {/* Default value marker */}
          {!hideDefaultMarker &&
            currentValue !== defaultVal &&
            (defaultMarkerStyle === 'dot' ? (
              <div
                className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-white opacity-60 shadow-[0_0_8px_rgba(0,0,0,0.5)] transition-all hover:h-2.5 hover:w-2.5 hover:opacity-100"
                style={{ left: `${defaultPosition}%` }}
                onClick={handleDefaultMarkerClick}
                title={`Reset to default (${defaultVal})`}
              >
                {/* Invisible wider click area */}
                <div className="absolute inset-0 h-full w-3 -translate-x-1/2 cursor-pointer" />
              </div>
            ) : (
              <div
                className="absolute bottom-[2px] top-[2px] w-[2px] -translate-x-1/2 cursor-pointer rounded-full bg-white opacity-40 shadow-[0_0_8px_rgba(0,0,0,0.5)] transition-all hover:w-[4px] hover:opacity-100"
                style={{ left: `${defaultPosition}%` }}
                onClick={handleDefaultMarkerClick}
                title={`Reset to default (${defaultVal})`}
              >
                {/* Invisible wider click area */}
                <div className="absolute -left-1.5 -right-1.5 bottom-0 top-0 cursor-pointer" />
              </div>
            ))}
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="hidden" />
      </SliderPrimitive.Root>
    );
  },
);
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
