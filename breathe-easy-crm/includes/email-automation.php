<?php
if ( ! defined( 'ABSPATH' ) ) exit;

/* ─── 1. New Lead: Admin Notification + Lead Auto-Reply ─────────────── */

add_action( 'be_crm_new_lead', 'be_crm_email_admin_new_lead', 10, 2 );
add_action( 'be_crm_new_lead', 'be_crm_email_autoreply_lead', 20, 2 );
add_action( 'be_crm_new_lead', 'be_crm_schedule_24hr_followup', 30, 2 );

function be_crm_email_admin_new_lead( int $lead_id, array $data ) : void {
    $opts = get_option( 'be_crm_settings', [] );
    if ( empty( $opts['notify_on_new'] ) ) return;

    $to      = $opts['admin_email'] ?? get_option( 'admin_email' );
    $subject = '🆕 New Lead: ' . ( $data['name'] ?? 'Unknown' );
    $body    = be_crm_build_admin_notification_email( $lead_id, $data );

    be_crm_send_html_email( $to, $subject, $body );
    be_crm_log_email( $to, $subject, 'admin_new_lead', $lead_id );
}

function be_crm_email_autoreply_lead( int $lead_id, array $data ) : void {
    $opts = get_option( 'be_crm_settings', [] );
    if ( empty( $opts['autoreply'] ) ) return;
    if ( empty( $data['email'] ) ) return;

    $name    = $data['name'] ?? 'there';
    $to      = sanitize_email( $data['email'] );
    $subject = 'Thanks for reaching out to Breathe Easy FL! 🌿';
    $body    = be_crm_build_autoreply_email( $name, $data );

    be_crm_send_html_email( $to, $subject, $body );
    be_crm_log_email( $to, $subject, 'autoreply', $lead_id );
}

function be_crm_schedule_24hr_followup( int $lead_id, array $data ) : void {
    // Schedule a reminder to admin if lead is still in "new-inquiry" after 24 hrs
    wp_schedule_single_event(
        time() + ( 24 * HOUR_IN_SECONDS ),
        'be_crm_followup_reminder',
        [ $lead_id ]
    );
}

/* ─── 2. Pipeline Stage Change Emails ────────────────────────────────── */

add_action( 'be_crm_lead_stage_changed', 'be_crm_email_on_stage_change', 10, 3 );

function be_crm_email_on_stage_change( int $lead_id, string $new_stage, string $old_stage ) : void {
    $lead = be_crm_get_lead( $lead_id );
    if ( ! $lead || empty( $lead['email'] ) ) return;

    $to = sanitize_email( $lead['email'] );

    switch ( $new_stage ) {
        case 'quoted':
            $subject = 'Your Quote from Breathe Easy FL is Ready!';
            $body    = be_crm_build_stage_email( $lead, 'quoted' );
            break;
        case 'booked':
            $subject = 'Booking Confirmed — Breathe Easy FL';
            $body    = be_crm_build_stage_email( $lead, 'booked' );
            break;
        case 'completed':
            $subject = 'Thank You! How was your cleaning? 🌟';
            $body    = be_crm_build_stage_email( $lead, 'completed' );
            break;
        default:
            return;
    }

    be_crm_send_html_email( $to, $subject, $body );
    be_crm_log_email( $to, $subject, 'stage_' . $new_stage, $lead_id );
}

/* ─── 3. 24-Hour Reminder (if no stage change) ───────────────────────── */

add_action( 'be_crm_followup_reminder', 'be_crm_send_followup_reminder' );

function be_crm_send_followup_reminder( int $lead_id ) : void {
    $lead = be_crm_get_lead( $lead_id );
    if ( ! $lead ) return;

    // Only remind if still in new-inquiry
    if ( $lead['stage'] !== 'new-inquiry' ) return;

    $opts    = get_option( 'be_crm_settings', [] );
    $to      = $opts['admin_email'] ?? get_option( 'admin_email' );
    $subject = '⏰ Follow Up: ' . $lead['name'] . ' hasn\'t been contacted yet';
    $body    = be_crm_build_followup_reminder_email( $lead );

    be_crm_send_html_email( $to, $subject, $body );
    be_crm_log_email( $to, $subject, 'followup_reminder', $lead_id );
}

/* ─── 4. Weekly Digest ───────────────────────────────────────────────── */

add_action( 'be_crm_weekly_digest', 'be_crm_send_weekly_digest' );

function be_crm_send_weekly_digest() : void {
    $opts  = get_option( 'be_crm_settings', [] );
    $to    = $opts['admin_email'] ?? get_option( 'admin_email' );
    $stats = be_crm_get_stats();

    $week_start = date( 'Y-m-d 00:00:00', strtotime( '-7 days' ) );
    $new_this_week = ( new WP_Query( [
        'post_type'      => 'be_lead',
        'post_status'    => 'publish',
        'posts_per_page' => -1,
        'fields'         => 'ids',
        'date_query'     => [ [ 'after' => $week_start, 'inclusive' => true ] ],
    ] ) )->found_posts;

    $subject = '📊 Weekly CRM Report — Breathe Easy FL';
    $body    = be_crm_build_weekly_digest_email( $stats, $new_this_week );

    be_crm_send_html_email( $to, $subject, $body );
    be_crm_log_email( $to, $subject, 'weekly_digest' );
}

/* ─── Email Builder: Admin New Lead Notification ─────────────────────── */

function be_crm_build_admin_notification_email( int $lead_id, array $data ) : string {
    $opts      = get_option( 'be_crm_settings', [] );
    $company   = $opts['company_name'] ?? 'Breathe Easy FL';
    $name      = esc_html( $data['name']     ?? 'N/A' );
    $email     = esc_html( $data['email']    ?? 'N/A' );
    $phone     = esc_html( $data['phone']    ?? 'N/A' );
    $service   = esc_html( $data['service']  ?? 'N/A' );
    $location  = esc_html( $data['location'] ?? 'N/A' );
    $message   = esc_html( $data['message']  ?? 'N/A' );
    $source    = esc_html( $data['source']   ?? 'Website Form' );
    $view_url  = admin_url( 'admin.php?page=be-leads&lead_id=' . $lead_id );

    return be_crm_email_wrap( "
        <h2 style='color:#1b5e38;margin-top:0'>🆕 New Lead Received</h2>
        <p style='color:#666;margin-top:0'>A new inquiry was just submitted on <strong>{$company}</strong>.</p>
        <table style='width:100%;border-collapse:collapse;'>
            " . be_crm_email_row( 'Name',     $name )    . "
            " . be_crm_email_row( 'Email',    "<a href='mailto:{$email}'>{$email}</a>" ) . "
            " . be_crm_email_row( 'Phone',    "<a href='tel:{$phone}'>{$phone}</a>" )    . "
            " . be_crm_email_row( 'Service',  $service )  . "
            " . be_crm_email_row( 'Location', $location ) . "
            " . be_crm_email_row( 'Source',   $source )   . "
        </table>
        <div style='background:#f5f7f5;border-left:4px solid #40916c;padding:12px 16px;margin:20px 0;border-radius:4px;'>
            <strong>Message:</strong><br>{$message}
        </div>
        <p style='text-align:center;margin-top:24px;'>
            <a href='{$view_url}' style='background:#1b5e38;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;'>
                View Lead in CRM
            </a>
        </p>
    ", 'New Lead Alert' );
}

/* ─── Email Builder: Auto-Reply to Lead ──────────────────────────────── */

function be_crm_build_autoreply_email( string $name, array $data ) : string {
    $opts    = get_option( 'be_crm_settings', [] );
    $company = $opts['company_name'] ?? 'Breathe Easy FL';
    $phone   = $opts['company_phone'] ?? '+1 (407) 801-1480';
    $service = esc_html( $data['service'] ?? 'cleaning service' );

    return be_crm_email_wrap( "
        <h2 style='color:#1b5e38;margin-top:0'>Thanks for reaching out, " . esc_html( $name ) . "! 🌿</h2>
        <p>We've received your inquiry about <strong>{$service}</strong> and we're excited to help you breathe easier!</p>
        <div style='background:#e8f5e9;border-radius:8px;padding:20px;margin:20px 0;'>
            <h3 style='color:#1b5e38;margin-top:0'>What happens next?</h3>
            <ol style='color:#333;padding-left:20px;'>
                <li style='margin-bottom:8px;'><strong>We'll review</strong> your request within 1–2 business hours</li>
                <li style='margin-bottom:8px;'><strong>We'll contact you</strong> to discuss your needs and provide a quote</li>
                <li style='margin-bottom:8px;'><strong>We'll schedule</strong> your cleaning at a time that works for you</li>
            </ol>
        </div>
        <p>In the meantime, if you have any questions feel free to call or email us directly:</p>
        <p style='text-align:center;'>
            <a href='tel:{$phone}' style='background:#1b5e38;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;margin:4px;'>
                📞 Call {$phone}
            </a>
            &nbsp;
            <a href='mailto:book@breatheeasyfl.com' style='background:#40916c;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;margin:4px;'>
                ✉️ Email Us
            </a>
        </p>
        <p style='color:#888;font-size:13px;margin-top:24px;border-top:1px solid #eee;padding-top:16px;'>
            We use 100% non-toxic, hospital-grade cleaning products — safe for kids, pets, and the whole family.
        </p>
    ", 'Thanks for Your Inquiry' );
}

/* ─── Email Builder: Stage Change Emails ─────────────────────────────── */

function be_crm_build_stage_email( array $lead, string $stage ) : string {
    $name  = esc_html( $lead['name'] );
    $phone = get_option( 'be_crm_settings', [] )['company_phone'] ?? '+1 (407) 801-1480';

    $content = match ( $stage ) {
        'quoted' => "
            <h2 style='color:#1b5e38;margin-top:0'>Your Quote is Ready, {$name}! 💚</h2>
            <p>Great news! We've reviewed your request and our team is ready to give you a personalized quote for your cleaning service.</p>
            <p>Please give us a call or reply to this email and we'll walk you through your options and pricing.</p>
            <p style='text-align:center;margin-top:24px;'>
                <a href='tel:{$phone}' style='background:#1b5e38;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;'>
                    📞 Call to Get Your Quote
                </a>
            </p>
        ",
        'booked' => "
            <h2 style='color:#1b5e38;margin-top:0'>Booking Confirmed! 🎉</h2>
            <p>Hi {$name}, your cleaning appointment with <strong>Breathe Easy FL</strong> is confirmed!</p>
            <div style='background:#e8f5e9;border-radius:8px;padding:20px;margin:20px 0;'>
                <h3 style='color:#1b5e38;margin-top:0;'>What to expect:</h3>
                <ul style='color:#333;padding-left:20px;'>
                    <li style='margin-bottom:8px;'>Our team will arrive at the scheduled time</li>
                    <li style='margin-bottom:8px;'>We use only 100% non-toxic, hospital-grade products</li>
                    <li style='margin-bottom:8px;'>We'll do a walkthrough before and after the clean</li>
                </ul>
            </div>
            <p>Questions? Call us anytime at <a href='tel:{$phone}'>{$phone}</a></p>
        ",
        'completed' => "
            <h2 style='color:#1b5e38;margin-top:0'>How was your cleaning? 🌟</h2>
            <p>Hi {$name}, we hope your space is sparkling clean! We'd love to hear how we did.</p>
            <p>Your feedback helps us continue to provide the best service in Central Florida.</p>
            <p style='text-align:center;margin-top:24px;'>
                <a href='mailto:book@breatheeasyfl.com?subject=Review for Breathe Easy FL' style='background:#1b5e38;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;'>
                    ⭐ Leave a Review
                </a>
            </p>
            <p style='color:#666;margin-top:16px;'>Ready to schedule your next clean? Reply to this email or call us!</p>
        ",
        default => '',
    };

    return be_crm_email_wrap( $content, 'Update from Breathe Easy FL' );
}

/* ─── Email Builder: 24hr Follow-Up Reminder ─────────────────────────── */

function be_crm_build_followup_reminder_email( array $lead ) : string {
    $name     = esc_html( $lead['name'] );
    $email    = esc_html( $lead['email'] );
    $phone    = esc_html( $lead['phone'] );
    $service  = esc_html( $lead['service'] );
    $date     = esc_html( $lead['date'] );
    $view_url = admin_url( 'admin.php?page=be-leads&lead_id=' . $lead['id'] );

    return be_crm_email_wrap( "
        <h2 style='color:#e65100;margin-top:0'>⏰ Follow-Up Reminder</h2>
        <p><strong>{$name}</strong> submitted an inquiry <strong>24 hours ago</strong> and is still in <em>New Inquiry</em> stage.</p>
        <table style='width:100%;border-collapse:collapse;'>
            " . be_crm_email_row( 'Name',    $name )    . "
            " . be_crm_email_row( 'Email',   "<a href='mailto:{$email}'>{$email}</a>" ) . "
            " . be_crm_email_row( 'Phone',   "<a href='tel:{$phone}'>{$phone}</a>" )    . "
            " . be_crm_email_row( 'Service', $service ) . "
            " . be_crm_email_row( 'Date',    $date )    . "
        </table>
        <p style='text-align:center;margin-top:24px;'>
            <a href='{$view_url}' style='background:#e65100;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;'>
                Follow Up Now
            </a>
        </p>
    ", '24-Hour Follow-Up Reminder' );
}

/* ─── Email Builder: Weekly Digest ───────────────────────────────────── */

function be_crm_build_weekly_digest_email( array $stats, int $new_this_week ) : string {
    $pipeline = be_crm_get_pipeline_counts();
    $rows = '';
    foreach ( $pipeline as $stage ) {
        $rows .= "<tr>
            <td style='padding:8px 12px;border-bottom:1px solid #eee;'>
                <span style='display:inline-block;width:10px;height:10px;border-radius:50%;background:{$stage['color']};margin-right:6px;'></span>
                {$stage['name']}
            </td>
            <td style='padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600;'>{$stage['count']}</td>
        </tr>";
    }

    return be_crm_email_wrap( "
        <h2 style='color:#1b5e38;margin-top:0'>📊 Weekly CRM Summary</h2>
        <p style='color:#666;'>Week ending " . date( 'F j, Y' ) . "</p>

        <div style='display:flex;gap:12px;margin:20px 0;flex-wrap:wrap;'>
            " . be_crm_digest_stat_card( 'New This Week', $new_this_week, '#3b82f6' ) . "
            " . be_crm_digest_stat_card( 'Active Pipeline', $stats['active_pipeline'], '#8b5cf6' ) . "
            " . be_crm_digest_stat_card( 'Booked (Month)', $stats['booked'], '#10b981' ) . "
            " . be_crm_digest_stat_card( 'Total Contacts', $stats['total_contacts'], '#1b5e38' ) . "
        </div>

        <h3 style='color:#333;'>Pipeline Breakdown</h3>
        <table style='width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:8px;overflow:hidden;'>
            <tr style='background:#f5f7f5;'>
                <th style='padding:10px 12px;text-align:left;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.5px;'>Stage</th>
                <th style='padding:10px 12px;text-align:right;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.5px;'>Count</th>
            </tr>
            {$rows}
        </table>

        <p style='text-align:center;margin-top:24px;'>
            <a href='" . admin_url( 'admin.php?page=be-crm' ) . "' style='background:#1b5e38;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;'>
                Open CRM Dashboard
            </a>
        </p>
    ", 'Weekly CRM Report' );
}

/* ─── Shared Email Utilities ─────────────────────────────────────────── */

function be_crm_email_wrap( string $content, string $preheader = '' ) : string {
    $company = get_option( 'be_crm_settings', [] )['company_name'] ?? 'Breathe Easy FL';
    return "<!DOCTYPE html>
<html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'>
<style>body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f0f4f1;color:#333;}
a{color:#1b5e38;}</style></head>
<body style='margin:0;padding:20px 0;background:#f0f4f1;'>
<div style='max-width:600px;margin:0 auto;'>
  <div style='background:#1b5e38;padding:24px 32px;border-radius:12px 12px 0 0;text-align:center;'>
    <h1 style='color:#fff;margin:0;font-size:22px;letter-spacing:-0.5px;'>{$company}</h1>
    <p style='color:#a5d6a7;margin:4px 0 0;font-size:13px;'>Non-Toxic Cleaning • Central Florida</p>
  </div>
  <div style='background:#fff;padding:32px;border-radius:0 0 12px 12px;'>
    {$content}
    <div style='border-top:1px solid #eee;margin-top:32px;padding-top:20px;text-align:center;'>
      <p style='color:#aaa;font-size:12px;margin:0;'>{$company} • Orlando, FL • <a href='mailto:book@breatheeasyfl.com' style='color:#aaa;'>book@breatheeasyfl.com</a></p>
      <p style='color:#aaa;font-size:11px;margin:4px 0 0;'>© " . date( 'Y' ) . " {$company}. All rights reserved.</p>
    </div>
  </div>
</div>
</body></html>";
}

function be_crm_email_row( string $label, string $value ) : string {
    return "<tr>
        <td style='padding:8px 12px;border-bottom:1px solid #f5f5f5;font-weight:600;color:#555;width:120px;'>{$label}</td>
        <td style='padding:8px 12px;border-bottom:1px solid #f5f5f5;color:#333;'>{$value}</td>
    </tr>";
}

function be_crm_digest_stat_card( string $label, int $value, string $color ) : string {
    return "<div style='flex:1;min-width:120px;background:{$color};color:#fff;padding:16px;border-radius:8px;text-align:center;'>
        <div style='font-size:28px;font-weight:700;'>{$value}</div>
        <div style='font-size:12px;opacity:.85;margin-top:2px;'>{$label}</div>
    </div>";
}

function be_crm_send_html_email( string $to, string $subject, string $body ) : bool {
    return wp_mail( $to, $subject, $body, [
        'Content-Type: text/html; charset=UTF-8',
        'From: Breathe Easy FL <book@breatheeasyfl.com>',
        'Reply-To: book@breatheeasyfl.com',
    ] );
}
