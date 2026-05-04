import { useState, useEffect } from 'react';

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    // Function to check if the viewport width is mobile-sized
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 640); // 640px is the 'sm' breakpoint in Tailwind
    };
    // Add event listener for window resize
    window.addEventListener('resize', checkIsMobile);

    // Clean up event listener
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  return isMobile;
}
