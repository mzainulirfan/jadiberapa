"use client"

import * as React from "react"
import { forwardRef } from "react"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  DashboardSquare01Icon,
  ShoppingCart01Icon,
  PackageIcon,
  MoreHorizontalIcon,
  Search01Icon,
  PencilIcon,
  Delete01Icon,
  Add01Icon,
  UserIcon,
  CheckIcon,
  Tag01Icon,
  StarIcon,
  InvoiceIcon,
  Dollar01Icon,
  ChartUpIcon,
  ChartLineIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  Store01Icon,
  Location01Icon,
  CallIcon,
  InformationCircleIcon,
  ShoppingBag01Icon,
  MinusSignIcon,
  CheckmarkCircle01Icon,
  CancelCircleIcon,
  Alert02Icon,
  CogIcon,
  QrCodeIcon,
  Wallet01Icon,
  CopyIcon,
  FilterIcon,
  BarCode01Icon,
  GridIcon,
  Menu01Icon,
  BarChartIcon,
  PrinterIcon,
  Share01Icon,
  Logout01Icon,
  WhatsappIcon,
  Camera01Icon,
  ZapIcon,
  RefreshIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  Key01Icon,
  HelpCircleIcon,
  ArrowRight01Icon,
  Download01Icon,
  Upload01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"

function makeIcon(name: string, icon: IconSvgElement) {
  const Cmp = forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
    ({ className, strokeWidth, ...props }, ref) => (
      <HugeiconsIcon
        icon={icon}
        ref={ref}
        className={className}
        strokeWidth={strokeWidth as number | undefined}
        aria-hidden="true"
        {...props}
      />
    )
  )
  Cmp.displayName = name
  return Cmp
}

const Dashboard = makeIcon("Dashboard", DashboardSquare01Icon)
const CartAlt = makeIcon("CartAlt", ShoppingCart01Icon)
const Package = makeIcon("Package", PackageIcon)
const DotsHorizontalRounded = makeIcon("DotsHorizontalRounded", MoreHorizontalIcon)
const Search = makeIcon("Search", Search01Icon)
const Pencil = makeIcon("Pencil", PencilIcon)
const Trash = makeIcon("Trash", Delete01Icon)
const Plus = makeIcon("Plus", Add01Icon)
const User = makeIcon("User", UserIcon)
const Check = makeIcon("Check", CheckIcon)
const Tag = makeIcon("Tag", Tag01Icon)
const Star = makeIcon("Star", StarIcon)
const Receipt = makeIcon("Receipt", InvoiceIcon)
const Dollar = makeIcon("Dollar", Dollar01Icon)
const TrendingUp = makeIcon("TrendingUp", ChartUpIcon)
const ChartLine = makeIcon("ChartLine", ChartLineIcon)
const ChevronLeft = makeIcon("ChevronLeft", ChevronLeftIcon)
const ChevronRight = makeIcon("ChevronRight", ChevronRightIcon)
const ChevronDown = makeIcon("ChevronDown", ChevronDownIcon)
const Store = makeIcon("Store", Store01Icon)
const LocationPin = makeIcon("LocationPin", Location01Icon)
const Phone = makeIcon("Phone", CallIcon)
const InfoCircle = makeIcon("InfoCircle", InformationCircleIcon)
const ShoppingBag = makeIcon("ShoppingBag", ShoppingBag01Icon)
const Minus = makeIcon("Minus", MinusSignIcon)
const CheckCircle = makeIcon("CheckCircle", CheckmarkCircle01Icon)
const XCircle = makeIcon("XCircle", CancelCircleIcon)
const AlertTriangle = makeIcon("AlertTriangle", Alert02Icon)
const Cog = makeIcon("Cog", CogIcon)
const Qr = makeIcon("Qr", QrCodeIcon)
const Wallet = makeIcon("Wallet", Wallet01Icon)
const Copy = makeIcon("Copy", CopyIcon)
const Filter = makeIcon("Filter", FilterIcon)
const Barcode = makeIcon("Barcode", BarCode01Icon)
const Grid = makeIcon("Grid", GridIcon)
const List = makeIcon("List", Menu01Icon)
const BarChart = makeIcon("BarChart", BarChartIcon)
const Printer = makeIcon("Printer", PrinterIcon)
const Share = makeIcon("Share", Share01Icon)
const LogOut = makeIcon("LogOut", Logout01Icon)
const Whatsapp = makeIcon("Whatsapp", WhatsappIcon)
const Camera = makeIcon("Camera", Camera01Icon)
const Zap = makeIcon("Zap", ZapIcon)
const Refresh = makeIcon("Refresh", RefreshIcon)
const Eye = makeIcon("Eye", EyeIcon)
const EyeOff = makeIcon("EyeOff", EyeOffIcon)
const Lock = makeIcon("Lock", LockIcon)
const KeyRound = makeIcon("KeyRound", Key01Icon)
const HelpCircle = makeIcon("HelpCircle", HelpCircleIcon)
const ArrowRight = makeIcon("ArrowRight", ArrowRight01Icon)
const Download = makeIcon("Download", Download01Icon)
const Upload = makeIcon("Upload", Upload01Icon)
const X = makeIcon("X", Cancel01Icon)

export {
  Dashboard,
  CartAlt,
  Package,
  DotsHorizontalRounded,
  Search,
  Pencil,
  Trash,
  Plus,
  User,
  Check,
  Tag,
  Star,
  Receipt,
  Dollar,
  TrendingUp,
  ChartLine,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Store,
  LocationPin,
  Phone,
  InfoCircle,
  ShoppingBag,
  Minus,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Cog,
  Qr,
  Wallet,
  Copy,
  Filter,
  Barcode,
  Grid,
  List,
  BarChart,
  Printer,
  Share,
  LogOut,
  Whatsapp,
  Camera,
  Zap,
  Refresh,
  Eye,
  EyeOff,
  Lock,
  KeyRound,
  HelpCircle,
  ArrowRight,
  Download,
  Upload,
  X,
}
