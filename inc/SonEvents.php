<?php
namespace SonomaEvents;

use SonomaEvents\Helpers\StyleScript;

class SonEvents {
	
	private static $expiration = 60 * 60;	// an hour
	private static $refresh = false;			// force refresh or not
	private static $ajax_action = 'sonoma-events';
	private static $per_page = 30;
	private static $default_view = 'month';

	private static $settings = [];

	private static $last_date = null;		// internal value so we can keep track of last item and add headers
	
	public function __construct() {
		
		add_shortcode( 'sonoma-events' , __CLASS__ . '::event_shortcode' );
        
		add_action( 'wp_ajax_' . self::$ajax_action , __CLASS__ . '::ajax_events' );
		add_action( 'wp_ajax_nopriv_' . self::$ajax_action , __CLASS__ . '::ajax_events' );
	}
		
	/**
	 * ajax_events
	 *
	 * @return void
	 */
	public static function ajax_events() {
		
		if (!defined( 'DOING_AJAX' ) && !DOING_AJAX ) {
			define( 'DOING_AJAX' , true );			
		}

		// get url params for later use
		self::get_settings();

		$all_events = self::get_events( self::$refresh );

		$all_events = self::event_filter( $all_events );
		
		if ( 'paged' == self::$settings['view'] ) {

			echo self::render_paged_events($all_events);

		} elseif ( 'month' == self::$settings['view'] ) {

			echo self::render_month_events( $all_events );

		}
		
		wp_die();
	}
		
	/**
	 * get_settings
	 * 
	 * get the filters and store to instance settings
	 *
	 * @param  mixed $override
	 * @return void
	 */
	private static function get_settings( $override = [] ) {

		$_supertag = filter_input( INPUT_GET , '_supertag' );
		$_view = filter_input( INPUT_GET , '_view' );
		$_city = filter_input( INPUT_GET , '_city' );
		$_type = filter_input( INPUT_GET , '_type' );
		$_keyword = filter_input( INPUT_GET , '_keyword' );
		$_page = filter_input( INPUT_GET , '_page' , FILTER_SANITIZE_NUMBER_INT );
		$_month = filter_input( INPUT_GET , '_month' , FILTER_SANITIZE_NUMBER_INT );


		// change the view if, on load, either the _page or _month param is detected
		if( $_page ) {
			$_view = 'paged';
		} elseif ($_month ) {
			$_view = 'month';
		}

		self::$settings = [
			'supertag' => $_supertag ? $_supertag : null,
			'view'	=> $_view ? $_view : self::$default_view,	// use default if not set
			'city' => $_city,
			'type' => $_type,
			'keyword' => $_keyword ? strtolower( $_keyword ) : null,
			'page' => ($_page > 0 ? $_page : 1),				// use 1 if not set or zero
			'month' => $_month ? $_month : date( 'Ym' ),		// use current month if not set
			'per_page' => self::$per_page,
		];

		// if override is needed (for shortcode) apply them
		self::$settings = shortcode_atts( 
			self::$settings,
			$override
		);
	
	}
	
	/**
	 * event_filter
	 *
	 * @param  mixed $events
	 * @return void
	 */
	private static function event_filter( $events ) {


		$_city = self::$settings['city'] ? explode(',',self::$settings['city']) : [];
		$_type = self::$settings['type'] ? explode(',',self::$settings['type']) : [];
		$keyword = self::$settings[ 'keyword' ];

		// filter if city is set
		if (sizeof($_city)>0) {
			$events = array_filter( 
				$events , 
				function( $event ) use ($_city) { 
					return sizeof(array_intersect( $_city , array_map('sanitize_title' , $event[ 'city_tag' ] ) )) > 0; 
				}
			);
		}

		// filter (even more) if type is set
		if (sizeof($_type)>0) {
			$events = array_filter( 
				$events , 
				function( $event ) use ($_type) { 
					return sizeof(array_intersect( $_type , array_map( 'sanitize_title' , $event[ 'type' ] ) )) > 0; 
				}
			);
		}

		if ( $keyword ) {
			$events = array_filter(
				$events,
				function( $event ) use ( $keyword ) {
					// note that we return the inverse of the test if keyword wasn't found. 
					// because, of course, if it IS false (not found) the test returns TRUE, and we need the opposite
					return !( strpos( $event[ 'keywordsearch' ] , $keyword ) === false );
				}
			);
		}

		if ( 'paged' == self::$settings['view'] ) {

			// slice to the pagination
			$events = array_chunk( $events , self::$settings['per_page'] , true );
			
		} 

		elseif ( 'month' == self::$settings['view'] ) {

			$_month = self::$settings['month'];

			// events after filtering for month
			$events = array_filter( $events , function( $event ) use ( $_month ) { return strpos( $event[ 'sort_date' ] , $_month ) === 0; } );

			if ( sizeof($events) == 0 ) {

				// find first event in full $events list with a date larger than our $_month+31 (yyyymm31)

				// reverse $events, find first date smaller than $_month+01 (reverse because otherwise the first item will be returned)

			}
			

		}

		return $events;

	}
		
	/**
	 * events_list
	 *
	 * @param  mixed $atts
	 * @return void
	 */
	public static function event_shortcode( $atts ) {

		
		$atts = shortcode_atts( 
			[
				'view'		=> self::$default_view,
				'refresh' 	=> self::$refresh,	// force a transient refresh on each request
				'supertag' 	=> null,			// show events with this supertag only
				'id'		=> uniqid( 'son-event-' ),	// create id if needed
				'switch'	=> 'true',
				
			],
			$atts
		);
		
		
		// get url params for later use, override certain settings with shortcode settings
		self::get_settings( [ 
								'supertag' => $atts[ 'supertag' ],
							]);


		StyleScript::enqueue();
		
		$event_list = [];
		// collect city_tag
		$city_tag = [];
		$type_tag = [];
		
		$events = self::get_events( $atts[ 'refresh' ] );
		
		// get all tags from the events
		if ($events) {
			foreach ($events as $event) {
				$city_tag = array_merge( $city_tag , $event[ 'city_tag' ] );				
				$type_tag = array_merge( $type_tag , $event[ 'type' ] );
			}
		}

		$city_tag = self::clean_array( $city_tag );
		$type_tag = self::clean_array( $type_tag );
		
		// $city_tag_control = self::dropdown( $city_tag , '_city' , 'City' );
		// $type_tag_control = self::dropdown( $type_tag , '_type' , 'Event Type' );

		$city_tag_control = self::multiselect( $city_tag , '_city' , 'City' );
		$type_tag_control = self::multiselect( $type_tag , '_type' , 'Event Type' );

		$keyword = self::keywordinput();
		
		// lets try figuring out how far we can move ahead
		$last = array_pop($events);
		
		if ( 'paged' == self::$settings[ 'view' ] ) {

			// filter events with our selections
			$events = self::event_filter( $events );
			
			$listings = self::render_paged_events($events);
		} 
		elseif ( 'month' == self::$settings[ 'view' ] ) {


			// now filter our events
			$events = self::event_filter( $events );

			$listings = self::render_month_events($events);

		}

		$lowerbound = date( 'Ym' );		// get lower bound, disable prev button
		$upperbound = self::reformat( $last[ 'sort_date' ] , 'Ymd' , 'Ym' );

		$month = self::$settings['month'];
		$view = self::$settings[ 'view' ];

		$switch_view = ('true' == $atts[ 'switch' ] ? <<<EOT
		<div id="switch_view" data-current="{$atts['view']}">
			<a href="#" class="switch-view switch-view-paged" data-view="paged">paged</a>
			<a href="#" class="switch-view switch-view-month" data-view="month">month</a>
		</div>
		EOT : '');
		
		return 	<<<EOT
				<div id="{$atts[ 'id' ]}" 
					data-supertag="{$atts[ 'supertag' ]}" 
					data-view="{$view}" 
					data-month="{$month}"
					data-lowerbound="{$lowerbound}"
					data-upperbound="{$upperbound}" 
					class="sonoma-events-container">
					<div id="event-filters">
						<div id="filter_list">
						</div>
						<div id="keyword">
							{$keyword}
						</div>
						<p>Filter By:</p>
						<div id="city_tag">
							<button class="facet-toggle"> <h4 class="facet-title">City</h4><span class="facet-toggle-sign">+</span> </button>
							<fieldset>
								<legend class="sr-only">City</legend>
								{$city_tag_control}
							</fieldset>
						</div>
						<div id="type_tag">
							<button class="facet-toggle"> <h4 class="facet-title">Type</h4><span class="facet-toggle-sign">+</span> </button>
							<fieldset>
								<legend class="sr-only">City</legend>
								{$type_tag_control}
							</fieldset>
						</div>
					</div>
					{$switch_view}
					<div id="switch_month" data-current="{$month}">
						<span id="current-month"></span>
						<span class="loading">loading data</span>
						<nav aria-label="Calendar Month Navigation">
							<a href="#" class="previous nav-month"><span class="sr-only">Previous Month</span></a>
							<a href="#" class="next nav-month"><span class="sr-only">Next Month</span></a>
						</nav>
					</div>
					<div id="listing">
						{$listings}
					</div>
					<template id="month-no-results">
						<h2>Sadly there are no results for this month</h2>
						<p>This may be because of your filters, or simply because there are no events planned yet</p>
						<p>You can <a href="#" class="switch-view" data-view="paged">switch to paged view</a> and try to find what you're looking for.</p>
					</template>
					<template id="paged-no-results">
						<h2>Sadly there are no results for your filter settings</h2>
						<p>Try deselecting filters to get more results.</p>
					</template>
				</div> 
				<script>
					(function($) { 
						$(document).ready( function() {
							new SonomaEvents({ id : "{$atts[ 'id' ]}" , view: "{$atts[ 'view' ]}" });
						});
					})(jQuery);
				</script>
		EOT;
	}
	
	/**
	 * render_paged_events
	 *
	 * @param  mixed $events
	 * @return void
	 */
	private static function render_paged_events( $events ) {

		// use an array to build listing
		$event_list = [];

		foreach ($events[ (self::$settings['page'] - 1) ] as $event ) {
			$event_list[] = self::render_paged_list_item( $event );
		}
		// render the chunck of events
		$listings = implode( '', $event_list );

		if ( $listings ) {
			
			// add the pagination after
			$listings .= self::pagination( $events , self::$settings['page'] );
		}

		return $listings;

	}
	
	/**
	 * render_month_events
	 *
	 * @param  mixed $events
	 * @return void
	 */
	private static function render_month_events( $events ) {

		// use an array to build listing
		$event_list = [];

		foreach ($events as $event ) {
			$event_list[] = self::render_month_list_item( $event );
		}

		// render the chunck of events
		$listings = implode('', $event_list);

		if (!$listings) {
			return '';
		} else {
			return "<table>". 
					$listings.
					"</table>";
		}
		
	}

	/**
	 * render_paged_list_item
	 *
	 * @param  mixed $event
	 * @return void
	 */
	private static function render_paged_list_item( $event ) {

		// make sure we use only Year and Month here
		$year_month = self::reformat( $event[ 'sort_date' ] , 'Ymd' , 'Ym' );

		$item = '';
		// check if last date is different from our event date
		if ( 
			self::$last_date !== $year_month && 
			'paged' == self::$settings[ 'view' ] 
		) {
			// add heading
			$item .= self::paged_list_heading( $event );
			self::$last_date = $year_month;
		}

		$item .= self::paged_list_item( $event );

		return apply_filters( 'sonoma-events/paged/list-item' , $item , $event , self::$settings );
	}


	/**
	 * render_month_list_item
	 *
	 * @param  mixed $event
	 * @return void
	 */
	private static function render_month_list_item( $event ) {

		$item = '';
		// check if last date is different from our event date
		if ( 
			self::$last_date !== $event[ 'sort_date' ] && 
			'month' == self::$settings[ 'view' ] 
		) {
			// add heading
			$item .= self::month_list_heading( $event );
			self::$last_date = $event[ 'sort_date' ];
		}

		$type = implode( ', ',  $event[ 'type' ] );

		$item .= self::month_list_item( $event );

		return $item;
	}
	

	/**
	 * paged_list_heading
	 *
	 * @param  mixed $event
	 * @return void
	 */
	private static function paged_list_heading( $event ) {
		$date = self::reformat( $event[ 'sort_date' ] , 'Ymd' , 'Y-m' );
		$nice_date = self::reformat( $event[ 'sort_date' ] , 'Ymd' , 'F Y' );
		
		$heading = <<<EOT
			<div data-date="{$date}">
				<h2>{$nice_date}</h2>
			</div>
		EOT;

		return apply_filters( 'sonoma-events/paged/list-item-heading' , $heading , $event , self::$settings );

	}

	/**
	 * paged_list_item
	 *
	 * @param  mixed $event
	 * @return void
	 */
	private static function paged_list_item( $event ) {

		$event_time = 'all-day';

		if ($event[ 'start_time_pm' ] && $event[ 'end_time_pm' ] ) {
			$event_time = $event[ 'start_time_pm' ] . ' - ' . $event[ 'end_time_pm' ];
		}

		$nice_date = self::reformat( $event[ 'sort_date' ] , 'Ymd' , 'F j, Y' );


		$item = <<<EOT
		<div>
				<h4><a href="{$event['permalink']}">{$event['post_title']}</a></h4>
				{$nice_date} {$event_time}
		</div>
		EOT;

		return apply_filters( 'sonoma-events/paged/list-item' , $item , $event , self::$settings );

	}
	
	/**
	 * month_list_heading
	 *
	 * @param  mixed $event
	 * @return void
	 */
	private static function month_list_heading( $event ) {
		$date = self::reformat( $event[ 'sort_date' ] , 'Ymd' , 'Y-m-d' );
		$nice_date = self::reformat( $event[ 'sort_date' ] , 'Ymd' , 'F j, Y' );
		$weekday = self::reformat( $event[ 'sort_date' ] , 'Ymd' , 'l' );
		
		$heading = <<<EOT
			<tr data-date="{$date}">
				<th colspan="2">
					{$nice_date} {$weekday}
				</th>
			</tr>
		EOT;

		return apply_filters( 'sonoma-events/month/list-item-heading' , $heading , $event , self::$settings );

	}
	
	/**
	 * month_list_item
	 *
	 * @param  mixed $event
	 * @return void
	 */
	private static function month_list_item( $event ) {

		$event_time = 'See Details';

		if ($event[ 'start_time_pm' ] && $event[ 'end_time_pm' ] ) {
			$event_time = $event[ 'start_time_pm' ] . ' - ' . $event[ 'end_time_pm' ];
		}

		$item = <<<EOT
		<tr>
			<td class="list-event-time">
				{$event_time}
			</td>
			<td class="list-event-title">
				<a href="{$event['permalink']}"><h2 class="event-title">{$event['post_title']}</h2><small class="event-city">{$event['city']}, {$event['state']}</small></a>
			</td>
		</tr>
		EOT;
		return apply_filters( 'sonoma-events/month/list-item' , $item , $event , self::$settings );

	}


	
	/**
	 * pagination
	 *
	 * https://stackoverflow.com/questions/7131517/add-ellipsis-in-php-pagination
	 * @param  mixed $all_events
	 * @param  mixed $current
	 * @return void
	 */
	private static function pagination( $all_events , $current ) {

		$return = 	'<div class="son-pagination">'.
					'<ul>';

		$radius = 5;
		$total = sizeof( $all_events );

		for($i = 1; $i <= $total; $i++){
		  if(($i >= 1 && $i <= $radius) || ($i > $current - $radius && $i < $current + $radius) || ($i <= $total && $i > $total - $radius)){
			if($i == $current) {
				$return .= '<li class="son-page son-active" data-page="'.( $i ).'">'. ($i) .'</li>';
			} else {
				$return .= '<li class="son-page" data-page="'.( $i ).'">'. ($i) .'</li>';

			}
		  }
		  elseif($i == $current - $radius || $i == $current + $radius) {
			$return .= "<li>...</li>";
		  }
		}


		$return .= '</ul>' .
					'</div>';

		return $return;
	}
		
	/**
	 * dropdown
	 *
	 * @param  mixed $values
	 * @param  mixed $param
	 * @param  mixed $placeholder
	 * @return void
	 */
	private static function dropdown( $values , $param , $placeholder = '' ) {
		$dropdown = "<select name=\"{$param}\">";
		$dropdown .= "<option value=\"\">-- {$placeholder} --</option>";
		foreach( $values as $value ) {
			$selected = selected( $value , filter_input( INPUT_GET , $param ) , false );
			$dropdown .= "<option value=\"{$value}\" $selected>{$value}</option>";
		}
		$dropdown .= "<select>";
		return $dropdown;
	}

	private static function multiselect( $values , $param , $placeholder = '' ) {

		$param_values = filter_input( INPUT_GET , $param );

		$param_values = $param_values ? explode( ',' , $param_values ) : [];

		$options = '<div>';
		foreach( $values as $value ) {
			$slug = \sanitize_title( $value );
			$checked = checked( true , in_array( $slug , $param_values ) , false );
			$options .= <<<EOT
				<div>
					<input type="checkbox" name="{$param}[]" id="{$param}-{$slug}" value="{$slug}" $checked/>
					<label for="{$param}-{$slug}">{$value}</label>
				</div>
				EOT;
		}
		$options .= '</div>';
		return $options;
	}

	private static function keywordinput() {
		$value = self::$settings[ 'keyword' ];
		return <<<EOT
			<input type="text" value="{$value}" placeholder="Search" />
		EOT;
	}
		
	/**
	 * clean_array
	 * 
	 * dedupe, remove empty values and sort alfabetically
	 *
	 * @param  mixed $array
	 * @return void
	 */
	private static function clean_array( $array ) {
		$array = array_unique( $array );
		$array = array_filter( $array , function( $value ) { return $value !== ''; } );
		asort($array);
		return $array;
	}
		
	/**
	 * get_events
	 *
	 * @param  mixed $refresh
	 * @return void
	 */
	public static function get_events( $refresh = false ) {
		
		// check dependency
		if ( !function_exists( 'get_field' ) ) return 'shortcode needs ACF Pro to work.';
		
		// if a supertag has been set try to get the transient and return early
		if ( self::$settings['supertag'] ) {
			if ( \get_transient( 'sonoma_events_sorted_tag_' . self::$settings['supertag'] ) && !$refresh ) {
				return \get_transient( 'sonoma_events_sorted_tag_' . self::$settings['supertag'] );
			}
		} else {
			if ( \get_transient( 'sonoma_events_sorted' ) && !$refresh ) {
				return \get_transient( 'sonoma_events_sorted' );
			}
		}
		
		$args = [
			'post_type' => 'events',
			'numberposts' => -1,
			'order' => 'ASC',
			'orderby' => 'future_date_clause',
			'meta_query' => [
				'relation' => 'AND',
				'future_date_clause' => [
					'key' => 'end_date',
					'value' => date('Ymd'),
					'compare' => '>=',
					'type' => 'DATE',
				]
			],
			'fields' => 'ids',
		];

		// also, if supertag is set, merge into array
		if ( self::$settings['supertag'] ) {
			$supertags = explode(',',self::$settings['supertag']);
			$args = array_merge( $args , [ 'post__in' => self::postids_with_supertags($supertags) ] );
		}

		// get the posts
		$posts = get_posts( $args );

		if ( $posts && !is_a( $posts , 'WP_Error' ) ) {
			
			$all_posts = [];
			foreach ($posts as $post_id) {
				// get array of the events, but only for the future events
				$all_posts = array_merge( $all_posts , self::get_event_post_instances( $post_id ));
			}
			
			// order all_posts
			usort( $all_posts , [ __CLASS__ , 'sort_function' ]);
			
			if ( self::$settings['supertag'] ) {
				\set_transient( 'sonoma_events_sorted_tag_' . self::$settings['supertag'] , $all_posts , self::$expiration );
			} else {
				\set_transient( 'sonoma_events_sorted' , $all_posts , self::$expiration );
			}
			
			return $all_posts;
		}

		return false;
	}
		
	/**
	 * get_event_post_instances
	 *
	 * @param  mixed $post_id
	 * @return void
	 */
	protected static function get_event_post_instances( $post_id ) {
		
		$return = [];
		// get repeater event_dates
		$event_dates = \get_field( 'event_dates' , $post_id );
		if (!count( $event_dates)) return $return;
		// 
		$event_dates = array_filter( $event_dates, function( $instance ) { return self::reformat($instance[ 'event_date' ]) >= date( 'Ymd' ); }  );
		
		foreach ($event_dates as $instance ) {

			// add a sort date with time so we can sort them with start time
			// assume 00:00:00 when no start time is given so these display first
			$sort_date_time = (string)self::reformat($instance[ 'event_date' ]) . ' ' . ( $instance[ 'start_time' ] ? $instance[ 'start_time' ] : '00:00:00' );
			// add event to list
			$return[] = array_merge(
					[ 
						'ID' => 			$post_id,
						'post_title' => 	\get_the_title( $post_id ),
						'permalink' => 		\get_the_permalink( $post_id ),
						'address' => 		self::val_or_array_first(\get_post_meta( $post_id , 'address' , true )),
						'address2' => 		self::val_or_array_first(\get_post_meta( $post_id , 'address2' , true )),
						'city' => 			self::val_or_array_first(\get_post_meta( $post_id , 'city' , true )),
						'county' => 		self::val_or_array_first(\get_post_meta( $post_id , 'county' , true )),
						'state' => 			self::val_or_array_first(\get_post_meta( $post_id , 'state' , true )),
						'zip' => 			self::val_or_array_first(\get_post_meta( $post_id , 'zip' , true )),
						'latitude' => 		\get_post_meta( $post_id , 'latitude' , true ),
						'longitude' => 		\get_post_meta( $post_id , 'longitude' , true ),
						'type' =>			\array_map( function( $tag ) { return $tag[ 'supertag' ]; } , \get_field( 'supertags' , $post_id ) ),
						'city_tag' =>		[ self::val_or_array_first(\get_post_meta( $post_id , 'city' , true )) ],			// treat this as a tag/taxonomy so we can filter it
						'start_time_pm' => 	$instance[ 'start_time' ] ? self::to_pm( $instance[ 'start_time' ]) : '',			// time already converted to AM/PM
						'end_time_pm' => 	$instance[ 'end_time' ] ? self::to_pm( $instance[ 'end_time' ]) : '',				// time already converted to AM/PM
						'sort_date' => 		(string)self::reformat($instance[ 'event_date' ]),									// date formatted for easier sorting
						'sort_date_time' => $sort_date_time,									// date formatted for easier sorting
						'keywordsearch' =>	strtolower(\get_the_title( $post_id ) . ' ' . self::descriptions( $post_id ) . ' ' . \get_field( 'venue_name' , $post_id )),
					],
					$instance
				);
		}
		
		return $return;
	}

	private static function descriptions( $post_id ) {
		// get descriptions repeater field
		$descriptions = \get_field( 'descriptions' , $post_id );

		// flatten the descriptions
		$descriptions = array_map( function( $row ) { return $row[ 'description' ]; } , $descriptions );
		// strip all tags because we don't need those here
		$descriptions = array_map( 'wp_strip_all_tags' , $descriptions );
		// return concatenated descriptions
		return implode( ' ' , $descriptions );
	}


	/**
	 * get the value or - when it's an array - the first value because we don't like arrays
	 */
	private static function val_or_array_first( $value ) {
		if (is_array( $value )) {
			if ( count($value) > 0 ) {
				$value = array_pop(array_reverse( $value ));
			} else {
				$value = '';
			}
		}
		return $value;
	}
		
	/**
	 * sort_function
	 *
	 * @param  mixed $a
	 * @param  mixed $b
	 * @return void
	 */
	public static function sort_function( $a , $b ) {
		return ($a[ 'sort_date_time' ] > $b[ 'sort_date_time' ]) ? 1 : -1 ;
	}
	
	/**
	 * reformat our date field so we can compare with useable formats
	 */
	protected static function reformat( $date_input , $format_in = 'd/m/Y' , $format_out = 'Ymd' ) {
		/*
		*  Create PHP DateTime object from Date Piker Value
		*  this example expects the value to be saved in the format: yymmdd (JS) = Ymd (PHP)
		*/

		// $format_in = 'd/m/Y'; // the format your value is saved in (set in the field options)
		// $format_out = 'Ymd'; // the format you want to end up with

		$date = \DateTime::createFromFormat($format_in, $date_input );
		return $date->format( $format_out );		
	}
	
		
	/**
	 * to_pm
	 *
	 * @param  mixed $time
	 * @return void
	 */
	protected static function to_pm( $time ) {
		$currentDateTime = $time;
		$newDateTime = date('h:i A', strtotime($currentDateTime));
		
		return $newDateTime;
	}

	/**
	 *	return the postids/first col values by getting postids that have a meta key for supertag that matches our $supertag value 
	* 
	*/
	private static function postids_with_supertags($supertags) {
		global $wpdb;
		
		$meta_values = " AND (";
		foreach ($supertags as $index=>$supertag) {
			if ($index == 0 ) {
				$meta_values .= $wpdb->prepare("meta_value = %d" , $supertag);
			} else {
				$meta_values .= $wpdb->prepare(" OR meta_value = %d" , $supertag);
			}
		}
		
		$meta_values .= ")";
		
		$results = $wpdb->get_col( ( "SELECT DISTINCT post_id FROM {$wpdb->prefix}postmeta WHERE meta_key LIKE 'supertags_%_supertag_id' {$meta_values};" ) );
		
		return $results;
	}	

}

