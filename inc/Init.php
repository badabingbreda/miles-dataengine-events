<?php
namespace DataEngineEvents;

use DataEngineEvents\Helpers\StyleScript;
use DataEngineEvents\Helpers\GithubUpdater;
use DataEngineEvents\Events;

class Init {
    public function __construct() {

        self::init_updater();
        new StyleScript();
        new Events();
    }

    /**
     * updater
     *
     * @return void
     */
    public static function init_updater() {
        $updater = new GithubUpdater( DATAENGINEEVENTS_FILE );
        $updater->set_username( 'badabing' );
        $updater->set_repository( 'miles-dataengine-events' );
        $updater->set_settings( array(
                    'requires'			=> '5.1',
                    'tested'			=> '6.3',
                    'rating'			=> '100.0',
                    'num_ratings'		=> '10',
                    'downloaded'		=> '10',
                    'added'				=> '2023-10-03',
                ) );
        $updater->initialize();

    }    
}