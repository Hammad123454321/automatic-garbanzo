<?php
if ( ! defined( 'ABSPATH' ) ) exit;

/* ─── Register CPTs ─────────────────────────────────────────────────── */

add_action( 'init', 'be_crm_register_post_types' );

function be_crm_register_post_types() {

    // LEADS
    register_post_type( 'be_lead', [
        'labels' => [
            'name'          => 'Leads',
            'singular_name' => 'Lead',
            'add_new_item'  => 'Add New Lead',
            'edit_item'     => 'Edit Lead',
            'not_found'     => 'No leads found.',
        ],
        'public'          => false,
        'show_ui'         => true,
        'show_in_menu'    => false,
        'show_in_rest'    => true,
        'supports'        => [ 'title', 'custom-fields' ],
        'capability_type' => 'post',
        'map_meta_cap'    => true,
    ] );

    // CONTACTS
    register_post_type( 'be_contact', [
        'labels' => [
            'name'          => 'Contacts',
            'singular_name' => 'Contact',
        ],
        'public'          => false,
        'show_ui'         => true,
        'show_in_menu'    => false,
        'show_in_rest'    => true,
        'supports'        => [ 'title', 'custom-fields' ],
        'capability_type' => 'post',
        'map_meta_cap'    => true,
    ] );

    // EMAIL LOGS
    register_post_type( 'be_email_log', [
        'labels' => [
            'name'          => 'Email Logs',
            'singular_name' => 'Email Log',
        ],
        'public'          => false,
        'show_ui'         => false,
        'show_in_menu'    => false,
        'supports'        => [ 'title', 'custom-fields' ],
        'capability_type' => 'post',
    ] );

    // Pipeline stage taxonomy
    register_taxonomy( 'be_pipeline_stage', 'be_lead', [
        'labels' => [
            'name'          => 'Pipeline Stages',
            'singular_name' => 'Stage',
        ],
        'public'       => false,
        'show_ui'      => false,
        'show_in_rest' => true,
        'hierarchical' => false,
    ] );

    // Service type taxonomy
    register_taxonomy( 'be_service_type', [ 'be_lead', 'be_contact' ], [
        'labels' => [
            'name'          => 'Service Types',
            'singular_name' => 'Service',
        ],
        'public'       => false,
        'show_ui'      => false,
        'show_in_rest' => true,
        'hierarchical' => false,
    ] );
}

/* ─── Seed default pipeline stages ─────────────────────────────────── */

function be_crm_seed_pipeline_stages() {
    $stages = [
        [ 'slug' => 'new-inquiry', 'name' => 'New Inquiry',  'order' => 1, 'color' => '#3b82f6' ],
        [ 'slug' => 'contacted',   'name' => 'Contacted',    'order' => 2, 'color' => '#8b5cf6' ],
        [ 'slug' => 'quoted',      'name' => 'Quoted',       'order' => 3, 'color' => '#f59e0b' ],
        [ 'slug' => 'booked',      'name' => 'Booked',       'order' => 4, 'color' => '#10b981' ],
        [ 'slug' => 'completed',   'name' => 'Completed',    'order' => 5, 'color' => '#1b5e38' ],
        [ 'slug' => 'lost',        'name' => 'Lost',         'order' => 6, 'color' => '#ef4444' ],
    ];
    foreach ( $stages as $s ) {
        if ( ! term_exists( $s['slug'], 'be_pipeline_stage' ) ) {
            $term = wp_insert_term( $s['name'], 'be_pipeline_stage', [ 'slug' => $s['slug'] ] );
            if ( ! is_wp_error( $term ) ) {
                update_term_meta( $term['term_id'], '_be_order', $s['order'] );
                update_term_meta( $term['term_id'], '_be_color', $s['color'] );
            }
        }
    }

    $services = [ 'Residential Cleaning', 'Commercial Cleaning', 'AirBnb Cleaning', 'Deep Cleaning', 'Move-In/Out Cleaning', 'Other' ];
    foreach ( $services as $service ) {
        $slug = sanitize_title( $service );
        if ( ! term_exists( $slug, 'be_service_type' ) ) {
            wp_insert_term( $service, 'be_service_type', [ 'slug' => $slug ] );
        }
    }
}

/* ─── Helper: Create a lead ─────────────────────────────────────────── */

function be_crm_create_lead( array $data ) : int|false {
    $title   = sanitize_text_field( $data['name'] ?? 'Unknown Lead' );
    $lead_id = wp_insert_post( [
        'post_type'   => 'be_lead',
        'post_title'  => $title,
        'post_status' => 'publish',
    ] );

    if ( is_wp_error( $lead_id ) ) return false;

    $text_fields = [ 'email', 'phone', 'service', 'location', 'source', 'priority', 'assigned_to', 'value' ];
    foreach ( $text_fields as $f ) {
        if ( ! empty( $data[ $f ] ) ) {
            update_post_meta( $lead_id, '_be_' . $f, sanitize_text_field( $data[ $f ] ) );
        }
    }
    if ( ! empty( $data['message'] ) ) {
        update_post_meta( $lead_id, '_be_message', sanitize_textarea_field( $data['message'] ) );
    }

    $stage = sanitize_key( $data['stage'] ?? 'new-inquiry' );
    wp_set_object_terms( $lead_id, $stage, 'be_pipeline_stage' );

    if ( empty( $data['priority'] ) ) {
        update_post_meta( $lead_id, '_be_priority', 'warm' );
    }

    update_post_meta( $lead_id, '_be_created_at', current_time( 'mysql' ) );

    do_action( 'be_crm_new_lead', $lead_id, $data );

    return $lead_id;
}

/* ─── Helper: Update lead stage ──────────────────────────────────────── */

function be_crm_update_lead_stage( int $lead_id, string $new_stage ) : void {
    $old_terms = wp_get_object_terms( $lead_id, 'be_pipeline_stage', [ 'fields' => 'slugs' ] );
    $old_stage = $old_terms[0] ?? '';
    wp_set_object_terms( $lead_id, sanitize_key( $new_stage ), 'be_pipeline_stage' );
    update_post_meta( $lead_id, '_be_last_stage_change', current_time( 'mysql' ) );
    do_action( 'be_crm_lead_stage_changed', $lead_id, $new_stage, $old_stage );
}

/* ─── Helper: Get lead data ──────────────────────────────────────────── */

function be_crm_get_lead( int $lead_id ) : array|null {
    $post = get_post( $lead_id );
    if ( ! $post || $post->post_type !== 'be_lead' ) return null;

    $stage_terms = wp_get_object_terms( $lead_id, 'be_pipeline_stage' );
    $stage       = $stage_terms ? $stage_terms[0] : null;
    $color       = $stage ? get_term_meta( $stage->term_id, '_be_color', true ) : '#6b7280';

    return [
        'id'          => $lead_id,
        'name'        => $post->post_title,
        'email'       => get_post_meta( $lead_id, '_be_email', true ),
        'phone'       => get_post_meta( $lead_id, '_be_phone', true ),
        'service'     => get_post_meta( $lead_id, '_be_service', true ),
        'location'    => get_post_meta( $lead_id, '_be_location', true ),
        'message'     => get_post_meta( $lead_id, '_be_message', true ),
        'source'      => get_post_meta( $lead_id, '_be_source', true ),
        'priority'    => get_post_meta( $lead_id, '_be_priority', true ),
        'notes'       => get_post_meta( $lead_id, '_be_notes', true ),
        'value'       => get_post_meta( $lead_id, '_be_value', true ),
        'stage'       => $stage ? $stage->slug : 'new-inquiry',
        'stage_name'  => $stage ? $stage->name : 'New Inquiry',
        'stage_color' => $color,
        'date'        => $post->post_date,
        'created_at'  => get_post_meta( $lead_id, '_be_created_at', true ),
    ];
}

/* ─── Helper: Query leads ────────────────────────────────────────────── */

function be_crm_get_leads( array $args = [] ) : array {
    $defaults = [
        'post_type'      => 'be_lead',
        'post_status'    => 'publish',
        'posts_per_page' => -1,
        'orderby'        => 'date',
        'order'          => 'DESC',
    ];
    $query = new WP_Query( wp_parse_args( $args, $defaults ) );
    return array_filter( array_map( fn( $p ) => be_crm_get_lead( $p->ID ), $query->posts ) );
}

/* ─── Helper: Stats ──────────────────────────────────────────────────── */

function be_crm_get_stats() : array {
    $today_start = date( 'Y-m-d 00:00:00' );
    $month_start = date( 'Y-m-01 00:00:00' );

    $today_leads = ( new WP_Query( [
        'post_type'      => 'be_lead',
        'post_status'    => 'publish',
        'posts_per_page' => -1,
        'date_query'     => [ [ 'after' => $today_start, 'inclusive' => true ] ],
        'fields'         => 'ids',
    ] ) )->found_posts;

    $total_leads    = wp_count_posts( 'be_lead' )->publish;
    $total_contacts = wp_count_posts( 'be_contact' )->publish;

    $booked = ( new WP_Query( [
        'post_type'      => 'be_lead',
        'post_status'    => 'publish',
        'posts_per_page' => -1,
        'fields'         => 'ids',
        'date_query'     => [ [ 'after' => $month_start, 'inclusive' => true ] ],
        'tax_query'      => [ [ 'taxonomy' => 'be_pipeline_stage', 'field' => 'slug', 'terms' => 'booked' ] ],
    ] ) )->found_posts;

    $active_pipeline = ( new WP_Query( [
        'post_type'      => 'be_lead',
        'post_status'    => 'publish',
        'posts_per_page' => -1,
        'fields'         => 'ids',
        'tax_query'      => [ [
            'taxonomy' => 'be_pipeline_stage',
            'field'    => 'slug',
            'terms'    => [ 'lost', 'completed' ],
            'operator' => 'NOT IN',
        ] ],
    ] ) )->found_posts;

    return compact( 'today_leads', 'total_leads', 'total_contacts', 'booked', 'active_pipeline' );
}

/* ─── Helper: Stage counts for pipeline board ───────────────────────── */

function be_crm_get_pipeline_counts() : array {
    $stages = get_terms( [ 'taxonomy' => 'be_pipeline_stage', 'hide_empty' => false ] );
    $counts = [];
    foreach ( $stages as $stage ) {
        $q = new WP_Query( [
            'post_type'      => 'be_lead',
            'post_status'    => 'publish',
            'posts_per_page' => -1,
            'fields'         => 'ids',
            'tax_query'      => [ [ 'taxonomy' => 'be_pipeline_stage', 'field' => 'slug', 'terms' => $stage->slug ] ],
        ] );
        $color = get_term_meta( $stage->term_id, '_be_color', true ) ?: '#6b7280';
        $order = (int) get_term_meta( $stage->term_id, '_be_order', true );
        $counts[] = [
            'slug'  => $stage->slug,
            'name'  => $stage->name,
            'count' => $q->found_posts,
            'color' => $color,
            'order' => $order,
        ];
    }
    usort( $counts, fn( $a, $b ) => $a['order'] - $b['order'] );
    return $counts;
}

/* ─── Log an email ───────────────────────────────────────────────────── */

function be_crm_log_email( string $to, string $subject, string $type, int $lead_id = 0 ) : void {
    wp_insert_post( [
        'post_type'   => 'be_email_log',
        'post_title'  => $subject,
        'post_status' => 'publish',
        'meta_input'  => [
            '_be_log_to'      => $to,
            '_be_log_type'    => $type,
            '_be_log_lead_id' => $lead_id,
            '_be_log_sent_at' => current_time( 'mysql' ),
        ],
    ] );
}

/* ─── AJAX: Update lead stage ────────────────────────────────────────── */

add_action( 'wp_ajax_be_update_stage', 'be_crm_ajax_update_stage' );
function be_crm_ajax_update_stage() : void {
    check_ajax_referer( 'be_crm_nonce', 'nonce' );
    if ( ! current_user_can( 'edit_posts' ) ) wp_send_json_error( 'Unauthorized' );

    $lead_id   = (int) ( $_POST['lead_id'] ?? 0 );
    $new_stage = sanitize_key( $_POST['stage'] ?? '' );

    if ( ! $lead_id || ! $new_stage ) wp_send_json_error( 'Invalid data' );

    be_crm_update_lead_stage( $lead_id, $new_stage );
    wp_send_json_success( [ 'lead_id' => $lead_id, 'stage' => $new_stage ] );
}

/* ─── AJAX: Save lead ────────────────────────────────────────────────── */

add_action( 'wp_ajax_be_save_lead', 'be_crm_ajax_save_lead' );
function be_crm_ajax_save_lead() : void {
    check_ajax_referer( 'be_crm_nonce', 'nonce' );
    if ( ! current_user_can( 'edit_posts' ) ) wp_send_json_error( 'Unauthorized' );

    $lead_id = (int) ( $_POST['lead_id'] ?? 0 );

    $data = [
        'name'     => sanitize_text_field( $_POST['name']     ?? '' ),
        'email'    => sanitize_email( $_POST['email']         ?? '' ),
        'phone'    => sanitize_text_field( $_POST['phone']    ?? '' ),
        'service'  => sanitize_text_field( $_POST['service']  ?? '' ),
        'location' => sanitize_text_field( $_POST['location'] ?? '' ),
        'message'  => sanitize_textarea_field( $_POST['message'] ?? '' ),
        'priority' => sanitize_key( $_POST['priority']        ?? 'warm' ),
        'stage'    => sanitize_key( $_POST['stage']           ?? 'new-inquiry' ),
        'value'    => sanitize_text_field( $_POST['value']    ?? '' ),
        'notes'    => sanitize_textarea_field( $_POST['notes'] ?? '' ),
    ];

    if ( $lead_id && get_post( $lead_id ) ) {
        wp_update_post( [ 'ID' => $lead_id, 'post_title' => $data['name'] ] );
        foreach ( [ 'email', 'phone', 'service', 'location', 'priority', 'value' ] as $f ) {
            update_post_meta( $lead_id, '_be_' . $f, $data[ $f ] );
        }
        update_post_meta( $lead_id, '_be_message', $data['message'] );
        update_post_meta( $lead_id, '_be_notes',   $data['notes'] );
        be_crm_update_lead_stage( $lead_id, $data['stage'] );
        wp_send_json_success( [ 'lead_id' => $lead_id, 'action' => 'updated' ] );
    } else {
        $new_id = be_crm_create_lead( $data );
        if ( ! empty( $data['notes'] ) ) update_post_meta( $new_id, '_be_notes', $data['notes'] );
        if ( ! empty( $data['value'] ) ) update_post_meta( $new_id, '_be_value', $data['value'] );
        wp_send_json_success( [ 'lead_id' => $new_id, 'action' => 'created' ] );
    }
}

/* ─── AJAX: Delete lead ──────────────────────────────────────────────── */

add_action( 'wp_ajax_be_delete_lead', 'be_crm_ajax_delete_lead' );
function be_crm_ajax_delete_lead() : void {
    check_ajax_referer( 'be_crm_nonce', 'nonce' );
    if ( ! current_user_can( 'delete_posts' ) ) wp_send_json_error( 'Unauthorized' );
    $lead_id = (int) ( $_POST['lead_id'] ?? 0 );
    if ( ! $lead_id ) wp_send_json_error( 'Invalid' );
    wp_delete_post( $lead_id, true );
    wp_send_json_success();
}

/* ─── AJAX: Get lead JSON ────────────────────────────────────────────── */

add_action( 'wp_ajax_be_get_lead', 'be_crm_ajax_get_lead' );
function be_crm_ajax_get_lead() : void {
    check_ajax_referer( 'be_crm_nonce', 'nonce' );
    if ( ! current_user_can( 'edit_posts' ) ) wp_send_json_error( 'Unauthorized' );
    $lead_id = (int) ( $_GET['lead_id'] ?? 0 );
    $lead    = be_crm_get_lead( $lead_id );
    $lead ? wp_send_json_success( $lead ) : wp_send_json_error( 'Not found' );
}
