"use client";

import React, { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Button,
  Input,
  Textarea,
} from "@/components/ui";
import {
  PenTool,
  Sparkles,
  Send,
  Building2,
  User,
  ArrowRight,
  Copy,
  Check,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";

export default function OutreachPrepPage() {
  const [targetName, setTargetName] = useState("Vansh Singh");
  const [targetTitle, setTargetTitle] = useState("Founder & CTO");
  const [targetCompany, setTargetCompany] = useState("Acme Analytics");
  const [painPoint, setPainPoint] = useState(
    "Struggling with outbound lead pipeline scalability and manual research"
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState<{ subject: string; body: string } | null>({
    subject: `Quick question regarding Acme Analytics's outbound architecture`,
    body: `Hi Vansh,\n\nNoticed Acme Analytics is scaling rapidly. Often engineering teams at your stage face challenges with struggling with outbound lead pipeline scalability and manual research.\n\nWe built Outreach to automate B2B outbound workflows directly with native AI models, cutting lead discovery and validation time by 90%.\n\nOpen to a quick 10-minute walkthrough this Thursday?\n\nBest,\nOutreach Team`,
  });
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);

  const handleSimulateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);

    setTimeout(() => {
      setGeneratedDraft({
        subject: `Quick question regarding ${targetCompany}'s outbound architecture`,
        body: `Hi ${targetName.split(" ")[0]},\n\nNoticed ${targetCompany} is scaling rapidly. Often engineering teams at your stage face challenges with ${painPoint.toLowerCase()}.\n\nWe built Outreach to automate B2B outbound workflows directly with native AI models, cutting lead discovery and validation time by 90%.\n\nOpen to a quick 10-minute walkthrough this Thursday?\n\nBest,\nOutreach Team`,
      });
      setIsGenerating(false);
    }, 600);
  };

  const handleCopy = (text: string, isSubject: boolean) => {
    navigator.clipboard.writeText(text);
    if (isSubject) {
      setCopiedSubject(true);
      setTimeout(() => setCopiedSubject(false), 2000);
    } else {
      setCopiedBody(true);
      setTimeout(() => setCopiedBody(false), 2000);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              Pitch Studio & Angle Playground
            </h1>
            <Badge variant="default" size="sm">
              DeepSeek Writer
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Test and preview personalized cold email angles, value hooks, and tone customization.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/decision-makers">
            <Button variant="outline" size="sm" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
              Open Decision-Makers
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
        {/* Left Form (5 cols) */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Pitch Parameters</CardTitle>
            <CardDescription>
              Prospect details and target problem to guide the AI generation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSimulateDraft} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Target Name</label>
                <Input
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  placeholder="e.g. Vansh Singh"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Target Role / Title</label>
                <Input
                  value={targetTitle}
                  onChange={(e) => setTargetTitle(e.target.value)}
                  placeholder="e.g. Founder & CTO"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Company Name</label>
                <Input
                  value={targetCompany}
                  onChange={(e) => setTargetCompany(e.target.value)}
                  placeholder="e.g. Acme Analytics"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Key Pain Point or Buying Signal
                </label>
                <Textarea
                  rows={3}
                  value={painPoint}
                  onChange={(e) => setPainPoint(e.target.value)}
                  placeholder="Describe the primary challenge or observation..."
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isGenerating}
                leftIcon={<Sparkles className="h-3.5 w-3.5" />}
                className="w-full"
              >
                Generate Tailored Pitch
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Right Preview Stage (7 cols) */}
        <Card className="lg:col-span-7 flex flex-col">
          <CardHeader className="flex-row items-center justify-between pb-3 border-b border-border/70">
            <div>
              <CardTitle>Generated Preview</CardTitle>
              <CardDescription>Rendered cold email pitch ready for dispatch.</CardDescription>
            </div>
            {generatedDraft && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => handleCopy(generatedDraft.body, false)}
                leftIcon={
                  copiedBody ? (
                    <Check className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )
                }
              >
                {copiedBody ? "Copied" : "Copy Body"}
              </Button>
            )}
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            {generatedDraft ? (
              <>
                {/* Subject Line Pill */}
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3">
                  <div className="truncate pr-2">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                      Subject Line
                    </span>
                    <span className="text-xs font-medium text-foreground truncate block mt-0.5">
                      {generatedDraft.subject}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(generatedDraft.subject, true)}
                    className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer p-1"
                  >
                    {copiedSubject ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                {/* Email Body Canvas */}
                <div className="rounded-lg border border-border bg-background p-4 font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap select-text">
                  {generatedDraft.body}
                </div>

                <div className="flex items-center justify-between border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
                  <span>Simulated via DeepSeek Brain</span>
                  <Link href="/decision-makers">
                    <span className="text-primary hover:underline cursor-pointer font-medium">
                      Pitch real decision-maker →
                    </span>
                  </Link>
                </div>
              </>
            ) : (
              <div className="py-16 text-center text-xs text-muted-foreground">
                Enter target parameters and click generate to test your pitch.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
