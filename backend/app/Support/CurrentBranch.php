<?php

namespace App\Support;

use App\Models\Branch;
use App\Models\User;
use Illuminate\Support\Facades\Auth;

class CurrentBranch
{
    private static ?int $overrideId = null;
    private static ?Branch $cached = null;

    public static function set(?int $branchId): void
    {
        self::$overrideId = $branchId;
        self::$cached = null;
    }

    public static function id(): ?int
    {
        if (self::$overrideId !== null) {
            return self::$overrideId;
        }

        /** @var User|null $user */
        $user = Auth::guard('sanctum')->user() ?? Auth::user();
        if (!$user) {
            return null;
        }

        return $user->primary_branch_id ? (int) $user->primary_branch_id : null;
    }

    public static function require(): int
    {
        $id = self::id();
        if (!$id) {
            $branch = Branch::where('is_primary', true)->first() ?? Branch::first();
            if ($branch) {
                return $branch->id;
            }
            abort(403, 'A branch context is required to complete this action.');
        }

        return $id;
    }

    public static function get(): ?Branch
    {
        $id = self::id();
        if (!$id) {
            return null;
        }

        if (self::$cached?->id !== $id) {
            self::$cached = Branch::find($id);
        }

        return self::$cached;
    }
}
