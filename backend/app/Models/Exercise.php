<?php

namespace App\Models;

use App\Models\Gym;
use App\Support\CurrentGym;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Exercise extends Model
{
    use HasFactory;

    protected $fillable = [
        'gym_id',
        'name',
        'name_mr',
        'name_hi',
        'category',
        'target_muscle_group',
        'equipment_required',
        'difficulty_level',
        'instructions',
        'common_mistakes',
        'safety_notes',
        'default_sets',
        'default_reps',
        'default_rest_seconds',
        'image_url',
        'video_url',
        'is_system',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'default_sets' => 'integer',
            'default_rest_seconds' => 'integer',
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
            } else {
                $query->whereNull($query->qualifyColumn('gym_id'));
            }
        });

        static::creating(function ($model) {
            if (!$model->is_system && empty($model->gym_id)) {
                $model->gym_id = CurrentGym::require();
            }
        });
    }

    public function gym(): BelongsTo
    {
        return $this->belongsTo(Gym::class);
    }
}
