<?php

namespace App\Support;

use App\Models\Gym;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * The Gym tenant the current execution context is scoped to.
 *
 * Fail-Closed: If gym context is missing, tenant queries return 0 rows
 * (via BelongsToGym trait) and require() throws immediately.
 */
class CurrentGym
{
    private static bool $overridden = false;
    private static ?int $override = null;
    private static ?Gym $cached = null;

    public static function id(): ?int
    {
        if (self::$overridden) {
            return self::$override;
        }

        $user = Auth::guard('sanctum')->user() ?? Auth::user();

        return $user?->gym_id ? (int) $user->gym_id : null;
    }

    public static function require(): int
    {
        return self::id() ?? throw new RuntimeException('No gym tenant context.');
    }

    public static function clear(): void
    {
        self::$overridden = false;
        self::$override = null;
        self::$cached = null;
    }

    public static function get(): ?Gym
    {
        $id = self::id();
        if (!$id) {
            return null;
        }

        if (self::$cached?->id !== $id) {
            self::$cached = Gym::find($id);
        }

        return self::$cached;
    }

    public static function table(string $table): Builder
    {
        $alias = preg_match('/\s+as\s+(\w+)$/i', $table, $m) ? $m[1] : $table;

        return DB::table($table)->where("{$alias}.gym_id", self::require());
    }

    public static function run(int|Gym $gym, callable $fn): mixed
    {
        [$wasOverridden, $previous] = [self::$overridden, self::$override];
        self::$overridden = true;
        self::$override = $gym instanceof Gym ? $gym->id : $gym;

        try {
            return $fn();
        } finally {
            self::$overridden = $wasOverridden;
            self::$override = $previous;
            self::$cached = null;
        }
    }
}
