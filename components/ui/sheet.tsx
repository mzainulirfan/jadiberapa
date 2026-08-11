"use client"

import * as React from "react"
import { useMediaQuery } from "@/lib/hooks/use-media-query"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"

// Sheet = Drawer responsif: bottom-sheet pada <lg (mobile), panel kanan 480-560px
// pada >=lg (desktop). API sama persis dengan Drawer sehingga migrasi cukup ganti
// import. Field complex tetap nyaman di desktop tanpa lebar sempit modal.
function Sheet({ ...props }: React.ComponentProps<typeof Drawer>) {
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  return (
    <Drawer
      {...props}
      swipeDirection={isDesktop ? "right" : "down"}
      showSwipeHandle={isDesktop ? false : props.showSwipeHandle}
    />
  )
}

function SheetContent({ className, ...props }: React.ComponentProps<typeof DrawerContent>) {
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  return (
    <DrawerContent
      {...props}
      className={cn(
        isDesktop && "lg:data-[swipe-axis=x]:[--drawer-content-width:clamp(480px,38vw,560px)]",
        className
      )}
    />
  )
}

function SheetClose({ ...props }: React.ComponentProps<typeof DrawerClose>) {
  return <DrawerClose {...props} />
}

function SheetDescription({ ...props }: React.ComponentProps<typeof DrawerDescription>) {
  return <DrawerDescription {...props} />
}

function SheetFooter({ ...props }: React.ComponentProps<typeof DrawerFooter>) {
  return <DrawerFooter {...props} />
}

function SheetHeader({ ...props }: React.ComponentProps<typeof DrawerHeader>) {
  return <DrawerHeader {...props} />
}

function SheetTitle({ ...props }: React.ComponentProps<typeof DrawerTitle>) {
  return <DrawerTitle {...props} />
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof DrawerTrigger>) {
  return <DrawerTrigger {...props} />
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}