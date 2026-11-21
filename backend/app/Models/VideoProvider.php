<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class VideoProvider extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'code',
        'is_enabled',
        'supports_embed',
        'supports_upload',
        'commercial_terms_notes',
        'config',
    ];

    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
            'supports_embed' => 'boolean',
            'supports_upload' => 'boolean',
            'config' => 'array',
        ];
    }
}
