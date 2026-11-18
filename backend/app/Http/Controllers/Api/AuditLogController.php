<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Support\CurrentBranch;
use App\Support\CurrentGym;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        $query = AuditLog::with([
            'user:id,name,email,role',
            'branch:id,name,code',
        ]);

        $branchId = $request->query('branch_id') ?: CurrentBranch::id();
        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        if ($request->filled('event')) {
            $query->where('event', $request->input('event'));
        }

        $logs = $query->latest('id')->paginate($request->input('per_page', 25));

        return response()->json($logs);
    }
}
