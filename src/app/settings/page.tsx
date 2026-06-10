'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Settings, 
  Download, 
  Upload, 
  Trash2, 
  FileJson, 
  FileSpreadsheet, 
  AlertTriangle, 
  Shield,
  User,
  Clock,
  ClipboardCheck,
  History,
  Eye,
  EyeOff,
  Atom,
  FlaskConical,
  Calculator,
} from 'lucide-react';
import { format } from 'date-fns';

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const { state, dispatch, toggleHiddenSubject, toggleHiddenChapter } = useStore();

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-xs text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  const exportJSON = () => {
    try {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jee-os-backup-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to export state to JSON.');
    }
  };

  const exportCSV = (data: any[], filename: string, headers: string[]) => {
    try {
      if (!data || data.length === 0) {
        alert(`No data available to export for ${filename}.`);
        return;
      }
      const csv = [
        headers.join(','),
        ...data.map(row => 
          headers.map(h => {
            const val = row[h];
            return typeof val === 'object' && val !== null ? JSON.stringify(JSON.stringify(val)) : JSON.stringify(val ?? '');
          }).join(',')
        )
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert(`Failed to export ${filename} to CSV.`);
    }
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.syllabus && data.studyLogs && data.profile) {
          if (confirm('Are you sure you want to import this file? This will completely OVERWRITE all current progress, mock history, and revision logs.')) {
            dispatch({ type: 'SET_STATE', payload: data });
            alert('Backup data imported successfully!');
          }
        } else {
          alert('Invalid backup file structure. Ensure this is a valid JEE OS backup JSON.');
        }
      } catch {
        alert('Failed to parse backup JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleImportSyllabus = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        const importedSyllabus = Array.isArray(data) ? data : data.syllabus;
        
        if (Array.isArray(importedSyllabus) && importedSyllabus.length > 0 && importedSyllabus[0].chapters) {
          if (confirm('Are you sure you want to import this syllabus? This will overwrite the syllabus hierarchy and merge or reset topic progress (completion, accuracy, exclusions), but preserve your study logs and test history.')) {
            dispatch({ type: 'IMPORT_SYLLABUS', payload: importedSyllabus });
            alert('Syllabus layout imported successfully!');
          }
        } else {
          alert('Invalid syllabus file structure. Ensure it is a valid list of subjects with chapters and topics.');
        }
      } catch {
        alert('Failed to parse syllabus JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleClearAllData = () => {
    if (confirm('⚠️ WARNING: This will permanently DELETE all study logs, streaks, completed revisions, test history, and reset your syllabus completion to 0. Are you absolutely sure?')) {
      if (confirm('Final confirmation: Are you completely sure you want to reset everything? This cannot be undone.')) {
        dispatch({ type: 'RESET_STATE' });
        alert('All local state has been reset to defaults.');
      }
    }
  };

  const profile = state.profile;
  const studyLogsCount = state.studyLogs.length;
  const testAttemptsCount = state.testAttempts.length;
  const auditLogsCount = (state as any).auditLog?.length || 0;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Settings & Data</h1>
          <p className="text-xs text-muted-foreground">Manage profile snapshot data, file exports, and database states</p>
        </div>
      </div>

      <Separator className="border-border/40" />

      {/* Profile Summary */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Aspirant Profile Snapshot</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Review the profile parameters utilized by the AI Coach for daily study recommendations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground block">Student Name</span>
              <span className="font-semibold">{profile.name || 'Not configured'}</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground block">Target Class</span>
              <Badge variant="outline" className="font-mono">Class {profile.class}</Badge>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground block">Target JEE Year</span>
              <span className="font-semibold">{profile.targetYear}</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground block">Study Style</span>
              <span className="font-semibold capitalize">{profile.studyStyle}</span>
            </div>
          </div>
          <div className="bg-muted/30 border border-border/40 rounded-lg p-3 text-xs space-y-1">
            <span className="text-muted-foreground block">Coaching Institute & Target Center:</span>
            <span className="font-medium">{profile.coaching || 'Self Study'}</span>
          </div>
        </CardContent>
      </Card>

      {/* Study Scope */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Study Scope</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Toggle subjects and chapters on/off to hide them from readiness scores, recommendations, and weak-topic alerts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state.syllabus.map(subject => {
            const subHidden = state.hiddenSubjects.includes(subject.id);
            const subIcon = subject.id === 'physics' ? <Atom className="w-4 h-4" /> 
              : subject.id === 'chemistry' ? <FlaskConical className="w-4 h-4" /> 
              : <Calculator className="w-4 h-4" />;
            return (
              <div key={subject.id} className="rounded-lg border border-border/50 overflow-hidden">
                <button
                  onClick={() => toggleHiddenSubject(subject.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
                    subHidden ? 'opacity-50 bg-muted/30' : 'bg-muted/10 hover:bg-muted/20'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {subHidden ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : subIcon}
                    <span>{subject.name}</span>
                    {subHidden && <span className="text-[10px] text-muted-foreground ml-2">(hidden)</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{subject.chapters.length} chapters</span>
                    <div className={`h-2 w-2 rounded-full ${subHidden ? 'bg-zinc-700' : 'bg-emerald-500'}`} />
                  </div>
                </button>
                {subject.chapters.map(ch => {
                  const chHidden = state.hiddenChapters.includes(ch.id);
                  return (
                    <div
                      key={ch.id}
                      className={`flex items-center justify-between px-4 py-2 pl-10 text-xs border-t border-border/30 transition-colors cursor-pointer hover:bg-muted/10 ${
                        chHidden || subHidden ? 'opacity-40' : ''
                      }`}
                      onClick={() => toggleHiddenChapter(ch.id)}
                    >
                      <span>{ch.name}</span>
                      <div className={`h-1.5 w-1.5 rounded-full ${chHidden ? 'bg-zinc-700' : 'bg-emerald-400/70'}`} />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Backup & Export */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Data Backup & Exports</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Export study records, test scores, or a full system backup file
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* JSON Backup Card */}
            <div className="p-4 rounded-lg border border-border/50 bg-card/60 flex flex-col justify-between h-36">
              <div className="flex items-start gap-2.5">
                <FileJson className="w-5 h-5 text-indigo-400 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-foreground/90">Full JSON State Backup</h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                    Downloads all profile data, study sessions, revisions, test completions, and telemetry logs in one file.
                  </p>
                </div>
              </div>
              <Button size="sm" onClick={exportJSON} className="w-full mt-2 gap-1.5 cursor-pointer">
                <Download className="w-3.5 h-3.5" />
                Export System Backup
              </Button>
            </div>

            {/* CSV Study Logs Card */}
            <div className="p-4 rounded-lg border border-border/50 bg-card/60 flex flex-col justify-between h-36">
              <div className="flex items-start gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-foreground/90">Study Logs CSV</h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                    Export your complete daily study logs timeline as a spreadsheet-compatible CSV format. ({studyLogsCount} records)
                  </p>
                </div>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => exportCSV(state.studyLogs, 'jee-os-study-logs', ['date', 'subject', 'topicId', 'duration', 'type', 'qualityScore', 'distractions'])}
                className="w-full mt-2 gap-1.5 cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                Export Study Logs (CSV)
              </Button>
            </div>

            {/* CSV Test attempts Card */}
            <div className="p-4 rounded-lg border border-border/50 bg-card/60 flex flex-col justify-between h-36">
              <div className="flex items-start gap-2.5">
                <ClipboardCheck className="w-5 h-5 text-amber-400 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-foreground/90">Test Attempts CSV</h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                    Export your mock tests and quizzes scores database, showing correct counts, date, and durations. ({testAttemptsCount} records)
                  </p>
                </div>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => exportCSV(state.testAttempts, 'jee-os-test-attempts', ['date', 'type', 'difficulty', 'score', 'maxScore', 'duration'])}
                className="w-full mt-2 gap-1.5 cursor-pointer"
              >
                <ClipboardCheck className="w-3.5 h-3.5 text-amber-400" />
                Export Test History (CSV)
              </Button>
            </div>

            {/* CSV Audit log Card */}
            <div className="p-4 rounded-lg border border-border/50 bg-card/60 flex flex-col justify-between h-36">
              <div className="flex items-start gap-2.5">
                <History className="w-5 h-5 text-purple-400 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-foreground/90">Audit Telemetry Log CSV</h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                    Export the complete state change audit trail database of updates, showing timestamps, oldValue, and newValue. ({auditLogsCount} events)
                  </p>
                </div>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => exportCSV((state as any).auditLog || [], 'jee-os-audit-log', ['timestamp', 'action', 'source', 'reason'])}
                className="w-full mt-2 gap-1.5 cursor-pointer"
              >
                <History className="w-3.5 h-3.5 text-purple-400" />
                Export Audit Log (CSV)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Restore & Import */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-card border-border/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Restore Full Backup</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Import a JEE OS JSON backup file to overwrite all settings and logs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 p-6 flex flex-col items-center justify-center text-center gap-3 h-48 justify-between">
              <Upload className="w-8 h-8 text-muted-foreground/60 mx-auto" />
              <div>
                <p className="text-xs font-medium text-foreground">Upload Backup JSON File</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Overwrites all local logs and test history</p>
              </div>
              <label className="inline-flex h-9 items-center justify-center rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold px-4 cursor-pointer text-zinc-100 transition-colors">
                Browse File
                <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
              </label>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Import Syllabus Layout</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Import a custom chapters and topics JSON file to configure target goals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 p-6 flex flex-col items-center justify-center text-center gap-3 h-48 justify-between">
              <FileJson className="w-8 h-8 text-muted-foreground/60 mx-auto" />
              <div>
                <p className="text-xs font-medium text-foreground">Upload Syllabus JSON File</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Overwrites only syllabus configuration, logs remain preserved</p>
              </div>
              <label className="inline-flex h-9 items-center justify-center rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold px-4 cursor-pointer text-zinc-100 transition-colors">
                Import Syllabus
                <input type="file" accept=".json" onChange={handleImportSyllabus} className="hidden" />
              </label>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Danger Zone */}
      <Card className="border-red-500/25 bg-red-500/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <CardTitle className="text-sm font-semibold text-red-400">Danger Zone</CardTitle>
          </div>
          <CardDescription className="text-xs text-red-300/80">
            Irreversible actions regarding your local preparation data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <div>
              <h4 className="text-xs font-semibold text-red-400 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                Reset Application Database
              </h4>
              <p className="text-[10px] text-red-300/70 mt-0.5 leading-relaxed max-w-md">
                Deletes all study logs, test attempts, pending and completed revisions, streaks, and marks progress. This will reload a completely blank database.
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={handleClearAllData} className="shrink-0 gap-1.5 cursor-pointer">
              <Trash2 className="w-3.5 h-3.5" />
              Clear All Data
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
