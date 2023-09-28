<?php
/**
 * Sonoma Events
 *
 * @package     SonomaEvents
 * @author      Badabingbreda
 * @license     GPL-2.0+
 *
 * @wordpress-plugin
 * Plugin Name: Sonoma Events
 * Plugin URI:  https://www.badabing.nl
 * Description: Sonoma Events grid
 * Version:     1.0.0
 * Author:      Badabingbreda
 * Author URI:  https://www.badabing.nl
 * Text Domain: sonoma-events
 * License:     GPL-2.0+
 * License URI: http://www.gnu.org/licenses/gpl-2.0.txt
 */


use SonomaEvents\Autoloader;
use SonomaEvents\Init;

if ( defined( 'ABSPATH' ) && ! defined( 'SONOMAEVENTS_VERION' ) ) {
 register_activation_hook( __FILE__, 'SONOMAEVENTS_check_php_version' );

 /**
  * Display notice for old PHP version.
  */
 function SONOMAEVENTS_check_php_version() {
     if ( version_compare( phpversion(), '7.4', '<' ) ) {
        die( esc_html__( 'Sonoma Events Plugin requires PHP version 7.4+. Please contact your host to upgrade.', 'sonoma-events' ) );
    }
 }

  define( 'SONOMAEVENTS_VERSION'   , '1.0.0' );
  define( 'SONOMAEVENTS_DIR'     , plugin_dir_path( __FILE__ ) );
  define( 'SONOMAEVENTS_FILE'    , __FILE__ );
  define( 'SONOMAEVENTS_URL'     , plugins_url( '/', __FILE__ ) );

  define( 'CHECK_SONOMAEVENTS_PLUGIN_FILE', __FILE__ );

}

if ( ! class_exists( 'SonomaEvents\Init' ) ) {

 /**
  * The file where the Autoloader class is defined.
  */
  require_once SONOMAEVENTS_DIR . 'inc/Autoloader.php';
  spl_autoload_register( array( new Autoloader(), 'autoload' ) );

 $plugin_var = new Init();
 // looking for the init hooks? Find them in the Check_Plugin_Dependencies.php->run() callback

}
