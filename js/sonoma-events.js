(function($){

    SonomaEvents = function( settings ) {
        this.settings = settings;
        this._init();
    }

    SonomaEvents.prototype =  {

        settings        : {},
        source          : null,
        target          : null,
        timeOut         : null,

        _init: function() {

            this.settings = {
                id : this.settings?.id || "auto-id-" + Math.random().toString(16),
                view : this.settings?.view || "paged",
            }; 

            this.target = document.querySelector( '#' + this.settings.id );

            this.listing = this.target.querySelector( '#listing' );

            this.previous = this.target.querySelector( '#switch_month a.previous' );
            this.next = this.target.querySelector( '#switch_month a.next' );

            this.citytag = this.target.querySelectorAll( '#city_tag input' );
            this.typetag = this.target.querySelectorAll( '#type_tag input' );

            this.keyword = this.target.querySelector( '#keyword input' );
            this.resetfilters = this.target.querySelector( '#reset_filters button' );

            this.source = SONOMAEVENTS.admin_ajax + '?action=sonoma-events';
            this.view = this.target.dataset.view;

            this.settings.upperbound = this.target.dataset?.upperbound || null;
            this.settings.lowerbound = this.target.dataset?.lowerbound || null;

            this.setMonthNavigation();

            this.addListeners();

            this.addHook( 'afterPagination' , this.scrollTop );
            this.addHook( 'afterInit' , this.currentMonthHeader.bind( this ) );
            this.addHook( 'afterInit' , this.handleEmptyListings.bind( this ) );
            this.addHook( 'beforeCollect' , this.currentMonthHeader.bind( this ) );

            // add and remove updating class
            this.addHook( 'beforeCollect' , this.addUpdatingClass.bind( this ) );
            this.addHook( 'afterUpdate' , this.removeUpdatingClass.bind( this ) );

            this.triggerHook( 'afterInit' );

        },

        addListeners: function() {

            
            const _this = this;
            
            // this.target.querySelector( '#city_tag select' ).addEventListener( 'change' , this.collect.bind( this ) );
            // this.target.querySelector( '#type_tag select' ).addEventListener( 'change' , this.collect.bind( this ) );

            this.target.querySelectorAll( '#city_tag input' ).forEach( elem =>
                elem.addEventListener( 'click' , _this.collectTimed.bind( _this ) )
            );

            this.target.querySelectorAll( '#type_tag input' ).forEach( elem =>
                elem.addEventListener( 'click' , this.collectTimed.bind( _this ) )
            );

            // keyword search
            if (this.keyword ) this.keyword.addEventListener( 'keyup' , this.collectTimed.bind( _this ) );

            // pagination
            this.target.addEventListener( 'click' , this.pagination.bind( _this ) );
            // change months
            this.target.addEventListener( 'click' , this.changeMonth.bind( _this ) );
            // switch view
            this.target.addEventListener( 'click' , this.switchView.bind( _this ) );

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
            this.timeOut = setTimeout( function() {
                this.collect( event , page );
            }.bind(this), 500 );

        },

        /**
         * Collect the settings before doing an ajax request
         */
        collect: function( event, page ) {

            let params = { 
                _city : this.multiValue( '_city').join(','),//this.target.querySelector( '#city_tag select' ).value,
                _type : this.multiValue( '_type').join(',')//this.target.querySelector( '#type_tag select' ).value,
                // _city : this.target.querySelector( '#city_tag select' ).value,
                // _type : this.target.querySelector( '#type_tag select' ).value,
            };

            if ( 'paged' == this.view ) {
                params = { ...params , ...{ _page : page || 1, } };
            } else if ( 'month' == this.view ) {
                params = { ...params , ...{ _month : this.month } };
            }

            if ( this.keyword.value ) {
                params = { ...params , ...{ _keyword : this.keyword.value } };
            }

            // add this due to async nature of the class
            var _this = this;

            _this.triggerHook( 'beforeUpdate' );
            $.ajax( {
                url: this.source + '&_view=' + _this.view + '&' + '&_supertag=' + _this.target.dataset.supertag + '&' + new URLSearchParams(params).toString(),
                method: 'GET',
                dataType: 'html',
            } ).done( function( html ) {
                _this.renderListingContent( html );
                _this.updatePushURL(params);
                _this.triggerHook( 'afterUpdate' );
            });
            
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

        pagination: function( event ) {

            if (event.target.classList.contains( 'son-page' ) ) {
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
            
            const year = String(num).slice(0,4);            // from start to 4th position
            const month = monthMap[String(num).slice(4)];   // from 4 to the end
            
            return month + " " + year;
        },

        currentMonthHeader: function() {
            const current = this.target.querySelector('#switch_month').dataset.current;
            this.target.querySelector('#current-month').innerHTML = this.numberToMonth( current );
        },

        scrollTop: function() {
            document.body.scrollTop = 0; // For Safari
            document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
        },
        
		triggerHook: function( hook, args )
		{
			$( 'body' ).trigger( 'sonoma-events.' + hook, args );
		},

		addHook: function( hook, callback )
		{
			$( 'body' ).on( 'sonoma-events.' + hook, callback );
		},

		removeHook: function( hook, callback )
		{
			$( 'body' ).off( 'sonoma-events.' + hook, callback );
		},        

    }

})(jQuery);
