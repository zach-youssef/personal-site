import React from 'react';

// jsdom has no canvas, so tests render Konva shapes as plain elements whose props are
// exposed as data attributes, e.g. <div data-shape="Rect" data-fill="grey" data-x="0">.
function shape(name: string) {
    return function MockShape({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) {
        const dataProps = Object.fromEntries(
            Object.entries(props).map(([key, value]) => [`data-${key.toLowerCase()}`, String(value)])
        );
        return <div data-shape={name} {...dataProps}>{children}</div>;
    };
}

export const Stage = shape('Stage');
export const Layer = shape('Layer');
export const Rect = shape('Rect');
export const Circle = shape('Circle');
