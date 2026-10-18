import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-velzon-primary text-white shadow-sm hover:bg-velzon-primary-hover focus-visible:ring-velzon-primary',
        destructive:
          'bg-velzon-danger text-white shadow-sm hover:bg-red-600 focus-visible:ring-velzon-danger',
        outline:
          'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-velzon-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200',
        secondary:
          'bg-velzon-secondary text-white shadow-sm hover:bg-velzon-secondary-hover focus-visible:ring-velzon-secondary',
        ghost:
          'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800',
        link: 'text-velzon-primary underline-offset-4 hover:underline',
        success:
          'bg-velzon-success text-white shadow-sm hover:bg-teal-600 focus-visible:ring-velzon-success',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-md px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
