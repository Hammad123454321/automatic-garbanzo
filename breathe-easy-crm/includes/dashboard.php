<?php
if ( ! defined( 'ABSPATH' ) ) exit;

/* ─── Register Admin Menu ────────────────────────────────────────────── */

add_action( 'admin_menu', 'be_crm_register_admin_pages' );

function be_crm_register_admin_pages() {
    $cap = current_user_can( 'manage_options' ) ? 'manage_options' : 'edit_posts';

    add_menu_page(
        'Breathe Easy CRM',
        'CRM Portal',
        'edit_posts',
        'be-crm',
        'be_crm_page_dashboard',
        'data:image/svg+xml;base64,' . base64_encode( '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg>' ),
        3
    );

    add_submenu_page( 'be-crm', 'Dashboard',   'Dashboard',   'edit_posts', 'be-crm',       'be_crm_page_dashboard' );
    add_submenu_page( 'be-crm', 'All Leads',   'All Leads',   'edit_posts', 'be-leads',     'be_crm_page_leads' );
    add_submenu_page( 'be-crm', 'Pipeline',    'Pipeline',    'edit_posts', 'be-pipeline',  'be_crm_page_pipeline' );
    add_submenu_page( 'be-crm', 'Contacts',    'Contacts',    'edit_posts', 'be-contacts',  'be_crm_page_contacts' );
    add_submenu_page( 'be-crm', 'Email Logs',  'Email Logs',  'edit_posts', 'be-email-logs','be_crm_page_email_logs' );
    add_submenu_page( 'be-crm', 'CRM Settings','Settings',    'manage_options', 'be-settings','be_crm_page_settings' );
}

/* ─── Enqueue Dashboard Assets ───────────────────────────────────────── */

add_action( 'admin_enqueue_scripts', 'be_crm_enqueue_assets' );

function be_crm_enqueue_assets( string $hook ) : void {
    $crm_pages = [ 'toplevel_page_be-crm', 'crm-portal_page_be-leads', 'crm-portal_page_be-pipeline',
                   'crm-portal_page_be-contacts', 'crm-portal_page_be-email-logs', 'crm-portal_page_be-settings' ];

    if ( ! in_array( $hook, $crm_pages, true ) ) return;

    wp_enqueue_style(  'be-crm-css', BE_CRM_URL . 'assets/css/crm-admin.css', [], BE_CRM_VER );
    wp_enqueue_script( 'chart-js',   'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js', [], null, true );
    wp_enqueue_script( 'be-crm-js',  BE_CRM_URL . 'assets/js/crm-dashboard.js', [ 'jquery', 'chart-js' ], BE_CRM_VER, true );

    wp_localize_script( 'be-crm-js', 'beCRM', [
        'ajaxUrl'  => admin_url( 'admin-ajax.php' ),
        'nonce'    => wp_create_nonce( 'be_crm_nonce' ),
        'adminUrl' => admin_url( 'admin.php' ),
        'stats'    => be_crm_get_stats(),
        'pipeline' => be_crm_get_pipeline_counts(),
    ] );
}

/* ─── Shared page wrapper ────────────────────────────────────────────── */

function be_crm_render_page( string $page_title, string $content, string $active = 'be-crm' ) : void {
    $user      = wp_get_current_user();
    $initials  = strtoupper( substr( $user->display_name, 0, 1 ) );
    $is_super  = current_user_can( 'manage_options' );
    $stats     = be_crm_get_stats();
    $nav_items = [
        [ 'slug' => 'be-crm',        'label' => 'Dashboard',  'icon' => 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z' ],
        [ 'slug' => 'be-leads',      'label' => 'All Leads',  'icon' => 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z' ],
        [ 'slug' => 'be-pipeline',   'label' => 'Pipeline',   'icon' => 'M4 11h5V5H4v6zm0 7h5v-6H4v6zm6 0h5v-6h-5v6zm6 0h5v-6h-5v6zm-6-7h5V5h-5v6zm6-6v6h5V5h-5z' ],
        [ 'slug' => 'be-contacts',   'label' => 'Contacts',   'icon' => 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z' ],
        [ 'slug' => 'be-email-logs', 'label' => 'Email Logs', 'icon' => 'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z' ],
    ];
    ?>
    <div class="be-crm-app">

        <!-- Sidebar -->
        <aside class="be-sidebar">
            <div class="be-logo">
                <div class="be-logo-icon">🌿</div>
                <div class="be-logo-text">
                    <strong>Breathe Easy</strong>
                    <span>CRM Portal</span>
                </div>
            </div>

            <nav class="be-nav">
                <?php foreach ( $nav_items as $item ) : ?>
                <a href="<?php echo esc_url( admin_url( 'admin.php?page=' . $item['slug'] ) ); ?>"
                   class="be-nav-item <?php echo $active === $item['slug'] ? 'active' : ''; ?>">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="<?php echo esc_attr( $item['icon'] ); ?>"/></svg>
                    <?php echo esc_html( $item['label'] ); ?>
                </a>
                <?php endforeach; ?>
                <?php if ( $is_super ) : ?>
                <div class="be-nav-divider"></div>
                <a href="<?php echo esc_url( admin_url( 'admin.php?page=be-settings' ) ); ?>"
                   class="be-nav-item <?php echo $active === 'be-settings' ? 'active' : ''; ?>">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>
                    Settings
                </a>
                <a href="<?php echo esc_url( admin_url() ); ?>" class="be-nav-item be-nav-wp">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                    WP Admin
                </a>
                <?php endif; ?>
            </nav>

            <div class="be-sidebar-footer">
                <div class="be-user-info">
                    <div class="be-avatar"><?php echo esc_html( $initials ); ?></div>
                    <div class="be-user-meta">
                        <strong><?php echo esc_html( $user->display_name ); ?></strong>
                        <span><?php echo $is_super ? 'Super Admin' : 'CRM Admin'; ?></span>
                    </div>
                </div>
                <a href="<?php echo esc_url( wp_logout_url( home_url() ) ); ?>" class="be-logout" title="Logout">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
                </a>
            </div>
        </aside>

        <!-- Main Content -->
        <main class="be-main">
            <header class="be-header">
                <div class="be-header-left">
                    <h1 class="be-page-title"><?php echo esc_html( $page_title ); ?></h1>
                    <span class="be-date"><?php echo date( 'l, F j, Y' ); ?></span>
                </div>
                <div class="be-header-right">
                    <button class="be-btn be-btn-primary" id="be-add-lead-btn">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                        Add Lead
                    </button>
                </div>
            </header>
            <div class="be-content">
                <?php echo $content; ?>
            </div>
        </main>

    </div>

    <?php be_crm_render_lead_modal(); ?>
    <?php
}

/* ─── Lead Modal (shared across all pages) ───────────────────────────── */

function be_crm_render_lead_modal() : void {
    $stages   = get_terms( [ 'taxonomy' => 'be_pipeline_stage', 'hide_empty' => false ] );
    $services = get_terms( [ 'taxonomy' => 'be_service_type',   'hide_empty' => false ] );
    ?>
    <div id="be-lead-modal" class="be-modal-overlay" style="display:none;">
        <div class="be-modal">
            <div class="be-modal-header">
                <h2 id="be-modal-title">Add New Lead</h2>
                <button class="be-modal-close" id="be-modal-close">&times;</button>
            </div>
            <form id="be-lead-form" class="be-modal-body">
                <input type="hidden" id="be-lead-id" name="lead_id" value="0">
                <div class="be-form-grid">
                    <div class="be-field">
                        <label>Full Name *</label>
                        <input type="text" name="name" id="be-f-name" required placeholder="Jane Smith">
                    </div>
                    <div class="be-field">
                        <label>Email Address</label>
                        <input type="email" name="email" id="be-f-email" placeholder="jane@example.com">
                    </div>
                    <div class="be-field">
                        <label>Phone Number</label>
                        <input type="tel" name="phone" id="be-f-phone" placeholder="+1 (407) 000-0000">
                    </div>
                    <div class="be-field">
                        <label>Location / City</label>
                        <input type="text" name="location" id="be-f-location" placeholder="Orlando, FL">
                    </div>
                    <div class="be-field">
                        <label>Service Type</label>
                        <select name="service" id="be-f-service">
                            <option value="">— Select Service —</option>
                            <?php foreach ( $services as $s ) : ?>
                            <option value="<?php echo esc_attr( $s->name ); ?>"><?php echo esc_html( $s->name ); ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="be-field">
                        <label>Pipeline Stage</label>
                        <select name="stage" id="be-f-stage">
                            <?php foreach ( $stages as $stage ) : ?>
                            <option value="<?php echo esc_attr( $stage->slug ); ?>"><?php echo esc_html( $stage->name ); ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="be-field">
                        <label>Priority</label>
                        <select name="priority" id="be-f-priority">
                            <option value="hot">🔥 Hot</option>
                            <option value="warm" selected>🟡 Warm</option>
                            <option value="cold">❄️ Cold</option>
                        </select>
                    </div>
                    <div class="be-field">
                        <label>Est. Value ($)</label>
                        <input type="number" name="value" id="be-f-value" placeholder="0.00">
                    </div>
                    <div class="be-field be-field-full">
                        <label>Message / Notes from Inquiry</label>
                        <textarea name="message" id="be-f-message" rows="3" placeholder="Customer's message..."></textarea>
                    </div>
                    <div class="be-field be-field-full">
                        <label>Internal Notes</label>
                        <textarea name="notes" id="be-f-notes" rows="2" placeholder="Staff notes (not visible to client)..."></textarea>
                    </div>
                </div>
                <div class="be-modal-footer">
                    <button type="button" class="be-btn be-btn-secondary" id="be-modal-cancel">Cancel</button>
                    <button type="submit" class="be-btn be-btn-primary">Save Lead</button>
                </div>
            </form>
        </div>
    </div>
    <?php
}

/* ─── PAGE: Dashboard ────────────────────────────────────────────────── */

function be_crm_page_dashboard() : void {
    $stats    = be_crm_get_stats();
    $pipeline = be_crm_get_pipeline_counts();
    $leads    = be_crm_get_leads( [ 'posts_per_page' => 10 ] );

    ob_start();
    ?>
    <!-- Stats Cards -->
    <div class="be-stats-grid">
        <?php
        be_crm_stat_card( "Today's Leads",     $stats['today_leads'],    '#3b82f6', 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z' );
        be_crm_stat_card( 'Active Pipeline',   $stats['active_pipeline'],'#8b5cf6', 'M4 11h5V5H4v6zm0 7h5v-6H4v6zm6 0h5v-6h-5v6zm6 0h5v-6h-5v6zm-6-7h5V5h-5v6zm6-6v6h5V5h-5z' );
        be_crm_stat_card( 'Booked This Month', $stats['booked'],         '#10b981', 'M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z' );
        be_crm_stat_card( 'Total Contacts',    $stats['total_contacts'], '#1b5e38', 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z' );
        ?>
    </div>

    <!-- Pipeline Overview Bar -->
    <div class="be-card be-mt">
        <div class="be-card-header">
            <h2>Pipeline Overview</h2>
            <a href="<?php echo esc_url( admin_url( 'admin.php?page=be-pipeline' ) ); ?>" class="be-link">View Full Pipeline →</a>
        </div>
        <div class="be-pipeline-bar">
            <?php foreach ( $pipeline as $stage ) :
                $pct = $stats['total_leads'] > 0 ? round( ( $stage['count'] / $stats['total_leads'] ) * 100 ) : 0;
            ?>
            <div class="be-pipeline-stage">
                <div class="be-pipeline-dot" style="background:<?php echo esc_attr( $stage['color'] ); ?>"></div>
                <div class="be-pipeline-label"><?php echo esc_html( $stage['name'] ); ?></div>
                <div class="be-pipeline-count" style="color:<?php echo esc_attr( $stage['color'] ); ?>"><?php echo (int) $stage['count']; ?></div>
                <div class="be-pipeline-bar-track">
                    <div class="be-pipeline-bar-fill" style="width:<?php echo $pct; ?>%;background:<?php echo esc_attr( $stage['color'] ); ?>"></div>
                </div>
            </div>
            <?php endforeach; ?>
        </div>
    </div>

    <!-- Recent Leads -->
    <div class="be-card be-mt">
        <div class="be-card-header">
            <h2>Recent Leads</h2>
            <a href="<?php echo esc_url( admin_url( 'admin.php?page=be-leads' ) ); ?>" class="be-link">View All →</a>
        </div>
        <?php be_crm_render_leads_table( $leads ); ?>
    </div>

    <!-- Chart -->
    <div class="be-card be-mt">
        <div class="be-card-header"><h2>Pipeline Distribution</h2></div>
        <div class="be-chart-wrap">
            <canvas id="be-pipeline-chart" height="280"></canvas>
        </div>
    </div>
    <?php
    $content = ob_get_clean();
    be_crm_render_page( 'Dashboard', $content, 'be-crm' );
}

/* ─── PAGE: All Leads ─────────────────────────────────────────────────── */

function be_crm_page_leads() : void {
    $stage_filter = sanitize_key( $_GET['stage'] ?? '' );
    $search       = sanitize_text_field( $_GET['s'] ?? '' );

    $query_args = [];
    if ( $stage_filter ) {
        $query_args['tax_query'] = [ [ 'taxonomy' => 'be_pipeline_stage', 'field' => 'slug', 'terms' => $stage_filter ] ];
    }
    if ( $search ) {
        $query_args['s'] = $search;
    }
    $leads    = be_crm_get_leads( $query_args );
    $stages   = get_terms( [ 'taxonomy' => 'be_pipeline_stage', 'hide_empty' => false ] );

    ob_start();
    ?>
    <div class="be-card">
        <div class="be-card-header">
            <div class="be-filters">
                <form method="get" class="be-filter-form">
                    <input type="hidden" name="page" value="be-leads">
                    <input type="text" name="s" value="<?php echo esc_attr( $search ); ?>" placeholder="Search leads..." class="be-search-input">
                    <select name="stage" class="be-select-sm" onchange="this.form.submit()">
                        <option value="">All Stages</option>
                        <?php foreach ( $stages as $s ) : ?>
                        <option value="<?php echo esc_attr( $s->slug ); ?>" <?php selected( $stage_filter, $s->slug ); ?>>
                            <?php echo esc_html( $s->name ); ?>
                        </option>
                        <?php endforeach; ?>
                    </select>
                    <button type="submit" class="be-btn be-btn-secondary be-btn-sm">Filter</button>
                    <?php if ( $stage_filter || $search ) : ?>
                    <a href="<?php echo esc_url( admin_url( 'admin.php?page=be-leads' ) ); ?>" class="be-btn be-btn-ghost be-btn-sm">Clear</a>
                    <?php endif; ?>
                </form>
            </div>
            <span class="be-count-badge"><?php echo count( $leads ); ?> leads</span>
        </div>
        <?php be_crm_render_leads_table( $leads, true ); ?>
    </div>
    <?php
    $content = ob_get_clean();
    be_crm_render_page( 'All Leads', $content, 'be-leads' );
}

/* ─── PAGE: Pipeline ─────────────────────────────────────────────────── */

function be_crm_page_pipeline() : void {
    $stages = get_terms( [ 'taxonomy' => 'be_pipeline_stage', 'hide_empty' => false ] );

    ob_start();
    ?>
    <div class="be-pipeline-board">
        <?php foreach ( $stages as $stage ) :
            $color = get_term_meta( $stage->term_id, '_be_color', true ) ?: '#6b7280';
            $leads = be_crm_get_leads( [
                'tax_query' => [ [ 'taxonomy' => 'be_pipeline_stage', 'field' => 'slug', 'terms' => $stage->slug ] ],
                'posts_per_page' => -1,
            ] );
        ?>
        <div class="be-pipeline-col" data-stage="<?php echo esc_attr( $stage->slug ); ?>">
            <div class="be-pipeline-col-header" style="border-top:3px solid <?php echo esc_attr( $color ); ?>">
                <span class="be-stage-name"><?php echo esc_html( $stage->name ); ?></span>
                <span class="be-stage-badge" style="background:<?php echo esc_attr( $color ); ?>15;color:<?php echo esc_attr( $color ); ?>"><?php echo count( $leads ); ?></span>
            </div>
            <div class="be-pipeline-cards" id="stage-<?php echo esc_attr( $stage->slug ); ?>">
                <?php foreach ( $leads as $lead ) : ?>
                <div class="be-lead-card" data-lead-id="<?php echo (int) $lead['id']; ?>">
                    <div class="be-lead-card-top">
                        <span class="be-lead-name"><?php echo esc_html( $lead['name'] ); ?></span>
                        <span class="be-priority-dot be-priority-<?php echo esc_attr( $lead['priority'] ); ?>" title="<?php echo esc_attr( ucfirst( $lead['priority'] ) ); ?>"></span>
                    </div>
                    <?php if ( $lead['service'] ) : ?>
                    <div class="be-lead-service"><?php echo esc_html( $lead['service'] ); ?></div>
                    <?php endif; ?>
                    <?php if ( $lead['phone'] ) : ?>
                    <a href="tel:<?php echo esc_attr( $lead['phone'] ); ?>" class="be-lead-phone">📞 <?php echo esc_html( $lead['phone'] ); ?></a>
                    <?php endif; ?>
                    <div class="be-lead-card-footer">
                        <span class="be-lead-date"><?php echo esc_html( human_time_diff( strtotime( $lead['date'] ), current_time('timestamp') ) . ' ago' ); ?></span>
                        <div class="be-lead-actions">
                            <button class="be-icon-btn be-edit-lead" data-lead-id="<?php echo (int) $lead['id']; ?>" title="Edit">✏️</button>
                            <select class="be-stage-select-inline" data-lead-id="<?php echo (int) $lead['id']; ?>" title="Move stage">
                                <?php foreach ( $stages as $s ) : ?>
                                <option value="<?php echo esc_attr( $s->slug ); ?>" <?php selected( $lead['stage'], $s->slug ); ?>>→ <?php echo esc_html( $s->name ); ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                    </div>
                </div>
                <?php endforeach; ?>
                <?php if ( empty( $leads ) ) : ?>
                <div class="be-empty-col">No leads here</div>
                <?php endif; ?>
            </div>
        </div>
        <?php endforeach; ?>
    </div>
    <?php
    $content = ob_get_clean();
    be_crm_render_page( 'Pipeline Board', $content, 'be-pipeline' );
}

/* ─── PAGE: Contacts ──────────────────────────────────────────────────── */

function be_crm_page_contacts() : void {
    $leads = be_crm_get_leads( [
        'tax_query' => [ [ 'taxonomy' => 'be_pipeline_stage', 'field' => 'slug', 'terms' => [ 'booked', 'completed' ] ] ],
    ] );

    ob_start();
    ?>
    <div class="be-card">
        <div class="be-card-header">
            <h2>Customers (Booked &amp; Completed)</h2>
            <span class="be-count-badge"><?php echo count( $leads ); ?> contacts</span>
        </div>
        <?php be_crm_render_leads_table( $leads ); ?>
    </div>
    <?php
    $content = ob_get_clean();
    be_crm_render_page( 'Contacts', $content, 'be-contacts' );
}

/* ─── PAGE: Email Logs ───────────────────────────────────────────────── */

function be_crm_page_email_logs() : void {
    $logs = get_posts( [
        'post_type'      => 'be_email_log',
        'post_status'    => 'publish',
        'posts_per_page' => 50,
        'orderby'        => 'date',
        'order'          => 'DESC',
    ] );

    ob_start();
    ?>
    <div class="be-card">
        <div class="be-card-header"><h2>Sent Email Logs</h2><span class="be-count-badge"><?php echo count( $logs ); ?> emails</span></div>
        <table class="be-table">
            <thead><tr>
                <th>Subject</th><th>To</th><th>Type</th><th>Date Sent</th>
            </tr></thead>
            <tbody>
            <?php if ( empty( $logs ) ) : ?>
            <tr><td colspan="4" class="be-empty-row">No emails logged yet.</td></tr>
            <?php endif; ?>
            <?php foreach ( $logs as $log ) :
                $to      = get_post_meta( $log->ID, '_be_log_to',      true );
                $type    = get_post_meta( $log->ID, '_be_log_type',    true );
                $sent_at = get_post_meta( $log->ID, '_be_log_sent_at', true );
            ?>
            <tr>
                <td><?php echo esc_html( $log->post_title ); ?></td>
                <td><a href="mailto:<?php echo esc_attr( $to ); ?>"><?php echo esc_html( $to ); ?></a></td>
                <td><span class="be-badge"><?php echo esc_html( str_replace( '_', ' ', $type ) ); ?></span></td>
                <td><?php echo esc_html( $sent_at ); ?></td>
            </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php
    $content = ob_get_clean();
    be_crm_render_page( 'Email Logs', $content, 'be-email-logs' );
}

/* ─── PAGE: Settings ──────────────────────────────────────────────────── */

function be_crm_page_settings() : void {
    if ( ! current_user_can( 'manage_options' ) ) wp_die( 'Access denied.' );

    if ( isset( $_POST['be_crm_settings_nonce'] ) && wp_verify_nonce( $_POST['be_crm_settings_nonce'], 'be_crm_save_settings' ) ) {
        update_option( 'be_crm_settings', [
            'admin_email'       => sanitize_email( $_POST['admin_email'] ?? '' ),
            'company_name'      => sanitize_text_field( $_POST['company_name'] ?? '' ),
            'company_phone'     => sanitize_text_field( $_POST['company_phone'] ?? '' ),
            'custom_login_slug' => sanitize_key( $_POST['custom_login_slug'] ?? 'be-secure-login' ),
            'notify_on_new'     => ! empty( $_POST['notify_on_new'] ),
            'autoreply'         => ! empty( $_POST['autoreply'] ),
        ] );
        echo '<div class="be-notice be-notice-success">Settings saved!</div>';
    }

    $opts = wp_parse_args( get_option( 'be_crm_settings', [] ), [
        'admin_email'       => get_option( 'admin_email' ),
        'company_name'      => 'Breathe Easy FL',
        'company_phone'     => '+1 (407) 801-1480',
        'custom_login_slug' => 'be-secure-login',
        'notify_on_new'     => true,
        'autoreply'         => true,
    ] );

    ob_start();
    ?>
    <div class="be-card">
        <div class="be-card-header"><h2>CRM Settings</h2></div>
        <form method="post" class="be-settings-form">
            <?php wp_nonce_field( 'be_crm_save_settings', 'be_crm_settings_nonce' ); ?>
            <div class="be-form-grid">
                <div class="be-field">
                    <label>Notification Email</label>
                    <input type="email" name="admin_email" value="<?php echo esc_attr( $opts['admin_email'] ); ?>" required>
                    <small>Admin notifications for new leads will be sent here.</small>
                </div>
                <div class="be-field">
                    <label>Company Name</label>
                    <input type="text" name="company_name" value="<?php echo esc_attr( $opts['company_name'] ); ?>">
                </div>
                <div class="be-field">
                    <label>Company Phone</label>
                    <input type="text" name="company_phone" value="<?php echo esc_attr( $opts['company_phone'] ); ?>">
                </div>
                <div class="be-field">
                    <label>Custom Login URL Slug</label>
                    <input type="text" name="custom_login_slug" value="<?php echo esc_attr( $opts['custom_login_slug'] ); ?>">
                    <small>Your admin login will be at: <strong><?php echo esc_url( home_url( '/' . $opts['custom_login_slug'] ) ); ?></strong></small>
                </div>
                <div class="be-field be-field-full">
                    <label class="be-checkbox-label">
                        <input type="checkbox" name="notify_on_new" value="1" <?php checked( $opts['notify_on_new'] ); ?>>
                        Send admin email notification when a new lead comes in
                    </label>
                </div>
                <div class="be-field be-field-full">
                    <label class="be-checkbox-label">
                        <input type="checkbox" name="autoreply" value="1" <?php checked( $opts['autoreply'] ); ?>>
                        Send auto-reply email to leads after form submission
                    </label>
                </div>
            </div>
            <div class="be-settings-actions">
                <button type="submit" class="be-btn be-btn-primary">Save Settings</button>
            </div>
        </form>
    </div>

    <div class="be-card be-mt">
        <div class="be-card-header"><h2>Elementor Form Mapping</h2></div>
        <p class="be-info-text">
            The CRM automatically captures leads from all Elementor Pro forms by matching common field labels.
            No configuration needed — fields like <strong>Name</strong>, <strong>Email</strong>, <strong>Phone</strong>,
            <strong>Service</strong>, <strong>Message</strong>, <strong>Location</strong> are auto-mapped.
        </p>
        <p class="be-info-text">
            To override mapping, add this to your <code>functions.php</code>:
        </p>
        <pre class="be-code">add_filter( 'be_crm_elementor_field_map', function( $map ) {
    $map['email'] = [ 'email', 'your email', 'my email address' ];
    return $map;
});</pre>
    </div>
    <?php
    $content = ob_get_clean();
    be_crm_render_page( 'Settings', $content, 'be-settings' );
}

/* ─── Shared: Leads Table ────────────────────────────────────────────── */

function be_crm_render_leads_table( array $leads, bool $show_delete = false ) : void {
    $stages = get_terms( [ 'taxonomy' => 'be_pipeline_stage', 'hide_empty' => false ] );
    ?>
    <table class="be-table">
        <thead><tr>
            <th>Name</th><th>Contact</th><th>Service</th><th>Stage</th><th>Priority</th><th>Date</th><th>Actions</th>
        </tr></thead>
        <tbody>
        <?php if ( empty( $leads ) ) : ?>
        <tr><td colspan="7" class="be-empty-row">No leads found. 🌱</td></tr>
        <?php endif; ?>
        <?php foreach ( $leads as $lead ) : ?>
        <tr data-lead-id="<?php echo (int) $lead['id']; ?>">
            <td><strong><?php echo esc_html( $lead['name'] ); ?></strong></td>
            <td>
                <?php if ( $lead['email'] ) : ?><a href="mailto:<?php echo esc_attr( $lead['email'] ); ?>" class="be-email-link"><?php echo esc_html( $lead['email'] ); ?></a><br><?php endif; ?>
                <?php if ( $lead['phone'] ) : ?><a href="tel:<?php echo esc_attr( $lead['phone'] ); ?>" class="be-phone-link"><?php echo esc_html( $lead['phone'] ); ?></a><?php endif; ?>
            </td>
            <td><?php echo esc_html( $lead['service'] ?: '—' ); ?></td>
            <td>
                <select class="be-stage-select" data-lead-id="<?php echo (int) $lead['id']; ?>">
                    <?php foreach ( $stages as $s ) : ?>
                    <option value="<?php echo esc_attr( $s->slug ); ?>" data-color="<?php echo esc_attr( get_term_meta( $s->term_id, '_be_color', true ) ); ?>" <?php selected( $lead['stage'], $s->slug ); ?>>
                        <?php echo esc_html( $s->name ); ?>
                    </option>
                    <?php endforeach; ?>
                </select>
            </td>
            <td><span class="be-priority be-priority-<?php echo esc_attr( $lead['priority'] ); ?>"><?php echo esc_html( ucfirst( $lead['priority'] ?: 'warm' ) ); ?></span></td>
            <td><?php echo esc_html( date( 'M j, Y', strtotime( $lead['date'] ) ) ); ?></td>
            <td class="be-actions-cell">
                <button class="be-icon-btn be-edit-lead" data-lead-id="<?php echo (int) $lead['id']; ?>" title="Edit">✏️</button>
                <?php if ( $lead['email'] ) : ?>
                <a href="mailto:<?php echo esc_attr( $lead['email'] ); ?>" class="be-icon-btn" title="Email">✉️</a>
                <?php endif; ?>
                <?php if ( $show_delete ) : ?>
                <button class="be-icon-btn be-delete-lead" data-lead-id="<?php echo (int) $lead['id']; ?>" title="Delete">🗑️</button>
                <?php endif; ?>
            </td>
        </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <?php
}

/* ─── Shared: Stat Card ───────────────────────────────────────────────── */

function be_crm_stat_card( string $label, int $value, string $color, string $icon_path ) : void {
    ?>
    <div class="be-stat-card">
        <div class="be-stat-icon" style="background:<?php echo esc_attr( $color ); ?>15;color:<?php echo esc_attr( $color ); ?>">
            <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="<?php echo esc_attr( $icon_path ); ?>"/></svg>
        </div>
        <div class="be-stat-body">
            <div class="be-stat-value" style="color:<?php echo esc_attr( $color ); ?>"><?php echo (int) $value; ?></div>
            <div class="be-stat-label"><?php echo esc_html( $label ); ?></div>
        </div>
    </div>
    <?php
}

/* ─── Customize WP admin for CRM pages (hide default notices etc) ─────── */

add_action( 'admin_head', function() {
    $screen = get_current_screen();
    if ( ! $screen || strpos( $screen->id, 'be-' ) === false ) return;
    echo '<style>.notice:not(.be-notice){display:none!important;} #wpbody-content > .wrap > h1:first-child{display:none!important;}</style>';
} );
