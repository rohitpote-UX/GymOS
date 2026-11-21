<?php

namespace App\Models;

use App\Models\Gym;
use App\Support\CurrentGym;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Exercise extends Model
{
    use HasFactory;

    protected $fillable = [
        'gym_id',
        'code',
        'name',
        'name_mr',
        'name_hi',
        'category',
        'target_muscle_group',
        'secondary_muscles',
        'exercise_type',
        'equipment_required',
        'equipment_types',
        'difficulty_level',
        'instructions',
        'common_mistakes',
        'safety_notes',
        'default_sets',
        'default_reps',
        'default_rest_seconds',
        'default_video_id',
        'image_url',
        'thumbnail_url',
        'video_url',
        'is_system',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'default_sets' => 'integer',
            'default_rest_seconds' => 'integer',
            'secondary_muscles' => 'array',
            'equipment_types' => 'array',
            'is_system' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::addGlobalScope('gym_or_system', function (Builder $query) {
            $gymId = CurrentGym::id();
            if ($gymId) {
                $query->where(function ($q) use ($gymId, $query) {
                    $q->whereNull($query->qualifyColumn('gym_id'))
                      ->orWhere($query->qualifyColumn('gym_id'), $gymId);
                });
            }
        });

        static::creating(function ($model) {
            if (!$model->is_system && empty($model->gym_id) && CurrentGym::id()) {
                $model->gym_id = CurrentGym::require();
            }
        });
    }

    public function gym(): BelongsTo
    {
        return $this->belongsTo(Gym::class);
    }

    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(ExerciseCategory::class, 'exercise_category_mappings', 'exercise_id', 'category_id');
    }

    public function videos(): HasMany
    {
        return $this->hasMany(ExerciseVideo::class);
    }

    public function globalVideos(): HasMany
    {
        return $this->hasMany(ExerciseVideo::class)->whereNull('gym_id');
    }

    public function gymVideos(): HasMany
    {
        return $this->hasMany(ExerciseVideo::class)->whereNotNull('gym_id');
    }

    public function defaultVideo(): BelongsTo
    {
        return $this->belongsTo(ExerciseVideo::class, 'default_video_id');
    }

    public function overrides(): HasMany
    {
        return $this->hasMany(GymExerciseVideoOverride::class);
    }
}
