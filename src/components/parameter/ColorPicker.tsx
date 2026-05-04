import React, { useState, useEffect, useRef } from 'react';
import { ChevronUp } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ color, onChange }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(color.replace('#', ''));
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [popoverWidth, setPopoverWidth] = useState<number | undefined>(
    undefined,
  );

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    // Allow only hex characters, cap at 6.
    if (/^[A-F0-9]*$/.test(value) && value.length <= 6) {
      setInputValue(value);
      if (value.length === 6) {
        onChange(`#${value}`);
      }
    }
  };

  const handleHexBlur = () => {
    // Reset stale entry back to the committed color on blur.
    if (inputValue.length !== 6) {
      setInputValue(color.replace('#', ''));
    }
  };

  useEffect(() => {
    setInputValue(color.replace('#', ''));
  }, [color]);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      setPopoverWidth(triggerRef.current.offsetWidth);
    }
  }, [isOpen]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Toggle color picker"
          ref={triggerRef}
          className="relative inline-flex h-6 w-fit items-center gap-2 overflow-hidden rounded-md bg-adam-neutral-800 pl-2 pr-1 text-xs text-adam-neutral-10 transition-colors duration-200 ease-out focus:outline-none [@media(hover:hover)]:hover:bg-adam-neutral-700"
        >
          <div className="flex items-center gap-2">
            <div
              className="h-3.5 w-3.5 flex-shrink-0 rounded-full shadow-sm ring-1 ring-adam-neutral-700/60"
              style={{ backgroundColor: color }}
            />
            <div className="flex min-w-0 items-center gap-1 font-mono text-xs uppercase text-adam-text-primary">
              <span className="text-adam-neutral-400">#</span>
              <input
                type="text"
                value={inputValue}
                onChange={handleHexChange}
                onBlur={handleHexBlur}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onFocus={(e) => {
                  e.stopPropagation();
                  e.currentTarget.select();
                }}
                className="w-[7ch] cursor-text rounded bg-transparent px-1 py-0.5 leading-none text-adam-text-primary outline-none transition-colors duration-200 ease-out selection:bg-[#70B8FF7A] selection:text-white focus:bg-adam-neutral-900 [@media(hover:hover)]:hover:bg-adam-neutral-950/50"
                spellCheck="false"
              />
            </div>
          </div>
          <ChevronUp
            className={`h-3 w-3 flex-shrink-0 text-adam-neutral-300 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto rounded-md border-none bg-adam-neutral-800 p-3 shadow-md"
        style={{
          width: popoverWidth ? Math.max(popoverWidth, 180) : undefined,
        }}
      >
        <HexColorPicker
          color={color}
          onChange={(newColor) => onChange(newColor.toUpperCase())}
          style={{ height: '120px', width: '100%' }}
        />
      </PopoverContent>
    </Popover>
  );
}
