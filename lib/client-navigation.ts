import {
  CalendarDays,
  FileText,
  FolderOpen,
  LayoutDashboard,
  MessageSquare,
  PieChart,
  Target,
  UserCircle,
} from "lucide-react";

import { appConfig } from "@/lib/app-config";
import type { NavItem } from "@/lib/navigation";

const { dashboard } = appConfig.routes.client;

const clientNavItems: NavItem[] = [
  { label: "Dashboard", href: dashboard, icon: LayoutDashboard },
  { label: "Reports", href: `${dashboard}/reports`, icon: FileText },
  { label: "My Portfolio", href: `${dashboard}/portfolio`, icon: PieChart },
  { label: "My Plan", href: `${dashboard}/goals`, icon: Target },
  { label: "Sessions", href: `${dashboard}/sessions`, icon: CalendarDays },
  { label: "Documents", href: `${dashboard}/documents`, icon: FolderOpen },
  { label: "Messages", href: `${dashboard}/messages`, icon: MessageSquare },
  { label: "Your Advisor", href: `${dashboard}/advisor`, icon: UserCircle },
];

export { clientNavItems };
