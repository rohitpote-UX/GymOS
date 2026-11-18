<?php

namespace App\Models;

use App\Models\Concerns\BelongsToGym;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActionItem extends Model
{
    use HasFactory, BelongsToGym;

    protected $fillable = [
        'gym_id',
        'branch_id',
        'type', // expiring_membership, overdue_payment, inactive_member, low_stock, expiring_product, uncontacted_lead, pending_pt_session, unresolved_ticket
        'severity', // critical, warning, info
        'title',
        'description',
        'reference_type',
        'reference_id',
        'metadata',
        'assigned_to_user_id',
        'status', // pending, in_progress, resolved, dismissed
        'due_date',
        'resolved_at',
        'resolved_by_user_id',
        'resolution_notes',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'due_date' => 'date',
            'resolved_at' => 'datetime',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to_user_id');
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by_user_id');
    }
}
