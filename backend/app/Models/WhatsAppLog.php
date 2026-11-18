<?php

namespace App\Models;

use App\Models\Concerns\BelongsToGym;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WhatsAppLog extends Model
{
    use HasFactory, BelongsToGym;

    protected $table = 'whatsapp_logs';

    protected $fillable = [
        'gym_id',
        'branch_id',
        'template_id',
        'template_name',
        'recipient_phone',
        'recipient_name',
        'category',
        'message_body',
        'variables_payload',
        'status', // queued, sent, delivered, read, failed
        'provider_message_id',
        'error_message',
        'sent_at',
        'delivered_at',
        'read_at',
    ];

    protected function casts(): array
    {
        return [
            'variables_payload' => 'array',
            'sent_at' => 'datetime',
            'delivered_at' => 'datetime',
            'read_at' => 'datetime',
        ];
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(WhatsAppTemplate::class, 'template_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }
}
