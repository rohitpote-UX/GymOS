<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Middleware\EnsureGymAccess;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Gym;
use App\Models\SaasPlan;
use App\Models\User;
use App\Support\CurrentGym;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Public Registration for new Gyms.
     * Creates Gym, Primary Branch, Owner Account, and issues Sanctum Token.
     */
    public function registerGym(Request $request)
    {
        $validated = $request->validate([
            'gym_name' => ['required', 'string', 'max:120'],
            'owner_name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:150', 'unique:users,email'],
            'phone' => ['required', 'string', 'max:20'],
            'password' => ['required', 'confirmed', Password::min(6)],
            'branch_name' => ['nullable', 'string', 'max:100'],
            'city' => ['nullable', 'string', 'max:80'],
            'plan_code' => ['nullable', 'string', 'exists:saas_plans,code'],
        ]);

        return DB::transaction(function () use ($validated, $request) {
            $plan = null;
            if (!empty($validated['plan_code'])) {
                $plan = SaasPlan::where('code', $validated['plan_code'])->first();
            }
            if (!$plan) {
                $plan = SaasPlan::where('is_active', true)->orderBy('sort_order')->first();
            }

            // Generate clean slug
            $baseSlug = Str::slug($validated['gym_name']);
            $slug = $baseSlug;
            $counter = 1;
            while (Gym::where('slug', $slug)->exists()) {
                $slug = "{$baseSlug}-{$counter}";
                $counter++;
            }

            // Create Gym Tenant (14-day free trial)
            $gym = Gym::create([
                'name' => $validated['gym_name'],
                'legal_name' => $validated['gym_name'],
                'slug' => $slug,
                'email' => $validated['email'],
                'phone' => $validated['phone'],
                'currency' => 'INR',
                'status' => Gym::STATUS_TRIAL,
                'trial_ends_at' => now()->addDays(14),
                'saas_plan_id' => $plan?->id,
                'subscription_expires_at' => now()->addDays(14),
                'billing_cycle' => 'monthly',
                'settings' => [
                    'invoice_prefix' => 'INV-',
                    'tax_rate' => 18,
                    'tax_name' => 'GST',
                    'whatsapp_notifications' => true,
                ],
                'branding' => [
                    'primary_color' => '#0f172a', // Slate obsidian
                    'accent_color' => '#10b981',  // Emerald
                    'tagline' => 'Transform Your Strength',
                ],
            ]);

            // Create Primary Branch
            $branch = Branch::withoutGlobalScope('gym')->create([
                'gym_id' => $gym->id,
                'name' => $validated['branch_name'] ?: 'Main Branch',
                'code' => 'MAIN',
                'phone' => $validated['phone'],
                'email' => $validated['email'],
                'city' => $validated['city'] ?: 'Mumbai',
                'is_active' => true,
                'is_primary' => true,
            ]);

            // Create Owner User
            $owner = User::create([
                'gym_id' => $gym->id,
                'primary_branch_id' => $branch->id,
                'name' => $validated['owner_name'],
                'email' => strtolower(trim($validated['email'])),
                'phone' => preg_replace('/\D/', '', $validated['phone']),
                'password' => $validated['password'],
                'role' => User::ROLE_GYM_OWNER,
                'is_active' => true,
            ]);

            // Link owner to primary branch in pivot
            $branch->staff()->attach($owner->id, ['gym_id' => $gym->id]);

            // Audit Log
            AuditLog::withoutGlobalScope('gym')->create([
                'gym_id' => $gym->id,
                'branch_id' => $branch->id,
                'user_id' => $owner->id,
                'event' => 'gym.registered',
                'ip_address' => $request->ip(),
                'user_agent' => substr((string) $request->userAgent(), 0, 255),
                'payload' => [
                    'gym_name' => $gym->name,
                    'owner_email' => $owner->email,
                    'slug' => $gym->slug,
                ],
            ]);

            $token = $owner->createToken('gym-pwa', ['*'], now()->addDays(90))->plainTextToken;

            return response()->json([
                'message' => __('messages.gym_registered'),
                'token' => $token,
                'user' => self::presentUser($owner),
            ], 201);
        });
    }

    /**
     * Authenticate Gym Owner, Staff, or Super Admin.
     */
    public function login(Request $request)
    {
        $request->validate([
            'login' => ['required', 'string'],
            'password' => ['required', 'string'],
            'remember' => ['nullable', 'boolean'],
        ]);

        $login = trim($request->input('login'));
        $phoneDigits = preg_replace('/\D/', '', $login);

        /** @var User|null $user */
        $user = User::where('email', strtolower($login))
            ->when(strlen($phoneDigits) >= 10, fn ($q) => $q->orWhere('phone', substr($phoneDigits, -10)))
            ->first();

        if (!$user || !Hash::check($request->input('password'), $user->password)) {
            throw ValidationException::withMessages([
                'login' => [__('messages.auth_invalid_credentials')],
            ]);
        }

        // Check gym block reasons (allow expired gyms so owners can renew)
        $blockReason = $user->isSuperAdmin() ? null : EnsureGymAccess::blockReason($user);
        if ($blockReason && $blockReason !== 'gym_expired') {
            throw ValidationException::withMessages([
                'login' => [EnsureGymAccess::message($blockReason)],
            ]);
        }

        if ($user->isSuperAdmin() && !$user->is_active) {
            throw ValidationException::withMessages([
                'login' => ['Super-administrator account is disabled.'],
            ]);
        }

        $expires = $request->boolean('remember') ? now()->addDays(90) : now()->addHours(14);
        $token = $user->createToken('gym-pwa', ['*'], $expires)->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => self::presentUser($user),
        ]);
    }

    /**
     * Get Current Authenticated User & Context.
     */
    public function me(Request $request)
    {
        /** @var User $user */
        $user = $request->user();
        $token = $user->currentAccessToken();
        $impersonating = ($token && isset($token->name)) ? str_starts_with((string) $token->name, 'impersonate:') : false;

        return response()->json([
            'user' => self::presentUser($user, $impersonating),
        ]);
    }

    /**
     * Log out current session.
     */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['message' => 'Successfully logged out.']);
    }

    /**
     * Change user password.
     */
    public function changePassword(Request $request)
    {
        $request->validate([
            'current_password' => ['required', 'current_password:sanctum'],
            'password' => ['required', 'confirmed', Password::min(6)],
        ]);

        $request->user()->update([
            'password' => $request->input('password'),
        ]);

        return response()->json(['message' => 'Password updated successfully.']);
    }

    /**
     * Update user language preference (en, mr, hi).
     */
    public function updateLanguage(Request $request)
    {
        $validated = $request->validate([
            'language' => ['required', 'string', 'in:en,mr,hi'],
        ]);

        $user = $request->user();
        $user->update(['language' => $validated['language']]);

        return response()->json([
            'message' => __('messages.language_updated'),
            'language' => $user->language,
            'user' => self::presentUser($user->fresh()),
        ]);
    }

    /**
     * Format user payload with Gym, Branches, Role, and Permissions.
     */
    public static function presentUser(User $user, bool $impersonating = false): array
    {
        $gym = $user->gym;

        $branches = [];
        if ($gym) {
            // Owner has access to all branches; staff has assigned branches
            $branchesQuery = Branch::withoutGlobalScope('gym')->where('gym_id', $gym->id)->where('is_active', true);
            if (!$user->isOwner() && !$user->isSuperAdmin()) {
                $branchesQuery->where(function ($q) use ($user) {
                    $q->where('id', $user->primary_branch_id)
                      ->orWhereHas('staff', fn ($sq) => $sq->where('users.id', $user->id));
                });
            }
            $branches = $branchesQuery->select('id', 'name', 'code', 'is_primary', 'city')->get()->toArray();
        }

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'role' => $user->role,
            'language' => $user->language ?: 'en',
            'avatar_url' => $user->avatar_url,
            'primary_branch_id' => $user->primary_branch_id,
            'branches' => $branches,
            'permissions' => $user->permissions ?: User::defaultPermissions($user->role),
            'impersonating' => $impersonating,
            'gym' => $gym ? [
                'id' => $gym->id,
                'name' => $gym->name,
                'slug' => $gym->slug,
                'currency' => $gym->currency,
                'status' => $gym->status,
                'is_trial' => $gym->status === Gym::STATUS_TRIAL,
                'trial_ends_at' => $gym->trial_ends_at?->toIso8601String(),
                'subscription_expires_at' => $gym->subscription_expires_at?->toIso8601String(),
                'expired' => $gym->isExpired(),
                'branding' => $gym->branding,
                'settings' => $gym->settings,
                'assets_version' => $gym->assets_version,
            ] : null,
        ];
    }
}
