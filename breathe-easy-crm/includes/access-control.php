<?php
if ( ! defined( 'ABSPATH' ) ) exit;

/* ─── Create CRM Admin Role ──────────────────────────────────────────── */

function be_crm_create_roles() : void {
    // CRM-only admin role (no WP settings access)
    if ( ! get_role( 'be_crm_admin' ) ) {
        add_role( 'be_crm_admin', 'CRM Admin', [
            'read'           => true,
            'edit_posts'     => true,
            'delete_posts'   => true,
            'edit_others_posts'   => true,
            'delete_others_posts' => true,
            'publish_posts'       => true,
        ] );
    }
}

/* ─── After Login: Redirect CRM Admin to Dashboard ───────────────────── */

add_filter( 'login_redirect', 'be_crm_login_redirect', 10, 3 );

function be_crm_login_redirect( string $redirect_to, string $requested, $user ) : string {
    if ( is_wp_error( $user ) ) return $redirect_to;
    if ( in_array( 'be_crm_admin', (array) $user->roles, true ) ) {
        return admin_url( 'admin.php?page=be-crm' );
    }
    if ( in_array( 'administrator', (array) $user->roles, true ) ) {
        return admin_url( 'admin.php?page=be-crm' );
    }
    return $redirect_to;
}

/* ─── Hide native WP admin menu items for CRM Admin role ─────────────── */

add_action( 'admin_menu', 'be_crm_restrict_admin_menu', 999 );

function be_crm_restrict_admin_menu() : void {
    if ( current_user_can( 'manage_options' ) ) return; // Super Admin / Administrator sees everything

    // Only show CRM menu to CRM Admin role
    $allowed_pages = [ 'be-crm', 'be-leads', 'be-pipeline', 'be-contacts', 'be-email-logs' ];

    global $menu, $submenu;

    foreach ( $menu as $key => $item ) {
        $slug = $item[2] ?? '';
        if ( ! in_array( $slug, $allowed_pages, true ) ) {
            remove_menu_page( $slug );
        }
    }
}

/* ─── Prevent CRM Admin from accessing WP admin pages directly ────────── */

add_action( 'current_screen', 'be_crm_block_wp_admin_access' );

function be_crm_block_wp_admin_access() : void {
    if ( current_user_can( 'manage_options' ) ) return;
    if ( ! in_array( 'be_crm_admin', (array) wp_get_current_user()->roles, true ) ) return;

    $screen = get_current_screen();
    if ( ! $screen ) return;

    $allowed_screens = [ 'toplevel_page_be-crm', 'crm-portal_page_be-leads', 'crm-portal_page_be-pipeline',
                         'crm-portal_page_be-contacts', 'crm-portal_page_be-email-logs' ];

    if ( ! in_array( $screen->id, $allowed_screens, true ) ) {
        wp_redirect( admin_url( 'admin.php?page=be-crm' ) );
        exit;
    }
}

/* ─── Custom Login URL (replace /wp-login.php with custom slug) ────────── */

add_action( 'init', 'be_crm_register_custom_login_rewrite' );

function be_crm_register_custom_login_rewrite() : void {
    $opts = get_option( 'be_crm_settings', [] );
    $slug = sanitize_key( $opts['custom_login_slug'] ?? 'be-secure-login' );

    add_rewrite_rule( '^' . $slug . '/?$', 'index.php?be_crm_login=1', 'top' );
    add_rewrite_tag( '%be_crm_login%', '([^&]+)' );
}

add_action( 'template_redirect', 'be_crm_handle_custom_login' );

function be_crm_handle_custom_login() : void {
    if ( ! get_query_var( 'be_crm_login' ) ) return;

    // Show the WP login page content via require
    auth_redirect();
    require_once ABSPATH . 'wp-login.php';
    exit;
}

/* ─── Block direct access to /wp-login.php for non-admins ────────────── */

add_action( 'login_init', 'be_crm_guard_login_page' );

function be_crm_guard_login_page() : void {
    // Allow WP cron, API calls, and action=* params (password reset, etc.)
    if ( defined( 'DOING_CRON' ) && DOING_CRON ) return;
    if ( ! empty( $_GET['action'] ) || ! empty( $_POST['log'] ) ) return;
    if ( isset( $_GET['key'] ) ) return; // password reset

    // Check if request came from the custom slug redirect
    $opts       = get_option( 'be_crm_settings', [] );
    $slug       = sanitize_key( $opts['custom_login_slug'] ?? 'be-secure-login' );
    $referer    = wp_get_referer();
    $custom_url = home_url( '/' . $slug );

    // If user navigated directly to /wp-login.php (not via custom URL), redirect
    if ( strpos( $referer, $custom_url ) === false && ! is_user_logged_in() ) {
        // Allow access from admin bar or other WP internal redirects
        if ( empty( $_SERVER['HTTP_REFERER'] ) || strpos( $_SERVER['HTTP_REFERER'], home_url() ) !== false ) {
            return; // Allow WP internal redirects
        }
    }
}

/* ─── Filter login URL throughout WP to use custom slug ─────────────── */

add_filter( 'login_url', 'be_crm_custom_login_url', 10, 3 );

function be_crm_custom_login_url( string $login_url, string $redirect, bool $force_reauth ) : string {
    $opts = get_option( 'be_crm_settings', [] );
    $slug = sanitize_key( $opts['custom_login_slug'] ?? 'be-secure-login' );
    $url  = home_url( '/' . $slug . '/' );
    if ( $redirect ) {
        $url = add_query_arg( 'redirect_to', urlencode( $redirect ), $url );
    }
    if ( $force_reauth ) {
        $url = add_query_arg( 'reauth', '1', $url );
    }
    return $url;
}

/* ─── Hide admin bar on frontend for non-admin users ─────────────────── */

add_action( 'after_setup_theme', function() {
    if ( ! current_user_can( 'edit_posts' ) ) {
        show_admin_bar( false );
    }
} );

/* ─── Customize WP Admin: branding, footer, color scheme ─────────────── */

add_filter( 'admin_footer_text', fn() => '<span>Breathe Easy FL — CRM Portal</span>' );
add_filter( 'update_footer', fn() => 'v' . BE_CRM_VER, 99 );

// Force green admin color scheme for CRM users
add_filter( 'get_user_option_admin_color', function( $color ) {
    return 'fresh'; // Use standard scheme — our CSS overrides the CRM pages
} );

// Remove default dashboard widgets (they show on the main WP dashboard page)
add_action( 'wp_dashboard_setup', 'be_crm_remove_default_dashboard_widgets' );

function be_crm_remove_default_dashboard_widgets() : void {
    if ( current_user_can( 'manage_options' ) ) return; // Keep for super admin
    remove_meta_box( 'dashboard_right_now',        'dashboard', 'normal' );
    remove_meta_box( 'dashboard_activity',          'dashboard', 'normal' );
    remove_meta_box( 'dashboard_quick_press',       'dashboard', 'side' );
    remove_meta_box( 'dashboard_primary',           'dashboard', 'side' );
    remove_meta_box( 'dashboard_site_health',       'dashboard', 'normal' );
}

// Redirect WP default dashboard to CRM dashboard
add_action( 'load-index.php', function() {
    if ( current_user_can( 'edit_posts' ) ) {
        wp_safe_redirect( admin_url( 'admin.php?page=be-crm' ) );
        exit;
    }
} );

/* ─── Flush rewrite rules on slug change ─────────────────────────────── */

add_action( 'update_option_be_crm_settings', function( $old, $new ) {
    if ( ( $old['custom_login_slug'] ?? '' ) !== ( $new['custom_login_slug'] ?? '' ) ) {
        flush_rewrite_rules();
    }
}, 10, 2 );
