<?php
namespace DataEngineEvents\Helpers;

class StyleScript {

    public function __construct() {
        add_action( 'wp_enqueue_scripts' , __CLASS__ . '::register' );
        add_action( 'wp_enqueue_scripts' , __CLASS__ . '::register_daterangepicker' );
    }

    public static function register() {
        wp_register_script( 'dataengine-events', DATAENGINEEVENTS_URL . 'js/dataengine-events.js', null,  DATAENGINEEVENTS_VERSION , false );
        wp_register_style( 'dataengine-events' , DATAENGINEEVENTS_URL . 'css/dataengine-events.css' , null , DATAENGINEEVENTS_VERSION , 'all' );
    }

    public static function register_daterangepicker() {
        wp_register_script( 'daterange-moment', 'https://cdn.jsdelivr.net/momentjs/latest/moment.min.js', null,  DATAENGINEEVENTS_VERSION , false );
        wp_register_script( 'daterange-picker', 'https://cdn.jsdelivr.net/npm/daterangepicker/daterangepicker.min.js', null,  DATAENGINEEVENTS_VERSION , false );
        wp_register_style( 'daterange-picker' , 'https://cdn.jsdelivr.net/npm/daterangepicker/daterangepicker.css' , null , DATAENGINEEVENTS_VERSION , 'all' );
    }

    public static function enqueue_daterangepicker() {
        wp_enqueue_script( 'daterange-moment' );
        wp_enqueue_script( 'daterange-picker' );
        wp_enqueue_style( 'daterange-picker' );
    }

    public static function enqueue() {
        wp_enqueue_script( 'dataengine-events' );
        wp_enqueue_style( 'dataengine-events');

        self::enqueue_daterangepicker();

        // load the maps api if it is defined
        if ( defined( 'DATAENGINE_EVENTS_MAPSAPI' ) ) {
            wp_enqueue_script( 'google-api', 'https://maps.googleapis.com/maps/api/js?key=' . DATAENGINE_EVENTS_MAPSAPI , null, null, true); // Add in your key
        }
        // localize our script so we know where the assets are located and the admin_ajax script. Also if we can use the mapsapi
        wp_localize_script( 'dataengine-events', 'DATAENGINEEVENTS', array( 
            'admin_ajax' => \admin_url( 'admin-ajax.php' ),
            'mapsapi' => ( defined( 'DATAENGINE_EVENTS_MAPSAPI' ) ? true : false),
            'plugindir' => DATAENGINEEVENTS_URL,
            'mindate' => date( 'm/d/Y' ),       // earliest selectable date for the daterangepicker
            'startdate' => filter_input( INPUT_GET , '_startdate' ),
            'enddate' => filter_input( INPUT_GET , '_enddate' ),
            ) );
    }
}