<?php

namespace App\Models;

use App\Models\Concerns\BelongsToGym;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MemberWorkoutSession extends Model
{
    use HasFactory, BelongsToGym;

    protected $fillable = [
        'gym_id',
        'branch_id',
        'member_id',
        'workout_plan_id',
        'session_date',
        'day_name',
        'status',
        'duration_minutes',
        'set_logs',
        'notes',
        'rating',
        'completed_at',
    ];

    public function setSessionDateAttribute($value)
    {
        $this->attributes['session_date'] = $value instanceof \DateTimeInterface
            ? $value->format('Y-m-d')
            : substr((string) $value, 0, 10);
    }

    protected function casts(): array
    {
        return [
            'session_date' => 'string',
            'duration_minutes' => 'integer',
            'set_logs' => 'array',
            'rating' => 'integer',
            'completed_at' => 'datetime',
        ];
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class);
    }

    public function workoutPlan(): BelongsTo
    {
        return $this->belongsTo(MemberWorkoutPlan::class, 'workout_plan_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }
}
