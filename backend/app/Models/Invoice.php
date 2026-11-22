<?php

namespace App\Models;

use App\Models\Concerns\BelongsToGym;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Invoice extends Model
{
    use HasFactory, BelongsToGym, SoftDeletes;

    protected $fillable = [
        'gym_id',
        'branch_id',
        'member_id',
        'member_membership_id',
        'pos_order_id',
        'invoice_number',
        'invoice_date',
        'due_date',
        'subtotal',
        'discount_type',
        'discount_value',
        'discount_amount',
        'discount_reason',
        'discount_approved_by_user_id',
        'tax_rate',
        'tax_amount',
        'total_amount',
        'paid_amount',
        'balance_due',
        'status',
        'notes',
        'razorpay_order_id',
        'created_by_user_id',
    ];

    protected function casts(): array
    {
        return [
            'invoice_date' => 'date',
            'due_date' => 'date',
            'subtotal' => 'decimal:2',
            'discount_value' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'tax_rate' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'balance_due' => 'decimal:2',
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

    public function membership(): BelongsTo
    {
        return $this->belongsTo(MemberMembership::class, 'member_membership_id');
    }

    public function posOrder(): BelongsTo
    {
        return $this->belongsTo(PosOrder::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function discountApprover(): BelongsTo
    {
        return $this->belongsTo(User::class, 'discount_approved_by_user_id');
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(PaymentAllocation::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function reminders(): HasMany
    {
        return $this->hasMany(PaymentReminder::class);
    }

    // Scopes
    public function scopePending(Builder $query): Builder
    {
        return $query->whereIn('status', ['unpaid', 'partially_paid', 'overdue']);
    }

    public function scopeOverdue(Builder $query): Builder
    {
        return $query->where('status', 'overdue')
            ->orWhere(function ($q) {
                $q->where('balance_due', '>', 0)
                    ->whereDate('due_date', '<', now()->toDateString())
                    ->where('status', '!=', 'cancelled');
            });
    }

    public function scopePaid(Builder $query): Builder
    {
        return $query->where('status', 'paid');
    }

    /**
     * Compute authoritative status dynamically.
     */
    public function calculateDynamicStatus(): string
    {
        if ($this->status === 'cancelled') {
            return 'cancelled';
        }

        $balance = (float) $this->balance_due;
        $paid = (float) $this->paid_amount;

        if ($balance <= 0.001) {
            return 'paid';
        }

        $dueDate = $this->due_date ? Carbon::parse($this->due_date)->startOfDay() : null;
        if ($dueDate && $dueDate->isPast() && !$dueDate->isToday()) {
            return 'overdue';
        }

        if ($paid > 0) {
            return 'partially_paid';
        }

        return 'unpaid';
    }

    /**
     * Synchronize paid amount, balance due, and status from authoritative allocations.
     */
    public function syncFromAllocations(): void
    {
        $allocatedSum = (float) $this->allocations()->sum('amount');
        $total = (float) $this->total_amount;
        $this->paid_amount = $allocatedSum;
        $this->balance_due = max(0, $total - $allocatedSum);
        $this->status = $this->calculateDynamicStatus();
        $this->save();
    }
}
