<?php

namespace App\Models;

use App\Models\Concerns\BelongsToGym;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MemberWorkoutPlan extends Model
{
    use HasFactory, BelongsToGym;

    protected $fillable = [
        'gym_id',
        'branch_id',
        'member_id',
        'trainer_id',
        'title',
        'goal', // fat_loss, muscle_hypertrophy, strength_conditioning, general_fitness, rehab, home_workout
        'difficulty', // beginner, intermediate, advanced
        'status', // draft, active, paused, completed, archived
        'version',
        'parent_plan_id',
        'days_per_week',
        'exercises',
        'schedule',
        'notes',
        'start_date',
        'end_date',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'exercises' => 'array',
            'schedule' => 'array',
            'days_per_week' => 'integer',
            'version' => 'integer',
            'start_date' => 'date',
            'end_date' => 'date',
            'is_active' => 'boolean',
        ];
    }

    protected static function booted()
    {
        static::creating(function ($plan) {
            if (empty($plan->exercises) && !empty($plan->schedule)) {
                $plan->exercises = $plan->schedule;
            }
            if (empty($plan->schedule) && !empty($plan->exercises)) {
                $plan->schedule = $plan->exercises;
            }
            if (empty($plan->start_date)) {
                $plan->start_date = now()->toDateString();
            }
            if (empty($plan->version)) {
                $plan->version = 1;
            }
        });
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class);
    }

    public function trainer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'trainer_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function parentPlan(): BelongsTo
    {
        return $this->belongsTo(MemberWorkoutPlan::class, 'parent_plan_id');
    }

    public function revisions(): HasMany
    {
        return $this->hasMany(MemberWorkoutPlan::class, 'parent_plan_id');
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(MemberWorkoutSession::class, 'workout_plan_id');
    }
}
