<?php

namespace App\Models;

use App\Models\Concerns\BelongsToGym;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DailyCashClosing extends Model
{
    use HasFactory, BelongsToGym;

    protected $fillable = [
        'gym_id',
        'branch_id',
        'closing_date',
        'opened_by_user_id',
        'closed_by_user_id',
        'opening_cash',
        'cash_collected',
        'cash_expenses',
        'expected_cash_in_hand',
        'actual_cash_in_hand',
        'cash_discrepancy',
        'total_upi_collected',
        'total_card_collected',
        'total_bank_transfer_collected',
        'status',
        'notes',
        'closed_at',
    ];

    protected function casts(): array
    {
        return [
            'closing_date' => 'date',
            'opening_cash' => 'decimal:2',
            'cash_collected' => 'decimal:2',
            'cash_expenses' => 'decimal:2',
            'expected_cash_in_hand' => 'decimal:2',
            'actual_cash_in_hand' => 'decimal:2',
            'cash_discrepancy' => 'decimal:2',
            'total_upi_collected' => 'decimal:2',
            'total_card_collected' => 'decimal:2',
            'total_bank_transfer_collected' => 'decimal:2',
            'closed_at' => 'datetime',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function openedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'opened_by_user_id');
    }

    public function closedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by_user_id');
    }
}
