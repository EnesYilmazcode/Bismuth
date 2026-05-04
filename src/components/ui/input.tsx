import * as React from 'react';

import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-[46px] w-full rounded-[9999px] border-[2px] border-solid border-[rgba(0,0,0,0.04)] bg-transparent px-3 py-1 text-sm text-adam-neutral-10 shadow-[inset_0px_0px_4px_0px_rgba(0,0,0,0.16)] transition-colors duration-300 ease-out file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-adam-neutral-300 hover:placeholder:text-adam-neutral-10 focus:border-solid focus:border-adam-blue focus:text-adam-neutral-10 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
