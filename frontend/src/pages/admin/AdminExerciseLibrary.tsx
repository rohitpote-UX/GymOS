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
  FileSpreadsheet,
  Filter,
  Play,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Video,
  X,
} from 'lucide-react';
import api, { errorMessage } from '../../api/client';

interface OverviewMetrics {
  total_exercises: number;
  approved_videos: number;
  total_categories: number;
  pending_review_videos: number;
  playback_errors: number;
  exercises_without_tutorials: number;
  gyms_using_library: number;
}

interface Category {
  id: number;
  name: string;
  name_mr?: string;
  name_hi?: string;
  slug: string;
  type: string;
  exercises_count?: number;
}

interface ExerciseItem {
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
  default_video_id?: number;
  default_video?: {
    id: number;
    title: string;
    provider: string;
    video_id?: string;
    embed_url?: string;
    thumbnail_url?: string;
    status: string;
    health_status: string;
    creator_name?: string;
    rights_status?: string;
  };
}

export const AdminExerciseLibrary: React.FC = () => {
  const { t } = useTranslation();

  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterHasVideo, setFilterHasVideo] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modals
  const [showAddVideoModal, setShowAddVideoModal] = useState<boolean>(false);
  const [selectedExerciseForVideo, setSelectedExerciseForVideo] = useState<ExerciseItem | null>(null);
  const [showAddExerciseModal, setShowAddExerciseModal] = useState<boolean>(false);
  const [showCsvImportModal, setShowCsvImportModal] = useState<boolean>(false);
  const [activePreviewVideo, setActivePreviewVideo] = useState<{ title: string; embedUrl: string } | null>(null);

  // Add Video Form State
  const [videoForm, setVideoForm] = useState({
    title: '',
    provider: 'youtube',
    video_url: '',
    creator_name: '',
    attribution_text: '',
    rights_status: 'public_embed_allowed',
    content_source: 'youtube',
    duration_seconds: 300,
    is_primary: true,
  });

  // Add Exercise Form State
  const [exerciseForm, setExerciseForm] = useState({
    name: '',
    name_mr: '',
    name_hi: '',
    code: '',
    category: 'chest',
    target_muscle_group: '',
    exercise_type: 'strength',
    equipment_required: 'barbells',
    difficulty_level: 'beginner',
    instructions: '',
    safety_notes: '',
  });

  // CSV Import State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [metricsRes, catsRes, exRes] = await Promise.all([
        api.get('/admin/exercise-library/overview'),
        api.get('/admin/exercise-library/categories'),
        api.get(`/admin/exercise-library/exercises?per_page=100`),
      ]);

      setMetrics(metricsRes.data);
      setCategories(catsRes.data);
      setExercises(exRes.data.data || exRes.data);
    } catch (err) {
      showToast('Failed to load exercise video library data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered exercises
  const filteredExercises = exercises.filter((ex) => {
    const matchesSearch =
      !searchQuery ||
      ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ex.name_mr && ex.name_mr.includes(searchQuery)) ||
      (ex.name_hi && ex.name_hi.includes(searchQuery)) ||
      (ex.code && ex.code.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCat =
      selectedCategory === 'all' ||
      ex.category === selectedCategory ||
      (ex.target_muscle_group && ex.target_muscle_group.toLowerCase().includes(selectedCategory.toLowerCase()));

    const matchesVideo =
      filterHasVideo === 'all' ||
      (filterHasVideo === 'has_video' && ex.default_video_id) ||
      (filterHasVideo === 'no_video' && !ex.default_video_id);

    return matchesSearch && matchesCat && matchesVideo;
  });

  // Extract YouTube ID helper for preview
  const getYouTubeId = (url: string) => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=))([^"&?\/ ]{8,32})/);
    return match ? match[1] : null;
  };

  const handleSaveVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExerciseForVideo) return;

    try {
      setIsSubmitting(true);
      await api.post('/admin/exercise-library/videos', {
        exercise_id: selectedExerciseForVideo.id,
        ...videoForm,
      });

      showToast('Tutorial video successfully published to platform library!');
      setShowAddVideoModal(false);
      setSelectedExerciseForVideo(null);
      setVideoForm({
        title: '',
        provider: 'youtube',
        video_url: '',
        creator_name: '',
        attribution_text: '',
        rights_status: 'public_embed_allowed',
        content_source: 'youtube',
        duration_seconds: 300,
        is_primary: true,
      });
      fetchData();
    } catch (err: any) {
      showToast(errorMessage(err) || 'Error publishing video', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await api.post('/admin/exercise-library/exercises', exerciseForm);

      showToast('New exercise created successfully in master catalog!');
      setShowAddExerciseModal(false);
      setExerciseForm({
        name: '',
        name_mr: '',
        name_hi: '',
        code: '',
        category: 'chest',
        target_muscle_group: '',
        exercise_type: 'strength',
        equipment_required: 'barbells',
        difficulty_level: 'beginner',
        instructions: '',
        safety_notes: '',
      });
      fetchData();
    } catch (err: any) {
      showToast(errorMessage(err) || 'Error creating exercise', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBatchHealthCheck = async () => {
    try {
      showToast('Initiating non-streaming health checks across videos...');
      const res = await api.post('/admin/exercise-library/videos/batch-health-check');
      showToast(`Health check complete: ${res.data.healthy} healthy, ${res.data.errors} errors.`);
      fetchData();
    } catch (err) {
      showToast('Health check failed', 'error');
    }
  };

  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;

    const formData = new FormData();
    formData.append('file', csvFile);

    try {
      setIsImporting(true);
      const res = await api.post('/admin/exercise-library/exercises/bulk-import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      showToast(`Imported ${res.data.imported_count} exercises successfully!`);
      setShowCsvImportModal(false);
      setCsvFile(null);
      fetchData();
    } catch (err: any) {
      showToast(errorMessage(err) || 'CSV Import error', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
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
              Centralized Ecosystem
            </span>
            <span className="text-xs text-gym-secondary font-medium">Multi-tenant Video Management</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-gym-primary flex items-center gap-2">
            <Video className="w-6 h-6 text-gym-red" />
            Exercise Video Library
          </h1>
          <p className="text-xs md:text-sm text-gym-secondary mt-1">
            Curate verified exercise tutorial videos once. Every enrolled gym automatically receives instant access.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => setShowCsvImportModal(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-gym text-gym-primary hover:border-gym-red text-xs font-bold transition-all cursor-pointer bg-gym-base"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <span>CSV Import</span>
          </button>
          <button
            onClick={handleBatchHealthCheck}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-gym text-gym-primary hover:border-gym-red text-xs font-bold transition-all cursor-pointer bg-gym-base"
            title="Verify YouTube and direct video playback links"
          >
            <RefreshCw className="w-4 h-4 text-gym-secondary" />
            <span>Health Check</span>
          </button>
          <button
            onClick={() => setShowAddExerciseModal(true)}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gym-red hover:bg-gym-red-hover text-white text-xs font-bold shadow-md shadow-gym-red/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Exercise</span>
          </button>
        </div>
      </div>

      {/* Overview Statistics (8 KPIs) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-gym-card border border-gym p-3.5 rounded-xl shadow-xs">
          <div className="text-[11px] font-bold text-gym-secondary uppercase tracking-wider">Total Exercises</div>
          <div className="text-xl font-black text-gym-primary mt-1">{metrics?.total_exercises ?? '—'}</div>
        </div>

        <div className="bg-gym-card border border-gym p-3.5 rounded-xl shadow-xs">
          <div className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider">Approved Videos</div>
          <div className="text-xl font-black text-emerald-500 mt-1">{metrics?.approved_videos ?? '—'}</div>
        </div>

        <div className="bg-gym-card border border-gym p-3.5 rounded-xl shadow-xs">
          <div className="text-[11px] font-bold text-gym-secondary uppercase tracking-wider">Categories</div>
          <div className="text-xl font-black text-gym-primary mt-1">{metrics?.total_categories ?? '—'}</div>
        </div>

        <div className="bg-gym-card border border-gym p-3.5 rounded-xl shadow-xs">
          <div className="text-[11px] font-bold text-amber-500 uppercase tracking-wider">Pending Review</div>
          <div className="text-xl font-black text-amber-500 mt-1">{metrics?.pending_review_videos ?? '0'}</div>
        </div>

        <div className="bg-gym-card border border-gym p-3.5 rounded-xl shadow-xs">
          <div className="text-[11px] font-bold text-rose-500 uppercase tracking-wider">Playback Errors</div>
          <div className="text-xl font-black text-rose-500 mt-1">{metrics?.playback_errors ?? '0'}</div>
        </div>

        <div className="bg-gym-card border border-gym p-3.5 rounded-xl shadow-xs">
          <div className="text-[11px] font-bold text-gym-secondary uppercase tracking-wider">Without Videos</div>
          <div className="text-xl font-black text-gym-primary mt-1">{metrics?.exercises_without_tutorials ?? '—'}</div>
        </div>

        <div className="bg-gym-card border border-gym p-3.5 rounded-xl shadow-xs">
          <div className="text-[11px] font-bold text-cyan-500 uppercase tracking-wider">Gyms Using</div>
          <div className="text-xl font-black text-cyan-500 mt-1">{metrics?.gyms_using_library ?? '—'}</div>
        </div>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="bg-gym-card border border-gym rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gym-secondary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by exercise name, code, muscle group (English, मराठी, हिंदी)..."
            className="w-full pl-10 pr-4 py-2 bg-gym-base border border-gym rounded-xl text-xs font-medium text-gym-primary focus:outline-none focus:border-gym-red"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-gym-base border border-gym rounded-xl text-xs font-semibold text-gym-primary focus:outline-none focus:border-gym-red"
          >
            <option value="all">All Muscle Groups</option>
            <option value="chest">Chest</option>
            <option value="back">Back</option>
            <option value="shoulders">Shoulders</option>
            <option value="biceps">Biceps</option>
            <option value="triceps">Triceps</option>
            <option value="legs">Legs</option>
            <option value="glutes">Glutes</option>
            <option value="abs_core">Abs & Core</option>
            <option value="full_body">Full Body</option>
          </select>

          {/* Video Status Filter */}
          <select
            value={filterHasVideo}
            onChange={(e) => setFilterHasVideo(e.target.value)}
            className="px-3 py-2 bg-gym-base border border-gym rounded-xl text-xs font-semibold text-gym-primary focus:outline-none focus:border-gym-red"
          >
            <option value="all">All Status</option>
            <option value="has_video">Has Tutorial Video</option>
            <option value="no_video">Missing Tutorial Video</option>
          </select>
        </div>
      </div>

      {/* Exercise Catalog Grid */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-sm font-semibold text-gym-secondary">
          <RefreshCw className="w-5 h-5 animate-spin mr-2 text-gym-red" />
          Loading centralized exercise library...
        </div>
      ) : filteredExercises.length === 0 ? (
        <div className="bg-gym-card border border-gym rounded-2xl p-12 text-center">
          <Dumbbell className="w-10 h-10 text-gym-secondary mx-auto mb-3 opacity-40" />
          <h3 className="text-base font-bold text-gym-primary">No exercises found</h3>
          <p className="text-xs text-gym-secondary mt-1">Try adjusting your search terms or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExercises.map((exercise) => {
            const hasVideo = !!exercise.default_video_id;
            const video = exercise.default_video;

            return (
              <div
                key={exercise.id}
                className="bg-gym-card border border-gym rounded-2xl overflow-hidden hover:border-gym-red transition-all flex flex-col justify-between shadow-xs group"
              >
                <div>
                  {/* Thumbnail / Video Preview Header */}
                  <div className="relative aspect-video bg-neutral-900 overflow-hidden flex items-center justify-center">
                    {exercise.thumbnail_url || video?.thumbnail_url ? (
                      <img
                        src={exercise.thumbnail_url || video?.thumbnail_url}
                        alt={exercise.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-neutral-600">
                        <Dumbbell className="w-8 h-8 mb-1" />
                        <span className="text-[10px] uppercase font-bold tracking-wider">No Video Thumbnail</span>
                      </div>
                    )}

                    {/* Play Button Overlay */}
                    {hasVideo && video?.embed_url && (
                      <button
                        onClick={() =>
                          setActivePreviewVideo({
                            title: exercise.name,
                            embedUrl: video.embed_url!,
                          })
                        }
                        className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-gym-red/90 hover:bg-gym-red text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110 cursor-pointer"
                        title="Watch demonstration"
                      >
                        <Play className="w-5 h-5 fill-white ml-0.5" />
                      </button>
                    )}

                    {/* Top Badges */}
                    <div className="absolute top-2 left-2 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-black/75 text-white backdrop-blur-xs">
                        {exercise.code || 'EX-FIT'}
                      </span>
                      {hasVideo ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-600/90 text-white backdrop-blur-xs flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Platform Tutorial
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-600/90 text-white backdrop-blur-xs">
                          Instructions Only
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body Details */}
                  <div className="p-4 space-y-2.5">
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

                    {video && (
                      <div className="pt-2 border-t border-gym text-[11px] text-gym-secondary space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="truncate font-medium">{video.title}</span>
                          <span className="text-[10px] font-bold text-emerald-500 uppercase">{video.rights_status}</span>
                        </div>
                        {video.creator_name && (
                          <div className="text-[10px] opacity-75">By {video.creator_name}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="p-3 bg-gym-base/50 border-t border-gym flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setSelectedExerciseForVideo(exercise);
                      if (video) {
                        setVideoForm({
                          title: video.title,
                          provider: video.provider || 'youtube',
                          video_url: `https://www.youtube.com/watch?v=${video.video_id}`,
                          creator_name: video.creator_name || '',
                          attribution_text: '',
                          rights_status: video.rights_status || 'public_embed_allowed',
                          content_source: 'youtube',
                          duration_seconds: 300,
                          is_primary: true,
                        });
                      }
                      setShowAddVideoModal(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg border border-gym hover:border-gym-red text-xs font-bold text-gym-primary transition-all cursor-pointer bg-gym-card"
                  >
                    <Plus className="w-3.5 h-3.5 text-gym-red" />
                    <span>{hasVideo ? 'Replace Video' : '+ Add Video'}</span>
                  </button>

                  {hasVideo && video?.embed_url && (
                    <button
                      onClick={() =>
                        setActivePreviewVideo({
                          title: exercise.name,
                          embedUrl: video.embed_url!,
                        })
                      }
                      className="flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg bg-gym-red-subtle text-gym-red hover:bg-gym-red hover:text-white text-xs font-bold transition-all cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: ADD / ATTACH TUTORIAL VIDEO */}
      {showAddVideoModal && selectedExerciseForVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-gym-card border border-gym rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in duration-200">
            <div className="p-5 border-b border-gym flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gym-primary flex items-center gap-2">
                  <Video className="w-5 h-5 text-gym-red" />
                  Attach Tutorial Video: {selectedExerciseForVideo.name}
                </h3>
                <p className="text-xs text-gym-secondary mt-0.5">
                  Platform tutorial will immediately become accessible to all enrolled gyms.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddVideoModal(false);
                  setSelectedExerciseForVideo(null);
                }}
                className="text-gym-secondary hover:text-gym-primary p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVideo} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gym-primary mb-1">Video Title *</label>
                <input
                  type="text"
                  required
                  value={videoForm.title}
                  onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })}
                  placeholder="e.g. How To Properly Squat (Step-by-Step Guide)"
                  className="w-full px-3.5 py-2 bg-gym-base border border-gym rounded-xl text-xs font-medium text-gym-primary focus:outline-none focus:border-gym-red"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gym-primary mb-1">Content Provider *</label>
                  <select
                    value={videoForm.provider}
                    onChange={(e) => setVideoForm({ ...videoForm, provider: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gym-base border border-gym rounded-xl text-xs font-semibold text-gym-primary focus:outline-none focus:border-gym-red"
                  >
                    <option value="youtube">YouTube (Official Privacy Embed)</option>
                    <option value="custom_upload">Direct Upload (MP4/WebM)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gym-primary mb-1">Rights / Attribution Status *</label>
                  <select
                    value={videoForm.rights_status}
                    onChange={(e) => setVideoForm({ ...videoForm, rights_status: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gym-base border border-gym rounded-xl text-xs font-semibold text-gym-primary focus:outline-none focus:border-gym-red"
                  >
                    <option value="public_embed_allowed">Public Embed Allowed (Standard YouTube)</option>
                    <option value="licensed_commercial">Commercial / Creator Licensed</option>
                    <option value="platform_owned">Platform Original Owned</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gym-primary mb-1">
                  YouTube Video URL *
                </label>
                <input
                  type="url"
                  required
                  value={videoForm.video_url}
                  onChange={(e) => setVideoForm({ ...videoForm, video_url: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=ultWZbUMPL8 or https://youtu.be/..."
                  className="w-full px-3.5 py-2 bg-gym-base border border-gym rounded-xl text-xs font-medium text-gym-primary focus:outline-none focus:border-gym-red"
                />
              </div>

              {/* Real-time Video Preview */}
              {videoForm.video_url && getYouTubeId(videoForm.video_url) && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Valid YouTube Video (Privacy-Enhanced Embed Mode)
                  </span>
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-gym">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${getYouTubeId(videoForm.video_url)}?rel=0&modestbranding=1`}
                      title="Preview"
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gym-primary mb-1">Creator / Channel Name</label>
                  <input
                    type="text"
                    value={videoForm.creator_name}
                    onChange={(e) => setVideoForm({ ...videoForm, creator_name: e.target.value })}
                    placeholder="e.g. Scott Herman Fitness"
                    className="w-full px-3.5 py-2 bg-gym-base border border-gym rounded-xl text-xs font-medium text-gym-primary focus:outline-none focus:border-gym-red"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gym-primary mb-1">Duration (Seconds)</label>
                  <input
                    type="number"
                    value={videoForm.duration_seconds}
                    onChange={(e) => setVideoForm({ ...videoForm, duration_seconds: parseInt(e.target.value) || 0 })}
                    placeholder="300"
                    className="w-full px-3.5 py-2 bg-gym-base border border-gym rounded-xl text-xs font-medium text-gym-primary focus:outline-none focus:border-gym-red"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="is_primary"
                  checked={videoForm.is_primary}
                  onChange={(e) => setVideoForm({ ...videoForm, is_primary: e.target.checked })}
                  className="rounded border-gym text-gym-red focus:ring-gym-red cursor-pointer"
                />
                <label htmlFor="is_primary" className="text-xs font-semibold text-gym-primary cursor-pointer">
                  Set as default global tutorial video for this exercise
                </label>
              </div>

              <div className="pt-4 border-t border-gym flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddVideoModal(false)}
                  className="px-4 py-2 rounded-xl border border-gym text-xs font-bold text-gym-secondary hover:text-gym-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-gym-red hover:bg-gym-red-hover text-white text-xs font-bold shadow-md shadow-gym-red/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Publish to Platform Library'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD NEW EXERCISE */}
      {showAddExerciseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-gym-card border border-gym rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in duration-200">
            <div className="p-5 border-b border-gym flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gym-primary flex items-center gap-2">
                  <Plus className="w-5 h-5 text-gym-red" />
                  Add Exercise to Catalog
                </h3>
                <p className="text-xs text-gym-secondary mt-0.5">Define master exercise details and translations</p>
              </div>
              <button onClick={() => setShowAddExerciseModal(false)} className="text-gym-secondary hover:text-gym-primary p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExercise} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-gym-primary mb-1">Exercise Name (English) *</label>
                  <input
                    type="text"
                    required
                    value={exerciseForm.name}
                    onChange={(e) => setExerciseForm({ ...exerciseForm, name: e.target.value })}
                    placeholder="e.g. Incline Dumbbell Press"
                    className="w-full px-3.5 py-2 bg-gym-base border border-gym rounded-xl text-xs font-medium text-gym-primary focus:outline-none focus:border-gym-red"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gym-primary mb-1">मराठी नाव</label>
                  <input
                    type="text"
                    value={exerciseForm.name_mr}
                    onChange={(e) => setExerciseForm({ ...exerciseForm, name_mr: e.target.value })}
                    placeholder="उदा. इन्क्लाइन डंबेल प्रेस"
                    className="w-full px-3 py-2 bg-gym-base border border-gym rounded-xl text-xs font-medium text-gym-primary focus:outline-none focus:border-gym-red"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gym-primary mb-1">हिंदी नाम</label>
                  <input
                    type="text"
                    value={exerciseForm.name_hi}
                    onChange={(e) => setExerciseForm({ ...exerciseForm, name_hi: e.target.value })}
                    placeholder="उदा. इन्क्लाइन डम्बल प्रेस"
                    className="w-full px-3 py-2 bg-gym-base border border-gym rounded-xl text-xs font-medium text-gym-primary focus:outline-none focus:border-gym-red"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gym-primary mb-1">Exercise Code</label>
                  <input
                    type="text"
                    value={exerciseForm.code}
                    onChange={(e) => setExerciseForm({ ...exerciseForm, code: e.target.value })}
                    placeholder="EX-CHEST-12"
                    className="w-full px-3 py-2 bg-gym-base border border-gym rounded-xl text-xs font-medium text-gym-primary focus:outline-none focus:border-gym-red"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gym-primary mb-1">Muscle Group *</label>
                  <select
                    value={exerciseForm.category}
                    onChange={(e) => setExerciseForm({ ...exerciseForm, category: e.target.value })}
                    className="w-full px-3 py-2 bg-gym-base border border-gym rounded-xl text-xs font-semibold text-gym-primary focus:outline-none focus:border-gym-red"
                  >
                    <option value="chest">Chest</option>
                    <option value="back">Back</option>
                    <option value="shoulders">Shoulders</option>
                    <option value="biceps">Biceps</option>
                    <option value="triceps">Triceps</option>
                    <option value="legs">Legs</option>
                    <option value="glutes">Glutes</option>
                    <option value="abs_core">Abs & Core</option>
                    <option value="full_body">Full Body</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gym-primary mb-1">Equipment *</label>
                  <select
                    value={exerciseForm.equipment_required}
                    onChange={(e) => setExerciseForm({ ...exerciseForm, equipment_required: e.target.value })}
                    className="w-full px-3 py-2 bg-gym-base border border-gym rounded-xl text-xs font-semibold text-gym-primary focus:outline-none focus:border-gym-red"
                  >
                    <option value="barbells">Barbells</option>
                    <option value="dumbbells">Dumbbells</option>
                    <option value="cable_machines">Cable Machines</option>
                    <option value="machines">Machines</option>
                    <option value="bodyweight_eq">Bodyweight</option>
                    <option value="resistance_bands">Resistance Bands</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gym-primary mb-1">Difficulty *</label>
                  <select
                    value={exerciseForm.difficulty_level}
                    onChange={(e) => setExerciseForm({ ...exerciseForm, difficulty_level: e.target.value })}
                    className="w-full px-3 py-2 bg-gym-base border border-gym rounded-xl text-xs font-semibold text-gym-primary focus:outline-none focus:border-gym-red"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gym-primary mb-1">Step-by-Step Instructions</label>
                <textarea
                  rows={2}
                  value={exerciseForm.instructions}
                  onChange={(e) => setExerciseForm({ ...exerciseForm, instructions: e.target.value })}
                  placeholder="Set up bench, grasp weights firmly, press smoothly without locking elbows abruptly..."
                  className="w-full px-3 py-2 bg-gym-base border border-gym rounded-xl text-xs font-medium text-gym-primary focus:outline-none focus:border-gym-red"
                />
              </div>

              <div className="pt-4 border-t border-gym flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddExerciseModal(false)}
                  className="px-4 py-2 rounded-xl border border-gym text-xs font-bold text-gym-secondary hover:text-gym-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-gym-red hover:bg-gym-red-hover text-white text-xs font-bold shadow-md shadow-gym-red/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Save Exercise'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CSV BULK IMPORT */}
      {showCsvImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-gym-card border border-gym rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in duration-200">
            <div className="p-5 border-b border-gym flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gym-primary flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                  Bulk Import Exercises via CSV
                </h3>
                <p className="text-xs text-gym-secondary mt-0.5">Upload a standard comma-separated values spreadsheet</p>
              </div>
              <button onClick={() => setShowCsvImportModal(false)} className="text-gym-secondary hover:text-gym-primary p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCsvImport} className="p-5 space-y-4">
              <div className="border-2 border-dashed border-gym hover:border-gym-red rounded-2xl p-6 text-center cursor-pointer transition-colors bg-gym-base/50">
                <input
                  type="file"
                  id="csv_upload"
                  accept=".csv,.txt"
                  onChange={(e) => setCsvFile(e.target.files ? e.target.files[0] : null)}
                  className="hidden"
                />
                <label htmlFor="csv_upload" className="cursor-pointer space-y-2 block">
                  <FileSpreadsheet className="w-10 h-10 text-emerald-500 mx-auto" />
                  <div className="text-xs font-bold text-gym-primary">
                    {csvFile ? csvFile.name : 'Click to select .CSV exercise file'}
                  </div>
                  <div className="text-[11px] text-gym-secondary">Supported headers: name, name_mr, name_hi, category, equipment, difficulty, instructions</div>
                </label>
              </div>

              <div className="pt-4 border-t border-gym flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCsvImportModal(false)}
                  className="px-4 py-2 rounded-xl border border-gym text-xs font-bold text-gym-secondary hover:text-gym-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!csvFile || isImporting}
                  className="px-5 py-2 rounded-xl bg-gym-red hover:bg-gym-red-hover text-white text-xs font-bold shadow-md shadow-gym-red/20 disabled:opacity-50"
                >
                  {isImporting ? 'Processing CSV...' : 'Start Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: WATCH DEMO VIDEO */}
      {activePreviewVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs">
          <div className="bg-gym-card border border-gym rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-gym flex items-center justify-between">
              <h3 className="text-sm font-bold text-gym-primary flex items-center gap-2 truncate">
                <PlayCircle className="w-4 h-4 text-gym-red" />
                {activePreviewVideo.title} — Demonstration
              </h3>
              <button onClick={() => setActivePreviewVideo(null)} className="text-gym-secondary hover:text-gym-primary p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative aspect-video bg-black">
              <iframe
                src={activePreviewVideo.embedUrl}
                title={activePreviewVideo.title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminExerciseLibrary;
