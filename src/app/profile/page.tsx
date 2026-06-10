'use client';

import React, { useState } from 'react';
import { useStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { User, Save, Trophy, Flame, Target, BookOpen, Star } from 'lucide-react';

export default function ProfilePage() {
  const { state, dispatch } = useStore();
  const [formData, setFormData] = useState({ ...state.profile });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    dispatch({ type: 'UPDATE_PROFILE', payload: formData });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const earnedAchievements = state.achievements.filter(a => a.earnedDate);
  const unearnedAchievements = state.achievements.filter(a => !a.earnedDate);

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Student Profile</h1>
          <p className="text-xs text-muted-foreground">Your personal information and preferences</p>
        </div>
      </div>

      {/* Profile Form */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Personal Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Full Name</Label>
              <Input
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter your name"
                className="bg-muted/30 border-border/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Class</Label>
              <Select value={formData.class} onValueChange={v => v && setFormData(prev => ({ ...prev, class: v }))}>
                <SelectTrigger className="bg-muted/30 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="11">Class 11</SelectItem>
                  <SelectItem value="12">Class 12</SelectItem>
                  <SelectItem value="dropper">Dropper</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Target JEE Year</Label>
              <Select value={String(formData.targetYear)} onValueChange={v => v && setFormData(prev => ({ ...prev, targetYear: Number(v) }))}>
                <SelectTrigger className="bg-muted/30 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2027">2027</SelectItem>
                  <SelectItem value="2028">2028</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Coaching Institute</Label>
              <Input
                value={formData.coaching}
                onChange={e => setFormData(prev => ({ ...prev, coaching: e.target.value }))}
                placeholder="e.g., Allen, FIITJEE, Unacademy..."
                className="bg-muted/30 border-border/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">School</Label>
              <Input
                value={formData.school}
                onChange={e => setFormData(prev => ({ ...prev, school: e.target.value }))}
                placeholder="Enter your school name"
                className="bg-muted/30 border-border/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Daily Study Hours Target</Label>
              <Input
                type="number"
                min={1}
                max={16}
                value={formData.studyHoursPerDay}
                onChange={e => setFormData(prev => ({ ...prev, studyHoursPerDay: Number(e.target.value) }))}
                className="bg-muted/30 border-border/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Preferred Study Time</Label>
              <Select value={formData.preferredStudyTime} onValueChange={v => v && setFormData(prev => ({ ...prev, preferredStudyTime: v }))}>
                <SelectTrigger className="bg-muted/30 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Morning (5 AM - 12 PM)</SelectItem>
                  <SelectItem value="afternoon">Afternoon (12 PM - 5 PM)</SelectItem>
                  <SelectItem value="evening">Evening (5 PM - 10 PM)</SelectItem>
                  <SelectItem value="night">Night (10 PM - 2 AM)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Learning Style</Label>
              <Select value={formData.studyStyle} onValueChange={v => v && setFormData(prev => ({ ...prev, studyStyle: v }))}>
                <SelectTrigger className="bg-muted/30 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="visual">Visual (diagrams, videos)</SelectItem>
                  <SelectItem value="reading">Reading/Writing</SelectItem>
                  <SelectItem value="practice">Practice-heavy</SelectItem>
                  <SelectItem value="mixed">Mixed approach</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} className="gap-2">
              <Save className="h-4 w-4" />
              {saved ? 'Saved!' : 'Save Profile'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Streaks */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-400" />
            <CardTitle className="text-sm font-medium">Streaks & Goals</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <Flame className="h-5 w-5 text-orange-400 mx-auto mb-1" />
              <p className="text-2xl font-bold">{state.streaks.currentStudy}</p>
              <p className="text-[10px] text-muted-foreground">Study Streak</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <Star className="h-5 w-5 text-amber-400 mx-auto mb-1" />
              <p className="text-2xl font-bold">{state.streaks.longestStudy}</p>
              <p className="text-[10px] text-muted-foreground">Best Streak</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <Target className="h-5 w-5 text-green-400 mx-auto mb-1" />
              <p className="text-2xl font-bold">{state.streaks.currentRevision}</p>
              <p className="text-[10px] text-muted-foreground">Revision Streak</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <BookOpen className="h-5 w-5 text-blue-400 mx-auto mb-1" />
              <p className="text-2xl font-bold">{state.streaks.longestRevision}</p>
              <p className="text-[10px] text-muted-foreground">Best Rev. Streak</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Achievements */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-400" />
            <CardTitle className="text-sm font-medium">Achievements</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {earnedAchievements.length > 0 && (
            <>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Earned</h4>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 mb-4">
                {earnedAchievements.map(a => (
                  <div key={a.id} className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
                    <span className="text-2xl">{a.icon}</span>
                    <p className="text-xs font-medium mt-1">{a.title}</p>
                    <p className="text-[10px] text-muted-foreground">{a.description}</p>
                  </div>
                ))}
              </div>
            </>
          )}
          <h4 className="text-xs font-medium text-muted-foreground mb-2">Locked</h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {unearnedAchievements.map(a => (
              <div key={a.id} className="rounded-lg border border-border/50 bg-muted/20 p-3 text-center opacity-50">
                <span className="text-2xl grayscale">{a.icon}</span>
                <p className="text-xs font-medium mt-1">{a.title}</p>
                <p className="text-[10px] text-muted-foreground">{a.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Weekly Goals */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Weekly Goals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Study Hours</Label>
              <Input
                type="number"
                value={state.weeklyGoals.studyHours}
                onChange={e => dispatch({ type: 'UPDATE_WEEKLY_GOALS', payload: { studyHours: Number(e.target.value) } })}
                className="bg-muted/30 border-border/50"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Topics to Complete</Label>
              <Input
                type="number"
                value={state.weeklyGoals.topicsToComplete}
                onChange={e => dispatch({ type: 'UPDATE_WEEKLY_GOALS', payload: { topicsToComplete: Number(e.target.value) } })}
                className="bg-muted/30 border-border/50"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tests to Take</Label>
              <Input
                type="number"
                value={state.weeklyGoals.testsToTake}
                onChange={e => dispatch({ type: 'UPDATE_WEEKLY_GOALS', payload: { testsToTake: Number(e.target.value) } })}
                className="bg-muted/30 border-border/50"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Revisions</Label>
              <Input
                type="number"
                value={state.weeklyGoals.revisionsToComplete}
                onChange={e => dispatch({ type: 'UPDATE_WEEKLY_GOALS', payload: { revisionsToComplete: Number(e.target.value) } })}
                className="bg-muted/30 border-border/50"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
