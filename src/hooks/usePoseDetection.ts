import { useState, useCallback, useRef } from 'react';

export interface Joint {
  name: string;
  x: number;
  y: number;
  confidence: number;
}

export interface Angle {
  name: string;
  value: number;
}

export interface PoseFrame {
  timestamp: number;
  joints: Joint[];
  angles: Angle[];
}

// Joint connections for drawing skeleton
export const POSE_CONNECTIONS = [
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_ankle'],
];

// Calculate angle between three points
function calculateAngle(p1: Joint, p2: Joint, p3: Joint): number {
  const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
  let degrees = Math.abs(radians * 180 / Math.PI);
  if (degrees > 180) degrees = 360 - degrees;
  return Math.round(degrees);
}

// Simulate pose detection (in production, this would use MediaPipe or similar)
function simulatePoseDetection(): { joints: Joint[], angles: Angle[] } {
  // Cricket batting pose simulation with realistic joint positions
  const baseJoints: Joint[] = [
    { name: 'nose', x: 0.5 + (Math.random() - 0.5) * 0.02, y: 0.15 + (Math.random() - 0.5) * 0.01, confidence: 0.95 },
    { name: 'left_shoulder', x: 0.42 + (Math.random() - 0.5) * 0.02, y: 0.25 + (Math.random() - 0.5) * 0.01, confidence: 0.92 },
    { name: 'right_shoulder', x: 0.58 + (Math.random() - 0.5) * 0.02, y: 0.25 + (Math.random() - 0.5) * 0.01, confidence: 0.93 },
    { name: 'left_elbow', x: 0.35 + (Math.random() - 0.5) * 0.03, y: 0.38 + (Math.random() - 0.5) * 0.02, confidence: 0.88 },
    { name: 'right_elbow', x: 0.68 + (Math.random() - 0.5) * 0.03, y: 0.35 + (Math.random() - 0.5) * 0.02, confidence: 0.89 },
    { name: 'left_wrist', x: 0.30 + (Math.random() - 0.5) * 0.04, y: 0.48 + (Math.random() - 0.5) * 0.03, confidence: 0.85 },
    { name: 'right_wrist', x: 0.75 + (Math.random() - 0.5) * 0.04, y: 0.45 + (Math.random() - 0.5) * 0.03, confidence: 0.86 },
    { name: 'left_hip', x: 0.44 + (Math.random() - 0.5) * 0.02, y: 0.52 + (Math.random() - 0.5) * 0.01, confidence: 0.90 },
    { name: 'right_hip', x: 0.56 + (Math.random() - 0.5) * 0.02, y: 0.52 + (Math.random() - 0.5) * 0.01, confidence: 0.91 },
    { name: 'left_knee', x: 0.42 + (Math.random() - 0.5) * 0.03, y: 0.72 + (Math.random() - 0.5) * 0.02, confidence: 0.87 },
    { name: 'right_knee', x: 0.58 + (Math.random() - 0.5) * 0.03, y: 0.72 + (Math.random() - 0.5) * 0.02, confidence: 0.88 },
    { name: 'left_ankle', x: 0.40 + (Math.random() - 0.5) * 0.03, y: 0.92 + (Math.random() - 0.5) * 0.02, confidence: 0.82 },
    { name: 'right_ankle', x: 0.60 + (Math.random() - 0.5) * 0.03, y: 0.92 + (Math.random() - 0.5) * 0.02, confidence: 0.83 },
  ];

  const getJoint = (name: string) => baseJoints.find(j => j.name === name)!;

  const angles: Angle[] = [
    { name: 'left_elbow', value: calculateAngle(getJoint('left_shoulder'), getJoint('left_elbow'), getJoint('left_wrist')) },
    { name: 'right_elbow', value: calculateAngle(getJoint('right_shoulder'), getJoint('right_elbow'), getJoint('right_wrist')) },
    { name: 'left_knee', value: calculateAngle(getJoint('left_hip'), getJoint('left_knee'), getJoint('left_ankle')) },
    { name: 'right_knee', value: calculateAngle(getJoint('right_hip'), getJoint('right_knee'), getJoint('right_ankle')) },
    { name: 'left_shoulder', value: calculateAngle(getJoint('left_hip'), getJoint('left_shoulder'), getJoint('left_elbow')) },
    { name: 'right_shoulder', value: calculateAngle(getJoint('right_hip'), getJoint('right_shoulder'), getJoint('right_elbow')) },
    { name: 'left_hip', value: calculateAngle(getJoint('left_shoulder'), getJoint('left_hip'), getJoint('left_knee')) },
    { name: 'right_hip', value: calculateAngle(getJoint('right_shoulder'), getJoint('right_hip'), getJoint('right_knee')) },
  ];

  return { joints: baseJoints, angles };
}

export function usePoseDetection() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [poseFrames, setPoseFrames] = useState<PoseFrame[]>([]);
  const [currentFrame, setCurrentFrame] = useState<PoseFrame | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const processVideo = useCallback(async (videoFile: File): Promise<PoseFrame[]> => {
    setIsProcessing(true);
    setProgress(0);
    setPoseFrames([]);

    const frames: PoseFrame[] = [];
    const totalFrames = 30; // Sample 30 frames from the video

    // Simulate processing frames
    for (let i = 0; i < totalFrames; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const { joints, angles } = simulatePoseDetection();
      const frame: PoseFrame = {
        timestamp: (i / totalFrames) * 5000, // 5 second video simulation
        joints,
        angles,
      };
      
      frames.push(frame);
      setCurrentFrame(frame);
      setProgress(((i + 1) / totalFrames) * 100);
    }

    setPoseFrames(frames);
    setIsProcessing(false);
    return frames;
  }, []);

  const reset = useCallback(() => {
    setPoseFrames([]);
    setCurrentFrame(null);
    setProgress(0);
    setIsProcessing(false);
  }, []);

  return {
    isProcessing,
    progress,
    poseFrames,
    currentFrame,
    processVideo,
    reset,
    videoRef,
  };
}
