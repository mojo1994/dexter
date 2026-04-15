import { useState, useEffect, useRef } from 'react';
import { Shield, X } from 'lucide-react';

interface DraggableToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
}

export default function DraggableToast({ message, visible, onDismiss }: DraggableToastProps) {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const toastRef = useRef<HTMLDivElement>(null);

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(onDismiss, 5000);
      return () => clearTimeout(timer);
    }
  }, [visible, onDismiss]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    startX.current = e.clientX - offset;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const newOffset = e.clientX - startX.current;
    setOffset(newOffset);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (Math.abs(offset) > 100) {
      onDismiss();
    } else {
      setOffset(0);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    startX.current = e.touches[0].clientX - offset;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const newOffset = e.touches[0].clientX - startX.current;
    setOffset(newOffset);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (Math.abs(offset) > 100) {
      onDismiss();
    } else {
      setOffset(0);
    }
  };

  if (!visible) return null;

  return (
    <div
      ref={toastRef}
      className="fixed bottom-4 right-4 z-[9999] cursor-grab active:cursor-grabbing select-none"
      style={{
        transform: `translateX(${offset}px)`,
        opacity: 1 - Math.abs(offset) / 200,
        transition: isDragging ? 'none' : 'transform 0.3s ease, opacity 0.3s ease',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-800 text-white rounded-lg shadow-lg border border-gray-700 max-w-sm">
        <Shield size={16} className="text-green-400 shrink-0" />
        <p className="text-sm">{message}</p>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="text-gray-400 hover:text-white shrink-0"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
