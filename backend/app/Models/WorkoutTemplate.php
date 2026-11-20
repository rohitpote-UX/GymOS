<?php

namespace App\Models;

use App\Models\Gym;
use App\Models\User;
use App\Support\CurrentGym;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkoutTemplate extends Model
{
    use HasFactory;

    protected $fillable = [
        'gym_id',
        'created_by_user_id',
        'title',
        'goal',
        'difficulty',
        'days_per_week',
        'split_type',
        'description',
        'schedule',
        'is_system',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'days_per_week' => 'integer',
            'schedule' => 'array',
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

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }
}
