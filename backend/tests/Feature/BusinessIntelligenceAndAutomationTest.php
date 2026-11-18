<?php

namespace Tests\Feature;

use App\Models\ActionItem;
use App\Models\Branch;
use App\Models\Expense;
use App\Models\Gym;
use App\Models\Member;
use App\Models\MemberMembership;
use App\Models\MembershipPlan;
use App\Models\Payment;
use App\Models\PosOrder;
use App\Models\Product;
use App\Models\PtSession;
use App\Models\SaasPlan;
use App\Models\SupportTicket;
use App\Models\User;
use App\Models\WhatsAppLog;
use App\Models\WhatsAppTemplate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BusinessIntelligenceAndAutomationTest extends TestCase
{
    use RefreshDatabase;

    protected Gym $gym;
    protected Branch $branch;
    protected User $owner;
    protected User $trainer;
    protected Member $member;
    protected string $token;

    protected function setUp(): void
    {
        parent::setUp();

        $plan = SaasPlan::create([
            'name' => 'Enterprise Plan',
            'code' => 'enterprise',
            'price' => 9999.00,
            'interval' => 'month',
            'branch_limit' => 10,
            'member_limit' => 5000,
            'is_active' => true,
        ]);

        $this->gym = Gym::create([
            'name' => 'Titan Athletics',
            'slug' => 'titanathletics',
            'email' => 'owner@titanathletics.in',
            'phone' => '9810011223',
            'status' => Gym::STATUS_ACTIVE,
            'saas_plan_id' => $plan->id,
            'subscription_expires_at' => now()->addDays(90),
        ]);

        $this->branch = Branch::create([
            'gym_id' => $this->gym->id,
            'name' => 'Titan Downtown',
            'code' => 'TD01',
            'is_main' => true,
            'is_active' => true,
        ]);

        $this->owner = User::create([
            'gym_id' => $this->gym->id,
            'name' => 'Titan Owner Sameer',
            'email' => 'sameer@titanathletics.in',
            'password' => bcrypt('password123'),
            'role' => User::ROLE_GYM_OWNER,
            'is_active' => true,
        ]);

        $this->trainer = User::create([
            'gym_id' => $this->gym->id,
            'primary_branch_id' => $this->branch->id,
            'name' => 'Coach Kabir',
            'email' => 'kabir@titanathletics.in',
            'password' => bcrypt('password123'),
            'role' => User::ROLE_TRAINER,
            'specialization' => 'Powerlifting & Hypertrophy',
            'base_salary' => 25000.00,
            'pt_session_rate' => 500.00,
            'commission_percent' => 15.00,
            'is_active' => true,
        ]);

        $this->member = Member::create([
            'gym_id' => $this->gym->id,
            'primary_branch_id' => $this->branch->id,
            'assigned_trainer_id' => $this->trainer->id,
            'member_code' => 'TITAN-001',
            'first_name' => 'Rohan',
            'last_name' => 'Mehra',
            'phone' => '9899001122',
            'email' => 'rohan@gmail.com',
            'status' => 'active',
            'joined_date' => now()->subMonth()->toDateString(),
        ]);

        $this->token = $this->owner->createToken('test-token')->plainTextToken;
    }

    protected function authHeaders(int $branchId = null): array
    {
        return [
            'Authorization' => "Bearer {$this->token}",
            'X-Gym-Id' => (string) $this->gym->id,
            'X-Branch-Id' => (string) ($branchId ?: $this->branch->id),
            'Accept' => 'application/json',
        ];
    }

    public function test_owner_dashboard_returns_real_time_business_kpis_and_operating_profit(): void
    {
        // 1. Record a fee payment: 15,000
        Payment::create([
            'gym_id' => $this->gym->id,
            'branch_id' => $this->branch->id,
            'member_id' => $this->member->id,
            'receipt_number' => 'REC-2026-0001',
            'type' => 'payment',
            'amount' => 15000.00,
            'payment_method' => 'upi',
            'payment_date' => now()->toDateString(),
            'status' => 'completed',
        ]);

        // 2. Record an expense: 5,000
        Expense::create([
            'gym_id' => $this->gym->id,
            'branch_id' => $this->branch->id,
            'title' => 'Electricity Bill',
            'category' => 'electricity',
            'amount' => 5000.00,
            'expense_date' => now()->toDateString(),
            'payment_mode' => 'bank_transfer',
        ]);

        // Operating Profit should be (15000 - 5000) = 10,000
        $response = $this->getJson('/api/owner-dashboard?period=this_month', $this->authHeaders());

        $response->assertStatus(200)
            ->assertJsonPath('executive_kpis.active_members', 1);
        $this->assertEquals(15000.00, (float) $response->json('executive_kpis.membership_collections'));
        $this->assertEquals(5000.00, (float) $response->json('executive_kpis.total_expenses'));
        $this->assertEquals(10000.00, (float) $response->json('executive_kpis.operating_profit'));
    }

    public function test_action_center_returns_triage_radar_and_allows_staff_assignment_and_resolution(): void
    {
        // 1. Create a member with outstanding dues to trigger overdue triage
        $this->member->update(['outstanding_balance' => 2500.00]);

        $radarRes = $this->getJson('/api/action-center', $this->authHeaders());
        $radarRes->assertStatus(200);
        $this->assertGreaterThanOrEqual(1, $radarRes->json('radar.overdue_payments'));

        // 2. Log an action item
        $createRes = $this->postJson('/api/action-center', [
            'type' => 'overdue_payment',
            'severity' => 'critical',
            'title' => 'Collect 2500 dues from Rohan Mehra',
            'reference_type' => 'member',
            'reference_id' => $this->member->id,
            'assigned_to_user_id' => $this->trainer->id,
        ], $this->authHeaders());

        $createRes->assertStatus(201);
        $itemId = $createRes->json('item.id');

        // 3. Resolve the action item with notes
        $resolveRes = $this->postJson("/api/action-center/{$itemId}/resolve", [
            'resolution_notes' => 'Member paid remaining fee balance via reception UPI.',
        ], $this->authHeaders());

        $resolveRes->assertStatus(200)
            ->assertJsonPath('item.status', 'resolved')
            ->assertJsonPath('item.resolution_notes', 'Member paid remaining fee balance via reception UPI.');
    }

    public function test_whatsapp_automation_manages_templates_and_logs_dispatches(): void
    {
        // 1. Fetch templates (auto-seeds default templates)
        $tmplRes = $this->getJson('/api/whatsapp/templates', $this->authHeaders());
        $tmplRes->assertStatus(200)
            ->assertJsonCount(7, 'templates');

        $templateId = $tmplRes->json('templates.0.id');

        // 2. Update template text
        $updateRes = $this->putJson("/api/whatsapp/templates/{$templateId}", [
            'body_text' => 'Customized Gym Welcome: Hi {member_name}, welcome to {gym_name}! Your ID is {member_code}.',
        ], $this->authHeaders());

        $updateRes->assertStatus(200);

        // 3. Dispatch automated WhatsApp notification
        $sendRes = $this->postJson('/api/whatsapp/send', [
            'category' => 'welcome',
            'recipient_phone' => '9899001122',
            'recipient_name' => 'Rohan Mehra',
            'variables' => [
                'member_name' => 'Rohan Mehra',
                'member_code' => 'TITAN-001',
            ],
        ], $this->authHeaders());

        $sendRes->assertStatus(201)
            ->assertJsonPath('log.category', 'welcome')
            ->assertJsonPath('log.status', 'sent');

        // 4. Verify in delivery logs
        $logsRes = $this->getJson('/api/whatsapp/logs', $this->authHeaders());
        $logsRes->assertStatus(200);
        $this->assertGreaterThanOrEqual(1, $logsRes->json('summary.total_messages'));
    }

    public function test_ai_advisor_provides_data_backed_insights_and_answers(): void
    {
        // 1. Get computed insights
        $insightsRes = $this->getJson('/api/ai-advisor/insights', $this->authHeaders());
        $insightsRes->assertStatus(200)
            ->assertJsonStructure([
                'ai_enabled',
                'ai_engine',
                'status_label',
                'insights' => [
                    'revenue_analysis',
                    'plan_rankings',
                    'churn_risk',
                    'high_margin_products',
                    'branch_rankings',
                    'expense_anomalies',
                    'weekly_focus_recommendations',
                ]
            ]);

        // 2. Ask question on revenue
        $askRes = $this->postJson('/api/ai-advisor/ask', [
            'question' => 'Why did revenue change this month?',
        ], $this->authHeaders());

        $askRes->assertStatus(200)
            ->assertJsonPath('structured_answers.topic', 'Revenue Variance Analysis');
    }

    public function test_member_portal_returns_profile_card_and_accepts_renewal_request(): void
    {
        // 1. View member profile & card
        $profileRes = $this->getJson("/api/member-portal/profile?member_id={$this->member->id}", $this->authHeaders());
        $profileRes->assertStatus(200)
            ->assertJsonPath('card.member_code', 'TITAN-001')
            ->assertJsonPath('card.full_name', 'Rohan Mehra');

        // 2. Create a membership plan for renewal test
        $plan = MembershipPlan::create([
            'gym_id' => $this->gym->id,
            'name' => 'Annual Beast Pass',
            'code' => 'ABP-12',
            'duration_days' => 365,
            'price' => 20000.00,
        ]);

        // 3. Member submits online renewal request
        $renewRes = $this->postJson('/api/member-portal/renew-request', [
            'member_id' => $this->member->id,
            'membership_plan_id' => $plan->id,
        ], $this->authHeaders());

        $renewRes->assertStatus(200);

        // Verify action item logged for reception staff
        $this->assertDatabaseHas('action_items', [
            'gym_id' => $this->gym->id,
            'type' => 'expiring_membership',
            'reference_id' => $this->member->id,
        ]);
    }

    public function test_trainer_portal_manages_members_and_completes_sessions(): void
    {
        // 1. Trainer dashboard
        $trainerHeaders = [
            'Authorization' => "Bearer {$this->trainer->createToken('trainer-token')->plainTextToken}",
            'X-Gym-Id' => (string) $this->gym->id,
            'X-Branch-Id' => (string) $this->branch->id,
            'Accept' => 'application/json',
        ];

        $dashRes = $this->getJson('/api/trainer-portal/dashboard', $trainerHeaders);
        $dashRes->assertStatus(200)
            ->assertJsonPath('trainer.name', 'Coach Kabir')
            ->assertJsonPath('metrics.assigned_members_count', 1);

        // 2. Assign workout plan to member
        $workoutRes = $this->postJson('/api/trainer-portal/assign-workout', [
            'member_id' => $this->member->id,
            'title' => 'Titan Chest & Delts Specialization',
            'goal' => 'muscle_hypertrophy',
            'difficulty' => 'intermediate',
            'days_per_week' => 4,
            'exercises' => [
                ['day' => 'Day 1', 'items' => [['name' => 'Incline Bench Press', 'sets' => 4, 'reps' => '8-10']]]
            ],
        ], $trainerHeaders);

        $workoutRes->assertStatus(201)
            ->assertJsonPath('workout_plan.title', 'Titan Chest & Delts Specialization');

        // 3. Log member physical measurements
        $progressRes = $this->postJson('/api/trainer-portal/log-progress', [
            'member_id' => $this->member->id,
            'weight_kg' => 81.5,
            'body_fat_percent' => 16.5,
            'chest_cm' => 105.0,
            'notes' => 'Gained 2kg lean muscle mass.',
        ], $trainerHeaders);

        $progressRes->assertStatus(201);
    }

    public function test_support_management_separates_gym_member_and_saas_platform_tickets(): void
    {
        // 1. Gym Member Ticket
        $memTicketRes = $this->postJson('/api/support-tickets', [
            'scope' => 'gym_member',
            'category' => 'locker',
            'priority' => 'medium',
            'subject' => 'Locker #15 jammed',
            'description' => 'Key stuck in keyhole.',
            'member_id' => $this->member->id,
        ], $this->authHeaders());

        $memTicketRes->assertStatus(201)
            ->assertJsonPath('ticket.scope', 'gym_member');

        $ticketId = $memTicketRes->json('ticket.id');

        // 2. Add message to thread
        $msgRes = $this->postJson("/api/support-tickets/{$ticketId}/messages", [
            'message' => 'Technician dispatched to male changing room.',
            'is_internal_note' => false,
        ], $this->authHeaders());

        $msgRes->assertStatus(201);

        // 3. SaaS Platform Ticket from Gym Owner
        $saasTicketRes = $this->postJson('/api/support-tickets', [
            'scope' => 'saas_platform',
            'category' => 'saas_billing',
            'priority' => 'high',
            'subject' => 'Invoice GSTIN Update Request',
            'description' => 'Please update our company legal name on subscription invoices.',
        ], $this->authHeaders());

        $saasTicketRes->assertStatus(201)
            ->assertJsonPath('ticket.scope', 'saas_platform');

        // 4. Verify scope separation in list queries
        $listMember = $this->getJson('/api/support-tickets?scope=gym_member', $this->authHeaders());
        $listMember->assertStatus(200);
        $this->assertEquals(1, $listMember->json('counts.open'));

        $listSaas = $this->getJson('/api/support-tickets?scope=saas_platform', $this->authHeaders());
        $listSaas->assertStatus(200);
        $this->assertEquals(1, $listSaas->json('counts.open'));
    }

    public function test_multi_tenant_isolation_gym_b_cannot_see_gym_a_action_items_or_tickets(): void
    {
        // Ticket in Gym A
        $ticketA = SupportTicket::create([
            'gym_id' => $this->gym->id,
            'branch_id' => $this->branch->id,
            'ticket_number' => 'TKT-TITAN-001',
            'scope' => 'gym_member',
            'category' => 'general',
            'subject' => 'Gym A Secret Issue',
            'description' => 'Confidential feedback',
        ]);

        // Create Gym B and User B
        $gymB = Gym::create([
            'name' => 'Rival Studio',
            'slug' => 'rivalstudio',
            'status' => Gym::STATUS_ACTIVE,
        ]);

        $branchB = Branch::create([
            'gym_id' => $gymB->id,
            'name' => 'Rival Main',
            'code' => 'RS01',
            'is_main' => true,
            'is_active' => true,
        ]);

        $ownerB = User::create([
            'gym_id' => $gymB->id,
            'name' => 'Owner B',
            'email' => 'ownerb@rivalstudio.in',
            'password' => bcrypt('password123'),
            'role' => User::ROLE_GYM_OWNER,
            'is_active' => true,
        ]);

        $tokenB = $ownerB->createToken('token-b')->plainTextToken;

        $headersB = [
            'Authorization' => "Bearer {$tokenB}",
            'X-Gym-Id' => (string) $gymB->id,
            'X-Branch-Id' => (string) $branchB->id,
            'Accept' => 'application/json',
        ];

        // Gym B accessing Gym A's ticket directly must return 404
        $response = $this->getJson("/api/support-tickets/{$ticketA->id}", $headersB);
        $response->assertStatus(404);

        // Gym B list must not contain Gym A's ticket
        $listRes = $this->getJson('/api/support-tickets?scope=gym_member', $headersB);
        $listRes->assertStatus(200);
        $subjects = collect($listRes->json('tickets.data'))->pluck('subject');
        $this->assertFalse($subjects->contains('Gym A Secret Issue'));
    }
}
