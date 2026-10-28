"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { DashboardTopBar } from "@/components/layout/dashboard-top-bar";
import { NavIcon } from "@/components/layout/nav-icon";
import { mainNavItems, type NavItem } from "@/lib/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
  SidebarRail,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface DashboardShellProps {
  children: React.ReactNode;
  navItems?: NavItem[];
  basePath?: string;
  accountLabel?: string;
  showCurrencyToggle?: boolean;
  userName?: string;
  userInitials?: string;
  profileHref?: string;
}

/** On phones the menu is a sheet over the page; close it once a link has been followed. */
function CloseMobileMenuOnNavigate() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);
  return null;
}

function DashboardShell({
  children,
  navItems = mainNavItems,
  basePath = "/dashboard",
  accountLabel,
  showCurrencyToggle = false,
  userName,
  userInitials,
  profileHref,
}: DashboardShellProps) {
  const pathname = usePathname();
  const settingsHref = `${basePath}/settings`;
  const settingsActive = pathname.startsWith(settingsHref);

  return (
    <SidebarProvider
      defaultOpen
      style={{ "--sidebar-width-icon": "4.5rem" } as React.CSSProperties}
    >
      <CloseMobileMenuOnNavigate />
      <Sidebar collapsible="icon" className="border-r border-sidebar-border">
        <SidebarHeader className="gap-2 px-2 py-3">
          <Link
            href={basePath}
            prefetch={false}
            className="mb-1 flex h-10 w-full shrink-0 items-center rounded-lg px-2 transition-opacity hover:opacity-80 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:mb-0 group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          >
            <Image
              src="/logos/JA_Wealth_wht.png"
              alt="JA Wealth"
              width={148}
              height={26}
              className="h-6 w-auto object-contain group-data-[collapsible=icon]:hidden"
              priority
            />
            <Image
              src="/logos/ja-symbol-white.png"
              alt="JA Wealth"
              width={32}
              height={32}
              className="hidden size-8 object-contain group-data-[collapsible=icon]:block"
              priority
            />
          </Link>

          <SidebarGroup className="p-0">
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {navItems.map((item) => {
                  const isActive =
                    item.href === basePath
                      ? pathname === basePath
                      : pathname.startsWith(item.href);

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={item.label}
                        className={cn(
                          "h-auto gap-2.5 px-2.5 py-1.5",
                          // Active item: a light lift with a gold edge, rather than a solid gold block.
                          "text-white/75 hover:text-white data-active:bg-white/10 data-active:text-white data-active:shadow-[inset_2px_0_0_var(--brand-accent)] data-active:[&_svg]:text-brand-accent",
                          "group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:rounded-lg group-data-[collapsible=icon]:p-0!",
                          "group-data-[collapsible=icon]:[&>span:not(.badge)]:hidden"
                        )}
                        render={<Link href={item.href} prefetch={false} />}
                      >
                        <NavIcon icon={item.icon} iconSrc={item.iconSrc} label={item.label} className="size-4" />
                        <span className="flex-1">{item.label}</span>
                        {item.badge ? (
                          <span className="badge ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-accent px-1 text-[10px] font-bold leading-none text-white group-data-[collapsible=icon]:hidden">
                            {item.badge}
                          </span>
                        ) : null}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarHeader>

        <SidebarContent className="flex-1" />

        <SidebarFooter className="px-2 pb-3 pt-2 group-data-[collapsible=icon]:items-center">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={settingsActive}
                tooltip="Settings"
                className="h-auto gap-2.5 px-2.5 py-1.5 group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:rounded-lg group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:[&>span]:hidden"
                render={<Link href={settingsHref} prefetch={false} />}
              >
                <Settings className="size-4" />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="bg-dashboard-gradient">
        <DashboardTopBar
          navItems={navItems}
          basePath={basePath}
          accountLabel={accountLabel}
          showCurrencyToggle={showCurrencyToggle}
          userName={userName}
          userInitials={userInitials}
          profileHref={profileHref}
        />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}

export { DashboardShell };
