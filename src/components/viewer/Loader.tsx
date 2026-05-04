import Lottie from 'lottie-react';
import { useEffect, useRef, useState } from 'react';
import adamLoading from '@/assets/adam-loading.json';
import { pickSpinnerVerb } from '@/constants/spinnerVerbs';

type Props = {
  message?: string;
};

const INITIAL_MESSAGE_MS = 2000;
const VERB_ROTATE_MS = 2800;
// Must match `duration-200` on the <p> element in the JSX below.
const FADE_MS = 200;

const Loader = ({ message }: Props) => {
  const dot2 = useRef<HTMLSpanElement>(null);
  const dot3 = useRef<HTMLSpanElement>(null);
  const loadingMessage = useRef<HTMLParagraphElement>(null);
  const fadeTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [changingMessage, setChangingMessage] = useState(message);

  useEffect(() => {
    const swapMessage = (next: string) => {
      if (!loadingMessage.current) {
        setChangingMessage(next);
        return;
      }
      loadingMessage.current.classList.add('opacity-0');
      const fadeId = setTimeout(() => {
        loadingMessage.current?.classList.remove('opacity-0');
        setChangingMessage(next);
      }, FADE_MS);
      fadeTimeouts.current.push(fadeId);
    };

    // Kick off the whimsical verb rotation after the initial message.
    const initialTimeout = setTimeout(() => {
      swapMessage(pickSpinnerVerb());
    }, INITIAL_MESSAGE_MS);

    let rotateInterval: ReturnType<typeof setInterval> | undefined;
    const startRotateTimeout = setTimeout(() => {
      rotateInterval = setInterval(() => {
        swapMessage(pickSpinnerVerb());
      }, VERB_ROTATE_MS);
    }, INITIAL_MESSAGE_MS);

    // CHANGE TAB TITLE
    document.title = 'Loading model.';

    const titleInterval = setInterval(() => {
      if (document.title === 'Loading model.') {
        document.title = 'Loading model..';
      } else if (document.title === 'Loading model..') {
        document.title = 'Loading model...';
      } else {
        document.title = 'Loading model.';
      }
    }, 300);

    // ANIMATE LAST TWO DOTS WITH DELAYS AND INTERVALS
    const interval = setInterval(() => {
      dot2.current?.classList.toggle('opacity-0');
      setTimeout(() => {
        dot3.current?.classList.toggle('opacity-0');
      }, 300);
      setTimeout(() => {
        dot2.current?.classList.toggle('opacity-0');
        dot3.current?.classList.toggle('opacity-0');
      }, 600);
    }, 900);

    // Cleanup intervals on unmount
    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(startRotateTimeout);
      if (rotateInterval) clearInterval(rotateInterval);
      clearInterval(titleInterval);
      clearInterval(interval);
      fadeTimeouts.current.forEach(clearTimeout);
      fadeTimeouts.current = [];
      document.title = 'Adam';
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative h-32 w-32">
        <Lottie
          animationData={adamLoading}
          loop={true}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
      {message && (
        <p
          ref={loadingMessage}
          className="mt-4 text-base text-adam-text-primary transition-opacity duration-200"
        >
          {changingMessage}
          <span>.</span>
          <span
            ref={dot2}
            className="opacity-0 transition-opacity duration-200"
          >
            .
          </span>
          <span
            ref={dot3}
            className="opacity-0 transition-opacity duration-200"
          >
            .
          </span>
        </p>
      )}
    </div>
  );
};

export default Loader;
