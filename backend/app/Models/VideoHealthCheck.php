<?php

namespace App\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VideoHealthCheck extends Model
{
    use HasFactory;

    protected $fillable = [
        'exercise_video_id',
        'status_code',
        'is_playable',
        'response_payload',
        'error_message',
        'checked_by_user_id',
        'checked_at',
    ];

    protected function casts(): array
    {
        return [
            'status_code' => 'integer',
            'is_playable' => 'boolean',
            'response_payload' => 'array',
            'checked_at' => 'datetime',
        ];
    }

    public function video(): BelongsTo
    {
        return $this->belongsTo(ExerciseVideo::class, 'exercise_video_id');
    }

    public function checkedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'checked_by_user_id');
    }
}
