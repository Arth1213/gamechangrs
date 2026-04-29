import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, MessageSquareText, SendHorizontal, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  askCricketPlayerReportChat,
  type CricketPlayerReportChatEvidenceItem,
  type CricketPlayerReportChatHistoryMessage,
  type CricketPlayerReportChatResponse,
  type CricketPlayerReportResponse,
} from "@/lib/cricketApi";
import { cn } from "@/lib/utils";

type PlayerReportChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  evidence?: PlayerReportChatEvidenceItem[];
  followUps?: string[];
  limitations?: string[];
  error?: boolean;
  includeInHistory?: boolean;
};

type PlayerReportChatProps = {
  report: CricketPlayerReportResponse | null;
  playerName: string;
  playerId?: number | null;
  seriesConfigKey?: string | null;
  seriesName?: string | null;
  divisionId?: number | null;
  divisionLabel?: string | null;
  mode?: "report" | "intelligence";
};

function getMessageId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildIntroMessage(
  playerName: string,
  seriesName?: string | null,
  mode: "report" | "intelligence" = "report"
): PlayerReportChatMessage {
  const subject = mode === "intelligence"
    ? "intelligence, tactics, evidence, or series context"
    : "report, evidence, clips, or series context";

  return {
    id: "intro",
    role: "assistant",
    content: seriesName
      ? `Ask about ${playerName}'s ${subject} in ${seriesName}.`
      : `Ask about ${playerName}'s ${subject}.`,
    includeInHistory: false,
  };
}

function buildHistory(messages: PlayerReportChatMessage[]) {
  return messages
    .filter((message): message is PlayerReportChatMessage & { role: "assistant" | "user" } => message.includeInHistory !== false)
    .map<CricketPlayerReportChatHistoryMessage>((message) => ({
      role: message.role,
      content: message.content,
    }))
    .slice(-8);
}

function dedupePrompts(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const prompts: string[] = [];

  values.forEach((value) => {
    const prompt = value?.trim();
    if (!prompt) {
      return;
    }

    const key = prompt.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    prompts.push(prompt);
  });

  return prompts;
}

const PlayerReportChat = ({
  report,
  playerName,
  playerId,
  seriesConfigKey,
  seriesName,
  divisionId,
  divisionLabel,
  mode = "report",
}: PlayerReportChatProps) => {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [messages, setMessages] = useState<PlayerReportChatMessage[]>(() => [
    buildIntroMessage(playerName, seriesName, mode),
  ]);
  const endRef = useRef<HTMLDivElement | null>(null);

  const resolvedPlayerId = playerId ?? report?.meta?.player?.playerId ?? null;
  const commentaryCount = report?.drilldowns?.commentaryEvidence?.length ?? 0;
  const matchEvidenceCount = report?.matchEvidence?.length ?? 0;
  const peerCount = report?.peerComparison?.length ?? 0;
  const canChat = Boolean(seriesConfigKey && resolvedPlayerId);

  const starterQuestions = useMemo(() => {
    if (mode === "intelligence") {
      return dedupePrompts([
        `Summarize ${playerName}'s player intelligence from the live series data.`,
        `What tactical plan comes out of ${playerName}'s current matchup and pressure profile?`,
        `Which bowling styles or batter-hand splits matter most for ${playerName}?`,
        `Show me some ball-by-ball evidence behind this intelligence view.`,
      ]).slice(0, 4);
    }

    return dedupePrompts([
      report?.reportPayload?.recommendationBadge?.label
        ? `Why is ${playerName} rated ${report.reportPayload.recommendationBadge.label.toLowerCase()} in this report?`
        : `Summarize ${playerName}'s selector case from the current series data.`,
      report?.contextPerformance?.length ? `How has ${playerName} performed when opposition quality rises?` : null,
      peerCount > 1 ? `How does ${playerName} compare with the peer group in this role?` : null,
      commentaryCount > 0 ? `Show me some ball-by-ball commentary that explains this report.` : null,
      report?.drilldowns?.phasePerformance ? `Break down ${playerName}'s phase performance from the live report.` : null,
    ]).slice(0, 4);
  }, [commentaryCount, mode, peerCount, playerName, report]);

  useEffect(() => {
    setMessages([buildIntroMessage(playerName, seriesName, mode)]);
    setInput("");
    setIsSubmitting(false);
  }, [mode, playerName, resolvedPlayerId, seriesConfigKey, seriesName]);

  const assistantLabel = mode === "intelligence"
    ? "Game-Changrs intelligence assistant"
    : "Game-Changrs report assistant";
  const panelDescription = mode === "intelligence"
    ? "Ask about the intelligence view, tactics, match evidence, or broader series context."
    : "Ask about the report, match evidence, clips, or series context.";
  const submittingLabel = mode === "intelligence" ? "Reviewing the live intelligence." : "Reviewing the live report.";
  const inputPlaceholder = canChat
    ? mode === "intelligence"
      ? "Ask about tactics, pressure, matchups, or series context."
      : "Ask about the report, evidence, clips, or series context."
    : mode === "intelligence"
      ? "Waiting for live intelligence context..."
      : "Waiting for live report summary...";
  const footerLabel = mode === "intelligence"
    ? "Answers use the live intelligence payload and stored series context."
    : "Answers use the live report and stored series context.";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSubmitting, open]);

  const handleAsk = async (rawQuestion: string) => {
    const question = rawQuestion.trim();
    if (!question || isSubmitting) {
      return;
    }

    if (!seriesConfigKey || !resolvedPlayerId) {
      setMessages((current) => [
        ...current,
        {
          id: getMessageId(),
          role: "assistant",
          content: "The assistant needs a valid series and player route before it can answer questions.",
          error: true,
        },
      ]);
      return;
    }

    const accessToken = session?.access_token;
    if (!accessToken) {
      setMessages((current) => [
        ...current,
        {
          id: getMessageId(),
          role: "assistant",
          content: "Sign in again before using the report assistant.",
          error: true,
        },
      ]);
      return;
    }

    const userMessage: PlayerReportChatMessage = {
      id: getMessageId(),
      role: "user",
      content: question,
    };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setIsSubmitting(true);

    try {
      const data = await askCricketPlayerReportChat(
        seriesConfigKey,
        resolvedPlayerId,
        accessToken,
        {
          question,
          history: buildHistory(nextMessages),
          divisionId: divisionId ?? report?.meta?.player?.divisionId ?? null,
          report,
        }
      );

      if (!data?.answer?.trim()) {
        throw new Error("The player report assistant returned an empty answer.");
      }

      setMessages((current) => [
        ...current,
        {
          id: getMessageId(),
          role: "assistant",
          content: data.answer.trim(),
          evidence: data.evidence?.filter((item) => item.label?.trim() || item.detail?.trim()).slice(0, 4),
          followUps: dedupePrompts(data.followUps ?? []).slice(0, 4),
          limitations: dedupePrompts(data.limitations ?? []).slice(0, 3),
        },
      ]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The player report assistant is unavailable right now.";

      setMessages((current) => [
        ...current,
        {
          id: getMessageId(),
          role: "assistant",
          content: message,
          error: true,
        },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          size="icon"
          className="fixed right-5 bottom-5 z-40 h-14 w-14 rounded-full bg-gradient-to-br from-cyan-300 via-cyan-400 to-emerald-400 text-slate-950 shadow-[0_20px_50px_rgba(34,211,238,0.28)] hover:scale-[1.03] hover:from-cyan-200 hover:to-emerald-300"
        >
          <MessageSquareText className="h-6 w-6" />
          <span className="sr-only">Open player report assistant</span>
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-full max-w-none border-l border-border/80 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.14),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.12),transparent_28%),rgba(2,6,23,0.98)] p-0 text-foreground sm:max-w-xl"
      >
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-border/80 px-6 py-5 text-left">
            <div className="flex items-start justify-between gap-3 pr-8">
              <div className="space-y-2">
                <SheetTitle className="font-display text-2xl text-foreground">{playerName}</SheetTitle>
                <SheetDescription className="max-w-lg text-sm leading-6 text-muted-foreground">
                  {panelDescription}
                </SheetDescription>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {seriesName ? (
                <Badge variant="outline" className="border-border/80 bg-background/40 text-muted-foreground">
                  {seriesName}
                </Badge>
              ) : null}
              {divisionLabel ? (
                <Badge variant="outline" className="border-border/80 bg-background/40 text-muted-foreground">
                  {divisionLabel}
                </Badge>
              ) : null}
              {matchEvidenceCount > 0 ? (
                <Badge variant="outline" className="border-emerald-400/20 bg-emerald-400/10 text-emerald-100">
                  {matchEvidenceCount} match{matchEvidenceCount === 1 ? "" : "es"}
                </Badge>
              ) : null}
              {commentaryCount > 0 ? (
                <Badge variant="outline" className="border-cyan-400/20 bg-cyan-400/10 text-cyan-100">
                  {commentaryCount} clip{commentaryCount === 1 ? "" : "s"}
                </Badge>
              ) : null}
              {peerCount > 0 ? (
                <Badge variant="outline" className="border-amber-400/20 bg-amber-400/10 text-amber-100">
                  {peerCount} peer{peerCount === 1 ? "" : "s"}
                </Badge>
              ) : null}
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="space-y-4 px-6 py-5">
              {!canChat ? (
                <div className="rounded-3xl border border-border/80 bg-background/40 p-5 text-sm leading-7 text-muted-foreground">
                  Chat will enable once the player route resolves.
                </div>
              ) : null}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "rounded-3xl border px-4 py-4 shadow-[0_10px_30px_rgba(2,6,23,0.16)]",
                    message.role === "assistant"
                      ? message.error
                        ? "border-rose-500/30 bg-rose-500/10"
                        : "border-cyan-400/15 bg-background/50"
                      : "ml-6 border-emerald-400/20 bg-emerald-400/10",
                  )}
                >
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full border",
                        message.role === "assistant"
                          ? message.error
                            ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
                            : "border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
                          : "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
                      )}
                    >
                      {message.role === "assistant" ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                    </span>
                    {message.role === "assistant" ? assistantLabel : "You"}
                  </div>

                  <div className="mt-3 space-y-3">
                    <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">{message.content}</p>

                    {message.evidence?.length ? (
                      <div className="grid gap-2">
                        {message.evidence.map((item, index) => (
                          <div key={`${message.id}-evidence-${index}`} className="rounded-2xl border border-border/70 bg-background/55 p-3">
                            {item.label ? (
                              <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-200">{item.label}</p>
                            ) : null}
                            {item.detail ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p> : null}
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {message.followUps?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {message.followUps.map((prompt) => (
                          <Button
                            key={`${message.id}-${prompt}`}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-auto whitespace-normal rounded-full border-border/80 bg-background/40 px-3 py-2 text-left text-xs leading-5"
                            onClick={() => void handleAsk(prompt)}
                            disabled={isSubmitting}
                          >
                            {prompt}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}

              {canChat && messages.length <= 1 && starterQuestions.length > 0 ? (
                <div className="rounded-3xl border border-border/80 bg-background/40 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Try asking</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {starterQuestions.map((prompt) => (
                      <Button
                        key={prompt}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-auto whitespace-normal rounded-full border-border/80 bg-background/40 px-3 py-2 text-left text-xs leading-5"
                        onClick={() => void handleAsk(prompt)}
                        disabled={isSubmitting}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}

              {isSubmitting ? (
                <div className="rounded-3xl border border-cyan-400/15 bg-background/50 px-4 py-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {submittingLabel}
                  </div>
                </div>
              ) : null}

              <div ref={endRef} />
            </div>
          </ScrollArea>

          <div className="border-t border-border/80 px-6 py-5">
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void handleAsk(input);
              }}
            >
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={
                  inputPlaceholder
                }
                disabled={!canChat || isSubmitting}
                className="min-h-[110px] resize-none rounded-2xl border-border/80 bg-background/55 text-sm leading-6"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleAsk(input);
                  }
                }}
              />
              <div className="flex items-center justify-between gap-3">
                <p className="max-w-md text-xs leading-5 text-muted-foreground">
                  {footerLabel}
                </p>
                <Button type="submit" disabled={!canChat || isSubmitting || input.trim().length === 0}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Thinking
                    </>
                  ) : (
                    <>
                      Ask
                      <SendHorizontal className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PlayerReportChat;
