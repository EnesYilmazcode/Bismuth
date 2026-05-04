import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { AnimatedEllipsis } from '@/components/chat/AnimatedEllipsis';

export function AssistantLoading() {
  return (
    <div className="flex w-full p-1">
      <div className="mr-2 mt-1 hidden sm:block">
        <Avatar className="h-9 w-9 border border-adam-neutral-700 bg-adam-neutral-950 p-1.5">
          <AvatarImage
            src={`${import.meta.env.BASE_URL}/adam-logo.svg`}
            alt="Adam"
          />
        </Avatar>
      </div>
      <div className="flex max-w-[80%] flex-col items-center justify-center gap-2 rounded-lg bg-adam-neutral-800 p-3">
        <AnimatedEllipsis color="adam-neutral" />
      </div>
    </div>
  );
}
