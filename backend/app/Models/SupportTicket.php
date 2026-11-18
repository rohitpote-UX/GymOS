<?php

namespace App\Models;

use App\Models\Concerns\BelongsToGym;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupportTicket extends Model
{
    use HasFactory, BelongsToGym;

    protected $fillable = [
        'gym_id',
        'branch_id',
        'ticket_number',
        'scope', // gym_member, saas_platform
        'member_id',
        'category', // locker, equipment, billing, trainer, cleanliness, saas_feature, saas_billing, general
        'priority', // low, medium, high, urgent
        'subject',
        'description',
        'status', // open, in_progress, resolved, closed
        'assigned_to_user_id',
        'created_by_user_id',
        'resolution_notes',
        'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'resolved_at' => 'datetime',
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

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to_user_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(SupportTicketMessage::class);
    }
}
