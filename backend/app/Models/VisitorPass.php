<?php

namespace App\Models;

use App\Models\Concerns\BelongsToGym;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class VisitorPass extends Model
{
    use HasFactory, BelongsToGym;

    protected $fillable = [
        'gym_id',
        'branch_id',
        'pass_code',
        'full_name',
        'phone',
        'email',
        'gender',
        'emergency_contact',
        'base_amount',
        'gst_rate',
        'gst_amount',
        'total_amount',
        'currency',
        'payment_method',
        'payment_status',
        'razorpay_order_id',
        'razorpay_payment_id',
        'razorpay_signature',
        'valid_on',
        'check_in_at',
        'expires_at',
        'attendance_log_id',
        'created_by_user_id',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'base_amount' => 'decimal:2',
            'gst_rate' => 'decimal:2',
            'gst_amount' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'valid_on' => 'date',
            'check_in_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function attendanceLog(): BelongsTo
    {
        return $this->belongsTo(AttendanceLog::class, 'attendance_log_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public static function generatePassCode(int $branchId): string
    {
        $date = now()->format('Ymd');
        $random = strtoupper(Str::random(5));
        return "VP-{$date}-B{$branchId}-{$random}";
    }

    public function isPaid(): bool
    {
        return $this->payment_status === 'paid';
    }

    public function isValidToday(): bool
    {
        return $this->valid_on->isToday();
    }
}
