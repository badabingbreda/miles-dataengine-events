<?php
/**
 * Miles DataEngine Events
 *
 * @package     MilesDataEngineEvents
 * @author      Badabingbreda
 * @license     GPL-2.0+
 *
 * @wordpress-plugin
 * Plugin Name: Miles DataEngine Events
 * Description: Miles DataEngine Events Grid
 * Version:     1.3.2
 * Text Domain: dataengine-events
 * License:     GPL-2.0+
 * License URI: http://www.gnu.org/licenses/gpl-2.0.txt
 */


use DataEngineEvents\Autoloader;
use DataEngineEvents\Init;

if ( defined( 'ABSPATH' ) && ! defined( 'DATAENGINEEVENTS_VERION' ) ) {
 register_activation_hook( __FILE__, 'DATAENGINEEVENTS_check_php_version' );

 /**
  * Display notice for old PHP version.
  */
 function DATAENGINEEVENTS_check_php_version() {
     if ( version_compare( phpversion(), '7.4', '<' ) ) {
        die( esc_html__( 'Miles DataEngine Events Plugin requires PHP version 7.4+. Please contact your host to upgrade.', 'dataengine-events' ) );
    }
 }

  define( 'DATAENGINEEVENTS_VERSION'   , '1.3.2' );
  define( 'DATAENGINEEVENTS_DIR'     , plugin_dir_path( __FILE__ ) );
  define( 'DATAENGINEEVENTS_FILE'    , __FILE__ );
  define( 'DATAENGINEEVENTS_URL'     , plugins_url( '/', __FILE__ ) );

  define( 'CHECK_DATAENGINEEVENTS_PLUGIN_FILE', __FILE__ );

}

if ( ! class_exists( 'DataEngineEvents\Init' ) ) {

 /**
  * The file where the Autoloader class is defined.
  */
  require_once DATAENGINEEVENTS_DIR . 'inc/Autoloader.php';
  spl_autoload_register( array( new Autoloader(), 'autoload' ) );

 $dataengine_events = new Init();
 
}
