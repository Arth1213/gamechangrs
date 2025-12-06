import { useEffect, useRef } from 'react';
import { Joint, POSE_CONNECTIONS } from '@/hooks/usePoseDetection';

interface PoseOverlayProps {
  joints: Joint[];
  width: number;
  height: number;
  highlightedJoints?: string[];
}

export function PoseOverlay({ joints, width, height, highlightedJoints = [] }: PoseOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // Draw connections
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.8)';
    ctx.lineWidth = 3;

    POSE_CONNECTIONS.forEach(([start, end]) => {
      const startJoint = joints.find(j => j.name === start);
      const endJoint = joints.find(j => j.name === end);

      if (startJoint && endJoint) {
        const isHighlighted = highlightedJoints.includes(start) || highlightedJoints.includes(end);
        ctx.strokeStyle = isHighlighted 
          ? 'rgba(239, 68, 68, 0.9)' 
          : 'rgba(34, 197, 94, 0.8)';

        ctx.beginPath();
        ctx.moveTo(startJoint.x * width, startJoint.y * height);
        ctx.lineTo(endJoint.x * width, endJoint.y * height);
        ctx.stroke();
      }
    });

    // Draw joints
    joints.forEach(joint => {
      const x = joint.x * width;
      const y = joint.y * height;
      const isHighlighted = highlightedJoints.includes(joint.name);
      const radius = isHighlighted ? 8 : 6;

      // Outer glow
      ctx.beginPath();
      ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
      ctx.fillStyle = isHighlighted 
        ? 'rgba(239, 68, 68, 0.3)' 
        : 'rgba(34, 197, 94, 0.3)';
      ctx.fill();

      // Main circle
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isHighlighted 
        ? 'rgba(239, 68, 68, 1)' 
        : 'rgba(34, 197, 94, 1)';
      ctx.fill();

      // Inner highlight
      ctx.beginPath();
      ctx.arc(x - 2, y - 2, radius / 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fill();
    });

  }, [joints, width, height, highlightedJoints]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none"
    />
  );
}
