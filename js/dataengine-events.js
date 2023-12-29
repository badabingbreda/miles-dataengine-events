(function ($) {
  DataEngineEvents = function (settings) {
    this.settings = settings;
    this._init();
  };

  DataEngineEvents.prototype = {
    settings: {},
    source: null,
    target: null,
    timeOut: null,
    updateDelay: 500,

    _init: function () {
      this.settings = {
        id: this.settings?.id || "auto-id-" + Math.random().toString(16), // unique DOM id so we can target this instance
        view: this.settings?.view || "paged", // set the view type for the listing container(s)
        mapdata: this.setting?.mapdata || "dataengine_map_events", // variablename that will hold map object
        rendermap: false, // render the map by calling out to the API
        daterangepicker: false, // if daterange is enabled. Needed to know if we must get startdate and enddate
      };

      this.target = document.querySelector("#" + this.settings.id);

      this.supertag = this.target.dataset.supertag;

      this.filter_list = this.target.querySelector("#filter_list");
      this.listing = this.target.querySelector("#listing");
      this.map = this.target.querySelector("#event-map-container");
      this.mapObject = null;
      this.pagination = this.target.querySelector("#pagination");

      this.previous = this.target.querySelector("#switch_month a.previous");
      this.next = this.target.querySelector("#switch_month a.next");

      this.citytag = this.target.querySelectorAll("#city_tag input");
      this.typetag = this.target.querySelectorAll("#type_tag input");

      this.keyword = this.target.querySelector("#keyword input");
      this.resetfilters = this.target.querySelector("#reset_filters button");

      this.source = DATAENGINEEVENTS.admin_ajax + "?action=dataengine-events";
      this.view = this.target.dataset.view;

      this.settings.upperbound = this.target.dataset?.upperbound || null;
      this.settings.lowerbound = this.target.dataset?.lowerbound || null;

      // when we init this, make sure we have mapdata so we can switch to it using code
      this.data = { map: window[this.settings.mapdata] }; // init/last returned data

      this.setMonthNavigation();

      this.toggleFacetOptions();

      this.addListeners();

      this.addHook("afterPagination", this.scrollTop);
      this.addHook("afterInit", this.currentMonthHeader.bind(this));
      this.addHook("afterInit", this.handleEmptyListings.bind(this));
      this.addHook("afterInit", this.filterTagsUpdate.bind(this));
      if ( this.target.querySelector( '[name="daterange"]') ) {
        // init the daterangfe
        this.addHook( "afterInit", this.datarangeEnable.bind(this) );
      }
      this.addHook("beforeCollect", this.currentMonthHeader.bind(this));

      // add and remove updating class
      this.addHook("beforeCollect", this.addUpdatingClass.bind(this));
      this.addHook("afterUpdate", this.removeUpdatingClass.bind(this));

      this.triggerHook("afterInit");
    },

    addListeners: function () {
      const _this = this;

      $("#city_tag input").on("click", () => this.handleTagClicked());
      $("#type_tag input").on("click", () => this.handleTagClicked());

      $(this.keyword).on("input", () => this.collectTimed());

      // pagination
      this.target.addEventListener(
        "click",
        this.handlePaginationClick.bind(_this)
      );
      // change months
      this.target.addEventListener("click", this.changeMonth.bind(_this));
      // switch view
      this.target.addEventListener("click", this.switchView.bind(_this));

      // switch view
      this.target.addEventListener(
        "click",
        this.handleRemoveFilterTagClick.bind(_this)
      );

      if (this.resetfilters)
        this.resetfilters.addEventListener(
          "click",
          this.resetFilters.bind(_this)
        );

      // if there's a mapsapi configured, add an eventlistener so we can switch to map view (without an ajax call)
      if (DATAENGINEEVENTS.mapsapi) {
		    this.settings.rendermap = true;
        this.target.addEventListener("click", this.mapViewHandler.bind(_this));
        // disable pointer-events so we see a hand when we hover over something
        // the events are added using css when switching mapview
        this.map.style.pointerEvents = this.target.dataset.mapview == "true" ? "all" : "none";      
      }

    },

    /**
     * use a timed collect so that we can click multiselect without too many requests
     *
     * @param {*} event
     * @param {*} page
     */
    collectTimed: function (event, page) {
      clearTimeout(this.timeOut);
      this.triggerHook("beforeCollect");

      // Check if filters are applied
      if (
        this.multiValue("_city").length > 0 ||
        this.multiValue("_type").length > 0 ||
        (this.keyword && this.keyword.value.length > 0)
      ) {
        this.view = "paged"; // Switch view to 'paged' if any filter is applied
      }

      this.timeOut = setTimeout(() => {
        this.filterTagsUpdate();
        this.collect(event, page);
      }, this.updateDelay);
    },

    /**
     * Collect the settings before doing an ajax request
     */
    collect: function (event, page) {
      // Switch to paged view if any of the filters are used
      if (
        this.multiValue("_city").length > 0 ||
        this.multiValue("_type").length > 0 ||
        this.keyword.value
      ) {
        this.view = "paged";
        this.target.dataset.view = this.view;
		
        // 				this.setMonthNavigation();  // If needed
  	  }
 	  this.target.dataset.mapviewlatest = "false"; // void the mapviewlast so we know to redraw from this.data.map
	
      let params = {
        _city: this.multiValue("_city").join(","),
        _type: this.multiValue("_type").join(","),
        // _city : this.target.querySelector( '#city_tag select' ).value,
        // _type : this.target.querySelector( '#type_tag select' ).value,
      };

      if (this.settings.daterangepicker && this.view == 'paged' ) {
        let startdate = $('input[name="daterange"]').data('daterangepicker').startDate.format( 'MM/DD/YY' ).toString();
        let enddate = $('input[name="daterange"]').data('daterangepicker').endDate.format( 'MM/DD/YY' ).toString();
        // only add if either start or enddate has changed
        if ( startdate !== DATAENGINEEVENTS.mindate || enddate !== DATAENGINEEVENTS.defaultenddate ) {
          params = {
            ...params,
            ...{
              _startdate: startdate,
              _enddate: enddate,
            }
          }
        }
      }

      if ("paged" == this.view) {
        params = { ...params, ...{ _page: page || 1 } };
      } else if ("month" == this.view) {
        params = { ...params, ...{ _month: this.month } };
      } else if ("grid" == this.view) {
        params = { ...params, ...{ _grid: page || 1 } };
      }

      if (this.keyword.value) {
        params = { ...params, ...{ _keyword: this.keyword.value } };
      }

      // add this due to async nature of the class
      var _this = this;

      _this.triggerHook("beforeUpdate");
      $.ajax({
        url:
          this.source +
          "&_view=" +
          _this.view +
          "&_supertag=" +
          _this.target.dataset.supertag +
          "&" +
          new URLSearchParams(params).toString(),
        method: "GET",
        dataType: "html",
      }).done(function (data) {
        data = JSON.parse(data);
        _this.data = data;
        _this.renderListingContent(data.listing);
        _this.renderPaginationContent(data.pagination);
        _this.updatePushURL(params);
        _this.triggerHook("afterUpdate");
		if ( _this.settings.rendermap ) _this.renderMap();
      });
    },

    createElement: function (str, type, value, label) {
      var frag = document.createDocumentFragment();

      var elem = document.createElement("div");

      str = str.replaceAll(/\{\{value\}\}/gi, value);
      str = str.replaceAll(/\{\{label\}\}/gi, label);
      str = str.replaceAll(/\{\{type\}\}/gi, type);

      elem.innerHTML = str;

      while (elem.childNodes[0]) {
        frag.appendChild(elem.childNodes[0]);
      }
      return frag;
    },

    handleTagClicked: function (event) {
      this.collectTimed(event);
    },

    handleRemoveFilterTagClick: function (event) {
      // Find the closest '.filter-list-item-remove' element up the DOM tree
      let closestElement = event.target.closest(".filter-list-item-remove");

      if (closestElement) {
        event.preventDefault();

        // Get the type
        let type = closestElement.dataset.type;

        if (type == "keyword") {
          // remove keyword value
          this.keyword.value = "";
        } else if ( type== "startdate" ) {
          $( 'input[name="daterange"]' ).data( 'daterangepicker' ).setStartDate( DATAENGINEEVENTS.mindate );
          $( 'input[name="daterange"]' ).data( 'daterangepicker' ).setEndDate( DATAENGINEEVENTS.defaultenddate );
        } else {
          // Disable the item in the list
          this[type + "tag"].forEach((elem) => {
            if (elem.value == closestElement.dataset.value)
              elem.checked = false;
          });
        }

        this.collectTimed();
      }
    },

    filterTagsUpdate: function () {
      const list_item_template = this.target.querySelector(
        "template#filter_list_item"
      ).innerHTML;

      if (this.filter_list) {
        this.filter_list.innerHTML = "";

        // this.
        // collect tags and bring to tag_list
        var nodes = this.target.querySelectorAll(
          `input[name="_city[]"]:checked`
        );
        nodes.forEach((elem) => {
          var tagLabel = elem.parentElement.querySelector("label").innerHTML,
            valueToRemove = elem.value;

          var newTag = this.createElement(
            list_item_template,
            "city",
            valueToRemove,
            tagLabel
          );

          this.filter_list.appendChild(newTag);
        });

        // collect tags and bring to tag_list
        var nodes = this.target.querySelectorAll(
          `input[name="_type[]"]:checked`
        );
        nodes.forEach((elem) => {
          var tagLabel = elem.parentElement.querySelector("label").innerHTML,
            valueToRemove = elem.value;

          var newTag = this.createElement(
            list_item_template,
            "type",
            valueToRemove,
            tagLabel
          );

          this.filter_list.appendChild(newTag);
        });

        // if keyword is entered add it to list
        if (this.keyword && this.keyword.value !== "") {
          var newTag = this.createElement(
            list_item_template,
            "keyword",
            "",
            this.keyword.value
          );
          this.filter_list.appendChild(newTag);
        }

        if ( this.settings.daterangepicker ) {

          // add daterange tag
          let startdate = $('input[name="daterange"]').data('daterangepicker').startDate.format( 'MM/DD/YY' ).toString();
          let enddate = $('input[name="daterange"]').data('daterangepicker').endDate.format( 'MM/DD/YY' ).toString();

          if ( startdate !== DATAENGINEEVENTS.mindate || enddate !== DATAENGINEEVENTS.defaultenddate ) {
            var newTag = this.createElement(
              list_item_template,
              "startdate",
              "",
              startdate + ' - ' + enddate
            );

            this.filter_list.appendChild(newTag);

          }
  
        }
        
        // Show or hide the filter_list based on its content
        if (this.filter_list.childNodes.length > 0) {
          this.filter_list.style.display = "block";
        } else {
          this.filter_list.style.display = "none";
        }
      }
    },

    addUpdatingClass: function () {
      this.target.classList.add("updating");
    },

    removeUpdatingClass: function () {
      this.target.classList.remove("updating");
    },

    /**
     * init the daterangepicker library and update start- and enddate
     */
    datarangeEnable: function() {

      let $this = this;

      
      $( function() {
        // set daterange to true
        $this.settings.daterangepicker = true;
        // init the picker
        $( 'input[name="daterange"]' ).daterangepicker({ 
          minDate: DATAENGINEEVENTS.mindate, 
          autoApply: false, 
          opens: 'center',
          locale: {
            format: 'MM/DD/YY',
            cancelLabel: 'Clear',
          } 
        });
        // set startdate
        if ( DATAENGINEEVENTS.startdate ) {
          $( 'input[name="daterange"]' ).data( 'daterangepicker' ).setStartDate( DATAENGINEEVENTS.startdate );
        } else {
          $( 'input[name="daterange"]' ).data( 'daterangepicker' ).setStartDate( DATAENGINEEVENTS.mindate );
        }
        // set enddate
        if ( DATAENGINEEVENTS.enddate ) {
          $( 'input[name="daterange"]' ).data( 'daterangepicker' ).setEndDate( DATAENGINEEVENTS.enddate );
        } else {
          $( 'input[name="daterange"]' ).data( 'daterangepicker' ).setEndDate( DATAENGINEEVENTS.defaultenddate );
        }
        // update the filtertags so it adds the buttons
        $this.filterTagsUpdate();
      });


      // add an event to the apply button of the daterange
      $( 'input[name="daterange"]' ).on( 'apply.daterangepicker' , this.daterangepickerApply.bind(this) );
      $( 'input[name="daterange"]' ).on( 'keyup' , this.daterangepickerKeyup.bind(this) );
      $('input[name="daterange"]').on('cancel.daterangepicker', this.daterangepickerClear.bind(this));      

    },

    daterangepickerClear: function(ev, picker) {
      //do something, like clearing an input
      $( 'input[name="daterange"]' ).data( 'daterangepicker' ).setStartDate( DATAENGINEEVENTS.mindate );
      $( 'input[name="daterange"]' ).data( 'daterangepicker' ).setEndDate( DATAENGINEEVENTS.defaultenddate );
      this.daterangepickerApply();
    },

    /**
     * daterangepickerApply
     * when autoapplying, collect the params
     * 
     * @param {*} ev 
     * @param {*} picker 
     */
    daterangepickerApply: function(ev,picker) {
        if ( this.view !== 'paged' ) {
          // switch to paged view by triggering a click
          this.target.querySelector( '.switch-view-paged' ).click();
        }
        this.collectTimed(null);
    },

    daterangepickerKeyup: function( event ) {

      if ( event.key === 'Enter' ) {
        this.daterangepickerApply();
      }
    },

    renderListingContent: function (html) {
      if ( typeof html == 'undefined' || html.trim() == "" ) {
        this.triggerHook("listingNoResults", this.view);
        if ("month" == this.view) {
          let temp = this.target.querySelector("#month-no-results");
          this.listing.innerHTML = temp.innerHTML;
        } else if ("paged" == this.view) {
          let temp = this.target.querySelector("#paged-no-results");
          this.listing.innerHTML = temp.innerHTML;
        }
      } else {
        this.listing.innerHTML = html;
      }
    },

    renderPaginationContent: function (html) {
      this.pagination.innerHTML = html;
    },

    handleEmptyListings: function () {
      this.renderListingContent(this.listing.innerHTML);
    },

    resetFilters: function () {
      this.keyword.value = "";
      this.citytag.forEach((elem) => (elem.checked = false));
      this.typetag.forEach((elem) => (elem.checked = false));
      this.collectTimed(null);
    },

    /**
     * get the values of multicheckboxes
     * @param {*} param
     */
    multiValue: function (param) {
      values = [];
      const nodes = this.target.querySelectorAll(
        `input[name="${param}[]"]:checked`
      );
      nodes.forEach((elem) => values.push(elem.value));
      return values;
    },

    handlePaginationClick: function (event) {
      if (event.target.classList.contains("event-page")) {
        event.preventDefault();
        this.collectTimed(null, event.target.dataset.page);
        this.triggerHook("afterPagination");
      }
    },

    changeMonth: function (event) {
      if (event.target.classList.contains("nav-month")) {
        event.preventDefault();
        // if also disabled return early
        if (event.target.classList.contains("disabled")) return;
        this.target.dataset.month = event.target.dataset.month;
        this.target.querySelector("#switch_month").dataset.current =
          event.target.dataset.month;
        // reset the month navigation because it has changed
        this.setMonthNavigation();
        this.collectTimed();
      }
    },

    switchView: function (event) {
      if ( event.target.classList.contains("switch-view") ) {
        event.preventDefault();
        // if we are switching from mapview, simply toggle
        if ( this.target.dataset.mapview == 'true' ) {
          this.switchMapView( false );
        } 

        if ( this.target.dataset.view == event.target.dataset.view ) return;

        this.view = event.target.dataset.view;
        this.target.dataset.view = this.view;

        // Reset filters if switching to month view
        if (this.view === "month") {
          this.resetFilters();
        }

        this.setMonthNavigation();
        this.collectTimed();

      }
    },

    mapViewHandler: function (event) {
      if (event.target.classList.contains("switch-mapview")) {
        event.preventDefault();
        // switch to not current mapView mode
        let currentView = (this.target.dataset.mapview == 'true');
        this.switchMapView( !currentView );
      }
    },

    switchMapView: function( showMap ) {
      this.target.dataset.mapview = showMap;
      this.renderMap();
      // now simply hide the listing and show the map
      this.listing.style.display =
        this.target.dataset.mapview == "true" ? "none" : "block";
      this.pagination.style.display =
        this.target.dataset.mapview == "true" ? "none" : "block";
      this.map.style.display =
        this.target.dataset.mapview == "true" ? "block" : "none";
      this.map.style.pointerEvents =
        this.target.dataset.mapview == "true" ? "all" : "none";

    },

    /** Render the map */
    renderMap: function () {
      // now let's determine if we need to render the Map
      // when we change data using a ajax load, we void the mapviewlatest
      // so that it should rerender the map

      if (
        this.target.dataset.mapviewlatest == "false" &&
        this.target.dataset.mapview == "true"
      ) {
		// init the map if we haven't already
		if (!this.mapObject) this.mapObject = this.mapInit(this.map.querySelector(".acf-map"));
		// add the markers and center
		this.drawMarkers(this.data.map);
		// make sure we register that these are the latest loaded values
		this.target.dataset.mapviewlatest = "true";
		setTimeout( function() { this.centerMap(this.mapObject) }.bind( this ), 500 );
      }


    },

    updatePushURL: function (params) {
      if (history.pushState) {
        let compoundstring = [];
        for (const [key, value] of Object.entries(params)) {
          if (value) compoundstring.push(`${key}=${value}`);
        }

        let compound =
          compoundstring.length === 0 ? "" : "?" + compoundstring.join("&");
        var newurl =
          window.location.protocol +
          "//" +
          window.location.host +
          window.location.pathname +
          compound;
        window.history.pushState({ path: newurl }, "", newurl);
      }
    },

    setMonthNavigation: function () {
      this.month = this.target.dataset.month;

      // get year and month from our settings
      let year = this.month.slice(0, 4),
        month = this.month.slice(4);

      const date = new Date(`${year}-${month}-01T00:00:00`);

      const previous = this.addMonths(date, -1),
        next = this.addMonths(date, 1);

      this.previous.dataset.month = `${this.dateFormated(previous)}`;
      this.next.dataset.month = `${this.dateFormated(next)}`;

      if (this.previous.dataset.month < this.target.dataset.lowerbound) {
        this.previous.classList.add("disabled");
      } else {
        this.previous.classList.remove("disabled");
      }

      if (this.next.dataset.month > this.target.dataset.upperbound) {
        this.next.classList.add("disabled");
      } else {
        this.next.classList.remove("disabled");
      }
    },

    addMonths: function (date, months) {
      var newDate = new Date(date.getTime());
      newDate.setMonth(newDate.getMonth() + months);
      return newDate;
    },

    dateFormated: function (date) {
      var year = date.toLocaleString("default", { year: "numeric" });
      var month = date.toLocaleString("default", { month: "2-digit" });
      return `${year}${month}`;
    },

    numberToMonth: function (num) {
      const monthMap = {
        "01": "January",
        "02": "February",
        "03": "March",
        "04": "April",
        "05": "May",
        "06": "June",
        "07": "July",
        "08": "August",
        "09": "September",
        10: "October",
        11: "November",
        12: "December",
      };

      const year = String(num).slice(0, 4); // YYYMM - from start to 4th position to get year
      const month = monthMap[String(num).slice(4)]; // YYYMM - from 4th to the end

      return month + " " + year;
    },

    currentMonthHeader: function () {
      const current =
        this.target.querySelector("#switch_month").dataset.current;
      this.target.querySelector("#current-month").innerHTML =
        this.numberToMonth(current);
    },

    toggleFacetOptions: function () {
      const _this = this;
      $(".event-facet").on("click", ".facet-toggle", function (event) {
        event.preventDefault(); // Prevent the default action
        event.stopPropagation(); // Stop any other bound event

        const fieldset = $(this).closest(".event-facet").find("fieldset");
        const toggleSign = $(this).find(".facet-toggle-sign");

        // Change the +/- symbol depending on the state
        if (fieldset.is(":visible")) {
          toggleSign.text("+");
        } else {
          toggleSign.text("-");
        }

        // Toggle open/close the filter
        fieldset.slideToggle(350);
      });
    },

    scrollTop: function () {
      const headerHeight = $("header").outerHeight();
      let targetOffset =
        $(".dataengine-events-container").offset().top - headerHeight;

      $("html, body").animate(
        {
          scrollTop: targetOffset,
        },
        1000
      );
    },

    triggerHook: function (hook, args) {
      $("body").trigger("dataengine-events." + hook, args);
    },

    addHook: function (hook, callback) {
      $("body").on("dataengine-events." + hook, callback);
    },

    removeHook: function (hook, callback) {
      $("body").off("dataengine-events." + hook, callback);
    },

    customMapStyle: function () {
      // Custom map styling
      return [
        {
          featureType: "all",
          elementType: "geometry",
          stylers: [
            {
              color: "#f8f3ed",
            },
          ],
        },
        {
          featureType: "administrative",
          elementType: "geometry",
          stylers: [
            {
              color: "#f8f3ed",
            },
            {
              visibility: "simplified",
            },
          ],
        },
        {
          featureType: "administrative",
          elementType: "labels.text",
          stylers: [
            {
              color: "#554e24",
            },
            {
              visibility: "simplified",
            },
          ],
        },
        {
          featureType: "administrative.country",
          elementType: "geometry",
          stylers: [
            {
              visibility: "simplified",
            },
          ],
        },
        {
          featureType: "administrative.province",
          elementType: "geometry",
          stylers: [
            {
              color: "#f8f3ed",
            },
          ],
        },
        {
          featureType: "administrative.province",
          elementType: "labels.text",
          stylers: [
            {
              lightness: "0",
            },
            {
              visibility: "off",
            },
          ],
        },
        {
          featureType: "administrative.locality",
          elementType: "all",
          stylers: [
            {
              visibility: "on",
            },
            {
              weight: "1.00",
            },
            {
              color: "#554e24",
            },
          ],
        },
        {
          featureType: "administrative.locality",
          elementType: "labels.text",
          stylers: [
            {
              visibility: "simplified",
            },
          ],
        },
        {
          featureType: "administrative.neighborhood",
          elementType: "all",
          stylers: [
            {
              visibility: "simplified",
            },
          ],
        },
        {
          featureType: "administrative.land_parcel",
          elementType: "all",
          stylers: [
            {
              visibility: "off",
            },
          ],
        },
        {
          featureType: "poi",
          elementType: "labels.icon",
          stylers: [
            {
              visibility: "off",
            },
          ],
        },
        {
          featureType: "poi.attraction",
          elementType: "all",
          stylers: [
            {
              visibility: "off",
            },
          ],
        },
        {
          featureType: "poi.attraction",
          elementType: "geometry",
          stylers: [
            {
              visibility: "off",
            },
          ],
        },
        {
          featureType: "poi.attraction",
          elementType: "labels.text",
          stylers: [
            {
              visibility: "off",
            },
          ],
        },
        {
          featureType: "poi.business",
          elementType: "all",
          stylers: [
            {
              visibility: "off",
            },
          ],
        },
        {
          featureType: "poi.government",
          elementType: "all",
          stylers: [
            {
              visibility: "off",
            },
          ],
        },
        {
          featureType: "poi.medical",
          elementType: "all",
          stylers: [
            {
              visibility: "off",
            },
          ],
        },
        {
          featureType: "poi.park",
          elementType: "geometry.fill",
          stylers: [
            {
              color: "#ede9c4",
            },
          ],
        },
        {
          featureType: "poi.park",
          elementType: "labels.text",
          stylers: [
            {
              visibility: "off",
            },
          ],
        },
        {
          featureType: "poi.place_of_worship",
          elementType: "all",
          stylers: [
            {
              visibility: "off",
            },
          ],
        },
        {
          featureType: "poi.school",
          elementType: "all",
          stylers: [
            {
              visibility: "off",
            },
          ],
        },
        {
          featureType: "poi.sports_complex",
          elementType: "all",
          stylers: [
            {
              visibility: "off",
            },
          ],
        },
        {
          featureType: "road",
          elementType: "geometry.fill",
          stylers: [
            {
              color: "#ffffff",
            },
          ],
        },
        {
          featureType: "road",
          elementType: "geometry.stroke",
          stylers: [
            {
              color: "#000000",
            },
          ],
        },
        {
          featureType: "road",
          elementType: "labels",
          stylers: [
            {
              visibility: "off",
            },
          ],
        },
        {
          featureType: "road",
          elementType: "labels.text",
          stylers: [
            {
              color: "#b6a998",
            },
            {
              visibility: "simplified",
            },
          ],
        },
        {
          featureType: "road.highway",
          elementType: "geometry",
          stylers: [
            {
              visibility: "simplified",
            },
          ],
        },
        {
          featureType: "road.highway",
          elementType: "geometry.stroke",
          stylers: [
            {
              color: "#000000",
            },
            {
              weight: "0.01",
            },
          ],
        },
        {
          featureType: "road.highway",
          elementType: "labels",
          stylers: [
            {
              visibility: "off",
            },
          ],
        },
        {
          featureType: "road.highway",
          elementType: "labels.text",
          stylers: [
            {
              color: "#554e24",
            },
          ],
        },
        {
          featureType: "road.highway",
          elementType: "labels.icon",
          stylers: [
            {
              visibility: "off",
            },
          ],
        },
        {
          featureType: "road.arterial",
          elementType: "geometry",
          stylers: [
            {
              visibility: "simplified",
            },
          ],
        },
        {
          featureType: "road.arterial",
          elementType: "labels",
          stylers: [
            {
              visibility: "simplified",
            },
          ],
        },
        {
          featureType: "road.local",
          elementType: "all",
          stylers: [
            {
              visibility: "off",
            },
          ],
        },
		{
          featureType: "road.local",
          elementType: "geometry",
          stylers: [
            {
              visibility: "simplified",
            },
          ],
        },
        {
          featureType: "road.local",
          elementType: "labels",
          stylers: [
            {
              visibility: "simplified",
            },
          ],
        },
		{
          featureType: "road.local",
          elementType: "labels.text",
          stylers: [
			{
              visibility: "simplified",
            },
            {
              color: "#b6a998",
            },
          ],
        },
        {
          featureType: "transit",
          elementType: "all",
          stylers: [
            {
              visibility: "off",
            },
          ],
        },
        {
          featureType: "transit.station",
          elementType: "all",
          stylers: [
            {
              visibility: "off",
            },
          ],
        },
        {
          featureType: "water",
          elementType: "geometry",
          stylers: [
            {
              color: "#d3e8ec",
            },
          ],
        },
        {
          featureType: "water",
          elementType: "labels.text",
          stylers: [
            {
              visibility: "off",
            },
          ],
        },
      ];
    },

    mapInit: function (elem) {
      // vars
      var args = {
        zoom: 14,
        center: new google.maps.LatLng(0, 0),
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        styles: this.customMapStyle(),
        zoomControl: false, // Disable default zoom controls - we will create our own custom ones
        streetViewControl: false,
        fullscreenControl: false, // Disable default full-screen control
        scrollwheel: false,
      };

      // create map
      var map = new google.maps.Map(elem, args);

      // add a markers reference
      map.markers = [];

      // Create Zoom Control container
      var zoomControlDiv = document.createElement("div");
      zoomControlDiv.id = "custom-zoom-control";
      var zoomControl = new this.CustomZoomControl(zoomControlDiv, map);
      zoomControlDiv.index = 1;
      map.controls[google.maps.ControlPosition.TOP_RIGHT].push(zoomControlDiv);

      return map;
    },

    // Custom map controls

    CustomZoomControl: function (controlDiv, map) {
      // Create zoom-in button
      var zoomInButton = document.createElement("div");
      zoomInButton.className = "custom-zoom-in";
      controlDiv.appendChild(zoomInButton);

      // Create zoom-out button
      var zoomOutButton = document.createElement("div");
      zoomOutButton.className = "custom-zoom-out";
      controlDiv.appendChild(zoomOutButton);

      // Setup click event listener for zoom-in button
      google.maps.event.addDomListener(zoomInButton, "click", function () {
        map.setZoom(map.getZoom() + 1);
      });

      // Setup click event listener for zoom-out button
      google.maps.event.addDomListener(zoomOutButton, "click", function () {
        map.setZoom(map.getZoom() - 1);
      });
    },

    /*
     *  addMarker
     *
     *  This function will add a marker to the selected Google Map
     *
     *  @type	function
     *  @date	8/11/2013
     *  @since	4.3.0
     *
     *  @param	$marker (jQuery element)
     *  @param	map (Google Map object)
     *  @return	n/a
     */
    addMarker: function (event, map) {
      // var
      var latlng = new google.maps.LatLng(event.lat, event.lng);
      var markerId = event.ID; // Retrieve the data-id attribute from the $marker

      // External SVG icon
      var svgPinIcon = {
        url: DATAENGINEEVENTS.plugindir + "assets/icon-map-pin-drop-shadow.svg",
        scaledSize: new google.maps.Size(50, 50), // dimensions
        labelOrigin: new google.maps.Point(25, 60),
      };

      // create marker
      var marker = new google.maps.Marker({
        position: latlng,
        map: map,
        cursor: "pointer",
        icon: svgPinIcon,
        id: markerId,
        optimized: false,
      });

      google.maps.event.addListener(marker, "click", function () {
        window.location.href = event.permalink;
      });

      // add to array
      map.markers.push(marker);

      // Create custom overlay for the marker label
      var labelDiv = document.createElement("div");
      labelDiv.className = "custom-marker-label";
      labelDiv.style.opacity = "0";
      labelDiv.innerHTML = event.title;

      var label = new google.maps.OverlayView();
      label.onAdd = function () {
        // Append the element to the floatPane instead of overlayLayer
        var panes = this.getPanes();
        panes.floatPane.appendChild(labelDiv);
        labelDiv.style.zIndex = "9999999999"; // High z-index to be on top of markers
        labelDiv.style.pointerEvents = "none"; // Marker labels aren't clickable so they don't get in the way of other markers getting clicked
      };

      label.draw = function () {
        var position = this.getProjection().fromLatLngToDivPixel(latlng);
        labelDiv.style.left = position.x + "px";
        labelDiv.style.top = position.y + "px";
      };

      label.setMap(map);

      google.maps.event.addListener(marker, "mouseover", function () {
        var hoverIcon = {
          url: DATAENGINEEVENTS.plugindir + "assets/icon-map-pin-current.svg",
          scaledSize: new google.maps.Size(50, 50),
          labelOrigin: new google.maps.Point(25, 60),
        };
        marker.setIcon(hoverIcon);
        marker.setZIndex(google.maps.Marker.MAX_ZINDEX + 1);

        if (labelDiv) {
          labelDiv.style.opacity = "1";
        }
      });

      google.maps.event.addListener(marker, "mouseout", function () {
        var originalIcon = {
          url: DATAENGINEEVENTS.plugindir + "assets/icon-map-pin-drop-shadow.svg",
          scaledSize: new google.maps.Size(50, 50),
          labelOrigin: new google.maps.Point(25, 60),
        };
        marker.setIcon(svgPinIcon);
        marker.setZIndex(null); // This will reset the z-index

        if (labelDiv) {
          labelDiv.style.opacity = "0";
        }
      });

      marker.customLabel = labelDiv; // Attach the label to the marker

    },

    /*
     *  centerMap
     *
     *  This function will center the map, showing all markers attached to this map
     *
     *  @type	function
     *  @date	8/11/2013
     *  @since	4.3.0
     *
     *  @param	map (Google Map object)
     *  @return	n/a
     */
    centerMap: function (zoom) {
      // vars
      var bounds = new google.maps.LatLngBounds();

      // loop through all markers and create bounds
      $.each(this.mapObject.markers, function (i, marker) {
        var latlng = new google.maps.LatLng(
          marker.position.lat(),
          marker.position.lng()
        );

        bounds.extend(latlng);
      });

      // only 1 marker?
      if (this.mapObject.markers.length == 1) {
        // set center of map
        this.mapObject.setCenter(bounds.getCenter());
        this.mapObject.setZoom(zoom || 14);
      } else {
        // fit to bounds
        this.mapObject.setCenter(bounds.getCenter());
        this.mapObject.setZoom(14); // Change the zoom value as required
        this.mapObject.fitBounds(bounds);
      }
    },

    /**
     * remove all markers if any
     */
    clearAllMarkers: function () {
      for (let i = 0; i < this.mapObject.markers.length; i++) {
        this.mapObject.markers[i].setMap(null);
      }
    },

    /**
     * Draw markers from the eventsdata
     * @param {*} eventdata
     */
    drawMarkers: function (eventdata) {
      this.clearAllMarkers();
      this.mapObject.markers = [];
      Object.keys(eventdata).forEach((key) => {
        this.addMarker(eventdata[key], this.mapObject);
      });

      this.centerMap();
    },
  };
})(jQuery);
