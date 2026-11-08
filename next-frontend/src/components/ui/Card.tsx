import React, { HTMLAttributes, forwardRef } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  withFigmaShadow?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', withFigmaShadow = false, children, ...props }, ref) => {
    const shadowClass = withFigmaShadow ? 'figma-card-shadow' : 'shadow-sm border border-gray-100 dark:border-gray-800';
    return (
      <div
        ref={ref}
        className={`bg-white dark:bg-gray-900 rounded-xl p-6 ${shadowClass} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
export default Card;

