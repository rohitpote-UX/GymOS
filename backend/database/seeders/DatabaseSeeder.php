<?php

namespace Database\Seeders;

use App\Models\ActionItem;
use App\Models\AttendanceLog;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\DailyCashClosing;
use App\Models\Expense;
use App\Models\Gym;
use App\Models\InventoryMovement;
use App\Models\Lead;
use App\Models\LeadFollowup;
use App\Models\Member;
use App\Models\MemberLedger;
use App\Models\MemberMembership;
use App\Models\MemberProgressLog;
use App\Models\MemberWorkoutPlan;
use App\Models\MembershipPlan;
use App\Models\Payment;
use App\Models\PosOrder;
use App\Models\PosOrderItem;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\ProductBranchStock;
use App\Models\PtSession;
use App\Models\PurchaseInvoice;
use App\Models\PurchaseInvoiceItem;
use App\Models\SaasPlan;
use App\Models\StaffLeave;
use App\Models\Supplier;
use App\Models\SupplierLedger;
use App\Models\SupplierPayment;
use App\Models\SupportTicket;
use App\Models\SupportTicketMessage;
use App\Models\User;
use App\Models\WhatsAppLog;
use App\Models\WhatsAppTemplate;
use App\Services\WhatsAppService;
use App\Support\CurrentGym;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(WorkoutAndNutritionSeeder::class);
        $this->call(ExerciseVideoLibrarySeeder::class);

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

            // =========================================================================
            // PROMPT 03: GYM INVENTORY, SUPPLEMENT POS & PROFITABILITY SEEDING
            // =========================================================================

            // 1. Suppliers
            $supON = Supplier::create([
                'gym_id' => $gym->id,
                'name' => 'Optimum Nutrition India Dist',
                'company_name' => 'Glanbia Performance Nutrition India Pvt Ltd',
                'contact_person' => 'Rajesh Shah',
                'phone' => '9811002233',
                'email' => 'sales@on-india.com',
                'gstin' => '27AABCG1234F1Z5',
                'address' => 'Plot 45, MIDC Industrial Area, Andheri East',
                'city' => 'Mumbai',
                'bank_details' => 'HDFC Bank - A/C 50200012345678, IFSC: HDFC0000045',
                'notes' => 'Primary distributor for Optimum Nutrition & BSN',
                'is_active' => true,
            ]);

            $supMB = Supplier::create([
                'gym_id' => $gym->id,
                'name' => 'MuscleBlaze Direct',
                'company_name' => 'Bright Performance Nutrition Pvt Ltd',
                'contact_person' => 'Amit Kapoor',
                'phone' => '9822113344',
                'email' => 'partners@muscleblaze.in',
                'gstin' => '27AABCB5678K1Z2',
                'address' => 'Express Trade Towers, Sector 132',
                'city' => 'Noida',
                'bank_details' => 'ICICI Bank - A/C 001105001234, IFSC: ICIC0000011',
                'notes' => 'Whey biozyme and creatine supplier with 5% gym franchise rebate',
                'is_active' => true,
            ]);

            $supGear = Supplier::create([
                'gym_id' => $gym->id,
                'name' => 'Beast Gear & Apparel Supplies',
                'company_name' => 'Beast Sports & Fitness Essentials LLP',
                'contact_person' => 'Vikram Joshi',
                'phone' => '9833224455',
                'email' => 'orders@beastgear.in',
                'gstin' => '27AABCB9012P1Z8',
                'address' => '12 Commerce Centre, Tardeo Road',
                'city' => 'Mumbai',
                'bank_details' => 'Axis Bank - A/C 914020005678901, IFSC: UTIB0000142',
                'notes' => 'Custom branded shakers, belts, and gym apparel',
                'is_active' => true,
            ]);

            // 2. Products Master
            $prodONWhey = Product::create([
                'gym_id' => $gym->id,
                'name' => 'Gold Standard 100% Whey 2kg',
                'brand' => 'Optimum Nutrition',
                'category' => 'whey_protein',
                'sku' => 'ON-WHEY-2KG-CHO',
                'barcode' => '8901234567801',
                'size' => '2kg (4.4 lbs)',
                'weight' => '2000g',
                'flavour' => 'Double Rich Chocolate',
                'cost_price' => 5200.00, // WAC
                'selling_price' => 6499.00,
                'mrp' => 7499.00,
                'tax_percent' => 18.00,
                'default_supplier_id' => $supON->id,
                'min_stock_alert' => 4,
                'is_active' => true,
                'description' => 'World #1 selling whey protein isolate primary source.',
            ]);

            $prodMBCreatine = Product::create([
                'gym_id' => $gym->id,
                'name' => 'Creatine Monohydrate Creapure 250g',
                'brand' => 'MuscleBlaze',
                'category' => 'creatine',
                'sku' => 'MB-CREA-250G',
                'barcode' => '8901234567802',
                'size' => '250g',
                'weight' => '250g',
                'flavour' => 'Unflavoured',
                'cost_price' => 750.00,
                'selling_price' => 1099.00,
                'mrp' => 1299.00,
                'tax_percent' => 18.00,
                'default_supplier_id' => $supMB->id,
                'min_stock_alert' => 6,
                'is_active' => true,
                'description' => 'Pure micronized creatine monohydrate for strength and ATP output.',
            ]);

            $prodC4 = Product::create([
                'gym_id' => $gym->id,
                'name' => 'C4 Original Pre-Workout 390g',
                'brand' => 'Cellucor',
                'category' => 'pre_workout',
                'sku' => 'CEL-C4-390G-FP',
                'barcode' => '8901234567803',
                'size' => '60 Servings',
                'weight' => '390g',
                'flavour' => 'Fruit Punch',
                'cost_price' => 2100.00,
                'selling_price' => 2899.00,
                'mrp' => 3299.00,
                'tax_percent' => 18.00,
                'default_supplier_id' => $supON->id,
                'min_stock_alert' => 3,
                'is_active' => true,
                'description' => 'Explosive energy and laser focus pre-workout supplement.',
            ]);

            $prodProteinBar = Product::create([
                'gym_id' => $gym->id,
                'name' => 'Max Protein Daily Bar 20g (Pack of 6)',
                'brand' => 'RiteBite',
                'category' => 'protein_bars',
                'sku' => 'RB-BAR-20G-6PK',
                'barcode' => '8901234567804',
                'size' => '6 x 50g',
                'flavour' => 'Choco Slim',
                'cost_price' => 420.00,
                'selling_price' => 600.00,
                'mrp' => 660.00,
                'tax_percent' => 12.00,
                'default_supplier_id' => $supMB->id,
                'min_stock_alert' => 5,
                'is_active' => true,
                'description' => '20g protein per bar, zero added sugar high fiber snack.',
            ]);

            $prodShaker = Product::create([
                'gym_id' => $gym->id,
                'name' => 'IronCore Pro Stainless Steel Shaker 750ml',
                'brand' => 'IronCore Essentials',
                'category' => 'shakers',
                'sku' => 'IC-SHAKE-750-BLK',
                'barcode' => '8901234567805',
                'size' => '750ml',
                'flavour' => 'Matte Black',
                'cost_price' => 380.00,
                'selling_price' => 699.00,
                'mrp' => 899.00,
                'tax_percent' => 18.00,
                'default_supplier_id' => $supGear->id,
                'min_stock_alert' => 8,
                'is_active' => true,
                'description' => 'Insulated double-walled stainless steel shaker bottle with wire whisk.',
            ]);

            $prodStraps = Product::create([
                'gym_id' => $gym->id,
                'name' => 'Heavy Duty Neoprene Lifting Wrist Straps (Pair)',
                'brand' => 'IronCore Essentials',
                'category' => 'gym_accessories',
                'sku' => 'IC-STRAP-NEO',
                'barcode' => '8901234567806',
                'size' => 'Standard',
                'flavour' => 'Carbon Grey',
                'cost_price' => 220.00,
                'selling_price' => 499.00,
                'mrp' => 599.00,
                'tax_percent' => 18.00,
                'default_supplier_id' => $supGear->id,
                'min_stock_alert' => 5,
                'is_active' => true,
                'description' => 'Padded neoprene weightlifting straps for deadlifts and pull days.',
            ]);

            // 3. Branch Stocks (Downtown Flagship & Bandra Elite)
            // Downtown Flagship
            $stockON_Main = ProductBranchStock::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'product_id' => $prodONWhey->id,
                'quantity' => 12,
                'cost_price' => 5200.00,
                'selling_price' => 6499.00,
            ]);

            $stockCrea_Main = ProductBranchStock::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'product_id' => $prodMBCreatine->id,
                'quantity' => 18,
                'cost_price' => 750.00,
                'selling_price' => 1099.00,
            ]);

            $stockC4_Main = ProductBranchStock::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'product_id' => $prodC4->id,
                'quantity' => 8,
                'cost_price' => 2100.00,
                'selling_price' => 2899.00,
            ]);

            $stockBars_Main = ProductBranchStock::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'product_id' => $prodProteinBar->id,
                'quantity' => 15,
                'cost_price' => 420.00,
                'selling_price' => 600.00,
            ]);

            $stockShaker_Main = ProductBranchStock::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'product_id' => $prodShaker->id,
                'quantity' => 20,
                'cost_price' => 380.00,
                'selling_price' => 699.00,
            ]);

            $stockStraps_Main = ProductBranchStock::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'product_id' => $prodStraps->id,
                'quantity' => 14,
                'cost_price' => 220.00,
                'selling_price' => 499.00,
            ]);

            // Bandra Elite Branch Stocks
            ProductBranchStock::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchBandra->id,
                'product_id' => $prodONWhey->id,
                'quantity' => 6,
                'cost_price' => 5200.00,
                'selling_price' => 6499.00,
            ]);

            ProductBranchStock::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchBandra->id,
                'product_id' => $prodMBCreatine->id,
                'quantity' => 10,
                'cost_price' => 750.00,
                'selling_price' => 1099.00,
            ]);

            ProductBranchStock::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchBandra->id,
                'product_id' => $prodShaker->id,
                'quantity' => 12,
                'cost_price' => 380.00,
                'selling_price' => 699.00,
            ]);

            // 4. Batches & Expiry Dates (including 1 batch expiring in 25 days to demonstrate alerts)
            $batchON1 = ProductBatch::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'product_id' => $prodONWhey->id,
                'supplier_id' => $supON->id,
                'batch_number' => 'ON-2026-B08',
                'manufacturing_date' => now()->subMonths(3)->toDateString(),
                'expiry_date' => now()->addMonths(15)->toDateString(),
                'cost_price' => 5200.00,
                'selling_price' => 6499.00,
                'initial_quantity' => 12,
                'current_quantity' => 12,
            ]);

            $batchCrea1 = ProductBatch::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'product_id' => $prodMBCreatine->id,
                'supplier_id' => $supMB->id,
                'batch_number' => 'MB-CR-9921',
                'manufacturing_date' => now()->subMonths(2)->toDateString(),
                'expiry_date' => now()->addMonths(18)->toDateString(),
                'cost_price' => 750.00,
                'selling_price' => 1099.00,
                'initial_quantity' => 18,
                'current_quantity' => 18,
            ]);

            // Expiring Batch alert demonstration (Protein Bar expiring in 22 days)
            $batchBarsExpiring = ProductBatch::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'product_id' => $prodProteinBar->id,
                'supplier_id' => $supMB->id,
                'batch_number' => 'RB-EXP-2026',
                'manufacturing_date' => now()->subMonths(5)->toDateString(),
                'expiry_date' => now()->addDays(22)->toDateString(), // Triggers expiring alert!
                'cost_price' => 420.00,
                'selling_price' => 600.00,
                'initial_quantity' => 15,
                'current_quantity' => 15,
            ]);

            // 5. Initial Opening Stock Inventory Movements (Permanent Audit Trail)
            $initialProducts = [
                [$prodONWhey, 12, 5200.00, $batchON1->id],
                [$prodMBCreatine, 18, 750.00, $batchCrea1->id],
                [$prodC4, 8, 2100.00, null],
                [$prodProteinBar, 15, 420.00, $batchBarsExpiring->id],
                [$prodShaker, 20, 380.00, null],
                [$prodStraps, 14, 220.00, null],
            ];

            foreach ($initialProducts as [$p, $qty, $cost, $bId]) {
                InventoryMovement::create([
                    'gym_id' => $gym->id,
                    'branch_id' => $branchMain->id,
                    'product_id' => $p->id,
                    'product_batch_id' => $bId,
                    'type' => 'opening_stock',
                    'reference_type' => 'opening_stock',
                    'reference_id' => $p->id,
                    'quantity_change' => $qty,
                    'quantity_before' => 0,
                    'quantity_after' => $qty,
                    'unit_cost' => $cost,
                    'total_cost' => round($qty * $cost, 2),
                    'notes' => 'Initial inventory opening balance',
                    'user_id' => $owner->id,
                ]);
            }

            // 6. Purchase Invoice from Optimum Nutrition India (Stock Purchase Workflow)
            $purInvoice = PurchaseInvoice::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'supplier_id' => $supON->id,
                'invoice_number' => 'PUR-2026-0001',
                'invoice_date' => now()->subDays(5)->toDateString(),
                'subtotal' => 62400.00, // 12 units @ 5200
                'tax_amount' => 11232.00, // 18% GST
                'discount_amount' => 1000.00,
                'total_amount' => 72632.00,
                'paid_amount' => 50000.00,
                'status' => 'received',
                'payment_status' => 'partial',
                'notes' => 'Bimonthly whey protein restock. Advance 50k paid.',
                'received_by_user_id' => $owner->id,
            ]);

            PurchaseInvoiceItem::create([
                'gym_id' => $gym->id,
                'purchase_invoice_id' => $purInvoice->id,
                'product_id' => $prodONWhey->id,
                'batch_number' => 'ON-2026-B08',
                'manufacturing_date' => now()->subMonths(3)->toDateString(),
                'expiry_date' => now()->addMonths(15)->toDateString(),
                'quantity' => 12,
                'unit_cost' => 5200.00,
                'subtotal' => 62400.00,
                'tax_percent' => 18.00,
                'tax_amount' => 11232.00,
                'total_amount' => 73632.00,
            ]);

            // Supplier ledger entries & partial payment
            SupplierLedger::create([
                'gym_id' => $gym->id,
                'supplier_id' => $supON->id,
                'branch_id' => $branchMain->id,
                'transaction_type' => 'purchase_invoice',
                'reference_id' => $purInvoice->id,
                'reference_number' => 'PUR-2026-0001',
                'debit' => 72632.00,
                'credit' => 0,
                'running_balance' => 72632.00,
                'transaction_date' => now()->subDays(5)->toDateString(),
                'notes' => 'Purchase Invoice #PUR-2026-0001',
                'created_by_user_id' => $owner->id,
            ]);

            $supPayment = SupplierPayment::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'supplier_id' => $supON->id,
                'payment_number' => 'SPAY-2026-0001',
                'amount' => 50000.00,
                'payment_mode' => 'bank_transfer',
                'payment_date' => now()->subDays(5)->toDateString(),
                'reference_id' => 'NEFT-ON-889911',
                'notes' => 'Part payment for Invoice #PUR-2026-0001',
                'paid_by_user_id' => $owner->id,
            ]);

            SupplierLedger::create([
                'gym_id' => $gym->id,
                'supplier_id' => $supON->id,
                'branch_id' => $branchMain->id,
                'transaction_type' => 'payment',
                'reference_id' => $supPayment->id,
                'reference_number' => 'SPAY-2026-0001',
                'debit' => 0,
                'credit' => 50000.00,
                'running_balance' => 22632.00,
                'transaction_date' => now()->subDays(5)->toDateString(),
                'notes' => 'Bank Transfer Ref: NEFT-ON-889911',
                'created_by_user_id' => $owner->id,
            ]);

            $supON->recalculateBalances();

            // 7. POS Sale 1: First Member buys ON Whey + Shaker (Paid via UPI)
            $member1 = Member::first();
            $posOrder1 = PosOrder::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'order_number' => 'POS-2026-0001',
                'member_id' => $member1?->id,
                'customer_name' => $member1 ? $member1->full_name : 'Rahul Sharma',
                'customer_phone' => $member1 ? $member1->phone : '9811122233',
                'subtotal' => 7198.00, // 6499 + 699
                'discount_amount' => 198.00,
                'tax_amount' => 1260.00,
                'total_amount' => 8260.00,
                'paid_amount' => 8260.00,
                'balance_due' => 0.00,
                'payment_method' => 'upi',
                'payment_status' => 'paid',
                'status' => 'completed',
                'order_date' => now()->subDays(2)->toDateString(),
                'notes' => 'Reception POS checkout for ' . ($member1 ? $member1->full_name : 'Member'),
                'billed_by_user_id' => $reception->id,
            ]);

            // Deduct stock for order 1
            $stockON_Main->decrement('quantity', 1);
            $stockShaker_Main->decrement('quantity', 1);

            PosOrderItem::create([
                'gym_id' => $gym->id,
                'pos_order_id' => $posOrder1->id,
                'product_id' => $prodONWhey->id,
                'product_batch_id' => $batchON1->id,
                'quantity' => 1,
                'unit_cost_at_sale' => 5200.00, // Exact COGS
                'unit_price' => 6499.00,
                'discount_amount' => 198.00,
                'tax_percent' => 18.00,
                'tax_amount' => 1134.00,
                'total_amount' => 7435.00,
            ]);

            PosOrderItem::create([
                'gym_id' => $gym->id,
                'pos_order_id' => $posOrder1->id,
                'product_id' => $prodShaker->id,
                'quantity' => 1,
                'unit_cost_at_sale' => 380.00,
                'unit_price' => 699.00,
                'discount_amount' => 0,
                'tax_percent' => 18.00,
                'tax_amount' => 126.00,
                'total_amount' => 825.00,
            ]);

            InventoryMovement::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'product_id' => $prodONWhey->id,
                'product_batch_id' => $batchON1->id,
                'type' => 'sale',
                'reference_type' => 'pos_order',
                'reference_id' => $posOrder1->id,
                'quantity_change' => -1,
                'quantity_before' => 12,
                'quantity_after' => 11,
                'unit_cost' => 5200.00,
                'total_cost' => 5200.00,
                'notes' => 'POS Order #POS-2026-0001',
                'user_id' => $reception->id,
            ]);

            InventoryMovement::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'product_id' => $prodShaker->id,
                'type' => 'sale',
                'reference_type' => 'pos_order',
                'reference_id' => $posOrder1->id,
                'quantity_change' => -1,
                'quantity_before' => 20,
                'quantity_after' => 19,
                'unit_cost' => 380.00,
                'total_cost' => 380.00,
                'notes' => 'POS Order #POS-2026-0001',
                'user_id' => $reception->id,
            ]);

            // Member Ledger sync
            MemberLedger::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'member_id' => $member1->id,
                'type' => 'charge',
                'reference_type' => 'pos_order',
                'reference_id' => $posOrder1->id,
                'description' => 'Store Supplement Purchase #POS-2026-0001',
                'debit' => 8260.00,
                'credit' => 0,
                'running_balance' => (float) $member1->outstanding_balance + 8260.00,
                'transaction_date' => $posOrder1->order_date,
                'created_by_user_id' => $reception->id,
            ]);

            MemberLedger::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'member_id' => $member1->id,
                'type' => 'payment',
                'reference_type' => 'pos_order',
                'reference_id' => $posOrder1->id,
                'description' => 'POS Payment for #POS-2026-0001 via UPI',
                'debit' => 0,
                'credit' => 8260.00,
                'running_balance' => (float) $member1->outstanding_balance,
                'transaction_date' => $posOrder1->order_date,
                'created_by_user_id' => $reception->id,
            ]);

            $member1->recalculateBalances();

            // 8. POS Sale 2: Walk-in customer buys Protein Bar and Creatine (Cash)
            $posOrder2 = PosOrder::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'order_number' => 'POS-2026-0002',
                'customer_name' => 'Kunal Joshi (Walk-in)',
                'customer_phone' => '9820055443',
                'subtotal' => 1699.00, // 1099 + 600
                'discount_amount' => 0,
                'tax_amount' => 270.00,
                'total_amount' => 1969.00,
                'paid_amount' => 1969.00,
                'balance_due' => 0.00,
                'payment_method' => 'cash',
                'payment_status' => 'paid',
                'status' => 'completed',
                'order_date' => now()->toDateString(),
                'notes' => 'Walk-in cash counter sale',
                'billed_by_user_id' => $reception->id,
            ]);

            $stockCrea_Main->decrement('quantity', 1);
            $stockBars_Main->decrement('quantity', 1);

            PosOrderItem::create([
                'gym_id' => $gym->id,
                'pos_order_id' => $posOrder2->id,
                'product_id' => $prodMBCreatine->id,
                'product_batch_id' => $batchCrea1->id,
                'quantity' => 1,
                'unit_cost_at_sale' => 750.00,
                'unit_price' => 1099.00,
                'discount_amount' => 0,
                'tax_percent' => 18.00,
                'tax_amount' => 198.00,
                'total_amount' => 1297.00,
            ]);

            PosOrderItem::create([
                'gym_id' => $gym->id,
                'pos_order_id' => $posOrder2->id,
                'product_id' => $prodProteinBar->id,
                'product_batch_id' => $batchBarsExpiring->id,
                'quantity' => 1,
                'unit_cost_at_sale' => 420.00,
                'unit_price' => 600.00,
                'discount_amount' => 0,
                'tax_percent' => 12.00,
                'tax_amount' => 72.00,
                'total_amount' => 672.00,
            ]);

            // 9. Stock Adjustment: 1 Shaker damaged in transit write-off
            $stockShaker_Main->decrement('quantity', 1);
            InventoryMovement::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'product_id' => $prodShaker->id,
                'type' => 'damaged',
                'reference_type' => 'stock_adjustment',
                'quantity_change' => -1,
                'quantity_before' => 19,
                'quantity_after' => 18,
                'unit_cost' => 380.00,
                'total_cost' => 380.00,
                'notes' => 'Cracked lid during delivery unboxing write-off',
                'user_id' => $owner->id,
            ]);

            // =========================================================================
            // PROMPT 04: BUSINESS INTELLIGENCE, AUTOMATION & PREMIUM UX SEEDING
            // =========================================================================

            // 1. Action Items (Action Center triage tasks)
            ActionItem::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'type' => 'expiring_membership',
                'severity' => 'critical',
                'title' => 'Priya Nair: Annual Plan Expiring in 4 Days',
                'description' => 'Member Priya Nair is set to expire on ' . now()->addDays(4)->toDateString() . '. Trigger renewal alert or call.',
                'reference_type' => 'member',
                'reference_id' => $member1 ? $member1->id : 1,
                'assigned_to_user_id' => $reception->id,
                'status' => 'pending',
                'due_date' => now()->addDays(2)->toDateString(),
            ]);

            ActionItem::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'type' => 'overdue_payment',
                'severity' => 'critical',
                'title' => 'Follow up on Unsettled Balance',
                'description' => 'Outstanding dues on POS Supplement order #POS-2026-0001.',
                'reference_type' => 'pos_order',
                'reference_id' => $posOrder1->id,
                'assigned_to_user_id' => $reception->id,
                'status' => 'in_progress',
                'due_date' => now()->toDateString(),
            ]);

            ActionItem::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'type' => 'low_stock',
                'severity' => 'warning',
                'title' => 'Reorder C4 Original Pre-Workout',
                'description' => 'Branch stock at 8 units approaching reorder threshold of 5 units.',
                'reference_type' => 'product',
                'reference_id' => $prodC4->id,
                'status' => 'pending',
                'due_date' => now()->addDays(3)->toDateString(),
            ]);

            ActionItem::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'type' => 'uncontacted_lead',
                'severity' => 'warning',
                'title' => 'Meera Sengupta: New Lead Follow-up',
                'description' => 'Walk-in enquiry received yesterday. Schedule free fitness assessment.',
                'reference_type' => 'lead',
                'reference_id' => $lead2->id,
                'assigned_to_user_id' => $reception->id,
                'status' => 'pending',
                'due_date' => now()->toDateString(),
            ]);

            // 2. WhatsApp Business Templates & Delivery Logs
            $waDefaults = WhatsAppService::defaultTemplates();
            foreach ($waDefaults as $cat => $tmpl) {
                WhatsAppTemplate::create([
                    'gym_id' => $gym->id,
                    'template_name' => $tmpl['name'],
                    'category' => $cat,
                    'language' => 'en',
                    'body_text' => $tmpl['body'],
                    'variables' => $tmpl['variables'],
                    'is_approved' => true,
                    'status' => 'approved',
                ]);
            }

            WhatsAppLog::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'recipient_phone' => '919811122233',
                'recipient_name' => 'Rahul Sharma',
                'category' => 'payment_receipt',
                'message_body' => "Receipt #POS-2026-0001 from {$gym->name}: Received ₹8260.00 from Rahul Sharma via UPI. Remaining account balance: ₹0.00. Thank you for choosing us!",
                'status' => 'delivered',
                'provider_message_id' => 'wamid.HBgMOTE5ODExMTIyMjMzFQIAERgSMzExODQzNTU0OEFCNTZFOQA=',
                'sent_at' => now()->subHours(5),
                'delivered_at' => now()->subHours(5)->addSeconds(2),
                'read_at' => now()->subHours(4),
            ]);

            WhatsAppLog::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'recipient_phone' => '919822233344',
                'recipient_name' => 'Priya Nair',
                'category' => 'renewal_reminder',
                'message_body' => "Hi Priya Nair, your membership at {$gym->name} expires in 4 days on " . now()->addDays(4)->toDateString() . ". Renew today at reception or via your member portal to keep your fitness momentum going!",
                'status' => 'sent',
                'provider_message_id' => 'wamid.HBgMOTE5ODIyMjMzMzQ0FQIAERgSNDEyOTU2Nzg5QkNERjAxBQA=',
                'sent_at' => now()->subHour(),
                'delivered_at' => now()->subHour()->addSeconds(3),
            ]);

            // 3. Support Tickets (Separated Gym-Member and SaaS Platform Support)
            $ticket1 = SupportTicket::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'ticket_number' => 'TKT-2026-0001',
                'scope' => 'gym_member',
                'member_id' => $member1 ? $member1->id : 1,
                'category' => 'locker',
                'priority' => 'medium',
                'subject' => 'Locker #42 digital lock keypad glitch',
                'description' => 'The digital lock on Locker #42 in the male changing room fails to engage after inputting pin.',
                'status' => 'open',
                'assigned_to_user_id' => $reception->id,
                'created_by_user_id' => $reception->id,
            ]);

            SupportTicketMessage::create([
                'support_ticket_id' => $ticket1->id,
                'user_id' => $reception->id,
                'message' => 'Locker #42 digital lock keypad glitch reported by member.',
            ]);

            $ticket2 = SupportTicket::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'ticket_number' => 'TKT-2026-0002',
                'scope' => 'gym_member',
                'member_id' => $member1 ? $member1->id : 1,
                'category' => 'cleanliness',
                'priority' => 'low',
                'subject' => 'Steam room aromatherapy fragrance refill',
                'description' => 'Request to refill the eucalyptus oil diffuser in the executive steam lounge.',
                'status' => 'resolved',
                'assigned_to_user_id' => $reception->id,
                'created_by_user_id' => $reception->id,
                'resolution_notes' => 'Aromatherapy reservoir refilled by housekeeping staff.',
                'resolved_at' => now()->subDay(),
            ]);

            // SaaS Platform support ticket from Gym Owner to Super Admin
            $superAdminUser = User::where('role', User::ROLE_SUPER_ADMIN)->first();
            $saasTicket = SupportTicket::create([
                'gym_id' => $gym->id,
                'branch_id' => $branchMain->id,
                'ticket_number' => 'SAAS-TKT-2026-0001',
                'scope' => 'saas_platform',
                'category' => 'saas_feature',
                'priority' => 'high',
                'subject' => 'Request Meta WhatsApp Business Official Green Badge Verification Assistance',
                'description' => 'We are scaling to 3 branches and request platform architectural guidance on registering our Meta OBO (On-Behalf-Of) WABA account.',
                'status' => 'in_progress',
                'created_by_user_id' => $owner->id,
            ]);

            SupportTicketMessage::create([
                'support_ticket_id' => $saasTicket->id,
                'user_id' => $owner->id,
                'message' => 'We are scaling to 3 branches and request guidance on our Meta WABA account.',
            ]);

            SupportTicketMessage::create([
                'support_ticket_id' => $saasTicket->id,
                'user_id' => $superAdminUser ? $superAdminUser->id : $owner->id,
                'message' => 'Hello Vikram! Our SaaS API integration supports Meta Cloud API v19 direct webhooks. Please prepare your verified Facebook Business Manager ID.',
            ]);

            // 4. Member Workout Plans & Routines
            if ($member1) {
                MemberWorkoutPlan::create([
                    'gym_id' => $gym->id,
                    'member_id' => $member1->id,
                    'trainer_id' => $trainer->id,
                    'title' => 'Hypertrophy Strength Protocol (4-Day Split)',
                    'goal' => 'muscle_hypertrophy',
                    'difficulty' => 'intermediate',
                    'days_per_week' => 4,
                    'exercises' => [
                        [
                            'day' => 'Day 1: Chest & Triceps',
                            'items' => [
                                ['name' => 'Barbell Bench Press', 'sets' => 4, 'reps' => '8-10', 'rest' => '90s'],
                                ['name' => 'Incline Dumbbell Press', 'sets' => 3, 'reps' => '10-12', 'rest' => '60s'],
                                ['name' => 'Cable Pec Flyes', 'sets' => 3, 'reps' => '15', 'rest' => '45s'],
                                ['name' => 'Rope Triceps Pushdowns', 'sets' => 4, 'reps' => '12', 'rest' => '45s'],
                            ],
                        ],
                        [
                            'day' => 'Day 2: Back & Biceps',
                            'items' => [
                                ['name' => 'Deadlifts', 'sets' => 4, 'reps' => '6-8', 'rest' => '120s'],
                                ['name' => 'Lat Pulldowns', 'sets' => 4, 'reps' => '10-12', 'rest' => '60s'],
                                ['name' => 'Seated Cable Rows', 'sets' => 3, 'reps' => '12', 'rest' => '60s'],
                                ['name' => 'Incline Dumbbell Curls', 'sets' => 4, 'reps' => '12', 'rest' => '45s'],
                            ],
                        ],
                        [
                            'day' => 'Day 3: Shoulders & Abs',
                            'items' => [
                                ['name' => 'Overhead Barbell Press', 'sets' => 4, 'reps' => '8-10', 'rest' => '90s'],
                                ['name' => 'Dumbbell Lateral Raises', 'sets' => 4, 'reps' => '15', 'rest' => '45s'],
                                ['name' => 'Hanging Leg Raises', 'sets' => 3, 'reps' => '15', 'rest' => '45s'],
                            ],
                        ],
                        [
                            'day' => 'Day 4: Legs & Calves',
                            'items' => [
                                ['name' => 'Barbell Back Squats', 'sets' => 4, 'reps' => '8-10', 'rest' => '120s'],
                                ['name' => 'Romanian Deadlifts', 'sets' => 3, 'reps' => '10-12', 'rest' => '90s'],
                                ['name' => 'Leg Press', 'sets' => 4, 'reps' => '12', 'rest' => '60s'],
                                ['name' => 'Standing Calf Raises', 'sets' => 4, 'reps' => '15', 'rest' => '45s'],
                            ],
                        ],
                    ],
                    'notes' => 'Progressive overload focus. Drink 3.5L water daily and consume 140g protein.',
                    'start_date' => now()->subWeeks(2)->toDateString(),
                    'end_date' => now()->addMonths(2)->toDateString(),
                    'is_active' => true,
                ]);

                // 5. Member Progress Measurement Logs
                MemberProgressLog::create([
                    'gym_id' => $gym->id,
                    'member_id' => $member1->id,
                    'logged_by_user_id' => $trainer->id,
                    'log_date' => now()->subMonth()->toDateString(),
                    'weight_kg' => 78.50,
                    'body_fat_percent' => 18.2,
                    'chest_cm' => 102.0,
                    'waist_cm' => 86.0,
                    'arms_cm' => 36.5,
                    'notes' => 'Baseline fitness assessment. Goal: Lean bulk to 80kg at 15% body fat.',
                ]);

                MemberProgressLog::create([
                    'gym_id' => $gym->id,
                    'member_id' => $member1->id,
                    'logged_by_user_id' => $trainer->id,
                    'log_date' => now()->toDateString(),
                    'weight_kg' => 79.20,
                    'body_fat_percent' => 17.4,
                    'chest_cm' => 103.5,
                    'waist_cm' => 84.5,
                    'arms_cm' => 37.2,
                    'notes' => 'Noticeable muscle definition improvement in chest and delts. Waist down 1.5cm.',
                ]);
            }

            AuditLog::record('system.seeded', ['gym' => $gym->name]);
        });
    }
}
