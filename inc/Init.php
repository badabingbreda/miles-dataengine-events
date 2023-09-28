<?php
namespace SonomaEvents;

use SonomaEvents\Helpers\StyleScript;
use SonomaEvents\SonEvents;

class Init {
    public function __construct() {
        new StyleScript();
        new SonEvents();
    }
}