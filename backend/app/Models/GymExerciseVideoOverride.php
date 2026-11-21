<?php

namespace App\Models;

use App\Models\Gym;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GymExerciseVideoOverride extends Model
{
    use HasFactory;

    protected $fillable = [
        'gym_id',
        'exercise_id',
        'exercise_video_id',
        'is_active',
        'created_by_user_id',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function gym(): BelongsTo
    {
        return $this->belongsTo(Gym::class);
    }

    public function exercise(): BelongsTo
    {
        return $this->belongsTo(Exercise::class);
    }

    public function video(): BelongsTo
    {
        return $this->belongsTo(ExerciseVideo::class, 'exercise_video_id');
    }

    public function createdByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }
}
