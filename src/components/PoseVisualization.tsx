import { useEffect, useState } from "react";

interface JointPosition {
  x: number;
  y: number;
  label: string;
}

interface Connection {
  from: number;
  to: number;
}

const PoseVisualization = ({ isAnalyzing, showResults }: { isAnalyzing: boolean; showResults: boolean }) => {
  const [animationPhase, setAnimationPhase] = useState(0);
  
  // Cricket batting pose keypoints (normalized 0-100)
  const battingPose: JointPosition[] = [
    { x: 50, y: 10, label: "Head" },        // 0
    { x: 50, y: 20, label: "Neck" },        // 1
    { x: 35, y: 25, label: "L Shoulder" },  // 2
    { x: 65, y: 25, label: "R Shoulder" },  // 3
    { x: 25, y: 40, label: "L Elbow" },     // 4
    { x: 75, y: 35, label: "R Elbow" },     // 5
    { x: 20, y: 55, label: "L Wrist" },     // 6
    { x: 85, y: 45, label: "R Wrist" },     // 7
    { x: 50, y: 45, label: "Torso" },       // 8
    { x: 40, y: 55, label: "L Hip" },       // 9
    { x: 60, y: 55, label: "R Hip" },       // 10
    { x: 35, y: 75, label: "L Knee" },      // 11
    { x: 65, y: 72, label: "R Knee" },      // 12
    { x: 30, y: 95, label: "L Ankle" },     // 13
    { x: 70, y: 92, label: "R Ankle" },     // 14
  ];

  // Follow-through pose
  const followThroughPose: JointPosition[] = [
    { x: 55, y: 12, label: "Head" },
    { x: 55, y: 22, label: "Neck" },
    { x: 45, y: 28, label: "L Shoulder" },
    { x: 70, y: 20, label: "R Shoulder" },
    { x: 35, y: 35, label: "L Elbow" },
    { x: 85, y: 15, label: "R Elbow" },
    { x: 28, y: 50, label: "L Wrist" },
    { x: 92, y: 25, label: "R Wrist" },
    { x: 55, y: 45, label: "Torso" },
    { x: 45, y: 55, label: "L Hip" },
    { x: 65, y: 55, label: "R Hip" },
    { x: 38, y: 75, label: "L Knee" },
    { x: 70, y: 70, label: "R Knee" },
    { x: 32, y: 95, label: "L Ankle" },
    { x: 75, y: 90, label: "R Ankle" },
  ];

  const connections: Connection[] = [
    { from: 0, to: 1 },   // Head to Neck
    { from: 1, to: 2 },   // Neck to L Shoulder
    { from: 1, to: 3 },   // Neck to R Shoulder
    { from: 2, to: 4 },   // L Shoulder to L Elbow
    { from: 3, to: 5 },   // R Shoulder to R Elbow
    { from: 4, to: 6 },   // L Elbow to L Wrist
    { from: 5, to: 7 },   // R Elbow to R Wrist
    { from: 1, to: 8 },   // Neck to Torso
    { from: 8, to: 9 },   // Torso to L Hip
    { from: 8, to: 10 },  // Torso to R Hip
    { from: 9, to: 11 },  // L Hip to L Knee
    { from: 10, to: 12 }, // R Hip to R Knee
    { from: 11, to: 13 }, // L Knee to L Ankle
    { from: 12, to: 14 }, // R Knee to R Ankle
    { from: 9, to: 10 },  // Hip to Hip
    { from: 2, to: 3 },   // Shoulder to Shoulder
  ];

  // Bat connections (from right wrist through left wrist extended)
  const batStart = { x: 20, y: 55 };
  const batEnd = { x: 5, y: 70 };
  const batEndFollow = { x: 95, y: 10 };

  useEffect(() => {
    if (isAnalyzing || showResults) {
      const interval = setInterval(() => {
        setAnimationPhase((prev) => (prev + 1) % 100);
      }, 50);
      return () => clearInterval(interval);
    }
  }, [isAnalyzing, showResults]);

  const interpolatePosition = (start: JointPosition, end: JointPosition, progress: number) => {
    const t = (Math.sin(progress * Math.PI * 2 / 100) + 1) / 2;
    return {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
      label: start.label,
    };
  };

  const currentPose = showResults || isAnalyzing
    ? battingPose.map((joint, i) => interpolatePosition(joint, followThroughPose[i], animationPhase))
    : battingPose;

  const currentBatEnd = showResults || isAnalyzing
    ? {
        x: batEnd.x + (batEndFollow.x - batEnd.x) * ((Math.sin(animationPhase * Math.PI * 2 / 100) + 1) / 2),
        y: batEnd.y + (batEndFollow.y - batEnd.y) * ((Math.sin(animationPhase * Math.PI * 2 / 100) + 1) / 2),
      }
    : batEnd;

  const getJointColor = (index: number) => {
    if (!showResults) return "hsl(var(--primary))";
    // Highlight areas that need improvement
    if (index === 4 || index === 5) return "hsl(var(--accent))"; // Elbows - good
    if (index === 11 || index === 12) return "#ef4444"; // Knees - needs work
    return "hsl(var(--primary))";
  };

  const getConnectionColor = (fromIndex: number, toIndex: number) => {
    if (!showResults) return "hsl(var(--primary) / 0.6)";
    if ((fromIndex === 4 && toIndex === 6) || (fromIndex === 5 && toIndex === 7)) return "hsl(var(--accent) / 0.8)";
    if ((fromIndex === 11 && toIndex === 13) || (fromIndex === 12 && toIndex === 14)) return "rgba(239, 68, 68, 0.6)";
    return "hsl(var(--primary) / 0.6)";
  };

  return (
    <div className="relative w-full aspect-[4/3] bg-gradient-to-b from-background via-card to-background rounded-2xl border border-border overflow-hidden">
      {/* Grid background */}
      <svg className="absolute inset-0 w-full h-full opacity-20">
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-primary" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Scanning effect when analyzing */}
      {isAnalyzing && (
        <div 
          className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-80"
          style={{
            top: `${(animationPhase % 100)}%`,
            boxShadow: '0 0 20px hsl(var(--primary)), 0 0 40px hsl(var(--primary))',
          }}
        />
      )}

      {/* Pose Skeleton */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        {/* Glow filter */}
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="strongGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Connection lines */}
        {connections.map((conn, i) => (
          <line
            key={`conn-${i}`}
            x1={currentPose[conn.from].x}
            y1={currentPose[conn.from].y}
            x2={currentPose[conn.to].x}
            y2={currentPose[conn.to].y}
            stroke={getConnectionColor(conn.from, conn.to)}
            strokeWidth="1.5"
            strokeLinecap="round"
            filter="url(#glow)"
            className="transition-all duration-75"
          />
        ))}

        {/* Bat */}
        <line
          x1={currentPose[6].x}
          y1={currentPose[6].y}
          x2={currentBatEnd.x}
          y2={currentBatEnd.y}
          stroke="hsl(var(--accent))"
          strokeWidth="2"
          strokeLinecap="round"
          filter="url(#strongGlow)"
          className="transition-all duration-75"
        />

        {/* Joint points */}
        {currentPose.map((joint, i) => (
          <g key={`joint-${i}`}>
            {/* Outer pulse ring for key joints */}
            {showResults && (i === 0 || i === 6 || i === 7 || i === 11 || i === 12) && (
              <circle
                cx={joint.x}
                cy={joint.y}
                r="3"
                fill="none"
                stroke={getJointColor(i)}
                strokeWidth="0.5"
                opacity={0.5}
                className="animate-ping"
              />
            )}
            {/* Main joint */}
            <circle
              cx={joint.x}
              cy={joint.y}
              r={i === 0 ? 2.5 : 1.8}
              fill={getJointColor(i)}
              filter="url(#strongGlow)"
              className="transition-all duration-75"
            />
          </g>
        ))}

        {/* Angle indicators when showing results */}
        {showResults && (
          <>
            {/* Elbow angle arc */}
            <path
              d={`M ${currentPose[3].x + 3} ${currentPose[3].y} A 3 3 0 0 1 ${currentPose[5].x - 2} ${currentPose[5].y - 2}`}
              fill="none"
              stroke="hsl(var(--accent))"
              strokeWidth="0.5"
              strokeDasharray="1,1"
            />
            <text x={currentPose[5].x + 3} y={currentPose[5].y - 3} fill="hsl(var(--accent))" fontSize="3" fontWeight="bold">
              95°
            </text>

            {/* Knee angle */}
            <text x={currentPose[12].x + 3} y={currentPose[12].y} fill="#ef4444" fontSize="3" fontWeight="bold">
              125°
            </text>
          </>
        )}
      </svg>

      {/* Labels */}
      <div className="absolute bottom-4 left-4 right-4">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-primary"></span>
            <span className="text-muted-foreground">Tracked Points</span>
          </div>
          {showResults && (
            <>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-accent"></span>
                <span className="text-muted-foreground">Good Form</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-destructive"></span>
                <span className="text-muted-foreground">Needs Work</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Status overlay */}
      {isAnalyzing && (
        <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/20 border border-primary/30">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
          <span className="text-xs text-primary font-medium">Analyzing Pose...</span>
        </div>
      )}

      {showResults && (
        <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/20 border border-accent/30">
          <div className="w-2 h-2 rounded-full bg-accent"></div>
          <span className="text-xs text-accent font-medium">17 Points Tracked</span>
        </div>
      )}
    </div>
  );
};

export default PoseVisualization;
