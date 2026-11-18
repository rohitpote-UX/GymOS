<?php

namespace App\Models;

use App\Models\Concerns\BelongsToGym;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Lead extends Model
{
    use HasFactory, SoftDeletes, BelongsToGym;

    protected $fillable = [
        'gym_id',
        'branch_id',
        'name',
        'phone',
        'email',
        'gender',
        'source',
        'fitness_goal',
        'interested_plan_id',
        'assigned_user_id',
        'status',
        'followup_date',
        'trial_date',
        'trial_status',
        'lost_reason',
        'converted_member_id',
        'converted_at',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'followup_date' => 'date',
            'trial_date' => 'date',
            'converted_at' => 'datetime',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function interestedPlan(): BelongsTo
    {
        return $this->belongsTo(MembershipPlan::class, 'interested_plan_id');
    }

    public function assignedStaff(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }

    public function convertedMember(): BelongsTo
    {
        return $this->belongsTo(Member::class, 'converted_member_id');
    }

    public function followups(): HasMany
    {
        return $this->hasMany(LeadFollowup::class);
    }
}
