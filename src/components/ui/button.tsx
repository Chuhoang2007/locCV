import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { LoaderCircle } from "lucide-react";

const buttonVariants = cva("button", {
  variants: { variant: { default: "button-primary", secondary: "button-secondary", ghost: "button-ghost", danger: "button-danger" }, size: { default: "", small: "button-small", icon: "button-icon" } },
  defaultVariants: { variant: "default", size: "default" },
});
export function Button({ className, variant, size, asChild = false, loading=false, children, disabled, ...props }: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean;loading?:boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size }),loading&&"button-loading",className)} {...props} disabled={disabled||loading} aria-busy={loading||props["aria-busy"]}>
    {asChild?children:<>{loading&&<LoaderCircle size={16} className="spin button-loading-icon" aria-hidden="true"/>}<span className="button-label">{children}</span></>}
  </Comp>;
}
