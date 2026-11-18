<?php

namespace App\Models;

use App\Models\Concerns\BelongsToGym;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Supplier extends Model
{
    use HasFactory, SoftDeletes, BelongsToGym;

    protected $fillable = [
        'gym_id',
        'name',
        'company_name',
        'contact_person',
        'phone',
        'email',
        'gstin',
        'address',
        'city',
        'bank_details',
        'total_purchased',
        'total_paid',
        'outstanding_balance',
        'notes',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'total_purchased' => 'decimal:2',
            'total_paid' => 'decimal:2',
            'outstanding_balance' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function ledgers(): HasMany
    {
        return $this->hasMany(SupplierLedger::class);
    }

    public function purchases(): HasMany
    {
        return $this->hasMany(PurchaseInvoice::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(SupplierPayment::class);
    }

    public function recalculateBalances(): void
    {
        $totalPurchases = (float) $this->purchases()
            ->where('status', 'received')
            ->sum('total_amount');

        $totalPaid = (float) $this->payments()
            ->sum('amount');

        $outstanding = max(0, $totalPurchases - $totalPaid);

        $this->update([
            'total_purchased' => $totalPurchases,
            'total_paid' => $totalPaid,
            'outstanding_balance' => $outstanding,
        ]);
    }
}
