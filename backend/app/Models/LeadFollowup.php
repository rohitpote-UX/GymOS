<?php

namespace App\Models;

use App\Models\Concerns\BelongsToGym;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeadFollowup extends Model
{
    use HasFactory, BelongsToGym;

    protected $fillable = [
        'gym_id',
        'lead_id',
        'user_id',
        'followup_date',
        'type',
        'summary',
        'next_followup_date',
    ];

    protected function casts(): array
    {
        return [
            'followup_date' => 'date',
            'next_followup_date' => 'date',
        ];
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
