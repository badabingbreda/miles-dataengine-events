<?php
namespace DataEngineEvents;

use DataEngineEvents\Helpers\StyleScript;
use DataEngineEvents\Events;

class Init {
    public function __construct() {
        new StyleScript();
        new Events();
    }
}