import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '~/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55 [&_svg]:size-5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-brand-700 text-white shadow-sm hover:bg-brand-600',
        secondary: 'bg-white text-ink ring-1 ring-line hover:bg-cream-200',
        soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
        whatsapp: 'bg-whatsapp text-whatsapp-ink shadow-sm hover:brightness-95',
        ghost: 'text-ink hover:bg-cream-200',
        danger: 'bg-danger text-white hover:brightness-110',
        link: 'text-brand-700 underline-offset-4 hover:underline px-0 min-h-0',
      },
      size: {
        sm: 'min-h-10 px-3 text-sm',
        md: 'min-h-11 px-4 text-[0.95rem]',
        lg: 'min-h-13 px-6 text-base',
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...(asChild ? {} : { type: type ?? 'button' })}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
