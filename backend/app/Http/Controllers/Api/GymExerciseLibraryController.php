<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Exercise;
use App\Models\ExerciseCategory;
use App\Models\ExerciseVideo;
use App\Models\Gym;
use App\Models\GymExerciseVideoOverride;
use App\Services\ExerciseVideoResolverService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class GymExerciseLibraryController extends Controller
{
    protected ExerciseVideoResolverService $resolverService;

    public function __construct(ExerciseVideoResolverService $resolverService)
    {
        $this->resolverService = $resolverService;
    }

    protected function getGymId(): int
    {
        $user = auth()->user();
        if ($user && $user->gym_id) {
            return $user->gym_id;
        }

        abort(403, 'Tenant context missing. Gym ID is required.');
    }

    /**
     * List exercises with resolved video status for this gym.
     */
    public function index(Request $request): JsonResponse
    {
        $gymId = $this->getGymId();
        $search = $request->query('search');
        $muscleGroup = $request->query('muscle_group');
        $equipment = $request->query('equipment');
        $statusFilter = $request->query('status_filter'); // all, overridden, platform_default, no_video

        $query = Exercise::withoutGlobalScopes()
            ->with(['categories', 'defaultVideo'])
            ->where('is_active', true)
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

        if ($muscleGroup) {
            $query->where(function ($q) use ($muscleGroup) {
                $q->where('category', $muscleGroup)
                    ->orWhereHas('categories', function ($cq) use ($muscleGroup) {
                        $cq->where('slug', $muscleGroup);
                    });
            });
        }

        if ($equipment) {
            $query->where('equipment_required', $equipment);
        }

        $exercises = $query->get();

        // Resolve videos and gym override status
        $results = $exercises->map(function ($exercise) use ($gymId) {
            $resolved = $this->resolverService->resolveExerciseVideo($exercise->id, $gymId);

            $override = GymExerciseVideoOverride::with('video')
                ->where('gym_id', $gymId)
                ->where('exercise_id', $exercise->id)
                ->first();

            $gymCustomVideosCount = ExerciseVideo::where('gym_id', $gymId)
                ->where('exercise_id', $exercise->id)
                ->count();

            return [
                'id' => $exercise->id,
                'name' => $exercise->name,
                'name_mr' => $exercise->name_mr,
                'name_hi' => $exercise->name_hi,
                'code' => $exercise->code,
                'category' => $exercise->category,
                'target_muscle_group' => $exercise->target_muscle_group,
                'exercise_type' => $exercise->exercise_type,
                'equipment_required' => $exercise->equipment_required,
                'difficulty_level' => $exercise->difficulty_level,
                'instructions' => $exercise->instructions,
                'safety_notes' => $exercise->safety_notes,
                'thumbnail_url' => $resolved['thumbnail_url'] ?: $exercise->thumbnail_url,
                'resolved_video' => $resolved,
                'is_overridden' => $override ? $override->is_active : false,
                'has_gym_custom_video' => $gymCustomVideosCount > 0,
                'override_info' => $override ? [
                    'id' => $override->id,
                    'is_active' => $override->is_active,
                    'video_title' => $override->video?->title,
                    'video_provider' => $override->video?->provider,
                ] : null,
            ];
        });

        if ($statusFilter === 'overridden') {
            $results = $results->filter(fn($item) => $item['is_overridden'])->values();
        } elseif ($statusFilter === 'platform_default') {
            $results = $results->filter(fn($item) => !$item['is_overridden'] && $item['resolved_video']['has_playable_video'])->values();
        } elseif ($statusFilter === 'no_video') {
            $results = $results->filter(fn($item) => !$item['resolved_video']['has_playable_video'])->values();
        }

        return response()->json($results);
    }

    /**
     * Categories list for filtering
     */
    public function categories(): JsonResponse
    {
        $categories = ExerciseCategory::where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json($categories);
    }

    /**
     * Single exercise detail
     */
    public function show(int $id): JsonResponse
    {
        $gymId = $this->getGymId();
        $exercise = Exercise::withoutGlobalScopes()->with(['categories', 'defaultVideo'])->findOrFail($id);

        $resolved = $this->resolverService->resolveExerciseVideo($exercise->id, $gymId);

        $override = GymExerciseVideoOverride::with('video')
            ->where('gym_id', $gymId)
            ->where('exercise_id', $exercise->id)
            ->first();

        $gymVideos = ExerciseVideo::where('gym_id', $gymId)
            ->where('exercise_id', $exercise->id)
            ->orderByDesc('id')
            ->get();

        $globalVideo = ExerciseVideo::whereNull('gym_id')
            ->where('exercise_id', $exercise->id)
            ->where('is_active', true)
            ->where('status', 'approved')
            ->first();

        return response()->json([
            'exercise' => $exercise,
            'resolved_video' => $resolved,
            'current_override' => $override,
            'gym_videos' => $gymVideos,
            'platform_global_video' => $globalVideo,
        ]);
    }

    /**
     * Gym Owner or Trainer uploads/links a gym-specific custom tutorial video.
     */
    public function storeCustomVideo(Request $request, int $id): JsonResponse
    {
        $gymId = $this->getGymId();
        $user = auth()->user();

        // Check gym settings for trainer permission
        $gym = Gym::findOrFail($gymId);
        $settings = $gym->video_library_settings ?? [];

        if ($user->role === 'trainer' && !($settings['allow_trainer_uploads'] ?? true)) {
            return response()->json(['error' => 'Trainer video uploads are restricted by the gym administrator.'], 403);
        }

        $exercise = Exercise::withoutGlobalScopes()->findOrFail($id);

        $validated = $request->validate([
            'title' => 'required|string|max:200',
            'description' => 'nullable|string|max:1000',
            'provider' => 'required|in:youtube,custom_upload',
            'video_url' => 'nullable|string|url|max:500',
            'video_file' => 'nullable|file|mimes:mp4,webm|max:102400', // 100MB
            'creator_name' => 'nullable|string|max:150',
            'attribution_text' => 'nullable|string|max:500',
            'duration_seconds' => 'nullable|integer',
            'set_as_active_override' => 'boolean',
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
                return response()->json(['error' => 'Invalid YouTube video URL format.'], 422);
            }
            $embedUrl = $this->resolverService->generateSafeEmbedUrl('youtube', $videoId);
            $thumbnailUrl = "https://img.youtube.com/vi/{$videoId}/hqdefault.jpg";
        } elseif ($validated['provider'] === 'custom_upload') {
            if (!$request->hasFile('video_file')) {
                return response()->json(['error' => 'Video file is required for direct upload'], 422);
            }
            $file = $request->file('video_file');
            $path = $file->store("gym_videos/{$gymId}", 'public');
            $videoUrl = Storage::disk('public')->url($path);
            $embedUrl = $videoUrl;
        }

        $status = ($settings['require_approval'] ?? false) && $user->role === 'trainer' ? 'pending_review' : 'approved';

        $customVideo = ExerciseVideo::create([
            'exercise_id' => $exercise->id,
            'gym_id' => $gymId,
            'created_by_user_id' => $user->id,
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'provider' => $validated['provider'],
            'video_url' => $videoUrl,
            'video_id' => $videoId,
            'embed_url' => $embedUrl,
            'thumbnail_url' => $thumbnailUrl,
            'duration_seconds' => $validated['duration_seconds'] ?? null,
            'aspect_ratio' => '16:9',
            'content_source' => 'gym_custom',
            'rights_status' => 'gym_owned',
            'creator_name' => $validated['creator_name'] ?? $user->name,
            'attribution_text' => $validated['attribution_text'] ?? "Uploaded by {$user->name} for {$gym->name}",
            'status' => $status,
            'is_primary' => true,
            'is_active' => true,
            'health_status' => 'healthy',
            'last_health_check_at' => now(),
        ]);

        $setAsOverride = $validated['set_as_active_override'] ?? true;
        if ($setAsOverride && $status === 'approved') {
            GymExerciseVideoOverride::updateOrCreate(
                [
                    'gym_id' => $gymId,
                    'exercise_id' => $exercise->id,
                ],
                [
                    'exercise_video_id' => $customVideo->id,
                    'created_by_user_id' => $user->id,
                    'is_active' => true,
                    'notes' => "Active override set to custom gym video #{$customVideo->id}",
                ]
            );
        }

        $resolved = $this->resolverService->resolveExerciseVideo($exercise->id, $gymId);

        return response()->json([
            'message' => 'Custom gym video created successfully',
            'video' => $customVideo,
            'resolved_video' => $resolved,
        ], 201);
    }

    /**
     * Toggle Gym Override Active Status
     */
    public function toggleOverride(Request $request, int $id): JsonResponse
    {
        $gymId = $this->getGymId();
        $exercise = Exercise::withoutGlobalScopes()->findOrFail($id);

        $override = GymExerciseVideoOverride::where('gym_id', $gymId)
            ->where('exercise_id', $exercise->id)
            ->first();

        if (!$override) {
            // Check if there is a gym custom video to create override for
            $gymVideo = ExerciseVideo::where('gym_id', $gymId)
                ->where('exercise_id', $exercise->id)
                ->where('status', 'approved')
                ->latest()
                ->first();

            if (!$gymVideo) {
                return response()->json(['error' => 'No custom gym video found for this exercise to activate override.'], 404);
            }

            $override = GymExerciseVideoOverride::create([
                'gym_id' => $gymId,
                'exercise_id' => $exercise->id,
                'exercise_video_id' => $gymVideo->id,
                'created_by_user_id' => auth()->id(),
                'is_active' => true,
            ]);
        } else {
            $override->update([
                'is_active' => !$override->is_active,
            ]);
        }

        $resolved = $this->resolverService->resolveExerciseVideo($exercise->id, $gymId);

        return response()->json([
            'message' => $override->is_active ? 'Gym custom tutorial activated as override' : 'Gym override deactivated. Using platform tutorial.',
            'override' => $override,
            'resolved_video' => $resolved,
        ]);
    }

    /**
     * Restore Platform Default Video (deactivate or delete override)
     */
    public function restoreDefault(int $id): JsonResponse
    {
        $gymId = $this->getGymId();
        $exercise = Exercise::withoutGlobalScopes()->findOrFail($id);

        $override = GymExerciseVideoOverride::where('gym_id', $gymId)
            ->where('exercise_id', $exercise->id)
            ->first();

        if ($override) {
            $override->update(['is_active' => false]);
        } else {
            $video = ExerciseVideo::where('gym_id', $gymId)->where('exercise_id', $exercise->id)->first();
            if ($video) {
                GymExerciseVideoOverride::create([
                    'gym_id' => $gymId,
                    'exercise_id' => $exercise->id,
                    'exercise_video_id' => $video->id,
                    'is_active' => false,
                    'notes' => 'Explicitly deactivated to use platform default tutorial.',
                ]);
            }
        }

        $resolved = $this->resolverService->resolveExerciseVideo($exercise->id, $gymId);

        return response()->json([
            'message' => 'Platform default tutorial restored successfully',
            'resolved_video' => $resolved,
        ]);
    }

    /**
     * Get Gym Video Library Settings
     */
    public function getSettings(): JsonResponse
    {
        $gymId = $this->getGymId();
        $gym = Gym::findOrFail($gymId);

        $defaults = [
            'allow_trainer_uploads' => true,
            'enable_member_library' => true,
            'require_approval' => false,
        ];

        return response()->json(array_merge($defaults, $gym->video_library_settings ?? []));
    }

    /**
     * Update Gym Video Library Settings (Owner/Manager only)
     */
    public function updateSettings(Request $request): JsonResponse
    {
        $gymId = $this->getGymId();
        $user = auth()->user();

        if ($user->role === 'trainer') {
            return response()->json(['error' => 'Only gym owners or administrators can configure video library settings.'], 403);
        }

        $validated = $request->validate([
            'allow_trainer_uploads' => 'boolean',
            'enable_member_library' => 'boolean',
            'require_approval' => 'boolean',
        ]);

        $gym = Gym::findOrFail($gymId);
        $current = $gym->video_library_settings ?? [];
        $gym->video_library_settings = array_merge($current, $validated);
        $gym->save();

        return response()->json([
            'message' => 'Video library settings updated successfully',
            'settings' => $gym->video_library_settings,
        ]);
    }
}
