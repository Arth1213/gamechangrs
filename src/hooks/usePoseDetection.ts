import { useState, useCallback, useRef, useEffect } from 'react';
import { Pose, Results, POSE_CONNECTIONS as MP_POSE_CONNECTIONS } from '@mediapipe/pose';

export interface Joint {
  name: string;
  x: number;
  y: number;
  z: number;
  visibility: number;
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

// MediaPipe landmark names mapping
const LANDMARK_NAMES: Record<number, string> = {
  0: 'nose',
  1: 'left_eye_inner',
  2: 'left_eye',
  3: 'left_eye_outer',
  4: 'right_eye_inner',
  5: 'right_eye',
  6: 'right_eye_outer',
  7: 'left_ear',
  8: 'right_ear',
  9: 'mouth_left',
  10: 'mouth_right',
  11: 'left_shoulder',
  12: 'right_shoulder',
  13: 'left_elbow',
  14: 'right_elbow',
  15: 'left_wrist',
  16: 'right_wrist',
  17: 'left_pinky',
  18: 'right_pinky',
  19: 'left_index',
  20: 'right_index',
  21: 'left_thumb',
  22: 'right_thumb',
  23: 'left_hip',
  24: 'right_hip',
  25: 'left_knee',
  26: 'right_knee',
  27: 'left_ankle',
  28: 'right_ankle',
  29: 'left_heel',
  30: 'right_heel',
  31: 'left_foot_index',
  32: 'right_foot_index',
};

const REQUIRED_CORE_LANDMARKS = [
  'nose',
  'left_shoulder',
  'right_shoulder',
  'left_hip',
  'right_hip',
  'left_wrist',
  'right_wrist',
  'left_ankle',
  'right_ankle',
] as const;

const REQUIRED_UPPER_BODY_LANDMARKS = [
  'nose',
  'left_shoulder',
  'right_shoulder',
  'left_hip',
  'right_hip',
  'left_wrist',
  'right_wrist',
] as const;

// Calculate angle between three points using law of cosines
function calculateAngle(p1: Joint, p2: Joint, p3: Joint): number {
  const ab = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  const bc = Math.sqrt(Math.pow(p2.x - p3.x, 2) + Math.pow(p2.y - p3.y, 2));
  const ac = Math.sqrt(Math.pow(p3.x - p1.x, 2) + Math.pow(p3.y - p1.y, 2));
  
  if (ab === 0 || bc === 0) return 0;
  
  const cosAngle = (Math.pow(ab, 2) + Math.pow(bc, 2) - Math.pow(ac, 2)) / (2 * ab * bc);
  const clampedCos = Math.max(-1, Math.min(1, cosAngle));
  const angle = Math.acos(clampedCos) * (180 / Math.PI);
  
  return Math.round(angle);
}

// Convert MediaPipe landmarks to our Joint format
function landmarksToJoints(landmarks: Results['poseLandmarks']): Joint[] {
  if (!landmarks) return [];
  
  return landmarks.map((landmark, index) => ({
    name: LANDMARK_NAMES[index] || `landmark_${index}`,
    x: landmark.x,
    y: landmark.y,
    z: landmark.z || 0,
    visibility: landmark.visibility || 0,
  }));
}

function hasReliableCoreLandmarks(joints: Joint[]) {
  const visibleCore = REQUIRED_CORE_LANDMARKS
    .map((name) => joints.find((joint) => joint.name === name))
    .filter((joint): joint is Joint => Boolean(joint) && joint.visibility >= 0.45);

  const visibleUpperBody = REQUIRED_UPPER_BODY_LANDMARKS
    .map((name) => joints.find((joint) => joint.name === name))
    .filter((joint): joint is Joint => Boolean(joint) && joint.visibility >= 0.45);

  return visibleCore.length >= 7 || visibleUpperBody.length >= REQUIRED_UPPER_BODY_LANDMARKS.length;
}

// Calculate cricket-relevant angles from joints
function calculateCricketAngles(joints: Joint[]): Angle[] {
  const getJoint = (name: string) => joints.find(j => j.name === name);
  const angles: Angle[] = [];
  
  // Left elbow angle (shoulder-elbow-wrist)
  const leftShoulder = getJoint('left_shoulder');
  const leftElbow = getJoint('left_elbow');
  const leftWrist = getJoint('left_wrist');
  if (leftShoulder && leftElbow && leftWrist) {
    angles.push({ name: 'left_elbow', value: calculateAngle(leftShoulder, leftElbow, leftWrist) });
  }
  
  // Right elbow angle
  const rightShoulder = getJoint('right_shoulder');
  const rightElbow = getJoint('right_elbow');
  const rightWrist = getJoint('right_wrist');
  if (rightShoulder && rightElbow && rightWrist) {
    angles.push({ name: 'right_elbow', value: calculateAngle(rightShoulder, rightElbow, rightWrist) });
  }
  
  // Left knee angle (hip-knee-ankle)
  const leftHip = getJoint('left_hip');
  const leftKnee = getJoint('left_knee');
  const leftAnkle = getJoint('left_ankle');
  if (leftHip && leftKnee && leftAnkle) {
    angles.push({ name: 'left_knee', value: calculateAngle(leftHip, leftKnee, leftAnkle) });
  }
  
  // Right knee angle
  const rightHip = getJoint('right_hip');
  const rightKnee = getJoint('right_knee');
  const rightAnkle = getJoint('right_ankle');
  if (rightHip && rightKnee && rightAnkle) {
    angles.push({ name: 'right_knee', value: calculateAngle(rightHip, rightKnee, rightAnkle) });
  }
  
  // Left shoulder angle (hip-shoulder-elbow)
  if (leftHip && leftShoulder && leftElbow) {
    angles.push({ name: 'left_shoulder', value: calculateAngle(leftHip, leftShoulder, leftElbow) });
  }
  
  // Right shoulder angle
  if (rightHip && rightShoulder && rightElbow) {
    angles.push({ name: 'right_shoulder', value: calculateAngle(rightHip, rightShoulder, rightElbow) });
  }
  
  // Left hip angle (shoulder-hip-knee)
  if (leftShoulder && leftHip && leftKnee) {
    angles.push({ name: 'left_hip', value: calculateAngle(leftShoulder, leftHip, leftKnee) });
  }
  
  // Right hip angle
  if (rightShoulder && rightHip && rightKnee) {
    angles.push({ name: 'right_hip', value: calculateAngle(rightShoulder, rightHip, rightKnee) });
  }
  
  // Backlift angle (for batting) - angle of wrist relative to shoulder
  if (rightShoulder && rightElbow && rightWrist) {
    angles.push({ name: 'backlift', value: calculateAngle(rightShoulder, rightElbow, rightWrist) });
  }
  
  // Trunk angle (shoulder-hip vertical alignment)
  if (leftShoulder && rightShoulder && leftHip && rightHip) {
    const midShoulder = { 
      name: 'mid_shoulder', 
      x: (leftShoulder.x + rightShoulder.x) / 2, 
      y: (leftShoulder.y + rightShoulder.y) / 2,
      z: 0,
      visibility: 1 
    };
    const midHip = { 
      name: 'mid_hip', 
      x: (leftHip.x + rightHip.x) / 2, 
      y: (leftHip.y + rightHip.y) / 2,
      z: 0,
      visibility: 1 
    };
    // Vertical reference point
    const verticalRef = { ...midShoulder, y: midHip.y, name: 'vertical_ref' };
    angles.push({ name: 'trunk_lean', value: calculateAngle(verticalRef, midHip, midShoulder) });
  }
  
  return angles;
}

export function usePoseDetection() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [poseFrames, setPoseFrames] = useState<PoseFrame[]>([]);
  const [currentFrame, setCurrentFrame] = useState<PoseFrame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const poseRef = useRef<Pose | null>(null);
  const resultResolverRef = useRef<((results: Results) => void) | null>(null);
  const frameCacheRef = useRef(new Map<string, PoseFrame[]>());
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Initialize MediaPipe Pose
  useEffect(() => {
    const initPose = async () => {
      try {
        const pose = new Pose({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
          },
        });

        pose.setOptions({
          staticImageMode: true,
          modelComplexity: 2,
          smoothLandmarks: false,
          enableSegmentation: false,
          smoothSegmentation: false,
          minDetectionConfidence: 0.65,
          minTrackingConfidence: 0.65,
        });

        pose.onResults((result) => {
          if (resultResolverRef.current) {
            resultResolverRef.current(result);
            resultResolverRef.current = null;
          }
        });

        await pose.initialize();
        poseRef.current = pose;
      } catch (err) {
        console.error('Failed to initialize MediaPipe Pose:', err);
        setError('Failed to initialize pose detection.');
      }
    };

    initPose();

    return () => {
      if (poseRef.current) {
        poseRef.current.close();
      }
    };
  }, []);

  const processVideo = useCallback(async (videoFile: File): Promise<PoseFrame[]> => {
    const cacheKey = [
      videoFile.name,
      videoFile.size,
      videoFile.lastModified,
      videoFile.type,
    ].join(":");

    const cachedFrames = frameCacheRef.current.get(cacheKey);
    if (cachedFrames) {
      setPoseFrames(cachedFrames);
      setCurrentFrame(cachedFrames.find((frame) => frame.joints.length > 0) ?? cachedFrames[cachedFrames.length - 1] ?? null);
      setProgress(100);
      setIsProcessing(false);
      setError(null);
      return cachedFrames;
    }

    setIsProcessing(true);
    setProgress(0);
    setPoseFrames([]);
    setError(null);

    const frames: PoseFrame[] = [];

    try {
      if (!poseRef.current) {
        throw new Error('Pose model is not ready yet');
      }

      // Create video element for processing
      const video = document.createElement('video');
      video.src = URL.createObjectURL(videoFile);
      video.muted = true;
      video.playsInline = true;
      
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Failed to load video'));
      });

      const duration = video.duration;
      const totalFrames = Math.min(Math.max(Math.round(duration * 4.5), 28), 60);
      const frameInterval = duration / totalFrames;

      // Create canvas for frame extraction
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Failed to create canvas context');
      }

      // Process frames
      for (let i = 0; i < totalFrames; i++) {
        const timestamp = i * frameInterval * 1000;
        
        // Seek to frame position
        await new Promise<void>((resolve) => {
          video.currentTime = i * frameInterval;
          video.onseeked = () => resolve();
        });

        // Draw frame to canvas
        ctx.drawImage(video, 0, 0);

        let joints: Joint[] = [];
        let angles: Angle[] = [];

        try {
          const results = await new Promise<Results>((resolve, reject) => {
            resultResolverRef.current = resolve;
            poseRef.current!
              .send({ image: canvas })
              .catch((sendError) => {
                resultResolverRef.current = null;
                reject(sendError);
              });
          });

          if (results.poseLandmarks) {
            const nextJoints = landmarksToJoints(results.poseLandmarks);
            if (hasReliableCoreLandmarks(nextJoints)) {
              joints = nextJoints;
              angles = calculateCricketAngles(joints);
            }
          }
        } catch (err) {
          console.warn('Pose detection failed for frame', i, err);
        }

        const frame: PoseFrame = { timestamp, joints, angles };
        frames.push(frame);
        setCurrentFrame(frame);
        setProgress(((i + 1) / totalFrames) * 100);
      }

      // Cleanup
      URL.revokeObjectURL(video.src);

      const validFrames = frames.filter((frame) => frame.joints.length > 0);
      if (validFrames.length === 0) {
        const weakFrames = frames.filter((frame) => frame.joints.length > 0 || frame.angles.length > 0);
        if (weakFrames.length > 0) {
          throw new Error('The batter was only partially visible in this clip. Try a closer front-on view with the full body visible and avoid recording a video off another screen.');
        }
        throw new Error('The batter could not be isolated clearly enough from this clip. Try a front-on 15-20 second batting video with the whole body in frame.');
      }
      
      setPoseFrames(frames);
      frameCacheRef.current.set(cacheKey, frames);
      setIsProcessing(false);
      return frames;
    } catch (err) {
      console.error('Video processing error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process video');
      setIsProcessing(false);
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setPoseFrames([]);
    setCurrentFrame(null);
    setProgress(0);
    setIsProcessing(false);
    setError(null);
  }, []);

  return {
    isProcessing,
    progress,
    poseFrames,
    currentFrame,
    processVideo,
    reset,
    videoRef,
    error,
  };
}
