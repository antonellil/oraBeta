function testProcess(data) {
    console.log(data);
}

var mapOptions;
var map;
var hereMarker;
var specialMarker;

var app = {
    testprocess: function(data) {
        console.log(data);
    },
    init: function() {
        //Initialize basic variables and conduct the initial search
        app.user = null;
        app.searchLocation = 'current location';
        app.resultsPerPage = 15;
        app.offset = 0;

        if(String(navigator.connection.type)=='none'){
            alert("Fondle your connection!");
        } else{
            app.initialSearch();
        }

        //DOM Listeners - TODO: Move listeners to more appropriate location
        $('#currentLocationIcon').on('tap',function(){
            $('.loadingOverlay').show();
            $('#searchField').val('Current Location');
            $('#searchButton').trigger('tap');
        });

        $('#searchButton').on('tap',function(){
            $('.loadingOverlay').show();
            $.mobile.changePage("#resultsPage", {
                transition: "slide"
            });
            app.searchLocation = $.trim($('#searchField').val().toLowerCase());
            app.offset = 0;
            app.time = $('#specialDay').val() == 'tomorrow' ? 0 : app.parseTime(app.getTime());
            app.hour = $('#specialDay').val() == 'tomorrow' ? 0 : app.getHour(app.getTime());
            app.timeHeaderRaw = $('#specialDay').val() == 'tomorrow' ? String((app.hour + 5) % 24)+':00' : app.getTime();
            app.timeHeader = app.toStandardTimeInfo(app.timeHeaderRaw);
            $('#timeSlider').val(app.hour).slider('refresh');
            $('#timeSliderWrap a').html(app.convertHour(app.hour));
            app.search(app.searchLocation,app.offset);      
        });

        $('#resultsSliderWrap').on('resultsChange',function(event,val){
            app.updateSliderHandle(val);
        });

        $('#timeSliderWrap').on('timeChange',function(event,val){
            if(parseInt(app.hour)!=parseInt(val)) {
                app.hour = parseInt(val);
                app.offset = 0;
                app.timeHeader = app.toStandardTimeInfo(String((app.hour + 5) % 24)+':00');
                app.time = parseFloat(val);
                $('#timeSliderWrap a').html(app.convertHour(val));
                $('#timeSlider').val(val).slider('refresh');
                app.search(app.searchLocation,app.offset);
            }
        });

        $('#selectedResult').on("swipeleft tap", function( event ) {
            $('#resultsLoadingOverlay').show();
            $.mobile.changePage("#mapPage", {
                transition: "slide"
            });
        });

        $('#resultsPage').on("swiperight", function( event ){
            $('#resultsLoadingOverlay').show();
            $.mobile.changePage("#searchPage", {
                transition: "slide",
                reverse: true
            });         
        });

        $('#mapPage .selectedResult').on("swipeleft", function( event ){
            var current = parseInt($('a.ui-slider-handle-vertical').attr('resultIndex'));
            if(current<(app.results.length-1)) {
                app.updateSliderHandle(current+1);
                app.updateMapPage();
            }
            /*$('#mapLoadingOverlay').show();
            $.mobile.changePage("#resultsPage", {
                transition: "slide",
                reverse: true
            });*/         
        }).on("swiperight", function( event ){
            var current = parseInt($('a.ui-slider-handle-vertical').attr('resultIndex'));
            if(current>0){
                app.updateSliderHandle(current-1);
                app.updateMapPage();
            }       
        });

        $('#nextSpecialArrow').on('tap',function(){
            var current = parseInt($('a.ui-slider-handle-vertical').attr('resultIndex'));
            if(current<(app.results.length-1)) {
                app.updateSliderHandle(current+1);
                app.updateMapPage();
            }
        });

        $('#prevSpecialArrow').on('tap',function(){
            var current = parseInt($('a.ui-slider-handle-vertical').attr('resultIndex'));
            if(current>0){
                app.updateSliderHandle(current-1);
                app.updateMapPage();
            } 
        });

        $('#nextPageResults').on('tap',function(){
            if(app.results.length>(app.resultsPerPage-1)) {
                $('#resultsLoadingOverlay').show();
                app.offset+=app.resultsPerPage;
                app.search(app.searchLocation,app.offset)
            }
        });

        $('#prevPageResults').on('tap',function(){
            if(app.offset>0) {
                $('#resultsLoadingOverlay').show();
                app.offset-=app.resultsPerPage;
                app.search(app.searchLocation,app.offset);
            }
        });

        $('#searchIcon').on('tap',function(){
            $('#resultsLoadingOverlay').show();
            $.mobile.changePage("#searchPage", {
                transition: "slide",
                reverse: true
            });
        });

        $('#cancelButton').on('tap',function(){
            $('#searchLoadingOverlay').show();
            $.mobile.changePage("#resultsPage", {
                transition: "slide"
            });
        });

        $('#backIcon').on('click',function(){
            $('#mapLoadingOverlay').show();
        });

        $('#searchPage').on("swipeleft",function(){
            $('#searchLoadingOverlay').show();
            $.mobile.changePage("#resultsPage", {
                transition: "slide"
            });  
        });

        $('#mapCanvas').on('click', 'a', function(e){
            e.preventDefault();
            window.open($(this).attr('href'), '_blank');
        });
    },
    //Executes when returning from the background
    onResume: function() {
        $('.loadingOverlay').show();
        $.mobile.changePage("#resultsPage", {
            transition: "none"
        });
        app.initialSearch();
    },
    //Initial search code
    initialSearch: function() {
        app.time = $('#specialDay').val() == 'tomorrow' ? 0 : app.parseTime(app.getTime());
        app.hour = $('#specialDay').val() == 'tomorrow' ? 0 : app.getHour(app.getTime());
        app.timeHeaderRaw = $('#specialDay').val() == 'tomorrow' ? String((app.hour + 5) % 24)+':00' : app.getTime();
        app.timeHeader = app.toStandardTimeInfo(app.timeHeaderRaw);
        $('#timeSlider').val(app.hour).slider('refresh');
        $('#timeSliderWrap a').html(app.convertHour(app.hour));
        app.search(app.searchLocation,app.offset);
        //app.generateTimeline();
    },
    //Conduct search given the contents of the search input
    search: function(location,offset) {
        app.resetSearch();
        $('.loadingOverlay').show();

        if(String(navigator.connection.type)=='none'){
            alert("Fondle your connection!");
            $('.loadingOverlay').hide();
        } else {
            //Temp for testing
            app.header = 'Here';
            var today = new Date();
            var tomo = new Date();
            tomo.setDate(tomo.getDate() + 1);

            //Params for results query
            app.today = app.getDay(today);
            app.tomorrow = app.getDay(tomo);
            app.type = $('.specialType:checked').map(function(){return this.value;}).get();
            app.when = $('#specialDay').val();
            app.sort = $('.specialSort:checked').val();
            var headerPrefix = $('#specialDay').val() == 'now' ? 'At' : '';
            var headerSuffix = $('#specialDay').val() == 'later' ? '&amp; Later' : ($('#specialDay').val() == 'tomorrow' ? '& Later Tomorrow' : '');

            $('#searchHeader h1').html(headerPrefix+' '+app.timeHeader+' '+headerSuffix);

            //TODO when ready for device uncomment below and move above code
            navigator.geolocation.getCurrentPosition(function(position) {
                app.lng =  position.coords.longitude;
                app.lat =  position.coords.latitude;

                //TODO check for internet connection
                $.ajax({
                    url: "http://wherebearadmin.herokuapp.com/specials",
                    type: 'GET',
                    dataType: 'jsonp',
                    data: {lat:app.lat,lng:app.lng,today:app.today,type:app.type,time:app.time,when:app.when,tomorrow:app.tomorrow,
                        location:location,offset:offset,limit:app.resultsPerPage,sort:app.sort},
                    cache: true,
                    timeout: 8000,
                    success: function(json) {
                        console.log(json);
                        if(json.error) {
                            alert(json.errorMessage);
                            $('.loadingOverlay').hide();
                        } else {
                            app.lat = json.data.lat;
                            app.lng = json.data.lng;
                            app.results=json.data.rows;
                            if(app.results.length>0) {
                                app.processResults();
                            } else {
                                alert("No results at this time, try another!");
                                app.clearResultsHeader();
                                $('.selectedResult').hide();
                                $('#resultsHeader').fadeIn();
                                $('.loadingOverlay').hide();
                            }
                        }
                    },
                    error: function(xhr, status, error) {
                        alert("Try again in a second!");
                        app.clearResultsHeader();
                        $('.selectedResult').hide();
                        $('#resultsHeader').fadeIn();
                        $('.loadingOverlay').hide();
                    }
                });
            }, function(error) {
                alert('There was an error detecting your location, please try again!');
                $('.loadingOverlay').hide();
            }, { maximumAge: 3000, timeout: 8000, enableHighAccuracy: true });
        }

    },
    //Generates appropriate timeline numbers
    generateTimeline: function() {
        var baseHour = app.getHour(app.getTime()) < 2 ? 0 : app.getHour(app.getTime())-2;
        var tempHour = app.getHour(app.getTime()) < 2 ? 0 : app.getHour(app.getTime())-2;
        var width = 1.00/parseFloat(24 - baseHour) * 100.0;
        $('#timeLine .labels').html('');
        for(i=baseHour;i<24;i++) {
            var hour = (tempHour + 5) % 12 == 0 ? ((tempHour+5) < 13 ? 'N' : 'M') : (tempHour + 5) % 12;
            var left = parseFloat(tempHour-baseHour) / parseFloat(24 - baseHour) * 100.00;
            $('#timeLine .labels').append('<span class="hour" style="left:'+left+'%;width:'+width+'%;text-align:left;">'+hour+'</span>');
            tempHour+=1;
        }
        $('#timeSliderWrap input[type=number]').attr('min',baseHour);
        $('#timeSlider').val(app.hour).slider('refresh');
    },
    //Gets the WhereBear day of week given a date object
    getDay: function(date) {
        var weekday = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
        var day = date.getHours() < 5 ? (date.getDay() - 1) : date.getDay();
        var fixedDay = day < 0 ? 6 : day;
        return weekday[fixedDay];
    },
    //Gets the current client time
    getTime: function() {
        var today = new Date();
        var minutes = today.getMinutes();
        var trueMinutes = minutes < 10 ? "0"+minutes : minutes;
        return today.getHours()+':'+trueMinutes;
    },
    //Converts string military time to standard time
    toStandardTime: function(time) {
        var timeParts = time.split(":");
        var hour = parseInt(timeParts[0]) > 12 ? parseInt(timeParts[0]) % 12 : (parseInt(timeParts[0])==0 ? 12 : parseInt(timeParts[0]));
        return hour+':'+timeParts[1];
    },
    toStandardTimeInfo: function(time) {
        var timeParts = time.split(":");
        var hour = parseInt(timeParts[0]) > 12 ? parseInt(timeParts[0]) % 12 : (parseInt(timeParts[0])==0 ? 12 : parseInt(timeParts[0]));
        var ap = timeParts[0] > 11 ? ' PM' : ' AM';
        return hour+':'+timeParts[1]+ap;
    },
    //Resets the appropriate DOM elements and variables when search is initialized
    resetSearch: function() {
        var left = app.parseTime(app.getTime())/24.00 * 100.0;
        $('#nowLine').css('left',left+'%').hide();
        $('#resultsHeader').hide();
        $('#results').html("").hide();
        $('#resultsSliderWrap').hide();
        $('#prevPageResults').hide();
        $('#nextPageResults').hide();
    },
    finishSearch: function() {
        $('#resultsSlider').val(0).slider('refresh');
        $('.selectedResult').show();
        $('#resultsHeader').fadeIn();
        $('#resultsSliderWrap').fadeIn();
        $('#results').fadeIn();
        $('#nowLine').fadeIn();
        if(app.offset>0) {
            $('#prevPageResults').show();
        }
        if(app.results.length>(app.resultsPerPage-1)) {
            $('#nextPageResults').show();
        }
        $('.loadingOverlay').hide();
    },
    //Processes returned results for the DOM
    processResults: function() {
        //Injects each result into the DOM
        $.each(app.results,function (i,item) {
            $('#results').append('<div class="result" index="'+i+'" '+app.resultProperties(item)+'><div class="startTime">'+app.toStandardTime(unescape(item.starttime))+'</div><div class="endTime">'+app.toStandardTime(unescape(item.endtime))+'</div></div>');
        });

        //Sets the properties of the search elements
        app.currentResult = app.results[0];
        //Result slider initiation
        var sliderHeight = (app.results.length - 1)*20;
        $('#resultsSliderWrap a.ui-slider-handle-vertical').attr('resultIndex',0);
        $('#resultsSliderWrap .ui-slider-vertical').css('height',sliderHeight+'px');
        $('#resultsSliderWrap input[type=number]').attr('max',(app.results.length - 1));
        //Time slider initiation
        //$('#timeSliderWrap input[type=number]').attr('min',app.hour);
        //Fill first result
        app.fillSelectedResult(app.results[0]);
        $('[index="0"] div').show();
        $('[index="0"]').addClass('highlight');

        //Show results
        app.finishSearch();
    },
    updateSliderHandle: function(val) {
        var current = $('#resultsSliderWrap a.ui-slider-handle-vertical').attr('resultIndex');
        
        if(current != val) {
            $('#resultsSliderWrap a.ui-slider-handle-vertical').attr('resultIndex',val);
            $('[index="'+current+'"] div').hide();
            $('[index="'+current+'"]').removeClass('highlight');
            app.currentResult = app.results[val];
            app.fillSelectedResult(app.results[val]);
            $('[index="'+val+'"] div').show();
            $('[index="'+val+'"]').addClass('highlight');
        }
    },
    clearResultsHeader: function() {
        $('.selectedResult .desc').html("");
        $('.selectedResult .info').html("");
        $('.selectedResult .venue').html("");
        $('.selectedResult .time').html("");
        $('.selectedResult .address').html("");
    },
    fillSelectedResult: function(result) {
        var value = result.valuetype == 'price' ? '$'+result.value.toFixed(2) : (result.value*100).toFixed(0)+'% Off';
        $('.selectedResult .desc').html(value+' '+unescape(result.description));
        $('#selectedResult .info').html(result.distance.toFixed(2)+' mi &bull; '+unescape(result.venue));
        $('#mapResult .info').html(result.distance.toFixed(2)+' mi &bull; '+app.toStandardTimeInfo(unescape(result.starttime))+' - '+app.toStandardTimeInfo(unescape(result.endtime)));
        $('.selectedResult .address').html(unescape(result.address)+', '+unescape(result.city));
    },
    resultProperties: function(result) {
        /*
        var startHour = app.getHour(app.getTime()) < 2 ? 0 : app.getHour(app.getTime())-2;
        var dayLength = 24.00 - parseFloat(startHour);
        var width= (result.endvalue-result.startvalue) / dayLength *100.0;
        var left = (result.startvalue - parseFloat(startHour)) / dayLength *100.0;
        return 'style="width:'+width+'%;left:'+left+'%;"';
        */
        
        var width= (result.endvalue-result.startvalue) / 24.00 *100.0;
        var left = result.startvalue / 24.00 *100.0;
        return 'style="width:'+width+'%;left:'+left+'%;"';
    },
    parseTime: function(time) {
        var timeParts = time.split(":");
        var convertedMinutes = parseFloat(timeParts[1])/60.0;
        return parseFloat(String((parseInt(timeParts[0])+19) % 24)+String(convertedMinutes).replace("0",""));
    },
    getHour: function(time) {
        var timeParts = time.split(":");
        return (parseInt(timeParts[0])+19) % 24;
    },
    convertHour: function(val) {
        var raw = parseInt(val)+5;
        return raw == 12 ? 'N' : (raw == 24 ? 'M' : raw % 12);
    },
    updateMapPage: function() {
        if(String(navigator.connection.type)=='none'){
            alert("Fondle your connection!");
        } else {
            $('#prevSpecialArrow').hide();
            $('#nextSpecialArrow').hide();

            var current = parseInt($('a.ui-slider-handle-vertical').attr('resultIndex'));
            if(current<(app.results.length-1)) {
                $('#nextSpecialArrow').show();
            }
            if(current>0){
                $('#prevSpecialArrow').show();
            }

            $('#mapHeader h1').text(unescape(app.currentResult.venue));

            //Initialize map objects TODO fix bug without recreating the map each time
            mapOptions = {
                zoom: 8,
                center: new google.maps.LatLng(app.lat, app.lng),
                mapTypeId: google.maps.MapTypeId.ROADMAP,
                disableDefaultUI: true,
                zoomControl: false
            };

            map = new google.maps.Map(document.getElementById('mapCanvas'),mapOptions);

            //Set up the lat lng vars and icon
            var hereLatLng = new google.maps.LatLng(app.lat, app.lng);
            var thereLatLng = new google.maps.LatLng(app.currentResult.lat, app.currentResult.lng);
            var thereIcon = {
                path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                strokeColor: '#0E5880',
                fillColor: '#199DE6',
                fillOpacity: 1,
                strokeWeight: 1,
                scale: 5
            };

            var hereIcon = {
                path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                strokeColor: '#000000',
                fillColor: '#1a1a1a',
                fillOpacity: 1,
                strokeWeight: 1,
                scale: 5
            };

            //Set map bounds and adjust
            var bounds = new google.maps.LatLngBounds();
            bounds.extend(hereLatLng);
            bounds.extend(thereLatLng);
            map.fitBounds(bounds);

            //Drop the markers
            hereMarker = new google.maps.Marker({
                position: hereLatLng,
                map: map,
                title: "Here",
                draggable: false,
                icon: hereIcon,
                animation: google.maps.Animation.DROP
            });
            specialMarker = new google.maps.Marker({
                position: thereLatLng,
                map: map,
                icon: thereIcon,
                title: unescape(app.currentResult.description),
                draggable: false,
                animation: google.maps.Animation.DROP
            });

            //TODO move this to a function call
            $('#yelpWrap .image').html('');
            $('#yelpWrap .rating').html('');
            $('#yelpWrap .reviews').html('');
            $('#yelpWrap .yelplogo').hide();
            $('#yelpWrap').show();
            $('#yelpWrap').addClass('loading');

            $.ajax({
                url: "http://wherebearadmin.herokuapp.com/venueyelp",
                type: 'GET',
                dataType: 'jsonp',
                data: {lat:app.currentResult.lat,lng:app.currentResult.lng,venue:app.currentResult.venue},
                cache: true,
                timeout: 8000,
                success: function(json) {
                    if(json.error) {
                        $('#yelpWrap').removeClass('loading');
                        $('#yelpWrap').hide();
                    } else {
                        $('#yelpWrap').removeClass('loading');
                        $('#yelpWrap .rating').html('<img src="'+json.data.businesses[0].rating_img_url_small+'" />');
                        $('#yelpWrap .reviews').html(json.data.businesses[0].review_count+' reviews');
                        $('#yelpWrap .image').html('<img src="'+json.data.businesses[0].image_url+'" />');
                        $('#yelpWrap .yelplogo').show();
                    }
                },
                error: function(xhr, status, error) {
                    $('#yelpWrap').removeClass('loading');
                    $('#yelpWrap').hide();
                }
            });
        }
    }
}

/* App initialization variables and functions ----------------------------------------------------------- */
var deviceReadyDeferred = $.Deferred();
var jqmReadyDeferred = $.Deferred();
var googleReady = $.Deferred();

$.when(deviceReadyDeferred).done(function(){
    app.init();
});

document.addEventListener("deviceReady", deviceReady, false);

google.maps.event.addDomListener(window, 'load', googleReady);

function deviceReady() {
  deviceReadyDeferred.resolve();
  document.addEventListener("resume", app.onResume, false);
}

function googleReady() {
  googleReady.resolve();
}

$(document).bind("mobileinit", function () {
    $.support.cors = true;
    $.mobile.allowCrossDomainPages = true;
    $.mobile.defaultHomeScroll = 0;
    $.mobile.defaultPageTransition = 'none';
    jqmReadyDeferred.resolve();
}).on("pageshow", "#mapPage", function(){
    app.updateMapPage();
    $('#resultsLoadingOverlay').hide();
}).on("pageshow", "#resultsPage", function(){
    $('#searchLoadingOverlay').hide();
    $('#mapLoadingOverlay').hide();
}).on("pageshow", "#searchPage", function(){
    $('#resultsLoadingOverlay').hide();
});



