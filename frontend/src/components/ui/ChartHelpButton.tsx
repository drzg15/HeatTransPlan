import React, { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import './ChartHelpButton.css';

interface Props {
  title: string;
  description: React.ReactNode;
  inline?: boolean;
  size?: 'normal' | 'large';
}

export default function ChartHelpButton({ title, description, inline = false, size = 'normal' }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, right: 0 });

  // Position the popup against the button, then keep it inside the viewport.
  // It used to right-align unconditionally, which pushed it off the left edge
  // for any button sitting near the left of the screen. Measured in a layout
  // effect so the correction lands before paint rather than as a visible jump.
  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current) return;
    const MARGIN = 12;
    const btn = buttonRef.current.getBoundingClientRect();
    const pop = popupRef.current?.getBoundingClientRect();
    const width = pop?.width ?? 280;
    const height = pop?.height ?? 220;

    // Right-align to the button, but never let the left edge leave the screen.
    let right = window.innerWidth - btn.right;
    right = Math.min(right, window.innerWidth - width - MARGIN);
    right = Math.max(right, MARGIN);

    // The popup is shifted up by its own height, so `top` is its bottom edge.
    // Flip below the button when there is not enough room above it.
    const fitsAbove = btn.top - 8 - height >= MARGIN;
    const top = fitsAbove ? btn.top - 8 : btn.bottom + 8 + height;

    setCoords({ top, right });
  }, [isOpen]);

  const popup = isOpen
    ? createPortal(
        <div
          ref={popupRef}
          className="chart-help-popup"
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: 'auto',
            right: `${coords.right}px`,
            transform: 'translateY(-100%)', // Move up by 100% of its height
            zIndex: 9999,
            margin: 0,
          }}
        >
          <div className="chart-help-header">
            <h4>{title}</h4>
            <button
              className="chart-help-close"
              onClick={(e) => {
                e.stopPropagation();
                setIsPinned(false);
                setIsOpen(false);
              }}
            >
              ×
            </button>
          </div>
          <div className="chart-help-body" style={{ fontFamily: 'inherit' }}>
            {typeof description === 'string' ? (
              <span dangerouslySetInnerHTML={{ __html: description }} />
            ) : (
              description
            )}
            {!description && <span style={{ color: 'red' }}>Missing description</span>}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div
      className={`chart-help-container ${inline ? 'inline' : 'absolute'}`}
      onMouseEnter={() => {
        if (!isPinned) setIsOpen(true);
      }}
      onMouseLeave={() => {
        if (!isPinned) setIsOpen(false);
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (isPinned) {
          setIsPinned(false);
          setIsOpen(false);
        } else {
          setIsPinned(true);
          setIsOpen(true);
        }
      }}
    >
      <button
        ref={buttonRef}
        className={`btn btn-sm chart-help-btn ${size === 'large' ? 'chart-help-btn-large' : ''} ${isOpen ? 'active' : ''}`}
        title="Toggle Explanation"
      >
        💡
      </button>
      {popup}
    </div>
  );
}
