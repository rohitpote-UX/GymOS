<?php

namespace App\Models;

use App\Models\Concerns\BelongsToGym;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MemberFitnessGoal extends Model
{
    use HasFactory, BelongsToGym;

    protected $fillable = [
        'gym_id',
        'member_id',
        'created_by_user_id',
        'title',
        'category',
        'start_value',
        'target_value',
        'current_value',
        'unit',
        'start_date',
        'target_date',
        'status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'start_value' => 'decimal:2',
            'target_value' => 'decimal:2',
            'current_value' => 'decimal:2',
            'start_date' => 'date',
            'target_date' => 'date',
        ];
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    /**
     * Calculate progress percentage towards goal.
     */
    public function getProgressPercentAttribute(): int
    {
        if ($this->start_value === null || $this->target_value === null || $this->current_value === null) {
            return 0;
        }

        $totalDiff = abs($this->target_value - $this->start_value);
        if ($totalDiff == 0) {
            return 100;
        }

        $achievedDiff = abs($this->current_value - $this->start_value);
        $percent = ($achievedDiff / $totalDiff) * 100;

        return (int) min(100, max(0, round($percent)));
    }
}
