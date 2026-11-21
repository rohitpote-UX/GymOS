<?php

namespace App\Models;

use App\Models\Gym;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ExerciseVideo extends Model
{
    use HasFactory;

    protected $fillable = [
        'exercise_id',
        'gym_id',
        'created_by_user_id',
        'title',
        'description',
        'provider',
        'video_url',
        'video_id',
        'embed_url',
        'thumbnail_url',
        'duration_seconds',
        'aspect_ratio',
        'content_source',
        'rights_status',
        'creator_name',
        'attribution_text',
        'status',
        'is_primary',
        'language',
        'is_active',
        'last_health_check_at',
        'health_status',
        'health_error_message',
    ];

    protected function casts(): array
    {
        return [
            'duration_seconds' => 'integer',
            'is_primary' => 'boolean',
            'is_active' => 'boolean',
            'last_health_check_at' => 'datetime',
        ];
    }

    protected $appends = ['is_global'];

    public function getIsGlobalAttribute(): bool
    {
        return is_null($this->gym_id);
    }

    public function exercise(): BelongsTo
    {
        return $this->belongsTo(Exercise::class);
    }

    public function gym(): BelongsTo
    {
        return $this->belongsTo(Gym::class);
    }

    public function createdByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function healthChecks(): HasMany
    {
        return $this->hasMany(VideoHealthCheck::class);
    }

    public function isGlobal(): bool
    {
        return $this->gym_id === null;
    }

    public function isGymCustom(): bool
    {
        return $this->gym_id !== null;
    }

    public function scopeApproved($query)
    {
        return $query->where('status', 'approved')->where('is_active', true);
    }

    public function scopeGlobalPlatform($query)
    {
        return $query->whereNull('gym_id');
    }

    public function scopeForGym($query, int $gymId)
    {
        return $query->where('gym_id', $gymId);
    }
}
