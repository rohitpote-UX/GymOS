<?php

namespace Database\Seeders;

use App\Models\AttendanceLog;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\DailyCashClosing;
use App\Models\Expense;
use App\Models\Gym;
use App\Models\Lead;
use App\Models\LeadFollowup;
use App\Models\Member;
use App\Models\MemberLedger;
use App\Models\MemberMembership;
use App\Models\MembershipPlan;
use App\Models\Payment;
use App\Models\PtSession;
use App\Models\SaasPlan;
use App\Models\StaffLeave;
use App\Models\User;
use App\Support\CurrentGym;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Super Admin (Platform Owner)
        $superAdmin = User::create([
            'gym_id' => null,
            'name' => 'Platform Architect',
            'email' => 'admin@gymbusinessos.com',
            'phone' => '9999999999',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_SUPER_ADMIN,
            'is_active' => true,
        ]);

        // 2. SaaS Subscription Plans
        $starterPlan = SaasPlan::create([
            'name' => 'Starter Studio',
            'code' => 'starter',
            'price' => 2499.00,
            'interval' => 'month',
            'branch_limit' => 1,
            'member_limit' => 250,
            'features' => ['1 Branch', 'Up to 250 Members', 'Member Check-in', 'Basic Reports'],
            'is_active' => true,
            'sort_order' => 1,
        ]);

        $growthPlan = SaasPlan::create([
            'name' => 'Growth Club',
            'code' => 'growth',
            'price' => 4999.00,
            'interval' => 'month',
            'branch_limit' => 3,
            'member_limit' => 1000,
            'features' => ['Up to 3 Branches', 'Up to 1000 Members', 'Staff Permissions', 'Advanced Analytics', 'WhatsApp Ready'],
            'is_active' => true,
            'sort_order' => 2,
        ]);

        $enterprisePlan = SaasPlan::create([
            'name' => 'Enterprise Franchise',
            'code' => 'enterprise',
            'price' => 9999.00,
            'interval' => 'month',
            'branch_limit' => 25,
            'member_limit' => 10000,
            'features' => ['Multi-location Franchise', 'Unlimited Members', 'Dedicated Account Manager', 'Custom API Integration'],
            'is_active' => true,
            'sort_order' => 3,
        ]);

        // 3. Demo Tenant Gym: "IronCore Fitness"
        $gym = Gym::create([
            'name' => 'IronCore Fitness',
            'legal_name' => 'IronCore Health & Fitness Pvt Ltd',
            'slug' => 'ironcore',
            'email' => 'info@ironcore.in',
            'phone' => '9820011223',
            'currency' => 'INR',
            'status' => Gym::STATUS_ACTIVE,
            'saas_plan_id' => $growthPlan->id,
            'subscription_expires_at' => now()->addDays(90),
            'billing_cycle' => 'monthly',
            'settings' => [
                'invoice_prefix' => 'ICF-',
                'tax_rate' => 18,
                'tax_name' => 'GST',
                'whatsapp_notifications' => true,
            ],
            'branding' => [
                'primary_color' => '#0f172a',
                'accent_color' => '#10b981',
                'tagline' => 'Iron Built. Elite Driven.',
            ],
            'assets_version' => 1,
        ]);

        // Run in context of IronCore Fitness
        CurrentGym::run($gym, function () use ($gym) {
            // Branches
            $branchMain = Branch::create([
                'gym_id' => $gym->id,
                'name' => 'Downtown Flagship',
                'code' => 'DWTN',
                'phone' => '9820011224',
                'email' => 'downtown@ironcore.in',
                'address' => 'Floor 3, One World Center, Lower Parel',
                'city' => 'Mumbai',
                'state' => 'Maharashtra',
                'pincode' => '400013',
                'capacity' => 200,
                'is_active' => true,
                'is_primary' => true,
            ]);

            $branchBandra = Branch::create([
                'gym_id' => $gym->id,
                'name' => 'Bandra Studio',
                'code' => 'BNDR',
                'phone' => '9820011225',
                'email' => 'bandra@ironcore.in',
                'address' => 'Turner Road, Bandra West',
                'city' => 'Mumbai',
                'state' => 'Maharashtra',
                'pincode' => '400050',
                'capacity' => 120,
                'is_active' => true,
                'is_primary' => false,
            ]);

            // Staff: Owner
            $owner = User::create([
                'gym_id' => $gym->id,
                'primary_branch_id' => $branchMain->id,
                'name' => 'Vikram Malhotra',
                'email' => 'owner@ironcore.in',
                'phone' => '9820011223',
                'password' => Hash::make('password123'),
                'role' => User::ROLE_GYM_OWNER,
                'is_active' => true,
            ]);
            $branchMain->staff()->attach($owner->id, ['gym_id' => $gym->id]);
            $branchBandra->staff()->attach($owner->id, ['gym_id' => $gym->id]);

            // Staff: Branch Manager
            $manager = User::create([
                'gym_id' => $gym->id,
                'primary_branch_id' => $branchBandra->id,
                'name' => 'Sneha Kapoor',
                'email' => 'manager@ironcore.in',
                'phone' => '9820055443',
                'password' => Hash::make('password123'),
                'role' => User::ROLE_BRANCH_MANAGER,
                'base_salary' => 50000.00,
                'is_active' => true,
            ]);
            $branchBandra->staff()->attach($manager->id, ['gym_id' => $gym->id]);

            // Staff: Front Desk
            $reception = User::create([
                'gym_id' => $gym->id,
                'primary_branch_id' => $branchMain->id,
                'name' => 'Arjun Shinde',
                'email' => 'reception@ironcore.in',
                'phone' => '9820066778',
                'password' => Hash::make('password123'),
                'role' => User::ROLE_FRONT_DESK,
                'base_salary' => 25000.00,
                'is_active' => true,
            ]);
            $branchMain->staff()->attach($reception->id, ['gym_id' => $gym->id]);

            // Staff: Trainer
            $trainer = User::create([
                'gym_id' => $gym->id,
                'primary_branch_id' => $branchMain->id,
                'name' => 'Rohan D Souza',
                'email' => 'trainer@ironcore.in',
                'phone' => '9820077889',
                'password' => Hash::make('password123'),
                'role' => User::ROLE_TRAINER,
                'specialization' => 'Strength & Hypertrophy, Rehab',
                'base_salary' => 35000.00,
                'commission_percent' => 15.00,
                'pt_session_rate' => 800.00,
                'is_active' => true,
            ]);
            $branchMain->staff()->attach($trainer->id, ['gym_id' => $gym->id]);

            // Membership Packages
            $planMonthly = MembershipPlan::create([
                'gym_id' => $gym->id,
                'name' => 'Monthly Standard',
                'code' => 'M1',
                'category' => 'monthly',
                'plan_type' => 'regular',
                'duration_days' => 30,
                'price' => 2800.00,
                'admission_fee' => 500.00,
                'tax_percent' => 18.00,
                'max_freeze_days' => 7,
                'description' => 'Full access to gym floor and locker rooms.',
                'is_active' => true,
            ]);

            $planQuarterly = MembershipPlan::create([
                'gym_id' => $gym->id,
                'name' => 'Quarterly Transformation',
                'code' => 'Q3',
                'category' => 'quarterly',
                'plan_type' => 'regular',
                'duration_days' => 90,
                'price' => 7500.00,
                'admission_fee' => 0.00,
                'tax_percent' => 18.00,
                'max_freeze_days' => 15,
                'description' => 'Includes 2 personal trainer orientation sessions.',
                'is_active' => true,
            ]);

            $planAnnual = MembershipPlan::create([
                'gym_id' => $gym->id,
                'name' => 'Annual Elite VIP',
                'code' => 'A12',
                'category' => 'annual',
                'plan_type' => 'regular',
                'duration_days' => 365,
                'price' => 22000.00,
                'admission_fee' => 0.00,
                'tax_percent' => 18.00,
                'max_freeze_days' => 45,
                'description' => 'All-branch access, steam & sauna, free diet consultation.',
                'is_active' => true,
            ]);

            $planPtPackage = MembershipPlan::create([
                'gym_id' => $gym->id,
                'name' => 'Personal Training (12 Sessions)',
                'code' => 'PT-12',
                'category' => 'pt_package',
                'plan_type' => 'pt',
                'duration_days' => 60,
                'price' => 12000.00,
                'pt_sessions_count' => 12,
                'max_freeze_days' => 14,
                'description' => '1-on-1 personal coaching with customized diet and workout charts.',
                'is_active' => true,
            ]);

            // Demo Members
            $membersData = [
                ['Aarav', 'Sharma', '9811122233', 'aarav@gmail.com', 'male', $planAnnual, $branchMain, $trainer->id],
                ['Priya', 'Nair', '9822233344', 'priya@gmail.com', 'female', $planQuarterly, $branchMain, $trainer->id],
                ['Karan', 'Patel', '9833344455', 'karan@gmail.com', 'male', $planMonthly, $branchBandra, null],
                ['Ananya', 'Deshmukh', '9844455566', 'ananya@gmail.com', 'female', $planQuarterly, $branchMain, null],
                ['Siddharth', 'Joshi', '9855566677', 'sid@gmail.com', 'male', $planMonthly, $branchBandra, null],
            ];

            foreach ($membersData as $idx => [$first, $last, $phone, $email, $gender, $plan, $branch, $assignedTrainer]) {
                $member = Member::create([
                    'gym_id' => $gym->id,
                    'primary_branch_id' => $branch->id,
                    'assigned_trainer_id' => $assignedTrainer,
                    'member_code' => 'ICF-' . str_pad((string) ($idx + 1), 4, '0', STR_PAD_LEFT),
                    'first_name' => $first,
                    'last_name' => $last,
                    'phone' => $phone,
                    'email' => $email,
                    'gender' => $gender,
                    'status' => 'active',
                    'joined_date' => now()->subDays(15 * ($idx + 1))->toDateString(),
                    'total_fees_billed' => $plan->price,
                    'total_fees_paid' => $plan->price,
                    'outstanding_balance' => 0,
                ]);

                // Active Subscription
                $subscription = MemberMembership::create([
                    'gym_id' => $gym->id,
                    'branch_id' => $branch->id,
                    'member_id' => $member->id,
                    'membership_plan_id' => $plan->id,
                    'assigned_trainer_id' => $assignedTrainer,
                    'start_date' => now()->subDays(10)->toDateString(),
                    'end_date' => now()->addDays($plan->duration_days - 10)->toDateString(),
                    'status' => 'active',
                    'category' => $plan->category,
                    'total_price' => $plan->price,
                    'final_price' => $plan->price,
                    'price_paid' => $plan->price,
                    'balance_due' => 0,
                    'total_pt_sessions' => $plan->pt_sessions_count ?? 0,
                    'completed_pt_sessions' => 0,
                ]);

                // Member Ledger Charge
                MemberLedger::create([
                    'gym_id' => $gym->id,
                    'branch_id' => $branch->id,
                    'member_id' => $member->id,
                    'type' => 'charge',
                    'reference_type' => 'membership',
                    'reference_id' => $subscription->id,
                    'description' => "Enrolment: {$plan->name}",
                    'debit' => $plan->price,
                    'credit' => 0,
                    'running_balance' => $plan->price,
                    'transaction_date' => now()->subDays(10)->toDateString(),
                    'created_by_user_id' => $reception->id,
                ]);

                // Payment Record
                $payment = Payment::create([
                    'gym_id' => $gym->id,
                    'branch_id' => $branch->id,
                    'member_id' => $member->id,
                    'member_membership_id' => $subscription->id,
                    'receipt_number' => 'ICF-REC-' . (1000 + $idx),
                    'type' => 'payment',
                    'amount' => $plan->price,
                    'payment_method' => ($idx % 2 === 0) ? 'upi' : 'cash',
                    'payment_date' => now()->subDays(10)->toDateString(),
                    'status' => 'completed',
                    'collected_by_user_id' => $reception->id,
                ]);

                // Member Ledger Credit
                MemberLedger::create([
                    'gym_id' => $gym->id,
                    'branch_id' => $branch->id,
                    'member_id' => $member->id,
                    'type' => 'payment',
                    'reference_type' => 'payment',
                    'reference_id' => $payment->id,
                    'description' => "Payment #{$payment->receipt_number}",
                    'debit' => 0,
                    'credit' => $plan->price,
                    'running_balance' => 0,
                    'transaction_date' => now()->subDays(10)->toDateString(),
                    'created_by_user_id' => $reception->id,
                ]);

                // Today Check-in
                AttendanceLog::create([
                    'gym_id' => $gym->id,
                    'branch_id' => $branch->id,
                    'member_id' => $member->id,
                    'check_in_at' => now()->subHours(rand(1, 3)),
                    'method' => 'front_desk',
                    'verified_by_user_id' => $reception->id,
                ]);

                $member->recalculateBalances();
            }

            // Member with Outstanding Dues (Module 4 test case)
            $dueMember = Member::create([
                'gym_id' => $gym->id,
                'primary_branch_id' => $branchMain->id,
                'member_code' => 'ICF-0006',
                'first_name' => 'Mohit',
                'last_name' => 'Chawla',
                'phone' => '9899887766',
                'email' => 'mohit@gmail.com',
                'gender' => 'male',
                'status' => 'active',
                'joined_date' => now()->subDays(5)->toDateString(),
                'total_fees_billed' => 7500.00,
                'total_fees_paid' => 4000.00,
                'outstanding_balance' => 3500.00,
            ]);

            $dueSub = MemberMembership::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'member_id' => $dueMember->id,
                'membership_plan_id' => $planQuarterly->id,
                'start_date' => now()->subDays(5)->toDateString(),
                'end_date' => now()->addDays(85)->toDateString(),
                'status' => 'active',
                'category' => 'quarterly',
                'total_price' => 7500.00,
                'final_price' => 7500.00,
                'price_paid' => 4000.00,
                'balance_due' => 3500.00,
            ]);

            Payment::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'member_id' => $dueMember->id,
                'member_membership_id' => $dueSub->id,
                'receipt_number' => 'ICF-REC-1006',
                'type' => 'payment',
                'amount' => 4000.00,
                'balance_after_payment' => 3500.00,
                'payment_method' => 'upi',
                'payment_date' => now()->subDays(5)->toDateString(),
                'status' => 'completed',
                'collected_by_user_id' => $reception->id,
            ]);

            $dueMember->recalculateBalances();

            // PT Sessions for Trainer Rohan
            PtSession::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'trainer_id' => $trainer->id,
                'member_id' => 1,
                'session_date' => now()->subDay()->toDateString(),
                'start_time' => '17:00:00',
                'end_time' => '18:00:00',
                'duration_minutes' => 60,
                'status' => 'completed',
                'completed_at' => now()->subDay()->setTime(18, 0),
                'trainer_notes' => 'Heavy deadlift form review and core conditioning.',
            ]);

            PtSession::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'trainer_id' => $trainer->id,
                'member_id' => 2,
                'session_date' => now()->toDateString(),
                'start_time' => '18:30:00',
                'duration_minutes' => 60,
                'status' => 'scheduled',
                'trainer_notes' => 'Kettlebell HIIT and mobility routine.',
            ]);

            // Staff Leave
            StaffLeave::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'user_id' => $trainer->id,
                'leave_type' => 'casual',
                'start_date' => now()->addDays(10)->toDateString(),
                'end_date' => now()->addDays(12)->toDateString(),
                'days_count' => 3,
                'status' => 'pending',
                'reason' => 'Attending Kettlebell Level-2 Certification Course in Goa.',
            ]);

            // Expenses (Module 5)
            $expenses = [
                ['Rent - Downtown Flagship (Nov 2026)', 'rent', 85000.00, 'bank_transfer', now()->subDays(5)->toDateString(), 'DLF Real Estate', $branchMain->id],
                ['Electricity Bill - Oct 2026', 'electricity', 18450.00, 'upi', now()->subDays(3)->toDateString(), 'Adani Electricity', $branchMain->id],
                ['Treadmill Lubrication & Belt Service', 'maintenance', 5600.00, 'cash', now()->subDay()->toDateString(), 'FitFix Services', $branchMain->id],
                ['Instagram Paid Ads (Lower Parel Campaign)', 'marketing', 12500.00, 'card', now()->subDays(7)->toDateString(), 'Meta Ads', $branchMain->id],
                ['Sanitizer & Disinfectant Supplies', 'cleaning', 3200.00, 'cash', now()->toDateString(), 'CleanPro Mumbai', $branchMain->id],
                ['Rubber Hex Dumbbells Set (2.5 - 25 kg)', 'equipment', 42000.00, 'bank_transfer', now()->subDays(12)->toDateString(), 'Bullfit India', $branchBandra->id],
            ];

            foreach ($expenses as [$title, $category, $amt, $method, $dt, $paidTo, $bId]) {
                Expense::create([
                    'gym_id' => $gym->id,
                    'branch_id' => $bId,
                    'title' => $title,
                    'category' => $category,
                    'amount' => $amt,
                    'payment_mode' => $method,
                    'expense_date' => $dt,
                    'vendor_name' => $paidTo,
                    'recorded_by_user_id' => $owner->id,
                ]);
            }

            // Leads CRM (Module 7)
            $lead1 = Lead::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'assigned_user_id' => $reception->id,
                'name' => 'Rajesh Khanna',
                'phone' => '9820099881',
                'email' => 'rajesh.k@gmail.com',
                'source' => 'instagram',
                'status' => 'trial_booked',
                'trial_date' => now()->addDay()->toDateString(),
                'followup_date' => now()->addDay()->toDateString(),
                'fitness_goal' => 'weight_loss',
                'notes' => 'Looking for morning workout slot. Very interested in annual VIP plan.',
            ]);

            LeadFollowup::create([
                'gym_id' => $gym->id,
                'lead_id' => $lead1->id,
                'user_id' => $reception->id,
                'followup_date' => now()->toDateString(),
                'type' => 'call',
                'summary' => 'Spoke on phone, invited for trial session tomorrow at 7:30 AM.',
                'next_followup_date' => now()->addDay()->toDateString(),
            ]);

            $lead2 = Lead::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'assigned_user_id' => $reception->id,
                'name' => 'Meera Sengupta',
                'phone' => '9820099882',
                'email' => 'meera.s@gmail.com',
                'source' => 'walk_in',
                'status' => 'contacted',
                'followup_date' => now()->addDays(2)->toDateString(),
                'fitness_goal' => 'general_fitness',
                'notes' => 'Visited the gym today, liked the infrastructure.',
            ]);

            $lead3 = Lead::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchBandra->id,
                'assigned_user_id' => $manager->id,
                'name' => 'Sunil Varma',
                'phone' => '9820099883',
                'source' => 'referral',
                'status' => 'lost',
                'lost_reason' => 'joined_another_gym',
                'notes' => 'Joined competitor gym closer to his residence in Khar.',
            ]);

            // Daily Cash Closing Register for Downtown Flagship
            DailyCashClosing::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'closing_date' => now()->subDay()->toDateString(),
                'opening_cash' => 5000.00,
                'cash_collected' => 5600.00,
                'cash_expenses' => 5600.00,
                'expected_cash_in_hand' => 5000.00,
                'actual_cash_in_hand' => 5000.00,
                'cash_discrepancy' => 0.00,
                'status' => 'closed',
                'opened_by_user_id' => $reception->id,
                'closed_by_user_id' => $reception->id,
                'closed_at' => now()->subDay()->setTime(22, 0),
                'notes' => 'Shift cash balanced perfectly.',
            ]);

            AuditLog::record('system.seeded', ['gym' => $gym->name]);
        });
    }
}
