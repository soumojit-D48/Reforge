import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";

type ButtonVariant = "default" | "ghost" | "outline";
type ButtonSize = "default" | "sm" | "lg" | "icon";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
  children?: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  default: "button-default",
  ghost: "button-ghost",
  outline: "button-outline",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "button-default-size",
  sm: "button-small",
  lg: "button-large",
  icon: "button-icon",
};

function buttonClassName(
  className: string | undefined,
  variant: ButtonVariant,
  size: ButtonSize,
) {
  return ["button-base", variantClasses[variant], sizeClasses[size], className]
    .filter(Boolean)
    .join(" ");
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    asChild = false,
    children,
    className,
    size = "default",
    variant = "default",
    ...props
  },
  ref,
) {
  const classes = buttonClassName(className, variant, size);

  if (asChild) {
    const child = Children.only(children);
    if (!isValidElement(child)) {
      throw new Error("Button with asChild requires one valid React element child.");
    }

    const childWithProps = child as ReactElement<{
      className?: string;
      ref?: Ref<HTMLButtonElement>;
    }>;

    return cloneElement(childWithProps, {
      className: [classes, childWithProps.props.className].filter(Boolean).join(" "),
      ref,
    });
  }

  return (
    <button ref={ref} className={classes} {...props}>
      {children}
    </button>
  );
});

Button.displayName = "Button";
