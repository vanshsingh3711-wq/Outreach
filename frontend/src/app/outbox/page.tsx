"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import { OutboxItem } from "@/lib/types";
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Tabs,
  Modal,
  Input,
  Textarea,
  Skeleton,
} from "@/components/ui";
import {
  Send,
  CheckCircle,
  XCircle,
  Edit3,
  Clock,
  AlertOctagon,
  MailCheck,
  Check,
  X,
  Zap,
  ShieldCheck,
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
  Mail,
  Building2,
  Copy,
  Sparkles,
} from "lucide-react";

interface OutboxResponse {
  paused: boolean | null;
  pending: OutboxItem[];
  approved: OutboxItem[];
  sent: OutboxItem[];
  failed: OutboxItem[];
}

interface SendingModeResponse {
  mode: "approval" | "autopilot";
  provider: string;
  held: number;
}

export default function OutboxPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [copiedSubject, setCopiedSubject] = useState(false);

  // Edit modal state
  const [editingItem, setEditingItem] = useState<OutboxItem | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Autopilot confirmation modal
  const [showAutopilotModal, setShowAutopilotModal] = useState(false);
  const [autopilotConfirmInput, setAutopilotConfirmInput] = useState("");

  const { data, isLoading } = useQuery<OutboxResponse>({
    queryKey: ["outbox-items"],
    queryFn: () => fetchApi<OutboxResponse>("/api/outbox"),
    refetchInterval: 4000,
  });

  const { data: sendingModeData } = useQuery<SendingModeResponse>({
    queryKey: ["sending-mode"],
    queryFn: () => fetchApi<SendingModeResponse>("/api/sending-mode"),
    refetchInterval: 5000,
  });

  const currentMode = sendingModeData?.mode || "approval";

  const sendingModeMutation = useMutation({
    mutationFn: (newMode: "approval" | "autopilot") => {
      const payload: any = { mode: newMode };
      if (newMode === "autopilot") payload.confirm = "autopilot";
      return fetchApi("/api/sending-mode", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sending-mode"] });
      queryClient.invalidateQueries({ queryKey: ["outbox-items"] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => fetchApi(`/api/outbox/${id}/approve`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outbox-items"] });
      queryClient.invalidateQueries({ queryKey: ["today-dashboard"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => fetchApi(`/api/outbox/${id}/reject`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outbox-items"] });
      queryClient.invalidateQueries({ queryKey: ["today-dashboard"] });
    },
  });

  const approveAllMutation = useMutation({
    mutationFn: () => fetchApi("/api/outbox/approve-all", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outbox-items"] });
      queryClient.invalidateQueries({ queryKey: ["today-dashboard"] });
    },
  });

  const pending = data?.pending || [];
  const approved = data?.approved || [];
  const sent = data?.sent || [];
  const failed = data?.failed || [];

  const currentList = useMemo(() => {
    const raw =
      activeTab === "pending"
        ? pending
        : activeTab === "approved"
        ? approved
        : activeTab === "sent"
        ? sent
        : failed;

    if (!searchFilter.trim()) return raw;
    const lower = searchFilter.toLowerCase();
    return raw.filter(
      (item) =>
        item.to_email?.toLowerCase().includes(lower) ||
        item.prospect_name?.toLowerCase().includes(lower) ||
        item.company_name?.toLowerCase().includes(lower) ||
        item.subject?.toLowerCase().includes(lower)
    );
  }, [activeTab, pending, approved, sent, failed, searchFilter]);

  // Keep selected item valid
  const selectedItem = useMemo(() => {
    if (!currentList.length) return null;
    return currentList.find((item) => item.id === selectedId) || currentList[0];
  }, [currentList, selectedId]);

  const selectedIndex = useMemo(() => {
    if (!selectedItem) return -1;
    return currentList.findIndex((item) => item.id === selectedItem.id);
  }, [currentList, selectedItem]);

  // Keyboard navigation shortcuts: A (approve), R (reject), E (edit), J/K (next/prev)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input or modal is open
      if (
        editingItem ||
        showAutopilotModal ||
        ["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)
      ) {
        return;
      }

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        if (selectedIndex < currentList.length - 1) {
          setSelectedId(currentList[selectedIndex + 1].id);
        }
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        if (selectedIndex > 0) {
          setSelectedId(currentList[selectedIndex - 1].id);
        }
      } else if (e.key === "a" || e.key === "A") {
        if (activeTab === "pending" && selectedItem) {
          e.preventDefault();
          approveMutation.mutate(selectedItem.id);
        }
      } else if (e.key === "r" || e.key === "R") {
        if (activeTab === "pending" && selectedItem) {
          e.preventDefault();
          rejectMutation.mutate(selectedItem.id);
        }
      } else if (e.key === "e" || e.key === "E") {
        if (selectedItem) {
          e.preventDefault();
          handleOpenEdit(selectedItem);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedItem, selectedIndex, currentList, activeTab, editingItem, showAutopilotModal]);

  const handleOpenEdit = (item: OutboxItem) => {
    setEditingItem(item);
    setEditSubject(item.subject);
    setEditBody(item.body);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    setIsSavingEdit(true);
    try {
      await fetchApi(`/api/outbox/${editingItem.id}/edit`, {
        method: "POST",
        body: JSON.stringify({ subject: editSubject, body: editBody }),
      });
      setEditingItem(null);
      queryClient.invalidateQueries({ queryKey: ["outbox-items"] });
    } catch (err) {
      console.error("Failed to edit outbox draft:", err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleToggleMode = () => {
    if (currentMode === "approval") {
      setShowAutopilotModal(true);
      setAutopilotConfirmInput("");
    } else {
      sendingModeMutation.mutate("approval");
    }
  };

  const handleConfirmAutopilot = () => {
    if (autopilotConfirmInput.trim().toLowerCase() !== "autopilot") return;
    sendingModeMutation.mutate("autopilot");
    setShowAutopilotModal(false);
  };

  const handleCopySubject = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSubject(true);
    setTimeout(() => setCopiedSubject(false), 2000);
  };

  const tabItems = [
    {
      id: "pending",
      label: "Pending Review",
      icon: <Clock className="h-3.5 w-3.5" />,
      badge: pending.length,
    },
    {
      id: "approved",
      label: "Ready to Dispatch",
      icon: <Send className="h-3.5 w-3.5" />,
      badge: approved.length,
    },
    {
      id: "sent",
      label: "Dispatched",
      icon: <MailCheck className="h-3.5 w-3.5" />,
      badge: sent.length,
    },
    {
      id: "failed",
      label: "Issues / Bounced",
      icon: <AlertOctagon className="h-3.5 w-3.5" />,
      badge: failed.length,
    },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              Outbox & Draft Review
            </h1>
            <Badge
              variant={data?.paused ? "destructive" : "success"}
              size="sm"
              dot
              pulseDot={!data?.paused}
            >
              {data?.paused ? "Dispatch Paused" : "Dispatch Active"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Review, edit, and authorize personalized emails generated by DeepSeek.
          </p>
        </div>

        {/* Global Controls & Mode Switcher */}
        <div className="flex items-center gap-2.5">
          {/* Autopilot Switcher */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleMode}
            leftIcon={
              currentMode === "autopilot" ? (
                <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              )
            }
          >
            <span>{currentMode === "autopilot" ? "Autopilot Active" : "Human Approval Mode"}</span>
          </Button>

          {activeTab === "pending" && pending.length > 0 && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => approveAllMutation.mutate()}
              isLoading={approveAllMutation.isPending}
              leftIcon={<CheckCircle className="h-3.5 w-3.5" />}
            >
              <span>Approve All ({pending.length})</span>
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <Tabs
          items={tabItems}
          value={activeTab}
          onChange={(tab) => {
            setActiveTab(tab);
            setSelectedId(null);
          }}
          variant="pill"
        />

        {/* Keyboard hints banner */}
        <div className="hidden lg:flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>Shortcuts:</span>
          <kbd className="rounded border border-border bg-card px-1 text-[10px] font-mono">A</kbd> Approve
          <kbd className="rounded border border-border bg-card px-1 text-[10px] font-mono">R</kbd> Reject
          <kbd className="rounded border border-border bg-card px-1 text-[10px] font-mono">E</kbd> Edit
          <kbd className="rounded border border-border bg-card px-1 text-[10px] font-mono">J/K</kbd> Prev/Next
        </div>
      </div>

      {/* Master-Detail Split Stage */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-5">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
          <div className="lg:col-span-7">
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      ) : currentList.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground mb-3">
            <Mail className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">No emails in queue</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            The {activeTab} queue is completely cleared. Newly generated drafts will appear here automatically.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
          {/* Left Master List (5 cols) */}
          <div className="space-y-2.5 lg:col-span-5">
            {/* Search filter input */}
            <Input
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter recipient, company, subject..."
              leftIcon={<Search className="h-3.5 w-3.5" />}
              className="h-8.5"
            />

            {/* Scrollable List */}
            <div className="space-y-1.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {currentList.map((item, idx) => {
                const isSelected = selectedItem?.id === item.id;

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`rounded-lg border p-3 transition-all cursor-pointer select-none ${
                      isSelected
                        ? "border-primary/40 bg-secondary shadow-2xs"
                        : "border-border bg-card hover:bg-muted/40 hover:border-border/80"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="truncate">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {item.prospect_name || item.to_email}
                          </span>
                          {item.company_name && (
                            <span className="text-[10px] text-muted-foreground truncate">
                              at {item.company_name}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] font-mono text-muted-foreground truncate">
                          {item.to_email}
                        </p>
                      </div>

                      <span className="text-[10px] text-muted-foreground/60 font-mono shrink-0">
                        #{idx + 1}
                      </span>
                    </div>

                    <div className="mt-2 text-xs font-medium text-foreground/90 truncate">
                      {item.subject}
                    </div>

                    <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {item.body.replace(/\n+/g, " ").slice(0, 140)}...
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Detail Stage (7 cols) */}
          <div className="lg:col-span-7 sticky top-20">
            {selectedItem ? (
              <Card className="flex flex-col overflow-hidden">
                {/* Header Action Ribbon */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {selectedItem.prospect_name || selectedItem.to_email}
                    </span>
                    {selectedItem.company_name && (
                      <Badge variant="outline" size="sm">
                        <Building2 className="h-3 w-3 mr-1" />
                        {selectedItem.company_name}
                      </Badge>
                    )}
                  </div>

                  {/* Actions for Pending Drafts */}
                  {activeTab === "pending" && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => handleOpenEdit(selectedItem)}
                        leftIcon={<Edit3 className="h-3 w-3" />}
                      >
                        Edit
                      </Button>

                      <Button
                        variant="destructive"
                        size="xs"
                        onClick={() => rejectMutation.mutate(selectedItem.id)}
                        disabled={rejectMutation.isPending}
                        leftIcon={<X className="h-3 w-3" />}
                      >
                        Reject
                      </Button>

                      <Button
                        variant="primary"
                        size="xs"
                        onClick={() => approveMutation.mutate(selectedItem.id)}
                        disabled={approveMutation.isPending}
                        leftIcon={<Check className="h-3 w-3" />}
                      >
                        Approve
                      </Button>
                    </div>
                  )}

                  {/* Navigation next / prev */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        if (selectedIndex > 0) {
                          setSelectedId(currentList[selectedIndex - 1].id);
                        }
                      }}
                      disabled={selectedIndex <= 0}
                      title="Previous email (K)"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-[10px] font-mono text-muted-foreground px-1">
                      {selectedIndex + 1} / {currentList.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        if (selectedIndex < currentList.length - 1) {
                          setSelectedId(currentList[selectedIndex + 1].id);
                        }
                      }}
                      disabled={selectedIndex >= currentList.length - 1}
                      title="Next email (J)"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Email Metadata Card */}
                <div className="border-b border-border/70 p-4 space-y-2 bg-muted/10 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-[11px]">To:</span>
                    <span className="font-mono text-foreground">{selectedItem.to_email}</span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">Subject:</span>
                    <div className="flex items-center gap-2 text-foreground font-medium truncate">
                      <span className="truncate">{selectedItem.subject}</span>
                      <button
                        onClick={() => handleCopySubject(selectedItem.subject)}
                        title="Copy subject line"
                        className="text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {copiedSubject ? (
                          <Check className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Email Body Canvas */}
                <div className="p-5 max-h-[calc(100vh-420px)] overflow-y-auto">
                  <div className="rounded-lg border border-border bg-background p-4 font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap selection:bg-primary/20">
                    {selectedItem.body}
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-12 text-center text-muted-foreground">
                <p className="text-xs">Select an email draft from the left column to preview.</p>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Autopilot Confirmation Modal */}
      <Modal
        isOpen={showAutopilotModal}
        onClose={() => setShowAutopilotModal(false)}
        title="Enable Autopilot Sending Mode?"
        description="Autonomous email dispatch without human pre-review"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setShowAutopilotModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmAutopilot}
              disabled={autopilotConfirmInput.trim().toLowerCase() !== "autopilot"}
            >
              Confirm Autopilot
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            In autopilot mode, Outreach will dispatch generated outbound pitches directly to verified prospects
            as soon as they pass deliverability checks.
          </p>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">
              Type <span className="font-mono font-semibold text-foreground">autopilot</span> to authorize:
            </label>
            <Input
              value={autopilotConfirmInput}
              onChange={(e) => setAutopilotConfirmInput(e.target.value)}
              placeholder="autopilot"
              autoFocus
            />
          </div>
        </div>
      </Modal>

      {/* Edit Email Modal */}
      <Modal
        isOpen={!!editingItem}
        onClose={() => setEditingItem(null)}
        title="Edit Outbound Email"
        description="Fine-tune subject line and body before authorizing"
        maxWidth="xl"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setEditingItem(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveEdit}
              isLoading={isSavingEdit}
            >
              Save Changes
            </Button>
          </>
        }
      >
        <div className="space-y-3.5 py-1">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Subject Line</label>
            <Input
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
              placeholder="Email subject line"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Email Body</label>
            <Textarea
              rows={12}
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              className="font-mono"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
