// src/components/ui/dialog.tsx
"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/* ---------------------------
   SIZE VARIANTS (ERP Standard)
----------------------------*/
const sizeClasses = {
  sm: "w-[92vw] sm:max-w-md mx-auto",
  md: "w-[92vw] sm:max-w-2xl mx-auto",
  lg: "w-[95vw] sm:max-w-4xl mx-auto",
  xl: "w-[96vw] sm:max-w-6xl mx-auto",
  full: "w-screen h-screen max-w-none rounded-none mx-0",
  bulk: "w-[98vw] max-w-[1400px] h-[92vh] overflow-y-auto mx-auto",
};

/* ---------------------------
   DIALOG
----------------------------*/
function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

/* ---------------------------
   DIALOG OVERLAY
----------------------------*/
function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/60",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        className
      )}
      {...props}
    />
  );
}

/* ---------------------------
   DIALOG CONTENT (FIXED - ERP Professional)
----------------------------*/
function DialogContent({
  className,
  children,
  showCloseButton = true,
  size = "md",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
  size?: keyof typeof sizeClasses;
}) {
  // ✅ FIXED: Safe animation classes
  const getAnimationClasses = () => {
    return [
      "data-[state=open]:animate-in",
      "data-[state=open]:fade-in-0",
      "data-[state=open]:zoom-in-95",
      "data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0",
      "data-[state=closed]:zoom-out-95",
    ].join(" ");
  };

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
className={cn(
           // ✅ FIX: ERP Professional Positioning with Safe Padding
           "fixed inset-0 flex items-center justify-center",
           "p-2 sm:p-4 md:p-6",
           
           // BASE STYLES - SOLID BACKGROUND
           "z-50 grid gap-4 border bg-white dark:bg-gray-900 shadow-2xl",
           
           // RESPONSIVE SAFETY
           "max-h-[90vh] overflow-y-auto",
           
           // MOBILE FIX
           "rounded-xl sm:rounded-2xl",
           
           // ANIMATION
           "duration-200 outline-none",
           getAnimationClasses(),
           
           // SIZE SYSTEM
           sizeClasses[size],
           
           className
         )}
        {...props}
      >
        {children}
        
        {/* Close Button with Safe Spacing */}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute right-2 top-2 sm:right-3 sm:top-3 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
            asChild
          >
            <Button variant="ghost" size="icon-sm" className="h-8 w-8">
              <XIcon className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

/* ---------------------------
   DIALOG HEADER
----------------------------*/
function DialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex flex-col space-y-1.5 text-center sm:text-left",
        className
      )}
      {...props}
    />
  );
}

/* ---------------------------
   DIALOG FOOTER (FIXED - No negative margin)
----------------------------*/
function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

/* ---------------------------
   DIALOG TITLE
----------------------------*/
function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "text-lg font-semibold text-gray-900 dark:text-white",
        className
      )}
      {...props}
    />
  );
}

/* ---------------------------
   DIALOG DESCRIPTION
----------------------------*/
function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-gray-500 dark:text-gray-400",
        className
      )}
      {...props}
    />
  );
}

/* ---------------------------
   EXPORT
----------------------------*/
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};