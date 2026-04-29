const DEFAULT_LOCAL_CRICKET_API_BASE = "/cricket-api";
const DEFAULT_HOSTED_CRICKET_API_BASE = "https://gamechangrs-cricket-api.onrender.com";

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function isLocalCricketHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function joinBaseAndPath(base: string, path: string) {
  const normalizedBase = stripTrailingSlash(base);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export type CricketPlayerSearchResult = {
  playerId: number;
  divisionId: number | null;
  displayName: string;
  canonicalName: string;
  teamName: string;
  divisionLabel: string;
  roleType: string;
  roleLabel: string;
  compositeScore: number | null;
  percentileRank: number | null;
  confidenceScore: number | null;
  confidenceLabel: string;
  reportPath: string;
  apiPath: string;
};

export type CricketPlayerSearchResponse = {
  series: {
    configKey: string;
    name: string;
  };
  query: string;
  resultCount: number;
  results: CricketPlayerSearchResult[];
};

export type CricketSeriesCard = {
  configKey?: string;
  seriesName?: string;
  targetAgeGroup?: string;
  isActive?: boolean;
  matchCount?: number | null;
  computedMatches?: number | null;
  playerCount?: number | null;
};

export type CricketDashboardSummaryResponse = {
  series?: {
    configKey?: string;
    name?: string;
    targetAgeGroup?: string;
  };
  seriesCards?: CricketSeriesCard[];
  coverage?: {
    playerCount?: number | null;
    totalMatches?: number | null;
    computedMatches?: number | null;
    warningMatches?: number | null;
    pendingOps?: number | null;
    adminOverrides?: number | null;
    divisionLabels?: string[];
  };
  freshness?: {
    label?: string;
    tone?: CricketReportTone;
    note?: string;
  };
  latestMatch?: {
    matchId?: number | null;
    sourceMatchId?: string;
    matchDate?: string;
    matchDateLabel?: string;
    matchTitle?: string;
    divisionLabel?: string;
    analyticsStatus?: string;
    reconciliationStatus?: string;
  } | null;
};

export type CricketSeriesOverviewResponse = {
  series?: {
    configKey?: string;
    name?: string;
    targetAgeGroup?: string;
  };
  leaderboard?: Array<{
    divisionLabel?: string;
  }>;
  qualitySummary?: {
    totalMatches?: number | null;
    computedMatches?: number | null;
    warningMatches?: number | null;
    pendingOps?: number | null;
    adminOverrides?: number | null;
  };
  recentMatches?: Array<{
    matchDateLabel?: string;
    matchTitle?: string;
    divisionLabel?: string;
  }>;
};

export type CricketAdminEntityMembership = {
  membershipId?: string;
  entityId?: string;
  userId?: string;
  role?: string;
  status?: string;
  invitedByUserId?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  isOwner?: boolean;
  canRemove?: boolean;
};

export type CricketAdminEntityAccessRequest = {
  requestId?: string;
  entityId?: string;
  requestedEmail?: string;
  requestedUserId?: string;
  requestedRole?: string;
  requestType?: string;
  requestStatus?: string;
  requestNote?: string;
  adminResponseNote?: string;
  requestedByUserId?: string;
  reviewedByUserId?: string;
  resolvedMembershipId?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  resolvedAt?: string | null;
};

export type CricketAdminSeriesEntity = {
  entityId?: string;
  entitySlug?: string;
  entityName?: string;
  ownerUserId?: string;
  accessRole?: string;
  seriesCount?: number | null;
  subscriptionPlanKey?: string;
  subscriptionStatus?: string;
  maxAdminUsers?: number | null;
  activeAdminUsers?: number | null;
  remainingAdminUsers?: number | null;
  admins?: CricketAdminEntityMembership[];
  adminRequests?: CricketAdminEntityAccessRequest[];
};

export type CricketAdminSeriesItem = {
  seriesSourceConfigId?: number | null;
  entityId?: string;
  entitySlug?: string;
  entityName?: string;
  configKey?: string;
  seriesName?: string;
  targetAgeGroup?: string;
  seasonYear?: number | null;
  sourceSystem?: string;
  seriesUrl?: string;
  isActive?: boolean;
  accessRole?: string;
  canManage?: boolean;
  matchCount?: number | null;
  computedMatches?: number | null;
  warningMatches?: number | null;
  playerCount?: number | null;
  setupApiPath?: string | null;
  tuningApiPath?: string | null;
  matchesApiPath?: string | null;
  viewersApiPath?: string | null;
};

export type CricketAdminSeriesResponse = {
  authFoundationReady?: boolean;
  readiness?: {
    hasEntityTable?: boolean;
    hasEntityMembershipTable?: boolean;
    hasSeriesSourceConfigEntityId?: boolean;
    isReady?: boolean;
  };
  actor?: {
    userId?: string;
    email?: string;
    isPlatformAdmin?: boolean;
    accessLabel?: string;
  };
  entityCount?: number | null;
  seriesCount?: number | null;
  defaultSeriesConfigKey?: string | null;
  entities?: CricketAdminSeriesEntity[];
  series?: CricketAdminSeriesItem[];
};

export type CricketViewerSeriesResponse = {
  authFoundationReady?: boolean;
  readiness?: {
    hasEntityTable?: boolean;
    hasEntityMembershipTable?: boolean;
    hasSeriesSourceConfigEntityId?: boolean;
    isReady?: boolean;
  };
  actor?: {
    userId?: string;
    email?: string;
    isPlatformAdmin?: boolean;
    accessLabel?: string;
  };
  seriesCount?: number | null;
  defaultSeriesConfigKey?: string | null;
  series?: CricketAdminSeriesItem[];
};

export type CricketAdminViewerGrant = {
  grantId?: string;
  entityId?: string;
  seriesSourceConfigId?: number | null;
  userId?: string;
  accessRole?: string;
  status?: string;
  grantedByUserId?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  expiresAt?: string | null;
  isExpired?: boolean;
};

export type CricketAdminViewerGrantPayload = {
  userId?: string;
  email?: string;
  accessRole?: "viewer" | "analyst";
  expiresAt?: string | null;
};

export type CricketAdminSeriesAccessRequest = {
  requestId?: string;
  entityId?: string;
  seriesSourceConfigId?: number | null;
  requestedEmail?: string;
  requestedUserId?: string;
  requestedAccessRole?: string;
  requestType?: string;
  requestStatus?: string;
  requestNote?: string;
  adminResponseNote?: string;
  requestedByUserId?: string;
  reviewedByUserId?: string;
  requestedExpiresAt?: string | null;
  resolvedGrantId?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  resolvedAt?: string | null;
};

export type CricketAdminViewerGrantMutationResponse = {
  message?: string;
  dryRun?: boolean;
  grant?: CricketAdminViewerGrant;
  request?: CricketAdminSeriesAccessRequest | null;
};

export type CricketAdminViewerGrantsResponse = {
  actor?: {
    userId?: string;
    isPlatformAdmin?: boolean;
    isEntityAdmin?: boolean;
  };
  series?: {
    configKey?: string;
    seriesName?: string;
    entityId?: string;
    seriesSourceConfigId?: number | null;
  };
  subscription?: {
    planKey?: string;
    status?: string;
    maxViewerUsers?: number | null;
  };
  totals?: {
    totalGrants?: number | null;
    activeGrants?: number | null;
    activeViewers?: number | null;
    activeAnalysts?: number | null;
    revokedGrants?: number | null;
    totalRequests?: number | null;
    pendingRequests?: number | null;
    approvedRequests?: number | null;
    declinedRequests?: number | null;
  };
  grants?: CricketAdminViewerGrant[];
  requests?: CricketAdminSeriesAccessRequest[];
};

export type CricketAdminCreateSeriesPayload = {
  entityId: string;
  sourceSetup?: {
    name?: string;
    sourceSystem?: string;
    seriesUrl?: string;
    sourceSeriesId?: string;
    expectedLeagueName?: string;
    expectedSeriesName?: string;
    seasonYear?: number | null;
    targetAgeGroup?: string;
    scrapeCompletedOnly?: boolean;
    includeBallByBall?: boolean;
    includePlayerProfiles?: boolean;
    enableAutoDiscovery?: boolean;
    isActive?: boolean;
    notes?: string;
  };
  reportProfileKey?: string;
};

export type CricketAdminCreateSeriesResponse = {
  message?: string;
  dryRun?: boolean;
  series?: CricketAdminSeriesItem;
  payload?: CricketAdminSetupResponse;
};

export type CricketAdminEntityMembershipPayload = {
  userId?: string;
  email?: string;
  role?: "admin";
};

export type CricketAdminEntityMembershipMutationResponse = {
  message?: string;
  dryRun?: boolean;
  entity?: {
    entityId?: string;
    entityName?: string;
    entitySlug?: string;
    ownerUserId?: string;
  };
  membership?: CricketAdminEntityMembership | null;
  request?: CricketAdminEntityAccessRequest | null;
};

export type CricketSeriesAccessRequestPayload = {
  accessRole?: "viewer" | "analyst";
  requestNote?: string;
};

export type CricketSeriesAdminAccessRequestPayload = {
  requestNote?: string;
};

export type CricketSeriesAdminAccessRequestMutationResponse = {
  message?: string;
  dryRun?: boolean;
  accessGranted?: boolean;
  request?: CricketAdminEntityAccessRequest | null;
  membership?: CricketAdminEntityMembership | null;
};

export type CricketSeriesAccessRequestMutationResponse = {
  message?: string;
  dryRun?: boolean;
  accessGranted?: boolean;
  request?: CricketAdminSeriesAccessRequest | null;
  grant?: CricketAdminViewerGrant | null;
};

export type CricketAdminAccessRequestDecisionPayload = {
  action: "approve" | "decline";
  responseNote?: string;
};

export type CricketAdminEntityAccessRequestDecisionPayload = {
  action: "approve" | "decline";
  responseNote?: string;
};

export type CricketAdminSubscriptionSummaryResponse = {
  series?: {
    configKey?: string;
    seriesSourceConfigId?: number | null;
    seriesName?: string;
    entityId?: string;
    entitySlug?: string;
    entityName?: string;
    isActive?: boolean;
  };
  subscription?: {
    planKey?: string;
    planDisplayName?: string;
    status?: string;
    billingProvider?: string;
    billingCustomerRef?: string;
    billingSubscriptionRef?: string;
    contractOwnerEmail?: string;
    enforcementMode?: string;
    startsAt?: string | null;
    endsAt?: string | null;
  };
  usage?: {
    seriesCount?: number | null;
    activeSeriesCount?: number | null;
    adminUserCount?: number | null;
    viewerUserCount?: number | null;
  };
  limits?: {
    maxSeries?: number | null;
    maxAdminUsers?: number | null;
    maxViewerUsers?: number | null;
    seriesRemaining?: number | null;
    adminRemaining?: number | null;
    viewerRemaining?: number | null;
    seriesLimitReached?: boolean;
    adminLimitReached?: boolean;
    viewerLimitReached?: boolean;
  };
  entitlements?: {
    hasActiveSubscription?: boolean;
    manualRefreshEnabled?: boolean;
    scheduledRefreshEnabled?: boolean;
    weightTuningEnabled?: boolean;
    viewerGrantEnabled?: boolean;
  };
  warnings?: string[];
};

export type CricketAdminSetupResponse = {
  series?: {
    configKey?: string;
    seriesId?: number | null;
    seriesName?: string;
  };
  sourceSetup?: {
    id?: number | null;
    name?: string;
    sourceSystem?: string;
    seriesUrl?: string;
    expectedLeagueName?: string;
    expectedSeriesName?: string;
    seasonYear?: number | null;
    targetAgeGroup?: string;
    scrapeCompletedOnly?: boolean;
    includeBallByBall?: boolean;
    includePlayerProfiles?: boolean;
    enableAutoDiscovery?: boolean;
    isActive?: boolean;
    notes?: string;
  };
  divisions?: Array<{
    id?: number | null;
    targetLabel?: string;
    normalizedLabel?: string;
    phaseNo?: number | null;
    divisionNo?: number | null;
    strengthRank?: number | null;
    strengthTier?: string;
    includeFlag?: boolean;
    notes?: string;
    sourceDivisionId?: string;
    sourceLabel?: string;
    statsUrl?: string;
    resultsUrl?: string;
    aliases?: string[];
  }>;
  reportProfile?: {
    activeProfileKey?: string;
    activeProfileName?: string;
    options?: Array<{
      profileKey?: string;
      name?: string;
      description?: string;
    }>;
  };
  validationAnchors?: Array<{
    id?: number | null;
    entityType?: string;
    entityName?: string;
    expectationText?: string;
    priorityRank?: number | null;
    isActive?: boolean;
  }>;
  liveSummary?: {
    totalMatches?: number | null;
    warningMatches?: number | null;
    computedMatches?: number | null;
  };
};

export type CricketAdminSetupUpdatePayload = {
  sourceSetup?: {
    name?: string;
    seriesUrl?: string;
    expectedLeagueName?: string;
    expectedSeriesName?: string;
    seasonYear?: number | null;
    targetAgeGroup?: string;
    scrapeCompletedOnly?: boolean;
    includeBallByBall?: boolean;
    includePlayerProfiles?: boolean;
    enableAutoDiscovery?: boolean;
    isActive?: boolean;
    notes?: string;
  };
  reportProfileKey?: string;
  divisions?: Array<{
    id?: number | null;
    targetLabel?: string;
    phaseNo?: number | null;
    divisionNo?: number | null;
    strengthRank?: number | null;
    strengthTier?: string;
    includeFlag?: boolean;
    notes?: string;
  }>;
};

export type CricketAdminSetupMutationResponse = {
  message?: string;
  dryRun?: boolean;
  payload?: CricketAdminSetupResponse;
};

export type CricketAdminMatchOpsMatch = {
  matchId?: number | null;
  sourceMatchId?: string;
  divisionLabel?: string;
  matchDate?: string;
  matchDateLabel?: string;
  matchTitle?: string;
  resultText?: string;
  matchPageUrl?: string;
  scorecardUrl?: string;
  ballByBallUrl?: string;
  adminSelectionOverride?: string;
  adminOverrideReason?: string;
  analyticsStatus?: string;
  parseStatus?: string;
  reconciliationStatus?: string;
  needsRescrape?: boolean;
  needsReparse?: boolean;
  needsRecompute?: boolean;
  lastChangeReason?: string;
  lastErrorMessage?: string;
};

export type CricketAdminRefreshRequest = {
  requestId?: number | null;
  requestMatchUrl?: string;
  normalizedMatchUrl?: string;
  requestSourceMatchId?: string;
  linkedSourceMatchId?: string;
  reason?: string;
  requestedBy?: string;
  requestedAt?: string;
  status?: string;
  resolutionNote?: string;
  processedAt?: string | null;
};

export type CricketAdminSeriesOperationKey = "discover_new_matches" | "recompute_series";

export type CricketAdminSeriesOperationAvailability = {
  operationKey?: string;
  operationLabel?: string;
  supportStatus?: string;
  queueEnabled?: boolean;
  runnerMode?: string;
  supportNote?: string;
};

export type CricketAdminSeriesOperationRequest = {
  operationKey?: string;
  operationLabel?: string;
  supportStatus?: string;
  queueEnabled?: boolean;
  supportNote?: string;
  requestId?: string;
  requestStatus?: string;
  requestNote?: string;
  requestedByUserId?: string;
  requestedByLabel?: string;
  runnerMode?: string;
  workerRef?: string;
  lastWorkerNote?: string;
  resultSummary?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
};

export type CricketAdminMatchOpsResponse = {
  series?: {
    configKey?: string;
    seriesId?: number | null;
    seriesName?: string;
  };
  filters?: {
    query?: string;
    limit?: number | null;
  };
  summary?: {
    totalMatches?: number | null;
    warningMatches?: number | null;
    overriddenMatches?: number | null;
    computedMatches?: number | null;
    pendingOps?: number | null;
  };
  operationsSummary?: {
    totalRequests?: number | null;
    pendingRequests?: number | null;
    processingRequests?: number | null;
    completedRequests?: number | null;
    failedRequests?: number | null;
    latestRequestedAt?: string | null;
  };
  refreshSummary?: {
    totalRequests?: number | null;
    pendingRequests?: number | null;
    processingRequests?: number | null;
    completedRequests?: number | null;
    failedRequests?: number | null;
    latestRequestedAt?: string | null;
  };
  availableOperations?: CricketAdminSeriesOperationAvailability[];
  operationRequests?: CricketAdminSeriesOperationRequest[];
  matches?: CricketAdminMatchOpsMatch[];
  recentRequests?: CricketAdminRefreshRequest[];
};

export type CricketAdminRefreshRequestPayload = {
  matchUrl: string;
  reason?: string;
  requestedBy?: string;
};

export type CricketAdminRefreshRequestMutationResponse = {
  message?: string;
  request?: {
    requestId?: number | null;
    normalizedMatchUrl?: string;
    requestSourceMatchId?: string;
    requestedBy?: string;
    reason?: string;
  };
  resolvedMatch?: {
    matchId?: number | null;
    sourceMatchId?: string;
    divisionLabel?: string;
    matchTitle?: string;
  } | null;
};

export type CricketAdminSeriesOperationRequestPayload = {
  operationKey: CricketAdminSeriesOperationKey;
  requestNote?: string;
};

export type CricketAdminSeriesOperationRequestMutationResponse = {
  message?: string;
  dryRun?: boolean;
  request?: CricketAdminSeriesOperationRequest | null;
};

export type CricketAdminMatchSelectionOverride = "auto" | "force_include" | "force_exclude";

export type CricketAdminSelectionOverridePayload = {
  override: CricketAdminMatchSelectionOverride;
  reason?: string;
  requestedBy?: string;
};

export type CricketAdminSelectionOverrideMutationResponse = {
  message?: string;
  matchId?: number | null;
  sourceMatchId?: string;
  override?: CricketAdminMatchSelectionOverride;
  reason?: string;
};

export type CricketPlayerReportRouteState = {
  displayName?: string;
  teamName?: string;
  divisionLabel?: string;
  roleLabel?: string;
  searchQuery?: string;
  seriesConfigKey?: string;
  seriesName?: string;
};

export type CricketReportTone = "good" | "watch" | "risk" | string;

export type CricketPlayerReportMetric = {
  label?: string;
  value?: number | null;
  tone?: CricketReportTone;
  note?: string;
  badge?: string;
  primary?: boolean;
};

export type CricketPlayerStandardStat = {
  value?: number | string | null;
  detail?: string;
};

export type CricketPlayerReportMatchEvidence = {
  matchId?: number | null;
  matchDate?: string;
  matchDateLabel?: string;
  matchTitle?: string;
  score?: number | null;
  note?: string;
};

export type CricketPlayerReportPeerComparisonItem = {
  playerId?: number;
  divisionId?: number | null;
  displayName?: string;
  teamName?: string;
  roleLabel?: string;
  compositeScore?: number | null;
  percentileRank?: number | null;
  note?: string;
};

export type CricketPlayerReportTrendPoint = {
  label?: string;
  value?: number | null;
};

export type CricketPlayerReportTrend = {
  title?: string;
  status?: string;
  values?: CricketPlayerReportTrendPoint[];
  note?: string;
};

export type CricketPlayerReportMatchupSplit = {
  opponentPlayerId?: number | null;
  opponentName?: string;
  balls?: number | null;
  runs?: number | null;
  runsConceded?: number | null;
  strikeRate?: number | null;
  economy?: number | null;
  dotPct?: number | null;
  boundaryPct?: number | null;
  dismissals?: number | null;
  wickets?: number | null;
};

export type CricketPlayerReportCommentaryEvidence = {
  matchId?: number | null;
  matchDate?: string;
  matchDateLabel?: string;
  matchTitle?: string;
  inningsNo?: number | null;
  ballLabel?: string;
  phase?: string;
  involvementType?: string;
  strikerName?: string;
  bowlerName?: string;
  playerOutName?: string;
  batterRuns?: number | null;
  totalRuns?: number | null;
  wicketFlag?: boolean;
  dismissalType?: string;
  leverageScore?: number | null;
  totalEventWeight?: number | null;
  commentaryText?: string;
};

export type CricketPlayerReportOverEvidence = {
  matchId?: number | null;
  matchDate?: string;
  matchDateLabel?: string;
  matchTitle?: string;
  overNo?: number | null;
  balls?: number | null;
  runs?: number | null;
  wickets?: number | null;
  boundaries?: number | null;
  stateText?: string;
};

export type CricketPlayerReportPhasePerformance = {
  batting?: {
    overall?: CricketPlayerReportMatchupSplit[];
    powerplay?: CricketPlayerReportMatchupSplit[];
    middle?: CricketPlayerReportMatchupSplit[];
    death?: CricketPlayerReportMatchupSplit[];
  };
  bowling?: {
    overall?: CricketPlayerReportMatchupSplit[];
    powerplay?: CricketPlayerReportMatchupSplit[];
    middle?: CricketPlayerReportMatchupSplit[];
    death?: CricketPlayerReportMatchupSplit[];
  };
};

export type CricketPlayerReportResponse = {
  meta?: {
    generatedAt?: string;
    series?: {
      configKey?: string;
      name?: string;
      targetAgeGroup?: string;
    };
    reportProfile?: {
      key?: string;
      name?: string;
      themeName?: string;
      peerCount?: number | null;
    };
    scoringModel?: {
      modelKey?: string;
      name?: string;
      version?: string;
    };
    player?: {
      playerId?: number;
      divisionId?: number | null;
      playerName?: string;
      canonicalName?: string;
      teamName?: string;
      divisionOptions?: Array<{
        divisionId?: number | null;
        divisionLabel?: string;
        roleType?: string;
        compositeScore?: number | null;
      }>;
    };
  };
  header?: {
    playerName?: string;
    teamName?: string;
    primaryRole?: string;
    divisionLabel?: string;
    strengthSignal?: string;
    comparisonPool?: string;
    percentileRank?: number | null;
    confidenceScore?: number | null;
    confidenceLabel?: string;
    recommendation?: string;
    quickRead?: string;
  };
  scores?: {
    compositeScore?: number | null;
    tierLabel?: string;
    breakdown?: Array<{
      key?: string;
      label?: string;
      value?: number | null;
    }>;
  };
  assessmentSnapshot?: CricketPlayerReportMetric[];
  visualReadout?: CricketPlayerReportMetric[];
  contextPerformance?: CricketPlayerReportMetric[];
  selectorInterpretation?: CricketPlayerReportMetric[];
  matchEvidence?: CricketPlayerReportMatchEvidence[];
  peerComparison?: CricketPlayerReportPeerComparisonItem[];
  trends?: CricketPlayerReportTrend[];
  drilldowns?: {
    battingVsBowlers?: CricketPlayerReportMatchupSplit[];
    bowlingVsBatters?: CricketPlayerReportMatchupSplit[];
    commentaryEvidence?: CricketPlayerReportCommentaryEvidence[];
    dismissalFieldingLog?: Array<Record<string, unknown>>;
    overEvidence?: {
      batting?: CricketPlayerReportOverEvidence[];
      bowlingBest?: CricketPlayerReportOverEvidence[];
      bowlingExpensive?: CricketPlayerReportOverEvidence[];
    };
    phasePerformance?: CricketPlayerReportPhasePerformance;
  };
  selectorTakeaway?: string;
  standardStats?: {
    currentSeries?: {
      batting?: CricketPlayerStandardStat;
      bowling?: CricketPlayerStandardStat;
      fielding?: CricketPlayerStandardStat;
      wicketkeeping?: CricketPlayerStandardStat;
    };
    overall?: {
      batting?: CricketPlayerStandardStat;
      bowling?: CricketPlayerStandardStat;
      fielding?: CricketPlayerStandardStat;
      wicketkeeping?: CricketPlayerStandardStat;
    };
  };
  reportPayload?: {
    recommendationBadge?: {
      label?: string;
      tone?: CricketReportTone;
      confidenceLabel?: string;
      confidenceScore?: number | null;
      percentileRank?: number | null;
      quickRead?: string;
      selectorTakeaway?: string;
    };
  };
};

export type CricketPlayerIntelligenceSignalCard = {
  label?: string;
  tone?: CricketReportTone;
  metricLabel?: string;
  metricValue?: number | null;
  note?: string;
};

export type CricketPlayerIntelligenceMatchupRow = {
  scopeType?: string;
  divisionId?: number | null;
  playerId?: number | null;
  perspective?: string;
  splitGroup?: string;
  splitValue?: string;
  splitLabel?: string;
  phaseBucket?: string;
  matchCount?: number | null;
  deliveryEvents?: number | null;
  legalBalls?: number | null;
  runsScored?: number | null;
  runsConceded?: number | null;
  dismissals?: number | null;
  wickets?: number | null;
  dotBalls?: number | null;
  boundaries?: number | null;
  wides?: number | null;
  noBalls?: number | null;
  strikeRate?: number | null;
  economy?: number | null;
  battingAverage?: number | null;
  ballsPerDismissal?: number | null;
  ballsPerWicket?: number | null;
  dotBallPct?: number | null;
  boundaryBallPct?: number | null;
  controlErrorPct?: number | null;
};

export type CricketPlayerIntelligenceDismissalRow = {
  scopeType?: string;
  divisionId?: number | null;
  playerId?: number | null;
  bowlerStyleBucket?: string;
  bowlerStyleLabel?: string;
  dismissalType?: string;
  dismissalCount?: number | null;
  matchCount?: number | null;
  averageRunsAtDismissal?: number | null;
  averageBallsFacedAtDismissal?: number | null;
};

export type CricketPlayerIntelligencePressureProfile = {
  battingRotationRatio?: number | null;
  battingHighLeverageStrikeRate?: number | null;
  bowlingHighLeverageEconomy?: number | null;
  bowlingPressureControlErrorPct?: number | null;
  boundaryDotThreshold?: number | null;
  dismissalDotThreshold?: number | null;
  boundaryAfterThreeDotsPct?: number | null;
  dismissalAfterThreeDotsPct?: number | null;
} | null;

export type CricketPlayerIntelligenceLens = {
  scopeType?: string;
  divisionId?: number | null;
  divisionLabel?: string;
  sample?: {
    battingMatchCount?: number | null;
    bowlingMatchCount?: number | null;
    battingLegalBalls?: number | null;
    bowlingLegalBalls?: number | null;
  };
  batting?: {
    overall?: CricketPlayerIntelligenceMatchupRow | null;
    byPhase?: {
      powerplay?: CricketPlayerIntelligenceMatchupRow | null;
      middle?: CricketPlayerIntelligenceMatchupRow | null;
      death?: CricketPlayerIntelligenceMatchupRow | null;
    };
    byBowlerType?: CricketPlayerIntelligenceMatchupRow[];
    byBowlerTypePhase?: {
      powerplay?: CricketPlayerIntelligenceMatchupRow[];
      middle?: CricketPlayerIntelligenceMatchupRow[];
      death?: CricketPlayerIntelligenceMatchupRow[];
    };
  };
  bowling?: {
    overall?: CricketPlayerIntelligenceMatchupRow | null;
    byPhase?: {
      powerplay?: CricketPlayerIntelligenceMatchupRow | null;
      middle?: CricketPlayerIntelligenceMatchupRow | null;
      death?: CricketPlayerIntelligenceMatchupRow | null;
    };
    byBatterHand?: CricketPlayerIntelligenceMatchupRow[];
    byBatterHandPhase?: {
      powerplay?: CricketPlayerIntelligenceMatchupRow[];
      middle?: CricketPlayerIntelligenceMatchupRow[];
      death?: CricketPlayerIntelligenceMatchupRow[];
    };
  };
  dismissals?: CricketPlayerIntelligenceDismissalRow[];
  pressureProfile?: CricketPlayerIntelligencePressureProfile;
};

export type CricketPlayerIntelligenceEvidenceItem = {
  matchId?: number | null;
  sourceMatchId?: string;
  matchDate?: string;
  matchDateLabel?: string;
  matchTitle?: string;
  divisionLabel?: string;
  matchPageUrl?: string;
  scorecardUrl?: string;
  ballByBallUrl?: string;
  inningsNo?: number | null;
  ballLabel?: string;
  phase?: string;
  strikerName?: string;
  bowlerName?: string;
  playerOutName?: string;
  batterRuns?: number | null;
  totalRuns?: number | null;
  wicketFlag?: boolean;
  wicketCreditedToBowler?: boolean;
  dismissalType?: string;
  leverageScore?: number | null;
  totalEventWeight?: number | null;
  commentaryText?: string;
  headline?: string;
};

export type CricketPlayerIntelligenceResponse = {
  meta?: {
    generatedAt?: string;
    reportType?: string;
    series?: {
      configKey?: string;
      name?: string;
      targetAgeGroup?: string;
    };
    scope?: {
      requestedDivisionId?: number | null;
      resolvedScopeType?: string;
      divisionId?: number | null;
      divisionLabel?: string;
      scopeLabel?: string;
      fallbackApplied?: boolean;
      fallbackReason?: string;
    };
    player?: {
      playerId?: number;
      primaryDivisionId?: number | null;
      primaryDivisionLabel?: string;
      divisionOptions?: Array<{
        divisionId?: number | null;
        divisionLabel?: string;
        roleType?: string;
        roleLabel?: string;
        compositeScore?: number | null;
        confidenceScore?: number | null;
      }>;
    };
    sources?: string[];
  };
  header?: {
    playerName?: string;
    canonicalName?: string;
    teamName?: string;
    roleType?: string;
    roleLabel?: string;
    primaryRoleBucket?: string;
    battingStyle?: string;
    bowlingStyle?: string;
    isWicketkeeper?: boolean;
    recommendationLabel?: string;
    compositeScore?: number | null;
    percentileRank?: number | null;
    confidenceScore?: number | null;
    confidenceLabel?: string;
  };
  tacticalSummary?: {
    strengths?: CricketPlayerIntelligenceSignalCard[];
    watchouts?: CricketPlayerIntelligenceSignalCard[];
    pressureSignals?: CricketPlayerIntelligenceSignalCard[];
  };
  focusedLens?: CricketPlayerIntelligenceLens | null;
  seriesLens?: CricketPlayerIntelligenceLens | null;
  tacticalPlan?: {
    battingPlan?: string[];
    bowlingPlan?: string[];
  };
  commentaryEvidence?: {
    batting?: CricketPlayerIntelligenceEvidenceItem[];
    bowling?: CricketPlayerIntelligenceEvidenceItem[];
    dismissals?: CricketPlayerIntelligenceEvidenceItem[];
  };
};

export type CricketPlayerReportChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type CricketPlayerReportChatEvidenceItem = {
  label?: string;
  detail?: string;
};

export type CricketPlayerReportChatResponse = {
  answer?: string;
  evidence?: CricketPlayerReportChatEvidenceItem[];
  followUps?: string[];
  limitations?: string[];
};

export function getCricketApiBase() {
  const configuredBase = import.meta.env.VITE_CRICKET_API_BASE?.trim();
  if (configuredBase) {
    return stripTrailingSlash(configuredBase);
  }

  if (typeof window !== "undefined" && isLocalCricketHost(window.location.hostname)) {
    return DEFAULT_LOCAL_CRICKET_API_BASE;
  }

  return DEFAULT_HOSTED_CRICKET_API_BASE;
}

export function getCricketApiUrl(path: string) {
  return joinBaseAndPath(getCricketApiBase(), path);
}

type CricketPlayerTarget = Pick<CricketPlayerSearchResult, "playerId" | "divisionId">;

type CricketPlayerRouteOptions = {
  searchQuery?: string;
  seriesConfigKey?: string | null;
};

function appendPlayerQueryParams(result: CricketPlayerTarget, options?: CricketPlayerRouteOptions) {
  const query = new URLSearchParams();
  if (result.divisionId !== null && result.divisionId !== undefined) {
    query.set("divisionId", String(result.divisionId));
  }
  if (options?.searchQuery?.trim()) {
    query.set("q", options.searchQuery.trim());
  }
  if (options?.seriesConfigKey?.trim()) {
    query.set("series", options.seriesConfigKey.trim());
  }

  return query;
}

function getStandalonePlayerReportPath(result: CricketPlayerTarget, seriesConfigKey?: string | null) {
  if (seriesConfigKey?.trim()) {
    return `/series/${encodeURIComponent(seriesConfigKey.trim())}/players/${result.playerId}/report`;
  }

  return `/players/${result.playerId}`;
}

function getPlayerReportApiPath(result: CricketPlayerTarget, seriesConfigKey?: string | null) {
  if (seriesConfigKey?.trim()) {
    return `/api/series/${encodeURIComponent(seriesConfigKey.trim())}/players/${result.playerId}/report`;
  }

  return `/api/players/${result.playerId}/report`;
}

function getPlayerIntelligenceApiPath(result: CricketPlayerTarget, seriesConfigKey?: string | null) {
  if (seriesConfigKey?.trim()) {
    return `/api/series/${encodeURIComponent(seriesConfigKey.trim())}/players/${result.playerId}/intelligence`;
  }

  return `/api/players/${result.playerId}/intelligence`;
}

function getPlayerReportDocumentApiPath(result: CricketPlayerTarget, seriesConfigKey?: string | null) {
  if (seriesConfigKey?.trim()) {
    return `/api/series/${encodeURIComponent(seriesConfigKey.trim())}/players/${result.playerId}/report/html`;
  }

  return `/api/players/${result.playerId}/report/html`;
}

function getPlayerSearchApiPath(seriesConfigKey?: string | null) {
  if (seriesConfigKey?.trim()) {
    return `/api/series/${encodeURIComponent(seriesConfigKey.trim())}/players/search`;
  }

  return "/api/players/search";
}

export function getCricketPlayerReportUrl(
  result: CricketPlayerTarget,
  options?: Pick<CricketPlayerRouteOptions, "seriesConfigKey">
) {
  const query = appendPlayerQueryParams(result);
  const basePath = getCricketApiUrl(getStandalonePlayerReportPath(result, options?.seriesConfigKey));
  const search = query.toString();
  return search ? `${basePath}?${search}` : basePath;
}

export function getCricketPlayerReportApiUrl(
  result: CricketPlayerTarget,
  options?: Pick<CricketPlayerRouteOptions, "seriesConfigKey">
) {
  const query = appendPlayerQueryParams(result);
  const basePath = getCricketApiUrl(getPlayerReportApiPath(result, options?.seriesConfigKey));
  const search = query.toString();
  return search ? `${basePath}?${search}` : basePath;
}

export function getCricketPlayerReportDocumentUrl(
  result: CricketPlayerTarget,
  options?: Pick<CricketPlayerRouteOptions, "seriesConfigKey">
) {
  const query = appendPlayerQueryParams(result);
  const basePath = getCricketApiUrl(getPlayerReportDocumentApiPath(result, options?.seriesConfigKey));
  const search = query.toString();
  return search ? `${basePath}?${search}` : basePath;
}

export function getRootCricketPlayerReportRoute(result: CricketPlayerTarget, options?: CricketPlayerRouteOptions) {
  const query = appendPlayerQueryParams(result, options);
  const search = query.toString();
  const basePath = `/analytics/reports/${result.playerId}`;
  return search ? `${basePath}?${search}` : basePath;
}

export function getRootCricketPlayerIntelligenceRoute(result: CricketPlayerTarget, options?: CricketPlayerRouteOptions) {
  const query = appendPlayerQueryParams(result, options);
  const search = query.toString();
  const basePath = `/analytics/intelligence/${result.playerId}`;
  return search ? `${basePath}?${search}` : basePath;
}

function getAnalyticsRoute(basePath: string, searchQuery?: string, seriesConfigKey?: string | null) {
  const query = new URLSearchParams();
  const trimmedQuery = searchQuery?.trim();
  const trimmedSeries = seriesConfigKey?.trim();

  if (trimmedQuery) {
    query.set("q", trimmedQuery);
  }
  if (trimmedSeries) {
    query.set("series", trimmedSeries);
  }

  const search = query.toString();
  return search ? `${basePath}?${search}` : basePath;
}

export function getAnalyticsSearchRoute(searchQuery?: string, seriesConfigKey?: string | null) {
  return getAnalyticsRoute("/analytics", searchQuery, seriesConfigKey);
}

export function getAnalyticsWorkspaceRoute(searchQuery?: string, seriesConfigKey?: string | null) {
  return getAnalyticsRoute("/analytics/workspace", searchQuery, seriesConfigKey);
}

export function getAnalyticsAdminRoute(seriesConfigKey?: string | null) {
  return getAnalyticsRoute("/analytics/admin", undefined, seriesConfigKey);
}

export function getAnalyticsPlatformAdminRoute() {
  return "/analytics/admin/platform";
}

export function getAnalyticsSeriesAdminRoute(seriesConfigKey?: string | null) {
  return getAnalyticsRoute("/analytics/admin/series", undefined, seriesConfigKey);
}

async function readApiErrorMessage(response: Response, fallbackMessage: string) {
  let message = fallbackMessage;

  try {
    const payload = await response.json();
    if (typeof payload?.error === "string" && payload.error) {
      message = payload.error;
    }
  } catch {
    // Keep the fallback message when the response body is not JSON.
  }

  return message;
}

export async function searchCricketPlayers(
  query: string,
  options?: {
    accessToken: string;
    seriesConfigKey?: string | null;
    signal?: AbortSignal;
  }
) {
  const url = new URL(getCricketApiUrl(getPlayerSearchApiPath(options?.seriesConfigKey)), window.location.origin);
  url.searchParams.set("q", query);

  const response = await fetch(url.toString(), {
    method: "GET",
    signal: options?.signal,
    headers: {
      Authorization: `Bearer ${options?.accessToken || ""}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, `Search request failed with status ${response.status}.`));
  }

  return (await response.json()) as CricketPlayerSearchResponse;
}

export async function fetchCricketDashboardSummary(signal?: AbortSignal) {
  const url = new URL(getCricketApiUrl("/api/dashboard/summary"), window.location.origin);
  const response = await fetch(url.toString(), {
    method: "GET",
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, `Dashboard summary request failed with status ${response.status}.`));
  }

  return (await response.json()) as CricketDashboardSummaryResponse;
}

export async function fetchCricketSeriesOverview(seriesConfigKey: string, signal?: AbortSignal) {
  const url = new URL(
    getCricketApiUrl(`/api/series/${encodeURIComponent(seriesConfigKey)}/dashboard/overview`),
    window.location.origin
  );
  const response = await fetch(url.toString(), {
    method: "GET",
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, `Series overview request failed with status ${response.status}.`));
  }

  return (await response.json()) as CricketSeriesOverviewResponse;
}

export async function fetchCricketPlayerReport(
  result: CricketPlayerTarget,
  options?: {
    accessToken: string;
    seriesConfigKey?: string | null;
    signal?: AbortSignal;
  }
) {
  const url = new URL(getCricketPlayerReportApiUrl(result, { seriesConfigKey: options?.seriesConfigKey }), window.location.origin);
  const response = await fetch(url.toString(), {
    method: "GET",
    signal: options?.signal,
    headers: {
      Authorization: `Bearer ${options?.accessToken || ""}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, `Report request failed with status ${response.status}.`));
  }

  return (await response.json()) as CricketPlayerReportResponse;
}

export async function fetchCricketPlayerIntelligence(
  result: CricketPlayerTarget,
  options?: {
    accessToken: string;
    seriesConfigKey?: string | null;
    signal?: AbortSignal;
  }
) {
  const url = new URL(
    getCricketApiUrl(getPlayerIntelligenceApiPath(result, options?.seriesConfigKey)),
    window.location.origin
  );
  if (result.divisionId !== null && result.divisionId !== undefined) {
    url.searchParams.set("divisionId", String(result.divisionId));
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    signal: options?.signal,
    headers: {
      Authorization: `Bearer ${options?.accessToken || ""}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      await readApiErrorMessage(response, `Player intelligence request failed with status ${response.status}.`)
    );
  }

  return (await response.json()) as CricketPlayerIntelligenceResponse;
}

export async function fetchCricketAdminSeries(accessToken: string, signal?: AbortSignal) {
  const url = new URL(getCricketApiUrl("/api/admin/series"), window.location.origin);
  const response = await fetch(url.toString(), {
    method: "GET",
    signal,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, `Admin series request failed with status ${response.status}.`));
  }

  return (await response.json()) as CricketAdminSeriesResponse;
}

export async function createCricketAdminSeries(
  accessToken: string,
  body: CricketAdminCreateSeriesPayload,
  options?: {
    dryRun?: boolean;
    signal?: AbortSignal;
  }
) {
  const url = new URL(getCricketApiUrl("/api/admin/series"), window.location.origin);

  if (options?.dryRun) {
    url.searchParams.set("dryRun", "true");
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    signal: options?.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, `Create series request failed with status ${response.status}.`));
  }

  return (await response.json()) as CricketAdminCreateSeriesResponse;
}

export async function assignCricketAdminEntityMembership(
  entityId: string,
  accessToken: string,
  body: CricketAdminEntityMembershipPayload,
  options?: {
    dryRun?: boolean;
    signal?: AbortSignal;
  }
) {
  const url = new URL(
    getCricketApiUrl(`/api/admin/entities/${encodeURIComponent(entityId)}/admins`),
    window.location.origin
  );

  if (options?.dryRun) {
    url.searchParams.set("dryRun", "true");
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    signal: options?.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, `Entity admin assignment failed with status ${response.status}.`));
  }

  return (await response.json()) as CricketAdminEntityMembershipMutationResponse;
}

export async function removeCricketAdminEntityMembership(
  entityId: string,
  userId: string,
  accessToken: string,
  options?: {
    dryRun?: boolean;
    signal?: AbortSignal;
  }
) {
  const url = new URL(
    getCricketApiUrl(`/api/admin/entities/${encodeURIComponent(entityId)}/admins/${encodeURIComponent(userId)}`),
    window.location.origin
  );

  if (options?.dryRun) {
    url.searchParams.set("dryRun", "true");
  }

  const response = await fetch(url.toString(), {
    method: "DELETE",
    signal: options?.signal,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, `Entity admin removal failed with status ${response.status}.`));
  }

  return (await response.json()) as CricketAdminEntityMembershipMutationResponse;
}

export async function decideCricketAdminEntityAccessRequest(
  entityId: string,
  requestId: string,
  accessToken: string,
  body: CricketAdminEntityAccessRequestDecisionPayload,
  options?: {
    dryRun?: boolean;
    signal?: AbortSignal;
  }
) {
  const url = new URL(
    getCricketApiUrl(`/api/admin/entities/${encodeURIComponent(entityId)}/admin-access-requests/${encodeURIComponent(requestId)}/decision`),
    window.location.origin
  );

  if (options?.dryRun) {
    url.searchParams.set("dryRun", "true");
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    signal: options?.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, `Entity admin access decision failed with status ${response.status}.`));
  }

  return (await response.json()) as CricketAdminEntityMembershipMutationResponse;
}

export async function fetchCricketViewerSeries(accessToken: string, signal?: AbortSignal) {
  const url = new URL(getCricketApiUrl("/api/viewer/series"), window.location.origin);
  const response = await fetch(url.toString(), {
    method: "GET",
    signal,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, `Viewer series request failed with status ${response.status}.`));
  }

  return (await response.json()) as CricketViewerSeriesResponse;
}

export async function askCricketPlayerReportChat(
  seriesConfigKey: string,
  playerId: number,
  accessToken: string,
  body: {
    question: string;
    history?: CricketPlayerReportChatHistoryMessage[];
    divisionId?: number | null;
    report?: CricketPlayerReportResponse | null;
  },
  signal?: AbortSignal
) {
  const url = new URL(
    getCricketApiUrl(`/api/series/${encodeURIComponent(seriesConfigKey)}/players/${playerId}/chat`),
    window.location.origin
  );
  const response = await fetch(url.toString(), {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, `Player report chat failed with status ${response.status}.`));
  }

  return (await response.json()) as CricketPlayerReportChatResponse;
}

export async function fetchCricketAdminSetup(
  seriesConfigKey: string,
  accessToken: string,
  signal?: AbortSignal
) {
  const url = new URL(
    getCricketApiUrl(`/api/series/${encodeURIComponent(seriesConfigKey)}/admin/setup`),
    window.location.origin
  );
  const response = await fetch(url.toString(), {
    method: "GET",
    signal,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, `Admin setup request failed with status ${response.status}.`));
  }

  return (await response.json()) as CricketAdminSetupResponse;
}

export async function updateCricketAdminSetup(
  seriesConfigKey: string,
  accessToken: string,
  body: CricketAdminSetupUpdatePayload,
  options?: {
    dryRun?: boolean;
    signal?: AbortSignal;
  }
) {
  const url = new URL(
    getCricketApiUrl(`/api/series/${encodeURIComponent(seriesConfigKey)}/admin/setup`),
    window.location.origin
  );

  if (options?.dryRun) {
    url.searchParams.set("dryRun", "true");
  }

  const response = await fetch(url.toString(), {
    method: "PUT",
    signal: options?.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, `Admin setup update failed with status ${response.status}.`));
  }

  return (await response.json()) as CricketAdminSetupMutationResponse;
}

export async function fetchCricketAdminMatchOps(
  seriesConfigKey: string,
  accessToken: string,
  options?: {
    query?: string;
    limit?: number;
    signal?: AbortSignal;
  }
) {
  const url = new URL(
    getCricketApiUrl(`/api/series/${encodeURIComponent(seriesConfigKey)}/admin/matches`),
    window.location.origin
  );

  if (options?.query?.trim()) {
    url.searchParams.set("query", options.query.trim());
  }
  if (options?.limit) {
    url.searchParams.set("limit", String(options.limit));
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    signal: options?.signal,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, `Admin match ops request failed with status ${response.status}.`));
  }

  return (await response.json()) as CricketAdminMatchOpsResponse;
}

export async function fetchCricketAdminViewerGrants(
  seriesConfigKey: string,
  accessToken: string,
  signal?: AbortSignal
) {
  const url = new URL(
    getCricketApiUrl(`/api/series/${encodeURIComponent(seriesConfigKey)}/admin/viewers`),
    window.location.origin
  );
  const response = await fetch(url.toString(), {
    method: "GET",
    signal,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, `Admin viewer grants request failed with status ${response.status}.`));
  }

  return (await response.json()) as CricketAdminViewerGrantsResponse;
}

export async function fetchCricketAdminSubscriptionSummary(
  seriesConfigKey: string,
  accessToken: string,
  signal?: AbortSignal
) {
  const url = new URL(
    getCricketApiUrl(`/api/series/${encodeURIComponent(seriesConfigKey)}/admin/subscription`),
    window.location.origin
  );
  const response = await fetch(url.toString(), {
    method: "GET",
    signal,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, `Admin subscription request failed with status ${response.status}.`));
  }

  return (await response.json()) as CricketAdminSubscriptionSummaryResponse;
}

export async function createCricketAdminViewerGrant(
  seriesConfigKey: string,
  accessToken: string,
  body: CricketAdminViewerGrantPayload,
  options?: {
    dryRun?: boolean;
    signal?: AbortSignal;
  }
) {
  const url = new URL(
    getCricketApiUrl(`/api/series/${encodeURIComponent(seriesConfigKey)}/admin/viewers`),
    window.location.origin
  );

  if (options?.dryRun) {
    url.searchParams.set("dryRun", "true");
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    signal: options?.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, `Viewer grant request failed with status ${response.status}.`));
  }

  return (await response.json()) as CricketAdminViewerGrantMutationResponse;
}

export async function decideCricketAdminAccessRequest(
  seriesConfigKey: string,
  requestId: string,
  accessToken: string,
  body: CricketAdminAccessRequestDecisionPayload,
  options?: {
    dryRun?: boolean;
    signal?: AbortSignal;
  }
) {
  const url = new URL(
    getCricketApiUrl(`/api/series/${encodeURIComponent(seriesConfigKey)}/admin/viewer-requests/${encodeURIComponent(requestId)}`),
    window.location.origin
  );

  if (options?.dryRun) {
    url.searchParams.set("dryRun", "true");
  }

  const response = await fetch(url.toString(), {
    method: "PATCH",
    signal: options?.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, `Access-request decision failed with status ${response.status}.`));
  }

  return (await response.json()) as CricketSeriesAccessRequestMutationResponse;
}

export async function revokeCricketAdminViewerGrant(
  seriesConfigKey: string,
  grantId: string,
  accessToken: string,
  options?: {
    dryRun?: boolean;
    signal?: AbortSignal;
  }
) {
  const url = new URL(
    getCricketApiUrl(`/api/series/${encodeURIComponent(seriesConfigKey)}/admin/viewers/${encodeURIComponent(grantId)}`),
    window.location.origin
  );

  if (options?.dryRun) {
    url.searchParams.set("dryRun", "true");
  }

  const response = await fetch(url.toString(), {
    method: "DELETE",
    signal: options?.signal,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, `Viewer revoke request failed with status ${response.status}.`));
  }

  return (await response.json()) as CricketAdminViewerGrantMutationResponse;
}

export async function createCricketAdminRefreshRequest(
  seriesConfigKey: string,
  accessToken: string,
  body: CricketAdminRefreshRequestPayload,
  options?: {
    dryRun?: boolean;
    signal?: AbortSignal;
  }
) {
  const url = new URL(
    getCricketApiUrl(`/api/series/${encodeURIComponent(seriesConfigKey)}/admin/matches/refresh-requests`),
    window.location.origin
  );

  if (options?.dryRun) {
    url.searchParams.set("dryRun", "true");
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    signal: options?.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, `Refresh request failed with status ${response.status}.`));
  }

  return (await response.json()) as CricketAdminRefreshRequestMutationResponse;
}

export async function createCricketAdminSeriesOperationRequest(
  seriesConfigKey: string,
  accessToken: string,
  body: CricketAdminSeriesOperationRequestPayload,
  options?: {
    dryRun?: boolean;
    signal?: AbortSignal;
  }
) {
  const url = new URL(
    getCricketApiUrl(`/api/series/${encodeURIComponent(seriesConfigKey)}/admin/operations/requests`),
    window.location.origin
  );

  if (options?.dryRun) {
    url.searchParams.set("dryRun", "true");
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    signal: options?.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, `Series operation request failed with status ${response.status}.`));
  }

  return (await response.json()) as CricketAdminSeriesOperationRequestMutationResponse;
}

export async function createCricketSeriesAccessRequest(
  seriesConfigKey: string,
  accessToken: string,
  body: CricketSeriesAccessRequestPayload,
  options?: {
    dryRun?: boolean;
    signal?: AbortSignal;
  }
) {
  const url = new URL(
    getCricketApiUrl(`/api/series/${encodeURIComponent(seriesConfigKey)}/access-requests`),
    window.location.origin
  );

  if (options?.dryRun) {
    url.searchParams.set("dryRun", "true");
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    signal: options?.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, `Series access request failed with status ${response.status}.`));
  }

  return (await response.json()) as CricketSeriesAccessRequestMutationResponse;
}

export async function createCricketSeriesAdminAccessRequest(
  seriesConfigKey: string,
  accessToken: string,
  body: CricketSeriesAdminAccessRequestPayload,
  options?: {
    dryRun?: boolean;
    signal?: AbortSignal;
  }
) {
  const url = new URL(
    getCricketApiUrl(`/api/series/${encodeURIComponent(seriesConfigKey)}/admin-access-requests`),
    window.location.origin
  );

  if (options?.dryRun) {
    url.searchParams.set("dryRun", "true");
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    signal: options?.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, `Series-admin access request failed with status ${response.status}.`));
  }

  return (await response.json()) as CricketSeriesAdminAccessRequestMutationResponse;
}

export async function updateCricketAdminSelectionOverride(
  seriesConfigKey: string,
  matchId: number,
  accessToken: string,
  body: CricketAdminSelectionOverridePayload,
  options?: {
    dryRun?: boolean;
    signal?: AbortSignal;
  }
) {
  const url = new URL(
    getCricketApiUrl(`/api/series/${encodeURIComponent(seriesConfigKey)}/admin/matches/${matchId}/selection-override`),
    window.location.origin
  );

  if (options?.dryRun) {
    url.searchParams.set("dryRun", "true");
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    signal: options?.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, `Selection override update failed with status ${response.status}.`));
  }

  return (await response.json()) as CricketAdminSelectionOverrideMutationResponse;
}
