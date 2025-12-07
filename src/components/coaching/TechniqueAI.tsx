import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, Play, FileText, Video, Lightbulb, BarChart3, 
  Ruler, MessageSquare, Dumbbell, CheckCircle, AlertTriangle, Info, X 
} from 'lucide-react';
import { Pose, Results } from '@mediapipe/pose';

type AnalysisMode = 'batting' | 'bowling';

interface AnalysisResults {
  angles: Record<string, number>;
  metrics: Record<string, { score: number; quality: 'High' | 'Medium' | 'Low' }>;
  feedback: Array<{ category: string; message: string; severity: 'success' | 'warning' | 'info' }>;
  strengths: string[];
  improvements: string[];
  drills: string[];
  score: number;
}

const OPTIMAL_RANGES = {
  batting: {
    backliftAngle: { min: 45, max: 60 },
    elbowAngle: { min: 90, max: 110 },
    headMovement: { max: 2 },
    frontKneeFlexion: { min: 120, max: 140 },
  },
  bowling: {
    frontKneeFlexion: { min: 110, max: 130 },
    armExtension: { min: 170, max: 180 },
    hipShoulderSeparation: { min: 30, max: 45 },
    followThrough: { min: 85, max: 95 },
  },
};

const METRIC_DESCRIPTIONS: Record<string, string> = {
  backliftQuality: 'Height and angle of bat lift',
  elbowPosition: 'Elbow flexion during swing',
  frontKneeFlexion: 'Bend in front knee at impact',
  headStability: 'Minimal head movement during action',
  armExtension: 'Full arm extension at release',
};

function calculateAngle(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }): number {
  const ab = Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
  const bc = Math.sqrt(Math.pow(b.x - c.x, 2) + Math.pow(b.y - c.y, 2));
  const ac = Math.sqrt(Math.pow(c.x - a.x, 2) + Math.pow(c.y - a.y, 2));
  
  if (ab === 0 || bc === 0) return 0;
  const cosAngle = (Math.pow(ab, 2) + Math.pow(bc, 2) - Math.pow(ac, 2)) / (2 * ab * bc);
  const clampedCos = Math.max(-1, Math.min(1, cosAngle));
  return Math.round(Math.acos(clampedCos) * (180 / Math.PI));
}

function evaluateMetric(value: number, min: number, max: number): { score: number; quality: 'High' | 'Medium' | 'Low' } {
  if (value < min) return { score: 0.5, quality: 'Low' };
  if (value > max) return { score: 0.7, quality: 'Medium' };
  return { score: 1.0, quality: 'High' };
}

export function TechniqueAI() {
  const [mode, setMode] = useState<AnalysisMode>('batting');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [poseModel, setPoseModel] = useState<Pose | null>(null);
  const [results, setResults] = useState<AnalysisResults>({
    angles: {},
    metrics: {},
    feedback: [],
    strengths: [],
    improvements: [],
    drills: [],
    score: 0,
  });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const headStabilityRef = useRef<{ x: number; y: number; movement: number } | null>(null);
  const analysisRef = useRef<AnalysisResults>({
    angles: {},
    metrics: {},
    feedback: [],
    strengths: [],
    improvements: [],
    drills: [],
    score: 0,
  });

  const [poseError, setPoseError] = useState<string | null>(null);

  // Initialize MediaPipe Pose
  useEffect(() => {
    let pose: Pose | null = null;
    
    const initPose = async () => {
      try {
        pose = new Pose({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
        });

        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          smoothSegmentation: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        pose.onResults(onPoseResults);
        await pose.initialize();
        setPoseModel(pose);
        setPoseError(null);
        console.log('MediaPipe Pose initialized successfully');
      } catch (error) {
        console.error('Failed to initialize MediaPipe Pose:', error);
        setPoseError('Failed to load pose detection. Please refresh the page.');
      }
    };

    initPose();

    return () => {
      if (pose) {
        pose.close();
      }
    };
  }, []);

  const onPoseResults = useCallback((results: Results) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    if (results.poseLandmarks) {
      // Draw skeleton
      const connections = [
        [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
        [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
        [24, 26], [26, 28],
      ];

      ctx.strokeStyle = 'hsl(152, 60%, 45%)';
      ctx.lineWidth = 3;

      connections.forEach(([start, end]) => {
        const startLm = results.poseLandmarks[start];
        const endLm = results.poseLandmarks[end];
        if (startLm && endLm) {
          ctx.beginPath();
          ctx.moveTo(startLm.x * canvas.width, startLm.y * canvas.height);
          ctx.lineTo(endLm.x * canvas.width, endLm.y * canvas.height);
          ctx.stroke();
        }
      });

      // Draw landmarks
      results.poseLandmarks.forEach((landmark, idx) => {
        if (idx < 11) return; // Skip face landmarks
        const x = landmark.x * canvas.width;
        const y = landmark.y * canvas.height;
        
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = 'hsl(152, 60%, 45%)';
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
      });

      // Calculate angles
      calculateAnglesFromLandmarks(results.poseLandmarks);
    }

    ctx.restore();
  }, [mode]);

  const calculateAnglesFromLandmarks = (landmarks: Results['poseLandmarks']) => {
    if (!landmarks || landmarks.length < 29) return;

    const analysis = analysisRef.current;

    if (mode === 'batting') {
      // Backlift angle (shoulder-elbow-wrist)
      if (landmarks[12] && landmarks[14] && landmarks[16]) {
        const angle = calculateAngle(landmarks[12], landmarks[14], landmarks[16]);
        analysis.angles.backlift = angle;
        analysis.metrics.backliftQuality = evaluateMetric(
          angle,
          OPTIMAL_RANGES.batting.backliftAngle.min,
          OPTIMAL_RANGES.batting.backliftAngle.max
        );
      }

      // Elbow angle
      if (landmarks[12] && landmarks[14] && landmarks[16]) {
        const angle = calculateAngle(landmarks[12], landmarks[14], landmarks[16]);
        analysis.angles.elbow = angle;
        analysis.metrics.elbowPosition = evaluateMetric(
          angle,
          OPTIMAL_RANGES.batting.elbowAngle.min,
          OPTIMAL_RANGES.batting.elbowAngle.max
        );
      }

      // Front knee flexion
      if (landmarks[24] && landmarks[26] && landmarks[28]) {
        const angle = calculateAngle(landmarks[24], landmarks[26], landmarks[28]);
        analysis.angles.frontKnee = angle;
        analysis.metrics.frontKneeFlexion = evaluateMetric(
          angle,
          OPTIMAL_RANGES.batting.frontKneeFlexion.min,
          OPTIMAL_RANGES.batting.frontKneeFlexion.max
        );
      }
    } else {
      // Bowling mode
      if (landmarks[24] && landmarks[26] && landmarks[28]) {
        const angle = calculateAngle(landmarks[24], landmarks[26], landmarks[28]);
        analysis.angles.frontKnee = angle;
        analysis.metrics.frontKneeFlexion = evaluateMetric(
          angle,
          OPTIMAL_RANGES.bowling.frontKneeFlexion.min,
          OPTIMAL_RANGES.bowling.frontKneeFlexion.max
        );
      }

      if (landmarks[12] && landmarks[14] && landmarks[16]) {
        const angle = calculateAngle(landmarks[12], landmarks[14], landmarks[16]);
        analysis.angles.armExtension = angle;
        analysis.metrics.armExtension = evaluateMetric(
          angle,
          OPTIMAL_RANGES.bowling.armExtension.min,
          OPTIMAL_RANGES.bowling.armExtension.max
        );
      }
    }

    // Head stability
    if (landmarks[0]) {
      if (!headStabilityRef.current) {
        headStabilityRef.current = { x: landmarks[0].x, y: landmarks[0].y, movement: 0 };
      } else {
        const dx = landmarks[0].x - headStabilityRef.current.x;
        const dy = landmarks[0].y - headStabilityRef.current.y;
        headStabilityRef.current.movement += Math.sqrt(dx * dx + dy * dy);
        headStabilityRef.current.x = landmarks[0].x;
        headStabilityRef.current.y = landmarks[0].y;
      }
    }
  };

  const generateFeedback = () => {
    const analysis = analysisRef.current;
    analysis.feedback = [];
    analysis.strengths = [];
    analysis.improvements = [];
    analysis.drills = [];

    // Calculate overall score
    const metricCount = Object.keys(analysis.metrics).length;
    const totalScore = Object.values(analysis.metrics).reduce(
      (sum, metric) => sum + (metric.score || 0), 0
    );
    analysis.score = metricCount > 0 ? Math.round((totalScore / metricCount) * 100) : 0;

    if (mode === 'batting') {
      // Backlift analysis
      if (analysis.angles.backlift) {
        const angle = analysis.angles.backlift;
        const optimal = OPTIMAL_RANGES.batting.backliftAngle;

        if (angle < optimal.min) {
          analysis.feedback.push({
            category: 'Backlift',
            message: `Your backlift is too low (${angle}°). A higher backlift (45-60°) generates more power.`,
            severity: 'warning',
          });
          analysis.improvements.push('Increase backlift angle for better power generation');
          analysis.drills.push('High elbow drill: Practice lifting the bat to shoulder height in your stance');
        } else if (angle > optimal.max) {
          analysis.feedback.push({
            category: 'Backlift',
            message: `Your backlift is very high (${angle}°). While this can generate power, it may slow your downswing.`,
            severity: 'info',
          });
        } else {
          analysis.feedback.push({
            category: 'Backlift',
            message: `Excellent backlift angle (${angle}°) - ideal for power and control`,
            severity: 'success',
          });
          analysis.strengths.push('Good backlift technique');
        }
      }

      // Elbow position
      if (analysis.angles.elbow) {
        const angle = analysis.angles.elbow;
        const optimal = OPTIMAL_RANGES.batting.elbowAngle;

        if (angle < optimal.min) {
          analysis.feedback.push({
            category: 'Elbow Position',
            message: `Your elbow is too bent (${angle}°). Straighter elbow (90-110°) improves bat speed.`,
            severity: 'warning',
          });
          analysis.improvements.push('Maintain optimal elbow angle during swing');
          analysis.drills.push('Straight drive practice focusing on elbow position');
        } else if (angle > optimal.max) {
          analysis.feedback.push({
            category: 'Elbow Position',
            message: `Your elbow is too straight (${angle}°). Slight bend (90-110°) allows better control.`,
            severity: 'info',
          });
        } else {
          analysis.feedback.push({
            category: 'Elbow Position',
            message: `Perfect elbow position (${angle}°) - great for control and power`,
            severity: 'success',
          });
          analysis.strengths.push('Excellent elbow positioning');
        }
      }

      // Front knee
      if (analysis.angles.frontKnee) {
        const angle = analysis.angles.frontKnee;
        const optimal = OPTIMAL_RANGES.batting.frontKneeFlexion;

        if (angle < optimal.min) {
          analysis.feedback.push({
            category: 'Front Knee',
            message: `Your front knee is too straight (${angle}°). More flexion (120-140°) improves balance.`,
            severity: 'warning',
          });
          analysis.improvements.push('Increase front knee flexion for better stability');
          analysis.drills.push('Shadow batting with focus on knee bend');
        } else if (angle > optimal.max) {
          analysis.feedback.push({
            category: 'Front Knee',
            message: `Your front knee is very bent (${angle}°). Slightly less flexion may help weight transfer.`,
            severity: 'info',
          });
        } else {
          analysis.feedback.push({
            category: 'Front Knee',
            message: `Ideal front knee flexion (${angle}°) - excellent balance and weight transfer`,
            severity: 'success',
          });
          analysis.strengths.push('Good front knee position');
        }
      }

      // Head stability
      if (headStabilityRef.current) {
        const movement = headStabilityRef.current.movement;
        if (movement > OPTIMAL_RANGES.batting.headMovement.max) {
          analysis.feedback.push({
            category: 'Head Position',
            message: 'Excessive head movement detected. Keep your head still for better shot execution.',
            severity: 'warning',
          });
          analysis.improvements.push('Reduce head movement during shot');
          analysis.drills.push('Head stability drill: Practice watching the ball with minimal head movement');
        } else {
          analysis.feedback.push({
            category: 'Head Position',
            message: 'Good head stability - minimal movement detected',
            severity: 'success',
          });
          analysis.strengths.push('Stable head position');
        }
        analysis.metrics.headStability = {
          score: movement > OPTIMAL_RANGES.batting.headMovement.max ? 0.5 : 1.0,
          quality: movement > OPTIMAL_RANGES.batting.headMovement.max ? 'Low' : 'High',
        };
      }
    } else {
      // Bowling feedback
      if (analysis.angles.frontKnee) {
        const angle = analysis.angles.frontKnee;
        const optimal = OPTIMAL_RANGES.bowling.frontKneeFlexion;

        if (angle < optimal.min) {
          analysis.feedback.push({
            category: 'Front Knee',
            message: `Your front knee is too straight at delivery (${angle}°). More flexion (110-130°) improves stability.`,
            severity: 'warning',
          });
          analysis.improvements.push('Increase front knee flexion at delivery');
          analysis.drills.push('Delivery stride practice focusing on knee bend');
        } else if (angle > optimal.max) {
          analysis.feedback.push({
            category: 'Front Knee',
            message: `Your front knee is very bent at delivery (${angle}°). Slightly less flexion may help power transfer.`,
            severity: 'info',
          });
        } else {
          analysis.feedback.push({
            category: 'Front Knee',
            message: `Ideal front knee flexion at delivery (${angle}°) - excellent bowling position`,
            severity: 'success',
          });
          analysis.strengths.push('Good front knee position at delivery');
        }
      }

      if (analysis.angles.armExtension) {
        const angle = analysis.angles.armExtension;
        const optimal = OPTIMAL_RANGES.bowling.armExtension;

        if (angle < optimal.min) {
          analysis.feedback.push({
            category: 'Arm Extension',
            message: `Your arm isn't fully extending at release (${angle}°). Full extension (170-180°) improves pace and accuracy.`,
            severity: 'warning',
          });
          analysis.improvements.push('Improve arm extension at release');
          analysis.drills.push('Arm extension drills with resistance bands');
        } else if (angle > optimal.max) {
          analysis.feedback.push({
            category: 'Arm Extension',
            message: `Your arm is hyperextending at release (${angle}°). Be careful not to overextend.`,
            severity: 'info',
          });
        } else {
          analysis.feedback.push({
            category: 'Arm Extension',
            message: `Excellent arm extension at release (${angle}°) - ideal bowling action`,
            severity: 'success',
          });
          analysis.strengths.push('Good arm extension technique');
        }
      }
    }

    setResults({ ...analysis });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          setVideoFile(file);
          setVideoUrl(URL.createObjectURL(file));
          setShowResults(false);
          return 100;
        }
        return prev + 5;
      });
    }, 50);
  };

  const handleVideoLoad = () => {
    if (videoRef.current && canvasRef.current) {
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
    }
  };

  const analyzeVideo = async () => {
    if (!videoRef.current || !poseModel) return;

    setIsAnalyzing(true);
    setShowResults(false);
    headStabilityRef.current = null;
    analysisRef.current = {
      angles: {},
      metrics: {},
      feedback: [],
      strengths: [],
      improvements: [],
      drills: [],
      score: 0,
    };

    const video = videoRef.current;
    video.currentTime = 0;
    video.play();

    const processFrame = async () => {
      if (video.paused || video.ended) {
        generateFeedback();
        setIsAnalyzing(false);
        setShowResults(true);
        return;
      }

      await poseModel.send({ image: video });
      requestAnimationFrame(processFrame);
    };

    processFrame();
  };

  const clearVideo = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoFile(null);
    setVideoUrl(null);
    setShowResults(false);
    setResults({
      angles: {},
      metrics: {},
      feedback: [],
      strengths: [],
      improvements: [],
      drills: [],
      score: 0,
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-primary';
    if (score >= 70) return 'text-accent';
    return 'text-destructive';
  };

  const getScoreDescription = (score: number) => {
    if (score >= 85) return 'Excellent technique! Professional level execution.';
    if (score >= 70) return 'Good technique with some areas for improvement.';
    return 'Needs work - focus on the recommended improvements.';
  };

  const getSeverityIcon = (severity: 'success' | 'warning' | 'info') => {
    switch (severity) {
      case 'success': return <CheckCircle className="w-5 h-5 text-primary" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-accent" />;
      case 'info': return <Info className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getQualityColor = (quality: 'High' | 'Medium' | 'Low') => {
    switch (quality) {
      case 'High': return 'text-primary';
      case 'Medium': return 'text-accent';
      case 'Low': return 'text-destructive';
    }
  };

  if (poseError) {
    return (
      <div className="rounded-2xl bg-destructive/10 border border-destructive/20 p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Pose Detection Error</h3>
        <p className="text-muted-foreground mb-4">{poseError}</p>
        <Button onClick={() => window.location.reload()}>
          Refresh Page
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left Column - Video Upload and Analysis */}
      <div className="rounded-2xl bg-card border border-border p-6 space-y-6">
        <h2 className="text-xl font-display font-semibold text-foreground flex items-center gap-2">
          <Video className="w-5 h-5 text-primary" />
          Video Analysis
        </h2>

        {/* Mode Toggle */}
        <div className="flex gap-2">
          <Button
            variant={mode === 'batting' ? 'default' : 'outline'}
            onClick={() => setMode('batting')}
            className="flex-1"
          >
            🏏 Batting
          </Button>
          <Button
            variant={mode === 'bowling' ? 'default' : 'outline'}
            onClick={() => setMode('bowling')}
            className="flex-1"
          >
            🎯 Bowling
          </Button>
        </div>

        {/* Pro Tip */}
        <div className="rounded-xl bg-primary/10 border border-primary/20 p-4">
          <h3 className="font-medium text-primary mb-2 flex items-center gap-2">
            <Lightbulb className="w-4 h-4" />
            Pro Tip
          </h3>
          <p className="text-sm text-muted-foreground">
            {mode === 'batting'
              ? 'For batting analysis, film from side-on with full view of your stance and swing.'
              : 'For bowling analysis, capture your full run-up and delivery stride from side-on.'}
          </p>
        </div>

        {/* Upload Area */}
        {!videoFile ? (
          <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
            <input
              type="file"
              id="videoUpload"
              accept="video/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            <label htmlFor="videoUpload" className="cursor-pointer">
              <div className="flex flex-col items-center justify-center">
                <Upload className="w-12 h-12 text-primary mb-3" />
                <p className="text-foreground font-medium">Upload your cricket video</p>
                <p className="text-sm text-muted-foreground mt-1">MP4, MOV, AVI (max 50MB)</p>
              </div>
            </label>
          </div>
        ) : null}

        {/* Upload Progress */}
        {isUploading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-foreground">Uploading...</span>
              <span className="text-muted-foreground">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        {/* Video Preview */}
        {videoFile && !isUploading && (
          <div className="space-y-4">
            <div className="relative rounded-xl overflow-hidden bg-black">
              <video
                ref={videoRef}
                src={videoUrl || undefined}
                onLoadedMetadata={handleVideoLoad}
                controls={!isAnalyzing}
                className="w-full"
                style={{ maxHeight: '400px' }}
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
              
              {isAnalyzing && (
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-full border-4 border-primary/30 border-t-primary animate-spin mb-4" />
                  <p className="text-white font-medium">Analyzing your cricket technique...</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                onClick={analyzeVideo}
                disabled={isAnalyzing || !poseModel}
                className="flex-1"
              >
                <Play className="w-4 h-4 mr-2" />
                Analyze Technique
              </Button>
              <Button variant="outline" onClick={() => alert('PDF report generation coming soon!')}>
                <FileText className="w-4 h-4 mr-2" />
                PDF Report
              </Button>
              <Button variant="ghost" size="icon" onClick={clearVideo}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Right Column - Results */}
      <div className="rounded-2xl bg-card border border-border p-6 space-y-6">
        <h2 className="text-xl font-display font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Performance Analysis
        </h2>

        {isAnalyzing && (
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Analyzing your cricket technique...</p>
          </div>
        )}

        {showResults && (
          <div className="space-y-6 animate-fade-in">
            {/* Overall Score */}
            <div className="rounded-xl bg-muted/50 border border-border p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-medium text-foreground">Overall Technique Score</h3>
                <span className={`text-3xl font-bold ${getScoreColor(results.score)}`}>
                  {results.score}
                </span>
              </div>
              <div className="h-2 rounded-full bg-gradient-to-r from-destructive via-accent to-primary mb-2">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${results.score}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground">{getScoreDescription(results.score)}</p>
            </div>

            {/* Key Metrics */}
            <div>
              <h3 className="text-lg font-medium text-foreground mb-3 flex items-center gap-2">
                <Ruler className="w-4 h-4 text-primary" />
                Biomechanical Metrics
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {results.angles.backlift !== undefined && (
                  <div className="rounded-xl bg-muted/50 border border-border p-3">
                    <p className="text-sm text-muted-foreground">Backlift Angle</p>
                    <p className="text-xl font-bold text-foreground">{results.angles.backlift}°</p>
                    <p className="text-xs text-muted-foreground">Optimal: 45-60°</p>
                  </div>
                )}
                {results.angles.elbow !== undefined && (
                  <div className="rounded-xl bg-muted/50 border border-border p-3">
                    <p className="text-sm text-muted-foreground">Elbow Angle</p>
                    <p className="text-xl font-bold text-foreground">{results.angles.elbow}°</p>
                    <p className="text-xs text-muted-foreground">Optimal: 90-110°</p>
                  </div>
                )}
                {results.angles.frontKnee !== undefined && (
                  <div className="rounded-xl bg-muted/50 border border-border p-3">
                    <p className="text-sm text-muted-foreground">Front Knee</p>
                    <p className="text-xl font-bold text-foreground">{results.angles.frontKnee}°</p>
                    <p className="text-xs text-muted-foreground">
                      Optimal: {mode === 'batting' ? '120-140°' : '110-130°'}
                    </p>
                  </div>
                )}
                {results.angles.armExtension !== undefined && (
                  <div className="rounded-xl bg-muted/50 border border-border p-3">
                    <p className="text-sm text-muted-foreground">Arm Extension</p>
                    <p className="text-xl font-bold text-foreground">{results.angles.armExtension}°</p>
                    <p className="text-xs text-muted-foreground">Optimal: 170-180°</p>
                  </div>
                )}
              </div>
            </div>

            {/* Technique Breakdown */}
            {Object.keys(results.metrics).length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-foreground mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  Technique Breakdown
                </h3>
                <div className="space-y-3">
                  {Object.entries(results.metrics).map(([metric, data]) => (
                    <div
                      key={metric}
                      className="rounded-xl bg-muted/50 border border-border p-4 transition-all hover:border-primary/30"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-medium text-foreground capitalize">
                            {metric.replace(/([A-Z])/g, ' $1').trim()}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {METRIC_DESCRIPTIONS[metric] || 'Technical metric'}
                          </p>
                        </div>
                        <span className={`font-bold ${getQualityColor(data.quality)}`}>
                          {data.quality}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-border">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${data.score * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Coach's Feedback */}
            {results.feedback.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-foreground mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  Coach's Feedback
                </h3>
                <div className="space-y-3">
                  {results.feedback.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      {getSeverityIcon(item.severity)}
                      <div>
                        <p className="font-medium text-foreground">{item.category}</p>
                        <p className="text-sm text-muted-foreground">{item.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended Drills */}
            <div>
              <h3 className="text-lg font-medium text-foreground mb-3 flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-primary" />
                Recommended Drills
              </h3>
              <div className="rounded-xl bg-primary/10 border border-primary/20 p-4">
                {results.drills.length > 0 ? (
                  <div className="space-y-2">
                    {results.drills.map((drill, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <Dumbbell className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-muted-foreground">{drill}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No specific drills recommended. Your technique is fundamentally sound!
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {!showResults && !isAnalyzing && (
          <div className="text-center py-12 text-muted-foreground">
            <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Upload your cricket video to begin analysis</p>
            <p className="text-sm mt-2">Get detailed feedback on your {mode} technique</p>
          </div>
        )}
      </div>
    </div>
  );
}
