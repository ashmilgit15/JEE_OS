'use client';

import { useRef, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Paintbrush, Eraser, Trash2, X } from 'lucide-react';

// Floating rough-work canvas for the test taker. A high-DPI 2D canvas with
// pen/eraser tools. Extracted from tests/page.tsx — self-contained, the only
// prop is the close callback.
export function Scratchpad({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const color = '#a78bfa'; // Primary color (violet-400)
  const lineWidth = 3;
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const lastX = useRef(0);
  const lastY = useRef(0);

  // Initialize canvas size and scale for high-DPI screens
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.strokeStyle = color;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = lineWidth;
  }, [color, lineWidth]);

  // Handle drawing events
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    lastX.current = clientX - rect.left;
    lastY.current = clientY - rect.top;
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();

    let clientX, clientY;
    if ('touches' in e) {
      if (e.cancelable) e.preventDefault();
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const currentX = clientX - rect.left;
    const currentY = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(lastX.current, lastY.current);
    ctx.lineTo(currentX, currentY);

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = 20;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
    }

    ctx.stroke();

    lastX.current = currentX;
    lastY.current = currentY;
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <Card className="fixed bottom-4 right-4 z-40 w-80 h-96 bg-zinc-900/95 border border-border shadow-2xl flex flex-col">
      <CardHeader className="p-3 border-b border-border/50 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
          <Paintbrush className="h-3.5 w-3.5 text-primary" /> Scratchpad
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            size="icon-xs"
            variant={tool === 'pen' ? 'default' : 'ghost'}
            onClick={() => setTool('pen')}
            title="Pen"
            aria-label="Pen tool"
          >
            <Paintbrush className="h-3 w-3" aria-hidden="true" />
          </Button>
          <Button
            size="icon-xs"
            variant={tool === 'eraser' ? 'default' : 'ghost'}
            onClick={() => setTool('eraser')}
            title="Eraser"
            aria-label="Eraser tool"
          >
            <Eraser className="h-3 w-3" aria-hidden="true" />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={clearCanvas}
            title="Clear All"
            aria-label="Clear scratchpad"
            className="text-red-400 hover:text-red-300"
          >
            <Trash2 className="h-3 w-3" aria-hidden="true" />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={onClose}
            title="Close"
            aria-label="Close scratchpad"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 relative overflow-hidden bg-zinc-950/40">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
        />
      </CardContent>
    </Card>
  );
}
