<?php

use App\Models\ActionItem;
use App\Models\AttendanceLog;
use App\Models\Gym;
use App\Models\Member;
use App\Models\MemberMembership;
use App\Services\WhatsAppService;
use Carbon\Carbon;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// -------------------------------------------------------------
// GYM BUSINESS OS — DAILY SCHEDULED AUTOMATION
// -------------------------------------------------------------

// 1. Prune expired Sanctum API tokens daily
Schedule::command('sanctum:prune-expired --hours=48')->daily();

// 2. Mark expired memberships & trigger Action Center items
Schedule::call(function () {
    $today = Carbon::today()->toDateString();

    // Update expired memberships
    MemberMembership::where('status', 'active')
        ->where('end_date', '<', $today)
        ->update(['status' => 'expired']);

    // Scan for expiring memberships in next 7 days and create action center items
    $sevenDaysLater = Carbon::today()->addDays(7)->toDateString();
    $expiringMemberships = MemberMembership::with(['member', 'plan'])
        ->where('status', 'active')
        ->whereBetween('end_date', [$today, $sevenDaysLater])
        ->get();

    foreach ($expiringMemberships as $mm) {
        if (!$mm->member) continue;

        ActionItem::firstOrCreate([
            'gym_id' => $mm->gym_id,
            'type' => 'expiring_membership',
            'reference_type' => 'member_membership',
            'reference_id' => $mm->id,
            'status' => 'pending',
        ], [
            'branch_id' => $mm->branch_id,
            'severity' => 'warning',
            'title' => "Renewal Due: {$mm->member->first_name} ({$mm->member->member_code}) expires on {$mm->end_date->toDateString()}",
            'description' => "Plan: {$mm->plan?->name}. Contact member for advance renewal.",
            'due_date' => $mm->end_date->toDateString(),
        ]);
    }
})->dailyAt('01:00');

// 3. Scan for Inactive Members (10+ days without attendance)
Schedule::call(function () {
    $tenDaysAgo = Carbon::today()->subDays(10)->toDateString();

    $gyms = Gym::where('status', Gym::STATUS_ACTIVE)->get();

    foreach ($gyms as $gym) {
        $recentAttendees = AttendanceLog::where('gym_id', $gym->id)
            ->whereDate('check_in_at', '>=', $tenDaysAgo)
            ->pluck('member_id')
            ->unique();

        $inactiveMembers = Member::where('gym_id', $gym->id)
            ->where('status', 'active')
            ->whereNotIn('id', $recentAttendees)
            ->get();

        foreach ($inactiveMembers as $m) {
            ActionItem::firstOrCreate([
                'gym_id' => $gym->id,
                'type' => 'inactive_member',
                'reference_type' => 'member',
                'reference_id' => $m->id,
                'status' => 'pending',
            ], [
                'branch_id' => $m->primary_branch_id,
                'severity' => 'warning',
                'title' => "Inactive 10+ Days: {$m->first_name} {$m->last_name} ({$m->member_code})",
                'description' => "Zero attendance check-ins since {$tenDaysAgo}. Call member to encourage workout comeback.",
            ]);
        }
    }
})->dailyAt('07:00');
