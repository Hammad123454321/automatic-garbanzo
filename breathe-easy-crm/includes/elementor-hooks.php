<?php
if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * Elementor Pro Form → CRM Lead Capture
 *
 * Hooks into every Elementor Pro form submission and maps common field
 * labels to lead data. Works automatically for any form on the site.
 * Field mapping can be overridden via be_crm_elementor_field_map filter.
 */
add_action( 'elementor_pro/forms/new_record', 'be_crm_capture_elementor_form', 10, 2 );

function be_crm_capture_elementor_form( $record, $ajax_handler ) {

    $settings = $record->get( 'form_settings' );
    $raw      = $record->get( 'fields' );

    // Flatten fields: label => value (lowercased label for matching)
    $fields = [];
    foreach ( $raw as $field ) {
        $label            = strtolower( trim( $field['title'] ?? $field['id'] ?? '' ) );
        $fields[ $label ] = sanitize_text_field( $field['value'] ?? '' );
    }

    // Field map: common label variants → CRM key
    $default_map = [
        'name'              => [ 'name', 'full name', 'your name', 'first name', 'contact name' ],
        'email'             => [ 'email', 'email address', 'your email', 'e-mail' ],
        'phone'             => [ 'phone', 'phone number', 'mobile', 'cell', 'telephone', 'contact number' ],
        'service'           => [ 'service', 'service type', 'cleaning type', 'type of service', 'service needed' ],
        'location'          => [ 'location', 'city', 'zip', 'zip code', 'area', 'address', 'city/zip' ],
        'message'           => [ 'message', 'notes', 'details', 'tell us more', 'additional info', 'how can we help', 'description' ],
        'preferred_date'    => [ 'date', 'preferred date', 'when', 'schedule date' ],
        'bedrooms'          => [ 'bedrooms', 'beds', 'number of bedrooms', 'how many bedrooms' ],
        'bathrooms'         => [ 'bathrooms', 'baths', 'number of bathrooms' ],
        'square_footage'    => [ 'square footage', 'sq ft', 'home size', 'size' ],
    ];

    // Allow theme/child theme to override field map
    $field_map = apply_filters( 'be_crm_elementor_field_map', $default_map );

    $lead_data = [ 'source' => 'Elementor Form: ' . ( $settings['form_name'] ?? 'Unknown' ) ];

    foreach ( $field_map as $crm_key => $possible_labels ) {
        foreach ( $possible_labels as $label ) {
            if ( isset( $fields[ $label ] ) && $fields[ $label ] !== '' ) {
                $lead_data[ $crm_key ] = $fields[ $label ];
                break;
            }
        }
    }

    // If we couldn't find a name, try first/last name combo
    if ( empty( $lead_data['name'] ) ) {
        $first = $fields['first name'] ?? $fields['first'] ?? '';
        $last  = $fields['last name']  ?? $fields['last']  ?? '';
        if ( $first || $last ) {
            $lead_data['name'] = trim( "$first $last" );
        }
    }

    // Must have at least a name or email to create a lead
    if ( empty( $lead_data['name'] ) && empty( $lead_data['email'] ) ) {
        return;
    }

    if ( empty( $lead_data['name'] ) && ! empty( $lead_data['email'] ) ) {
        $lead_data['name'] = $lead_data['email'];
    }

    // Concatenate extra useful fields into message if present
    $extras = [];
    if ( ! empty( $lead_data['preferred_date'] ) ) $extras[] = 'Preferred Date: ' . $lead_data['preferred_date'];
    if ( ! empty( $lead_data['bedrooms'] ) )        $extras[] = 'Bedrooms: '       . $lead_data['bedrooms'];
    if ( ! empty( $lead_data['bathrooms'] ) )       $extras[] = 'Bathrooms: '      . $lead_data['bathrooms'];
    if ( ! empty( $lead_data['square_footage'] ) )  $extras[] = 'Sq Ft: '          . $lead_data['square_footage'];

    if ( $extras ) {
        $lead_data['message'] = trim( ( $lead_data['message'] ?? '' ) . "\n\n" . implode( "\n", $extras ) );
    }

    $lead_data['stage'] = 'new-inquiry';

    // Prevent duplicates: skip if same email + same day
    if ( ! empty( $lead_data['email'] ) ) {
        $existing = new WP_Query( [
            'post_type'      => 'be_lead',
            'post_status'    => 'publish',
            'posts_per_page' => 1,
            'fields'         => 'ids',
            'date_query'     => [ [ 'after' => date( 'Y-m-d 00:00:00' ), 'inclusive' => true ] ],
            'meta_query'     => [ [ 'key' => '_be_email', 'value' => $lead_data['email'] ] ],
        ] );
        if ( $existing->found_posts > 0 ) return;
    }

    be_crm_create_lead( $lead_data );
}

/* ─── Settings page: field mapping helper ────────────────────────────── */

/**
 * Provide a way to manually create leads from admin (used by AJAX add-lead modal).
 * Already handled in post-types.php AJAX handlers.
 */
