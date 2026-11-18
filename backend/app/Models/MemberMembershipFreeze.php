<?php

namespace App\Models;

use App\Models\Concerns\BelongsToGym;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MemberMembershipFreeze extends Model
{
    use HasFactory, BelongsToGym;

    protected $fillable = [
        'gym_id',
        'member_membership_id',
        'freeze_date',
        'unfreeze_date',
        'days',
        'reason',
        'processed_by_user_id',
    ];

    protected function casts(): array
    {
        return [
            'freeze_date' => 'date',
            'unfreeze_date' => 'date',
            'days' => 'integer',
        ];
    }

    public function membership(): BelongsTo
    {
        return $this->belongsTo(MemberMembership::class, 'member_membership_id');
    }

    public function processor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by_user_id');
    }
}
