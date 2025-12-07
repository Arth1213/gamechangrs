import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, Play, Video, Ruler, Clock, Target, Trophy, Medal,
  MessageSquare, Dumbbell, CheckCircle, AlertTriangle, XCircle, 
  Lightbulb, Download, BarChart3, X, Eye, EyeOff
} from 'lucide-react';
import { Pose, Results } from '@mediapipe/pose';
import { toast } from 'sonner';

type AnalysisMode = 'batting' | 'bowling';

interface FeedbackItem {
  type: 'positive' | 'warning' | 'critical';
  title: string;
  description: string;
  drill: string | null;
}

interface DrillItem {
  icon: 'dumbbell' | 'scale' | 'activity';
  title: string;
  description: string;
  color: 'green' | 'blue' | 'purple';
}

interface AnalysisData {
  currentMode: AnalysisMode;
  videoDuration: string;
  angles: {
    elbow: number;
    knee: number;
    shoulder: number;
    head: number;
  };
  scores: {
    overall: number;
    technique: number;
    balance: number;
    timing: number;
    followThrough: number;
  };
  feedback: FeedbackItem[];
  drills: DrillItem[];
}

const BATTING_FEEDBACK: FeedbackItem[] = [
  {
    type: 'positive',
    title: 'Excellent Head Position',
    description: 'Head remains still and eyes level throughout the shot. Perfect for tracking the ball.',
    drill: null
  },
  {
    type: 'warning',
    title: 'Back Leg Alignment',
    description: 'Back knee angle exceeds optimal range (165° vs optimal 160-175°). Affects weight transfer and power generation.',
    drill: 'Practice with back foot against wall to maintain optimal bend'
  },
  {
    type: 'critical',
    title: 'Shoulder Tilt Issue',
    description: 'Excessive shoulder tilt (12°) causing off-balance during follow-through. Reduces shot consistency.',
    drill: 'Focus on keeping shoulders level through the shot'
  },
  {
    type: 'positive',
    title: 'Good Bat Path',
    description: 'Straight bat path with minimal deviation. Excellent for playing straight drives.',
    drill: null
  }
];

const BOWLING_FEEDBACK: FeedbackItem[] = [
  {
    type: 'positive',
    title: 'Good Run-up Rhythm',
    description: 'Consistent approach speed with proper acceleration pattern.',
    drill: null
  },
  {
    type: 'warning',
    title: 'Front Foot Landing',
    description: 'Front foot lands slightly across the crease (5° off optimal alignment).',
    drill: 'Practice landing drills with alignment markers'
  },
  {
    type: 'critical',
    title: 'Arm Speed Variation',
    description: 'Inconsistent arm speed during delivery affecting ball release timing.',
    drill: 'Focus on maintaining consistent arm speed through delivery'
  },
  {
    type: 'positive',
    title: 'Excellent Follow-through',
    description: 'Good momentum transfer and balanced finish position.',
    drill: null
  }
];

const BATTING_DRILLS: DrillItem[] = [
  { icon: 'dumbbell', title: 'Back Foot Stability Drill', description: '3 sets × 10 reps daily', color: 'green' },
  { icon: 'scale', title: 'Shoulder Alignment Exercise', description: '2 sets × 15 reps daily', color: 'blue' },
  { icon: 'activity', title: 'Follow-through Practice', description: '5 minutes shadow batting', color: 'purple' }
];

const BOWLING_DRILLS: DrillItem[] = [
  { icon: 'activity', title: 'Approach Rhythm Drill', description: '5 × 20m sprints with markers', color: 'green' },
  { icon: 'dumbbell', title: 'Front Foot Landing Practice', description: '3 sets × 10 deliveries', color: 'blue' },
  { icon: 'scale', title: 'Arm Speed Consistency', description: '2 sets × 15 medicine ball throws', color: 'purple' }
];

function calculateAngle(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }): number {
  const ab = Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
  const bc = Math.sqrt(Math.pow(b.x - c.x, 2) + Math.pow(b.y - c.y, 2));
  const ac = Math.sqrt(Math.pow(c.x - a.x, 2) + Math.pow(c.y - a.y, 2));
  
  if (ab === 0 || bc === 0) return 0;
  const cosAngle = (Math.pow(ab, 2) + Math.pow(bc, 2) - Math.pow(ac, 2)) / (2 * ab * bc);
  const clampedCos = Math.max(-1, Math.min(1, cosAngle));
  return Math.round(Math.acos(clampedCos) * (180 / Math.PI));
}

export function TechniqueAI() {
  const [analysisData, setAnalysisData] = useState<AnalysisData>({
    currentMode: 'batting',
    videoDuration: '0:00',
    angles: { elbow: 145, knee: 165, shoulder: 12, head: 3 },
    scores: { overall: 0, technique: 0, balance: 0, timing: 0, followThrough: 0 },
    feedback: [],
    drills: []
  });

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [poseOverlayVisible, setPoseOverlayVisible] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [poseModel, setPoseModel] = useState<Pose | null>(null);
  const [poseError, setPoseError] = useState<string | null>(null);
  const [isLoadingPose, setIsLoadingPose] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef = useRef<Pose | null>(null);
  const analysisAnglesRef = useRef<{ elbow: number[]; knee: number[]; shoulder: number[]; head: number[] }>({
    elbow: [], knee: [], shoulder: [], head: []
  });

  // Initialize MediaPipe Pose
  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;

    const initPose = async (): Promise<boolean> => {
      try {
        setIsLoadingPose(true);
        setPoseError(null);

        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) {
          throw new Error('WebGL not supported');
        }

        const pose = new Pose({
          locateFile: (file) => `https://unpkg.com/@mediapipe/pose@0.5.1675469404/${file}`,
        });

        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          smoothSegmentation: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        const initPromise = pose.initialize();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Initialization timeout')), 30000)
        );

        await Promise.race([initPromise, timeoutPromise]);

        if (isMounted) {
          poseRef.current = pose;
          setPoseModel(pose);
          setIsLoadingPose(false);
          console.log('MediaPipe Pose initialized successfully');
        }
        return true;
      } catch (error) {
        console.error(`Failed to initialize MediaPipe Pose (attempt ${retryCount + 1}):`, error);
        return false;
      }
    };

    const attemptInit = async () => {
      while (retryCount < maxRetries && isMounted) {
        const success = await initPose();
        if (success) return;

        retryCount++;
        if (retryCount < maxRetries && isMounted) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (isMounted && !poseRef.current) {
        setPoseError('Failed to load pose detection. Please refresh or try Chrome/Edge.');
        setIsLoadingPose(false);
      }
    };

    attemptInit();

    return () => {
      isMounted = false;
      if (poseRef.current) {
        poseRef.current.close();
      }
    };
  }, []);

  const onPoseResults = useCallback((results: Results) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.poseLandmarks && poseOverlayVisible) {
      // Draw connections
      const connections = [
        [11, 13], [13, 15], // Left arm
        [12, 14], [14, 16], // Right arm
        [11, 12], // Shoulders
        [11, 23], [12, 24], // Torso
        [23, 24], // Hips
        [23, 25], [25, 27], // Left leg
        [24, 26], [26, 28], // Right leg
      ];

      ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
      ctx.lineWidth = 3;

      connections.forEach(([start, end]) => {
        const startPoint = results.poseLandmarks[start];
        const endPoint = results.poseLandmarks[end];
        if (startPoint && endPoint) {
          ctx.beginPath();
          ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height);
          ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height);
          ctx.stroke();
        }
      });

      // Draw landmarks
      results.poseLandmarks.forEach((landmark, index) => {
        const x = landmark.x * canvas.width;
        const y = landmark.y * canvas.height;

        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = index < 11 ? '#10B981' : '#3B82F6';
        ctx.fill();
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Calculate angles
      const landmarks = results.poseLandmarks;
      
      // Elbow angle (shoulder-elbow-wrist)
      const elbowAngle = calculateAngle(
        { x: landmarks[11].x, y: landmarks[11].y },
        { x: landmarks[13].x, y: landmarks[13].y },
        { x: landmarks[15].x, y: landmarks[15].y }
      );

      // Knee angle (hip-knee-ankle)
      const kneeAngle = calculateAngle(
        { x: landmarks[23].x, y: landmarks[23].y },
        { x: landmarks[25].x, y: landmarks[25].y },
        { x: landmarks[27].x, y: landmarks[27].y }
      );

      // Shoulder angle
      const shoulderAngle = Math.abs(
        Math.atan2(landmarks[12].y - landmarks[11].y, landmarks[12].x - landmarks[11].x) * (180 / Math.PI)
      );

      // Head angle (nose relative to shoulders)
      const headAngle = Math.abs(
        Math.atan2(landmarks[0].y - (landmarks[11].y + landmarks[12].y) / 2, 
                   landmarks[0].x - (landmarks[11].x + landmarks[12].x) / 2) * (180 / Math.PI) - 90
      );

      analysisAnglesRef.current.elbow.push(elbowAngle);
      analysisAnglesRef.current.knee.push(kneeAngle);
      analysisAnglesRef.current.shoulder.push(shoulderAngle);
      analysisAnglesRef.current.head.push(headAngle);

      setAnalysisData(prev => ({
        ...prev,
        angles: {
          elbow: Math.round(elbowAngle),
          knee: Math.round(kneeAngle),
          shoulder: Math.round(shoulderAngle),
          head: Math.round(headAngle)
        }
      }));
    }
  }, [poseOverlayVisible]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      const url = URL.createObjectURL(file);
      setVideoFile(file);
      setVideoUrl(url);
      setShowUploadModal(false);
      setShowResults(false);
    }
  };

  const handleVideoLoad = () => {
    if (videoRef.current && canvasRef.current) {
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      
      const duration = videoRef.current.duration;
      const minutes = Math.floor(duration / 60);
      const seconds = Math.floor(duration % 60);
      setAnalysisData(prev => ({
        ...prev,
        videoDuration: `${minutes}:${seconds.toString().padStart(2, '0')}`
      }));
    }
  };

  const analyzeVideo = async () => {
    if (!videoRef.current || !poseModel) {
      toast.error('Video or pose model not ready');
      return;
    }

    try {
      poseModel.onResults(onPoseResults);
      setIsAnalyzing(true);
      setShowResults(false);
      setPoseOverlayVisible(true);
      analysisAnglesRef.current = { elbow: [], knee: [], shoulder: [], head: [] };

      const video = videoRef.current;
      video.currentTime = 0;

      await new Promise<void>((resolve) => {
        const onCanPlay = () => {
          video.removeEventListener('canplay', onCanPlay);
          resolve();
        };
        if (video.readyState >= 3) resolve();
        else video.addEventListener('canplay', onCanPlay);
      });

      await video.play();

      let frameCount = 0;
      const maxFrames = 300;

      const processFrame = async () => {
        try {
          if (video.paused || video.ended || frameCount >= maxFrames) {
            generateResults();
            setIsAnalyzing(false);
            setShowResults(true);
            video.pause();
            return;
          }

          frameCount++;
          await poseModel.send({ image: video });
          requestAnimationFrame(processFrame);
        } catch (error) {
          console.error('Frame processing error:', error);
          requestAnimationFrame(processFrame);
        }
      };

      processFrame();
    } catch (error) {
      console.error('Analysis error:', error);
      setIsAnalyzing(false);
      toast.error('Failed to analyze video. Please try again.');
    }
  };

  const generateResults = () => {
    const angles = analysisAnglesRef.current;
    
    const avgElbow = angles.elbow.length > 0 ? angles.elbow.reduce((a, b) => a + b, 0) / angles.elbow.length : 145;
    const avgKnee = angles.knee.length > 0 ? angles.knee.reduce((a, b) => a + b, 0) / angles.knee.length : 165;
    const avgShoulder = angles.shoulder.length > 0 ? angles.shoulder.reduce((a, b) => a + b, 0) / angles.shoulder.length : 12;
    const avgHead = angles.head.length > 0 ? angles.head.reduce((a, b) => a + b, 0) / angles.head.length : 3;

    // Calculate scores based on optimal ranges
    const elbowScore = avgElbow >= 140 && avgElbow <= 160 ? 90 : avgElbow >= 130 && avgElbow <= 170 ? 75 : 60;
    const kneeScore = avgKnee >= 160 && avgKnee <= 175 ? 90 : avgKnee >= 150 && avgKnee <= 180 ? 75 : 60;
    const shoulderScore = avgShoulder < 5 ? 95 : avgShoulder < 10 ? 80 : avgShoulder < 15 ? 65 : 50;
    const headScore = avgHead < 5 ? 95 : avgHead < 10 ? 80 : 65;

    const overallScore = Math.round((elbowScore + kneeScore + shoulderScore + headScore) / 4);

    const isBatting = analysisData.currentMode === 'batting';
    
    setAnalysisData(prev => ({
      ...prev,
      angles: {
        elbow: Math.round(avgElbow),
        knee: Math.round(avgKnee),
        shoulder: Math.round(avgShoulder),
        head: Math.round(avgHead)
      },
      scores: {
        overall: overallScore,
        technique: Math.round((elbowScore + kneeScore) / 2),
        balance: shoulderScore,
        timing: Math.round((elbowScore + headScore) / 2),
        followThrough: kneeScore
      },
      feedback: isBatting ? BATTING_FEEDBACK : BOWLING_FEEDBACK,
      drills: isBatting ? BATTING_DRILLS : BOWLING_DRILLS
    }));
  };

  const switchMode = (mode: AnalysisMode) => {
    setAnalysisData(prev => ({
      ...prev,
      currentMode: mode,
      feedback: mode === 'batting' ? BATTING_FEEDBACK : BOWLING_FEEDBACK,
      drills: mode === 'batting' ? BATTING_DRILLS : BOWLING_DRILLS
    }));
  };

  const downloadReport = () => {
    toast.info('Generating PDF report with comprehensive analysis...');
  };

  const getAngleColor = (value: number, optimal: { min: number; max: number }) => {
    if (value >= optimal.min && value <= optimal.max) return 'text-primary';
    if (value >= optimal.min - 10 && value <= optimal.max + 10) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getAngleProgress = (value: number, optimal: { min: number; max: number }) => {
    const mid = (optimal.min + optimal.max) / 2;
    const range = optimal.max - optimal.min;
    const diff = Math.abs(value - mid);
    return Math.max(0, Math.min(100, 100 - (diff / range) * 100));
  };

  const getScoreRingOffset = (score: number) => {
    const circumference = 2 * Math.PI * 45;
    return circumference - (score / 100) * circumference;
  };

  const getFeedbackIcon = (type: FeedbackItem['type']) => {
    switch (type) {
      case 'positive': return <CheckCircle className="w-4 h-4 text-primary" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'critical': return <XCircle className="w-4 h-4 text-red-400" />;
    }
  };

  const getFeedbackBgColor = (type: FeedbackItem['type']) => {
    switch (type) {
      case 'positive': return 'bg-primary/10';
      case 'warning': return 'bg-yellow-400/10';
      case 'critical': return 'bg-red-400/10';
    }
  };

  const getDrillIcon = (icon: DrillItem['icon']) => {
    switch (icon) {
      case 'dumbbell': return <Dumbbell className="w-5 h-5" />;
      case 'scale': return <Target className="w-5 h-5" />;
      case 'activity': return <Play className="w-5 h-5" />;
    }
  };

  const getDrillColor = (color: DrillItem['color']) => {
    switch (color) {
      case 'green': return 'bg-primary/20 text-primary';
      case 'blue': return 'bg-blue-400/20 text-blue-400';
      case 'purple': return 'bg-purple-400/20 text-purple-400';
    }
  };

  return (
    <div className="space-y-8">
      {/* Mode Toggle & Upload */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant={analysisData.currentMode === 'batting' ? 'default' : 'outline'}
            onClick={() => switchMode('batting')}
            className="gap-2"
          >
            <Target className="w-4 h-4" />
            Batting
          </Button>
          <Button
            variant={analysisData.currentMode === 'bowling' ? 'default' : 'outline'}
            onClick={() => switchMode('bowling')}
            className="gap-2"
          >
            <Play className="w-4 h-4" />
            Bowling
          </Button>
        </div>

        <Button
          onClick={() => setShowUploadModal(true)}
          className="bg-gradient-primary hover:opacity-90 gap-2"
        >
          <Upload className="w-4 h-4" />
          Analyze Video
        </Button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Video and Analysis */}
        <div className="lg:col-span-2 space-y-6">
          {/* Video Section */}
          <div className="bg-gradient-card rounded-2xl p-6 border border-border">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-3">
                <Video className="w-5 h-5 text-primary" />
                Video Analysis
              </h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1.5 bg-secondary rounded-full text-sm text-muted-foreground">
                  {analysisData.currentMode.charAt(0).toUpperCase() + analysisData.currentMode.slice(1)} Mode
                </span>
                {videoUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPoseOverlayVisible(!poseOverlayVisible)}
                    className="gap-2"
                  >
                    {poseOverlayVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    Landmarks
                  </Button>
                )}
              </div>
            </div>

            <div className="relative rounded-xl overflow-hidden bg-secondary/50">
              {!videoUrl ? (
                <div className="aspect-video flex flex-col items-center justify-center">
                  <div className="w-24 h-24 bg-secondary rounded-full flex items-center justify-center mb-6">
                    <Upload className="w-10 h-10 text-primary" />
                  </div>
                  <p className="text-xl font-semibold mb-2">Upload Your Cricket Video</p>
                  <p className="text-muted-foreground mb-6">Supports .mp4, .mov, .avi up to 100MB</p>
                  <Button onClick={() => setShowUploadModal(true)} className="bg-gradient-primary gap-2">
                    <Upload className="w-4 h-4" />
                    Choose Video File
                  </Button>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    className="w-full"
                    controls
                    onLoadedMetadata={handleVideoLoad}
                  />
                  <canvas
                    ref={canvasRef}
                    className="absolute top-0 left-0 w-full h-full pointer-events-none"
                    style={{ display: poseOverlayVisible ? 'block' : 'none' }}
                  />
                </>
              )}
            </div>

            {videoUrl && (
              <div className="mt-6 grid grid-cols-3 gap-4">
                <div className="bg-secondary/50 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                    <Ruler className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Frame Rate</p>
                    <p className="text-lg font-semibold">30 FPS</p>
                  </div>
                </div>
                <div className="bg-secondary/50 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-400/20 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Duration</p>
                    <p className="text-lg font-semibold">{analysisData.videoDuration}</p>
                  </div>
                </div>
                <div className="bg-secondary/50 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-400/20 rounded-lg flex items-center justify-center">
                    <Target className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Landmarks</p>
                    <p className="text-lg font-semibold">33 Points</p>
                  </div>
                </div>
              </div>
            )}

            {videoUrl && !isAnalyzing && !showResults && (
              <Button
                onClick={analyzeVideo}
                disabled={isLoadingPose || !poseModel}
                className="w-full mt-6 bg-gradient-primary gap-2"
              >
                <Play className="w-4 h-4" />
                {isLoadingPose ? 'Loading AI Model...' : 'Start Analysis'}
              </Button>
            )}

            {isAnalyzing && (
              <div className="mt-6 text-center">
                <div className="inline-flex items-center gap-3 px-6 py-3 bg-primary/20 rounded-full">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-primary font-medium">Analyzing technique...</span>
                </div>
              </div>
            )}

            {poseError && (
              <div className="mt-4 p-4 bg-red-400/10 border border-red-400/20 rounded-lg text-red-400 text-sm">
                {poseError}
              </div>
            )}
          </div>

          {/* Real-time Angles */}
          <div className="bg-gradient-card rounded-2xl p-6 border border-border">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-3 mb-6">
              <BarChart3 className="w-5 h-5 text-primary" />
              Real-time Angle Analysis
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Front Elbow', value: analysisData.angles.elbow, optimal: { min: 140, max: 160 }, unit: '°' },
                { label: 'Back Knee', value: analysisData.angles.knee, optimal: { min: 160, max: 175 }, unit: '°' },
                { label: 'Shoulder Tilt', value: analysisData.angles.shoulder, optimal: { min: 0, max: 5 }, unit: '°' },
                { label: 'Head Position', value: analysisData.angles.head, optimal: { min: 0, max: 5 }, unit: '°' }
              ].map((angle, index) => (
                <div key={index} className="bg-secondary/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">{angle.label}</span>
                    <span className={`font-semibold ${getAngleColor(angle.value, angle.optimal)}`}>
                      {angle.value}{angle.unit}
                    </span>
                  </div>
                  <Progress value={getAngleProgress(angle.value, angle.optimal)} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-2">
                    Optimal: {angle.optimal.min}-{angle.optimal.max}{angle.unit}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Results */}
        <div className="space-y-6">
          {/* Overall Score */}
          <div className="bg-gradient-card rounded-2xl p-6 border border-border">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-3">
                <Trophy className="w-5 h-5 text-accent" />
                Overall Score
              </h2>
              {showResults && (
                <span className="px-3 py-1.5 bg-secondary rounded-full text-sm flex items-center gap-2">
                  <Medal className="w-4 h-4 text-accent" />
                  {analysisData.scores.overall >= 80 ? 'Advanced' : analysisData.scores.overall >= 60 ? 'Intermediate' : 'Beginner'}
                </span>
              )}
            </div>

            <div className="flex flex-col items-center">
              <div className="relative w-48 h-48 mb-6">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 45}
                    strokeDashoffset={getScoreRingOffset(showResults ? analysisData.scores.overall : 0)}
                    transform="rotate(-90 50 50)"
                    style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                  />
                  <text x="50" y="50" textAnchor="middle" dy="5" className="text-3xl font-bold fill-foreground">
                    {showResults ? analysisData.scores.overall : '--'}
                  </text>
                  <text x="50" y="62" textAnchor="middle" className="text-sm fill-muted-foreground">/100</text>
                </svg>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full">
                {[
                  { label: 'Technique', value: analysisData.scores.technique, color: 'text-primary' },
                  { label: 'Balance', value: analysisData.scores.balance, color: 'text-yellow-400' },
                  { label: 'Timing', value: analysisData.scores.timing, color: 'text-blue-400' },
                  { label: 'Follow-through', value: analysisData.scores.followThrough, color: 'text-purple-400' }
                ].map((score, index) => (
                  <div key={index} className="text-center p-3 bg-secondary/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">{score.label}</p>
                    <p className={`text-xl font-bold ${score.color}`}>
                      {showResults ? score.value : '--'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Detailed Feedback */}
          {showResults && analysisData.feedback.length > 0 && (
            <div className="bg-gradient-card rounded-2xl p-6 border border-border">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-3 mb-6">
                <MessageSquare className="w-5 h-5 text-primary" />
                Detailed Analysis
              </h2>
              <div className="space-y-4">
                {analysisData.feedback.map((item, index) => (
                  <div key={index} className="bg-secondary/50 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 ${getFeedbackBgColor(item.type)} rounded-lg flex items-center justify-center mt-0.5`}>
                        {getFeedbackIcon(item.type)}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-foreground mb-1">{item.title}</h4>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                        {item.drill && (
                          <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                            <Lightbulb className="w-3 h-3" />
                            <strong>Drill:</strong> {item.drill}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Drills */}
          {showResults && analysisData.drills.length > 0 && (
            <div className="bg-gradient-card rounded-2xl p-6 border border-border">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-3 mb-6">
                <Dumbbell className="w-5 h-5 text-primary" />
                Recommended Drills
              </h2>
              <div className="space-y-3">
                {analysisData.drills.map((drill, index) => (
                  <div key={index} className="flex items-center p-3 bg-secondary/30 rounded-lg gap-3">
                    <div className={`w-10 h-10 ${getDrillColor(drill.color)} rounded-lg flex items-center justify-center`}>
                      {getDrillIcon(drill.icon)}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{drill.title}</p>
                      <p className="text-sm text-muted-foreground">{drill.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Button onClick={downloadReport} className="w-full mt-6 bg-gradient-primary gap-2">
                <Download className="w-4 h-4" />
                Download Full Report (PDF)
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Cricket Context Section */}
      <div className="bg-gradient-card rounded-2xl p-8 border border-border">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-3 mb-6">
          <Target className="w-6 h-6 text-primary" />
          Cricket Technique Analysis
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-xl font-bold text-foreground mb-4">Batting Analysis Parameters</h3>
            <div className="space-y-4">
              <div className="p-4 bg-secondary/50 rounded-xl">
                <h4 className="font-semibold text-primary mb-2">Stance & Setup</h4>
                <p className="text-muted-foreground text-sm">Analyzes initial position, grip, and balance before ball delivery</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {['Feet Alignment', 'Knee Flex', 'Head Position'].map(tag => (
                    <span key={tag} className="px-2 py-1 bg-secondary rounded text-xs">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-secondary/50 rounded-xl">
                <h4 className="font-semibold text-blue-400 mb-2">Backlift & Trigger</h4>
                <p className="text-muted-foreground text-sm">Measures bat pick-up angle and initial movement timing</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {['Bat Angle', 'Weight Transfer', 'Front Foot Movement'].map(tag => (
                    <span key={tag} className="px-2 py-1 bg-secondary rounded text-xs">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold text-foreground mb-4">Bowling Analysis Parameters</h3>
            <div className="space-y-4">
              <div className="p-4 bg-secondary/50 rounded-xl">
                <h4 className="font-semibold text-accent mb-2">Run-up & Delivery</h4>
                <p className="text-muted-foreground text-sm">Analyzes approach speed, gather position, and front foot landing</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {['Approach Rhythm', 'Front Foot Braking', 'Arm Speed'].map(tag => (
                    <span key={tag} className="px-2 py-1 bg-secondary rounded text-xs">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-secondary/50 rounded-xl">
                <h4 className="font-semibold text-purple-400 mb-2">Follow-through & Recovery</h4>
                <p className="text-muted-foreground text-sm">Measures completion of action and return to fielding position</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {['Momentum Transfer', 'Body Alignment', 'Recovery Speed'].map(tag => (
                    <span key={tag} className="px-2 py-1 bg-secondary rounded text-xs">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl p-8 max-w-md w-full border border-border shadow-elevated">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-foreground">Upload Cricket Video</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowUploadModal(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <label className="block border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary transition-colors cursor-pointer mb-6">
              <input
                type="file"
                accept="video/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <p className="text-lg font-semibold text-foreground mb-2">Drop your video here</p>
              <p className="text-muted-foreground mb-4">or click to browse files</p>
              <p className="text-sm text-muted-foreground">Supports .mp4, .mov, .avi up to 100MB</p>
            </label>

            <div className="space-y-4">
              <div>
                <label className="block text-muted-foreground mb-2">Analysis Mode</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => switchMode('batting')}
                    className={`p-4 rounded-xl text-center transition-colors ${
                      analysisData.currentMode === 'batting'
                        ? 'bg-primary/20 border-2 border-primary'
                        : 'bg-secondary hover:bg-secondary/80 border-2 border-transparent'
                    }`}
                  >
                    <Target className="w-8 h-8 mx-auto mb-2 text-primary" />
                    <p className="font-semibold">Batting</p>
                    <p className="text-xs text-muted-foreground">Front foot, backlift, follow-through</p>
                  </button>
                  <button
                    onClick={() => switchMode('bowling')}
                    className={`p-4 rounded-xl text-center transition-colors ${
                      analysisData.currentMode === 'bowling'
                        ? 'bg-primary/20 border-2 border-primary'
                        : 'bg-secondary hover:bg-secondary/80 border-2 border-transparent'
                    }`}
                  >
                    <Play className="w-8 h-8 mx-auto mb-2 text-blue-400" />
                    <p className="font-semibold">Bowling</p>
                    <p className="text-xs text-muted-foreground">Run-up, delivery, follow-through</p>
                  </button>
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowUploadModal(false)}
                >
                  Cancel
                </Button>
                <label className="flex-1">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button className="w-full bg-gradient-primary gap-2" asChild>
                    <span>
                      <Upload className="w-4 h-4" />
                      Select Video
                    </span>
                  </Button>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}