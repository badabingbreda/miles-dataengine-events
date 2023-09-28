<?php
namespace SonomaEvents\Helpers;

class StyleScript {

    public function __construct() {
        add_action( 'wp_enqueue_scripts' , __CLASS__ . '::register' );
    }

    public static function register() {
        wp_register_script( 'sonoma-events', SONOMAEVENTS_URL . 'js/sonoma-events.js', null,  SONOMAEVENTS_VERSION , false );
        wp_register_style( 'sonoma-events' , SONOMAEVENTS_URL . 'css/sonoma-events.css' , null , SONOMAEVENTS_VERSION , 'all' );
    }

    public static function enqueue() {
        wp_enqueue_script( 'sonoma-events' );
        wp_enqueue_style( 'sonoma-events');
        wp_localize_script( 'sonoma-events', 'SONOMAEVENTS', array( 'admin_ajax' => \admin_url( 'admin-ajax.php' ) ) );
    }
}