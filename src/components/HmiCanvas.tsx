import React, { useEffect, useRef } from 'react';

interface Issue {
  x: number;
  y: number;
  w: number;
  h: number;
  category: string;
  severity: 'high' | 'medium' | 'low';
  issue: string;
  recommendation: string;
  standard_ref: string;
}

interface HmiCanvasProps {
  imageSrc: string | null;
  issues: Issue[];
  selectedIssueIndex: number | null;
  onSelectIssue: (index: number | null) => void;
}

export const HmiCanvas: React.FC<HmiCanvasProps> = ({
  imageSrc,
  issues,
  selectedIssueIndex,
  onSelectIssue,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!imageSrc || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Overlay bounding boxes for issues
      issues.forEach((issue, index) => {
        const isSelected = selectedIssueIndex === index;
        const x = (issue.x / 100) * img.width;
        const y = (issue.y / 100) * img.height;
        const w = (issue.w / 100) * img.width;
        const h = (issue.h / 100) * img.height;

        let strokeColor = 'rgba(240, 165, 0, 0.9)'; // medium/amber
        let fillColor = 'rgba(240, 165, 0, 0.15)';

        if (issue.severity === 'high') {
          strokeColor = 'rgba(226, 80, 74, 0.9)';
          fillColor = 'rgba(226, 80, 74, 0.2)';
        } else if (issue.severity === 'low') {
          strokeColor = 'rgba(63, 184, 166, 0.9)';
          fillColor = 'rgba(63, 184, 166, 0.15)';
        }

        ctx.fillStyle = fillColor;
        ctx.fillRect(x, y, w, h);

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = isSelected ? 4 : 2;
        ctx.setLineDash(isSelected ? [] : [6, 4]);
        ctx.strokeRect(x, y, w, h);

        // Draw issue number tag
        ctx.fillStyle = strokeColor;
        ctx.fillRect(x, Math.max(0, y - 20), 24, 20);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${index + 1}`, x + 12, Math.max(14, y - 5));
      });
    };
  }, [imageSrc, issues, selectedIssueIndex]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || issues.length === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    const clickedIndex = issues.findIndex((issue) => {
      const x = (issue.x / 100) * canvasRef.current!.width;
      const y = (issue.y / 100) * canvasRef.current!.height;
      const w = (issue.w / 100) * canvasRef.current!.width;
      const h = (issue.h / 100) * canvasRef.current!.height;
      return clickX >= x && clickX <= x + w && clickY >= y && clickY <= y + h;
    });

    onSelectIssue(clickedIndex !== -1 ? clickedIndex : null);
  };

  if (!imageSrc) {
    return (
      <div style={{
        height: '420px',
        border: '2px dashed var(--line)',
        borderRadius: 'var(--radius)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--muted)',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <p>No HMI Screenshot Uploaded</p>
        <span style={{ fontSize: '11px' }}>Drag & drop an image or click Browse to start audit</span>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', overflow: 'auto', background: '#000', borderRadius: 'var(--radius)', border: '1px solid var(--line)' }}>
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={{ display: 'block', width: '100%', height: 'auto', cursor: 'pointer' }}
      />
    </div>
  );
};
