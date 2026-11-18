<?php

namespace App\Models;

use App\Models\Concerns\BelongsToGym;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MemberWorkoutPlan extends Model
{
    use HasFactory, BelongsToGym;

    protected $fillable = [
        'gym_id',
        'member_id',
        'trainer_id',
        'title',
        'goal', // fat_loss, muscle_hypertrophy, strength_conditioning, general_fitness, rehab
        'difficulty', // beginner, intermediate, advanced
        'days_per_week',
        'exercises',
        'notes',
        'start_date',
        'end_date',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'exercises' => 'array',
            'days_per_week' => 'integer',
            'start_date' => 'date',
            'end_date' => 'date',
            'is_active' => 'boolean',
        ];
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class);
    }

    public function trainer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'trainer_id');
    }
}
