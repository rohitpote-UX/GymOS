<?php

namespace App\Models;

use App\Models\Concerns\BelongsToGym;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MemberProgressLog extends Model
{
    use HasFactory, BelongsToGym;

    protected $fillable = [
        'gym_id',
        'member_id',
        'logged_by_user_id',
        'log_date',
        'weight_kg',
        'body_fat_percent',
        'chest_cm',
        'waist_cm',
        'arms_cm',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'log_date' => 'date',
            'weight_kg' => 'decimal:2',
            'body_fat_percent' => 'decimal:1',
            'chest_cm' => 'decimal:1',
            'waist_cm' => 'decimal:1',
            'arms_cm' => 'decimal:1',
        ];
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class);
    }

    public function logger(): BelongsTo
    {
        return $this->belongsTo(User::class, 'logged_by_user_id');
    }
}
