import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Dumbbell,
  Eye,
  Filter,
  Play,
  PlayCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Video,
  X,
} from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface ResolvedVideoInfo {
  has_playable_video: boolean;
  source_indicator: 'gym_custom' | 'platform_global' | 'instructions_only';
  source_label: string;
  is_override: boolean;
  video_id?: string;
  title?: string;
  provider?: string;
  embed_url?: string;
  video_url?: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  creator_name?: string;
  attribution_text?: string;
  rights_status?: string;
  instructions?: string;
  safety_notes?: string;
  common_mistakes?: string;
}

interface GymExerciseItem {
  id: number;
  name: string;
  name_mr?: string;
  name_hi?: string;
  code: string;
  category: string;
  target_muscle_group?: string;
  exercise_type: string;
  equipment_required?: string;
  difficulty_level: string;
  instructions?: string;
  safety_notes?: string;
  thumbnail_url?: string;
  resolved_video: ResolvedVideoInfo;
  is_overridden: boolean;
  has_gym_custom_video: boolean;
  override_info?: {
    id: number;
    is_active: boolean;
    video_title?: string;
    video_provider?: string;
  } | null;
}

interface GymVideoSettings {
  allow_trainer_uploads: boolean;
  enable_member_library: boolean;
  require_approval: boolean;
}

export const ExerciseLibrary: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [exercises, setExercises] = useState<GymExerciseItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'overridden' | 'platform_default' | 'no_video'>('all');
  const [selectedMuscle, setSelectedMuscle] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modals & Active States
  const [activeWatchVideo, setActiveWatchVideo] = useState<GymExerciseItem | null>(null);
  const [uploadModalExercise, setUploadModalExercise] = useState<GymExerciseItem | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [settings, setSettings] = useState<GymVideoSettings>({
    allow_trainer_uploads: true,
    enable_member_library: true,
    require_approval: false,
  });

  // Custom Video Form
  const [customVideoForm, setCustomVideoForm] = useState({
    title: '',
    provider: 'youtube',
    video_url: '',
    creator_name: '',
    attribution_text: '',
    set_as_active_override: true,
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const isOwnerOrManager = user?.role === 'gym_owner' || user?.role === 'branch_manager' || user?.role === 'super_admin';

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchExercises = async () => {
    try {
      setLoading(true);
      const res = await api.get('/exercise-library');
      setExercises(res.data);
    } catch (err) {
      showToast('Could not load exercise library', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await api.get('/exercise-library/settings/config');
      setSettings(res.data);
    } catch (err) {
      // Ignore if not permitted
    }
  };

  useEffect(() => {
    fetchExercises();
    if (isOwnerOrManager) {
      fetchSettings();
    }
  }, []);

  // Filtered exercise list
  const filteredExercises = exercises.filter((ex) => {
    const matchesSearch =
      !searchQuery ||
      ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ex.name_mr && ex.name_mr.includes(searchQuery)) ||
      (ex.name_hi && ex.name_hi.includes(searchQuery)) ||
      (ex.code && ex.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (ex.target_muscle_group && ex.target_muscle_group.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesMuscle =
      selectedMuscle === 'all' ||
      ex.category === selectedMuscle ||
      (ex.target_muscle_group && ex.target_muscle_group.toLowerCase().includes(selectedMuscle.toLowerCase()));

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'overridden' && ex.is_overridden) ||
      (statusFilter === 'platform_default' && !ex.is_overridden && ex.resolved_video.has_playable_video) ||
      (statusFilter === 'no_video' && !ex.resolved_video.has_playable_video);

    return matchesSearch && matchesMuscle && matchesStatus;
  });

  const handleUploadCustomVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadModalExercise) return;

    try {
      setIsSubmitting(true);
      await api.post(`/exercise-library/${uploadModalExercise.id}/custom-video`, customVideoForm);

      showToast(`Gym tutorial saved! Members now see your custom demonstration.`);
      setUploadModalExercise(null);
      setCustomVideoForm({
        title: '',
        provider: 'youtube',
        video_url: '',
        creator_name: user?.name || '',
        attribution_text: '',
        set_as_active_override: true,
      });
      fetchExercises();
    } catch (err: any) {
      showToast(errorMessage(err) || 'Error saving video', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestoreDefault = async (exercise: GymExerciseItem) => {
    try {
      await api.post(`/exercise-library/${exercise.id}/restore-default`);
      showToast(`Platform default tutorial restored for ${exercise.name}`);
      fetchExercises();
    } catch (err: any) {
      showToast(errorMessage(err) || 'Error restoring default', 'error');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await api.put('/exercise-library/settings/config', settings);
      showToast('Video library settings updated successfully');
      setShowSettingsModal(false);
    } catch (err: any) {
      showToast(errorMessage(err) || 'Failed to update settings', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Extract YouTube ID helper for preview
  const getYouTubeId = (url: string) => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=))([^"&?\/ ]{8,32})/);
    return match ? match[1] : null;
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-900/30'
              : 'bg-gym-red text-white shadow-red-900/30'
          }`}
        >
          {toastMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gym-card border border-gym rounded-2xl p-5 md:p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gym-red-subtle text-gym-red uppercase tracking-wider">
              Smart Video Priority
            </span>
            <span className="text-xs text-gym-secondary font-medium">Automatic Fallback & Zero Manual Setup</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-gym-primary flex items-center gap-2">
            <Video className="w-6 h-6 text-gym-red" />
            Exercise Video Library
          </h1>
          <p className="text-xs md:text-sm text-gym-secondary mt-1">
            Professional tutorials ready out-of-the-box. Add your gym's custom videos anytime to personalize demonstrations.
          </p>
        </div>

        {isOwnerOrManager && (
          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-gym text-gym-primary hover:border-gym-red text-xs font-bold transition-all cursor-pointer bg-gym-base"
          >
            <Settings className="w-4 h-4 text-gym-secondary" />
            <span>Library Settings</span>
          </button>
        )}
      </div>

      {/* Status Filter Tabs (All / Gym Overrides / Platform Defaults / Instructions Only) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gym pb-3">
        {[
          { id: 'all', label: 'All Exercises', count: exercises.length },
          {
            id: 'overridden',
            label: 'My Gym Custom Videos',
            count: exercises.filter((e) => e.is_overridden).length,
          },
          {
            id: 'platform_default',
            label: 'Platform Tutorials',
            count: exercises.filter((e) => !e.is_overridden && e.resolved_video.has_playable_video).length,
          },
          {
            id: 'no_video',
            label: 'Instructions Only',
            count: exercises.filter((e) => !e.resolved_video.has_playable_video).length,
          },
        ].map((tab) => {
          const isActive = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-gym-red text-white shadow-md shadow-gym-red/20'
                  : 'bg-gym-card border border-gym text-gym-secondary hover:text-gym-primary'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-gym-base text-gym-secondary'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Muscle Group Pills & Search Input */}
      <div className="bg-gym-card border border-gym rounded-2xl p-4 shadow-xs space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gym-secondary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search exercises by English name, मराठी नाव, हिंदी नाम, or target muscle..."
            className="w-full pl-10 pr-4 py-2 bg-gym-base border border-gym rounded-xl text-xs font-medium text-gym-primary focus:outline-none focus:border-gym-red"
          />
        </div>

        {/* Quick Muscle Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          {[
            { id: 'all', label: 'All Muscles' },
            { id: 'chest', label: 'Chest' },
            { id: 'back', label: 'Back' },
            { id: 'shoulders', label: 'Shoulders' },
            { id: 'biceps', label: 'Biceps' },
            { id: 'triceps', label: 'Triceps' },
            { id: 'legs', label: 'Legs' },
            { id: 'glutes', label: 'Glutes' },
            { id: 'abs_core', label: 'Abs & Core' },
            { id: 'full_body', label: 'Full Body' },
          ].map((pill) => {
            const isSelected = selectedMuscle === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setSelectedMuscle(pill.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-gym-primary text-gym-base'
                    : 'bg-gym-base border border-gym text-gym-secondary hover:text-gym-primary'
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Exercise Cards Grid */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-sm font-semibold text-gym-secondary">
          <RefreshCw className="w-5 h-5 animate-spin mr-2 text-gym-red" />
          Loading exercises & tutorial videos...
        </div>
      ) : filteredExercises.length === 0 ? (
        <div className="bg-gym-card border border-gym rounded-2xl p-12 text-center">
          <Dumbbell className="w-10 h-10 text-gym-secondary mx-auto mb-3 opacity-40" />
          <h3 className="text-base font-bold text-gym-primary">No exercises matching criteria</h3>
          <p className="text-xs text-gym-secondary mt-1">Try switching tabs or adjusting search terms</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExercises.map((exercise) => {
            const vInfo = exercise.resolved_video;
            const hasVideo = vInfo.has_playable_video;
            const isGymCustom = vInfo.source_indicator === 'gym_custom';

            return (
              <div
                key={exercise.id}
                className={`bg-gym-card border rounded-2xl overflow-hidden transition-all flex flex-col justify-between shadow-xs group ${
                  isGymCustom ? 'border-gym-red/50 shadow-gym-red/10' : 'border-gym hover:border-gym-red/40'
                }`}
              >
                <div>
                  {/* Thumbnail & Video Banner */}
                  <div className="relative aspect-video bg-neutral-900 overflow-hidden flex items-center justify-center">
                    {vInfo.thumbnail_url || exercise.thumbnail_url ? (
                      <img
                        src={vInfo.thumbnail_url || exercise.thumbnail_url}
                        alt={exercise.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-neutral-600">
                        <Dumbbell className="w-8 h-8 mb-1" />
                        <span className="text-[10px] uppercase font-bold tracking-wider">Instructions Fallback</span>
                      </div>
                    )}

                    {/* Play Button Overlay */}
                    {hasVideo && (
                      <button
                        onClick={() => setActiveWatchVideo(exercise)}
                        className={`absolute inset-0 m-auto w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 cursor-pointer ${
                          isGymCustom ? 'bg-gym-red text-white' : 'bg-black/75 hover:bg-gym-red text-white backdrop-blur-xs'
                        }`}
                        title="Watch demonstration"
                      >
                        <Play className="w-5 h-5 fill-white ml-0.5" />
                      </button>
                    )}

                    {/* Badges on Video */}
                    <div className="absolute top-2 left-2 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-black/80 text-white backdrop-blur-xs">
                        {exercise.code || 'EX-FIT'}
                      </span>

                      {/* Source Indicator Badge */}
                      {isGymCustom ? (
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-gym-red text-white shadow-md flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Gym Video
                        </span>
                      ) : hasVideo ? (
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-neutral-800 text-neutral-200 border border-neutral-700 backdrop-blur-xs">
                          Platform Tutorial
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-600/90 text-white backdrop-blur-xs">
                          Instructions Only
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-2">
                    <div>
                      <h3 className="text-sm font-bold text-gym-primary group-hover:text-gym-red transition-colors">
                        {exercise.name}
                      </h3>
                      {(exercise.name_mr || exercise.name_hi) && (
                        <div className="text-[11px] text-gym-secondary mt-0.5 flex items-center gap-2">
                          {exercise.name_mr && <span>मराठी: {exercise.name_mr}</span>}
                          {exercise.name_hi && <span>• हिंदी: {exercise.name_hi}</span>}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
                      <span className="px-2 py-0.5 rounded-md bg-gym-base border border-gym text-gym-primary capitalize">
                        {exercise.category}
                      </span>
                      {exercise.equipment_required && (
                        <span className="px-2 py-0.5 rounded-md bg-gym-base border border-gym text-gym-secondary capitalize">
                          {exercise.equipment_required}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-md uppercase font-bold ${
                          exercise.difficulty_level === 'beginner'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : exercise.difficulty_level === 'intermediate'
                            ? 'bg-amber-500/10 text-amber-600'
                            : 'bg-rose-500/10 text-rose-600'
                        }`}
                      >
                        {exercise.difficulty_level}
                      </span>
                    </div>

                    {/* Tutorial Title / Attribution */}
                    {hasVideo && vInfo.title && (
                      <div className="pt-2 border-t border-gym text-[11px] text-gym-secondary flex items-center justify-between">
                        <span className="truncate font-medium">{vInfo.title}</span>
                        {vInfo.creator_name && <span className="text-[10px] opacity-75 shrink-0 ml-2">by {vInfo.creator_name}</span>}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="p-3 bg-gym-base/50 border-t border-gym flex items-center justify-between gap-2">
                  {/* Watch Video Button */}
                  {hasVideo ? (
                    <button
                      onClick={() => setActiveWatchVideo(exercise)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-gym-card border border-gym hover:border-gym-red text-xs font-bold text-gym-primary transition-all cursor-pointer"
                    >
                      <PlayCircle className="w-3.5 h-3.5 text-gym-red" />
                      <span>Watch Tutorial</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setActiveWatchVideo(exercise)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-gym-card border border-gym text-xs font-bold text-gym-secondary hover:text-gym-primary"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Technique</span>
                    </button>
                  )}

                  {/* Add / Override Gym Video Button */}
                  <button
                    onClick={() => {
                      setUploadModalExercise(exercise);
                      setCustomVideoForm({
                        title: `${user?.gym?.name || 'Our Gym'} — ${exercise.name} Technique`,
                        provider: 'youtube',
                        video_url: '',
                        creator_name: user?.name || '',
                        attribution_text: '',
                        set_as_active_override: true,
                      });
                    }}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isGymCustom
                        ? 'border border-gym text-gym-primary hover:border-gym-red bg-gym-card'
                        : 'bg-gym-red-subtle text-gym-red hover:bg-gym-red hover:text-white'
                    }`}
                    title={isGymCustom ? 'Update Gym Tutorial Video' : 'Upload custom demonstration for your gym'}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isGymCustom ? 'Change Video' : '+ Gym Video'}</span>
                  </button>

                  {/* Restore Platform Default Button (if gym has override active) */}
                  {exercise.is_overridden && (
                    <button
                      onClick={() => handleRestoreDefault(exercise)}
                      className="p-1.5 rounded-lg border border-gym hover:border-amber-500 text-gym-secondary hover:text-amber-500 transition-all cursor-pointer bg-gym-card"
                      title="Restore Platform Default Tutorial"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: WATCH VIDEO & FORM INSTRUCTIONS */}
      {activeWatchVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-gym-card border border-gym rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 border-b border-gym flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-gym-primary truncate">
                    {activeWatchVideo.name}
                  </h3>
                  {activeWatchVideo.resolved_video.is_override ? (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-gym-red text-white">
                      Gym Video
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-neutral-800 text-neutral-200 border border-neutral-700">
                      Platform Tutorial
                    </span>
                  )}
                </div>
                {(activeWatchVideo.name_mr || activeWatchVideo.name_hi) && (
                  <p className="text-xs text-gym-secondary mt-0.5">
                    {activeWatchVideo.name_mr} • {activeWatchVideo.name_hi}
                  </p>
                )}
              </div>
              <button
                onClick={() => setActiveWatchVideo(null)}
                className="text-gym-secondary hover:text-gym-primary p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Player or Image Fallback */}
            {activeWatchVideo.resolved_video.has_playable_video && activeWatchVideo.resolved_video.embed_url ? (
              <div className="relative aspect-video bg-black">
                <iframe
                  src={activeWatchVideo.resolved_video.embed_url}
                  title={activeWatchVideo.name}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="p-6 bg-gym-base/50 text-center space-y-2 border-b border-gym">
                <Dumbbell className="w-10 h-10 text-gym-secondary mx-auto opacity-50" />
                <h4 className="text-sm font-bold text-gym-primary">Instructions & Visual Guide</h4>
                <p className="text-xs text-gym-secondary">No tutorial video is currently attached for this exercise.</p>
              </div>
            )}

            {/* Exercise Instructions & Safety Cues */}
            <div className="p-4 space-y-3 max-h-60 overflow-y-auto text-xs">
              {activeWatchVideo.instructions && (
                <div>
                  <h4 className="font-bold text-gym-primary mb-1 uppercase tracking-wider text-[10px]">
                    Step-by-Step Technique
                  </h4>
                  <p className="text-gym-secondary leading-relaxed">{activeWatchVideo.instructions}</p>
                </div>
              )}

              {activeWatchVideo.safety_notes && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                  <div className="font-bold flex items-center gap-1.5 mb-0.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Safety & Injury Prevention Notes</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">{activeWatchVideo.safety_notes}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-gym-base border-t border-gym flex items-center justify-between text-xs">
              <span className="text-gym-secondary text-[11px]">
                {activeWatchVideo.resolved_video.creator_name
                  ? `Demonstration provided by: ${activeWatchVideo.resolved_video.creator_name}`
                  : 'Gym Management SaaS Centralized Library'}
              </span>
              <button
                onClick={() => setActiveWatchVideo(null)}
                className="px-4 py-1.5 rounded-lg bg-gym-card border border-gym font-bold text-gym-primary hover:border-gym-red"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: UPLOAD / LINK CUSTOM GYM TUTORIAL */}
      {uploadModalExercise && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-gym-card border border-gym rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gym flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gym-primary flex items-center gap-2">
                  <Plus className="w-5 h-5 text-gym-red" />
                  Add Gym Video: {uploadModalExercise.name}
                </h3>
                <p className="text-xs text-gym-secondary mt-0.5">
                  This custom video will be shown exclusively to your gym members and trainers.
                </p>
              </div>
              <button onClick={() => setUploadModalExercise(null)} className="text-gym-secondary hover:text-gym-primary p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadCustomVideo} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gym-primary mb-1">Tutorial Title *</label>
                <input
                  type="text"
                  required
                  value={customVideoForm.title}
                  onChange={(e) => setCustomVideoForm({ ...customVideoForm, title: e.target.value })}
                  className="w-full px-3.5 py-2 bg-gym-base border border-gym rounded-xl text-xs font-medium text-gym-primary focus:outline-none focus:border-gym-red"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gym-primary mb-1">
                  YouTube Video Link *
                </label>
                <input
                  type="url"
                  required
                  value={customVideoForm.video_url}
                  onChange={(e) => setCustomVideoForm({ ...customVideoForm, video_url: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                  className="w-full px-3.5 py-2 bg-gym-base border border-gym rounded-xl text-xs font-medium text-gym-primary focus:outline-none focus:border-gym-red"
                />
              </div>

              {/* YouTube Live Preview */}
              {customVideoForm.video_url && getYouTubeId(customVideoForm.video_url) && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Valid Video Preview (Privacy-Enhanced Player)
                  </span>
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-gym">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${getYouTubeId(customVideoForm.video_url)}?rel=0&modestbranding=1`}
                      title="Preview"
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gym-primary mb-1">Demonstrated / Uploaded By</label>
                <input
                  type="text"
                  value={customVideoForm.creator_name}
                  onChange={(e) => setCustomVideoForm({ ...customVideoForm, creator_name: e.target.value })}
                  placeholder="e.g. Head Coach Rohit"
                  className="w-full px-3.5 py-2 bg-gym-base border border-gym rounded-xl text-xs font-medium text-gym-primary focus:outline-none focus:border-gym-red"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="active_override"
                  checked={customVideoForm.set_as_active_override}
                  onChange={(e) => setCustomVideoForm({ ...customVideoForm, set_as_active_override: e.target.checked })}
                  className="rounded border-gym text-gym-red focus:ring-gym-red cursor-pointer"
                />
                <label htmlFor="active_override" className="text-xs font-semibold text-gym-primary cursor-pointer">
                  Activate immediately as primary override for our gym
                </label>
              </div>

              <div className="pt-4 border-t border-gym flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setUploadModalExercise(null)}
                  className="px-4 py-2 rounded-xl border border-gym text-xs font-bold text-gym-secondary hover:text-gym-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-gym-red hover:bg-gym-red-hover text-white text-xs font-bold shadow-md shadow-gym-red/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Set as Gym Tutorial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: GYM VIDEO SETTINGS */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-gym-card border border-gym rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gym flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gym-primary flex items-center gap-2">
                  <Settings className="w-5 h-5 text-gym-red" />
                  Video Library Configuration
                </h3>
                <p className="text-xs text-gym-secondary mt-0.5">Control staff permissions and member access</p>
              </div>
              <button onClick={() => setShowSettingsModal(false)} className="text-gym-secondary hover:text-gym-primary p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="p-5 space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-gym-base border border-gym">
                <div>
                  <div className="text-xs font-bold text-gym-primary">Allow Trainer Video Uploads</div>
                  <div className="text-[11px] text-gym-secondary">Trainers can upload custom gym tutorials</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.allow_trainer_uploads}
                  onChange={(e) => setSettings({ ...settings, allow_trainer_uploads: e.target.checked })}
                  className="w-4 h-4 rounded border-gym text-gym-red focus:ring-gym-red cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-gym-base border border-gym">
                <div>
                  <div className="text-xs font-bold text-gym-primary">Enable Member Video Library</div>
                  <div className="text-[11px] text-gym-secondary">Members can browse tutorials inside portal</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enable_member_library}
                  onChange={(e) => setSettings({ ...settings, enable_member_library: e.target.checked })}
                  className="w-4 h-4 rounded border-gym text-gym-red focus:ring-gym-red cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-gym-base border border-gym">
                <div>
                  <div className="text-xs font-bold text-gym-primary">Require Owner Approval</div>
                  <div className="text-[11px] text-gym-secondary">Review trainer videos before publishing</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.require_approval}
                  onChange={(e) => setSettings({ ...settings, require_approval: e.target.checked })}
                  className="w-4 h-4 rounded border-gym text-gym-red focus:ring-gym-red cursor-pointer"
                />
              </div>

              <div className="pt-4 border-t border-gym flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 rounded-xl border border-gym text-xs font-bold text-gym-secondary hover:text-gym-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-gym-red hover:bg-gym-red-hover text-white text-xs font-bold shadow-md shadow-gym-red/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExerciseLibrary;
