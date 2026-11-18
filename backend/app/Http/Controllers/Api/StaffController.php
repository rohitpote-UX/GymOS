<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\User;
use App\Support\CurrentGym;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rules\Password;

class StaffController extends Controller
{
    public function index(Request $request)
    {
        $query = User::where('gym_id', CurrentGym::id())
            ->where('role', '!=', User::ROLE_SUPER_ADMIN)
            ->with(['primaryBranch:id,name,code', 'branches:id,name,code']);

        if ($request->filled('role')) {
            $query->where('role', $request->input('role'));
        }

        if ($request->filled('branch_id')) {
            $branchId = (int) $request->input('branch_id');
            $query->where(function ($q) use ($branchId) {
                $q->where('primary_branch_id', $branchId)
                  ->orWhereHas('branches', fn ($sq) => $sq->where('branches.id', $branchId));
            });
        }

        $staff = $query->orderBy('name')->get();

        return response()->json($staff);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:150', 'unique:users,email'],
            'phone' => ['required', 'string', 'max:20'],
            'password' => ['required', Password::min(6)],
            'role' => ['required', 'in:branch_manager,trainer,front_desk'],
            'primary_branch_id' => ['required', 'exists:branches,id'],
            'branch_ids' => ['nullable', 'array'],
            'branch_ids.*' => ['exists:branches,id'],
            'permissions' => ['nullable', 'array'],
        ]);

        return DB::transaction(function () use ($validated, $request) {
            $gymId = CurrentGym::require();

            // Verify branch belongs to gym
            Branch::findOrFail($validated['primary_branch_id']);

            $user = User::create([
                'gym_id' => $gymId,
                'primary_branch_id' => $validated['primary_branch_id'],
                'name' => $validated['name'],
                'email' => strtolower(trim($validated['email'])),
                'phone' => preg_replace('/\D/', '', $validated['phone']),
                'password' => $validated['password'],
                'role' => $validated['role'],
                'permissions' => $validated['permissions'] ?? null,
                'is_active' => true,
            ]);

            $branchIds = array_unique(array_merge(
                [$validated['primary_branch_id']],
                $validated['branch_ids'] ?? []
            ));

            $syncData = [];
            foreach ($branchIds as $bId) {
                $syncData[$bId] = ['gym_id' => $gymId];
            }
            $user->branches()->sync($syncData);

            AuditLog::record('staff.created', [
                'staff_id' => $user->id,
                'name' => $user->name,
                'role' => $user->role,
            ], $user->primary_branch_id);

            return response()->json($user->load(['primaryBranch', 'branches']), 201);
        });
    }

    public function show(int $id)
    {
        $user = User::where('gym_id', CurrentGym::id())
            ->with(['primaryBranch', 'branches'])
            ->findOrFail($id);

        return response()->json($user);
    }

    public function update(Request $request, int $id)
    {
        $user = User::where('gym_id', CurrentGym::id())->findOrFail($id);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'phone' => ['sometimes', 'string', 'max:20'],
            'role' => ['sometimes', 'in:gym_owner,branch_manager,trainer,front_desk'],
            'primary_branch_id' => ['sometimes', 'exists:branches,id'],
            'branch_ids' => ['nullable', 'array'],
            'branch_ids.*' => ['exists:branches,id'],
            'permissions' => ['nullable', 'array'],
            'is_active' => ['sometimes', 'boolean'],
            'password' => ['nullable', Password::min(6)],
        ]);

        return DB::transaction(function () use ($user, $validated) {
            $gymId = CurrentGym::require();

            if (!empty($validated['password'])) {
                $validated['password'] = $validated['password'];
            } else {
                unset($validated['password']);
            }

            if (isset($validated['phone'])) {
                $validated['phone'] = preg_replace('/\D/', '', $validated['phone']);
            }

            $user->update($validated);

            if (isset($validated['branch_ids'])) {
                $branchIds = array_unique(array_merge(
                    [$user->primary_branch_id],
                    $validated['branch_ids']
                ));
                $syncData = [];
                foreach ($branchIds as $bId) {
                    $syncData[$bId] = ['gym_id' => $gymId];
                }
                $user->branches()->sync($syncData);
            }

            AuditLog::record('staff.updated', [
                'staff_id' => $user->id,
                'name' => $user->name,
            ], $user->primary_branch_id);

            return response()->json($user->fresh(['primaryBranch', 'branches']));
        });
    }

    public function destroy(int $id)
    {
        $user = User::where('gym_id', CurrentGym::id())->findOrFail($id);

        if ($user->isOwner()) {
            return response()->json(['message' => 'Cannot remove the primary gym owner account.'], 422);
        }

        $user->delete();

        AuditLog::record('staff.deleted', ['staff_id' => $user->id, 'name' => $user->name]);

        return response()->json(['message' => 'Staff member removed successfully.']);
    }
}
