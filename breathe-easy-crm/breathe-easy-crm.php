<?php
/**
 * Plugin Name:  Breathe Easy CRM
 * Plugin URI:   https://plum-cheetah-120840.hostingersite.com
 * Description:  Complete CRM system with modern admin dashboard, Elementor Pro form integration, lead pipeline, and full email automation for Breathe Easy FL.
 * Version:      1.0.0
 * Author:       Custom Dev
 * Text Domain:  be-crm
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'BE_CRM_VER',  '1.0.0' );
define( 'BE_CRM_PATH', plugin_dir_path( __FILE__ ) );
define( 'BE_CRM_URL',  plugin_dir_url( __FILE__ ) );

require_once BE_CRM_PATH . 'includes/post-types.php';
require_once BE_CRM_PATH . 'includes/elementor-hooks.php';
require_once BE_CRM_PATH . 'includes/email-automation.php';
require_once BE_CRM_PATH . 'includes/dashboard.php';
require_once BE_CRM_PATH . 'includes/access-control.php';

register_activation_hook( __FILE__, 'be_crm_activate' );
register_deactivation_hook( __FILE__, 'be_crm_deactivate' );

function be_crm_activate() {
    be_crm_register_post_types();
    be_crm_seed_pipeline_stages();
    be_crm_create_roles();
    flush_rewrite_rules();
    if ( ! wp_next_scheduled( 'be_crm_weekly_digest' ) ) {
        wp_schedule_event( strtotime( 'next monday 8:00am' ), 'weekly', 'be_crm_weekly_digest' );
    }
    // Store default settings
    add_option( 'be_crm_settings', [
        'admin_email'       => get_option( 'admin_email' ),
        'company_name'      => 'Breathe Easy FL',
        'company_phone'     => '+1 (407) 801-1480',
        'custom_login_slug' => 'be-secure-login',
        'notify_on_new'     => true,
        'autoreply'         => true,
    ]);
}

function be_crm_deactivate() {
    wp_clear_scheduled_hook( 'be_crm_weekly_digest' );
    flush_rewrite_rules();
}
