import {
  MessageSquare,
  Clock,
  MoreVertical,
  Trash2,
  LockKeyhole,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { formatDistanceToNow } from 'date-fns';
import { HistoryConversation } from '../../types/misc.ts';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Link } from 'react-router-dom';
import { GoodEarth } from '../icons/ui/GoodEarth';

interface ConversationCardProps {
  conversation: HistoryConversation;
  onDelete: (conversationId: string) => void;
  onRename: (conversationId: string, newTitle: string) => void;
  onTogglePrivacy: (
    conversationId: string,
    newPrivacy: 'public' | 'private',
  ) => void;
  isEditing: boolean;
}

export function ConversationCard({
  conversation,
  onDelete,
  onRename,
  onTogglePrivacy,
  isEditing,
}: ConversationCardProps) {
  return (
    <div className="group relative">
      <Link to={`/editor/${conversation.id}`}>
        <Button
          variant="outline"
          className="flex h-auto w-full items-start justify-between rounded-xl border-[0px] bg-adam-background-2 transition-colors duration-200 ease-out hover:bg-adam-neutral-950"
          onClick={(event) => {
            if (isEditing) {
              event.stopPropagation();
            }
          }}
        >
          <div className="min-w-0 flex-1 space-y-2 p-1 text-left">
            <div className="flex items-center gap-3">
              <h3 className="line-clamp-1 text-wrap break-all text-base font-medium text-adam-neutral-50">
                {conversation.title}
              </h3>
              {conversation.privacy === 'public' && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <GoodEarth className="h-4 w-4 text-adam-neutral-50" />
                    </TooltipTrigger>
                    <TooltipContent>Public</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {conversation.privacy === 'private' && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <LockKeyhole className="h-4 w-4 text-adam-neutral-50" />
                    </TooltipTrigger>
                    <TooltipContent>Private</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs font-normal text-adam-neutral-400">
              <span className="flex items-center">
                <Clock className="mr-1 h-3 w-3 text-xs text-adam-neutral-400" />
                {formatDistanceToNow(new Date(conversation.updated_at), {
                  addSuffix: true,
                })}
              </span>
              <span className="flex items-center">
                <MessageSquare className="mr-1 h-3 w-3 text-xs text-adam-neutral-400" />
                {conversation.message_count} messages
              </span>
            </div>
            <div className="flex items-center gap-2">
              {conversation.type === 'parametric' ? (
                <div className="rounded-full bg-[#0061FF24] px-2 py-1 text-xs font-normal text-[#6183FF]">
                  Parametric
                </div>
              ) : (
                <div className="rounded-full bg-[#00A6FF29] px-2 py-1 text-xs font-normal text-[#38B6FF]">
                  Creative
                </div>
              )}
            </div>
          </div>
        </Button>
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <AlertDialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-8 w-8 p-0 transition-colors duration-200 ease-out hover:bg-adam-neutral-950"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4 text-adam-neutral-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[#191A1A]">
                <AlertDialogTrigger
                  asChild
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenuItem className="text-adam-neutral-50 hover:cursor-pointer hover:bg-adam-neutral-950 hover:text-red-500 focus:bg-adam-neutral-950 focus:text-red-500">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                {conversation.privacy === 'private' ? (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePrivacy(conversation.id, 'public');
                    }}
                    className="text-adam-neutral-50 hover:cursor-pointer hover:bg-adam-neutral-950 hover:text-adam-neutral-50 focus:bg-adam-neutral-950 focus:text-adam-neutral-50"
                  >
                    <GoodEarth className="mr-2 h-4 w-4" />
                    Make Public
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePrivacy(conversation.id, 'private');
                    }}
                    className="text-adam-neutral-50 hover:cursor-pointer hover:bg-adam-neutral-950 hover:text-adam-neutral-50 focus:bg-adam-neutral-950 focus:text-adam-neutral-50"
                  >
                    <LockKeyhole className="mr-2 h-4 w-4" />
                    Make Private
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onRename(conversation.id, conversation.title);
                  }}
                  className="text-adam-neutral-50 hover:cursor-pointer hover:bg-adam-neutral-950 hover:text-adam-neutral-50 focus:bg-adam-neutral-950 focus:text-adam-neutral-50"
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Rename
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialogContent className="border-[2px] border-adam-neutral-700 bg-adam-background-1">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-adam-neutral-100">
                  Delete Conversation
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this conversation? This action
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={(e) => e.stopPropagation()}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conversation.id);
                  }}
                  className="bg-red-600 hover:bg-red-700 dark:bg-red-900 dark:hover:bg-red-800"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Link>
    </div>
  );
}
