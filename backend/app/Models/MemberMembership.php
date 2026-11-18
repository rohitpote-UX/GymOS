<?php

namespace App\Models;

use App\Models\Concerns\BelongsToGym;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MemberMembership extends Model
{
    use HasFactory, BelongsToGym;

    protected $fillable = [
        'gym_id',
        'branch_id',
        'member_id',
        'membership_plan_id',
        'assigned_trainer_id',
        'start_date',
        'end_date',
        'status',
        'category',
        'total_price',
        'discount_amount',
        'final_price',
        'price_paid',
        'balance_due',
        'total_pt_sessions',
        'completed_pt_sessions',
        'freeze_start_date',
        'freeze_end_date',
        'freeze_days_used',
        'freeze_reason',
        'extended_days',
        'extension_reason',
        'cancelled_at',
        'cancellation_reason',
        'refund_amount',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'freeze_start_date' => 'date',
            'freeze_end_date' => 'date',
            'total_price' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'final_price' => 'decimal:2',
            'price_paid' => 'decimal:2',
            'balance_due' => 'decimal:2',
            'refund_amount' => 'decimal:2',
            'total_pt_sessions' => 'integer',
            'completed_pt_sessions' => 'integer',
            'freeze_days_used' => 'integer',
            'extended_days' => 'integer',
            'cancelled_at' => 'datetime',
        ];
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(MembershipPlan::class, 'membership_plan_id');
    }

    public function trainer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_trainer_id');
    }

    public function freezes(): HasMany
    {
        return $this->hasMany(MemberMembershipFreeze::class);
    }

    public function ptSessions(): HasMany
    {
        return $this->hasMany(PtSession::class);
    }
}
