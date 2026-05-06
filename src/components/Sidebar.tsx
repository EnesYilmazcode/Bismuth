import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, Plus, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useQuery } from '@tanstack/react-query';
import { ConditionalWrapper } from './ConditionalWrapper';
import { BridgeHealthPill } from './BridgeHealthPill';
import { Conversation, ConversationSettings } from '@shared/types';

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
}

function DesktopSidebar({ isSidebarOpen, setIsSidebarOpen }: SidebarProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  // Get 10 most recent conversations
  const { data: recentConversations } = useQuery<Conversation[]>({
    queryKey: ['conversations', 'recent'],
    initialData: [],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('updated_at', { ascending: false })
        .eq('user_id', user?.id ?? '')
        .limit(10)
        .overrideTypes<Array<{ settings: ConversationSettings }>>();

      if (error) throw error;

      return data;
    },
  });

  const sidebarNavigate = (path: string) => {
    if (isMobile) {
      setIsSidebarOpen(false); // setIsSidebarOpen is actually setOpen from Sheet component
    }
    navigate(path);
  };

  return (
    <div
      className={`${isSidebarOpen ? 'w-64' : 'w-16'} flex h-full flex-shrink-0 flex-col bg-adam-bg-dark pb-2 transition-all duration-300 ease-in-out dark:bg-gray-950`}
    >
      <div className="p-4 dark:border-gray-800">
        <ConditionalWrapper
          condition={!isSidebarOpen}
          wrapper={(children) => (
            <Tooltip>
              <TooltipTrigger asChild>{children}</TooltipTrigger>
              <TooltipContent side="right" className="flex flex-col">
                <span className="font-semibold">Home</span>
                <span className="text-xs text-muted-foreground">Home Page</span>
              </TooltipContent>
            </Tooltip>
          )}
        >
          <Link to="/">
            <div
              className="flex cursor-pointer items-center space-x-2"
              onClick={() => sidebarNavigate('/')}
            >
              {isSidebarOpen ? (
                <div className="flex w-full">
                  <img
                    className="mx-auto h-8 w-full"
                    src={`${import.meta.env.BASE_URL}/adam-logo-full.svg`}
                    alt="Logo"
                  />
                </div>
              ) : (
                <img
                  src={`${import.meta.env.BASE_URL}/adam-logo.svg`}
                  alt="Logo"
                  className="h-8 w-8 min-w-8"
                />
              )}
            </div>
          </Link>
        </ConditionalWrapper>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className={`${isSidebarOpen ? 'px-4' : 'px-2'} flex-1 py-2 transition-all duration-300 ease-in-out`}
        >
          <ConditionalWrapper
            condition={!isSidebarOpen}
            wrapper={(children) => (
              <Tooltip>
                <TooltipTrigger asChild>{children}</TooltipTrigger>
                <TooltipContent side="right" className="flex flex-col">
                  <span className="font-semibold">New Creation</span>
                  <span className="text-xs text-muted-foreground">
                    Start a new conversation
                  </span>
                </TooltipContent>
              </Tooltip>
            )}
          >
            <div className="ml-[9px]">
              <Button
                variant="secondary"
                className={` ${
                  isSidebarOpen
                    ? 'flex w-[216px] items-center justify-start gap-2 rounded-[100px] border border-adam-blue bg-adam-background-1 px-4 py-3 text-[#D7D7D7] hover:bg-adam-blue/40 hover:text-adam-text-primary'
                    : 'flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border-2 border-adam-blue bg-[#191A1A] p-[2px] text-[#D7D7D7] shadow-[0px_4px_10px_0px_rgba(0,166,255,0.24)] hover:bg-adam-blue/40 hover:text-adam-text-primary'
                } mb-4`}
                onClick={() => sidebarNavigate('/')}
              >
                <Plus
                  className={`h-5 w-5 ${!isSidebarOpen ? 'text-adam-neutral-300 hover:text-adam-text-primary' : ''}`}
                />
                {isSidebarOpen && (
                  <div className="text-sm font-semibold leading-[14px] tracking-[-0.14px] text-adam-neutral-200">
                    New Creation
                  </div>
                )}
              </Button>
            </div>
          </ConditionalWrapper>
          <nav className="space-y-1">
            {[
              {
                icon: LayoutGrid,
                label: 'Creations',
                href: '/history',
                description: 'View past creations',
                submenu: recentConversations,
              },
            ].map(({ icon: Icon, label, href, description, submenu }) => (
              <div key={label} className="space-y-1">
                <ConditionalWrapper
                  condition={!isSidebarOpen}
                  wrapper={(children) => (
                    <Tooltip>
                      <TooltipTrigger asChild>{children}</TooltipTrigger>
                      <TooltipContent side="right" className="flex flex-col">
                        <span className="font-semibold">{label}</span>
                        <span className="text-xs text-muted-foreground">
                          {description}
                        </span>
                      </TooltipContent>
                    </Tooltip>
                  )}
                >
                  <Link to={href}>
                    <Button
                      variant={
                        isSidebarOpen ? 'adam_dark' : 'adam_dark_collapsed'
                      }
                      onClick={() => sidebarNavigate(href)}
                      className={`${isSidebarOpen ? 'w-full justify-start' : 'ml-[1px] h-[46px] w-[46px] p-0'}`}
                    >
                      <Icon
                        className={`${isSidebarOpen ? 'mr-2' : ''} h-[22px] w-[22px] min-w-[22px]`}
                      />
                      {isSidebarOpen && label}
                    </Button>
                  </Link>
                </ConditionalWrapper>
                {isSidebarOpen && submenu && (
                  <ul className="ml-7 flex list-none flex-col gap-1 border-l border-adam-neutral-500 px-2">
                    {submenu.map(
                      (
                        conversation: Omit<
                          Conversation,
                          'message_count' | 'last_message_at'
                        >,
                      ) => {
                        return (
                          <Link
                            to={`/editor/${conversation.id}`}
                            key={conversation.id}
                            onClick={() => {
                              if (isMobile) {
                                setIsSidebarOpen(false);
                              }
                            }}
                          >
                            <li key={conversation.id}>
                              <span className="line-clamp-1 text-ellipsis text-nowrap rounded-md p-1 text-xs font-medium text-adam-neutral-400 transition-colors duration-200 ease-in-out [@media(hover:hover)]:hover:bg-adam-neutral-950 [@media(hover:hover)]:hover:text-adam-neutral-10">
                                {conversation.title}
                              </span>
                            </li>
                          </Link>
                        );
                      },
                    )}
                  </ul>
                )}
              </div>
            ))}
          </nav>
        </div>

        <BridgeHealthPill collapsed={!isSidebarOpen} />
      </div>
    </div>
  );
}

function MobileSidebar({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isSidebarOpen,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setIsSidebarOpen,
}: SidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="fixed left-2 top-2.5 z-50 hover:bg-adam-neutral-700 md:hidden"
        >
          <Menu className="h-5 w-5 text-adam-text-primary" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="bg-adam-bg-dark p-0 [&>button]:text-white"
      >
        {/* For aria stuff */}
        <SheetHeader className="hidden">
          <SheetTitle className="text-adam-text-primary">Bismuth</SheetTitle>
          <SheetDescription>
            AI-powered CAD software for everyone
          </SheetDescription>
        </SheetHeader>
        <DesktopSidebar isSidebarOpen={true} setIsSidebarOpen={setOpen} />
      </SheetContent>
    </Sheet>
  );
}

export function Sidebar({ isSidebarOpen, setIsSidebarOpen }: SidebarProps) {
  const isMobile = useIsMobile();
  const { user } = useAuth();

  // Don't display the sidebar if the user isn't logged in
  if (user == null) {
    return <></>;
  }

  return isMobile ? (
    <MobileSidebar
      isSidebarOpen={isSidebarOpen}
      setIsSidebarOpen={setIsSidebarOpen}
    />
  ) : (
    <DesktopSidebar
      isSidebarOpen={isSidebarOpen}
      setIsSidebarOpen={setIsSidebarOpen}
    />
  );
}
