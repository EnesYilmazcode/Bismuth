import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';

import { cn } from '@/lib/utils';

// Gradient palette for avatar fallbacks (created once at module load)
export const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #5F10BF 0%, #A62876 40%, #D43A33 90%)',
  'linear-gradient(135deg, #29ACE2 0%, #CC2DE1 100%)',
  'linear-gradient(135deg, rgba(42, 123, 155, 1) 0%, rgba(87, 199, 133, 1) 50%, rgba(237, 221, 83, 1) 100%)',
  'linear-gradient(135deg, #d53369 0%, #daae51 100%)',
  // Flipped direction versions (45deg)
  'linear-gradient(45deg, #5F10BF 0%, #A62876 40%, #D43A33 90%)',
  'linear-gradient(45deg, #29ACE2 0%, #CC2DE1 100%)',
  'linear-gradient(45deg, rgba(42, 123, 155, 1) 0%, rgba(87, 199, 133, 1) 50%, rgba(237, 221, 83, 1) 100%)',
  'linear-gradient(45deg, #d53369 0%, #daae51 100%)',
];

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full',
      className,
    )}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn('aspect-square h-full w-full', className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, children, ...props }, ref) => {
  const gradient = React.useMemo(() => {
    // Attempt to extract the first character from the children
    let firstChar: string | undefined;

    if (typeof children === 'string') {
      firstChar = children.charAt(0);
    } else if (Array.isArray(children)) {
      for (const child of children) {
        if (typeof child === 'string' && child.length > 0) {
          firstChar = child.charAt(0);
          break;
        }
      }
    }

    if (firstChar) {
      const upper = firstChar.toUpperCase();
      if (upper >= 'A' && upper <= 'Z') {
        const index = (upper.charCodeAt(0) - 65) % AVATAR_GRADIENTS.length;
        return AVATAR_GRADIENTS[index];
      }
    }

    // Fallback for non-alphabetic characters or if character not found
    return AVATAR_GRADIENTS[0];
  }, [children]);

  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      style={{
        background: gradient,
      }}
      className={cn(
        'flex h-full w-full items-center justify-center rounded-full text-xs text-transparent',
        className,
      )}
      {...props}
    >
      {children}
    </AvatarPrimitive.Fallback>
  );
});
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };
