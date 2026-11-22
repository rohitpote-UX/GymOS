<?php

namespace App\Models;

use App\Models\Concerns\BelongsToGym;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Payment extends Model
{
    use HasFactory, BelongsToGym;

    protected $fillable = [
        'gym_id',
        'branch_id',
        'member_id',
        'member_membership_id',
        'invoice_id',
        'receipt_number',
        'type',
        'refund_payment_id',
        'client_uuid',
        'amount',
        'discount_amount',
        'balance_after_payment',
        'payment_method',
        'payment_date',
        'reference_id',
        'status',
        'notes',
        'collected_by_user_id',
    ];

    protected function casts(): array
    {
        return [
            'payment_date' => 'date',
            'amount' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'balance_after_payment' => 'decimal:2',
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

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(PaymentAllocation::class);
    }

    public function collector(): BelongsTo
    {
        return $this->belongsTo(User::class, 'collected_by_user_id');
    }

    public function originalPayment(): BelongsTo
    {
        return $this->belongsTo(Payment::class, 'refund_payment_id');
    }

    public function refunds(): HasMany
    {
        return $this->hasMany(Payment::class, 'refund_payment_id');
    }
}
