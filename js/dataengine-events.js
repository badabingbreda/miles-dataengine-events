(function($){

    DataEngineEvents = function( settings ) {
        this.settings = settings;
        this._init();
    }

    DataEngineEvents.prototype =  {

        settings        : {},
        source          : null,
        target          : null,
        timeOut         : null,
        updateDelay     : 500,

        _init: function() {

            this.settings = {
                id : this.settings?.id || "auto-id-" + Math.random().toString(16),
                view : this.settings?.view || "paged",
            }; 

            this.target = document.querySelector( '#' + this.settings.id );

            this.supertag = this.target.dataset.supertag;

            this.filter_list = this.target.querySelector( '#filter_list' );
            this.listing = this.target.querySelector( '#listing' );
            this.pagination = this.target.querySelector( '#pagination' );

            this.previous = this.target.querySelector( '#switch_month a.previous' );
            this.next = this.target.querySelector( '#switch_month a.next' );

            this.citytag = this.target.querySelectorAll( '#city_tag input' );
            this.typetag = this.target.querySelectorAll( '#type_tag input' );

            this.keyword = this.target.querySelector( '#keyword input' );
            this.resetfilters = this.target.querySelector( '#reset_filters button' );

            this.source = DATAENGINEEVENTS.admin_ajax + '?action=dataengine-events';
            this.view = this.target.dataset.view;

            this.settings.upperbound = this.target.dataset?.upperbound || null;
            this.settings.lowerbound = this.target.dataset?.lowerbound || null;

            this.setMonthNavigation();
				
			this.toggleFacetOptions();

            this.addListeners();

            this.addHook( 'afterPagination' , this.scrollTop );
            this.addHook( 'afterInit' , this.currentMonthHeader.bind( this ) );
            this.addHook( 'afterInit' , this.handleEmptyListings.bind( this ) );
            this.addHook( 'afterInit' , this.filterTagsUpdate.bind( this ) );
            this.addHook( 'beforeCollect' , this.currentMonthHeader.bind( this ) );

            // add and remove updating class
            this.addHook( 'beforeCollect' , this.addUpdatingClass.bind( this ) );
            this.addHook( 'afterUpdate' , this.removeUpdatingClass.bind( this ) );

            this.triggerHook( 'afterInit' );

        },

        addListeners: function() {

            const _this = this;
			
            $('#city_tag input').on("click", () => this.handleTagClicked());
			$('#type_tag input').on("click", () => this.handleTagClicked());
            
			$(this.keyword).on("input", () => this.collectTimed());

            // pagination
            this.target.addEventListener( 'click' , this.handlePaginationClick.bind( _this ) );
            // change months
            this.target.addEventListener( 'click' , this.changeMonth.bind( _this ) );
            // switch view
            this.target.addEventListener( 'click' , this.switchView.bind( _this ) );

            // switch view
            this.target.addEventListener( 'click' , this.handleRemoveFilterTagClick.bind( _this ) );


            if ( this.resetfilters ) this.resetfilters.addEventListener( 'click' , this.resetFilters.bind( _this ) );

        },

        /**
         * use a timed collect so that we can click multiselect without too many requests
         * 
         * @param {*} event 
         * @param {*} page 
         */
        collectTimed: function( event , page ) {
            clearTimeout( this.timeOut );
            this.triggerHook( 'beforeCollect' );
			
			// Check if filters are applied
            if (this.multiValue('_city').length > 0 || 
                this.multiValue('_type').length > 0 || 
                (this.keyword && this.keyword.value.length > 0)) {
                this.view = 'paged';  // Switch view to 'paged' if any filter is applied
            }
			
			
            this.timeOut = setTimeout(() => {
                this.filterTagsUpdate();
                this.collect(event, page);
            }, this.updateDelay );

        },

        /**
         * Collect the settings before doing an ajax request
         */
        collect: function( event, page ) {
			
			// Switch to paged view if any of the filters are used
			if (this.multiValue('_city').length > 0 || 
                this.multiValue('_type').length > 0 || 
                this.keyword.value) {
				this.view = "paged";
				this.target.dataset.view = this.view;
// 				this.setMonthNavigation();  // If needed
			}

            let params = { 
                _city : this.multiValue( '_city').join(','),
                _type : this.multiValue( '_type').join(','),
                // _city : this.target.querySelector( '#city_tag select' ).value,
                // _type : this.target.querySelector( '#type_tag select' ).value,
            };

            if ( 'paged' == this.view ) {
                params = { ...params , ...{ _page : page || 1, } };
            } else if ( 'month' == this.view ) {
                params = { ...params , ...{ _month : this.month } };
            } else if ( 'grid' == this.view ) {
                params = { ...params , ...{ _grid : page || 1, } };
            }



            if ( this.keyword.value ) {
                params = { ...params , ...{ _keyword : this.keyword.value } };
            }

            // add this due to async nature of the class
            var _this = this;

            _this.triggerHook( 'beforeUpdate' );
            $.ajax( {
                url: this.source + 
                        '&_view=' + _this.view + 
                        '&_supertag=' + _this.target.dataset.supertag + 
                        '&' + new URLSearchParams(params).toString(),
                method: 'GET',
                dataType: 'html',
            } ).done( function( data ) {
                data = JSON.parse(data);
                _this.renderListingContent( data.listing );
                _this.renderPaginationContent( data.pagination );
                _this.updatePushURL(params);
                _this.triggerHook( 'afterUpdate' );
            });
            
        },

        createElement: function( str , type, value , label ) {
            var frag = document.createDocumentFragment();
        
            var elem = document.createElement('div');

            str = str.replaceAll( /\{\{value\}\}/gi , value );
            str = str.replaceAll( /\{\{label\}\}/gi , label );
            str = str.replaceAll( /\{\{type\}\}/gi , type );

            elem.innerHTML = str;
        
            while (elem.childNodes[0]) {
                frag.appendChild(elem.childNodes[0]);
            }
            return frag;
        } ,       

        handleTagClicked: function( event ) {
            this.collectTimed( event );
        },

        handleRemoveFilterTagClick: function(event) {
			// Find the closest '.filter-list-item-remove' element up the DOM tree
			let closestElement = event.target.closest('.filter-list-item-remove');

			if (closestElement) {
				event.preventDefault();

				// Get the type
				let type = closestElement.dataset.type;

                if ( type == 'keyword' ) {
                    // remove keyword value
                    this.keyword.value = '';

                } else {

                    // Disable the item in the list
                    this[type + 'tag'].forEach(
                        elem => {
                            if (elem.value == closestElement.dataset.value) elem.checked = false;
                        }
                    );
                }

				this.collectTimed();
			}
		},     

        filterTagsUpdate: function() {
            const list_item_template = this.target.querySelector( 'template#filter_list_item' ).innerHTML;
            
            if ( this.filter_list ) {
                
                this.filter_list.innerHTML = '';
                
                // this.
                // collect tags and bring to tag_list
                var nodes = this.target.querySelectorAll( `input[name="_city[]"]:checked`);
                nodes.forEach( elem => {
                    var tagLabel = elem.parentElement.querySelector( 'label' ).innerHTML,
                        valueToRemove = elem.value;                  

                    var newTag = this.createElement( list_item_template , 'city', valueToRemove , tagLabel );

                    this.filter_list.appendChild( newTag );  
                } );

                // collect tags and bring to tag_list
                var nodes = this.target.querySelectorAll( `input[name="_type[]"]:checked`);
                nodes.forEach( elem => {
                    var tagLabel = elem.parentElement.querySelector( 'label' ).innerHTML,
                        valueToRemove = elem.value;                  

                    var newTag = this.createElement( list_item_template , 'type', valueToRemove , tagLabel );

                    this.filter_list.appendChild( newTag );  
                } );
				
                if (this.keyword && this.keyword.value !== '' ) {
                    var newTag = this.createElement( list_item_template , 'keyword', '' , this.keyword.value );
                    this.filter_list.appendChild( newTag );
                }

                // Show or hide the filter_list based on its content
				if (this.filter_list.childNodes.length > 0) {
					this.filter_list.style.display = 'block';
				} else {
					this.filter_list.style.display = 'none';
				}


            }

        },

        addUpdatingClass: function() {
            this.target.classList.add( 'updating' );
        },
        
        removeUpdatingClass: function() {
            this.target.classList.remove( 'updating' );
        },

        renderListingContent: function( html ) {
            if ( html.trim() == '') {
                this.triggerHook( 'listingNoResults' , this.view );
                if ( 'month' == this.view ) {
                    let temp = this.target.querySelector( '#month-no-results' );
                    this.listing.innerHTML = temp.innerHTML;
                }
                else if ( 'paged' == this.view ) {
                    let temp = this.target.querySelector( '#paged-no-results' );
                    this.listing.innerHTML = temp.innerHTML;
                }
            } else {
                this.listing.innerHTML = html;
            }
        },

        renderPaginationContent: function( html ) {
            this.pagination.innerHTML = html;
        },

        handleEmptyListings: function() {
            this.renderListingContent( this.listing.innerHTML );
        },

        resetFilters: function() {
            this.keyword.value = '';
            this.citytag.forEach( elem => elem.checked = false );
            this.typetag.forEach( elem => elem.checked = false );
            this.collectTimed( null );
        },

        /**
         * get the values of multicheckboxes
         * @param {*} param 
         */
        multiValue: function( param ) {
            values = [];
            const nodes = this.target.querySelectorAll( `input[name="${param}[]"]:checked`);
            nodes.forEach( elem => values.push(elem.value) );
            return values;
        },

        handlePaginationClick: function( event ) {

            if (event.target.classList.contains( 'event-page' ) ) {
                event.preventDefault();
                this.collectTimed( null, event.target.dataset.page );
                this.triggerHook( 'afterPagination' );
            }

        },

        changeMonth: function ( event ) {

            if (event.target.classList.contains( 'nav-month' ) ) {
                event.preventDefault();
                // if also disabled return early
                if (event.target.classList.contains( 'disabled' )) return;
                this.target.dataset.month = event.target.dataset.month;
                this.target.querySelector( '#switch_month' ).dataset.current = event.target.dataset.month;
                // reset the month navigation because it has changed
                this.setMonthNavigation();
                this.collectTimed();
            }

        },

        switchView: function (event) {

            if (event.target.classList.contains( 'switch-view' ) ) {
                event.preventDefault();
                this.view = event.target.dataset.view;
                this.target.dataset.view = this.view;
				
				// Reset filters if switching to month view
				if (this.view === 'month') {
					this.resetFilters();
				}
				
                this.setMonthNavigation();
                this.collectTimed();
            }

        },

        updatePushURL: function( params ) {

            if ( history.pushState ) {
              let compoundstring = [];
              for ( const[key,value] of Object.entries(params)) {
                if (value) compoundstring.push( `${key}=${value}` );
              }
    
              let compound  = (compoundstring.length === 0) ? '' : '?' + compoundstring.join( '&' );
              var newurl = window.location.protocol + "//" + window.location.host + window.location.pathname + compound ;
              window.history.pushState({path:newurl},'',newurl);
            }
    
        }, 
        
        setMonthNavigation: function() {

            this.month = this.target.dataset.month;

            // get year and month from our settings
            let year = this.month.slice(0,4),
                month = this.month.slice(4);

            const date = new Date( `${year}-${month}-01T00:00:00` );

            const previous = this.addMonths( date , -1 ),
                    next = this.addMonths( date, 1 );

            this.previous.dataset.month = `${this.dateFormated(previous)}`;
            this.next.dataset.month = `${this.dateFormated(next)}`;

            if (this.previous.dataset.month < this.target.dataset.lowerbound ) {
                this.previous.classList.add( 'disabled' );
            } else {
                this.previous.classList.remove( 'disabled' );
            }

            if (this.next.dataset.month > this.target.dataset.upperbound ) {
                this.next.classList.add( 'disabled' );
            } else {
                this.next.classList.remove( 'disabled' );
            }

        },

        addMonths: function(date, months) {
            var newDate = new Date( date.getTime() );
            newDate.setMonth(newDate.getMonth() + months);
            return newDate;
        },

        dateFormated: function( date ) {
            var year = date.toLocaleString("default", { year: "numeric" });
            var month = date.toLocaleString("default", { month: "2-digit" }); 
            return `${year}${month}`;
        },

        numberToMonth: function(num) {
            const monthMap = {
                '01': 'January',
                '02': 'February',
                '03': 'March',
                '04': 'April',
                '05': 'May',
                '06': 'June',
                '07': 'July',
                '08': 'August',
                '09': 'September',
                '10': 'October',
                '11': 'November',
                '12': 'December'
            };
            
            const year = String(num).slice(0,4);            // YYYMM - from start to 4th position to get year
            const month = monthMap[String(num).slice(4)];   // YYYMM - from 4th to the end
            
            return month + " " + year;
        },

        currentMonthHeader: function() {
            const current = this.target.querySelector('#switch_month').dataset.current;
            this.target.querySelector('#current-month').innerHTML = this.numberToMonth( current );
        },
				
		toggleFacetOptions: function() {
            const _this = this;
            $('.event-facet').on('click', '.facet-toggle', function(event) {
                event.preventDefault();  // Prevent the default action
                event.stopPropagation();  // Stop any other bound event

                const fieldset = $(this).closest('.event-facet').find('fieldset');
                const toggleSign = $(this).find('.facet-toggle-sign');

                // Change the +/- symbol depending on the state
                if (fieldset.is(':visible')) {
                    toggleSign.text('+');
                } else {
                    toggleSign.text('-');
                }

                // Toggle open/close the filter
                fieldset.slideToggle(350);
            });
        },

        scrollTop: function() {
            const headerHeight = $('header').outerHeight();
			let targetOffset = $('.dataengine-events-container').offset().top - headerHeight;

			$('html, body').animate({
				scrollTop: targetOffset
			}, 1000);
        },
        
		triggerHook: function( hook, args )
		{
			$( 'body' ).trigger( 'dataengine-events.' + hook, args );
		},

		addHook: function( hook, callback )
		{
			$( 'body' ).on( 'dataengine-events.' + hook, callback );
		},

		removeHook: function( hook, callback )
		{
			$( 'body' ).off( 'dataengine-events.' + hook, callback );
		},        

    }

})(jQuery);
