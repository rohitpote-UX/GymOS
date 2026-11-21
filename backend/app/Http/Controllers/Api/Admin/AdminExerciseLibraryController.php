<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Exercise;
use App\Models\ExerciseCategory;
use App\Models\ExerciseVideo;
use App\Models\Gym;
use App\Models\VideoProvider;
use App\Services\ExerciseVideoResolverService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class AdminExerciseLibraryController extends Controller
{
    protected ExerciseVideoResolverService $resolverService;

    public function __construct(ExerciseVideoResolverService $resolverService)
    {
        $this->resolverService = $resolverService;
    }

    /**
     * Dashboard Overview Metrics
     */
    public function overview(): JsonResponse
    {
        $totalExercises = Exercise::withoutGlobalScopes()->count();
        $approvedVideos = ExerciseVideo::where('status', 'approved')->count();
        $totalCategories = ExerciseCategory::count();
        $pendingReviewVideos = ExerciseVideo::where('status', 'pending_review')->count();
        $playbackErrors = ExerciseVideo::where('health_status', 'playback_error')->count();

        // Exercises that have no approved video (neither default nor video relation)
        $exercisesWithoutTutorials = Exercise::withoutGlobalScopes()
            ->where(function ($q) {
                $q->whereNull('default_video_id')
                    ->whereDoesntHave('videos', function ($vq) {
                        $vq->where('status', 'approved')->where('is_active', true);
                    });
            })
            ->count();

        // Total gyms using the video library (either have active overrides or custom videos)
        $gymsUsingLibrary = Gym::whereHas('videoOverrides')
            ->orWhereHas('customVideos')
            ->count();

        return response()->json([
            'total_exercises' => $totalExercises,
            'approved_videos' => $approvedVideos,
            'total_categories' => $totalCategories,
            'pending_review_videos' => $pendingReviewVideos,
            'playback_errors' => $playbackErrors,
            'exercises_without_tutorials' => $exercisesWithoutTutorials,
            'gyms_using_library' => $gymsUsingLibrary,
        ]);
    }

    /**
     * Exercise Categories
     */
    public function categories(Request $request): JsonResponse
    {
        $type = $request->query('type');
        $query = ExerciseCategory::withCount('exercises')->orderBy('sort_order')->orderBy('name');

        if ($type) {
            $query->where('type', $type);
        }

        return response()->json($query->get());
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'name_mr' => 'nullable|string|max:100',
            'name_hi' => 'nullable|string|max:100',
            'slug' => 'nullable|string|max:100|unique:exercise_categories,slug',
            'type' => 'required|in:muscle_group,exercise_type,equipment,other',
            'description' => 'nullable|string|max:500',
            'sort_order' => 'nullable|integer',
            'is_active' => 'boolean',
        ]);

        if (empty($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['name']);
        }

        $category = ExerciseCategory::create($validated);

        return response()->json($category, 201);
    }

    public function updateCategory(Request $request, int $id): JsonResponse
    {
        $category = ExerciseCategory::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:100',
            'name_mr' => 'nullable|string|max:100',
            'name_hi' => 'nullable|string|max:100',
            'slug' => 'sometimes|required|string|max:100|unique:exercise_categories,slug,' . $id,
            'type' => 'sometimes|required|in:muscle_group,exercise_type,equipment,other',
            'description' => 'nullable|string|max:500',
            'sort_order' => 'nullable|integer',
            'is_active' => 'boolean',
        ]);

        $category->update($validated);

        return response()->json($category);
    }

    public function deleteCategory(int $id): JsonResponse
    {
        $category = ExerciseCategory::findOrFail($id);
        $category->delete();

        return response()->json(['message' => 'Category deleted successfully']);
    }

    /**
     * Centralized Exercise Catalog
     */
    public function exercises(Request $request): JsonResponse
    {
        $search = $request->query('search');
        $category = $request->query('category');
        $exerciseType = $request->query('exercise_type');
        $equipment = $request->query('equipment');
        $hasVideo = $request->query('has_video');

        $query = Exercise::withoutGlobalScopes()
            ->with(['categories', 'defaultVideo', 'globalVideos'])
            ->orderBy('name');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('name_mr', 'like', "%{$search}%")
                    ->orWhere('name_hi', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%")
                    ->orWhere('target_muscle_group', 'like', "%{$search}%");
            });
        }

        if ($category) {
            $query->where(function ($q) use ($category) {
                $q->where('category', $category)
                    ->orWhereHas('categories', function ($cq) use ($category) {
                        $cq->where('slug', $category);
                    });
            });
        }

        if ($exerciseType) {
            $query->where('exercise_type', $exerciseType);
        }

        if ($equipment) {
            $query->where('equipment_required', $equipment);
        }

        if ($hasVideo === 'yes') {
            $query->whereNotNull('default_video_id');
        } elseif ($hasVideo === 'no') {
            $query->whereNull('default_video_id');
        }

        $perPage = (int) $request->query('per_page', 50);
        $exercises = $query->paginate($perPage);

        return response()->json($exercises);
    }

    public function storeExercise(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'name_mr' => 'nullable|string|max:150',
            'name_hi' => 'nullable|string|max:150',
            'code' => 'nullable|string|max:80|unique:exercises,code',
            'category' => 'required|string|max:60',
            'target_muscle_group' => 'nullable|string|max:150',
            'secondary_muscles' => 'nullable|array',
            'exercise_type' => 'required|string|max:60',
            'equipment_required' => 'nullable|string|max:100',
            'equipment_types' => 'nullable|array',
            'difficulty_level' => 'required|in:beginner,intermediate,advanced',
            'instructions' => 'nullable|string',
            'common_mistakes' => 'nullable|string',
            'safety_notes' => 'nullable|string',
            'category_ids' => 'nullable|array',
            'category_ids.*' => 'integer|exists:exercise_categories,id',
            'is_active' => 'boolean',
        ]);

        if (empty($validated['code'])) {
            $validated['code'] = 'EX-' . strtoupper(Str::slug($validated['category'])) . '-' . rand(100, 999);
        }

        $validated['is_system'] = true;

        $exercise = Exercise::create($validated);

        if (!empty($validated['category_ids'])) {
            $exercise->categories()->sync($validated['category_ids']);
        }

        return response()->json($exercise->load(['categories', 'defaultVideo']), 201);
    }

    public function updateExercise(Request $request, int $id): JsonResponse
    {
        $exercise = Exercise::withoutGlobalScopes()->findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:150',
            'name_mr' => 'nullable|string|max:150',
            'name_hi' => 'nullable|string|max:150',
            'code' => 'nullable|string|max:80|unique:exercises,code,' . $id,
            'category' => 'sometimes|required|string|max:60',
            'target_muscle_group' => 'nullable|string|max:150',
            'secondary_muscles' => 'nullable|array',
            'exercise_type' => 'sometimes|required|string|max:60',
            'equipment_required' => 'nullable|string|max:100',
            'equipment_types' => 'nullable|array',
            'difficulty_level' => 'sometimes|required|in:beginner,intermediate,advanced',
            'instructions' => 'nullable|string',
            'common_mistakes' => 'nullable|string',
            'safety_notes' => 'nullable|string',
            'default_video_id' => 'nullable|integer|exists:exercise_videos,id',
            'thumbnail_url' => 'nullable|string|max:500',
            'category_ids' => 'nullable|array',
            'category_ids.*' => 'integer|exists:exercise_categories,id',
            'is_active' => 'boolean',
        ]);

        $exercise->update($validated);

        if (isset($validated['category_ids'])) {
            $exercise->categories()->sync($validated['category_ids']);
        }

        return response()->json($exercise->load(['categories', 'defaultVideo']));
    }

    /**
     * CSV Bulk Exercise Import
     */
    public function bulkImport(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt|max:5120',
        ]);

        $file = $request->file('file');
        $handle = fopen($file->getRealPath(), 'r');
        $header = fgetcsv($handle);

        if (!$header) {
            return response()->json(['error' => 'CSV file is empty or invalid'], 422);
        }

        // Clean headers and strip UTF-8 BOM on the first column if present
        $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', (string) $header[0]);
        $header = array_map(fn($col) => strtolower(trim(str_replace([' ', '-'], '_', (string) $col))), $header);

        $imported = 0;
        $videosCreated = 0;
        $skipped = 0;

        DB::beginTransaction();
        try {
            while (($row = fgetcsv($handle)) !== false) {
                if (count($row) !== count($header)) {
                    continue;
                }
                $data = array_combine($header, $row);

                // Detect exercise name from various header candidates
                $name = trim(
                    $data['exercise'] ??
                    $data['name'] ??
                    $data['exercise_name'] ??
                    $data['workout'] ??
                    $data['title'] ??
                    ''
                );

                if (!$name) {
                    $skipped++;
                    continue;
                }

                // Detect category / muscle group
                $rawMuscle = trim($data['muscle_group'] ?? $data['category'] ?? $data['target_muscle_group'] ?? $data['muscle'] ?? 'chest');
                $lowerMuscle = strtolower($rawMuscle);

                if (str_contains($lowerMuscle, 'chest')) {
                    $category = 'chest';
                } elseif (str_contains($lowerMuscle, 'back') || str_contains($lowerMuscle, 'lat')) {
                    $category = 'back';
                } elseif (str_contains($lowerMuscle, 'shoulder') || str_contains($lowerMuscle, 'trap') || str_contains($lowerMuscle, 'delt')) {
                    $category = 'shoulders';
                } elseif (str_contains($lowerMuscle, 'leg') || str_contains($lowerMuscle, 'quad') || str_contains($lowerMuscle, 'hamstring') || str_contains($lowerMuscle, 'glute') || str_contains($lowerMuscle, 'calv')) {
                    $category = 'legs';
                } elseif (str_contains($lowerMuscle, 'bicep') || str_contains($lowerMuscle, 'tricep') || str_contains($lowerMuscle, 'arm')) {
                    $category = 'arms';
                } elseif (str_contains($lowerMuscle, 'core') || str_contains($lowerMuscle, 'ab')) {
                    $category = 'core';
                } elseif (str_contains($lowerMuscle, 'cardio')) {
                    $category = 'cardio';
                } elseif (str_contains($lowerMuscle, 'warm') || str_contains($lowerMuscle, 'mobility') || str_contains($lowerMuscle, 'stretch') || str_contains($lowerMuscle, 'recovery')) {
                    $category = 'mobility';
                } else {
                    $category = Str::slug($rawMuscle) ?: 'chest';
                }

                $code = trim($data['code'] ?? '');
                if (empty($code) || Exercise::withoutGlobalScopes()->where('code', $code)->exists()) {
                    $code = 'EX-' . strtoupper(substr($category, 0, 4)) . '-' . rand(1000, 9999);
                }

                $exercise = Exercise::withoutGlobalScopes()->updateOrCreate(
                    ['name' => $name],
                    [
                        'code' => $code,
                        'name_mr' => trim($data['name_mr'] ?? ''),
                        'name_hi' => trim($data['name_hi'] ?? ''),
                        'category' => $category,
                        'target_muscle_group' => trim($data['target_muscle_group'] ?? $rawMuscle ?: ucfirst($category)),
                        'exercise_type' => strtolower(trim($data['exercise_type'] ?? 'strength_training')),
                        'equipment_required' => strtolower(trim($data['equipment'] ?? $data['equipment_required'] ?? 'barbells')),
                        'difficulty_level' => in_array(strtolower(trim($data['difficulty_level'] ?? '')), ['beginner', 'intermediate', 'advanced']) ? strtolower(trim($data['difficulty_level'])) : 'beginner',
                        'instructions' => trim($data['instructions'] ?? "Perform {$name} with controlled tempo and strict form."),
                        'safety_notes' => trim($data['safety_notes'] ?? 'Maintain safe posture and avoid hyperextension.'),
                        'is_system' => true,
                        'is_active' => true,
                    ]
                );

                // Detect video URL or video ID from row fields
                $videoUrl = trim(
                    $data['video_url_to_fill'] ??
                    $data['video_url'] ??
                    $data['youtube_url'] ??
                    $data['video_link'] ??
                    $data['tutorial_url'] ??
                    $data['tutorial_video'] ??
                    $data['youtube_link'] ??
                    $data['video'] ??
                    $data['url'] ??
                    $data['link'] ??
                    ''
                );

                // If not found in named columns, scan row values for a YouTube or Vimeo link
                if (!$videoUrl) {
                    foreach ($data as $colVal) {
                        $valTrim = trim((string) $colVal);
                        if (str_contains($valTrim, 'youtube.com/watch') || str_contains($valTrim, 'youtu.be/') || str_contains($valTrim, 'vimeo.com/')) {
                            $videoUrl = $valTrim;
                            break;
                        }
                    }
                }

                $videoId = trim(
                    $data['video_id'] ??
                    $data['youtube_id'] ??
                    $data['youtube_video_id'] ??
                    ''
                );

                if ($videoUrl || $videoId) {
                    $provider = strtolower(trim($data['provider'] ?? 'youtube'));
                    if (str_contains($videoUrl, 'vimeo')) {
                        $provider = 'vimeo';
                    }

                    if (empty($videoId) && $provider === 'youtube') {
                        $extracted = $this->resolverService->extractYouTubeId($videoUrl);
                        if ($extracted) {
                            $videoId = $extracted;
                        }
                    }

                    $embedUrl = $this->resolverService->generateSafeEmbedUrl($provider, $videoId ?: $videoUrl, $videoUrl);
                    $videoTitle = trim($data['video_title'] ?? $data['title'] ?? ($name . ' Tutorial'));
                    $creator = trim($data['creator_name'] ?? $data['creator'] ?? $data['channel'] ?? $data['instructor'] ?? 'Master Trainer');
                    $duration = (int) ($data['duration_seconds'] ?? $data['duration'] ?? 180);
                    $thumb = trim($data['thumbnail_url'] ?? $data['thumbnail'] ?? '');
                    if (!$thumb && $videoId && $provider === 'youtube') {
                        $thumb = "https://img.youtube.com/vi/{$videoId}/hqdefault.jpg";
                    }

                    $video = ExerciseVideo::updateOrCreate(
                        [
                            'exercise_id' => $exercise->id,
                            'gym_id' => null, // Global platform video
                        ],
                        [
                            'title' => $videoTitle,
                            'provider' => $provider,
                            'video_id' => $videoId ?: substr(md5($videoUrl), 0, 16),
                            'video_url' => $videoUrl ?: ($videoId ? "https://www.youtube.com/watch?v={$videoId}" : ''),
                            'embed_url' => $embedUrl,
                            'thumbnail_url' => $thumb,
                            'duration_seconds' => $duration > 0 ? $duration : 180,
                            'creator_name' => $creator,
                            'attribution_text' => "Demonstration by {$creator}",
                            'rights_status' => 'public_embed_allowed',
                            'content_source' => 'youtube',
                            'is_primary' => true,
                            'status' => 'approved',
                            'health_status' => 'healthy',
                            'is_active' => true,
                        ]
                    );

                    $exercise->update([
                        'default_video_id' => $video->id,
                        'thumbnail_url' => $thumb ?: $exercise->thumbnail_url,
                    ]);

                    $videosCreated++;
                }

                $imported++;
            }

            DB::commit();
            fclose($handle);

            return response()->json([
                'success' => true,
                'imported_count' => $imported,
                'videos_count' => $videosCreated,
                'skipped_count' => $skipped,
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            fclose($handle);
            return response()->json(['error' => 'Import failed: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Video Management
     */
    public function videos(Request $request): JsonResponse
    {
        $exerciseId = $request->query('exercise_id');
        $status = $request->query('status');
        $healthStatus = $request->query('health_status');
        $provider = $request->query('provider');

        $query = ExerciseVideo::with(['exercise', 'gym'])
            ->whereNull('gym_id') // Platform Super Admin Global Videos
            ->orderByDesc('id');

        if ($exerciseId) {
            $query->where('exercise_id', $exerciseId);
        }

        if ($status) {
            $query->where('status', $status);
        }

        if ($healthStatus) {
            $query->where('health_status', $healthStatus);
        }

        if ($provider) {
            $query->where('provider', $provider);
        }

        return response()->json($query->paginate(30));
    }

    public function storeVideo(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'exercise_id' => 'required|integer|exists:exercises,id',
            'title' => 'required|string|max:200',
            'description' => 'nullable|string|max:1000',
            'provider' => 'required|in:youtube,custom_upload,vimeo',
            'video_url' => 'nullable|string|url|max:500',
            'video_file' => 'nullable|file|mimes:mp4,webm|max:102400', // 100MB max
            'creator_name' => 'nullable|string|max:150',
            'attribution_text' => 'nullable|string|max:500',
            'rights_status' => 'required|in:public_embed_allowed,licensed_commercial,platform_owned,gym_owned',
            'content_source' => 'required|in:youtube,licensed_provider,original_owned,gym_custom',
            'duration_seconds' => 'nullable|integer',
            'language' => 'nullable|string|max:10',
            'is_primary' => 'boolean',
        ]);

        $videoUrl = $validated['video_url'] ?? '';
        $embedUrl = null;
        $videoId = null;
        $thumbnailUrl = null;

        if ($validated['provider'] === 'youtube') {
            if (empty($videoUrl)) {
                return response()->json(['error' => 'YouTube video URL is required'], 422);
            }
            $videoId = $this->resolverService->extractYouTubeId($videoUrl);
            if (!$videoId) {
                return response()->json(['error' => 'Invalid YouTube video URL format. Could not extract video ID.'], 422);
            }
            $embedUrl = $this->resolverService->generateSafeEmbedUrl('youtube', $videoId);
            $thumbnailUrl = "https://img.youtube.com/vi/{$videoId}/hqdefault.jpg";
        } elseif ($validated['provider'] === 'custom_upload') {
            if (!$request->hasFile('video_file')) {
                return response()->json(['error' => 'Video file is required for direct upload'], 422);
            }
            $file = $request->file('video_file');
            $path = $file->store('exercise_videos/global', 'public');
            $videoUrl = Storage::disk('public')->url($path);
            $embedUrl = $videoUrl;
        }

        $exerciseVideo = ExerciseVideo::create([
            'exercise_id' => $validated['exercise_id'],
            'gym_id' => null, // Global platform video
            'created_by_user_id' => auth()->id(),
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'provider' => $validated['provider'],
            'video_url' => $videoUrl,
            'video_id' => $videoId,
            'embed_url' => $embedUrl,
            'thumbnail_url' => $thumbnailUrl,
            'duration_seconds' => $validated['duration_seconds'] ?? null,
            'aspect_ratio' => '16:9',
            'content_source' => $validated['content_source'],
            'rights_status' => $validated['rights_status'],
            'creator_name' => $validated['creator_name'] ?? null,
            'attribution_text' => $validated['attribution_text'] ?? null,
            'status' => 'approved',
            'is_primary' => $validated['is_primary'] ?? true,
            'language' => $validated['language'] ?? 'en',
            'is_active' => true,
            'health_status' => 'healthy',
            'last_health_check_at' => now(),
        ]);

        // If marked as primary, update other global videos for this exercise and set as exercise default
        if ($exerciseVideo->is_primary) {
            ExerciseVideo::where('exercise_id', $exerciseVideo->exercise_id)
                ->whereNull('gym_id')
                ->where('id', '!=', $exerciseVideo->id)
                ->update(['is_primary' => false]);

            $exercise = Exercise::withoutGlobalScopes()->find($exerciseVideo->exercise_id);
            if ($exercise) {
                $exercise->update([
                    'default_video_id' => $exerciseVideo->id,
                    'thumbnail_url' => $thumbnailUrl ?: $exercise->thumbnail_url,
                ]);
            }
        }

        return response()->json($exerciseVideo->load('exercise'), 201);
    }

    public function updateVideo(Request $request, int $id): JsonResponse
    {
        $video = ExerciseVideo::whereNull('gym_id')->findOrFail($id);

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:200',
            'description' => 'nullable|string|max:1000',
            'creator_name' => 'nullable|string|max:150',
            'attribution_text' => 'nullable|string|max:500',
            'rights_status' => 'sometimes|required|in:public_embed_allowed,licensed_commercial,platform_owned,gym_owned',
            'duration_seconds' => 'nullable|integer',
            'is_primary' => 'boolean',
            'is_active' => 'boolean',
            'status' => 'sometimes|required|in:approved,pending_review,rejected,deactivated',
        ]);

        $video->update($validated);

        if (isset($validated['is_primary']) && $validated['is_primary']) {
            ExerciseVideo::where('exercise_id', $video->exercise_id)
                ->whereNull('gym_id')
                ->where('id', '!=', $video->id)
                ->update(['is_primary' => false]);

            $exercise = Exercise::withoutGlobalScopes()->find($video->exercise_id);
            if ($exercise) {
                $exercise->update([
                    'default_video_id' => $video->id,
                    'thumbnail_url' => $video->thumbnail_url ?: $exercise->thumbnail_url,
                ]);
            }
        }

        return response()->json($video->load('exercise'));
    }

    public function deleteVideo(int $id): JsonResponse
    {
        $video = ExerciseVideo::whereNull('gym_id')->findOrFail($id);

        // If this was default video on exercise, clear it or pick next active video
        $exercise = Exercise::withoutGlobalScopes()->find($video->exercise_id);
        if ($exercise && $exercise->default_video_id === $video->id) {
            $next = ExerciseVideo::where('exercise_id', $exercise->id)
                ->whereNull('gym_id')
                ->where('id', '!=', $video->id)
                ->where('status', 'approved')
                ->where('is_active', true)
                ->first();

            $exercise->update([
                'default_video_id' => $next ? $next->id : null,
            ]);
        }

        $video->delete();

        return response()->json(['message' => 'Tutorial video deleted successfully']);
    }

    public function checkHealth(int $id): JsonResponse
    {
        $video = ExerciseVideo::findOrFail($id);
        $check = $this->resolverService->checkVideoHealth($video);

        return response()->json([
            'is_healthy' => $check->is_playable,
            'health_status' => $video->health_status,
            'status_code' => $check->status_code,
            'error_message' => $check->error_message,
            'last_health_check_at' => $video->last_health_check_at,
        ]);
    }

    public function batchHealthCheck(): JsonResponse
    {
        $videos = ExerciseVideo::where('is_active', true)->limit(50)->get();
        $results = [
            'checked' => 0,
            'healthy' => 0,
            'errors' => 0,
        ];

        foreach ($videos as $video) {
            $check = $this->resolverService->checkVideoHealth($video);
            $results['checked']++;
            if ($check->is_playable) {
                $results['healthy']++;
            } else {
                $results['errors']++;
            }
        }

        return response()->json($results);
    }

    public function approveVideo(int $id): JsonResponse
    {
        $video = ExerciseVideo::findOrFail($id);
        $video->update([
            'status' => 'approved',
            'is_active' => true,
        ]);

        return response()->json(['message' => 'Video approved successfully', 'video' => $video]);
    }

    public function providers(): JsonResponse
    {
        return response()->json(VideoProvider::all());
    }

    public function updateProvider(Request $request, int $id): JsonResponse
    {
        $provider = VideoProvider::findOrFail($id);
        $validated = $request->validate([
            'is_enabled' => 'required|boolean',
            'commercial_terms_notes' => 'nullable|string',
            'config' => 'nullable|array',
        ]);

        $provider->update($validated);

        return response()->json($provider);
    }
}
