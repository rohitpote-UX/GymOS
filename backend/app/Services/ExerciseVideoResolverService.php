<?php

namespace App\Services;

use App\Models\Exercise;
use App\Models\ExerciseVideo;
use App\Models\GymExerciseVideoOverride;
use App\Models\VideoHealthCheck;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

class ExerciseVideoResolverService
{
    /**
     * Resolve the active video for a given exercise and gym according to the 3-step priority hierarchy.
     */
    public function resolveExerciseVideo(?int $exerciseId, ?int $gymId = null): array
    {
        if (!$exerciseId) {
            return $this->buildFallbackResponse(null);
        }

        $exercise = Exercise::withoutGlobalScopes()->find($exerciseId);
        if (!$exercise) {
            return $this->buildFallbackResponse(null);
        }

        // STEP 1: Check Gym-Specific Custom Video (explicit override or gym-owned primary video)
        if ($gymId) {
            $override = GymExerciseVideoOverride::with('video')
                ->where('gym_id', $gymId)
                ->where('exercise_id', $exerciseId)
                ->first();

            if ($override) {
                if ($override->is_active && $override->video && $override->video->is_active && $override->video->status === 'approved') {
                    return $this->buildVideoResponse($override->video, $exercise, 'gym_custom', 'Gym Video', true);
                }
                // Override exists but is deactivated: this gym explicitly chose to revert to platform default
            } else {
                // Also check if gym has an approved primary video uploaded without an explicit override record
                $gymCustomVideo = ExerciseVideo::where('gym_id', $gymId)
                    ->where('exercise_id', $exerciseId)
                    ->where('is_active', true)
                    ->where('status', 'approved')
                    ->orderByDesc('is_primary')
                    ->orderByDesc('id')
                    ->first();

                if ($gymCustomVideo) {
                    return $this->buildVideoResponse($gymCustomVideo, $exercise, 'gym_custom', 'Gym Video', true);
                }
            }
        }

        // STEP 2: Check Global Platform Video (Super Admin approved, gym_id is null)
        $globalVideo = ExerciseVideo::whereNull('gym_id')
            ->where('exercise_id', $exerciseId)
            ->where('is_active', true)
            ->where('status', 'approved')
            ->orderByDesc('is_primary')
            ->orderByDesc('id')
            ->first();

        if ($globalVideo) {
            return $this->buildVideoResponse($globalVideo, $exercise, 'platform_global', 'Platform Tutorial', false);
        }

        // STEP 3: Fallback - Instructions & Image Only
        return $this->buildFallbackResponse($exercise);
    }

    /**
     * Bulk resolve videos for an array of exercise items (e.g. inside a workout routine or session).
     */
    public function resolveBulkForWorkout(array $exercises, ?int $gymId = null): array
    {
        $resolved = [];
        foreach ($exercises as $item) {
            $exerciseId = $item['exercise_id'] ?? $item['id'] ?? null;
            $videoInfo = $this->resolveExerciseVideo($exerciseId, $gymId);

            $item['video_info'] = $videoInfo;
            // Also merge high-level video properties for instant access
            $item['video_url'] = $videoInfo['has_playable_video'] ? $videoInfo['embed_url'] : ($item['video_url'] ?? null);
            $item['has_playable_video'] = $videoInfo['has_playable_video'];
            $item['video_source'] = $videoInfo['source_indicator'];
            $item['video_source_label'] = $videoInfo['source_label'];
            $item['video_thumbnail'] = $videoInfo['thumbnail_url'];

            $resolved[] = $item;
        }

        return $resolved;
    }

    /**
     * Build standard video response payload.
     */
    protected function buildVideoResponse(ExerciseVideo $video, Exercise $exercise, string $sourceIndicator, string $sourceLabel, bool $isOverride): array
    {
        return [
            'has_playable_video' => true,
            'source_indicator' => $sourceIndicator,
            'source_label' => $sourceLabel,
            'is_override' => $isOverride,
            'video_id' => $video->video_id ?: (string) $video->id,
            'record_id' => $video->id,
            'external_video_id' => $video->video_id,
            'title' => $video->title,
            'provider' => $video->provider,
            'embed_url' => $video->embed_url,
            'video_url' => $video->video_url,
            'thumbnail_url' => $video->thumbnail_url ?: ($exercise->thumbnail_url ?: $exercise->image_url),
            'duration_seconds' => $video->duration_seconds,
            'aspect_ratio' => $video->aspect_ratio ?: '16:9',
            'creator_name' => $video->creator_name,
            'attribution_text' => $video->attribution_text,
            'rights_status' => $video->rights_status,
            'instructions' => $exercise->instructions,
            'safety_notes' => $exercise->safety_notes,
            'common_mistakes' => $exercise->common_mistakes,
        ];
    }

    /**
     * Build fallback response when no playable video exists.
     */
    protected function buildFallbackResponse(?Exercise $exercise): array
    {
        return [
            'has_playable_video' => false,
            'source_indicator' => 'instructions_only',
            'source_label' => 'Instructions Only',
            'is_override' => false,
            'video_id' => null,
            'title' => $exercise?->name ? ($exercise->name . ' (Instructions)') : 'Exercise Instructions',
            'provider' => 'none',
            'embed_url' => null,
            'video_url' => null,
            'thumbnail_url' => $exercise?->thumbnail_url ?: ($exercise?->image_url),
            'duration_seconds' => null,
            'aspect_ratio' => '16:9',
            'creator_name' => null,
            'attribution_text' => null,
            'rights_status' => 'instructions_only',
            'instructions' => $exercise?->instructions ?? 'Perform movement with controlled form, proper breathing, and stable posture.',
            'safety_notes' => $exercise?->safety_notes ?? 'Maintain neutral spine and stop immediately if you experience sharp pain.',
            'common_mistakes' => $exercise?->common_mistakes ?? 'Using excessive momentum or improper range of motion.',
        ];
    }

    /**
     * Safely extract YouTube video ID from various URL formats.
     */
    public function extractYouTubeId(?string $url): ?string
    {
        if (empty($url)) {
            return null;
        }

        $url = trim($url);

        // If already an 11-character alphanumeric YouTube ID
        if (preg_match('/^[a-zA-Z0-9_-]{11}$/', $url)) {
            return $url;
        }

        // youtu.be/<id>
        if (preg_match('/youtu\.be\/([a-zA-Z0-9_-]{8,32})/', $url, $matches)) {
            return $matches[1];
        }

        // youtube.com/watch?v=<id>
        if (preg_match('/[?&]v=([a-zA-Z0-9_-]{8,32})/', $url, $matches)) {
            return $matches[1];
        }

        // youtube.com/embed/<id>
        if (preg_match('/youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{8,32})/', $url, $matches)) {
            return $matches[1];
        }

        // youtube.com/shorts/<id>
        if (preg_match('/youtube\.com\/shorts\/([a-zA-Z0-9_-]{8,32})/', $url, $matches)) {
            return $matches[1];
        }

        // General fallback regex
        if (preg_match('/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{8,32})/i', $url, $matches)) {
            return $matches[1];
        }

        return null;
    }

    /**
     * Generate privacy-enhanced safe embed URL.
     */
    public function generateSafeEmbedUrl(string $provider, ?string $videoId, string $originalUrl = ''): string
    {
        if ($provider === 'youtube' && $videoId) {
            return "https://www.youtube-nocookie.com/embed/{$videoId}?rel=0&modestbranding=1&enablejsapi=1";
        }

        if ($provider === 'vimeo' && $videoId) {
            return "https://player.vimeo.com/video/{$videoId}?dnt=1&title=0&byline=0";
        }

        return $originalUrl;
    }

    /**
     * Retrieve YouTube metadata via official oEmbed service without scraping or downloading.
     */
    public function fetchYouTubeMetadata(string $videoId): array
    {
        $oembedUrl = "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={$videoId}&format=json";

        try {
            $response = Http::timeout(4)->get($oembedUrl);
            if ($response->successful()) {
                $data = $response->json();
                return [
                    'success' => true,
                    'title' => $data['title'] ?? null,
                    'creator_name' => $data['author_name'] ?? null,
                    'thumbnail_url' => $data['thumbnail_url'] ?? "https://img.youtube.com/vi/{$videoId}/hqdefault.jpg",
                    'author_url' => $data['author_url'] ?? null,
                ];
            }
        } catch (\Throwable $e) {
            // Network fallback
        }

        return [
            'success' => false,
            'title' => null,
            'creator_name' => null,
            'thumbnail_url' => "https://img.youtube.com/vi/{$videoId}/hqdefault.jpg",
            'author_url' => null,
        ];
    }

    /**
     * Perform an automated video availability health check without streaming media.
     */
    public function checkVideoHealth(ExerciseVideo $video, ?int $userId = null): VideoHealthCheck
    {
        $statusCode = 200;
        $isPlayable = true;
        $errorMessage = null;
        $payload = [];

        if ($video->provider === 'youtube') {
            $videoId = $video->video_id ?: $this->extractYouTubeId($video->video_url);
            if (!$videoId) {
                $statusCode = 400;
                $isPlayable = false;
                $errorMessage = 'Invalid YouTube video ID format';
            } else {
                try {
                    $res = Http::timeout(5)->get("https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={$videoId}&format=json");
                    $statusCode = $res->status();
                    if ($res->successful()) {
                        $isPlayable = true;
                        $payload = $res->json();
                    } else {
                        $isPlayable = false;
                        $errorMessage = $res->status() === 404
                            ? 'Video not found or removed on YouTube'
                            : 'YouTube embedding is restricted or video is private';
                    }
                } catch (\Throwable $e) {
                    $statusCode = 503;
                    $isPlayable = true; // Temporary network timeout should not mark permanently broken
                    $errorMessage = 'Network timeout verifying YouTube availability: ' . $e->getMessage();
                }
            }
        } elseif ($video->provider === 'direct_upload') {
            $path = str_replace('/storage/', '', $video->video_url);
            if (Storage::disk('public')->exists($path)) {
                $isPlayable = true;
                $statusCode = 200;
            } else {
                $isPlayable = false;
                $statusCode = 404;
                $errorMessage = 'Uploaded video file is missing from storage';
            }
        }

        $healthStatus = $isPlayable ? 'healthy' : 'playback_error';

        $video->update([
            'last_health_check_at' => now(),
            'health_status' => $healthStatus,
            'health_error_message' => $errorMessage,
        ]);

        return VideoHealthCheck::create([
            'exercise_video_id' => $video->id,
            'status_code' => $statusCode,
            'is_playable' => $isPlayable,
            'response_payload' => $payload,
            'error_message' => $errorMessage,
            'checked_by_user_id' => $userId,
            'checked_at' => now(),
        ]);
    }
}
