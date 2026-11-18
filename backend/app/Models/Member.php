<?php

namespace App\Models;

use App\Models\Concerns\BelongsToGym;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Member extends Model
{
    use HasFactory, SoftDeletes, BelongsToGym;

    protected $fillable = [
        'gym_id',
        'primary_branch_id',
        'assigned_trainer_id',
        'member_code',
        'first_name',
        'last_name',
        'email',
        'phone',
        'gender',
        'dob',
        'address',
        'emergency_contact_name',
        'emergency_contact_phone',
        'blood_group',
        'status',
        'joined_date',
        'avatar_url',
        'photo_data',
        'notes',
        'total_fees_billed',
        'total_fees_paid',
        'outstanding_balance',
    ];

    protected function casts(): array
    {
        return [
            'dob' => 'date',
            'joined_date' => 'date',
            'total_fees_billed' => 'decimal:2',
            'total_fees_paid' => 'decimal:2',
            'outstanding_balance' => 'decimal:2',
        ];
    }

    public function primaryBranch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'primary_branch_id');
    }

    public function trainer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_trainer_id');
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(MemberMembership::class);
    }

    public function activeMembership(): HasOne
    {
        return $this->hasOne(MemberMembership::class)
            ->where('status', 'active')
            ->where('end_date', '>=', now()->toDateString())
            ->latestOfMany('end_date');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function attendance(): HasMany
    {
        return $this->hasMany(AttendanceLog::class);
    }

    public function ledger(): HasMany
    {
        return $this->hasMany(MemberLedger::class);
    }

    public function ptSessions(): HasMany
    {
        return $this->hasMany(PtSession::class);
    }

    public function posOrders(): HasMany
    {
        return $this->hasMany(PosOrder::class);
    }

    public function getFullNameAttribute(): string
    {
        return trim("{$this->first_name} {$this->last_name}");
    }

    /**
     * Recalculate member total fees billed, paid, and outstanding balance on server.
     */
    public function recalculateBalances(): void
    {
        $totalBilled = (float) $this->memberships()
            ->whereNull('cancelled_at')
            ->sum('final_price');

        $totalPaid = (float) $this->payments()
            ->where('status', 'completed')
            ->where('type', 'payment')
            ->sum('amount');

        $totalRefunds = (float) $this->payments()
            ->where('status', 'completed')
            ->where('type', 'refund')
            ->sum('amount');

        $posBilled = (float) $this->posOrders()
            ->where('status', '!=', 'cancelled')
            ->sum('total_amount');

        $posPaid = (float) $this->posOrders()
            ->where('status', '!=', 'cancelled')
            ->sum('paid_amount');

        $netPaid = ($totalPaid - $totalRefunds) + $posPaid;
        $overallBilled = $totalBilled + $posBilled;
        $outstanding = max(0, $overallBilled - $netPaid);

        $this->update([
            'total_fees_billed' => $overallBilled,
            'total_fees_paid' => $netPaid,
            'outstanding_balance' => $outstanding,
        ]);
    }
}
