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
        wp_localize_script( 'dataengine-events', 'DATAENGINEEVENTS', array( 'admin_ajax' => \admin_url( 'admin-ajax.php' ) ) );
    }
}