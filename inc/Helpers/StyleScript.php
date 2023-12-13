<?php
namespace DataEngineEvents\Helpers;

class StyleScript {

    public function __construct() {
        add_action( 'wp_enqueue_scripts' , __CLASS__ . '::register' );
    }

    public static function register() {
        wp_register_script( 'dataengine-events', DATAENGINEEVENTS_URL . 'js/dataengine-events.js', null,  DATAENGINEEVENTS_VERSION , false );
        wp_register_style( 'dataengine-events' , DATAENGINEEVENTS_URL . 'css/dataengine-events.css' , null , DATAENGINEEVENTS_VERSION , 'all' );
    }

    public static function enqueue() {
        wp_enqueue_script( 'dataengine-events' );
        wp_enqueue_style( 'dataengine-events');
        // load the maps api if it is defined
        if ( defined( 'DATAENGINE_EVENTS_MAPSAPI' ) ) {
            wp_enqueue_script( 'google-api', 'https://maps.googleapis.com/maps/api/js?key=' . DATAENGINE_EVENTS_MAPSAPI , null, null, true); // Add in your key
        }
        // localize our script so we know where the assets are located and the admin_ajax script. Also if we can use the mapsapi
        wp_localize_script( 'dataengine-events', 'DATAENGINEEVENTS', array( 
            'admin_ajax' => \admin_url( 'admin-ajax.php' ),
            'mapsapi' => ( defined( 'DATAENGINE_EVENTS_MAPSAPI' ) ? true : false),
            'plugindir' => DATAENGINEEVENTS_URL,
            ) );
    }
}