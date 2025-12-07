import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, Video, Play, X, RefreshCw, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePoseDetection, PoseFrame } from '@/hooks/usePoseDetection';
import { PoseOverlay } from './PoseOverlay';
import { AnalysisResults } from './AnalysisResults';
import { supabase } from '@/integrations/supabase/client';

interface VideoAnalyzerProps {
  mode: 'batting' | 'bowling';
}

interface Analysis {
  overallScore: number;
  overallGrade: string;
  summary: string;
  aspects: Array<{
    name: string;
    score: number;
    status: 'excellent' | 'good' | 'needs_improvement' | 'poor';
    feedback: string;
    keyPoints: string[];
  }>;
  strengths: string[];
  areasForImprovement: Array<{
    issue: string;
    severity: 'high' | 'medium' | 'low';
    drill: string;
  }>;
  angleAnalysis: {
    elbowAngle?: { value: number; optimal: string; assessment: string };
    kneeAngle?: { value: number; optimal: string; assessment: string };
    shoulderAngle?: { value: number; optimal: string; assessment: string };
    hipAngle?: { value: number; optimal: string; assessment: string };
  };
  comparisonToElite: string;
  nextSteps: string[];
}

export function VideoAnalyzer({ mode }: VideoAnalyzerProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState<'idle' | 'pose' | 'ai' | 'complete'>('idle');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 360 });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { isProcessing, progress, poseFrames, currentFrame, processVideo, reset } = usePoseDetection();

  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith("video/")) {
        setSelectedFile(file);
        setVideoUrl(URL.createObjectURL(file));
        setAnalysis(null);
        setAnalysisStage('idle');
        reset();
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload a video file (.mp4, .mov, .avi)",
          variant: "destructive",
        });
      }
    }
  };

  const handleVideoLoad = () => {
    if (videoRef.current && containerRef.current) {
      const video = videoRef.current;
      const containerWidth = containerRef.current.offsetWidth;
      const aspectRatio = video.videoWidth / video.videoHeight;
      const height = containerWidth / aspectRatio;
      setVideoDimensions({ width: containerWidth, height });
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setIsAnalyzing(true);
    setAnalysisStage('pose');

    try {
      // Step 1: Process video for pose detection
      const frames = await processVideo(selectedFile);
      
      setAnalysisStage('ai');
      
      // Step 2: Get authenticated user's session token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('You must be logged in to analyze videos');
      }

      // Step 3: Send pose data to AI for analysis with user's auth token
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-cricket`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          mode,
          poseData: frames.map(f => ({ joints: f.joints, angles: f.angles })),
          frameCount: frames.length,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Analysis failed');
      }

      const data = await response.json();
      setAnalysis(data.analysis);
      setAnalysisStage('complete');
      
      toast({
        title: "Analysis Complete!",
        description: `Your ${mode} technique has been analyzed.`,
      });
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
      setAnalysisStage('idle');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearFile = () => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setSelectedFile(null);
    setVideoUrl(null);
    setAnalysis(null);
    setAnalysisStage('idle');
    reset();
  };

  const downloadReport = () => {
    if (!analysis) return;
    
    const report = `
CRICKET ${mode.toUpperCase()} TECHNIQUE ANALYSIS REPORT
${'='.repeat(50)}

OVERALL SCORE: ${analysis.overallScore}/100 (Grade: ${analysis.overallGrade})

SUMMARY
${analysis.summary}

TECHNICAL BREAKDOWN
${analysis.aspects.map(a => `
${a.name}: ${a.score}/100 (${a.status})
${a.feedback}
Key Points:
${a.keyPoints.map(p => `  • ${p}`).join('\n')}
`).join('\n')}

STRENGTHS
${analysis.strengths.map(s => `• ${s}`).join('\n')}

AREAS FOR IMPROVEMENT
${analysis.areasForImprovement.map(a => `
[${a.severity.toUpperCase()}] ${a.issue}
  Drill: ${a.drill}
`).join('\n')}

COMPARISON TO ELITE PLAYERS
${analysis.comparisonToElite}

NEXT STEPS
${analysis.nextSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}
`;

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cricket-${mode}-analysis-report.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Video Upload Area */}
      <div ref={containerRef}>
        {!selectedFile ? (
          <div className="relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 border-border hover:border-primary/50 hover:bg-card">
            <input
              type="file"
              accept="video/mp4,video/mov,video/avi,video/quicktime"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-display text-xl font-semibold text-foreground mb-2">
              Upload Your {mode === 'batting' ? 'Batting' : 'Bowling'} Video
            </h3>
            <p className="text-muted-foreground mb-4">
              Drag and drop or click to select your video
            </p>
            <p className="text-sm text-muted-foreground">
              MP4, MOV, AVI (max 500MB) • Best results with side-on angle
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Video Player with Pose Overlay */}
            <div className="relative rounded-2xl overflow-hidden bg-black">
              <video
                ref={videoRef}
                src={videoUrl || undefined}
                onLoadedMetadata={handleVideoLoad}
                controls={!isProcessing}
                className="w-full"
                style={{ maxHeight: '500px' }}
              />
              
              {currentFrame && (
                <PoseOverlay
                  joints={currentFrame.joints}
                  width={videoDimensions.width}
                  height={videoDimensions.height}
                />
              )}
              
              {/* Processing Overlay */}
              {isProcessing && (
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                  <div className="w-20 h-20 rounded-full border-4 border-primary/30 border-t-primary animate-spin mb-4" />
                  <p className="text-white font-medium mb-2">Detecting Pose...</p>
                  <div className="w-48">
                    <Progress value={progress} className="h-2" />
                  </div>
                  <p className="text-white/60 text-sm mt-2">{Math.round(progress)}% complete</p>
                </div>
              )}
              
              {analysisStage === 'ai' && (
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                  <div className="w-20 h-20 rounded-full border-4 border-accent/30 border-t-accent animate-spin mb-4" />
                  <p className="text-white font-medium">Analyzing Technique with AI...</p>
                  <p className="text-white/60 text-sm mt-2">This may take a few seconds</p>
                </div>
              )}
            </div>

            {/* File Info & Actions */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-border">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Video className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {poseFrames.length > 0 ? `${poseFrames.length} frames analyzed` : 'Ready for analysis'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {analysis && (
                  <Button variant="outline" size="sm" onClick={downloadReport}>
                    <Download className="w-4 h-4 mr-2" />
                    Report
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={clearFile}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Analyze Button */}
            {!analysis && (
              <Button
                variant="hero"
                size="lg"
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="w-full"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    {analysisStage === 'pose' ? 'Detecting Pose...' : 'AI Analyzing...'}
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Analyze {mode === 'batting' ? 'Batting' : 'Bowling'} Technique
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Analysis Results */}
      {analysis && (
        <AnalysisResults analysis={analysis} mode={mode} />
      )}
    </div>
  );
}
